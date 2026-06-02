<?php

use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\FoodCategoryController;
use App\Http\Controllers\Admin\FoodItemController;
use App\Http\Controllers\Admin\InventoryController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\PosController;
use App\Http\Controllers\Admin\KitchenController;
use App\Http\Controllers\Admin\KitchenItemController;
use App\Http\Controllers\Admin\KitchenCategoryController;
use App\Http\Controllers\Admin\KitchenOrderController;
use App\Http\Controllers\Admin\RestoOrderController;
use App\Http\Controllers\Admin\CashSessionController;
use App\Http\Controllers\Admin\ReportsController;
use App\Http\Controllers\Cashier\DashboardController as CashierDashboardController;
use App\Http\Controllers\Cashier\ShiftController;
use App\Http\Controllers\Cashier\ShiftTransactionController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Public routes
Route::get('/', function () {
    if (Auth::check()) {
        $user = Auth::user();
        $roleRedirects = [
            'admin'         => '/admin/dashboard',
            'manager'       => '/admin/dashboard',
            'cashier'       => '/cashier/pos',
            'resto'         => '/cashier/pos',
            'kitchen'       => '/admin/kitchen',
            'kitchen_resto' => '/admin/kitchen',
            'customer'      => '/menu',
        ];
        return redirect($roleRedirects[$user->role] ?? '/admin/dashboard');
    }
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
    ]);
});

// Auth routes (handled by Breeze)
require __DIR__.'/auth.php';

// Generic dashboard/profile routes expected by Laravel auth flows/tests
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', function () {
        $user = Auth::user();
        $roleRedirects = [
            'admin'         => '/admin/dashboard',
            'manager'       => '/admin/dashboard',
            'cashier'       => '/cashier/pos',
            'resto'         => '/cashier/pos',
            'kitchen'       => '/admin/kitchen',
            'kitchen_resto' => '/admin/kitchen',
            'customer'      => '/menu',
        ];

        return redirect($roleRedirects[$user->role] ?? '/admin/dashboard');
    })->name('dashboard');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

// ==================== MANAGER PASSWORD VERIFICATION ====================
Route::middleware(['auth'])->post('/manager/verify', function (Illuminate\Http\Request $request) {
    $password = $request->input('password');
    
    if (empty($password)) {
        return response()->json(['valid' => false, 'message' => 'Password is required'], 400);
    }
    
    $manager = App\Models\User::whereIn('role', ['manager', 'admin'])
        ->where('is_active', true)
        ->first();
    
    if ($manager && Illuminate\Support\Facades\Hash::check($password, $manager->password)) {
        return response()->json([
            'valid' => true, 
            'manager_name' => $manager->name,
            'manager_role' => $manager->role
        ]);
    }
    
    return response()->json(['valid' => false, 'message' => 'Invalid manager password'], 401);
})->name('manager.verify');

// Kitchen shortcuts for account-specific redirects
Route::middleware(['auth', 'verified', 'role:kitchen,kitchen_resto,admin,manager'])->prefix('kitchen')->group(function () {
    Route::get('/', function () {
        return redirect()->route('admin.kitchen.index');
    })->name('kitchen.index');

    Route::get('/dashboard', function () {
        return redirect()->route('admin.kitchen.index');
    })->name('kitchen.dashboard');
});

