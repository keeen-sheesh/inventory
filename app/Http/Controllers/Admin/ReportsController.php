<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Item;
use App\Models\KitchenItem;
use App\Models\Ingredient;
use App\Models\IngredientStock;
use App\Models\InventoryItem;
use App\Models\Category;
use App\Models\InventoryPool;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Carbon\Carbon;

class ReportsController extends Controller
{
    /**
     * Parse date range from request (Dashboard-style filter)
     */
    private function parseDateRange(Request $request)
    {
        $range = $request->get('range', 'today');
        $from = $request->get('from');
        $to = $request->get('to');
        
        $now = Carbon::now();
        
        switch ($range) {
            case 'today':
                $startDate = $now->copy()->startOfDay();
                $endDate = $now->copy()->endOfDay();
                break;
            case 'yesterday':
                $startDate = $now->copy()->subDay()->startOfDay();
                $endDate = $now->copy()->subDay()->endOfDay();
                break;
            case 'this_week':
                $startDate = $now->copy()->startOfWeek();
                $endDate = $now->copy()->endOfWeek();
                break;
            case 'last_week':
                $startDate = $now->copy()->subWeek()->startOfWeek();
                $endDate = $now->copy()->subWeek()->endOfWeek();
                break;
            case 'this_month':
                $startDate = $now->copy()->startOfMonth();
                $endDate = $now->copy()->endOfMonth();
                break;
            case 'last_month':
                $startDate = $now->copy()->subMonth()->startOfMonth();
                $endDate = $now->copy()->subMonth()->endOfMonth();
                break;
            case 'custom':
                if ($from && $to) {
                    $startDate = Carbon::parse($from)->startOfDay();
                    $endDate = Carbon::parse($to)->endOfDay();
                } else {
                    $startDate = $now->copy()->startOfDay();
                    $endDate = $now->copy()->endOfDay();
                }
                break;
            default:
                $startDate = $now->copy()->startOfDay();
                $endDate = $now->copy()->endOfDay();
        }
        
        return [
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'start_datetime' => $startDate->toDateTimeString(),
            'end_datetime' => $endDate->toDateTimeString(),
            'range' => $range,
            'from' => $from,
            'to' => $to,
        ];
    }

