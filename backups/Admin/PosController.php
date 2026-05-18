<?php
// app/Http/Controllers/Admin/PosController.php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\IngredientStock;
use App\Models\InventoryPool;
use App\Models\Item;
use App\Models\InventoryTransaction;
use App\Models\PaymentMethod;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Auth;

class PosController extends Controller
{
    private const LOW_STOCK_SERVING_THRESHOLD = 3;

    public function index(Request $request)
    {
        $categories = $this->getPosCategories();

        $paymentMethods = PaymentMethod::where('is_active', true)
            ->orderBy('name')
            ->get();

        // Get ready orders for payment
        $readyOrders = Sale::with(['customer', 'saleItems.item'])
            ->where('status', 'ready')
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function($order) {
                $order->items_list = $order->saleItems->map(function($saleItem) {
                    return $saleItem->item->name ?? 'Unknown Item';
                })->implode(', ');
                return $order;
            });

        // Get pending/preparing orders (include kitchen status)
        $pendingOrders = Sale::with(['customer', 'paymentMethod', 'saleItems.item.category'])
            ->whereIn('status', ['pending', 'preparing', 'ready'])
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get()
            ->map(function($order) {
                $order->items_list = $order->saleItems->map(function($saleItem) {
                    return $saleItem->item->name ?? 'Unknown Item';
                })->implode(', ');
                $order->formatted_total = '₱' . number_format($order->total_amount, 2);
                $order->formatted_time = $order->created_at->format('h:i A');
                
                // check against the database instead of looping manually; this
                // avoids edge cases where the category relation might be null or
                // the value has an unexpected type
                $hasKitchenItems = $this->saleHasKitchenItems((int) $order->id);

                $order->has_kitchen_items = $hasKitchenItems;
                $order->kitchen_status = $order->kitchen_status;
                $order->payment_method_name = $order->paymentMethod ? $order->paymentMethod->name : null;
                $order->room_number = $order->room_number ?? null;
                
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
            'paymentMethods' => $paymentMethods,
            'readyOrders' => $readyOrders,
            'pendingOrders' => $pendingOrders,
            'appName' => config('app.name', 'CJ Brew & Dine'),
            'menuLastUpdated' => $menuLastUpdated,
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

        return response()->json([
            'success' => true,
            'updated' => true,
            'categories' => $categories,
            'timestamp' => now()->toDateTimeString(),
            'menu_last_updated' => $currentUpdate,
        ]);
    }

    // 🔥 REAL-TIME: Get order updates (3-second polling)
    public function getOrderUpdates(Request $request)
    {
        $orders = Sale::with(['customer', 'paymentMethod', 'saleItems.item.category'])
            ->whereIn('status', ['pending', 'preparing', 'ready'])
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();
        
        $pendingOrders = [];
        
        foreach ($orders as $order) {
            $itemsList = $order->saleItems->map(function($saleItem) {
                return $saleItem->item->name ?? 'Unknown Item';
            })->implode(', ');
            
            // Check if order has kitchen items using DB query
            $hasKitchenItems = $this->saleHasKitchenItems((int) $order->id);
            
            // Get payment method name
            $paymentMethodName = $order->paymentMethod ? $order->paymentMethod->name : null;
            
            $pendingOrders[] = [
                'id' => $order->id,
                'total_amount' => $order->total_amount,
                'status' => $order->status,
                'kitchen_status' => $order->kitchen_status,
                'has_kitchen_items' => $hasKitchenItems,
                'created_at' => $order->created_at,
                'customer_name' => $order->customer_name,
                'payment_method_name' => $paymentMethodName,
                'room_number' => $order->room_number ?? null,
                'items_list' => $itemsList,
                'formatted_total' => '₱' . number_format($order->total_amount, 2),
                'formatted_time' => $order->created_at->format('h:i A'),
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

        return response()->json([
            'success' => true,
            'categories' => $categories,
            'menu_last_updated' => cache()->get('menu_last_updated', 0),
        ]);
    }

    private function getPosCategories()
    {
        $categories = Category::with(['items' => function($query) {
            $query->with(['ingredients.stocks.pool'])
                ->where('is_available', true)
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

                $item->setAttribute('inventory_pool_code', $poolCode);
                $item->setAttribute('inventory_status', $inventory['status']);
                $item->setAttribute('inventory_status_label', $inventory['label']);
                $item->setAttribute('inventory_available_servings', $inventory['available_servings']);

                // Compact recipe map: ingredient_id => quantity_per_serving in stock units
                // Used by the POS frontend to detect shared-ingredient conflicts across cart items
                $recipe = [];
                foreach ($item->ingredients as $ingredient) {
                    $required = (float) ($ingredient->pivot->quantity_required ?? 0);
                    if ($required <= 0) continue;
                    $requiredUnit = (string) ($ingredient->pivot->unit ?? $ingredient->unit ?? '');
                    $stockUnit    = (string) ($ingredient->unit ?? '');
                    $piecesPerBox = ($ingredient->pieces_per_box > 0) ? (int) $ingredient->pieces_per_box : null;
                    $converted    = $this->convertQuantity($required, $requiredUnit, $stockUnit, $piecesPerBox);
                    $recipe[] = [
                        'ingredient_id' => (int) $ingredient->id,
                        'qty'           => (float) ($converted ?? $required),
                    ];
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
        if (!empty($item->inventory_pool_code)) {
            return (string) $item->inventory_pool_code;
        }

        $isKitchenCategory = $category
            ? (bool) $category->is_kitchen_category
            : (bool) optional($item->category)->is_kitchen_category;

        return $isKitchenCategory ? InventoryPool::KITCHEN : InventoryPool::RESTO;
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
                continue;
            }

            $available = $this->availableIngredientQuantityForPool($ingredient, $poolCode);
            $requiredUnit = (string) ($ingredient->pivot->unit ?? $ingredient->unit ?? '');
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

    private function validateOrderStockAvailability(array $items): array
    {
        $requestedByItem = [];

        foreach ($items as $line) {
            $itemId = (int) ($line['id'] ?? 0);
            $qty = (int) ($line['quantity'] ?? 0);

            if ($itemId <= 0 || $qty <= 0) {
                continue;
            }

            $requestedByItem[$itemId] = ($requestedByItem[$itemId] ?? 0) + $qty;
        }

        if (empty($requestedByItem)) {
            return [];
        }

        $menuItems = Item::with(['category', 'ingredients.stocks.pool'])
            ->whereIn('id', array_keys($requestedByItem))
            ->get()
            ->keyBy('id');

        $issues = [];

        foreach ($requestedByItem as $itemId => $requestedQty) {
            /** @var Item|null $item */
            $item = $menuItems->get($itemId);
            if (!$item) {
                continue;
            }

            if ((bool) $item->is_available === false) {
                $issues[] = [
                    'type' => 'unavailable',
                    'name' => (string) $item->name,
                ];
                continue;
            }

            $availability = $this->effectiveAvailabilityForItem($item);
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
        $poolCode = $this->resolveItemPoolCode($item, $item->category);
        $inventory = $this->buildInventorySnapshot($item, $poolCode);
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

    private function formatOrderStockIssues(array $issues): string
    {
        $lines = ['Insufficient stock for requested items:'];

        foreach ($issues as $issue) {
            if (($issue['type'] ?? '') === 'unavailable') {
                $lines[] = '- ' . $issue['name'] . ' is currently unavailable.';
                continue;
            }

            $available = (int) ($issue['available'] ?? 0);
            $unit = (string) ($issue['unit'] ?? 'item');
            $unitLabel = $available === 1 ? $unit : $unit . 's';

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
        $orders = Sale::with(['customer', 'paymentMethod', 'saleItems.item.category'])
            ->whereIn('status', ['pending', 'preparing', 'ready'])
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();
        
        $pendingOrders = [];
        
        foreach ($orders as $order) {
            $itemsList = $order->saleItems->map(function($saleItem) {
                return $saleItem->item->name ?? 'Unknown Item';
            })->implode(', ');
            
            // Check if order has kitchen items using a dedicated query
            $hasKitchenItems = $this->saleHasKitchenItems((int) $order->id);
            
            // Get payment method name
            $paymentMethodName = $order->paymentMethod ? $order->paymentMethod->name : null;
            
            $pendingOrders[] = [
                'id' => $order->id,
                'total_amount' => $order->total_amount,
                'status' => $order->status,
                'kitchen_status' => $order->kitchen_status,
                'has_kitchen_items' => $hasKitchenItems,
                'created_at' => $order->created_at,
                'customer_name' => $order->customer_name,
                'payment_method_name' => $paymentMethodName,
                'room_number' => $order->room_number ?? null,
                'items_list' => $itemsList,
                'formatted_total' => '₱' . number_format($order->total_amount, 2),
                'formatted_time' => $order->created_at->format('h:i A'),
            ];
        }

        return response()->json([
            'success' => true,
            'pending_orders' => $pendingOrders,
        ]);
    }

    private function kitchenSaleItemsQuery(int $saleId)
    {
        return SaleItem::where('sale_id', $saleId)
            ->where(function ($query) {
                $query->whereNotNull('kitchen_status')
                    ->orWhereHas('item.category', function ($categoryQuery) {
                        $categoryQuery->where('is_kitchen_category', 1);
                    });
            });
    }

    private function saleHasKitchenItems(int $saleId): bool
    {
        return $this->kitchenSaleItemsQuery($saleId)->exists();
    }

    private function isKitchenSaleItem(SaleItem $saleItem): bool
    {
        if (!is_null($saleItem->kitchen_status)) {
            return true;
        }

        return (bool) optional(optional($saleItem->item)->category)->is_kitchen_category;
    }

    private function kitchenItemIdsForOrder(array $itemIds): array
    {
        if (empty($itemIds)) {
            return [];
        }

        $hasKitchenCategories = Category::where('is_kitchen_category', 1)->exists();

        if (!$hasKitchenCategories) {
            Log::warning('No kitchen categories configured; treating ordered items as kitchen items.', [
                'item_ids' => $itemIds,
            ]);

            return array_values(array_unique(array_map('intval', $itemIds)));
        }

        return Item::whereIn('id', $itemIds)
            ->whereHas('category', function($query) {
                $query->where('is_kitchen_category', 1);
            })
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->toArray();
    }

    public function store(Request $request)
{
    // Log the raw request first
    Log::info('========== POS ORDER CREATION STARTED ==========');
    Log::info('All request data:', $request->all());
    Log::info('room_number from request:', ['room_number' => $request->room_number]);
    
    try {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|exists:items,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.price' => 'required|numeric|min:0',
            'items.*.name' => 'required|string',
            'items.*.notes' => 'nullable|string',
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
            'payment_method_id' => 'required|exists:payment_methods,id',
        ]);

        Log::info('========== AFTER VALIDATION ==========');
        Log::info('validated room_number:', ['room_number' => $validated['room_number'] ?? null]);
        Log::info('All validated data:', $validated);

        $stockIssues = $this->validateOrderStockAvailability($validated['items']);
        if (!empty($stockIssues)) {
            throw new \Exception($this->formatOrderStockIssues($stockIssues));
        }

        DB::beginTransaction();

        $subtotal = collect($validated['items'])->sum(function($item) {
            return $item['price'] * $item['quantity'];
        });

        Log::info('Subtotal calculated:', ['subtotal' => $subtotal]);

        // Card discount (20% per card)
        $cardDiscount = 0;
        if ($validated['cards_presented'] > 0 && $validated['people_count'] > 0) {
            $cardDiscount = ($subtotal * 0.20) / $validated['people_count'] * $validated['cards_presented'];
            $cardDiscount = round($cardDiscount, 2);
        }

        // Additional discount
        $additionalDiscount = 0;
        if (isset($validated['discount_type']) && $validated['discount_type'] !== 'none' && $validated['discount_value'] > 0) {
            if ($validated['discount_type'] === 'percentage') {
                $additionalDiscount = ($subtotal * $validated['discount_value']) / 100;
            } elseif ($validated['discount_type'] === 'fixed') {
                $additionalDiscount = $validated['discount_value'];
            }
            $additionalDiscount = round($additionalDiscount, 2);
        }

        $totalDiscount = $cardDiscount + $additionalDiscount;
        $totalAmount = $subtotal - $totalDiscount;

        // determine which item IDs are considered kitchen items using a single query
        $itemIds = collect($validated['items'])->pluck('id')->toArray();
        
        Log::info('Item IDs from order:', ['item_ids' => $itemIds]);
        
        $kitchenItemIds = $this->kitchenItemIdsForOrder($itemIds);

        $hasKitchenItems = count($kitchenItemIds) > 0;
        
        // Get category info for each item to debug
        $itemsWithCategories = Item::with('category')
            ->whereIn('id', $itemIds)
            ->get()
            ->map(function($item) {
                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'category' => $item->category ? $item->category->name : 'no category',
                    'is_kitchen_category' => $item->category ? $item->category->is_kitchen_category : false
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
            'initialKitchenStatus' => $initialKitchenStatus
        ]);

        // Log before creating sale
        Log::info('========== BEFORE SALE CREATE ==========');
        Log::info('room_number to save:', ['room_number' => $validated['room_number'] ?? null]);

        $sale = Sale::create([
            'user_id' => Auth::id(),
            'subtotal' => $subtotal,
            'discount_amount' => $totalDiscount,
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
            'payment_method_id' => $validated['payment_method_id'],
            'paid_at' => !$hasKitchenItems ? now() : null,
        ]);

        // Log after creating sale
        Log::info('========== AFTER SALE CREATE ==========');
        Log::info('Created sale:', [
            'id' => $sale->id,
            'room_number' => $sale->room_number,
            'customer_name' => $sale->customer_name,
            'status' => $sale->status,
            'kitchen_status' => $sale->kitchen_status
        ]);

        foreach ($validated['items'] as $item) {
            // treat as kitchen item if the id is in the pre-fetched list
            $isKitchenItem = in_array($item['id'], $kitchenItemIds, true);

            $saleItemData = [
                'sale_id' => $sale->id,
                'item_id' => $item['id'],
                'quantity' => $item['quantity'],
                'unit_price' => $item['price'],
                'total_price' => $item['price'] * $item['quantity'],
                'special_instructions' => $item['notes'] ?? null,
            ];

            if ($isKitchenItem) {
                $saleItemData['kitchen_status'] = 'pending';
            }

            $saleItem = SaleItem::create($saleItemData);
            
            Log::info('Created sale item:', [
                'sale_item_id' => $saleItem->id,
                'item_id' => $item['id'],
                'item_name' => $item['name'],
                'is_kitchen_item' => $isKitchenItem,
                'kitchen_status' => $saleItem->kitchen_status ?? 'not set'
            ]);

        }

        
        // after sale items are created double-check the status in case the
        // initial detection missed something (e.g. category relationship was
        // null or cast weirdly). this extra query guarantees the order will
        // appear on the kitchen display whenever any of its items are
        // flagged as kitchen items.
        if (!$hasKitchenItems) {
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
                    'new_kitchen_status' => 'pending'
                ]);
            }
        }

        // After creating sale items, deduct inventory
        try {
            $this->deductInventory($sale);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Inventory deduction failed: ' . $e->getMessage());
            throw $e; // Re-throw to be caught by outer catch
        }

        DB::commit();

        // Update menu last updated timestamp
        cache()->put('menu_last_updated', time(), 3600);

        $successMessage = '✅ Order #' . $sale->id . ' placed successfully!';
        if ($hasKitchenItems) {
            $successMessage .= " Kitchen items sent to kitchen.";
        } else {
            $successMessage .= " Order completed.";
        }

        Log::info('========== ORDER CREATED SUCCESSFULLY ==========', [
            'order_id' => $sale->id,
            'final_status' => $sale->status,
            'final_kitchen_status' => $sale->kitchen_status,
            'has_kitchen_items' => $hasKitchenItems
        ]);

        return redirect()->route('admin.pos.index')->with([
            'success' => $successMessage,
            'order_data' => [
                'order_id' => $sale->id,
                'total' => $totalAmount,
                'discount' => $totalDiscount,
                'order_number' => 'ORD-' . str_pad($sale->id, 6, '0', STR_PAD_LEFT),
                'has_kitchen_items' => $hasKitchenItems,
            ]
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        
        Log::error('========== ORDER FAILED ==========');
        Log::error('Error: ' . $e->getMessage());
        Log::error('Trace: ' . $e->getTraceAsString());
        
        return redirect()->route('admin.pos.index')->with([
            'error' => '❌ Failed to place order: ' . $e->getMessage()
        ]);
    }
}
    public function markAsPaid(Request $request, Sale $sale)
    {
        try {
            DB::beginTransaction();

            $updateData = [
                'status' => 'completed',
                'payment_method_id' => $request->payment_method_id ?? 1,
            ];
            
            // Only update paid_at if column exists
            if (Schema::hasColumn('sales', 'paid_at')) {
                $updateData['paid_at'] = now();
            }
            
            $sale->update($updateData);

            DB::commit();

            // Update menu last updated timestamp to trigger POS refresh
            cache()->put('menu_last_updated', time(), 3600);

            return redirect()->route('admin.pos.index')->with('success', '✅ Order #' . $sale->id . ' marked as paid successfully!');

        } catch (\Exception $e) {
            DB::rollBack();
            
            return redirect()->route('admin.pos.index')->with('error', '❌ Failed to mark as paid: ' . $e->getMessage());
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
                    'message' => 'Order #' . $order->id . ' is already cancelled.',
                ]);
            }

            $this->restockInventory($order, 'order_cancelled');

            $order->update([
                'status' => 'cancelled',
                'kitchen_status' => 'cancelled',
            ]);

            DB::commit();

            cache()->put('menu_last_updated', time(), 3600);

            return response()->json([
                'success' => true,
                'message' => 'Order #' . $order->id . ' cancelled and stock restored.',
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
            $sale->update([
                'status' => 'ready',
            ]);

            return redirect()->route('admin.pos.index')->with('success', '✅ Order #' . $sale->id . ' marked as ready for payment!');

        } catch (\Exception $e) {
            return redirect()->route('admin.pos.index')->with('error', '❌ Failed to mark as ready: ' . $e->getMessage());
        }
    }

    public function markAsPreparing(Request $request, Sale $sale)
    {
        try {
            $sale->update([
                'status' => 'preparing',
                'kitchen_status' => 'preparing',
            ]);

            return redirect()->route('admin.pos.index')->with('success', '✅ Order #' . $sale->id . ' marked as preparing!');

        } catch (\Exception $e) {
            return redirect()->route('admin.pos.index')->with('error', '❌ Failed to mark as preparing: ' . $e->getMessage());
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
                'message' => 'Order #' . $order->id . ' is ready'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('Kitchen ready failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
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
                'kitchen_status' => $order->kitchen_status
            ]);
            
            DB::beginTransaction();

            // Check if order has kitchen items by looking at the items directly
            $hasKitchenItems = false;
            $allKitchenItemsReady = true;
            $unreadyItems = [];
            
            // Get all sale items for this order
            $saleItems = SaleItem::with('item.category')
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
                        $itemName = optional($saleItem->item)->name ?? 'Unknown Item';
                        $unreadyItems[] = $itemName . ' (' . $itemStatus . ')';
                    }
                }
            }

            // If order has kitchen items and they're not all ready, prevent completion
            if ($hasKitchenItems && !$allKitchenItemsReady) {
                $errorMessage = 'Cannot complete order - kitchen items not ready: ' . implode(', ', $unreadyItems);
                Log::warning($errorMessage);
                throw new \Exception($errorMessage);
            }

            // Update order status - only update columns that exist
            $updateData = [
                'status' => 'completed',
                'kitchen_status' => 'completed'
            ];
            
            // Guard against environments where this column has not been migrated yet
            if (Schema::hasColumn('sales', 'completed_at')) {
                $updateData['completed_at'] = now();
            } else {
                Log::info('completed_at column does not exist, skipping');
            }
            
            $order->update($updateData);

            // Update all kitchen items to completed
            $this->kitchenSaleItemsQuery((int) $order->id)
                ->update([
                    'kitchen_status' => 'completed',
                    'kitchen_completed_at' => now(),
                ]);
            
            Log::info('Kitchen items marked as completed for order', ['order_id' => $order->id]);

            DB::commit();

            // Update cache
            cache()->put('menu_last_updated', time(), 3600);

            Log::info('Order completed successfully', ['order_id' => $order->id]);

            // Reload order with full relationships for receipt
            $order->load(['saleItems.item', 'paymentMethod']);

            $receiptItems = $order->saleItems->map(function ($saleItem) {
                return [
                    'name'     => optional($saleItem->item)->name ?? 'Unknown Item',
                    'quantity' => $saleItem->quantity,
                    'price'    => (float) $saleItem->price,
                    'subtotal' => (float) ($saleItem->price * $saleItem->quantity),
                ];
            });

            return response()->json([
                'success' => true,
                'message' => 'Order #' . $order->id . ' completed successfully!',
                'receipt' => [
                    'order_number'   => $order->order_number ?? 'ORD-' . str_pad($order->id, 5, '0', STR_PAD_LEFT),
                    'customer_name'  => $order->customer_name ?? 'Walk-in Customer',
                    'room_number'    => $order->room_number ?? null,
                    'payment_method' => optional($order->paymentMethod)->name ?? 'Cash',
                    'items'          => $receiptItems,
                    'total_amount'   => (float) $order->total_amount,
                    'created_at'     => $order->created_at->format('M d, Y h:i A'),
                ],
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('Failed to complete order', [
                'order_id' => $order->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Handle inventory deduction based on recipe ingredients
     */
    private function deductInventory(Sale $sale)
    {
        $saleItems = SaleItem::with(['item.ingredients', 'item.category'])->where('sale_id', $sale->id)->get();
        $poolIdsByCode = InventoryPool::pluck('id', 'code')->map(fn ($id) => (int) $id)->all();
        $defaultPoolId = (int) ($poolIdsByCode[InventoryPool::RESTO] ?? 1);

        $requirements = [];
        $insufficientStock = [];

        foreach ($saleItems as $saleItem) {
            $item = $saleItem->item;
            if (!$item) {
                continue;
            }

            // Skip if item has no recipe
            if (!$item->ingredients || $item->ingredients->isEmpty()) {
                Log::warning("Item {$item->name} has no recipe defined");
                continue;
            }

            $poolCode = $this->resolveItemPoolCode($item);
            $poolId = (int) ($poolIdsByCode[$poolCode] ?? $defaultPoolId);

            foreach ($item->ingredients as $ingredient) {
                $requiredRaw = (float) $ingredient->pivot->quantity_required * (float) $saleItem->quantity;
                $piecesPerBox = (int) ($ingredient->pieces_per_box > 0 ? $ingredient->pieces_per_box : null);
                $requiredQuantity = $this->convertQuantity(
                    $requiredRaw,
                    (string) ($ingredient->pivot->unit ?? $ingredient->unit ?? ''),
                    (string) ($ingredient->unit ?? ''),
                    $piecesPerBox
                ) ?? $requiredRaw;
                if ((float) $requiredQuantity <= 0) {
                    continue;
                }

                $key = $ingredient->id . ':' . $poolId;

                if (!isset($requirements[$key])) {
                    $requirements[$key] = [
                        'ingredient' => $ingredient,
                        'quantity' => 0.0,
                        'inventory_pool_id' => $poolId,
                        'pool_code' => $poolCode,
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

        if (!empty($insufficientStock)) {
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
                'sale_id' => $sale->id
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

            if (!$stock) {
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
        $saleItems = SaleItem::with(['item.ingredients', 'item.category'])->where('sale_id', $sale->id)->get();
        $poolIdsByCode = InventoryPool::pluck('id', 'code')->map(fn ($id) => (int) $id)->all();
        $defaultPoolId = (int) ($poolIdsByCode[InventoryPool::RESTO] ?? 1);
        $restocks = [];

        foreach ($saleItems as $saleItem) {
            $item = $saleItem->item;
            if (!$item || !$item->ingredients || $item->ingredients->isEmpty()) {
                continue;
            }

            $poolCode = $this->resolveItemPoolCode($item);
            $poolId = (int) ($poolIdsByCode[$poolCode] ?? $defaultPoolId);

            foreach ($item->ingredients as $ingredient) {
                $qtyRaw = (float) $ingredient->pivot->quantity_required * (float) $saleItem->quantity;
                $piecesPerBox = (int) ($ingredient->pieces_per_box > 0 ? $ingredient->pieces_per_box : null);
                $qty = $this->convertQuantity(
                    $qtyRaw,
                    (string) ($ingredient->pivot->unit ?? $ingredient->unit ?? ''),
                    (string) ($ingredient->unit ?? ''),
                    $piecesPerBox
                ) ?? $qtyRaw;
                if ($qty <= 0) {
                    continue;
                }

                $key = $ingredient->id . ':' . $poolId;
                if (!isset($restocks[$key])) {
                    $restocks[$key] = [
                        'ingredient_id' => (int) $ingredient->id,
                        'inventory_pool_id' => $poolId,
                        'pool_code' => $poolCode,
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

            if (!$stock) {
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
}