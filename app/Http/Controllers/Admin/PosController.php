<?php

// app/Http/Controllers/Admin/PosController.php

namespace App\Http\Controllers\Admin;

use App\Events\KitchenOrderCreated;
use App\Events\RestoOrderCreated;
use App\Http\Controllers\Controller;
use App\Models\CashSession;
use App\Models\CashierShift;
use App\Models\CashierShiftTransaction;
use App\Models\Category;
use App\Models\IngredientStock;
use App\Models\InventoryPool;
use App\Models\InventoryTransaction;
use App\Models\Item;
use App\Models\KitchenCategory;
use App\Models\KitchenItem;
use App\Models\PaymentMethod;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Setting;
use App\Services\TxnSequenceService;
use App\Traits\VATCalculations;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class PosController extends Controller
{
    use VATCalculations;

    private const LOW_STOCK_SERVING_THRESHOLD = 3;

    public function __construct(
        private TxnSequenceService $txnSequenceService
    ) {}

    public function index(Request $request)
    {
        $categories = $this->getPosCategories();
        $kitchenCategories = $this->getPosKitchenCategories();

        $paymentMethods = PaymentMethod::where('is_active', true)
            ->orderBy('name')
            ->get();

        // Get ready orders for payment
        $readyOrders = Sale::with(['customer', 'saleItems.item', 'saleItems.kitchenItem'])
            ->where('status', 'ready')
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($order) {
                $order->items_list = $order->saleItems->map(function ($saleItem) {
                    return $saleItem->item_name;
                })->implode(', ');

                return $order;
            });

        // Get pending/preparing orders (include kitchen status)
        $pendingOrders = Sale::with(['customer', 'paymentMethod', 'saleItems.item.category', 'saleItems.kitchenItem.category'])
            ->whereIn('status', ['pending', 'preparing', 'ready'])
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get()
            ->map(function ($order) {
                $order->items_list = $order->saleItems->map(function ($saleItem) {
                    return $saleItem->item_name;
                })->implode(', ');
                $order->formatted_total = '₱'.number_format($order->total_amount, 2);
                $order->formatted_time = $order->created_at->format('h:i A');

                // check against the database instead of looping manually; this
                // avoids edge cases where the category relation might be null or
                // the value has an unexpected type
                $hasKitchenItems = $this->saleHasKitchenItems((int) $order->id);

                $order->has_kitchen_items = $hasKitchenItems;
                $order->kitchen_status = $order->kitchen_status;
                $order->payment_method_name = $order->paymentMethod ? $order->paymentMethod->name : null;
                $order->room_number = $order->room_number ?? null;
                $order->txn_number = $order->txn_number;
                $order->order_number = $order->order_number;
                $order->order_type = $order->order_type;
                $order->is_unpaid = $order->order_type === 'dine_in'
                    && is_null($order->payment_method_id)
                    && is_null($order->paid_at)
                    && ! in_array($order->status, ['completed', 'cancelled']);

                return $order;
            });

        // Get success/error messages from session
        $success = session('success');
        $error = session('error');
        $orderData = session('order_data');

        // Get menu last updated timestamp for real-time checks
        $menuLastUpdated = cache()->get('menu_last_updated', 0);

        return Inertia::render('Admin/POS', [
            'categories' => $categories,
            'kitchenCategories' => $kitchenCategories,
            'paymentMethods' => $paymentMethods,
            'readyOrders' => $readyOrders,
            'pendingOrders' => $pendingOrders,
            'appName' => Setting::get('business_name') ?? 'CJ Brew & Dine',
            'menuLastUpdated' => $menuLastUpdated,
            'csrf_token' => csrf_token(),
            'flash' => [
                'success' => $success,
                'error' => $error,
                'order_data' => $orderData,
            ],
        ]);
    }

    // 🔥 REAL-TIME: Get menu updates (2-second polling with cache check)
    public function getMenuUpdates(Request $request)
    {
        $lastUpdate = (int) $request->get('last_update', 0);
        $currentUpdate = (int) cache()->get('menu_last_updated', 0);

        // Accept legacy millisecond timestamps from the frontend and normalize to seconds.
        if ($lastUpdate > 9999999999) {
            $lastUpdate = (int) floor($lastUpdate / 1000);
        }

        // If no changes since last check, return early
        if ($lastUpdate > 0 && $currentUpdate <= $lastUpdate) {
            return response()->json([
                'success' => true,
                'updated' => false,
                'timestamp' => now()->toDateTimeString(),
            ]);
        }

        $categories = $this->getPosCategories();
        $kitchenCategories = $this->getPosKitchenCategories();

        return response()->json([
            'success' => true,
            'updated' => true,
            'categories' => $categories,
            'kitchen_categories' => $kitchenCategories,
            'timestamp' => now()->toDateTimeString(),
            'menu_last_updated' => $currentUpdate,
        ]);
    }

    // 🔥 REAL-TIME: Get order updates (3-second polling)
    public function getOrderUpdates(Request $request)
    {
        $orders = Sale::with(['customer', 'paymentMethod', 'saleItems.item.category', 'saleItems.kitchenItem.category'])
            ->whereIn('status', ['pending', 'preparing', 'ready'])
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        $pendingOrders = [];

        foreach ($orders as $order) {
            $itemsList = $order->saleItems->map(function ($saleItem) {
                return $saleItem->item_name;
            })->implode(', ');

            // Build items array with kitchen_status
            $items = [];
            foreach ($order->saleItems as $saleItem) {
                if ($saleItem->kitchen_item_id || $saleItem->kitchen_status) {
                    $items[] = [
                        'id' => $saleItem->id,
                        'name' => $saleItem->item_name,
                        'quantity' => $saleItem->quantity,
                        'kitchen_status' => $saleItem->kitchen_status ?? 'pending',
                    ];
                }
            }

            // Check if all kitchen items are ready
            $kitchenSaleItems = $order->saleItems->filter(fn ($si) => ! is_null($si->kitchen_status));
            $allItemsReady = $kitchenSaleItems->isNotEmpty() && $kitchenSaleItems->every(
                fn ($si) => in_array($si->kitchen_status, ['ready', 'completed'])
            );

            // Determine if order has kitchen items
            $hasKitchenItems = $this->saleHasKitchenItems((int) $order->id);

            $paymentMethodName = $order->paymentMethod ? $order->paymentMethod->name : null;

            $pendingOrders[] = [
                'id' => $order->id,
                'txn_number' => $order->txn_number,
                'order_number' => $order->order_number,
                'total_amount' => $order->total_amount,
                'status' => $order->status,
                'kitchen_status' => $order->kitchen_status,
                'has_kitchen_items' => $hasKitchenItems,
                'all_items_ready' => $allItemsReady,
                'created_at' => $order->created_at,
                'customer_name' => $order->customer_name,
                'payment_method_name' => $paymentMethodName,
                'room_number' => $order->room_number ?? null,
                'items_list' => $itemsList,
                'items' => $items, // Add items with kitchen_status
                'formatted_total' => '₱'.number_format($order->total_amount, 2),
                'formatted_time' => $order->created_at->format('h:i A'),
                'order_type' => $order->order_type,
                'is_unpaid' => $order->order_type === 'dine_in'
                    && is_null($order->payment_method_id)
                    && is_null($order->paid_at)
                    && ! in_array($order->status, ['completed', 'cancelled']),
            ];
        }

        return response()->json([
            'success' => true,
            'pending_orders' => $pendingOrders,
            'timestamp' => now()->toDateTimeString(),
        ]);
    }

    // 🔥 REAL-TIME: Full menu data for manual refresh
    public function getMenuData(Request $request)
    {
        $categories = $this->getPosCategories();
        $kitchenCategories = $this->getPosKitchenCategories();

        return response()->json([
            'success' => true,
            'categories' => $categories,
            'kitchen_categories' => $kitchenCategories,
            'menu_last_updated' => cache()->get('menu_last_updated', 0),
        ]);
    }

    /**
     * Debug endpoint for inspecting a menu item's computed inventory state.
     * Kept intentionally lightweight and admin-only via route middleware.
     */
    public function debugItem(int $id)
    {
        $item = Item::with(['category', 'ingredients.stocks.pool'])->find($id);
        if (! $item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found',
            ], 404);
        }

        $poolCode = $this->resolveItemPoolCode($item, $item->category);
        $snapshot = $this->buildInventorySnapshot($item, $poolCode);

        return response()->json([
            'success' => true,
            'item' => [
                'id' => (int) $item->id,
                'name' => (string) $item->name,
                'menu_visibility' => $item->menu_visibility,
                'pool_code' => $poolCode,
                'inventory' => $snapshot,
            ],
            'ingredients' => $item->ingredients->map(function ($ingredient) use ($poolCode) {
                return [
                    'id' => (int) $ingredient->id,
                    'name' => (string) $ingredient->name,
                    'unit' => (string) ($ingredient->unit ?? ''),
                    'pivot_quantity_required' => (float) ($ingredient->pivot->quantity_required ?? 0),
                    'pivot_unit' => $ingredient->pivot->unit,
                    'available_in_pool' => $this->availableIngredientQuantityForPool($ingredient, $poolCode),
                ];
            })->values(),
        ]);
    }

    /**
     * Get kitchen categories with items for POS display
     */
    private function getPosKitchenCategories()
    {
        // Determine which menu visibility to show based on the authenticated user's role
        $role = optional(auth()->user())->role ?? 'admin';
        // Cashier sees ALL items — they take orders for both kitchens
        // kitchen/kitchen_resto only see their own items in POS (if they use POS at all)
        $visibilityFilter = match (true) {
            in_array($role, ['kitchen']) => ['kitchen', 'both'],
            in_array($role, ['kitchen_resto']) => ['resto', 'both'],
            default => ['resto', 'kitchen', 'both'], // cashier/admin/manager sees all
        };

        $kitchenCategories = KitchenCategory::with(['items' => function ($query) {
            $query->where('is_available', true)
                ->orderBy('sort_order', 'asc')
                ->orderBy('name');
        }])
            ->where('is_active', true)
            ->orderBy('sort_order', 'asc')
            ->orderBy('name')
            ->get();

        return $kitchenCategories->map(function ($category) {
            $items = $category->items->map(function ($item) {
                $poolCode = $this->resolveKitchenItemPoolCode($item);

                // Build inventory snapshot for kitchen items
                $inventory = $this->buildKitchenItemInventorySnapshot($item, $poolCode);
                $inventoryWhole = ($item->pricing_type ?? 'single') === 'dual'
                    ? $this->buildKitchenItemInventorySnapshot($item, $poolCode, 'whole')
                    : null;

                $item->setAttribute('inventory_pool_code', $poolCode);
                $item->setAttribute('inventory_status', $inventory['status']);
                $item->setAttribute('inventory_status_label', $inventory['label']);
                $item->setAttribute('inventory_available_servings', $inventory['available_servings']);
                $item->setAttribute('inventory_available_servings_whole', $inventoryWhole['available_servings'] ?? null);

                // Add source field to identify this as a kitchen item
                $item->setAttribute('source', 'kitchen');
                $item->setAttribute('is_kitchen_category', true);

                // Load size variants for drinks
                $item->load('sizes.size');
                $hasSizes = (bool) $item->has_sizes && $item->sizes->isNotEmpty();
                $item->setAttribute('size_variants', $hasSizes ? $item->getSizeVariantsForPosAttribute() : []);
                $item->unsetRelation('sizes');

                // Compact recipe map for kitchen items
                $recipe = [];
                foreach ($item->ingredients as $ingredient) {
                    $row = $this->buildRecipeRow($ingredient);
                    if (! $row) {
                        continue;
                    }
                    $recipe[] = $row;
                }
                $item->setAttribute('recipe', $recipe);
                $item->unsetRelation('ingredients');

                return $item;
            });

            $category->setRelation('items', $items);

            return $category;
        });
    }

    /**
     * Build inventory snapshot for kitchen items
     */
    private function buildKitchenItemInventorySnapshot(KitchenItem $item, string $poolCode = InventoryPool::KITCHEN, ?string $portion = null): array
    {
        if ($item->ingredients->isEmpty()) {
            return [
                'status' => 'no_recipe',
                'label' => 'No Recipe',
                'available_servings' => null,
            ];
        }

        $availableServings = null;

        foreach ($item->ingredients as $ingredient) {
            $required = $this->resolveIngredientRequiredQuantity($ingredient, $portion);
            if ($required <= 0) {
                continue;
            }

            $available = $this->availableIngredientQuantityForPool($ingredient, $poolCode);
            $requiredUnit = $this->resolvePivotUnit($ingredient);
            $stockUnit = (string) ($ingredient->unit ?? '');
            $piecesPerBox = ($ingredient->pieces_per_box > 0) ? (int) $ingredient->pieces_per_box : null;
            $requiredInStockUnit = $this->convertQuantity($required, $requiredUnit, $stockUnit, $piecesPerBox);
            $effectiveRequired = $requiredInStockUnit ?? $required;

            if ($effectiveRequired <= 0) {
                continue;
            }

            $servings = max(0, (int) floor($available / $effectiveRequired));
            $availableServings = $availableServings === null
                ? $servings
                : min($availableServings, $servings);
        }

        if ($availableServings === null) {
            return [
                'status' => 'no_recipe',
                'label' => 'No Recipe',
                'available_servings' => null,
            ];
        }

        if ($availableServings <= 0) {
            return [
                'status' => 'out',
                'label' => 'Out of Stock',
                'available_servings' => 0,
            ];
        }

        if ($availableServings <= self::LOW_STOCK_SERVING_THRESHOLD) {
            return [
                'status' => 'low',
                'label' => 'Low Stock',
                'available_servings' => $availableServings,
            ];
        }

        return [
            'status' => 'in',
            'label' => 'In Stock',
            'available_servings' => $availableServings,
        ];
    }

    private function getPosCategories()
    {
        // Determine which menu visibility to show based on the authenticated user's role
        $role = optional(auth()->user())->role ?? 'admin';
        // Cashier sees ALL items — they take orders for both kitchens
        $visibilityFilter = match (true) {
            in_array($role, ['kitchen']) => ['kitchen', 'both'],
            in_array($role, ['kitchen_resto']) => ['resto', 'both'],
            default => ['resto', 'kitchen', 'both'], // cashier/admin/manager sees all
        };

        $categories = Category::with(['items' => function ($query) use ($visibilityFilter) {
            $query->with(['ingredients.stocks.pool'])
                ->where('is_available', true)
                ->whereIn('menu_visibility', $visibilityFilter)
                ->orderBy('sort_order', 'asc')
                ->orderBy('name');
        }])
            ->where('is_active', true)
            ->orderBy('sort_order', 'asc')
            ->orderBy('name')
            ->get();

        return $categories->map(function ($category) {
            $items = $category->items->map(function ($item) use ($category) {
                $poolCode = $this->resolveItemPoolCode($item, $category);
                $inventory = $this->buildInventorySnapshot($item, $poolCode);
                $inventoryWhole = ($item->pricing_type ?? 'single') === 'dual'
                    ? $this->buildInventorySnapshotForPortion($item, $poolCode, 'whole')
                    : null;

                $item->setAttribute('inventory_pool_code', $poolCode);
                $item->setAttribute('inventory_status', $inventory['status']);
                $item->setAttribute('inventory_status_label', $inventory['label']);
                $item->setAttribute('inventory_available_servings', $inventory['available_servings']);
                $item->setAttribute('inventory_available_servings_whole', $inventoryWhole['available_servings'] ?? null);

                // Add source field to identify this as a resto item
                $item->setAttribute('source', 'resto');
                $item->setAttribute(
                    'is_kitchen_category',
                    (bool) ($category->is_kitchen_category ?? false) || ($item->menu_visibility ?? null) === 'kitchen'
                );

                // Compact recipe map: ingredient_id => quantity_per_serving in stock units
                // Used by the POS frontend to detect shared-ingredient conflicts across cart items
                $recipe = [];
                foreach ($item->ingredients as $ingredient) {
                    $row = $this->buildRecipeRow($ingredient);
                    if (! $row) {
                        continue;
                    }
                    $recipe[] = $row;
                }
                $item->setAttribute('recipe', $recipe);
                $item->unsetRelation('ingredients');

                return $item;
            });

            $category->setRelation('items', $items);

            return $category;
        });
    }

    private function resolveItemPoolCode(Item $item, ?Category $category = null): string
    {
        $poolCode = strtolower(trim((string) ($item->inventory_pool_code ?? '')));
        if (in_array($poolCode, [InventoryPool::RESTO, InventoryPool::KITCHEN], true)) {
            return $poolCode;
        }

        $resolvedCategory = $category;
        if (! $resolvedCategory && $item->relationLoaded('category')) {
            $resolvedCategory = $item->category;
        }
        if (! $resolvedCategory && ! empty($item->category_id)) {
            $resolvedCategory = Category::find($item->category_id);
        }

        if ($resolvedCategory && (bool) $resolvedCategory->is_kitchen_category) {
            return InventoryPool::KITCHEN;
        }

        return InventoryPool::RESTO;
    }

    private function resolveKitchenItemPoolCode(KitchenItem $item): string
    {
        $poolCode = strtolower(trim((string) ($item->inventory_pool_code ?? '')));
        if (in_array($poolCode, [InventoryPool::RESTO, InventoryPool::KITCHEN], true)) {
            return $poolCode;
        }

        return InventoryPool::KITCHEN;
    }

    private function availableIngredientQuantityForPool($ingredient, string $poolCode): float
    {
        return (float) optional(
            $ingredient->stocks->first(fn ($stock) => optional($stock->pool)->code === $poolCode)
        )->quantity;
    }

    private function buildInventorySnapshot(Item $item, string $poolCode): array
    {
        if ($item->ingredients->isEmpty()) {
            return [
                'status' => 'no_recipe',
                'label' => 'No Recipe',
                'available_servings' => null,
            ];
        }

        $availableServings = null;

        foreach ($item->ingredients as $ingredient) {
            $required = (float) ($ingredient->pivot->quantity_required ?? 0);
            if ($required <= 0) {
                // Dual-price items store quantities only in pivot->notes as [dual:solo:whole]
                $dualNotes = (string) ($ingredient->pivot->notes ?? '');
                if (! preg_match('/^\[dual:[\d.]+:[\d.]+\]/', $dualNotes)) {
                    continue;
                }
                preg_match('/^\[dual:([\d.]+):[\d.]+\]/', $dualNotes, $dualM);
                $required = (float) $dualM[1];
                if ($required <= 0) {
                    continue;
                }
            }

            $available = $this->availableIngredientQuantityForPool($ingredient, $poolCode);
            $requiredUnit = $this->resolvePivotUnit($ingredient);
            $stockUnit = (string) ($ingredient->unit ?? '');
            $piecesPerBox = ($ingredient->pieces_per_box > 0) ? (int) $ingredient->pieces_per_box : null;
            $requiredInStockUnit = $this->convertQuantity($required, $requiredUnit, $stockUnit, $piecesPerBox);
            $effectiveRequired = $requiredInStockUnit ?? $required;

            if ($effectiveRequired <= 0) {
                continue;
            }

            $servings = max(0, (int) floor($available / $effectiveRequired));
            $availableServings = $availableServings === null
                ? $servings
                : min($availableServings, $servings);
        }

        if ($availableServings === null) {
            return [
                'status' => 'no_recipe',
                'label' => 'No Recipe',
                'available_servings' => null,
            ];
        }

        if ($availableServings <= 0) {
            return [
                'status' => 'out',
                'label' => 'Out of Stock',
                'available_servings' => 0,
            ];
        }

        if ($availableServings <= self::LOW_STOCK_SERVING_THRESHOLD) {
            return [
                'status' => 'low',
                'label' => 'Low Stock',
                'available_servings' => $availableServings,
            ];
        }

        return [
            'status' => 'in',
            'label' => 'In Stock',
            'available_servings' => $availableServings,
        ];
    }

    private function resolveIngredientRequiredQuantity($ingredient, ?string $portion): float
    {
        $required = (float) ($ingredient->pivot->quantity_required ?? 0);
        if (! $portion) {
            return $required;
        }

        $notes = (string) ($ingredient->pivot->notes ?? '');
        if (preg_match('/^\[dual:([\d.]+):([\d.]+)\]\s*/', $notes, $m)) {
            return $portion === 'whole' ? (float) $m[2] : (float) $m[1];
        }

        return $required;
    }

    private function buildRecipeRow($ingredient): ?array
    {
        $required = (float) ($ingredient->pivot->quantity_required ?? 0);
        $notes = (string) ($ingredient->pivot->notes ?? '');
        $requiredUnit = $this->resolvePivotUnit($ingredient);
        $stockUnit = (string) ($ingredient->unit ?? '');
        $piecesPerBox = ($ingredient->pieces_per_box > 0) ? (int) $ingredient->pieces_per_box : null;

        if ($required <= 0 && ! preg_match('/^\[dual:([\d.]+):([\d.]+)\]\s*/', $notes)) {
            return null;
        }

        $soloQty = $required;
        $wholeQty = null;

        if (preg_match('/^\[dual:([\d.]+):([\d.]+)\]\s*/', $notes, $m)) {
            $soloQty = (float) $m[1];
            $wholeQty = (float) $m[2];
        }

        $soloConverted = $this->convertQuantity($soloQty, $requiredUnit, $stockUnit, $piecesPerBox) ?? $soloQty;
        $wholeConverted = null;
        if ($wholeQty !== null) {
            $wholeConverted = $this->convertQuantity($wholeQty, $requiredUnit, $stockUnit, $piecesPerBox) ?? $wholeQty;
        }

        return [
            'ingredient_id' => (int) $ingredient->id,
            'qty' => (float) $soloConverted,
            'qty_whole' => $wholeConverted !== null ? (float) $wholeConverted : null,
        ];
    }

    private function buildInventorySnapshotForPortion($item, string $poolCode, ?string $portion): array
    {
        if ($item->ingredients->isEmpty()) {
            return [
                'status' => 'no_recipe',
                'label' => 'No Recipe',
                'available_servings' => null,
            ];
        }

        $availableServings = null;

        foreach ($item->ingredients as $ingredient) {
            $required = $this->resolveIngredientRequiredQuantity($ingredient, $portion);
            if ($required <= 0) {
                continue;
            }

            $available = $this->availableIngredientQuantityForPool($ingredient, $poolCode);
            $requiredUnit = $this->resolvePivotUnit($ingredient);
            $stockUnit = (string) ($ingredient->unit ?? '');
            $piecesPerBox = ($ingredient->pieces_per_box > 0) ? (int) $ingredient->pieces_per_box : null;
            $requiredInStockUnit = $this->convertQuantity($required, $requiredUnit, $stockUnit, $piecesPerBox);
            $effectiveRequired = $requiredInStockUnit ?? $required;

            if ($effectiveRequired <= 0) {
                continue;
            }

            $servings = max(0, (int) floor($available / $effectiveRequired));
            $availableServings = $availableServings === null
                ? $servings
                : min($availableServings, $servings);
        }

        if ($availableServings === null) {
            return [
                'status' => 'no_recipe',
                'label' => 'No Recipe',
                'available_servings' => null,
            ];
        }

        if ($availableServings <= 0) {
            return [
                'status' => 'out',
                'label' => 'Out of Stock',
                'available_servings' => 0,
            ];
        }

        if ($availableServings <= self::LOW_STOCK_SERVING_THRESHOLD) {
            return [
                'status' => 'low',
                'label' => 'Low Stock',
                'available_servings' => $availableServings,
            ];
        }

        return [
            'status' => 'in',
            'label' => 'In Stock',
            'available_servings' => $availableServings,
        ];
    }

    private function effectiveAvailabilityForMenuItem($item, ?string $portion, string $poolCode): array
    {
        $inventory = $this->buildInventorySnapshotForPortion($item, $poolCode, $portion);
        $servings = $inventory['available_servings'] ?? null;

        if ($servings !== null) {
            return [
                'available' => max(0, (int) floor((float) $servings)),
                'unit' => 'serving',
            ];
        }

        if ($item->stock_quantity !== null) {
            return [
                'available' => max(0, (int) $item->stock_quantity),
                'unit' => 'item',
            ];
        }

        return [
            'available' => null,
            'unit' => 'item',
        ];
    }

    private function validateOrderStockAvailability(array $items): array
    {
        $requestedLines = [];

        foreach ($items as $line) {
            $itemId = (int) ($line['id'] ?? 0);
            $qty = (int) ($line['quantity'] ?? 0);
            $portion = isset($line['portion']) ? strtolower((string) $line['portion']) : null;
            $source = (string) ($line['source'] ?? 'resto');

            if ($itemId <= 0 || $qty <= 0) {
                continue;
            }

            $key = $source.':'.$itemId.':'.($portion ?: 'single');
            if (! isset($requestedLines[$key])) {
                $requestedLines[$key] = [
                    'id' => $itemId,
                    'quantity' => 0,
                    'portion' => $portion,
                    'source' => $source,
                ];
            }
            $requestedLines[$key]['quantity'] += $qty;
        }

        if (empty($requestedLines)) {
            return [];
        }

        $restoIds = [];
        $kitchenIds = [];
        foreach ($requestedLines as $line) {
            if (($line['source'] ?? 'resto') === 'kitchen') {
                $kitchenIds[] = (int) $line['id'];
            } else {
                $restoIds[] = (int) $line['id'];
            }
        }

        $menuItems = empty($restoIds)
            ? collect()
            : Item::with(['category', 'ingredients.stocks.pool'])
                ->whereIn('id', array_unique($restoIds))
                ->get()
                ->keyBy('id');

        $kitchenItems = empty($kitchenIds)
            ? collect()
            : KitchenItem::with(['ingredients.stocks.pool'])
                ->whereIn('id', array_unique($kitchenIds))
                ->get()
                ->keyBy('id');

        $issues = [];

        foreach ($requestedLines as $line) {
            $source = (string) ($line['source'] ?? 'resto');
            $requestedQty = (int) ($line['quantity'] ?? 0);
            $portion = $line['portion'] ?? null;

            $item = $source === 'kitchen'
                ? $kitchenItems->get($line['id'])
                : $menuItems->get($line['id']);

            if (! $item) {
                continue;
            }

            if ((bool) $item->is_available === false) {
                $issues[] = [
                    'type' => 'unavailable',
                    'name' => (string) $item->name,
                ];

                continue;
            }

            $poolCode = $source === 'kitchen'
                ? $this->resolveKitchenItemPoolCode($item)
                : $this->resolveItemPoolCode($item, $item->category);
            $availability = $this->effectiveAvailabilityForMenuItem($item, $portion, $poolCode);
            $available = $availability['available'];

            if ($available !== null && $requestedQty > $available) {
                $issues[] = [
                    'type' => 'insufficient',
                    'name' => (string) $item->name,
                    'requested' => (int) $requestedQty,
                    'available' => (int) $available,
                    'unit' => (string) $availability['unit'],
                ];
            }
        }

        return $issues;
    }

    private function effectiveAvailabilityForItem(Item $item): array
    {
        return $this->effectiveAvailabilityForMenuItem($item, null, $this->resolveItemPoolCode($item, $item->category));
    }

    private function formatOrderStockIssues(array $issues): string
    {
        $lines = ['Insufficient stock for requested items:'];

        foreach ($issues as $issue) {
            if (($issue['type'] ?? '') === 'unavailable') {
                $lines[] = '- '.$issue['name'].' is currently unavailable.';

                continue;
            }

            $available = (int) ($issue['available'] ?? 0);
            $unit = (string) ($issue['unit'] ?? 'item');
            $unitLabel = $available === 1 ? $unit : $unit.'s';

            $lines[] = sprintf(
                '- %s: requested %d, available %d %s.',
                (string) ($issue['name'] ?? 'Item'),
                (int) ($issue['requested'] ?? 0),
                $available,
                $unitLabel
            );
        }

        return implode("\n", $lines);
    }

    // 🔥 REAL-TIME: Full order data for manual refresh
    public function getOrderData(Request $request)
    {
        $orders = Sale::with(['customer', 'paymentMethod', 'saleItems.item.category', 'saleItems.kitchenItem.category'])
            ->whereIn('status', ['pending', 'preparing', 'ready'])
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        $pendingOrders = [];

        foreach ($orders as $order) {
            $itemsList = $order->saleItems->map(function ($saleItem) {
                return $saleItem->item_name;
            })->implode(', ');

            // Check if order has kitchen items using a dedicated query
            $hasKitchenItems = $this->saleHasKitchenItems((int) $order->id);

            // Get payment method name
            $paymentMethodName = $order->paymentMethod ? $order->paymentMethod->name : null;

            $pendingOrders[] = [
                'id' => $order->id,
                'txn_number' => $order->txn_number,
                'order_number' => $order->order_number,
                'total_amount' => $order->total_amount,
                'status' => $order->status,
                'kitchen_status' => $order->kitchen_status,
                'has_kitchen_items' => $hasKitchenItems,
                'created_at' => $order->created_at,
                'customer_name' => $order->customer_name,
                'payment_method_name' => $paymentMethodName,
                'room_number' => $order->room_number ?? null,
                'items_list' => $itemsList,
                'formatted_total' => '₱'.number_format($order->total_amount, 2),
                'formatted_time' => $order->created_at->format('h:i A'),
                'order_type' => $order->order_type,
                'is_unpaid' => $order->order_type === 'dine_in'
                    && is_null($order->payment_method_id)
                    && is_null($order->paid_at)
                    && ! in_array($order->status, ['completed', 'cancelled']),
            ];
        }

        return response()->json([
            'success' => true,
            'pending_orders' => $pendingOrders,
        ]);
    }

    private function kitchenSaleItemsQuery(int $saleId)
    {
        // All sale items go to kitchen (both resto and kitchen items need to be prepared)
        return SaleItem::where('sale_id', $saleId);
    }

    private function saleHasKitchenItems(int $saleId): bool
    {
        return $this->kitchenSaleItemsQuery($saleId)->exists();
    }

    private function isKitchenSaleItem(SaleItem $saleItem): bool
    {
        // All items (both resto and kitchen) go to the kitchen for preparation
        return true;
    }

    private function kitchenItemIdsForOrder(array $itemIds): array
    {
        if (empty($itemIds)) {
            return [];
        }

        $hasKitchenCategories = Category::where('is_kitchen_category', 1)->exists();

        if (! $hasKitchenCategories) {
            Log::warning('No kitchen categories configured; treating ordered items as kitchen items.', [
                'item_ids' => $itemIds,
            ]);

            return array_values(array_unique(array_map('intval', $itemIds)));
        }

        // All items go to kitchen regardless of menu_visibility (resto or kitchen)
        return Item::whereIn('id', $itemIds)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->toArray();
    }

    public function store(Request $request)
    {
        try {
            $isPersonal = (bool) $request->input('is_personal', false);
            // Detect pay-later dine-in orders BEFORE validation so we can relax the
            // payment_method_id rule accordingly.
            $isPayLater = $request->input('order_type') === 'dine_in'
                && (bool) $request->input('pay_later', false);
            $cashierShift = null;

            // Cashier users must be checked in to an open shift before creating sales.
            $user = Auth::user();
            if ($user && $user->role === 'cashier') {
                $cashierShift = CashierShift::where('user_id', $user->id)
                    ->where('status', 'open')
                    ->latest('check_in_time')
                    ->first();

                if (! $cashierShift) {
                    return response()->json([
                        'success' => false,
                        'error' => 'No open shift found. Please check in first.',
                    ], 409);
                }
            }

            // Get available payment method IDs from database for validation
            $availablePaymentMethodIds = PaymentMethod::where('is_active', true)->pluck('id')->toArray();

            // Log available payment methods for debugging
            Log::info('Available payment method IDs:', ['ids' => $availablePaymentMethodIds]);

            // If payment methods exist in DB, validate against them; otherwise accept any integer
            $paymentMethodRule = 'required|integer';
            if (! empty($availablePaymentMethodIds)) {
                $paymentMethodRule = 'required|integer|in:'.implode(',', $availablePaymentMethodIds);
                Log::info('Using strict payment method validation with IDs:', $availablePaymentMethodIds);
            } else {
                Log::warning('No active payment methods found in database - using relaxed validation');
            }

            $validated = $request->validate([
                'items' => 'required|array|min:1',
                'items.*.id' => 'required',
                'items.*.quantity' => 'required|integer|min:1',
                'items.*.price' => 'required|numeric|min:0',
                'items.*.name' => 'required|string',
                'items.*.portion' => 'nullable|in:solo,whole',
                'items.*.notes' => 'nullable|string',
                'items.*.source' => 'nullable|in:resto,kitchen',
                'items.*.size_name' => 'nullable|string|max:50',
                'items.*.temperature' => 'nullable|in:hot,iced',
                'order_type' => 'required|in:dine_in,takeout,delivery',
                'customer_name' => 'nullable|string|max:255',
                'room_number' => 'nullable|string|max:20',
                'people_count' => 'required|integer|min:1|max:20',
                'cards_presented' => 'required|integer|min:0|max:20',
                'customer_phone' => 'nullable|string|max:20',
                'customer_address' => 'nullable|string|max:500',
                'notes' => 'nullable|string|max:1000',
                'discount_type' => 'nullable|in:none,percentage,fixed',
                'discount_value' => 'nullable|numeric|min:0',
                'is_personal' => 'nullable|boolean',
                'is_employee' => 'nullable|boolean',
                'service_charge' => 'nullable|numeric|min:0',
                'cash_received' => 'nullable|numeric|min:0',
                'change_due' => 'nullable|numeric|min:0',
                'employee_discount_amount' => 'nullable|numeric|min:0',
                'payment_method_id' => ($isPersonal || $isPayLater) ? 'nullable|integer' : $paymentMethodRule,
                'pay_later' => 'nullable|boolean',
            ]);

            Log::info('POS order creation started', [
                'user_id' => Auth::id(),
                'order_type' => $validated['order_type'] ?? null,
                'item_lines' => count($validated['items'] ?? []),
                'is_personal' => $isPersonal,
            ]);

            DB::beginTransaction();

            $stockIssues = $this->validateOrderStockAvailability($validated['items']);
            if (! empty($stockIssues)) {
                DB::rollBack();
                throw new \Exception($this->formatOrderStockIssues($stockIssues));
            }

            $subtotal = collect($validated['items'])->sum(function ($item) {
                return $item['price'] * $item['quantity'];
            });

            Log::info('Subtotal calculated:', ['subtotal' => $subtotal]);

            // Employee discount (computed on frontend)
            $employeeDiscount = 0;
            if (! empty($validated['is_employee'])) {
                $employeeDiscount = (float) ($validated['employee_discount_amount'] ?? 0);
            }

            // Card discount (20% per card) applies after employee discount
            $cardDiscount = 0;
            $afterEmployeeDiscount = $subtotal - $employeeDiscount;
            if ($validated['cards_presented'] > 0 && $validated['people_count'] > 0) {
                $cardDiscount = ($afterEmployeeDiscount * 0.20) / $validated['people_count'] * $validated['cards_presented'];
                $cardDiscount = round($cardDiscount, 2);
            }

            // Additional discount applies after employee + card discounts
            $additionalDiscount = 0;
            $afterCardDiscount = $afterEmployeeDiscount - $cardDiscount;
            if (isset($validated['discount_type']) && $validated['discount_type'] !== 'none' && $validated['discount_value'] > 0) {
                if ($validated['discount_type'] === 'percentage') {
                    $additionalDiscount = ($afterCardDiscount * $validated['discount_value']) / 100;
                } elseif ($validated['discount_type'] === 'fixed') {
                    $additionalDiscount = $validated['discount_value'];
                }
                $additionalDiscount = round($additionalDiscount, 2);
            }

            $totalDiscount = $employeeDiscount + $cardDiscount + $additionalDiscount;
            $afterAllDiscounts = $subtotal - $totalDiscount;
            $serviceCharge = (float) ($validated['service_charge'] ?? 0);
            $totalAmount = $afterAllDiscounts + $serviceCharge;

            // Calculate VAT breakdown
            $vatBreakdown = $this->calculateVATBreakdown(
                $validated['items'],
                $subtotal,
                $totalDiscount,
                $serviceCharge,
                12 // tax rate
            );

            // Personal/free orders are always ₱0
            if ($isPersonal) {
                $totalAmount = 0;
                $totalDiscount = $subtotal;
                $serviceCharge = 0;
            }

            // determine which item IDs are considered kitchen items using a single query
            $itemIds = collect($validated['items'])->pluck('id')->toArray();

            Log::info('Item IDs from order:', ['item_ids' => $itemIds]);

            $kitchenItemIds = $this->kitchenItemIdsForOrder($itemIds);

            $hasKitchenSourceItems = collect($validated['items'])
                ->contains(fn ($line) => ($line['source'] ?? null) === 'kitchen');
            $hasKitchenItems = $hasKitchenSourceItems || count($kitchenItemIds) > 0;

            // Get category info for each item to debug
            $itemsWithCategories = Item::with('category')
                ->whereIn('id', $itemIds)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'name' => $item->name,
                        'category' => $item->category ? $item->category->name : 'no category',
                        'is_kitchen_category' => $item->category ? $item->category->is_kitchen_category : false,
                    ];
                });

            Log::info('Items with categories:', ['items' => $itemsWithCategories->toArray()]);
            Log::info('Kitchen item detection', [
                'item_ids' => $itemIds,
                'kitchen_item_ids' => $kitchenItemIds,
                'has_kitchen_items' => $hasKitchenItems,
            ]);

            // Determine initial status based on kitchen items
            $initialStatus = $hasKitchenItems ? 'pending' : 'completed';
            $initialKitchenStatus = $hasKitchenItems ? 'pending' : null;

            Log::info('Initial status determination:', [
                'has_kitchen_items' => $hasKitchenItems,
                'initialStatus' => $initialStatus,
                'initialKitchenStatus' => $initialKitchenStatus,
            ]);

            // Log before creating sale
            Log::info('========== BEFORE SALE CREATE ==========');
            Log::info('room_number to save:', ['room_number' => $validated['room_number'] ?? null]);

            $sale = $this->createSaleWithDailyTxn([
                'user_id' => Auth::id(),
                'cashier_shift_id' => $cashierShift?->id,
                'subtotal' => $subtotal,
                'discount_amount' => $totalDiscount,
                'service_charge_amount' => $serviceCharge,
                'total_amount' => $totalAmount,
                'status' => $initialStatus,
                'kitchen_status' => $initialKitchenStatus,
                'order_type' => $validated['order_type'],
                'people_count' => $validated['people_count'],
                'cards_presented' => $validated['cards_presented'],
                'customer_name' => $validated['customer_name'] ?? null,
                'room_number' => $validated['room_number'] ?? null,
                'customer_phone' => $validated['customer_phone'] ?? null,
                'customer_address' => $validated['customer_address'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'discount_type' => $validated['discount_type'] ?? 'none',
                'discount_value' => $validated['discount_value'] ?? 0,
                'payment_method_id' => ($isPersonal || $isPayLater) ? null : $validated['payment_method_id'],
                'paid_at' => $isPayLater ? null : (!$hasKitchenItems ? now() : null),
                'cash_received' => $validated['cash_received'] ?? null,
                'change_due' => $validated['change_due'] ?? null,
                'vatable_total' => $vatBreakdown['vatable_total'],
                'vat_exempt_total' => $vatBreakdown['vat_exempt_total'],
                'zero_rated_total' => $vatBreakdown['zero_rated_total'],
                'vat_amount' => $vatBreakdown['vat_amount'],
            ]);

            // Log after creating sale
            Log::info('========== AFTER SALE CREATE ==========');
            Log::info('Created sale:', [
                'id' => $sale->id,
                'room_number' => $sale->room_number,
                'customer_name' => $sale->customer_name,
                'status' => $sale->status,
                'kitchen_status' => $sale->kitchen_status,
            ]);

            foreach ($validated['items'] as $item) {
                // Determine item source: explicit source tells us which table it comes from
                $source = $item['source'] ?? null;
                $isKitchenSource = ($source === 'kitchen');

                // Items from the regular menu can still be "kitchen" by category.
                // Treat them as kitchen for status/queueing, but keep item_id to avoid FK issues.
                $isKitchenCategoryItem = ! $isKitchenSource && in_array($item['id'], $kitchenItemIds, true);
                $isKitchenItem = $isKitchenSource || $isKitchenCategoryItem;

                $saleItemData = [
                    'sale_id' => $sale->id,
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['price'],
                    'total_price' => $item['price'] * $item['quantity'],
                    'special_instructions' => SaleItem::applyPortionPrefix(
                        $this->buildSpecialInstructions($item),
                        $item['portion'] ?? null
                    ),
                ];

                if ($isKitchenSource) {
                    // KitchenItem rows go to the resto (beverage) kitchen display.
                    // The kitchen_resto role handles all drink/beverage items.
                    $saleItemData['kitchen_item_id'] = $item['id'];
                    $saleItemData['kitchen_status'] = 'pending';
                    $saleItemData['kitchen_type'] = 'resto';
                } else {
                    // Regular Item model row — determine which kitchen by menu_visibility
                    $saleItemData['item_id'] = $item['id'];
                    $saleItemData['kitchen_status'] = 'pending';

                    // Items with menu_visibility='both' or 'kitchen' go to kitchen
                    // Items with menu_visibility='resto' or 'both' go to resto kitchen (kitchen_resto role)
                    $itemVisibility = Item::where('id', $item['id'])->value('menu_visibility') ?? 'both';

                    // For 'both' visibility, we default to 'resto' kitchen_type
                    // The KitchenOrderController's isKitchenSaleItemForRole method handles routing to both kitchens
                    // based on the original item's menu_visibility
                    if ($itemVisibility === 'kitchen') {
                        $saleItemData['kitchen_type'] = 'kitchen';
                    } elseif ($itemVisibility === 'resto') {
                        $saleItemData['kitchen_type'] = 'resto';
                    } else {
                        // 'both' visibility - assign to both kitchens by defaulting to 'resto'
                        // KitchenOrderController will show it in both views based on menu_visibility
                        $saleItemData['kitchen_type'] = 'resto';
                    }

                    Log::info('POS Item kitchen routing', [
                        'item_id' => $item['id'],
                        'item_name' => $item['name'],
                        'menu_visibility' => $itemVisibility,
                        'assigned_kitchen_type' => $saleItemData['kitchen_type'],
                    ]);
                }

                $saleItem = SaleItem::create($saleItemData);

                Log::info('Created sale item:', [
                    'sale_item_id' => $saleItem->id,
                    'item_id' => $item['id'],
                    'item_name' => $item['name'],
                    'is_kitchen_item' => $isKitchenItem,
                    'source' => $source,
                    'kitchen_source' => $isKitchenSource,
                    'kitchen_status' => $saleItem->kitchen_status ?? 'not set',
                ]);

            }

            // after sale items are created double-check the status in case the
            // initial detection missed something (e.g. category relationship was
            // null or cast weirdly). this extra query guarantees the order will
            // appear on the kitchen display whenever any of its items are
            // flagged as kitchen items.
            if (! $hasKitchenItems) {
                $actualKitchen = $this->saleHasKitchenItems((int) $sale->id);

                if ($actualKitchen) {
                    $hasKitchenItems = true;
                    $sale->update([
                        'status' => 'pending',
                        'kitchen_status' => 'pending',
                        'paid_at' => null, // make sure it's not marked paid prematurely
                    ]);
                    Log::info('Re‑flagged order as having kitchen items after creation', [
                        'order_id' => $sale->id,
                        'new_status' => 'pending',
                        'new_kitchen_status' => 'pending',
                    ]);
                }
            }

            // After creating sale items, deduct inventory
            try {
                $this->deductInventory($sale);
            } catch (\Exception $e) {
                DB::rollBack();
                Log::error('Inventory deduction failed: '.$e->getMessage());
                throw $e; // Re-throw to be caught by outer catch
            }

            // Calculate and save COGS data
            try {
                $sale->saveCostData();
                Log::info('COGS calculated for order #'.$sale->id, [
                    'total_cost' => $sale->total_cost,
                    'gross_profit' => $sale->gross_profit,
                    'profit_margin' => $sale->profit_margin,
                ]);
            } catch (\Exception $e) {
                Log::error('COGS calculation failed for order #'.$sale->id.': '.$e->getMessage());
                // Don't fail the order, just log the error
            }

            // Generate and save invoice number
            try {
                $invoiceNumber = $sale->generateInvoiceNumber();
                $sale->update(['invoice_number' => $invoiceNumber]);
                Log::info('Invoice number generated for order #'.$sale->id.': '.$invoiceNumber);
            } catch (\Exception $e) {
                Log::error('Invoice number generation failed for order #'.$sale->id.': '.$e->getMessage());
                // Don't fail the order, just log the error
            }

            DB::commit();

            // Broadcast order created events
            $sale->load(['saleItems', 'paymentMethod']);
            if ($hasKitchenItems) {
                event(new KitchenOrderCreated($sale));
            } else {
                event(new RestoOrderCreated($sale));
            }

            // Update menu last updated timestamp
            cache()->put('menu_last_updated', time(), 3600);

            $successMessage = '✅ Order #'.$sale->id.' placed successfully!';
            if ($hasKitchenItems) {
                $successMessage .= ' Kitchen items sent to kitchen.';
            } else {
                $successMessage .= ' Order completed.';
            }

            Log::info('========== ORDER CREATED SUCCESSFULLY ==========', [
                'order_id' => $sale->id,
                'final_status' => $sale->status,
                'final_kitchen_status' => $sale->kitchen_status,
                'has_kitchen_items' => $hasKitchenItems,
            ]);

            // Build receipt data for new order
            $sale->load(['saleItems.item', 'saleItems.kitchenItem', 'paymentMethod', 'user']);
            $receiptItems = $sale->saleItems->map(function ($saleItem) {
                $itemName = $saleItem->item_name ??
                           optional($saleItem->item)->name ??
                           optional($saleItem->kitchenItem)->name ??
                           'Unknown Item';

                return [
                    'name' => $itemName,
                    'quantity' => (int) $saleItem->quantity,
                    'price' => (float) $saleItem->unit_price,
                    'subtotal' => (float) ($saleItem->unit_price * $saleItem->quantity),
                ];
            })->values()->toArray();

            $settings = Setting::getMany([
                'business_name',
                'business_tagline',
                'address',
                'receipt_header',
                'receipt_footer',
            ]);

            $receiptData = [
                'order_id' => $sale->id,
                'txn_number' => $sale->txn_number,
                'invoice_number' => $sale->invoice_number,
                'date' => $sale->created_at->format('Y-m-d H:i:s'),
                'created_at' => $sale->created_at->format('Y-m-d H:i:s'),
                'cashier' => $sale->user?->name ?? 'Unknown',
                'subtotal' => (float) $sale->subtotal,
                'discount' => (float) $sale->discount_amount,
                'discount_amount' => (float) $sale->discount_amount,
                'service_charge' => (float) $sale->service_charge_amount,
                'service_charge_amount' => (float) $sale->service_charge_amount,
                'total' => (float) $totalAmount,
                'total_amount' => (float) $totalAmount,
                'payment_method' => $sale->paymentMethod?->name ?? 'N/A',
                'cash_received' => $sale->cash_received ? (float) $sale->cash_received : null,
                'change_due' => $sale->change_due ? (float) $sale->change_due : null,
                'receipt_header' => $settings['receipt_header'] ?? 'THANK YOU FOR DINING!',
                'receipt_footer' => $settings['receipt_footer'] ?? 'Please come again',
                'items' => $receiptItems,
            ];

            return redirect()->route('admin.pos.index')->with([
                'success' => $successMessage,
                'order_data' => [
                    'order_id' => $sale->id,
                    'total' => $totalAmount,
                    'discount' => $totalDiscount,
                    'order_number' => $sale->order_number,
                    'txn_number' => $sale->txn_number,
                    'has_kitchen_items' => $hasKitchenItems,
                    'pay_later' => $isPayLater,
                ],
                'receipt' => $isPayLater ? null : $receiptData,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('========== ORDER FAILED ==========');
            Log::error('Error: '.$e->getMessage());

            return redirect()->route('admin.pos.index')->with([
                'error' => '❌ Failed to place order: '.$e->getMessage(),
            ]);
        }
    }

    public function markAsPaid(Request $request, Sale $sale)
{
    try {
        $validated = $request->validate([
            'payment_method_id' => 'required|integer',
            'cash_received'     => 'nullable|numeric|min:0',
            'change_due'        => 'nullable|numeric|min:0',
        ]);

        DB::beginTransaction();

        $updateData = [
            'payment_method_id' => $validated['payment_method_id'],
            'cash_received'     => $validated['cash_received'] ?? null,
            'change_due'        => $validated['change_due'] ?? null,
        ];

        // Only add paid_at if the column exists
        if (Schema::hasColumn('sales', 'paid_at')) {
            $updateData['paid_at'] = now();
        }

        $sale->update($updateData);

        DB::commit();

        // Your existing response code...
        
        return response()->json([
            'success' => true,
            'message' => 'Payment recorded for Order #'.$sale->id,
            // ... rest of response
        ]);

    } catch (\Exception $e) {
        DB::rollBack();

        \Log::error('markAsPaid failed', [
            'order_id' => $sale->id ?? null,
            'error' => $e->getMessage(),
        ]);

        return response()->json([
            'success' => false,
            'error' => $e->getMessage(),
        ], 500);
    }
}

    /**
     * Cancel/void an order and restore previously deducted inventory.
     */
    public function cancel(Request $request, Sale $order)
    {
        try {
            DB::beginTransaction();

            if ($order->status === 'cancelled') {
                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Order #'.$order->id.' is already cancelled.',
                ]);
            }

            $this->restockInventory($order, 'order_cancelled');

            $order->update([
                'status' => 'cancelled',
                'kitchen_status' => 'cancelled',
            ]);

            DB::commit();

            cache()->put('menu_last_updated', time(), 3600);

            // Build receipt for cancelled order
            $order->load(['saleItems.item', 'saleItems.kitchenItem', 'paymentMethod', 'user']);

            $receiptItems = $order->saleItems->map(function ($saleItem) {
                $itemName = $saleItem->item_name ??
                            optional($saleItem->item)->name ??
                            optional($saleItem->kitchenItem)->name ??
                            'Unknown Item';

                return [
                    'name' => $itemName,
                    'quantity' => (int) $saleItem->quantity,
                    'price' => (float) $saleItem->unit_price,
                    'subtotal' => (float) ($saleItem->unit_price * $saleItem->quantity),
                ];
            })->values()->toArray();

            $settings = Setting::getMany([
                'business_name', 'business_tagline', 'address',
                'receipt_header', 'receipt_footer',
                'tax_rate', 'service_charge', 'show_tax', 'show_service_charge',
            ]);

            $receiptData = [
                'order_number' => $order->order_number,
                'txn_number' => $order->txn_number,
                'created_at' => $order->created_at->format('M d, Y h:i A'),
                'status' => 'cancelled',
                'business_name' => $settings['business_name'] ?? Setting::get('business_name') ?? 'CJ Brew & Dine',
                'business_tagline' => $settings['business_tagline'] ?? null,
                'business_address' => $settings['address'] ?? null,
                'receipt_header' => $settings['receipt_header'] ?? 'THANK YOU FOR DINING!',
                'receipt_footer' => $settings['receipt_footer'] ?? 'Please come again',
                'customer_name' => $order->customer_name ?? 'Walk-in Customer',
                'cashier_name' => optional($order->user)->name ?? '—',
                'room_number' => $order->room_number ?? null,
                'payment_method' => optional($order->paymentMethod)->name ?? 'Cash',
                'cash_received' => $order->cash_received !== null ? (float) $order->cash_received : null,
                'change_due' => $order->change_due !== null ? (float) $order->change_due : null,
                'subtotal' => (float) ($order->subtotal ?? 0),
                'discount_amount' => (float) ($order->discount_amount ?? 0),
                'service_charge_amount' => (float) ($order->service_charge_amount ?? 0),
                'service_charge_rate' => (int) ($settings['service_charge'] ?? 10),
                'tax_rate' => (int) ($settings['tax_rate'] ?? 12),
                'items' => $receiptItems,
                'show_tax' => (bool) ($settings['show_tax'] ?? true),
                'show_service_charge' => (bool) ($settings['show_service_charge'] ?? true),
                'vat_exempt_sales' => 0.00,
                'zero_rated_sales' => 0.00,
            ];

            return response()->json([
                'success' => true,
                'message' => 'Order #'.$order->id.' cancelled and stock restored.',
                'receipt' => $receiptData,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to cancel order', [
                'order_id' => $order->id ?? null,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function markAsReady(Request $request, Sale $sale)
    {
        try {
            if (in_array($sale->status, ['completed', 'cancelled'])) {
                return redirect()->route('admin.pos.index')->with('error',
                    '❌ Cannot mark order #'.$sale->id.' as ready — it is already '.$sale->status.'.');
            }

            $sale->update([
                'status' => 'ready',
            ]);

            return redirect()->route('admin.pos.index')->with('success', '✅ Order #'.$sale->id.' marked as ready for payment!');

        } catch (\Exception $e) {
            return redirect()->route('admin.pos.index')->with('error', '❌ Failed to mark as ready: '.$e->getMessage());
        }
    }

    public function markAsPreparing(Request $request, Sale $sale)
    {
        try {
            $sale->update([
                'status' => 'preparing',
                'kitchen_status' => 'preparing',
            ]);

            return redirect()->route('admin.pos.index')->with('success', '✅ Order #'.$sale->id.' marked as preparing!');

        } catch (\Exception $e) {
            return redirect()->route('admin.pos.index')->with('error', '❌ Failed to mark as preparing: '.$e->getMessage());
        }
    }

    /**
     * Kitchen marks order as ready
     */
    public function kitchenReady(Request $request, Sale $order)
    {
        try {
            DB::beginTransaction();

            $order->update([
                'status' => 'ready',
                'kitchen_status' => 'ready',
            ]);

            // Update all kitchen items to ready
            $kitchenItems = $this->kitchenSaleItemsQuery((int) $order->id)->get();

            foreach ($kitchenItems as $item) {
                $item->update([
                    'kitchen_status' => 'ready',
                ]);
            }

            DB::commit();

            // Update cache to trigger POS refresh
            cache()->put('menu_last_updated', time(), 3600);

            return response()->json([
                'success' => true,
                'message' => 'Order #'.$order->id.' is ready',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('Kitchen ready failed: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Complete an order (mark as completed) - FIXED for database compatibility
     */
    public function complete(Request $request, Sale $order)
    {
        try {
            Log::info('Starting complete order', [
                'order_id' => $order->id,
                'current_status' => $order->status,
                'kitchen_status' => $order->kitchen_status,
            ]);

            if ($order->status === 'completed') {
                return response()->json([
                    'success' => false,
                    'error' => 'Order #'.$order->id.' is already completed.',
                ], 422);
            }

            $cashierShift = null;
            $user = Auth::user();
            if ($user && $user->role === 'cashier') {
                $cashierShift = CashierShift::where('user_id', $user->id)
                    ->where('status', 'open')
                    ->latest('check_in_time')
                    ->first();

                if (! $cashierShift) {
                    return response()->json([
                        'success' => false,
                        'error' => 'No open shift found. Please check in first.',
                    ], 409);
                }

                if ((int) $order->cashier_shift_id !== (int) $cashierShift->id) {
                    return response()->json([
                        'success' => false,
                        'error' => 'Order is not part of your current shift.',
                    ], 409);
                }
            }

            DB::beginTransaction();

            // Check if order has kitchen items by looking at the items directly
            $hasKitchenItems = false;
            $allKitchenItemsReady = true;
            $unreadyItems = [];

            // Get all sale items for this order
            $saleItems = SaleItem::with(['item.category', 'kitchenItem.category'])
                ->where('sale_id', $order->id)
                ->get();

            foreach ($saleItems as $saleItem) {
                $isKitchen = $this->isKitchenSaleItem($saleItem);

                if ($isKitchen) {
                    $hasKitchenItems = true;

                    // Check if this kitchen item is ready
                    $itemStatus = $saleItem->kitchen_status ?? 'pending';
                    if ($itemStatus !== 'ready' && $itemStatus !== 'completed') {
                        $allKitchenItemsReady = false;
                        $itemName = optional($saleItem->item)->name ?? optional($saleItem->kitchenItem)->name ?? 'Unknown Item';
                        $unreadyItems[] = $itemName.' ('.$itemStatus.')';
                    }
                }
            }

            // If order has kitchen items and they're not all ready, prevent completion
            if ($hasKitchenItems && ! $allKitchenItemsReady) {
                $errorMessage = 'Cannot complete order - kitchen items not ready: '.implode(', ', $unreadyItems);
                Log::warning($errorMessage);
                throw new \Exception($errorMessage);
            }

            // Update order status - only update columns that exist
            $updateData = [
                'status' => 'completed',
                'kitchen_status' => 'completed',
            ];

            // Add payment details if provided in request
            if ($request->has('payment_method_id')) {
                $updateData['payment_method_id'] = $request->payment_method_id;
            }

            if ($request->has('cash_received')) {
                $updateData['cash_received'] = $request->cash_received;
            }

            if ($request->has('change_due')) {
                $updateData['change_due'] = $request->change_due;
            }

            // Guard against environments where this column has not been migrated yet
            if (Schema::hasColumn('sales', 'completed_at')) {
                $updateData['completed_at'] = now();
            } else {
                Log::info('completed_at column does not exist, skipping');
            }

            $order->update($updateData);

            // Record this completed sale as a shift transaction (idempotent via unique sale_id).
            if ($cashierShift) {
                CashierShiftTransaction::firstOrCreate(
                    ['sale_id' => $order->id],
                    [
                        'shift_id' => $cashierShift->id,
                        'type' => 'sale',
                        'amount' => (float) $order->total_amount,
                        'description' => null,
                        'source' => 'pos',
                    ]
                );
            }

            // Update all kitchen items to completed
            $this->kitchenSaleItemsQuery((int) $order->id)
                ->update([
                    'kitchen_status' => 'completed',
                    'kitchen_completed_at' => now(),
                ]);

            // Calculate and save COGS data
            try {
                $order->saveCostData();
                Log::info('COGS calculated for completed order #'.$order->id, [
                    'total_cost' => $order->total_cost,
                    'gross_profit' => $order->gross_profit,
                    'profit_margin' => $order->profit_margin,
                ]);
            } catch (\Exception $e) {
                Log::error('COGS calculation failed for order #'.$order->id.': '.$e->getMessage());
            }

            Log::info('Kitchen items marked as completed for order', ['order_id' => $order->id]);

            DB::commit();

            // Update cache
            cache()->put('menu_last_updated', time(), 3600);

            Log::info('Order completed successfully', ['order_id' => $order->id]);

            // Reload order with full relationships for receipt
            $order->load([
                'saleItems.item',
                'saleItems.kitchenItem',
                'paymentMethod',
                'user', // cashier
            ]);

            // Format items for receipt
            $receiptItems = $order->saleItems->map(function ($saleItem) {
                $itemName = $saleItem->item_name ??
                           optional($saleItem->item)->name ??
                           optional($saleItem->kitchenItem)->name ??
                           'Unknown Item';

                return [
                    'name' => $itemName,
                    'quantity' => (int) $saleItem->quantity,
                    'price' => (float) $saleItem->unit_price,
                    'subtotal' => (float) ($saleItem->unit_price * $saleItem->quantity),
                ];
            })->values()->toArray();

            // Get settings from database
            $settings = Setting::getMany([
                'business_name',
                'business_tagline',
                'address',
                'receipt_header',
                'receipt_footer',
                'tax_rate',
                'service_charge',
                'show_tax',
                'show_service_charge',
            ]);

            // Build receipt data
            $receiptData = [
                // Order info
                'order_number' => $order->order_number,
                'txn_number' => $order->txn_number,
                'created_at' => $order->created_at->format('M d, Y h:i A'),
                'status' => $order->status,
                // Business info
                'business_name' => $settings['business_name'] ?? Setting::get('business_name') ?? 'CJ Brew & Dine',
                'business_tagline' => $settings['business_tagline'] ?? null,
                'business_address' => $settings['address'] ?? null,
                // Header/Footer
                'receipt_header' => $settings['receipt_header'] ?? 'THANK YOU FOR DINING!',
                'receipt_footer' => $settings['receipt_footer'] ?? 'Please come again',
                // Customer info
                'customer_name' => $order->customer_name ?? 'Walk-in Customer',
                'cashier_name' => optional($order->user)->name ?? '—',
                'room_number' => $order->room_number ?? null,
                // Payment info
                'payment_method' => optional($order->paymentMethod)->name ?? 'Cash',
                'cash_received' => $order->cash_received !== null ? (float) $order->cash_received : null,
                'change_due' => $order->change_due !== null ? (float) $order->change_due : null,
                // Financial data
                'subtotal' => (float) $order->subtotal,
                'discount_amount' => (float) ($order->discount_amount ?? 0),
                'service_charge_amount' => (float) ($order->service_charge_amount ?? 0),
                'service_charge_rate' => (int) ($settings['service_charge'] ?? 10),
                'tax_rate' => (int) ($settings['tax_rate'] ?? 12),
                // Items
                'items' => $receiptItems,
                // Display flags
                'show_tax' => (bool) ($settings['show_tax'] ?? true),
                'show_service_charge' => (bool) ($settings['show_service_charge'] ?? true),
                // VAT breakdown
                'vat_exempt_sales' => 0.00,
                'zero_rated_sales' => 0.00,
            ];

            return response()->json([
                'success' => true,
                'message' => 'Order #'.$order->id.' completed successfully!',
                'receipt' => $receiptData,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('Failed to complete order', [
                'order_id' => $order->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get receipt data for a completed order (for reprinting)
     */
    public function getReceipt(Request $request, Sale $order)
    {
        // Allow receipt for completed or cancelled orders
        if (! in_array($order->status, ['completed', 'cancelled'])) {
            return response()->json([
                'success' => false,
                'error' => 'Order is not completed yet',
            ], 400);
        }

        $order->load([
            'saleItems.item',
            'saleItems.kitchenItem',
            'paymentMethod',
            'user',
        ]);

        $receiptItems = $order->saleItems->map(function ($saleItem) {
            $itemName = $saleItem->item_name ??
                       optional($saleItem->item)->name ??
                       optional($saleItem->kitchenItem)->name ??
                       'Unknown Item';

            return [
                'name' => $itemName,
                'quantity' => (int) $saleItem->quantity,
                'price' => (float) $saleItem->unit_price,
                'subtotal' => (float) ($saleItem->unit_price * $saleItem->quantity),
            ];
        })->values()->toArray();

        $settings = Setting::getMany([
            'business_name',
            'business_tagline',
            'address',
            'receipt_header',
            'receipt_footer',
            'tax_rate',
            'service_charge',
            'show_tax',
            'show_service_charge',
        ]);

        return response()->json([
            'success' => true,
            'receipt' => [
                'order_number' => $order->order_number,
                'txn_number' => $order->txn_number,
                'created_at' => $order->created_at->format('M d, Y h:i A'),
                'status' => $order->status,
                'business_name' => $settings['business_name'] ?? Setting::get('business_name') ?? 'CJ Brew & Dine',
                'business_tagline' => $settings['business_tagline'] ?? null,
                'business_address' => $settings['address'] ?? null,
                'receipt_header' => $settings['receipt_header'] ?? 'THANK YOU FOR DINING!',
                'receipt_footer' => $settings['receipt_footer'] ?? 'Please come again',
                'customer_name' => $order->customer_name ?? 'Walk-in Customer',
                'cashier_name' => optional($order->user)->name ?? '—',
                'room_number' => $order->room_number ?? null,
                'payment_method' => optional($order->paymentMethod)->name ?? 'Cash',
                'cash_received' => $order->cash_received !== null ? (float) $order->cash_received : null,
                'change_due' => $order->change_due !== null ? (float) $order->change_due : null,
                'subtotal' => (float) $order->subtotal,
                'discount_amount' => (float) ($order->discount_amount ?? 0),
                'service_charge_amount' => (float) ($order->service_charge_amount ?? 0),
                'service_charge_rate' => (int) ($settings['service_charge'] ?? 10),
                'tax_rate' => (int) ($settings['tax_rate'] ?? 12),
                'items' => $receiptItems,
                'show_tax' => (bool) ($settings['show_tax'] ?? true),
                'show_service_charge' => (bool) ($settings['show_service_charge'] ?? true),
            ],
        ]);
    }

    /**
     * Handle inventory deduction based on recipe ingredients
     */
    private function deductInventory(Sale $sale)
    {
        $saleItems = SaleItem::with([
            'item.ingredients',
            'item.category',
            'kitchenItem.ingredients',
        ])->where('sale_id', $sale->id)->get();
        $poolIdsByCode = InventoryPool::pluck('id', 'code')->map(fn ($id) => (int) $id)->all();
        $defaultPoolId = (int) ($poolIdsByCode[InventoryPool::RESTO] ?? 1);

        $requirements = [];
        $insufficientStock = [];

        foreach ($saleItems as $saleItem) {
            $item = $saleItem->item ?? $saleItem->kitchenItem;
            if (! $item) {
                continue;
            }

            // Skip if item has no recipe
            if (! $item->ingredients || $item->ingredients->isEmpty()) {
                Log::warning("Item {$item->name} has no recipe defined");

                continue;
            }

            $portion = SaleItem::extractPortion($saleItem->special_instructions);
            $poolCode = $saleItem->kitchen_item_id
                ? strtolower(trim((string) ($item->inventory_pool_code ?? InventoryPool::RESTO)))
                : $this->resolveItemPoolCode($item);
            $writePoolCode = in_array($poolCode, [InventoryPool::RESTO, InventoryPool::KITCHEN], true)
                ? $poolCode
                : InventoryPool::RESTO;
            $poolId = (int) ($poolIdsByCode[$writePoolCode] ?? $defaultPoolId);

            foreach ($item->ingredients as $ingredient) {
                $requiredPerServing = $this->resolveIngredientRequiredQuantity($ingredient, $portion);
                $requiredRaw = (float) $requiredPerServing * (float) $saleItem->quantity;
                $piecesPerBox = (int) ($ingredient->pieces_per_box > 0 ? $ingredient->pieces_per_box : null);
                $requiredQuantity = $this->convertQuantity(
                    $requiredRaw,
                    $this->resolvePivotUnit($ingredient),
                    (string) ($ingredient->unit ?? ''),
                    $piecesPerBox
                ) ?? $requiredRaw;
                if ((float) $requiredQuantity <= 0) {
                    continue;
                }

                $key = $ingredient->id.':'.$poolId;

                if (! isset($requirements[$key])) {
                    $requirements[$key] = [
                        'ingredient' => $ingredient,
                        'quantity' => 0.0,
                        'inventory_pool_id' => $poolId,
                        'pool_code' => $writePoolCode,
                    ];
                }
                $requirements[$key]['quantity'] += (float) $requiredQuantity;
            }
        }

        $deductions = [];
        foreach ($requirements as $data) {
            $ingredient = $data['ingredient'];
            $ingredientId = (int) $ingredient->id;
            $poolId = (int) $data['inventory_pool_id'];
            $poolCode = (string) $data['pool_code'];

            $stock = IngredientStock::where('ingredient_id', $ingredientId)
                ->where('inventory_pool_id', $poolId)
                ->lockForUpdate()
                ->first();

            $available = (float) optional($stock)->quantity;
            $required = (float) $data['quantity'];
            if ($required <= 0) {
                continue;
            }

            if ($available < $required) {
                $insufficientStock[] = [
                    'ingredient' => $ingredient->name,
                    'required' => $required,
                    'available' => $available,
                    'unit' => $ingredient->unit,
                    'pool_code' => $poolCode,
                ];

                continue;
            }

            $deductions[] = [
                'ingredient_id' => (int) $ingredientId,
                'ingredient_name' => $ingredient->name,
                'quantity' => $required,
                'stock' => $stock,
                'unit' => $ingredient->unit,
                'inventory_pool_id' => $poolId,
                'pool_code' => $poolCode,
            ];
        }

        if (! empty($insufficientStock)) {
            $message = "Insufficient ingredients:\n";
            foreach ($insufficientStock as $issue) {
                $message .= "- Need {$issue['required']} {$issue['unit']} of {$issue['ingredient']} in {$issue['pool_code']} pool (only {$issue['available']} available)\n";
            }
            throw new \Exception(trim($message));
        }

        foreach ($deductions as $data) {
            /** @var \App\Models\IngredientStock $stock */
            $stock = $data['stock'];
            $stock->quantity = max(0, (float) $stock->quantity - (float) $data['quantity']);
            $stock->save();

            InventoryTransaction::create([
                'ingredient_id' => $data['ingredient_id'],
                'inventory_pool_id' => $data['inventory_pool_id'],
                'quantity_delta' => -1 * (float) $data['quantity'],
                'reason' => 'order_deduction',
                'reference_type' => 'sale',
                'reference_id' => $sale->id,
                'user_id' => Auth::id(),
                'notes' => 'Automatic deduction on order placement',
                'meta' => [
                    'sale_id' => $sale->id,
                    'pool_code' => $data['pool_code'],
                ],
            ]);

            Log::info('Inventory deducted', [
                'ingredient' => $data['ingredient_name'],
                'deducted' => $data['quantity'],
                'new_quantity' => $stock->quantity,
                'pool_code' => $data['pool_code'],
                'sale_id' => $sale->id,
            ]);
        }

        return $deductions;
    }

    /**
     * Restore deducted inventory for a cancelled/voided order.
     */
    private function restockInventory(Sale $sale, string $reason): void
    {
        $transactions = InventoryTransaction::where('reference_type', 'sale')
            ->where('reference_id', $sale->id)
            ->where('reason', 'order_restock')
            ->exists();

        // Guard against double-restock on repeated cancellation calls
        $alreadyRestocked = InventoryTransaction::where('reference_type', 'sale')
            ->where('reference_id', $sale->id)
            ->where('reason', 'order_restock')
            ->exists();

        if ($alreadyRestocked) {
            Log::info('Restock skipped — order already restocked', ['sale_id' => $sale->id]);

            return;
        }

        $deductionTransactions = InventoryTransaction::where('reference_type', 'sale')
            ->where('reference_id', $sale->id)
            ->where('reason', 'order_deduction')
            ->select('ingredient_id', 'inventory_pool_id', DB::raw('SUM(quantity_delta) as total_delta'))
            ->groupBy('ingredient_id', 'inventory_pool_id')
            ->get();

        if ($deductionTransactions->isEmpty()) {
            $this->restockFromSaleRecipeFallback($sale, $reason);

            return;
        }

        foreach ($deductionTransactions as $tx) {
            $deductedAmount = abs((float) $tx->total_delta);
            if ($deductedAmount <= 0) {
                continue;
            }

            $stock = IngredientStock::where('ingredient_id', $tx->ingredient_id)
                ->where('inventory_pool_id', $tx->inventory_pool_id)
                ->lockForUpdate()
                ->first();

            if (! $stock) {
                $stock = IngredientStock::create([
                    'ingredient_id' => $tx->ingredient_id,
                    'inventory_pool_id' => $tx->inventory_pool_id,
                    'quantity' => 0,
                    'min_stock' => 0,
                    'cost_per_unit' => 0,
                ]);
            }

            $stock->quantity = (float) $stock->quantity + $deductedAmount;
            $stock->save();

            InventoryTransaction::create([
                'ingredient_id' => $tx->ingredient_id,
                'inventory_pool_id' => $tx->inventory_pool_id,
                'quantity_delta' => $deductedAmount,
                'reason' => 'order_restock',
                'reference_type' => 'sale',
                'reference_id' => $sale->id,
                'user_id' => Auth::id(),
                'notes' => 'Automatic restock on order cancellation/void',
                'meta' => [
                    'sale_id' => $sale->id,
                    'source_reason' => $reason,
                ],
            ]);
        }
    }

    /**
     * Fallback restock logic if no historical deduction rows exist.
     */
    private function restockFromSaleRecipeFallback(Sale $sale, string $reason): void
    {
        $saleItems = SaleItem::with([
            'item.ingredients',
            'item.category',
            'kitchenItem.ingredients',
        ])->where('sale_id', $sale->id)->get();
        $poolIdsByCode = InventoryPool::pluck('id', 'code')->map(fn ($id) => (int) $id)->all();
        $defaultPoolId = (int) ($poolIdsByCode[InventoryPool::RESTO] ?? 1);
        $restocks = [];

        foreach ($saleItems as $saleItem) {
            $item = $saleItem->item ?? $saleItem->kitchenItem;
            if (! $item || ! $item->ingredients || $item->ingredients->isEmpty()) {
                continue;
            }

            $portion = SaleItem::extractPortion($saleItem->special_instructions);
            $poolCode = $saleItem->kitchen_item_id
                ? strtolower(trim((string) ($item->inventory_pool_code ?? InventoryPool::RESTO)))
                : $this->resolveItemPoolCode($item);
            $writePoolCode = in_array($poolCode, [InventoryPool::RESTO, InventoryPool::KITCHEN], true)
                ? $poolCode
                : InventoryPool::RESTO;
            $poolId = (int) ($poolIdsByCode[$writePoolCode] ?? $defaultPoolId);

            foreach ($item->ingredients as $ingredient) {
                $requiredPerServing = $this->resolveIngredientRequiredQuantity($ingredient, $portion);
                $qtyRaw = (float) $requiredPerServing * (float) $saleItem->quantity;
                $piecesPerBox = (int) ($ingredient->pieces_per_box > 0 ? $ingredient->pieces_per_box : null);
                $qty = $this->convertQuantity(
                    $qtyRaw,
                    $this->resolvePivotUnit($ingredient),
                    (string) ($ingredient->unit ?? ''),
                    $piecesPerBox
                ) ?? $qtyRaw;
                if ($qty <= 0) {
                    continue;
                }

                $key = $ingredient->id.':'.$poolId;
                if (! isset($restocks[$key])) {
                    $restocks[$key] = [
                        'ingredient_id' => (int) $ingredient->id,
                        'inventory_pool_id' => $poolId,
                        'pool_code' => $writePoolCode,
                        'quantity' => 0.0,
                    ];
                }
                $restocks[$key]['quantity'] += $qty;
            }
        }

        foreach ($restocks as $row) {
            $stock = IngredientStock::where('ingredient_id', $row['ingredient_id'])
                ->where('inventory_pool_id', $row['inventory_pool_id'])
                ->lockForUpdate()
                ->first();

            if (! $stock) {
                $stock = IngredientStock::create([
                    'ingredient_id' => $row['ingredient_id'],
                    'inventory_pool_id' => $row['inventory_pool_id'],
                    'quantity' => 0,
                    'min_stock' => 0,
                    'cost_per_unit' => 0,
                ]);
            }

            $stock->quantity = (float) $stock->quantity + (float) $row['quantity'];
            $stock->save();

            InventoryTransaction::create([
                'ingredient_id' => $row['ingredient_id'],
                'inventory_pool_id' => $row['inventory_pool_id'],
                'quantity_delta' => (float) $row['quantity'],
                'reason' => 'order_restock',
                'reference_type' => 'sale',
                'reference_id' => $sale->id,
                'user_id' => Auth::id(),
                'notes' => 'Fallback restock on order cancellation/void',
                'meta' => [
                    'sale_id' => $sale->id,
                    'source_reason' => $reason,
                    'pool_code' => $row['pool_code'],
                    'fallback' => true,
                ],
            ]);
        }
    }

    /**
     * Build the special_instructions string for a sale item line.
     * Encodes size and temperature variants so the kitchen display can parse them.
     * Format: "[size:Grande][temp:iced] <user notes>"
     */
    private function buildSpecialInstructions(array $item): ?string
    {
        $parts = [];

        $size = trim((string) ($item['size_name'] ?? $item['size'] ?? ''));
        $temp = strtolower(trim((string) ($item['temperature'] ?? $item['temp'] ?? '')));

        if ($size !== '') {
            $parts[] = "[size:{$size}]";
        }
        if (in_array($temp, ['hot', 'iced'], true)) {
            $parts[] = "[temp:{$temp}]";
        }

        $notes = trim((string) ($item['notes'] ?? ''));
        if ($notes !== '') {
            $parts[] = $notes;
        }

        return $parts ? implode(' ', $parts) : null;
    }

    /**
     * Resolve the effective "from" unit for a recipe pivot row.
     * When pivot->unit is NULL the quantity was entered in the ingredient's
     * own stock unit, so no conversion is needed — return the stock unit.
     */
    private function resolvePivotUnit($ingredient): string
    {
        $pivotUnit = trim((string) ($ingredient->pivot->unit ?? ''));

        return $pivotUnit !== '' ? $pivotUnit : trim((string) ($ingredient->unit ?? ''));
    }

    private function convertQuantity(float $quantity, ?string $fromUnit, ?string $toUnit, ?int $piecesPerBox = null): ?float
    {
        $from = $this->normalizeUnit($fromUnit);
        $to = $this->normalizeUnit($toUnit);

        if ($from === '' || $to === '' || $from === $to) {
            return $quantity;
        }

        // Handle box to piece conversion using pieces_per_box
        if (($from === 'box' || $from === 'pack') && $to === 'piece' && $piecesPerBox !== null && $piecesPerBox > 0) {
            return $quantity * $piecesPerBox;
        }

        // Handle piece to box conversion using pieces_per_box
        if ($from === 'piece' && ($to === 'box' || $to === 'pack') && $piecesPerBox !== null && $piecesPerBox > 0) {
            return $quantity / $piecesPerBox;
        }

        if ($from === 'g' && $to === 'kg') {
            return $quantity / 1000;
        }

        if ($from === 'kg' && $to === 'g') {
            return $quantity * 1000;
        }

        if ($from === 'ml' && $to === 'l') {
            return $quantity / 1000;
        }

        if ($from === 'l' && $to === 'ml') {
            return $quantity * 1000;
        }

        return null;
    }

    private function normalizeUnit(?string $unit): string
    {
        $normalized = strtolower(trim((string) $unit));

        return match ($normalized) {
            'gram', 'grams', 'gm', 'gms' => 'g',
            'kilogram', 'kilograms', 'kgs' => 'kg',
            'liter', 'litre', 'liters', 'litres', 'ltr', 'ltrs' => 'l',
            'milliliter', 'millilitre', 'milliliters', 'millilitres', 'mls' => 'ml',
            'pcs', 'pc', 'pieces' => 'piece',
            'box', 'boxes' => 'box',
            'pack', 'packs' => 'pack',
            default => $normalized,
        };
    }

    /**
     * Open a new cash session/shift
     */
    public function openCashSession(Request $request)
    {
        $request->validate([
            'opening_float' => 'required|numeric|min:0',
        ]);

        try {
            // Check if there's already an open session for this user
            $existingSession = CashSession::where('user_id', Auth::id())
                ->where('status', 'open')
                ->first();

            if ($existingSession) {
                return response()->json([
                    'success' => false,
                    'error' => 'You already have an open cash session. Please close it first.',
                ], 400);
            }

            // Create new cash session
            $session = CashSession::create([
                'user_id' => Auth::id(),
                'opening_float' => $request->opening_float,
                'opened_at' => now(),
                'status' => 'open',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Cash session opened successfully',
                'session' => [
                    'id' => $session->id,
                    'opening_float' => $session->opening_float,
                    'opened_at' => $session->opened_at->format('Y-m-d H:i:s'),
                    'status' => $session->status,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Error opening cash session: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'error' => 'Failed to open cash session. Please try again.',
            ], 500);
        }
    }

    /**
     * Close the current cash session/shift
     */
    public function closeCashSession(Request $request)
    {
        $request->validate([
            'closing_cash' => 'required|numeric|min:0',
        ]);

        try {
            // Get the current open session for this user
            $session = CashSession::where('user_id', Auth::id())
                ->where('status', 'open')
                ->first();

            if (! $session) {
                return response()->json([
                    'success' => false,
                    'error' => 'No open cash session found.',
                ], 404);
            }

            // Calculate total sales for this session
            $totalSales = Sale::where('user_id', Auth::id())
                ->where('created_at', '>=', $session->opened_at)
                ->where('status', 'completed')
                ->sum('total_amount');

            // Calculate expected cash (opening float + cash sales)
            $cashSales = Sale::where('user_id', Auth::id())
                ->where('created_at', '>=', $session->opened_at)
                ->where('status', 'completed')
                ->whereHas('paymentMethod', function ($q) {
                    $q->where('name', 'Cash');
                })
                ->sum('total_amount');

            $expectedCash = $session->opening_float + $cashSales;
            $variance = $request->closing_cash - $expectedCash;

            // Update session
            $session->update([
                'closing_cash' => $request->closing_cash,
                'total_sales' => $totalSales,
                'expected_cash' => $expectedCash,
                'variance' => $variance,
                'closed_at' => now(),
                'status' => 'closed',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Cash session closed successfully',
                'session' => [
                    'id' => $session->id,
                    'opening_float' => $session->opening_float,
                    'closing_cash' => $session->closing_cash,
                    'total_sales' => $totalSales,
                    'expected_cash' => $expectedCash,
                    'variance' => $variance,
                    'opened_at' => $session->opened_at->format('Y-m-d H:i:s'),
                    'closed_at' => $session->closed_at->format('Y-m-d H:i:s'),
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Error closing cash session: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'error' => 'Failed to close cash session. Please try again.',
            ], 500);
        }
    }

    /**
     * Get current open session for the user
     */
    public function getCurrentSession(Request $request)
    {
        $session = CashSession::where('user_id', Auth::id())
            ->where('status', 'open')
            ->first();

        if (! $session) {
            return response()->json([
                'success' => true,
                'session' => null,
            ]);
        }

        return response()->json([
            'success' => true,
            'session' => [
                'id' => $session->id,
                'opening_float' => $session->opening_float,
                'opened_at' => $session->opened_at->format('Y-m-d H:i:s'),
                'status' => $session->status,
            ],
        ]);
    }

    private function buildDailyTxnData(): array
    {
        return $this->txnSequenceService->getNextSequence();
    }

    private function createSaleWithDailyTxn(array $attributes): Sale
    {
        $maxAttempts = 5;
        $lastException = null;

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                return DB::transaction(function () use ($attributes) {
                    $txnData = $this->buildDailyTxnData();

                    return Sale::create(array_merge($attributes, $txnData));
                });
            } catch (QueryException $e) {
                $lastException = $e;

                $message = strtolower((string) $e->getMessage());
                $isUniqueConstraint = str_contains($message, 'sales_txn_number_unique')
                    || str_contains($message, 'sales_txn_date_sequence_unique')
                    || (string) $e->getCode() === '23000';

                if (! $isUniqueConstraint || $attempt >= $maxAttempts) {
                    throw $e;
                }

                Log::warning('Transaction number collision, retrying...', [
                    'attempt' => $attempt,
                    'max_attempts' => $maxAttempts,
                ]);

                usleep(50000); // 50ms delay before retry
            }
        }

        throw $lastException ?? new \RuntimeException('Failed to allocate daily transaction number.');
    }
}