    /**
     * Display comprehensive reports dashboard with COGS and profit analytics
     */
    public function index(Request $request)
    {
        // Parse date range using Dashboard-style filter
        $dateFilter = $this->parseDateRange($request);
        
        $startDateTime = $dateFilter['start_datetime'];
        $endDateTime = $dateFilter['end_datetime'];
        $startDate = $dateFilter['start_date'];
        $endDate = $dateFilter['end_date'];

        // ========== KEY METRICS ==========
        $metrics = $this->calculateKeyMetrics($startDateTime, $endDateTime);

        // ========== REVENUE VS COGS CHART DATA ==========
        $revenueVsCogsData = $this->getRevenueVsCogsData($startDateTime, $endDateTime);

        // ========== PROFIT MARGIN TREND ==========
        $profitMarginTrend = $this->getProfitMarginTrend($startDateTime, $endDateTime);

        // ========== TOP PERFORMING ITEMS (BY PROFIT) ==========
        $topItems = $this->getTopPerformingItems($startDateTime, $endDateTime, 10);

        // ========== INVENTORY VALUATION ==========
        $inventoryValuation = $this->calculateInventoryValuation();

        // ========== RECENT TRANSACTIONS ==========
        $recentTransactions = $this->getRecentTransactions($startDateTime, $endDateTime);

        // ========== SALES RECORDS ==========
        $salesRecords = $this->getSalesRecords($startDateTime, $endDateTime);

        // ========== PAYMENT METHODS BREAKDOWN ==========
        $paymentMethods = $this->getPaymentMethodsBreakdown($startDateTime, $endDateTime);

        // ========== ORDER TYPES BREAKDOWN ==========
        $orderTypes = $this->getOrderTypesBreakdown($startDateTime, $endDateTime);

        // ========== STOCK ALERTS ==========
        $stockAlerts = $this->getStockAlerts();

        // ========== EXPENSES DATA ==========
        $expensesData = $this->getExpensesData($startDateTime, $endDateTime);

        // ========== TOP SELLING ITEMS ==========
        $topSellingItems = $this->getTopSellingItems($startDateTime, $endDateTime);

        // ========== STATS FOR FRONTEND SUMMARY CARDS ==========
        $stats = [
            'totalRevenue' => $metrics['total_revenue'] ?? 0,
            'totalOrders' => $metrics['total_orders'] ?? 0,
            'totalItemsSold' => $this->getTotalItemsSold($startDateTime, $endDateTime),
            'averageOrderValue' => $metrics['average_order_value'] ?? 0,
        ];

        // ========== STOREHUB-STYLE DASHBOARD METRICS ==========
        $dashboardMetrics = $this->getStorehubDashboardMetrics($startDateTime, $endDateTime);

        // ========== SALES DATA FOR DAILY OVERVIEW ==========
        $salesData = $this->getDailySalesData($startDateTime, $endDateTime);

        return Inertia::render('Admin/Reports', [
            'auth' => ['user' => auth()->user()],
            'stats' => $stats,
            'salesData' => $salesData,
            'topItems' => $topSellingItems,
            'paymentMethods' => $paymentMethods,
            'orderTypes' => $orderTypes,
            'metrics' => $metrics,
            'revenueVsCogsData' => $revenueVsCogsData,
            'profitMarginTrend' => $profitMarginTrend,
            'topPerformingItems' => $topItems,
            'inventoryValuation' => $inventoryValuation,
            'recentTransactions' => $recentTransactions,
            'salesRecords' => $salesRecords,
            'stockAlerts' => $stockAlerts,
            'expensesData' => $expensesData,
            'dashboardMetrics' => $dashboardMetrics,
            'filters' => [
                'range' => $dateFilter['range'],
                'from' => $dateFilter['from'] ?? $startDate,
                'to' => $dateFilter['to'] ?? $endDate,
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
        ]);
    }

    /**
     * Get total items sold in date range
     */
    private function getTotalItemsSold($startDateTime, $endDateTime)
    {
        try {
            return DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->whereBetween('sales.created_at', [$startDateTime, $endDateTime])
                ->where('sales.status', 'completed')
                ->sum('sale_items.quantity') ?? 0;
        } catch (\Exception $e) {
            return 0;
        }
    }

    /**
     * Get daily sales data for chart/table
     */
    private function getDailySalesData($startDateTime, $endDateTime)
    {
        try {
            return Sale::where('status', 'completed')
                ->whereBetween('created_at', [$startDateTime, $endDateTime])
                ->select(
                    DB::raw('DATE(created_at) as date'),
                    DB::raw('COUNT(*) as orders'),
                    DB::raw('SUM(total_amount) as revenue')
                )
                ->groupBy(DB::raw('DATE(created_at)'))
                ->orderBy('date', 'ASC')
                ->get()
                ->map(function ($item) {
                    // Get items sold for this date
                    $itemsSold = DB::table('sale_items')
                        ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                        ->whereDate('sales.created_at', $item->date)
                        ->where('sales.status', 'completed')
                        ->sum('sale_items.quantity') ?? 0;
                    
                    return [
                        'date' => Carbon::parse($item->date)->format('M d, Y'),
                        'orders' => (int) $item->orders,
                        'items_sold' => (int) $itemsSold,
                        'revenue' => (float) $item->revenue,
                    ];
                });
        } catch (\Exception $e) {
            \Log::error('Daily Sales Data Error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Calculate key financial metrics
     */
    private function calculateKeyMetrics($startDate, $endDate)
    {
        $completedOrders = Sale::where('status', 'completed')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->get();

        $totalRevenue = $completedOrders->sum('total_amount') ?? 0;
        $totalCOGS = $completedOrders->sum(function($order) {
            return (float) ($order->total_cost ?? 0);
        });
        $grossProfit = $totalRevenue - $totalCOGS;
        $profitMargin = $totalRevenue > 0 ? ($grossProfit / $totalRevenue) * 100 : 0;

        $totalOrders = $completedOrders->count();
        $averageOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;
        $averageCOGS = $totalOrders > 0 ? $totalCOGS / $totalOrders : 0;
        $averageProfit = $totalOrders > 0 ? $grossProfit / $totalOrders : 0;

        // Calculate cost percentage
        $costPercentage = $totalRevenue > 0 ? ($totalCOGS / $totalRevenue) * 100 : 0;

        return [
            'total_revenue' => round($totalRevenue, 2),
            'total_cogs' => round($totalCOGS, 2),
            'gross_profit' => round($grossProfit, 2),
            'profit_margin' => round($profitMargin, 2),
            'cost_percentage' => round($costPercentage, 2),
            'total_orders' => $totalOrders,
            'average_order_value' => round($averageOrderValue, 2),
            'average_cogs' => round($averageCOGS, 2),
            'average_profit' => round($averageProfit, 2),
        ];
    }

    /**
     * Get revenue vs COGS data for bar chart (grouped by date)
     */
    private function getRevenueVsCogsData($startDate, $endDate)
    {
        return Sale::where('status', 'completed')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('SUM(total_amount) as revenue'),
                DB::raw('SUM(COALESCE(total_cost, 0)) as cogs'),
                DB::raw('SUM(total_amount - COALESCE(total_cost, 0)) as profit')
            )
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date', 'ASC')
            ->get()
            ->map(function($item) {
                return [
                    'date' => $item->date,
                    'revenue' => (float) $item->revenue,
                    'cogs' => (float) $item->cogs,
                    'profit' => (float) $item->profit,
                ];
            });
    }

    /**
     * Get profit margin trend for line chart
     */
    private function getProfitMarginTrend($startDate, $endDate)
    {
        return Sale::where('status', 'completed')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('SUM(total_amount) as revenue'),
                DB::raw('SUM(COALESCE(total_cost, 0)) as cogs')
            )
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date', 'ASC')
            ->get()
            ->map(function($item) {
                $profit = $item->revenue - $item->cogs;
                $margin = $item->revenue > 0 ? ($profit / $item->revenue) * 100 : 0;

                return [
                    'date' => $item->date,
                    'margin' => round($margin, 2),
                ];
            });
    }

    /**
     * Get top performing items by profit
     */
    private function getTopPerformingItems($startDate, $endDate, $limit = 10)
    {
        // Check if recipes table exists
        if (!\Schema::hasTable('recipes')) {
            return collect([]);
        }

        $orderIds = Sale::where('status', 'completed')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->pluck('id');

        if ($orderIds->isEmpty()) {
            return collect([]);
        }

        $items = DB::table('sale_items')
            ->whereIn('sale_id', $orderIds)
            ->join('items', 'sale_items.item_id', '=', 'items.id')
            ->leftJoin('recipes', 'items.id', '=', 'recipes.item_id')
            ->leftJoin('inventory_items', 'recipes.inventory_item_id', '=', 'inventory_items.id')
            ->select(
                'items.id as item_id',
                'items.name as item_name',
                'sale_items.quantity as sold_quantity',
                'sale_items.unit_price as unit_price',
                'inventory_items.cost_per_unit',
                'recipes.qty as recipe_qty',
                DB::raw('sale_items.quantity * sale_items.unit_price as item_revenue'),
                DB::raw('COALESCE(recipes.qty, 0) * COALESCE(inventory_items.cost_per_unit, 0) * sale_items.quantity as item_cost')
            )
            ->get();

        $aggregated = $items->groupBy('item_id')->map(function($group) {
            $totalRevenue = $group->sum('item_revenue');
            $totalCost = $group->sum('item_cost');
            $totalProfit = $totalRevenue - $totalCost;
            $profitMargin = $totalRevenue > 0 ? ($totalProfit / $totalRevenue) * 100 : 0;

            return [
                'item_id' => $group->first()->item_id,
                'item_name' => $group->first()->item_name,
                'units_sold' => $group->sum('sold_quantity'),
                'total_revenue' => round($totalRevenue, 2),
                'total_cost' => round($totalCost, 2),
                'gross_profit' => round($totalProfit, 2),
                'profit_margin' => round($profitMargin, 2),
            ];
        })->sortByDesc('gross_profit')
         ->take($limit)
         ->values();

        return $aggregated;
    }

    /**
     * Calculate inventory valuation report
     */
    private function calculateInventoryValuation($categoryId = null, $poolId = null)
    {
        if (!Schema::hasTable('ingredient_stocks')) {
            return [
                'items' => [],
                'summary' => [
                    'total_valuation' => 0,
                    'total_items' => 0,
                    'total_skus' => 0,
                ],
            ];
        }

        $query = DB::table('ingredient_stocks')
            ->join('ingredients', 'ingredient_stocks.ingredient_id', '=', 'ingredients.id')
            ->leftJoin('categories', 'ingredients.category_id', '=', 'categories.id')
            ->leftJoin('inventory_pools', 'ingredient_stocks.inventory_pool_id', '=', 'inventory_pools.id')
            ->select(
                'ingredient_stocks.id',
                'ingredients.name',
                'ingredient_stocks.quantity',
                'ingredients.unit',
                'ingredient_stocks.cost_per_unit',
                'categories.name as category_name',
                'inventory_pools.name as pool_name',
                DB::raw('ingredient_stocks.quantity * ingredient_stocks.cost_per_unit as total_value')
            )
            ->where('ingredient_stocks.quantity', '>', 0);

        if ($categoryId) {
            $query->where('ingredients.category_id', $categoryId);
        }

        if ($poolId) {
            $query->where('ingredient_stocks.inventory_pool_id', $poolId);
        }

        $items = $query->orderByRaw('ingredient_stocks.quantity * ingredient_stocks.cost_per_unit DESC')
            ->get();

        $totalValuation = $items->sum('total_value');
        $totalItems = $items->sum('quantity');

        return [
            'items' => $items,
            'summary' => [
                'total_valuation' => round($totalValuation, 2),
                'total_items' => $totalItems,
                'total_skus' => $items->count(),
            ],
        ];
    }

    /**
     * Display inventory valuation report page
     */
    public function inventoryValuation(Request $request)
    {
        $categoryId = $request->get('category_id');
        $poolId = $request->get('pool_id');

        $inventoryValuation = $this->calculateInventoryValuation($categoryId, $poolId);

        $categories = Category::orderBy('name')->get(['id', 'name']);
        $pools = InventoryPool::orderBy('name')->get(['id', 'name', 'code']);

        $valuationByCategory = DB::table('ingredient_stocks')
            ->join('ingredients', 'ingredient_stocks.ingredient_id', '=', 'ingredients.id')
            ->leftJoin('categories', 'ingredients.category_id', '=', 'categories.id')
            ->select(
                DB::raw('COALESCE(categories.name, \'Uncategorized\') as category'),
                DB::raw('SUM(ingredient_stocks.quantity * ingredient_stocks.cost_per_unit) as total_value'),
                DB::raw('COUNT(DISTINCT ingredients.id) as item_count')
            )
            ->where('ingredient_stocks.quantity', '>', 0)
            ->groupBy('categories.name')
            ->orderBy('total_value', 'DESC')
            ->get();

        $valuationByPool = DB::table('ingredient_stocks')
            ->join('inventory_pools', 'ingredient_stocks.inventory_pool_id', '=', 'inventory_pools.id')
            ->select(
                'inventory_pools.name as pool',
                'inventory_pools.code as pool_code',
                DB::raw('SUM(ingredient_stocks.quantity * ingredient_stocks.cost_per_unit) as total_value'),
                DB::raw('SUM(ingredient_stocks.quantity) as total_units')
            )
            ->where('ingredient_stocks.quantity', '>', 0)
            ->groupBy('inventory_pools.id', 'inventory_pools.name', 'inventory_pools.code')
            ->get();

        $topItems = DB::table('ingredient_stocks')
            ->join('ingredients', 'ingredient_stocks.ingredient_id', '=', 'ingredients.id')
            ->select(
                'ingredients.name',
                DB::raw('ingredient_stocks.quantity * ingredient_stocks.cost_per_unit as total_value'),
                'ingredient_stocks.quantity',
                'ingredients.unit'
            )
            ->where('ingredient_stocks.quantity', '>', 0)
            ->orderByRaw('ingredient_stocks.quantity * ingredient_stocks.cost_per_unit DESC')
            ->limit(10)
            ->get();

        return Inertia::render('Admin/Reports/InventoryValuation', [
            'items' => $inventoryValuation['items'],
            'summary' => $inventoryValuation['summary'],
            'filters' => [
                'category_id' => $categoryId,
                'pool_id' => $poolId,
            ],
            'categories' => $categories,
            'pools' => $pools,
            'charts' => [
                'by_category' => $valuationByCategory,
                'by_pool' => $valuationByPool,
                'top_items' => $topItems,
            ],
        ]);
    }

    /**
     * Export COGS report to CSV
     */
    public function exportCogs(Request $request)
    {
        $dateFilter = $this->parseDateRange($request);
        $startDateTime = $dateFilter['start_datetime'];
        $endDateTime = $dateFilter['end_datetime'];
        $startDate = $dateFilter['start_date'];
        $endDate = $dateFilter['end_date'];

        $orders = Sale::where('status', 'completed')
            ->whereBetween('created_at', [$startDateTime, $endDateTime])
            ->with(['saleItems.item', 'customer'])
            ->orderBy('created_at', 'DESC')
            ->get();

        $csvData = "Date,Order #,Invoice #,Customer,Revenue,COGS,Gross Profit,Profit Margin%\n";

        foreach ($orders as $order) {
            $profit = $order->total_amount - ($order->total_cost ?? 0);
            $margin = $order->total_amount > 0 ? ($profit / $order->total_amount) * 100 : 0;

            $csvData .= sprintf(
                "%s,%s,%s,%s,%.2f,%.2f,%.2f,%.2f\n",
                $order->created_at->format('Y-m-d'),
                $order->order_number,
                $order->invoice_number ?? 'N/A',
                $order->customer_name ?? 'Walk-in',
                $order->total_amount,
                $order->total_cost ?? 0,
                $profit,
                $margin
            );
        }

        return response($csvData, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="cogs_report_' . $startDate . '_to_' . $endDate . '.csv"',
        ]);
    }

    /**
     * Export item-level COGS report to CSV
     */
    public function exportItemCogs(Request $request)
    {
        $dateFilter = $this->parseDateRange($request);
        $startDateTime = $dateFilter['start_datetime'];
        $endDateTime = $dateFilter['end_datetime'];
        $startDate = $dateFilter['start_date'];
        $endDate = $dateFilter['end_date'];

        $orderIds = Sale::where('status', 'completed')
            ->whereBetween('created_at', [$startDateTime, $endDateTime])
            ->pluck('id');

        $items = SaleItem::whereIn('sale_id', $orderIds)
            ->with(['item', 'kitchenItem'])
            ->orderBy('created_at')
            ->get();

        $csvData = "Date,Order #,Item Name,Quantity,Unit Price,Unit COGS,Total Revenue,Total COGS,Gross Profit,Profit Margin%\n";

        foreach ($items as $item) {
            $itemName = $item->item?->name ?? $item->kitchenItem?->name ?? 'Unknown';
            $unitCogs = $item->cogs ?? 0;
            $totalRevenue = $item->total_price;
            $totalCogs = $unitCogs * $item->quantity;
            $profit = $totalRevenue - $totalCogs;
            $margin = $totalRevenue > 0 ? ($profit / $totalRevenue) * 100 : 0;

            $csvData .= sprintf(
                "%s,%s,%s,%d,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f\n",
                $item->sale->created_at->format('Y-m-d'),
                $item->sale->order_number,
                $itemName,
                (int) $item->quantity,
                $item->unit_price,
                $unitCogs,
                $totalRevenue,
                $totalCogs,
                $profit,
                $margin
            );
        }

        return response($csvData, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="item_cogs_report_' . $startDate . '_to_' . $endDate . '.csv"',
        ]);
    }

