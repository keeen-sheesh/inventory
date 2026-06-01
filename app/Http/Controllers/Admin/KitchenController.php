<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\KitchenItem;
use App\Models\KitchenCategory;
use App\Models\InventoryPool;
use App\Models\KitchenItemSize;
use App\Models\Size;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class KitchenController extends Controller
{
    private const LOW_STOCK_SERVING_THRESHOLD = 3;
    
    public function index(Request $request)
    {
        $query = KitchenItem::with('category')
            ->orderBy('sort_order', 'asc')
            ->orderBy('created_at', 'desc');

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->has('category_id') && $request->category_id !== 'all' && !empty($request->category_id)) {
            $query->where('kitchen_category_id', $request->category_id);
        }

        if ($request->has('status') && !empty($request->status)) {
            if ($request->status === 'active') {
                $query->where('is_available', true);
            } elseif ($request->status === 'inactive') {
                $query->where('is_available', false);
            }
        }

        // Handle API/JSON requests
        if ($request->wantsJson() || $request->ajax() || $request->has('limit')) {
            $limit = $request->get('limit', 1000);
            $items = $query->with('ingredients.stocks.pool')->limit($limit)->get();
            
            return response()->json([
                'success' => true,
                'items' => $items->map(function ($item) {
                    return $this->formatItem($item);
                }),
            ]);
        }

        // For Inertia view
        $items = $query->paginate(15);
        $categories = KitchenCategory::where('is_active', true)->orderBy('sort_order', 'asc')->get();

        return Inertia::render('Admin/KitchenItems/Index', [
            'items' => $items->map(fn ($item) => $this->formatItem($item)),
            'categories' => $categories,
            'filters' => $request->only(['search', 'category_id', 'status']),
        ]);
    }

    /**
     * Get orders for kitchen display with date filtering
     */
    public function orders(Request $request)
    {
        $dateRange = $request->get('date_range', 'today');
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');
        
        $query = \App\Models\Order::with(['items', 'items.kitchenItem', 'paymentMethod'])
            ->whereHas('items', function($q) {
                $q->whereNotNull('kitchen_item_id');
            })
            ->orderBy('created_at', 'desc');
        
        if ($startDate && $endDate) {
            $query->whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59']);
        }
        
        $orders = $query->get();
        
        // Format orders for kitchen display
        $formattedOrders = $orders->map(function($order) {
            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'txn_number' => $order->txn_number,
                'order_type' => $order->order_type,
                'customer_name' => $order->customer_name,
                'room_number' => $order->room_number,
                'payment_method_name' => $order->paymentMethod->name ?? null,
                'created_at' => $order->created_at,
                'notes' => $order->notes,
                'items' => $order->items->map(function($item) {
                    return [
                        'id' => $item->id,
                        'name' => $item->name,
                        'quantity' => $item->quantity,
                        'price' => $item->price,
                        'notes' => $item->notes,
                        'kitchen_status' => $item->kitchen_status ?? 'pending',
                        'kitchen_type' => $item->kitchenItem?->inventory_pool_code ?? 'kitchen',
                    ];
                }),
            ];
        });
        
        return response()->json([
            'success' => true,
            'orders' => $formattedOrders,
            'date_range' => $dateRange,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:kitchen_items,name',
                'description' => 'nullable|string',
                'price' => 'nullable|numeric|min:0',
                'kitchen_category_id' => 'required|exists:kitchen_categories,id',
                'preparation_time' => 'nullable|integer|min:0',
                'stock_quantity' => 'nullable|integer|min:0',
                'low_stock_threshold' => 'nullable|integer|min:0',
                'is_featured' => 'nullable|boolean',
                'is_available' => 'nullable|boolean',
                'sort_order' => 'nullable|integer',
                'image' => 'nullable|image|max:2048',
                'pricing_type' => 'nullable|string|in:single,dual',
                'price_solo' => 'nullable|numeric|min:0',
                'price_whole' => 'nullable|numeric|min:0',
                'has_recipe' => 'nullable|boolean',
                'has_sizes' => 'nullable|boolean',
                'size_variants' => 'nullable|string', // JSON array
            ]);

            // Handle image upload
            if ($request->hasFile('image')) {
                $imagePath = $request->file('image')->store('kitchen-items', 'public');
                $validated['image'] = $imagePath;
            }

            // Set default sort order if not provided
            if (!isset($validated['sort_order'])) {
                $maxOrder = KitchenItem::max('sort_order') ?? 0;
                $validated['sort_order'] = $maxOrder + 1;
            }

            // Set defaults
            $validated['is_available'] = isset($validated['is_available']) ? (bool)$validated['is_available'] : true;
            $validated['is_featured'] = isset($validated['is_featured']) ? (bool)$validated['is_featured'] : false;
            $validated['pricing_type'] = $validated['pricing_type'] ?? 'single';
            $validated['has_recipe'] = isset($validated['has_recipe']) ? (bool)$validated['has_recipe'] : false;
            
            // Set price based on pricing type
            if (($validated['pricing_type'] ?? 'single') === 'dual') {
                $validated['price'] = $validated['price_solo'] ?? 0;
            } else {
                $validated['price_solo'] = null;
                $validated['price_whole'] = null;
            }

            // Handle ingredients JSON
            $ingredientsData = null;
            if ($request->has('ingredients') && !empty($request->ingredients)) {
                $ingredientsData = json_decode($request->ingredients, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new \Exception('Invalid ingredients JSON format');
                }
            }

            $validated['has_sizes'] = filter_var($request->input('has_sizes', false), FILTER_VALIDATE_BOOLEAN);
            $validated['inventory_pool_code'] = $this->resolvePoolForRequest($request);

            $item = KitchenItem::create($validated);

            // Save size+temperature variant prices
            if ($validated['has_sizes'] && $request->filled('size_variants')) {
                $this->saveSizeVariants($item, $request->input('size_variants'));
            }

            // Attach ingredients if provided
            if ($ingredientsData && is_array($ingredientsData)) {
                $ingredientSync = [];
                foreach ($ingredientsData as $ing) {
                    if (isset($ing['id'])) {
                        $ingredientSync[$ing['id']] = [
                            'quantity_required' => $ing['quantity_required'] ?? 0,
                            'unit' => $ing['unit'] ?? 'unit',
                            'notes' => $ing['notes'] ?? null,
                            'is_main' => (bool) ($ing['is_main'] ?? false),
                        ];
                    }
                }
                if (!empty($ingredientSync)) {
                    $item->ingredients()->sync($ingredientSync);
                    $item->update(['has_recipe' => true]);
                }
            }
            
            // Load relationships
            $item->load('category');
            $item->load('ingredients.stocks.pool');
            
            DB::commit();

            // Broadcast menu update
            $this->broadcastMenuUpdate();

            // Get updated stats
            $stats = $this->getStats();

            return response()->json([
                'success' => true,
                'message' => 'Kitchen item created successfully!',
                'item' => $this->formatItem($item),
                'stats' => $stats,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create kitchen item: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to create item: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, KitchenItem $item)
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:kitchen_items,name,' . $item->id,
                'description' => 'nullable|string',
                'price' => 'nullable|numeric|min:0',
                'kitchen_category_id' => 'required|exists:kitchen_categories,id',
                'preparation_time' => 'nullable|integer|min:0',
                'stock_quantity' => 'nullable|integer|min:0',
                'low_stock_threshold' => 'nullable|integer|min:0',
                'is_featured' => 'nullable|boolean',
                'is_available' => 'nullable|boolean',
                'sort_order' => 'nullable|integer',
                'image' => 'nullable|image|max:2048',
                'remove_image' => 'nullable|boolean',
                'pricing_type' => 'nullable|string|in:single,dual',
                'price_solo' => 'nullable|numeric|min:0',
                'price_whole' => 'nullable|numeric|min:0',
                'has_recipe' => 'nullable|boolean',
                'has_sizes' => 'nullable|boolean',
                'size_variants' => 'nullable|string', // JSON array
            ]);

            // Handle image upload
            if ($request->hasFile('image')) {
                // Delete old image if exists
                if ($item->image) {
                    Storage::disk('public')->delete($item->image);
                }
                
                $imagePath = $request->file('image')->store('kitchen-items', 'public');
                $validated['image'] = $imagePath;
            } elseif ($request->has('remove_image') && $request->remove_image) {
                // Remove image if requested
                if ($item->image) {
                    Storage::disk('public')->delete($item->image);
                }
                $validated['image'] = null;
            }

            // Set defaults
            $validated['is_available'] = isset($validated['is_available']) ? (bool)$validated['is_available'] : $item->is_available;
            $validated['is_featured'] = isset($validated['is_featured']) ? (bool)$validated['is_featured'] : $item->is_featured;
            $validated['pricing_type'] = $validated['pricing_type'] ?? $item->pricing_type ?? 'single';
            $validated['has_recipe'] = isset($validated['has_recipe']) ? (bool)$validated['has_recipe'] : $item->has_recipe ?? false;
            $validated['has_sizes']  = filter_var($request->input('has_sizes', $item->has_sizes ?? false), FILTER_VALIDATE_BOOLEAN);
            $validated['inventory_pool_code'] = $this->resolvePoolForRequest($request, $item);
            
            // Set price based on pricing type
            if (($validated['pricing_type'] ?? 'single') === 'dual') {
                $validated['price'] = $validated['price_solo'] ?? $item->price_solo ?? 0;
            } else {
                $validated['price_solo'] = null;
                $validated['price_whole'] = null;
            }

            // Handle ingredients JSON
            $ingredientsData = null;
            if ($request->has('ingredients') && !empty($request->ingredients)) {
                $ingredientsData = json_decode($request->ingredients, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new \Exception('Invalid ingredients JSON format');
                }
            }

            $item->update($validated);

            // Save size+temperature variants (full replace)
            if ($validated['has_sizes'] && $request->filled('size_variants')) {
                $this->saveSizeVariants($item, $request->input('size_variants'));
            } elseif (!$validated['has_sizes']) {
                KitchenItemSize::where('kitchen_item_id', $item->id)->delete();
            }

            // Sync ingredients if provided
            if ($ingredientsData && is_array($ingredientsData)) {
                $ingredientSync = [];
                foreach ($ingredientsData as $ing) {
                    if (isset($ing['id'])) {
                        $ingredientSync[$ing['id']] = [
                            'quantity_required' => $ing['quantity_required'] ?? 0,
                            'unit' => $ing['unit'] ?? 'unit',
                            'notes' => $ing['notes'] ?? null,
                            'is_main' => (bool) ($ing['is_main'] ?? false),
                        ];
                    }
                }
                if (!empty($ingredientSync)) {
                    $item->ingredients()->sync($ingredientSync);
                    $item->update(['has_recipe' => true]);
                } else {
                    $item->ingredients()->sync([]);
                    $item->update(['has_recipe' => false]);
                }
            }
            
            // Load relationships
            $item->load('category');
            $item->load('ingredients.stocks.pool');
            
            DB::commit();

            // Broadcast menu update
            $this->broadcastMenuUpdate();

            return response()->json([
                'success' => true,
                'message' => 'Kitchen item updated successfully!',
                'item' => $this->formatItem($item),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update kitchen item: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update item: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle item availability status.
     */
    public function toggleStatus(Request $request, KitchenItem $item)
    {
        try {
            DB::beginTransaction();

            $item->update([
                'is_available' => !$item->is_available,
            ]);
            
            DB::commit();

            // Broadcast menu update
            $this->broadcastMenuUpdate();

            // Get updated stats
            $stats = $this->getStats();
            
            return response()->json([
                'success' => true,
                'message' => 'Item availability updated!',
                'is_available' => $item->is_available,
                'stats' => $stats,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to toggle item status: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update item status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, KitchenItem $item)
    {
        try {
            DB::beginTransaction();

            // Check if item is used in any sales
            if ($item->saleItems()->count() > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete item that has been sold. Consider marking it as unavailable instead.'
                ], 400);
            }

            // Delete image if exists
            if ($item->image) {
                Storage::disk('public')->delete($item->image);
            }

            $item->delete();
            
            DB::commit();

            // Broadcast menu update
            $this->broadcastMenuUpdate();

            // Get updated stats
            $stats = $this->getStats();

            return response()->json([
                'success' => true,
                'message' => 'Kitchen item deleted successfully!',
                'stats' => $stats,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to delete kitchen item: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete item: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update item order.
     */
    public function updateOrder(Request $request)
    {
        try {
            DB::beginTransaction();

            $request->validate([
                'items' => 'required|array',
                'items.*.id' => 'required|exists:kitchen_items,id',
                'items.*.sort_order' => 'required|integer|min:1',
            ]);

            foreach ($request->items as $itemData) {
                KitchenItem::where('id', $itemData['id'])->update(['sort_order' => $itemData['sort_order']]);
            }
            
            DB::commit();

            // Broadcast menu update
            $this->broadcastMenuUpdate();

            return response()->json([
                'success' => true,
                'message' => 'Order updated successfully!'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update order: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update order: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all kitchen items for POS (real-time)
     */
    public function getForPos(Request $request)
    {
        $items = KitchenItem::with('category')
            ->where('is_available', true)
            ->orderBy('sort_order', 'asc')
            ->orderBy('name', 'asc')
            ->get()
            ->map(function($item) {
                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'description' => $item->description,
                    'price' => (float)$item->price,
                    'category_id' => $item->kitchen_category_id,
                    'category_name' => $item->category->name ?? '',
                    'is_available' => (bool)$item->is_available,
                    'stock_quantity' => (int)$item->stock_quantity,
                    'low_stock_threshold' => (int)$item->low_stock_threshold,
                    'image' => $item->image,
                    'pricing_type' => $item->pricing_type ?? 'single',
                    'price_solo' => $item->price_solo ? (float)$item->price_solo : null,
                    'price_whole' => $item->price_whole ? (float)$item->price_whole : null,
                ];
            });

        return response()->json([
            'success' => true,
            'items' => $items,
            'timestamp' => now()->toDateTimeString(),
        ]);
    }

    /**
     * Get dashboard statistics
     */
    private function getStats()
    {
        return [
            'total_categories' => KitchenCategory::count(),
            'total_items' => KitchenItem::count(),
            'active_categories' => KitchenCategory::where('is_active', true)->count(),
            'available_items' => KitchenItem::where('is_available', true)->count(),
        ];
    }

    /**
     * Broadcast menu update
     */
    private function broadcastMenuUpdate()
    {
        try {
            cache()->put('menu_last_updated', now()->timestamp, 60);
            Log::info('Kitchen menu update broadcasted', ['timestamp' => now()->timestamp]);
        } catch (\Exception $e) {
            Log::error('Failed to broadcast menu update: ' . $e->getMessage());
        }
    }

    /**
     * Format item for JSON response
     */
    private function formatItem($item)
    {
        $item->loadMissing(['category', 'ingredients.stocks.pool']);
        
        // Build inventory snapshot for kitchen items
        $poolCode = $this->sanitizePoolCode($item->inventory_pool_code, InventoryPool::KITCHEN);
        $inventory = $this->buildInventorySnapshot($item, $poolCode);
        
        return [
            'id' => $item->id,
            'name' => $item->name,
            'description' => $item->description,
            'price' => (float)$item->price,
            'kitchen_category_id' => $item->kitchen_category_id,
            'inventory_pool_code' => $poolCode,
            'category_name' => $item->category->name ?? '',
            'is_available' => (bool)$item->is_available,
            'is_featured' => (bool)$item->is_featured,
            'stock_quantity' => (int)$item->stock_quantity,
            'low_stock_threshold' => (int)$item->low_stock_threshold,
            'sort_order' => (int)$item->sort_order,
            'image' => $item->image,
            'pricing_type' => $item->pricing_type ?? 'single',
            'price_solo' => $item->price_solo ? (float)$item->price_solo : null,
            'price_whole' => $item->price_whole ? (float)$item->price_whole : null,
            'has_recipe' => (bool)$item->has_recipe,
            'has_sizes'  => (bool)($item->has_sizes ?? false),
            'size_variants' => $item->getSizeVariantsForPosAttribute(),
            'inventory_status' => $inventory['status'],
            'inventory_status_label' => $inventory['label'],
            'inventory_available_servings' => $inventory['available_servings'],
            'ingredients' => $item->ingredients->flatMap(fn ($ing) => $this->expandDualIngredientRow($ing, $poolCode))->values(),
        ];
    }

    /**
     * Get available ingredient quantity for the pool
     */
    private function availableIngredientQuantityForPool($ingredient, string $poolCode): float
    {
        return (float) optional(
            $ingredient->stocks->first(fn ($stock) => optional($stock->pool)->code === $poolCode)
        )->quantity;
    }

    private function resolvePoolForRequest(Request $request, ?KitchenItem $item = null): string
    {
        $role = strtolower((string) optional($request->user())->role);
        $requested = $this->sanitizePoolCode($request->input('inventory_pool_code'));

        if (in_array($role, ['admin', 'manager'], true)) {
            if ($requested !== null) {
                return $requested;
            }

            if ($item) {
                return $this->sanitizePoolCode($item->inventory_pool_code, InventoryPool::KITCHEN);
            }

            return InventoryPool::KITCHEN;
        }

        if ($role === 'kitchen_resto') {
            return InventoryPool::RESTO;
        }

        return InventoryPool::KITCHEN;
    }

    private function sanitizePoolCode(?string $poolCode, ?string $fallback = null): ?string
    {
        $normalized = strtolower(trim((string) $poolCode));
        if (in_array($normalized, [InventoryPool::RESTO, InventoryPool::KITCHEN], true)) {
            return $normalized;
        }

        return $fallback;
    }

    /**
     * Build inventory snapshot for kitchen item
     */
    private function buildInventorySnapshot(KitchenItem $item, string $poolCode): array
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
            // [sizes:TALL:GRANDE:VENTI] — use Grande (middle) as representative qty for stock check
            $pivotNotes = (string) ($ingredient->pivot->notes ?? '');
            if ($required <= 0 || preg_match('/^\[sizes:[\d.]+:[\d.]+:[\d.]+\]/', $pivotNotes)) {
                if (preg_match('/^\[sizes:([\d.]+):([\d.]+):([\d.]+)\]/', $pivotNotes, $sm)) {
                    $required = (float) $sm[2]; // Grande qty
                }
                if ($required <= 0) continue;
            }

            $available = $this->availableIngredientQuantityForPool($ingredient, $poolCode);
            // If pivot unit is empty, quantity is already in stock units (no conversion needed)
            $pivotUnit    = trim((string) ($ingredient->pivot->unit ?? ''));
            $stockUnit    = (string) ($ingredient->unit ?? '');
            $requiredUnit = $pivotUnit !== '' ? $pivotUnit : $stockUnit;
            $requiredInStockUnit = $this->convertQuantity($required, $requiredUnit, $stockUnit);
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

    /**
     * Convert quantity between units
     */
    private function convertQuantity(float $quantity, ?string $fromUnit, ?string $toUnit): ?float
    {
        $from = $this->normalizeUnit($fromUnit);
        $to = $this->normalizeUnit($toUnit);

        if ($from === '' || $to === '' || $from === $to) {
            return $quantity;
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
     * Save size+temperature variant prices for a KitchenItem.
     * Input JSON: [{ size_name, size_id, temperature, price }, ...]
     */
    private function saveSizeVariants(KitchenItem $item, string $json): void
    {
        $variants = json_decode($json, true);
        if (!is_array($variants)) return;

        KitchenItemSize::where('kitchen_item_id', $item->id)->delete();

        $sizeMap = Size::whereIn('name', array_column($variants, 'size_name'))
            ->pluck('id', 'name')
            ->all();

        foreach ($variants as $v) {
            $price  = (float) ($v['price'] ?? 0);
            if ($price <= 0) continue;

            $sizeId = (int) ($v['size_id'] ?? $sizeMap[$v['size_name'] ?? ''] ?? 0);
            if (!$sizeId) continue;

            $temp = strtolower(trim($v['temperature'] ?? ''));
            if (!in_array($temp, ['hot', 'iced'], true)) continue;

            KitchenItemSize::create([
                'kitchen_item_id' => $item->id,
                'size_id'         => $sizeId,
                'temperature'     => $temp,
                'price'           => $price,
            ]);
        }
    }

    /**
     * Expand a single pivot row with [dual:SOLO:WHOLE] notes into two rows.
     */
    private function expandDualIngredientRow($ing, string $poolCode): array
    {
        $notes    = $ing->pivot->notes ?? '';
        $qty      = (float)$ing->pivot->quantity_required;
        $unit     = $ing->pivot->unit ?? $ing->unit;
        $cost     = (float)$ing->cost_per_unit;
        $stock    = $this->availableIngredientQuantityForPool($ing, $poolCode);
        $base     = [
            'id' => $ing->id,
            'name' => $ing->name,
            'unit' => $unit,
            'cost_per_unit' => $cost,
            'quantity' => $stock,
            'is_main' => (bool) ($ing->pivot->is_main ?? false),
        ];

        if (preg_match('/^\\[dual:([\\d.]+):([\\d.]+)\\]\\s*/', $notes, $m)) {
            $cleanNotes = preg_replace('/^\\[dual:[\\d.]+:[\\d.]+\\]\\s*/', '', $notes);
            return [
                array_merge($base, ['quantity_required'=>(float)$m[1], 'notes'=>'[portion:solo] '.$cleanNotes, 'portion'=>'solo']),
                array_merge($base, ['quantity_required'=>(float)$m[2], 'notes'=>'[portion:whole] '.$cleanNotes, 'portion'=>'whole']),
            ];
        }

        return [array_merge($base, ['quantity_required'=>$qty, 'notes'=>$notes])];
    }
}