<?php

namespace App\Http\Controllers\Cashier;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\IngredientStock;
use App\Models\Item;
use App\Models\Sale;
use App\Models\Table;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $todaySales = Sale::whereDate('created_at', now()->toDateString())
            ->where('status', 'completed')
            ->sum('total_amount') ?: 0;

        $activeOrders = Sale::whereIn('status', ['pending', 'preparing', 'ready'])->count();
        $readyOrders = Sale::where('status', 'ready')->count();

        $totalTables = Table::where('is_active', true)->count();
        $occupiedTables = Table::where('is_active', true)
            ->where('status', 'occupied')
            ->count();

        $availableMenuItems = Item::where('is_available', true)->count();
        $activeMenuCategories = Category::where('is_active', true)->count();

        $lowStockItems = IngredientStock::where('inventory_pool_id', 1)
            ->whereColumn('quantity', '<=', 'min_stock')
            ->where('quantity', '>', 0)
            ->count();

        return Inertia::render('Cashier/Dashboard', [
            'stats' => [
                'todaySales' => (float) $todaySales,
                'activeOrders' => (int) $activeOrders,
                'readyOrders' => (int) $readyOrders,
                'totalTables' => (int) $totalTables,
                'occupiedTables' => (int) $occupiedTables,
                'availableMenuItems' => (int) $availableMenuItems,
                'activeMenuCategories' => (int) $activeMenuCategories,
                'lowStockItems' => (int) $lowStockItems,
            ],
        ]);
    }
}