    /**
     * Get transaction count statistics
     */
    public function transactionStats(Request $request)
    {
        $groupBy = $request->get('group_by', 'day');
        $endDate = $request->get('end_date', date('Y-m-d'));
        
        $endDateTime = $endDate . ' 23:59:59';
        
        if ($groupBy === 'month') {
            $startDate = date('Y-m-01', strtotime($endDate));
        } elseif ($groupBy === 'week') {
            $timestamp = strtotime($endDate);
            $dayOfWeek = date('N', $timestamp);
            $mondayTimestamp = strtotime("-" . ($dayOfWeek - 1) . " days", $timestamp);
            $startDate = date('Y-m-d', $mondayTimestamp);
        } else {
            $startDate = $endDate;
        }

        $startDateTime = $startDate . ' 00:00:00';

        try {
            if ($groupBy === 'month') {
                $transactions = Sale::whereBetween('created_at', [$startDateTime, $endDateTime])
                    ->select(
                        DB::raw("date(created_at) as date"),
                        DB::raw('COUNT(*) as transaction_count'),
                        DB::raw('SUM(total_amount) as total_amount')
                    )
                    ->groupBy(DB::raw("date(created_at)"))
                    ->orderBy('date', 'ASC')
                    ->get()
                    ->map(function ($item) {
                        return [
                            'date' => $item->date,
                            'display' => \Carbon\Carbon::parse($item->date)->format('M d, Y'),
                            'day_of_week' => \Carbon\Carbon::parse($item->date)->format('l'),
                            'transaction_count' => (int) $item->transaction_count,
                            'total_amount' => (float) $item->total_amount,
                        ];
                    });
            } elseif ($groupBy === 'week') {
                $weekSummary = Sale::whereBetween('created_at', [$startDateTime, $endDateTime])
                    ->select(
                        DB::raw('COUNT(*) as transaction_count'),
                        DB::raw('SUM(total_amount) as total_amount')
                    )
                    ->first();

                $transactions = collect([
                    [
                        'display' => \Carbon\Carbon::parse($startDate)->format('M d') . ' - ' . \Carbon\Carbon::parse($endDate)->format('M d, Y'),
                        'day_of_week' => 'Weekly Summary',
                        'transaction_count' => (int) $weekSummary->transaction_count,
                        'total_amount' => (float) $weekSummary->total_amount,
                    ]
                ]);
            } else {
                $transactions = Sale::with(['paymentMethod', 'user'])
                    ->whereBetween('created_at', [$startDateTime, $endDateTime])
                    ->orderBy('created_at', 'ASC')
                    ->get()
                    ->map(function ($sale) {
                        $customerName = 'Walk-in Customer';
                        if ($sale->customer_name) {
                            $customerName = $sale->customer_name;
                        } elseif ($sale->customer) {
                            $customerName = $sale->customer->name;
                        }

                        $isHotel = !is_null($sale->room_number) || ($sale->paymentMethod && $sale->paymentMethod->name === 'Hotel');

                        return [
                            'id' => $sale->id,
                            'txn_number' => $sale->txn_number ?? 'TXN-' . $sale->id,
                            'customer_name' => $customerName,
                            'total_amount' => (float) $sale->total_amount,
                            'payment_method' => $sale->paymentMethod ? $sale->paymentMethod->name : 'Cash',
                            'status' => $sale->status,
                            'created_at' => $sale->created_at->toISOString(),
                            'is_hotel' => $isHotel,
                        ];
                    });
            }

            return response()->json([
                'stats' => $transactions,
                'filters' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'group_by' => $groupBy,
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Transaction Stats Error: ' . $e->getMessage());
            return response()->json([
                'stats' => [],
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get recent transactions for selected date range
     */
    private function getRecentTransactions($startDateTime, $endDateTime)
    {
        $recentSalesQuery = Sale::with(['customer', 'paymentMethod', 'user'])
            ->withCount('saleItems')
            ->whereBetween('created_at', [$startDateTime, $endDateTime])
            ->orderBy('created_at', 'desc')
            ->limit(50);

        $recentSales = $recentSalesQuery->get();

        return $recentSales->map(function ($sale) {
            $itemsCount = (int) ($sale->sale_items_count ?? 0);

            $customerName = 'Walk-in Customer';
            if ($sale->customer_name) {
                $customerName = $sale->customer_name;
            } elseif ($sale->customer) {
                $customerName = $sale->customer->name;
            }

            if ($sale->room_number || ($sale->paymentMethod && $sale->paymentMethod->name === 'Hotel')) {
                $customerName = '[HOTEL] ' . $customerName;
            }

            return [
                'id' => $sale->id,
                'txn_number' => $sale->txn_number,
                'order_number' => $sale->order_number,
                'customer_name' => $customerName,
                'room_number' => $sale->room_number,
                'total_amount' => (float) $sale->total_amount,
                'status' => $sale->status,
                'order_type' => $sale->order_type,
                'payment_method' => $sale->paymentMethod ? $sale->paymentMethod->name : 'Unknown',
                'cashier_name' => optional($sale->user)->name,
                'items_count' => $itemsCount,
                'created_at' => $sale->created_at->toISOString(),
                'is_hotel' => !is_null($sale->room_number) || ($sale->paymentMethod && $sale->paymentMethod->name === 'Hotel'),
            ];
        });
    }

    /**
     * Get sales records for the date range
     */
    private function getSalesRecords($startDateTime, $endDateTime)
    {
        try {
            $sales = Sale::with(['customer', 'paymentMethod', 'user', 'saleItems.item'])
                ->whereBetween('created_at', [$startDateTime, $endDateTime])
                ->orderBy('created_at', 'desc')
                ->get();

            return $sales->map(function ($sale) {
                $customerName = 'Walk-in Customer';
                if ($sale->customer_name) {
                    $customerName = $sale->customer_name;
                } elseif ($sale->customer) {
                    $customerName = $sale->customer->name;
                }

                $isHotel = !is_null($sale->room_number) || ($sale->paymentMethod && $sale->paymentMethod->name === 'Hotel');
                $isPersonal = $sale->customer_name && strpos($sale->customer_name, '[PERSONAL]') !== false;

                $itemsList = $sale->saleItems->map(function ($saleItem) {
                    $quantity = $saleItem->quantity ?? ($saleItem->pivot ? $saleItem->pivot->quantity : 1);
                    $itemName = $saleItem->item ? $saleItem->item->name : ($saleItem->name ?? 'Unknown Item');
                    return $quantity . 'x ' . $itemName;
                })->join(', ');

                $itemsCount = $sale->saleItems->sum('quantity');
                
                $items = $sale->saleItems->map(function ($saleItem) {
                    return [
                        'name' => $saleItem->item ? $saleItem->item->name : ($saleItem->name ?? 'Unknown Item'),
                        'quantity' => $saleItem->quantity ?? ($saleItem->pivot ? $saleItem->pivot->quantity : 1),
                        'unit_price' => (float) ($saleItem->pivot ? $saleItem->pivot->unit_price : ($saleItem->unit_price ?? 0)),
                    ];
                })->toArray();

                return [
                    'id' => $sale->id,
                    'or_number' => $sale->or_number,
                    'invoice_number' => $sale->invoice_number ?? $sale->txn_number ?? 'TXN-' . $sale->id,
                    'sale_date' => $sale->created_at->format('Y-m-d'),
                    'sale_time' => $sale->created_at->format('h:i A'),
                    'customer_name' => $customerName,
                    'room_number' => $sale->room_number,
                    'cashier_name' => optional($sale->user)->name ?? 'Unknown',
                    'items_list' => $itemsList,
                    'items' => $items,
                    'items_count' => $itemsCount,
                    'final_amount' => (float) $sale->total_amount,
                    'discount_amount' => (float) ($sale->discount_amount ?? 0),
                    'payment_method' => $sale->paymentMethod ? $sale->paymentMethod->name : 'Cash',
                    'status' => $sale->status,
                    'is_hotel' => $isHotel,
                    'is_personal' => $isPersonal,
                    'created_at' => $sale->created_at->toISOString(),
                ];
            });
        } catch (\Exception $e) {
            \Log::error('Sales Records Error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get payment methods breakdown
     */
    private function getPaymentMethodsBreakdown($startDateTime, $endDateTime)
    {
        try {
            if (!Schema::hasTable('payment_methods')) {
                return [];
            }

            return Sale::whereBetween('sales.created_at', [$startDateTime, $endDateTime])
                ->join('payment_methods', 'sales.payment_method_id', '=', 'payment_methods.id')
                ->select(
                    'payment_methods.name as method',
                    DB::raw('COUNT(*) as order_count'),
                    DB::raw('SUM(sales.total_amount) as total')
                )
                ->groupBy('payment_methods.id', 'payment_methods.name')
                ->get()
                ->map(function ($item) {
                    return [
                        'method' => $item->method,
                        'order_count' => (int) $item->order_count,
                        'total' => (float) $item->total,
                    ];
                });
        } catch (\Exception $e) {
            \Log::error('Payment Methods Error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get order types breakdown
     */
    private function getOrderTypesBreakdown($startDateTime, $endDateTime)
    {
        try {
            $sales = Sale::whereBetween('created_at', [$startDateTime, $endDateTime])->get();

            $orderTypes = [];

            foreach ($sales as $sale) {
                $type = $sale->order_type ?? 'dine_in';
                
                // Ensure we have a valid order type
                if (!in_array($type, ['dine_in', 'takeout', 'delivery'])) {
                    $type = 'dine_in';
                }

                if (!isset($orderTypes[$type])) {
                    $orderTypes[$type] = [
                        'order_type' => $type,
                        'count' => 0,
                        'total' => 0
                    ];
                }

                $orderTypes[$type]['count']++;
                $orderTypes[$type]['total'] += (float) $sale->total_amount;
            }

            return collect(array_values($orderTypes));
        } catch (\Exception $e) {
            \Log::error('Order Types Error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get stock alerts (low stock items)
     */
    private function getStockAlerts()
    {
        try {
            if (!Schema::hasTable('ingredients')) {
                return [];
            }

            return DB::table('ingredients')
                ->whereColumn('quantity', '<=', 'min_stock')
                ->select('id', 'name', 'quantity', 'min_stock', 'unit')
                ->limit(10)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'name' => $item->name,
                        'quantity' => (float) $item->quantity,
                        'min_stock' => (float) $item->min_stock,
                        'unit' => $item->unit,
                    ];
                });
        } catch (\Exception $e) {
            \Log::error('Stock Alerts Error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get expenses data
     */
    private function getExpensesData($startDateTime, $endDateTime)
    {
        if (!Schema::hasTable('expenses')) {
            return [];
        }

        try {
            $schema = DB::getDoctrineSchemaManager();
            $columns = $schema->listTableColumns('expenses');
            
            if (!isset($columns['amount']) && !isset($columns['total'])) {
                return [];
            }

            $amountColumn = isset($columns['amount']) ? 'amount' : 'total';
            $dateColumn = isset($columns['date']) ? 'date' : (isset($columns['created_at']) ? 'created_at' : null);

            if (!$dateColumn) {
                return [];
            }

            return DB::table('expenses')
                ->whereBetween($dateColumn, [$startDateTime, $endDateTime])
                ->select(
                    DB::raw("date($dateColumn) as date"),
                    DB::raw("SUM($amountColumn) as total_expenses")
                )
                ->groupBy(DB::raw("date($dateColumn)"))
                ->orderBy('date')
                ->get()
                ->map(function ($item) {
                    return [
                        'date' => $item->date,
                        'total_expenses' => (float) $item->total_expenses,
                    ];
                });
        } catch (\Exception $e) {
            \Log::error('Expenses Data Error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get top selling items
     */
    private function getTopSellingItems($startDateTime, $endDateTime)
    {
        if (!Schema::hasTable('sale_items')) {
            return [];
        }

        try {
            return DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('items', 'sale_items.item_id', '=', 'items.id')
                ->leftJoin('categories', 'items.category_id', '=', 'categories.id')
                ->whereBetween('sales.created_at', [$startDateTime, $endDateTime])
                ->where('sales.status', 'completed')
                ->select(
                    'items.id as item_id',
                    'items.name as item_name',
                    'categories.name as category',
                    DB::raw('SUM(COALESCE(sale_items.quantity, 0)) as quantity'),
                    DB::raw('SUM(COALESCE(sale_items.quantity, 0) * COALESCE(sale_items.unit_price, 0)) as revenue'),
                    DB::raw('AVG(COALESCE(sale_items.unit_price, 0)) as price')
                )
                ->groupBy('items.id', 'items.name', 'categories.name')
                ->orderBy('quantity', 'DESC')
                ->limit(10)
                ->get()
                ->map(function ($item) {
                    return [
                        'item_id' => $item->item_id,
                        'item_name' => $item->item_name,
                        'category' => $item->category ?? 'N/A',
                        'quantity' => (int) $item->quantity,
                        'revenue' => (float) $item->revenue,
                        'price' => (float) $item->price,
                    ];
                });
        } catch (\Exception $e) {
            \Log::error('Top Selling Items Error: ' . $e->getMessage());
            return [];
        }
    }

    // ==================== STOREHUB-STYLE DASHBOARD METRICS ====================

    /**
     * Build StoreHub-style per-day report dashboard rows for a date range.
     *
     * Each row contains:
     *   date, total_sales, total_transactions, total_discount, discount_pct,
     *   tax, total_rounding, shipping_fee, service_charge,
     *   gross_profit, gross_profit_pct, total_sales_returned,
     *   net_sales, average_net_sales, new_customers, pax
     */
    private function getStorehubDashboardMetrics(string $startDateTime, string $endDateTime): array
    {
        try {
            $sales = Sale::whereBetween('created_at', [$startDateTime, $endDateTime])
                ->where('status', 'completed')
                ->orderBy('created_at')
                ->get();

            $returnedSales = Sale::whereBetween('created_at', [$startDateTime, $endDateTime])
                ->whereIn('status', ['refunded', 'returned', 'cancelled'])
                ->get();

            // Map customer_id → first-ever purchase date for new-customer detection
            $customerFirstDates = [];

            $byDay = [];

            foreach ($sales as $sale) {
                $day = Carbon::parse($sale->created_at)->format('Y-m-d');
                if (!isset($byDay[$day])) {
                    $byDay[$day] = $this->emptyDayRow($day);
                }

                $byDay[$day]['total_sales']        += (float) ($sale->total_amount ?? 0);
                $byDay[$day]['total_transactions']  += 1;
                $byDay[$day]['total_discount']      += (float) ($sale->discount_amount ?? 0);
                $byDay[$day]['tax']                 += (float) ($sale->tax_amount ?? $sale->tax ?? 0);
                $byDay[$day]['total_rounding']      += (float) ($sale->rounding_amount ?? 0);
                $byDay[$day]['shipping_fee']        += (float) ($sale->shipping_fee ?? 0);
                $byDay[$day]['service_charge']      += (float) ($sale->service_charge ?? 0);
                $byDay[$day]['_cogs']               += (float) ($sale->total_cost ?? 0);
                $byDay[$day]['pax']                 += (int)   ($sale->pax ?? $sale->guest_count ?? 1);

                // New customers: only count if this is their first-ever completed sale
                if ($sale->customer_id) {
                    if (!isset($customerFirstDates[$sale->customer_id])) {
                        $customerFirstDates[$sale->customer_id] = Sale::where('customer_id', $sale->customer_id)
                            ->where('status', 'completed')
                            ->orderBy('created_at')
                            ->value('created_at');
                    }
                    $first = $customerFirstDates[$sale->customer_id];
                    if ($first && Carbon::parse($first)->format('Y-m-d') === $day) {
                        $byDay[$day]['new_customers']++;
                    }
                }
            }

            foreach ($returnedSales as $ret) {
                $day = Carbon::parse($ret->created_at)->format('Y-m-d');
                if (isset($byDay[$day])) {
                    $byDay[$day]['total_sales_returned'] += (float) ($ret->total_amount ?? 0);
                }
            }

            $rows = array_map([$this, 'computeDerivedFields'], array_values($byDay));
            usort($rows, fn($a, $b) => strcmp($a['date'], $b['date']));

            // Grand total
            $total = $this->emptyDayRow('Total');
            foreach ($rows as $row) {
                $total['total_sales']          += $row['total_sales'];
                $total['total_transactions']   += $row['total_transactions'];
                $total['total_discount']       += $row['total_discount'];
                $total['tax']                  += $row['tax'];
                $total['total_rounding']       += $row['total_rounding'];
                $total['shipping_fee']         += $row['shipping_fee'];
                $total['service_charge']       += $row['service_charge'];
                $total['total_sales_returned'] += $row['total_sales_returned'];
                $total['new_customers']        += $row['new_customers'];
                $total['pax']                  += $row['pax'];
                $total['_cogs']                += $row['_cogs'];
            }

            return [
                'rows'  => $rows,
                'total' => $this->computeDerivedFields($total),
            ];
        } catch (\Exception $e) {
            \Log::error('StoreHub Dashboard Metrics Error: ' . $e->getMessage());
            return ['rows' => [], 'total' => $this->computeDerivedFields($this->emptyDayRow('Total'))];
        }
    }

    private function emptyDayRow(string $date): array
    {
        return [
            'date'                => $date,
            'total_sales'         => 0,
            'total_transactions'  => 0,
            'total_discount'      => 0,
            'tax'                 => 0,
            'total_rounding'      => 0,
            'shipping_fee'        => 0,
            'service_charge'      => 0,
            'total_sales_returned'=> 0,
            'new_customers'       => 0,
            'pax'                 => 0,
            '_cogs'               => 0,
        ];
    }

    private function computeDerivedFields(array $row): array
    {
        $sales    = $row['total_sales'];
        $returned = $row['total_sales_returned'];
        $cogs     = $row['_cogs'];
        $txns     = $row['total_transactions'];

        $netSales       = $sales - $returned;
        $grossProfit    = $netSales - $cogs;
        $grossProfitPct = $netSales > 0 ? round(($grossProfit / $netSales) * 100, 2) : 0;
        $discountPct    = $sales > 0    ? round(($row['total_discount'] / $sales) * 100, 2) : 0;
        $avgNetSales    = $txns > 0     ? round($netSales / $txns, 2) : 0;

        return [
            'date'                 => $row['date'],
            'total_sales'          => round($sales, 2),
            'total_transactions'   => $txns,
            'total_discount'       => round($row['total_discount'], 2),
            'discount_pct'         => $discountPct,
            'tax'                  => round($row['tax'], 2),
            'total_rounding'       => round($row['total_rounding'], 2),
            'shipping_fee'         => round($row['shipping_fee'], 2),
            'service_charge'       => round($row['service_charge'], 2),
            'gross_profit'         => round($grossProfit, 2),
            'gross_profit_pct'     => $grossProfitPct,
            'total_sales_returned' => round($returned, 2),
            'net_sales'            => round($netSales, 2),
            'average_net_sales'    => $avgNetSales,
            'new_customers'        => $row['new_customers'],
            'pax'                  => $row['pax'],
            '_cogs'                => round($cogs, 2),
        ];
    }
}