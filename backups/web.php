<?php

use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\FoodCategoryController;
use App\Http\Controllers\Admin\FoodItemController;
use App\Http\Controllers\Admin\InventoryController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\PurchaseOrderController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\PosController;
use App\Http\Controllers\Admin\KitchenController;
use App\Http\Controllers\Cashier\DashboardController as CashierDashboardController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Public routes
Route::get('/', function () {
    if (Auth::check()) {
        $user = Auth::user();
        $roleRedirects = [
            'admin' => '/admin/dashboard',
            'resto_admin' => '/admin/dashboard',
            'resto' => '/cashier/dashboard',
            'cashier' => '/cashier/dashboard',
            'kitchen' => '/admin/kitchen',
            'customer' => '/menu',
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

// Kitchen shortcuts for account-specific redirects
Route::middleware(['auth', 'verified', 'role:kitchen,admin'])->prefix('kitchen')->group(function () {
    Route::get('/', function () {
        return redirect()->route('admin.kitchen.index');
    })->name('kitchen.index');

    Route::get('/dashboard', function () {
        return redirect()->route('admin.kitchen.index');
    })->name('kitchen.dashboard');
});

// Admin routes
Route::middleware(['auth', 'verified', 'role:admin,resto_admin'])->prefix('admin')->name('admin.')->group(function () {
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
    
    // ==================== FOODS MANAGEMENT ====================
    // Page route (renders the React page)
    Route::get('/foods', [FoodCategoryController::class, 'index'])->name('foods.index');
    
    // Food Categories API Routes (JSON)
    Route::get('/food-categories', [FoodCategoryController::class, 'apiIndex'])->name('food-categories.index');
    Route::post('/food-categories', [FoodCategoryController::class, 'store'])->name('food-categories.store');
    Route::put('/food-categories/{category}', [FoodCategoryController::class, 'update'])->name('food-categories.update');
    Route::delete('/food-categories/{category}', [FoodCategoryController::class, 'destroy'])->name('food-categories.destroy');
    Route::post('/food-categories/{category}/toggle-status', [FoodCategoryController::class, 'toggleStatus'])->name('food-categories.toggle-status');
    Route::post('/food-categories/update-order', [FoodCategoryController::class, 'updateOrder'])->name('food-categories.update-order');

    // Food Items API Routes
    Route::get('/food-items', [FoodItemController::class, 'index'])->name('food-items.index');
    Route::post('/food-items', [FoodItemController::class, 'store'])->name('food-items.store');
    Route::put('/food-items/{item}', [FoodItemController::class, 'update'])->name('food-items.update');
    Route::delete('/food-items/{item}', [FoodItemController::class, 'destroy'])->name('food-items.destroy');
    Route::post('/food-items/{item}/toggle-status', [FoodItemController::class, 'toggleStatus'])->name('food-items.toggle-status');
    Route::post('/food-items/{item}/toggle-featured', [FoodItemController::class, 'toggleFeatured'])->name('food-items.toggle-featured');
    Route::post('/food-items/update-order', [FoodItemController::class, 'updateOrder'])->name('food-items.update-order');
    Route::put('/food-items/{item}/update-stock', [FoodItemController::class, 'updateStock'])->name('food-items.update-stock');
    Route::delete('/food-items/clear-all', [FoodItemController::class, 'clearAll'])->name('food-items.clear-all');

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
    Route::get('/roles', [RoleController::class, 'index'])->name('roles.index');
    Route::post('/roles/users', [RoleController::class, 'store'])->name('roles.users.store');
    Route::post('/roles/users/{user}/toggle-active', [RoleController::class, 'toggleActive'])->name('roles.users.toggle-active');
    Route::get('/settings', [SettingsController::class, 'index'])->name('settings.index');
    Route::post('/settings', [SettingsController::class, 'update'])->name('settings.update');
    Route::post('/settings/clear-cache', [SettingsController::class, 'clearCache'])->name('settings.clear-cache');
    Route::post('/settings/danger/{action}', [SettingsController::class, 'dangerAction'])->name('settings.danger');
});

// Inventory routes for admin, manager, cashier, and kitchen accounts
Route::middleware(['auth', 'verified', 'role:admin,resto_admin,resto,cashier,kitchen'])->prefix('admin')->name('admin.')->group(function () {
    Route::prefix('inventory')->name('inventory.')->group(function () {
        Route::get('/', [InventoryController::class, 'index'])->name('index');
        
        // Ingredients API
        Route::get('/ingredients', [InventoryController::class, 'getIngredients'])->name('ingredients');
        Route::post('/ingredients', [InventoryController::class, 'storeIngredient'])->name('ingredients.store');
        Route::put('/ingredients/{ingredient}', [InventoryController::class, 'updateIngredient'])->name('ingredients.update');
        Route::delete('/ingredients/{ingredient}', [InventoryController::class, 'deleteIngredient'])->name('ingredients.delete');
        Route::post('/bulk-update-stock', [InventoryController::class, 'bulkUpdateStock'])->name('bulk-update-stock');
        
        // Recipes
        Route::get('/items-with-recipes', [InventoryController::class, 'getItemsWithRecipes'])->name('items-with-recipes');
        Route::get('/items/{item}/recipe', [InventoryController::class, 'getItemRecipe'])->name('item-recipe');
        Route::post('/items/{item}/recipe', [InventoryController::class, 'saveRecipe'])->name('save-recipe');
        Route::get('/items/{item}/check-availability', [InventoryController::class, 'checkAvailability'])->name('check-availability');
        
        // Stock Management
        Route::post('/update-stock', [InventoryController::class, 'updateStock'])->name('update-stock');
        
        
        // Purchase Orders
        Route::get('/purchase-orders', [PurchaseOrderController::class, 'index'])->name('purchase-orders');
        Route::post('/purchase-orders', [PurchaseOrderController::class, 'store'])->name('purchase-orders.store');
        Route::get('/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->name('purchase-orders.show');
        Route::put('/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'update'])->name('purchase-orders.update');
        Route::post('/purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive'])->name('purchase-orders.receive');
        Route::delete('/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'destroy'])->name('purchase-orders.destroy');
        
        
        // Alerts
        Route::get('/low-stock-alerts', [InventoryController::class, 'getLowStockAlerts'])->name('low-stock-alerts');
        
        // Migration
        Route::post('/migrate-items', [InventoryController::class, 'migrateItems'])->name('migrate-items');
    });
});

// Cashier routes
Route::middleware(['auth', 'verified', 'role:resto,cashier,resto_admin,admin'])->prefix('cashier')->group(function () {
    Route::get('/', function () {
        return redirect('/cashier/dashboard');
    });

    Route::get('/dashboard', [CashierDashboardController::class, 'index'])->name('cashier.dashboard');
    
    Route::get('/pos', [PosController::class, 'index'])->name('cashier.pos');
    Route::post('/pos/orders', [PosController::class, 'store'])->name('cashier.pos.orders.store');
    Route::post('/orders/{order}/pay', [PosController::class, 'markAsPaid'])->name('cashier.orders.pay');
    Route::post('/orders/{order}/ready', [PosController::class, 'markAsReady'])->name('cashier.orders.ready');
    Route::post('/orders/{order}/preparing', [PosController::class, 'markAsPreparing'])->name('cashier.orders.preparing');
    Route::post('/orders/{order}/complete', [PosController::class, 'complete'])->name('cashier.orders.complete');
    Route::post('/orders/{order}/cancel', [PosController::class, 'cancel'])->name('cashier.orders.cancel');
    
    Route::get('/pos/menu-updates', [PosController::class, 'getMenuUpdates'])->name('cashier.pos.menu-updates');
    Route::get('/pos/order-updates', [PosController::class, 'getOrderUpdates'])->name('cashier.pos.order-updates');
    Route::get('/pos/menu-data', [PosController::class, 'getMenuData'])->name('cashier.pos.menu-data');
    Route::get('/pos/order-data', [PosController::class, 'getOrderData'])->name('cashier.pos.order-data');
});

// ==================== KITCHEN ROUTES ====================
// Kitchen staff and administrators can access the kitchen display
Route::middleware(['auth', 'verified', 'role:kitchen,admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::prefix('kitchen')->name('kitchen.')->group(function () {
        // Main kitchen display
        Route::get('/', [KitchenController::class, 'index'])->name('index');
        
        // Polling and real-time
        Route::get('/poll', [KitchenController::class, 'poll'])->name('poll');
        Route::get('/check-new', [KitchenController::class, 'checkNewOrders'])->name('check-new');
        Route::get('/test-alarm', [KitchenController::class, 'testAlarm'])->name('test-alarm');
        
        // Order status updates
        Route::put('/order/{sale}/status', [KitchenController::class, 'updateStatus'])->name('update-status');
        Route::put('/item/{saleItem}/status', [KitchenController::class, 'updateItemStatus'])->name('update-item-status');
        
// Kitchen actions
        Route::post('/orders/{order}/start', [KitchenController::class, 'startPreparing'])->name('start');
        Route::post('/orders/{order}/ready', [KitchenController::class, 'markReady'])->name('ready');
        Route::post('/orders/{order}/complete', [KitchenController::class, 'markComplete'])->name('complete');
    });
});

// Customer routes
Route::middleware(['auth', 'verified', 'role:customer'])->group(function () {
    Route::get('/menu', function () {
        return Inertia::render('Customer/Menu');
    });
});

// Add a GET logout route for convenience (optional)
Route::get('/logout', function () {
    Auth::logout();
    request()->session()->invalidate();
    request()->session()->regenerateToken();
    return redirect('/');
});