// Admin routes
Route::middleware(['auth', 'verified', 'role:admin,manager'])->prefix('admin')->name('admin.')->group(function () {
    // ==================== DASHBOARD ROUTES ====================
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/transactions', [DashboardController::class, 'transactions'])->name('transactions');
    Route::get('/transactions/{id}', [DashboardController::class, 'getTransaction'])->name('transactions.show');

    // ==================== POS SYSTEM ====================
    Route::get('/pos', [PosController::class, 'index'])->name('pos.index');
    Route::post('/pos/orders', [PosController::class, 'store'])->name('pos.orders.store');
    Route::post('/orders/{order}/pay', [PosController::class, 'markAsPaid'])->name('orders.pay');
    Route::post('/orders/{order}/ready', [PosController::class, 'markAsReady'])->name('orders.ready');
    Route::post('/orders/{order}/preparing', [PosController::class, 'markAsPreparing'])->name('orders.preparing');
    Route::post('/orders/{order}/complete', [PosController::class, 'complete'])->name('orders.complete');
    Route::post('/orders/{order}/cancel', [PosController::class, 'cancel'])->name('orders.cancel');
    
    // POS Real-time routes
    Route::get('/pos/menu-updates', [PosController::class, 'getMenuUpdates'])->name('pos.menu-updates');
    Route::get('/pos/order-updates', [PosController::class, 'getOrderUpdates'])->name('pos.order-updates');
    Route::get('/pos/menu-data', [PosController::class, 'getMenuData'])->name('pos.menu-data');
    Route::get('/pos/order-data', [PosController::class, 'getOrderData'])->name('pos.order-data');
    
    // ==================== ITEM SIZES ROUTES ====================
    Route::get('/items/{item}/sizes', function($itemId) {
        $item = App\Models\Item::with('itemSizes.size')->find($itemId);
        if (!$item) {
            return response()->json(['success' => false, 'message' => 'Item not found']);
        }
        
        $sizes = $item->itemSizes->map(function($itemSize) {
            return [
                'id' => $itemSize->id,
                'size_id' => $itemSize->size_id,
                'size_name' => $itemSize->size->name,
                'display_name' => $itemSize->size->display_name,
                'price' => (float) $itemSize->price,
            ];
        });
        
        return response()->json(['success' => true, 'sizes' => $sizes]);
    })->name('items.sizes');

    // Other admin routes
    Route::get('/reports', [ReportsController::class, 'index'])->name('reports.index');
    Route::get('/reports/inventory-valuation', [ReportsController::class, 'inventoryValuation'])->name('reports.inventory-valuation');
    Route::get('/reports/export-cogs', [ReportsController::class, 'exportCogs'])->name('reports.export-cogs');
    Route::get('/reports/transaction-stats', [ReportsController::class, 'transactionStats'])->name('reports.transaction-stats');
    Route::get('/roles', [RoleController::class, 'index'])->name('roles.index');
    Route::post('/roles/users', [RoleController::class, 'store'])->name('roles.users.store');
    Route::post('/roles/users/{user}/toggle-active', [RoleController::class, 'toggleActive'])->name('roles.users.toggle-active');
    Route::delete('/roles/users/{user}', [RoleController::class, 'destroy'])->name('roles.users.destroy');
    Route::get('/settings', [SettingsController::class, 'index'])->name('settings.index');
    Route::post('/settings', [SettingsController::class, 'update'])->name('settings.update');
    Route::post('/settings/clear-cache', [SettingsController::class, 'clearCache'])->name('settings.clear-cache');
    Route::get('/settings/inventory-audit', [SettingsController::class, 'inventoryAudit'])->name('settings.inventory-audit');
    Route::get('/settings/inventory-audit/export', [SettingsController::class, 'exportInventoryAuditCsv'])->name('settings.inventory-audit.export');
    Route::post('/settings/danger/{action}', [SettingsController::class, 'dangerAction'])->name('settings.danger');
});

