<?php
// app/Http/Controllers/Admin/InventoryReportController.php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IngredientStock;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\SaleItem;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryReportController extends Controller
{
    /**
     * Get inventory usage report
     */
    public function usageReport(Request $request)
    {
        $poolCode = $this->resolvePoolFromRequest($request);
        $startDate = Carbon::parse($request->get('start_date', now()->startOfMonth()->toDateString()))->startOfDay();
        $endDate = Carbon::parse($request->get('end_date', now()->endOfMonth()->toDateString()))->endOfDay();

        $salesQuery = SaleItem::with(['item.ingredients.stocks.pool', 'item'])
            ->whereHas('sale', function ($q) use ($startDate, $endDate) {
                $q->whereBetween('created_at', [$startDate, $endDate])->where('status', 'completed');
            });

        if ($poolCode !== 'combined') {
            $salesQuery->whereHas('item', function ($q) use ($poolCode) {
                $q->where('inventory_pool_code', $poolCode);
            });
        }

        $sales = $salesQuery->get();
        $usage = [];
        $totalRevenue = 0;
        $totalCost = 0;

        foreach ($sales as $sale) {
            $totalRevenue += (float) $sale->total_price;
            if (!$sale->item) {
                continue;
            }

            foreach ($sale->item->ingredients as $ingredient) {
                $usedQuantity = (float) $ingredient->pivot->quantity_required * (float) $sale->quantity;
                $costPerUnit = $this->costForIngredient($ingredient, $poolCode, optional($sale->item)->inventory_pool_code);
                $cost = $usedQuantity * $costPerUnit;
                $totalCost += $cost;

                if (!isset($usage[$ingredient->id])) {
                    [$currentStock, $minStock] = $this->stockMetricsForIngredient(
                        $ingredient->id,
                        $poolCode,
                        optional($sale->item)->inventory_pool_code
                    );

                    $usage[$ingredient->id] = [
                        'name' => $ingredient->name,
                        'unit' => $ingredient->unit,
                        'total_used' => 0,
                        'total_cost' => 0,
                        'current_stock' => $currentStock,
                        'min_stock' => $minStock,
                    ];
                }

                $usage[$ingredient->id]['total_used'] += $usedQuantity;
                $usage[$ingredient->id]['total_cost'] += $cost;
            }
        }

        $topItemsQuery = SaleItem::select(
            'item_id',
            DB::raw('SUM(quantity) as total_quantity'),
            DB::raw('SUM(total_price) as total_revenue')
        )
            ->whereHas('sale', function ($q) use ($startDate, $endDate) {
                $q->whereBetween('created_at', [$startDate, $endDate])->where('status', 'completed');
            })
            ->with('item')
            ->groupBy('item_id')
            ->orderBy('total_quantity', 'desc')
            ->limit(10);

        if ($poolCode !== 'combined') {
            $topItemsQuery->whereHas('item', function ($q) use ($poolCode) {
                $q->where('inventory_pool_code', $poolCode);
            });
        }

        $topItems = $topItemsQuery->get();

        $purchaseQuery = PurchaseOrder::whereBetween('order_date', [$startDate, $endDate])
            ->where('status', 'received')
            ->with('items.ingredient');

        if ($poolCode !== 'combined') {
            $purchaseQuery->where('inventory_pool_code', $poolCode);
        }

        $purchases = $purchaseQuery->get();
        $purchaseTotal = (float) $purchases->sum('total');

        return response()->json([
            'success' => true,
            'pool' => $poolCode,
            'report' => [
                'period' => [
                    'start' => $startDate->format('Y-m-d'),
                    'end' => $endDate->format('Y-m-d'),
                ],
                'summary' => [
                    'total_revenue' => $totalRevenue,
                    'total_cost' => $totalCost,
                    'gross_profit' => $totalRevenue - $totalCost,
                    'profit_margin' => $totalRevenue > 0 ? (($totalRevenue - $totalCost) / $totalRevenue) * 100 : 0,
                    'total_purchases' => $purchaseTotal,
                    'total_sales_count' => $sales->count(),
                ],
                'ingredient_usage' => array_values($usage),
                'top_items' => $topItems,
                'purchases' => $purchases,
            ],
        ]);
    }

    /**
     * Get waste report (ingredients that expired or were written off)
     */
    public function wasteReport(Request $request)
    {
        $poolCode = $this->resolvePoolFromRequest($request);
        $criticalStock = $this->criticalStocks($poolCode);

        return response()->json([
            'success' => true,
            'pool' => $poolCode,
            'critical_stock' => $criticalStock,
        ]);
    }

    /**
     * Get inventory valuation
     */
    public function valuation(Request $request)
    {
        $poolCode = $this->resolvePoolFromRequest($request);
        $stocks = $this->stocksForPool($poolCode);

        $items = [];
        $totalValue = 0;

        foreach ($stocks as $stock) {
            $value = (float) $stock->quantity * (float) ($stock->cost_per_unit ?? 0);
            $totalValue += $value;

            $items[] = [
                'id' => $stock->ingredient_id,
                'name' => optional($stock->ingredient)->name,
                'quantity' => (float) $stock->quantity,
                'unit' => optional($stock->ingredient)->unit,
                'cost_per_unit' => (float) ($stock->cost_per_unit ?? 0),
                'total_value' => $value,
                'percentage' => 0,
            ];
        }

        foreach ($items as &$item) {
            $item['percentage'] = $totalValue > 0 ? ($item['total_value'] / $totalValue) * 100 : 0;
        }

        return response()->json([
            'success' => true,
            'pool' => $poolCode,
            'valuation' => [
                'total_value' => $totalValue,
                'total_items' => count($items),
                'items' => $items,
                'as_of' => now()->format('Y-m-d H:i:s'),
            ],
        ]);
    }

    /**
     * Get forecasting report (projected usage based on sales)
     */
    public function forecasting(Request $request)
    {
        $poolCode = $this->resolvePoolFromRequest($request);
        $daysToForecast = (int) $request->get('days', 7);
        $startDate = Carbon::now()->subDays(30)->startOfDay();
        $endDate = Carbon::now()->endOfDay();

        $salesQuery = SaleItem::with(['item.ingredients.stocks.pool', 'item'])
            ->whereHas('sale', function ($q) use ($startDate, $endDate) {
                $q->whereBetween('created_at', [$startDate, $endDate])->where('status', 'completed');
            });

        if ($poolCode !== 'combined') {
            $salesQuery->whereHas('item', function ($q) use ($poolCode) {
                $q->where('inventory_pool_code', $poolCode);
            });
        }

        $sales = $salesQuery->get();
        $dailyUsage = [];
        $totalDays = 30;

        foreach ($sales as $sale) {
            if (!$sale->item) {
                continue;
            }

            foreach ($sale->item->ingredients as $ingredient) {
                $usedQuantity = (float) $ingredient->pivot->quantity_required * (float) $sale->quantity;

                if (!isset($dailyUsage[$ingredient->id])) {
                    [$currentStock, $minStock] = $this->stockMetricsForIngredient(
                        $ingredient->id,
                        $poolCode,
                        optional($sale->item)->inventory_pool_code
                    );

                    $dailyUsage[$ingredient->id] = [
                        'name' => $ingredient->name,
                        'unit' => $ingredient->unit,
                        'total_used' => 0,
                        'current_stock' => $currentStock,
                        'min_stock' => $minStock,
                    ];
                }

                $dailyUsage[$ingredient->id]['total_used'] += $usedQuantity;
            }
        }

        $forecast = [];
        foreach ($dailyUsage as $id => $data) {
            $avgDaily = $data['total_used'] / $totalDays;
            $projectedUsage = $avgDaily * $daysToForecast;
            $daysRemaining = $avgDaily > 0 ? ($data['current_stock'] / $avgDaily) : 999999;

            $forecast[] = [
                'id' => $id,
                'name' => $data['name'],
                'unit' => $data['unit'],
                'current_stock' => $data['current_stock'],
                'avg_daily_usage' => round($avgDaily, 2),
                'projected_usage' => round($projectedUsage, 2),
                'days_remaining' => round($daysRemaining, 1),
                'will_run_out' => $daysRemaining < $daysToForecast,
                'recommended_order' => $daysRemaining < $daysToForecast
                    ? round(($projectedUsage - $data['current_stock']) + $data['min_stock'], 2)
                    : 0,
            ];
        }

        usort($forecast, function ($a, $b) {
            return $a['days_remaining'] <=> $b['days_remaining'];
        });

        return response()->json([
            'success' => true,
            'pool' => $poolCode,
            'forecast' => [
                'period_days' => $daysToForecast,
                'items' => $forecast,
                'generated_at' => now()->format('Y-m-d H:i:s'),
            ],
        ]);
    }

    private function availablePoolsForUser(Request $request): array
    {
        $role = strtolower((string) optional($request->user())->role);

        if (in_array($role, ['admin', 'resto_admin'], true)) {
            return ['resto', 'kitchen', 'combined'];
        }

        if ($role === 'kitchen') {
            return ['kitchen'];
        }

        return ['resto'];
    }

    private function resolvePoolFromRequest(Request $request): string
    {
        $requestedPool = strtolower((string) ($request->input('pool') ?? $request->query('pool') ?? ''));
        $allowedPools = $this->availablePoolsForUser($request);
        $defaultPool = $allowedPools[0] ?? 'resto';
        $poolCode = $requestedPool !== '' ? $requestedPool : $defaultPool;

        if (!in_array($poolCode, $allowedPools, true)) {
            abort(403, "Pool '{$poolCode}' is not allowed for this account.");
        }

        return $poolCode;
    }

    private function stocksForPool(string $poolCode)
    {
        $query = IngredientStock::with(['ingredient', 'pool']);

        if ($poolCode !== 'combined') {
            $query->whereHas('pool', function ($q) use ($poolCode) {
                $q->where('code', $poolCode);
            });
        }

        return $query->get();
    }

    private function criticalStocks(string $poolCode)
    {
        if ($poolCode === 'combined') {
            return IngredientStock::select(
                'ingredient_id',
                DB::raw('SUM(quantity) as quantity'),
                DB::raw('SUM(min_stock) as min_stock')
            )
                ->with('ingredient')
                ->groupBy('ingredient_id')
                ->havingRaw('SUM(quantity) <= (SUM(min_stock) * 0.5)')
                ->orderByRaw('(SUM(quantity) / NULLIF(SUM(min_stock), 0)) asc')
                ->get();
        }

        return IngredientStock::with(['ingredient', 'pool'])
            ->whereHas('pool', function ($q) use ($poolCode) {
                $q->where('code', $poolCode);
            })
            ->whereRaw('quantity <= min_stock * 0.5')
            ->orderByRaw('(quantity / NULLIF(min_stock, 0.001)) asc')
            ->get();
    }

    private function stockMetricsForIngredient(int $ingredientId, string $poolCode, ?string $itemPoolCode = null): array
    {
        if ($poolCode === 'combined') {
            $stocks = IngredientStock::where('ingredient_id', $ingredientId)->get();
            return [(float) $stocks->sum('quantity'), (float) $stocks->sum('min_stock')];
        }

        $effectivePool = $poolCode === 'combined' ? ($itemPoolCode ?? 'resto') : $poolCode;
        $stock = IngredientStock::where('ingredient_id', $ingredientId)
            ->whereHas('pool', function ($q) use ($effectivePool) {
                $q->where('code', $effectivePool);
            })
            ->first();

        return [(float) optional($stock)->quantity, (float) optional($stock)->min_stock];
    }

    private function costForIngredient($ingredient, string $poolCode, ?string $itemPoolCode = null): float
    {
        if ($poolCode === 'combined') {
            $stockCosts = $ingredient->stocks->pluck('cost_per_unit')->filter(fn ($v) => $v !== null)->values();
            return (float) ($stockCosts->avg() ?? $ingredient->cost_per_unit ?? 0);
        }

        $effectivePool = $poolCode === 'combined' ? ($itemPoolCode ?? 'resto') : $poolCode;
        $stock = $ingredient->stocks->first(fn ($s) => optional($s->pool)->code === $effectivePool);
        return (float) (optional($stock)->cost_per_unit ?? $ingredient->cost_per_unit ?? 0);
    }
}

