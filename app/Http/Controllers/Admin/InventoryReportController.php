<?php
// app/Http/Controllers/Admin/InventoryReportController.php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IngredientStock;
use App\Models\InventoryPool;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\SaleItem;
use App\Models\StockCountBatch;
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

        if (in_array($role, ['admin', 'manager'], true)) {
            return [InventoryPool::RESTO, InventoryPool::KITCHEN];
        }

        if ($role === 'kitchen') {
            return [InventoryPool::KITCHEN];
        }

        if ($role === 'kitchen_resto') {
            return [InventoryPool::RESTO];
        }

        return [InventoryPool::RESTO];
    }

    private function resolvePoolFromRequest(Request $request): string
    {
        $allowedPools = $this->availablePoolsForUser($request);
        $requested = strtolower(trim((string) (
            $request->get('pool')
            ?? $request->get('inventory_pool_code')
            ?? ''
        )));

        if ($requested === 'combined') {
            $requested = '';
        }

        if ($requested !== '' && in_array($requested, $allowedPools, true)) {
            return $requested;
        }

        return $allowedPools[0] ?? InventoryPool::RESTO;
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

        $stock = IngredientStock::where('ingredient_id', $ingredientId)
            ->whereHas('pool', function ($q) use ($poolCode) {
                $q->where('code', $poolCode);
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

        $stock = $ingredient->stocks->first(fn ($s) => optional($s->pool)->code === $poolCode);
        return (float) (optional($stock)->cost_per_unit ?? $ingredient->cost_per_unit ?? 0);
    }

    /**
     * Export ingredient usage report as CSV
     * Columns: Ingredient, Unit, Starting Stock, Used, Remaining
     * Period: daily | today | week | month (or custom start_date/end_date)
     */
    public function exportUsageCsv(Request $request)
    {
        $poolCode = $this->resolvePoolFromRequest($request);
        $period  = $request->get('period', 'daily'); // daily | today | week | month
        $now     = Carbon::now('Asia/Manila');

        switch ($period) {
            case 'daily':
            case 'today':
                $startDate = $now->copy()->startOfDay();
                $endDate   = $now->copy()->endOfDay();
                $label     = $now->format('Y-m-d');
                break;
            case 'week':
                $startDate = $now->copy()->startOfWeek()->startOfDay();
                $endDate   = $now->copy()->endOfDay();
                $label     = 'Week_' . $now->format('W_Y');
                break;
            case 'month':
                $startDate = $now->copy()->startOfMonth()->startOfDay();
                $endDate   = $now->copy()->endOfDay();
                $label     = $now->format('F_Y');
                break;
            default: // fallback daily
                $startDate = $now->copy()->startOfDay();
                $endDate   = $now->copy()->endOfDay();
                $label     = $now->format('Y-m-d');
                break;
        }

        // Custom date override
        if ($request->has('start_date')) {
            $startDate = Carbon::parse($request->get('start_date'), 'Asia/Manila')->startOfDay();
        }
        if ($request->has('end_date')) {
            $endDate = Carbon::parse($request->get('end_date'), 'Asia/Manila')->endOfDay();
        }

        // Get all completed sales items in the period with ingredient data
        // Use whereDate for SQLite compatibility instead of whereBetween with Carbon
        $saleItems = SaleItem::with(['item.ingredients', 'sale'])
            ->whereHas('sale', function ($q) use ($startDate, $endDate) {
                $q->whereDate('created_at', '>=', $startDate->toDateString())
                  ->whereDate('created_at', '<=', $endDate->toDateString())
                  ->where('status', 'completed');
            });

        if ($poolCode !== 'combined') {
            $saleItems->whereHas('item', function ($q) use ($poolCode) {
                $q->where('inventory_pool_code', $poolCode);
            });
        }

        $saleItems = $saleItems
            ->get();

        // Load ALL ingredients fresh with their stocks — quantity lives in ingredient_stocks
        $allIngredients = \App\Models\Ingredient::with('stocks')->orderBy('name')->get()->keyBy('id');

        // Helper: get real current quantity from stocks (same logic as InventoryController)
        $getQty = fn($ing) => $poolCode === 'combined'
            ? (float) $ing->stocks->sum('quantity')
            : (float) optional($ing->stocks->first(fn($s) => optional($s->pool)->code === $poolCode))->quantity;
        $getMin = fn($ing) => $poolCode === 'combined'
            ? (float) $ing->stocks->sum('min_stock')
            : (float) optional($ing->stocks->first(fn($s) => optional($s->pool)->code === $poolCode))->min_stock;

        // Unit conversion helper — converts recipe pivot unit to ingredient stock unit
        $convertToStockUnit = function (float $qty, ?string $pivotUnit, string $stockUnit): float {
            $from = strtolower(trim($pivotUnit ?? $stockUnit));
            $to   = strtolower(trim($stockUnit));
            if ($from === $to) return $qty;
            // Weight
            if ($from === 'g'  && $to === 'kg')  return $qty / 1000;
            if ($from === 'kg' && $to === 'g')   return $qty * 1000;
            if ($from === 'mg' && $to === 'g')   return $qty / 1000;
            if ($from === 'mg' && $to === 'kg')  return $qty / 1000000;
            // Volume
            if ($from === 'ml' && $to === 'l')   return $qty / 1000;
            if ($from === 'l'  && $to === 'ml')  return $qty * 1000;
            if ($from === 'cl' && $to === 'l')   return $qty / 100;
            // Fallback — no known conversion, return as-is
            return $qty;
        };

        // Tally usage per ingredient
        $usage = [];
        foreach ($saleItems as $saleItem) {
            if (!$saleItem->item) continue;
            foreach ($saleItem->item->ingredients as $ingredient) {
                $pivotUnit  = $ingredient->pivot->unit ?? $ingredient->unit;
                $stockUnit  = $ingredient->unit;
                $rawQty     = (float) $ingredient->pivot->quantity_required * (float) $saleItem->quantity;
                $qty        = $convertToStockUnit($rawQty, $pivotUnit, $stockUnit);
                if (!isset($usage[$ingredient->id])) {
                    // Use fresh stocks sum for remaining — not ingredients.quantity which may be stale
                    $fresh = $allIngredients->get($ingredient->id);
                    $usage[$ingredient->id] = [
                        'name'      => $ingredient->name,
                        'unit'      => $ingredient->unit,
                        'used'      => 0,
                        'remaining' => $fresh ? $getQty($fresh) : 0,
                    ];
                }
                $usage[$ingredient->id]['used'] += $qty;
            }
        }

        // Calculate starting stock = remaining + used
        foreach ($usage as &$row) {
            $row['starting_stock'] = $row['remaining'] + $row['used'];
        }
        unset($row);

        // Also include ingredients with zero usage so the report is complete
        foreach ($allIngredients as $ing) {
            if (!isset($usage[$ing->id])) {
                $qty = $getQty($ing);
                $usage[$ing->id] = [
                    'name'          => $ing->name,
                    'unit'          => $ing->unit,
                    'used'          => 0,
                    'remaining'     => $qty,
                    'starting_stock'=> $qty,
                ];
            }
        }

        // Sort alphabetically
        usort($usage, fn($a, $b) => strcmp($a['name'], $b['name']));

        // Build CSV
        $filename = "Ingredients_Usage_{$label}.csv";
        $headers  = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control'       => 'no-cache',
        ];

        $callback = function () use ($usage, $startDate, $endDate) {
            $handle = fopen('php://output', 'w');

            // UTF-8 BOM so Excel opens it correctly without encoding issues
            fwrite($handle, "\xEF\xBB\xBF");

            // Period header
            fputcsv($handle, ['CJ Brew & Dine - Ingredients Usage Report']);
            fputcsv($handle, ['Period:', $startDate->format('M d, Y') . ' - ' . $endDate->format('M d, Y')]);
            fputcsv($handle, ['Generated:', now('Asia/Manila')->format('M d, Y h:i A')]);
            fputcsv($handle, []); // blank row

            // Column headers
            fputcsv($handle, ['Ingredient', 'Unit', 'Starting Stock', 'Used', 'Remaining']);

            foreach ($usage as $row) {
                fputcsv($handle, [
                    $row['name'],
                    $row['unit'],
                    number_format($row['starting_stock'], 3, '.', ''),
                    number_format($row['used'], 3, '.', ''),
                    number_format($row['remaining'], 3, '.', ''),
                ]);
            }

            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Export pre-count stock template CSV.
     * Columns: Product Name | Current Stock | Actual Counted Stock
     */
    public function exportStockCountTemplateCsv(Request $request)
    {
        $poolCode = $this->resolvePoolFromRequest($request);
        $stocks = $this->stocksForPool($poolCode)
            ->sortBy(fn($s) => strtolower((string) optional($s->ingredient)->name))
            ->values();

        $filename = "Stock_Count_Template_{$poolCode}_" . now('Asia/Manila')->format('Ymd_His') . ".csv";
        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control'       => 'no-cache',
        ];

        $callback = function () use ($stocks, $poolCode) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['CJ Brew & Dine - Stock Count Template']);
            fputcsv($handle, ['Pool:', strtoupper($poolCode)]);
            fputcsv($handle, ['Generated:', now('Asia/Manila')->format('M d, Y h:i A')]);
            fputcsv($handle, []);
            fputcsv($handle, ['Product Name', 'Current Stock #', 'Actual Counted Stock']);

            foreach ($stocks as $stock) {
                fputcsv($handle, [
                    optional($stock->ingredient)->name,
                    number_format((float) $stock->quantity, 3, '.', ''),
                    '',
                ]);
            }

            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Export finalized stock-count CSV by saved batch.
     * Columns: OR Number | Date | Product Name | Current Stock # | Actual Counted Stock | Variance
     */
    public function exportFinalizedStockCountCsv(Request $request, int $batchId)
    {
        $batch = StockCountBatch::with(['items.ingredient'])->findOrFail($batchId);
        $allowedPools = $this->availablePoolsForUser($request);
        if (!in_array($batch->inventory_pool_code, $allowedPools, true)) {
            abort(403, 'Not allowed to export this stock count batch.');
        }

        $filename = "Stock_Count_Final_{$batch->inventory_pool_code}_{$batch->id}.csv";
        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control'       => 'no-cache',
        ];

        $callback = function () use ($batch) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['CJ Brew & Dine - Finalized Stock Count']);
            fputcsv($handle, ['Batch ID:', $batch->id]);
            fputcsv($handle, ['Pool:', strtoupper((string) $batch->inventory_pool_code)]);
            fputcsv($handle, ['OR Number:', $batch->or_number]);
            fputcsv($handle, ['Count Date:', optional($batch->count_date)->format('Y-m-d')]);
            fputcsv($handle, ['Generated:', now('Asia/Manila')->format('M d, Y h:i A')]);
            fputcsv($handle, []);
            fputcsv($handle, ['OR Number', 'Date', 'Product Name', 'Current Stock #', 'Actual Counted Stock', 'Variance']);

            foreach ($batch->items->sortBy(fn($i) => strtolower((string) optional($i->ingredient)->name))->values() as $item) {
                fputcsv($handle, [
                    $batch->or_number,
                    optional($batch->count_date)->format('Y-m-d'),
                    optional($item->ingredient)->name,
                    number_format((float) $item->current_stock, 3, '.', ''),
                    number_format((float) $item->actual_counted_stock, 3, '.', ''),
                    number_format((float) $item->variance, 3, '.', ''),
                ]);
            }

            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }

}