// Food Menu — accessible by all staff roles
Route::middleware(['auth', 'verified', 'role:admin,manager,kitchen,kitchen_resto'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/foods', [FoodCategoryController::class, 'index'])->name('foods.index');

    // ── Kitchen Items (drinks — managed by kitchen_resto and admin) ──────────
    Route::get('/kitchen-items',                              [KitchenItemController::class, 'index'])->name('kitchen-items.index');
    Route::post('/kitchen-items',                             [KitchenItemController::class, 'store'])->name('kitchen-items.store');
    Route::put('/kitchen-items/{item}',                       [KitchenItemController::class, 'update'])->name('kitchen-items.update');
    Route::delete('/kitchen-items/{item}',                    [KitchenItemController::class, 'destroy'])->name('kitchen-items.destroy');
    Route::post('/kitchen-items/{item}/toggle-status',        [KitchenItemController::class, 'toggleStatus'])->name('kitchen-items.toggle-status');
    Route::post('/kitchen-items/update-order',                [KitchenItemController::class, 'updateOrder'])->name('kitchen-items.update-order');
    Route::get('/kitchen-categories',                         [KitchenCategoryController::class, 'index'])->name('kitchen-categories.index');
    Route::get('/kitchen-categories/api',                     [KitchenCategoryController::class, 'apiIndex'])->name('kitchen-categories.api-index');
    Route::post('/kitchen-categories',                        [KitchenCategoryController::class, 'store'])->name('kitchen-categories.store');
    Route::put('/kitchen-categories/{category}',              [KitchenCategoryController::class, 'update'])->name('kitchen-categories.update');
    Route::delete('/kitchen-categories/{category}',           [KitchenCategoryController::class, 'destroy'])->name('kitchen-categories.destroy');
    Route::post('/kitchen-categories/{category}/toggle-status', [KitchenCategoryController::class, 'toggleStatus'])->name('kitchen-categories.toggle-status');
    Route::post('/kitchen-categories/update-order',           [KitchenCategoryController::class, 'updateOrder'])->name('kitchen-categories.update-order');

    Route::get('/food-categories', [FoodCategoryController::class, 'apiIndex'])->name('food-categories.index');
    Route::post('/food-categories', [FoodCategoryController::class, 'store'])->name('food-categories.store');
    Route::put('/food-categories/{category}', [FoodCategoryController::class, 'update'])->name('food-categories.update');
    Route::delete('/food-categories/{category}', [FoodCategoryController::class, 'destroy'])->name('food-categories.destroy');
    Route::post('/food-categories/{category}/toggle-status', [FoodCategoryController::class, 'toggleStatus'])->name('food-categories.toggle-status');
    Route::post('/food-categories/update-order', [FoodCategoryController::class, 'updateOrder'])->name('food-categories.update-order');

    Route::get('/food-items', [FoodItemController::class, 'index'])->name('food-items.index');
    Route::post('/food-items', [FoodItemController::class, 'store'])->name('food-items.store');
    Route::put('/food-items/{item}', [FoodItemController::class, 'update'])->name('food-items.update');
    Route::delete('/food-items/{item}', [FoodItemController::class, 'destroy'])->name('food-items.destroy');
    Route::post('/food-items/{item}/toggle-status', [FoodItemController::class, 'toggleStatus'])->name('food-items.toggle-status');
    Route::post('/food-items/{item}/toggle-featured', [FoodItemController::class, 'toggleFeatured'])->name('food-items.toggle-featured');
    Route::post('/food-items/update-order', [FoodItemController::class, 'updateOrder'])->name('food-items.update-order');
    Route::put('/food-items/{item}/update-stock', [FoodItemController::class, 'updateStock'])->name('food-items.update-stock');
    Route::delete('/food-items/clear-all', [FoodItemController::class, 'clearAll'])->name('food-items.clear-all');
});

// Inventory routes for admin, manager, resto, and kitchen accounts
Route::middleware(['auth', 'verified', 'role:admin,manager,kitchen,kitchen_resto'])->prefix('admin')->name('admin.')->group(function () {
    Route::prefix('inventory')->name('inventory.')->group(function () {
        Route::get('/', [InventoryController::class, 'index'])->name('index');
        
        // Ingredients API
        Route::get('/ingredients', [InventoryController::class, 'getIngredients'])->name('ingredients');
        Route::get('/stats', [InventoryController::class, 'getStats'])->name('stats');
        Route::post('/ingredients', [InventoryController::class, 'storeIngredient'])->name('ingredients.store');
        Route::put('/ingredients/{ingredient}', [InventoryController::class, 'updateIngredient'])->name('ingredients.update');
        Route::delete('/ingredients/{ingredient}', [InventoryController::class, 'deleteIngredient'])->name('ingredients.delete');
        Route::post('/bulk-update-stock', [InventoryController::class, 'bulkUpdateStock'])->name('bulk-update-stock');
        
        // ADD STOCK TO EXISTING INGREDIENT
        Route::post('/add-stock', [InventoryController::class, 'addStock'])->name('add-stock');
        
        // Recipes
        Route::get('/items-with-recipes', [InventoryController::class, 'getItemsWithRecipes'])->name('items-with-recipes');
        Route::get('/items/{item}/recipe', [InventoryController::class, 'getItemRecipe'])->name('item-recipe');
        Route::post('/items/{item}/recipe', [InventoryController::class, 'saveRecipe'])->name('save-recipe');
        Route::get('/items/{item}/check-availability', [InventoryController::class, 'checkAvailability'])->name('check-availability');
        
        // Stock Management
        Route::post('/update-stock', [InventoryController::class, 'updateStock'])->name('update-stock');
        
        // Alerts
        Route::get('/low-stock-alerts', [InventoryController::class, 'getLowStockAlerts'])->name('low-stock-alerts');

        // ── Stock Value ──────────────────────────────────────────────────────────
        Route::get('/stock-value', [InventoryController::class, 'getStockValue'])->name('stock-value');

        // ── Stock Return ─────────────────────────────────────────────────────────
        Route::get('/stock-returns',  [InventoryController::class, 'getStockReturns'])->name('stock-returns');
        Route::post('/stock-returns', [InventoryController::class, 'storeStockReturn'])->name('stock-returns.store');

        // ── Stock Take ───────────────────────────────────────────────────────────
        Route::get('/stock-takes',  [InventoryController::class, 'getStockTakes'])->name('stock-takes');
        Route::post('/stock-takes', [InventoryController::class, 'submitStockTake'])->name('stock-takes.store');

        // ── Stock Loss Report ────────────────────────────────────────────────────
        Route::get('/stock-losses',  [InventoryController::class, 'getStockLosses'])->name('stock-losses');
        Route::post('/stock-losses', [InventoryController::class, 'storeStockLoss'])->name('stock-losses.store');

        // ── Stock Transfer ───────────────────────────────────────────────────────
        Route::get('/stock-transfers',  [InventoryController::class, 'getStockTransfers'])->name('stock-transfers');
        Route::post('/stock-transfers', [InventoryController::class, 'transferStock'])->name('stock-transfers.store');

        // ── Audit Trail ──────────────────────────────────────────────────────────
        Route::get('/audit-trail', [InventoryController::class, 'getAuditTrailData'])->name('audit-trail');

        // ── Stock Audit Import ───────────────────────────────────────────────────
        Route::post('/stock-audit-import', [InventoryController::class, 'importStockAudit'])->name('stock-audit-import');

        // ── Wastage Record ───────────────────────────────────────────────────────
        Route::get('/wastage',  [InventoryController::class, 'getWastageData'])->name('wastage');
        Route::post('/wastage', [InventoryController::class, 'storeWastage'])->name('wastage.store');

        // Usage Report export (CSV)
        Route::get('/reports/export-usage', [App\Http\Controllers\Admin\InventoryReportController::class, 'exportUsageCsv'])->name('reports.export-usage');
        Route::get('/reports/export-stock-template', [App\Http\Controllers\Admin\InventoryReportController::class, 'exportStockCountTemplateCsv'])->name('reports.export-stock-template');
        Route::get('/reports/export-stock-final/{batchId}', [App\Http\Controllers\Admin\InventoryReportController::class, 'exportFinalizedStockCountCsv'])->name('reports.export-stock-final');

        // Migration
        Route::post('/migrate-items', [InventoryController::class, 'migrateItems'])->name('migrate-items');
    });
});

