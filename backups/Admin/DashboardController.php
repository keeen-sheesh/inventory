<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        // Get date range from request (default to 'today')
        $dateRange = $request->get('range', 'today');
        $startDate = null;
        $endDate = null;
        $dateLabel = 'Today';
        
        // Calculate date range based on selection
        switch ($dateRange) {
            case 'today':
                $startDate = now()->format('Y-m-d');
                $endDate = now()->format('Y-m-d');
                $dateLabel = 'Today';
                break;
            case 'yesterday':
                $startDate = now()->subDay()->format('Y-m-d');
                $endDate = now()->subDay()->format('Y-m-d');
                $dateLabel = 'Yesterday';
                break;
            case 'this_week':
                $startDate = now()->startOfWeek()->format('Y-m-d');
                $endDate = now()->endOfWeek()->format('Y-m-d');
                $dateLabel = 'This Week';
                break;
            case 'last_week':
                $startDate = now()->subWeek()->startOfWeek()->format('Y-m-d');
                $endDate = now()->subWeek()->endOfWeek()->format('Y-m-d');
                $dateLabel = 'Last Week';
                break;
            case 'this_month':
                $startDate = now()->startOfMonth()->format('Y-m-d');
                $endDate = now()->endOfMonth()->format('Y-m-d');
                $dateLabel = 'This Month';
                break;
            case 'last_month':
                $startDate = now()->subMonth()->startOfMonth()->format('Y-m-d');
                $endDate = now()->subMonth()->endOfMonth()->format('Y-m-d');
                $dateLabel = 'Last Month';
                break;
            case 'custom':
                $startDate = $request->get('from', now()->format('Y-m-d'));
                $endDate = $request->get('to', now()->format('Y-m-d'));
                $dateLabel = 'Custom Range';
                break;
            default:
                $startDate = now()->format('Y-m-d');
                $endDate = now()->format('Y-m-d');
                $dateLabel = 'Today';
        }
        
        // Metrics for selected date range
        $totalSales = Sale::whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->where('status', 'completed')
            ->sum('total_amount') ?: 0;
        
        $totalOrders = Sale::whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->count();
        
        $completedOrders = Sale::whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->where('status', 'completed')
            ->count();
        
        $pendingOrders = Sale::whereIn('status', ['pending', 'preparing'])
            ->count();
        
        $averageOrderValue = $completedOrders > 0 ? round($totalSales / $completedOrders, 2) : 0;
        
        // Low stock items
        $lowStockItems = Item::whereColumn('stock_quantity', '<=', 'min_stock')
            ->where('stock_quantity', '>', 0)
            ->count();
        
        $outOfStockItems = Item::where('stock_quantity', '<=', 0)
            ->count();
        
        // Weekly sales data (for chart - always last 7 days)
        $weeklyData = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $sales = Sale::whereDate('created_at', $date)
                ->where('status', 'completed')
                ->sum('total_amount') ?: 0;
            
            $orders = Sale::whereDate('created_at', $date)
                ->where('status', 'completed')
                ->count();
            
            $weeklyData[] = [
                'date' => $date,
                'sales' => (float) $sales,
                'orders' => $orders,
                'day' => now()->subDays($i)->format('D'),
                'full_day' => now()->subDays($i)->format('l'),
            ];
        }
        
        // Recent sales with pagination (10 per page)
        $perPage = $request->get('per_page', 10);
        $recentSalesQuery = Sale::with(['customer', 'paymentMethod'])
            ->orderBy('created_at', 'desc');
        
        // Apply status filter if provided
        if ($request->has('filter') && $request->filter !== 'all') {
            $recentSalesQuery->where('status', $request->filter);
        }
        
        $recentSales = $recentSalesQuery->paginate($perPage);
        
        // Transform recent sales data
        $recentSalesData = $recentSales->map(function ($sale) {
            $itemsCount = $sale->saleItems()->count();
            
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
                'order_number' => $sale->order_number,
                'customer_name' => $customerName,
                'room_number' => $sale->room_number,
                'total_amount' => (float) $sale->total_amount,
                'status' => $sale->status,
                'order_type' => $sale->order_type,
                'payment_method' => $sale->paymentMethod ? $sale->paymentMethod->name : 'Unknown',
                'items_count' => $itemsCount,
                'created_at' => $sale->created_at->toISOString(),
                'is_hotel' => !is_null($sale->room_number) || ($sale->paymentMethod && $sale->paymentMethod->name === 'Hotel'),
            ];
        });
        
        // Top selling items for selected date range
        $topItems = SaleItem::select(
                'sale_items.item_id',
                'items.name as item_name',
                'items.price',
                'categories.name as category_name',
                DB::raw('COUNT(sale_items.id) as total_sold'),
                DB::raw('SUM(sale_items.quantity) as quantity'),
                DB::raw('SUM(sale_items.total_price) as revenue')
            )
            ->join('items', 'sale_items.item_id', '=', 'items.id')
            ->leftJoin('categories', 'items.category_id', '=', 'categories.id')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->whereBetween('sales.created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->where('sales.status', 'completed')
            ->groupBy('sale_items.item_id', 'items.name', 'items.price', 'categories.name')
            ->orderBy('revenue', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($item) {
                return [
                    'item_id' => $item->item_id,
                    'item_name' => $item->item_name,
                    'category_name' => $item->category_name,
                    'price' => (float) $item->price,
                    'quantity' => (int) $item->quantity,
                    'revenue' => (float) $item->revenue,
                ];
            });
        
        // Top items this week (for comparison)
        $topItemsWeek = SaleItem::select(
                'sale_items.item_id',
                'items.name as item_name',
                DB::raw('SUM(sale_items.quantity) as quantity'),
                DB::raw('SUM(sale_items.total_price) as revenue')
            )
            ->join('items', 'sale_items.item_id', '=', 'items.id')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->whereBetween('sales.created_at', [now()->startOfWeek(), now()->endOfWeek()])
            ->where('sales.status', 'completed')
            ->groupBy('sale_items.item_id', 'items.name')
            ->orderBy('revenue', 'desc')
            ->limit(5)
            ->get();
        
        // Payment method breakdown for selected range
        $paymentMethodBreakdown = Sale::select(
                'payment_methods.name as method',
                DB::raw('COUNT(*) as order_count'),
                DB::raw('SUM(total_amount) as total')
            )
            ->leftJoin('payment_methods', 'sales.payment_method_id', '=', 'payment_methods.id')
            ->whereBetween('sales.created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->where('sales.status', 'completed')
            ->groupBy('payment_methods.id', 'payment_methods.name')
            ->get();
        
        // Order type breakdown
        $orderTypeBreakdown = Sale::select(
                'order_type',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(total_amount) as total')
            )
            ->whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->where('status', 'completed')
            ->groupBy('order_type')
            ->get();
        
        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'totalSales' => (float) $totalSales,
                'totalOrders' => (int) $totalOrders,
                'completedOrders' => (int) $completedOrders,
                'pendingOrders' => (int) $pendingOrders,
                'averageOrderValue' => (float) $averageOrderValue,
                'lowStockItems' => (int) $lowStockItems,
                'outOfStockItems' => (int) $outOfStockItems,
            ],
            'recentSales' => [
                'data' => $recentSalesData,
                'current_page' => $recentSales->currentPage(),
                'last_page' => $recentSales->lastPage(),
                'per_page' => $recentSales->perPage(),
                'total' => $recentSales->total(),
                'from' => $recentSales->firstItem(),
                'to' => $recentSales->lastItem(),
            ],
            'weeklyData' => $weeklyData,
            'topItems' => $topItems,
            'topItemsWeek' => $topItemsWeek,
            'paymentMethodBreakdown' => $paymentMethodBreakdown,
            'orderTypeBreakdown' => $orderTypeBreakdown,
            'filters' => [
                'range' => $dateRange,
                'from' => $startDate,
                'to' => $endDate,
                'label' => $dateLabel,
                'filter' => $request->get('filter', 'all'),
            ],
        ]);
    }
    
    /**
     * Get transaction details for a specific order
     */
    public function getTransaction($id)
    {
        $sale = Sale::with(['customer', 'paymentMethod', 'user', 'saleItems.item.category'])
            ->findOrFail($id);
        
        $items = $sale->saleItems->map(function ($item) {
            return [
                'id' => $item->item_id,
                'name' => $item->item->name,
                'quantity' => $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'total_price' => (float) $item->total_price,
                'category' => $item->item->category ? $item->item->category->name : null,
                'special_instructions' => $item->special_instructions,
            ];
        });
        
        return response()->json([
            'id' => $sale->id,
            'order_number' => $sale->order_number,
            'customer_name' => $sale->customer_name ?? ($sale->customer ? $sale->customer->name : 'Walk-in Customer'),
            'customer_phone' => $sale->customer_phone,
            'room_number' => $sale->room_number,
            'order_type' => $sale->order_type,
            'status' => $sale->status,
            'payment_method' => $sale->paymentMethod ? $sale->paymentMethod->name : 'Unknown',
            'people_count' => $sale->people_count,
            'cards_presented' => $sale->cards_presented,
            'discount_amount' => (float) $sale->discount_amount,
            'subtotal' => (float) $sale->subtotal,
            'tax_amount' => (float) $sale->tax_amount,
            'total_amount' => (float) $sale->total_amount,
            'notes' => $sale->notes,
            'items' => $items,
            'created_at_formatted' => $sale->created_at->format('M d, Y h:i A'),
            'user' => $sale->user ? $sale->user->name : null,
        ]);
    }
    
    /**
     * Export transactions page
     */
    public function transactions(Request $request)
    {
        $query = Sale::with(['customer', 'paymentMethod'])
            ->orderBy('created_at', 'desc');
        
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }
        
        if ($request->has('order_type') && $request->order_type !== 'all') {
            $query->where('order_type', $request->order_type);
        }
        
        if ($request->has('from')) {
            $query->whereDate('created_at', '>=', $request->from);
        }
        
        if ($request->has('to')) {
            $query->whereDate('created_at', '<=', $request->to);
        }
        
        $perPage = $request->get('per_page', 20);
        $transactions = $query->paginate($perPage);
        
        return Inertia::render('Admin/Transactions', [
            'transactions' => $transactions,
            'filters' => $request->all(),
        ]);
    }
}