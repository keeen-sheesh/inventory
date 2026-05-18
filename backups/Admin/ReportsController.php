<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\Expense;
use App\Models\Item;
use App\Models\Ingredient;
use App\Models\Customer;
use App\Models\PaymentMethod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Carbon\Carbon;

class ReportsController extends Controller
{
    public function index(Request $request)
    {
        // Date range for reports (default to current month)
        $startDate = $request->get('start_date', date('Y-m-01'));
        $endDate = $request->get('end_date', date('Y-m-d'));

        // 1. SALES REPORT - Total Revenue (SQLite compatible)
        $salesData = Sale::select(
                DB::raw("date(created_at, 'unixepoch') as date"),
                DB::raw("COUNT(*) as orders"),
                DB::raw("SUM(total_amount + tax_amount - discount_amount) as revenue"),
                DB::raw("SUM(total_amount) as subtotal"),
                DB::raw("SUM(tax_amount) as taxes"),
                DB::raw("SUM(discount_amount) as discounts")
            )
            ->where('status', 'completed')
            ->whereDate('created_at', '>=', $startDate)
            ->whereDate('created_at', '<=', $endDate)
            ->groupBy(DB::raw("date(created_at, 'unixepoch')"))
            ->orderBy('date', 'DESC')
            ->get();

        // 2. EXPENSES REPORT - For SQLite we need to handle differently
        // First get all expenses in the date range
        $expenses = Expense::whereDate('date', '>=', $startDate)
            ->whereDate('date', '<=', $endDate)
            ->get();
        
        // Group them manually by date
        $expensesData = $expenses->groupBy(function ($expense) {
            return Carbon::parse($expense->date)->format('Y-m-d');
        })->map(function ($dayExpenses, $date) {
            return [
                'date' => $date,
                'total_expenses' => $dayExpenses->sum('amount'),
                'expense_count' => $dayExpenses->count(),
            ];
        })->values()->sortByDesc('date');

        // 3. SALES RECORDS (Detailed Sales Data)
        $salesRecordsData = Sale::with(['customer', 'paymentMethod'])
            ->where('status', 'completed')
            ->whereDate('created_at', '>=', $startDate)
            ->whereDate('created_at', '<=', $endDate)
            ->orderBy('created_at', 'DESC')
            ->get()
            ->map(function ($sale) {
                return [
                    'id' => $sale->id,
                    'sale_date' => $sale->created_at->format('Y-m-d'),
                    'sale_time' => $sale->created_at->format('H:i:s'),
                    'customer_name' => $sale->customer?->name,
                    'total_amount' => (float) $sale->total_amount,
                    'tax_amount' => (float) $sale->tax_amount,
                    'discount_amount' => (float) $sale->discount_amount,
                    'final_amount' => (float) ($sale->total_amount + $sale->tax_amount - $sale->discount_amount),
                    'payment_method' => $sale->paymentMethod?->name,
                    'status' => $sale->status,
                    'invoice_number' => 'INV-' . str_pad($sale->id, 6, '0', STR_PAD_LEFT),
                ];
            });

        // 4. Most sold items
        $topItems = Item::select(
                'items.id',
                'items.name',
                DB::raw('SUM(sale_items.quantity) as total_quantity'),
                DB::raw('SUM(sale_items.total_price) as total_revenue'),
                DB::raw('AVG(sale_items.unit_price) as avg_price')
            )
            ->join('sale_items', 'items.id', '=', 'sale_items.item_id')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('sales.status', 'completed')
            ->whereDate('sales.created_at', '>=', $startDate)
            ->whereDate('sales.created_at', '<=', $endDate)
            ->groupBy('items.id', 'items.name')
            ->orderByDesc('total_quantity')
            ->orderByDesc('total_revenue')
            ->limit(15)
            ->get();

        // 5. Stock alerts
        $stockAlerts = Ingredient::whereRaw('quantity <= min_stock')
            ->orderByRaw('(min_stock - quantity) DESC')
            ->get(['name', 'quantity', 'min_stock', 'unit']);

        // Calculate totals
        $totalRevenue = $salesData->sum('revenue');
        $totalOrders = $salesData->sum('orders');
        $avgOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;
        $totalExpenses = $expensesData->sum('total_expenses');
        $netProfit = $totalRevenue - $totalExpenses;
        $profitMargin = $totalRevenue > 0 ? ($netProfit / $totalRevenue) * 100 : 0;

        // Calculate sales records totals
        $salesRecordsTotal = $salesRecordsData->sum('final_amount');
        $salesRecordsCount = $salesRecordsData->count();
        $avgSaleAmount = $salesRecordsCount > 0 ? $salesRecordsTotal / $salesRecordsCount : 0;

        return Inertia::render('Admin/Reports', [
            'salesData' => $salesData,
            'expensesData' => $expensesData,
            'salesRecordsData' => $salesRecordsData,
            'topItems' => $topItems,
            'stockAlerts' => $stockAlerts,
            'startDate' => $startDate,
            'endDate' => $endDate,
            'totals' => [
                'revenue' => $totalRevenue,
                'orders' => $totalOrders,
                'avgOrderValue' => $avgOrderValue,
                'expenses' => $totalExpenses,
                'netProfit' => $netProfit,
                'profitMargin' => $profitMargin,
                'salesRecordsTotal' => $salesRecordsTotal,
                'salesRecordsCount' => $salesRecordsCount,
                'avgSaleAmount' => $avgSaleAmount,
            ]
        ]);
    }
}