// Cashier routes
Route::middleware(['auth', 'verified', 'role:cashier,resto,admin,manager', 'extend.session'])->prefix('cashier')->group(function () {
    // Redirect cashier root to POS (their main working screen)
    Route::get('/', function () {
        return redirect('/cashier/pos');
    });

    // Fallback: redirect old dashboard route to POS
    Route::get('/dashboard', function () {
        return redirect('/cashier/pos');
    })->name('cashier.dashboard');

    // Deprecated Cash Session routes (replaced by /cashier/shifts/*)
    Route::get('/cash-session/current', fn () => response()->json(['success' => false, 'error' => 'Deprecated endpoint.'], 410))->name('cashier.cash-session.current');
    Route::post('/cash-session/open', fn () => response()->json(['success' => false, 'error' => 'Deprecated endpoint.'], 410))->name('cashier.cash-session.open');
    Route::post('/cash-session/close', fn () => response()->json(['success' => false, 'error' => 'Deprecated endpoint.'], 410))->name('cashier.cash-session.close');
    Route::post('/cash-session/override', fn () => response()->json(['success' => false, 'error' => 'Deprecated endpoint.'], 410))->name('cashier.cash-session.override');

    Route::get('/pos', [PosController::class, 'index'])->name('cashier.pos');
    Route::post('/pos/orders', [PosController::class, 'store'])->name('cashier.pos.orders.store');
    Route::post('/orders/{order}/pay', [PosController::class, 'markAsPaid'])->name('cashier.orders.pay');
    Route::post('/orders/{order}/start', [PosController::class, 'markAsPreparing'])->name('cashier.orders.start');
    Route::post('/orders/{order}/ready', [PosController::class, 'markAsReady'])->name('cashier.orders.ready');
    Route::post('/orders/{order}/preparing', [PosController::class, 'markAsPreparing'])->name('cashier.orders.preparing');
    Route::post('/orders/{order}/complete', [PosController::class, 'complete'])->name('cashier.orders.complete');
    Route::post('/orders/{order}/cancel', [PosController::class, 'cancel'])->name('cashier.orders.cancel');

    Route::get('/pos/menu-updates', [PosController::class, 'getMenuUpdates'])->name('cashier.pos.menu-updates');
    Route::get('/pos/order-updates', [PosController::class, 'getOrderUpdates'])->name('cashier.pos.order-updates');
    Route::get('/pos/menu-data', [PosController::class, 'getMenuData'])->name('cashier.pos.menu-data');
    Route::get('/pos/order-data', [PosController::class, 'getOrderData'])->name('cashier.pos.order-data');
});

// Cashier Shift + Transaction routes (cashier role only)
Route::middleware(['auth', 'verified', 'role:cashier', 'extend.session'])->prefix('cashier')->group(function () {
    Route::get('/shifts/current', [ShiftController::class, 'current'])->name('cashier.shifts.current');
    Route::post('/shifts/check-in', [ShiftController::class, 'checkIn'])->name('cashier.shifts.check-in');
    Route::post('/shifts/check-out', [ShiftController::class, 'checkOut'])->name('cashier.shifts.check-out');
    Route::get('/shifts/{shift}/receipt', [ShiftController::class, 'receipt'])->name('cashier.shifts.receipt');

    Route::post('/transactions', [ShiftTransactionController::class, 'store'])
        ->middleware(['cashier.shift.open'])
        ->name('cashier.transactions.store');
});

// ==================== KITCHEN ROUTES ====================
// Kitchen staff and administrators can access the kitchen display
Route::middleware(['auth', 'verified', 'role:kitchen,kitchen_resto,admin,manager', 'extend.session'])->prefix('admin')->name('admin.')->group(function () {
    Route::prefix('kitchen')->name('kitchen.')->group(function () {
        // Main kitchen display - using KitchenOrderController
        Route::get('/', [KitchenOrderController::class, 'index'])->name('index');
        
        // Get orders with date filtering for kitchen display (API endpoint)
        Route::get('/orders', [KitchenOrderController::class, 'getOrders'])->name('orders');
        
        // Polling and real-time
        Route::get('/check-new', [KitchenOrderController::class, 'checkNewOrders'])->name('check-new');

        // Kitchen actions
        Route::post('/orders/{order}/start', [KitchenOrderController::class, 'startPreparing'])->name('start');
        Route::post('/orders/{order}/ready', [KitchenOrderController::class, 'markReady'])->name('ready');
    });
});

// Keep the original kitchen controller routes for API/management (renamed to avoid conflict)
Route::middleware(['auth', 'verified', 'role:admin,manager,kitchen,kitchen_resto'])->prefix('admin')->name('admin.')->group(function () {
    Route::prefix('kitchen-management')->name('kitchen-management.')->group(function () {
        // Kitchen items management (CRUD)
        Route::get('/items', [KitchenController::class, 'index'])->name('items');
        Route::post('/items', [KitchenController::class, 'store'])->name('items.store');
        Route::put('/items/{item}', [KitchenController::class, 'update'])->name('items.update');
        Route::delete('/items/{item}', [KitchenController::class, 'destroy'])->name('items.destroy');
        Route::post('/items/{item}/toggle-status', [KitchenController::class, 'toggleStatus'])->name('items.toggle-status');
        Route::post('/items/update-order', [KitchenController::class, 'updateOrder'])->name('items.update-order');
    });
});

// ==================== RESTO ORDER MONITOR ROUTES ====================
// Resto staff, cashier, and administrators can access the resto order monitor (Clean Kitchen)
Route::middleware(['auth', 'verified', 'role:resto,cashier,kitchen_resto,admin,manager', 'extend.session'])->prefix('admin')->name('admin.')->group(function () {
    Route::prefix('resto')->name('resto.')->group(function () {
        // Main resto order monitor
        Route::get('/', [RestoOrderController::class, 'index'])->name('index');

        // Polling for new orders
        Route::get('/check-new', [RestoOrderController::class, 'checkNewOrders'])->name('check-new');

        // Order status updates
        Route::post('/orders/{order}/start', [RestoOrderController::class, 'startPreparing'])->name('start');
        Route::post('/orders/{order}/ready', [RestoOrderController::class, 'markReady'])->name('ready');
        Route::post('/orders/{order}/complete', [RestoOrderController::class, 'complete'])->name('complete');
    });
});

// Customer routes
Route::middleware(['auth', 'verified', 'role:customer'])->group(function () {
    Route::get('/menu', function () {
        return Inertia::render('Customer/Menu');
    });
});

// Session keep-alive — POS and Kitchen ping this every 5 min to prevent auto-logout
// Using GET to avoid CSRF issues
Route::middleware(['auth'])->get('/keep-alive', function () {
    return response()->json(['alive' => true, 'timestamp' => now()->timestamp]);
})->name('keep-alive');

// CSRF token refresh endpoint - get fresh token without reloading page
Route::middleware(['auth'])->get('/csrf-token', function () {
    return response()->json(['token' => csrf_token()]);
})->name('csrf-token');