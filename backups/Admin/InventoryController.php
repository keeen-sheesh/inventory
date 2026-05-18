<?php
// app/Http/Controllers/Admin/InventoryController.php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Models\IngredientStock;
use App\Models\InventoryPool;
use App\Models\InventoryTransaction;
use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class InventoryController extends Controller
{
    /**
     * Display inventory management page
     */
    public function index(Request $request)
    {
        $poolCode = $this->resolvePoolFromRequest($request, false);
        $ingredients = $this->serializedIngredients($poolCode, true);
        $items = Item::with('category', 'ingredients')->orderBy('name')->get();

        $itemsNeedingRecipe = Item::whereDoesntHave('ingredients')->count();
        $lowStockIngredients = collect($ingredients)
            ->filter(fn ($ing) => (float) $ing['quantity'] <= (float) $ing['min_stock'])
            ->count();

        return Inertia::render('Admin/Inventory/Index', [
            'ingredients' => $ingredients,
            'items' => $items,
            'activePool' => $poolCode,
            'availablePools' => $this->availablePoolsForUser($request),
            'stats' => [
                'total_ingredients' => count($ingredients),
                'total_items_with_recipe' => Item::has('ingredients')->count(),
                'items_needing_recipe' => $itemsNeedingRecipe,
                'low_stock_ingredients' => $lowStockIngredients,
            ],
        ]);
    }

    /**
     * Get ingredients for dropdown (API)
     */
    public function getIngredients(Request $request)
    {
        $poolCode = $this->resolvePoolFromRequest($request, false);
        $ingredients = $this->serializedIngredients($poolCode, false);

        return response()->json([
            'success' => true,
            'pool' => $poolCode,
            'available_pools' => $this->availablePoolsForUser($request),
            'ingredients' => $ingredients,
        ]);
    }

    /**
     * Get items with their recipes (API)
     */
    public function getItemsWithRecipes(Request $request)
    {
        $poolCode = $this->resolvePoolFromRequest($request, false);

        $items = Item::with(['category', 'ingredients' => function ($query) {
            $query->orderBy('name');
        }])->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'pool' => $poolCode,
            'items' => $items,
        ]);
    }

    /**
     * Get recipe for a specific item
     */
    public function getItemRecipe(Request $request, Item $item)
    {
        $poolCode = $this->resolvePoolFromRequest($request, false);
        $item->load(['category', 'ingredients' => function ($query) {
            $query->orderBy('name');
        }]);

        return response()->json([
            'success' => true,
            'pool' => $poolCode,
            'item' => $item,
        ]);
    }

    /**
     * Save recipe for an item
     */
    public function saveRecipe(Request $request, Item $item)
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'ingredients' => 'required|array',
                'ingredients.*.id' => 'required|exists:ingredients,id',
                'ingredients.*.quantity_required' => 'required|numeric|min:0.001',
                'ingredients.*.unit' => 'nullable|string|max:20',
                'ingredients.*.notes' => 'nullable|string|max:255',
            ]);

            $syncData = [];
            foreach ($validated['ingredients'] as $ingredient) {
                $syncData[$ingredient['id']] = [
                    'quantity_required' => $ingredient['quantity_required'],
                    'unit' => $ingredient['unit'] ?? null,
                    'notes' => $ingredient['notes'] ?? null,
                ];
            }

            $item->ingredients()->sync($syncData);
            $item->update(['has_recipe' => true]);
            DB::commit();

            $item->load(['category', 'ingredients']);

            return response()->json([
                'success' => true,
                'message' => 'Recipe saved successfully!',
                'item' => $item,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to save recipe: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to save recipe: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Check if item can be made with current inventory
     */
    public function checkAvailability(Request $request, Item $item)
    {
        $poolCode = $this->resolvePoolFromRequest($request, false);
        $quantity = (float) $request->get('quantity', 1);
        $item->load('ingredients.stocks.pool');

        $insufficientIngredients = [];

        foreach ($item->ingredients as $ingredient) {
            $requiredRaw = (float) $ingredient->pivot->quantity_required * $quantity;
            $requiredUnit = (string) ($ingredient->pivot->unit ?? $ingredient->unit ?? '');
            $stockUnit = (string) ($ingredient->unit ?? '');
            $required = $this->convertQuantity($requiredRaw, $requiredUnit, $stockUnit) ?? $requiredRaw;
            $available = $this->availableQuantityForIngredient($ingredient, $poolCode);

            if ($available < $required) {
                $insufficientIngredients[] = [
                    'name' => $ingredient->name,
                    'required' => $required,
                    'available' => $available,
                    'unit' => $stockUnit,
                    'pool' => $poolCode,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'pool' => $poolCode,
            'available' => count($insufficientIngredients) === 0,
            'insufficient_ingredients' => $insufficientIngredients,
            'missing_ingredients' => [],
        ]);
    }

    /**
     * Bulk update ingredient stock
     */
    public function updateStock(Request $request)
    {
        try {
            DB::beginTransaction();

            $poolCode = $this->resolvePoolFromRequest($request, true);
            $validated = $request->validate([
                'ingredients' => 'required|array',
                'ingredients.*.id' => 'required|exists:ingredients,id',
                'ingredients.*.quantity' => 'required|numeric|min:0',
                'ingredients.*.notes' => 'nullable|string',
            ]);

            foreach ($validated['ingredients'] as $data) {
                $ingredient = Ingredient::findOrFail($data['id']);
                $stock = $this->findOrCreateStock($ingredient->id, $poolCode);
                $oldQuantity = (float) $stock->quantity;
                $newQuantity = (float) $data['quantity'];
                $delta = $newQuantity - $oldQuantity;

                $stock->quantity = $newQuantity;
                $stock->save();

                if (abs($delta) > 0) {
                    $this->logInventoryTransaction(
                        $ingredient->id,
                        $stock->inventory_pool_id,
                        $delta,
                        'manual_adjustment',
                        null,
                        null,
                        $data['notes'] ?? null,
                        ['source' => 'updateStock']
                    );
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Stock updated successfully!',
                'pool' => $poolCode,
                'ingredients' => $this->serializedIngredients($poolCode, false),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update stock: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to update stock: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get low stock alerts
     */
    public function getLowStockAlerts(Request $request)
    {
        $poolCode = $this->resolvePoolFromRequest($request, false);
        $ingredients = collect($this->serializedIngredients($poolCode, false));

        $lowStock = $ingredients
            ->filter(fn ($ing) => (float) $ing['quantity'] <= (float) $ing['min_stock'])
            ->sortBy(function ($ing) {
                $minStock = max((float) $ing['min_stock'], 0.001);
                return (float) $ing['quantity'] / $minStock;
            })
            ->values();

        $outOfStock = $ingredients
            ->filter(fn ($ing) => (float) $ing['quantity'] <= 0)
            ->values();

        return response()->json([
            'success' => true,
            'pool' => $poolCode,
            'low_stock' => $lowStock,
            'out_of_stock' => $outOfStock,
            'total_alerts' => $lowStock->count() + $outOfStock->count(),
        ]);
    }

    /**
     * Migrate existing items to use ingredients
     */
    public function migrateItems(Request $request)
    {
        try {
            DB::beginTransaction();

            $items = Item::whereDoesntHave('ingredients')->get();
            $migrated = 0;
            $skipped = 0;

            foreach ($items as $item) {
                if (!empty($item->ingredients) && is_string($item->ingredients)) {
                    $ingredientsList = explode(',', $item->ingredients);

                    foreach ($ingredientsList as $ingredientName) {
                        $ingredientName = trim($ingredientName);
                        $ingredient = Ingredient::where('name', 'LIKE', "%{$ingredientName}%")->first();

                        if ($ingredient) {
                            $item->ingredients()->attach($ingredient->id, [
                                'quantity_required' => 1,
                                'notes' => 'Auto-migrated from old data',
                            ]);
                        }
                    }

                    $migrated++;
                } else {
                    $skipped++;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Migration complete! {$migrated} items migrated, {$skipped} skipped.",
                'migrated' => $migrated,
                'skipped' => $skipped,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Migration failed: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Migration failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a new ingredient
     */
    public function storeIngredient(Request $request)
    {
        try {
            $poolCode = $this->resolvePoolFromRequest($request, true);
            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:ingredients,name',
                'unit' => 'required|string|max:50',
                'pieces_per_box' => 'nullable|integer|min:1',
                'is_dry' => 'nullable|boolean',
                'quantity' => 'required|numeric|min:0',
                'min_stock' => 'nullable|numeric|min:0',
                'cost_per_unit' => 'nullable|numeric|min:0',
            ]);

            DB::beginTransaction();

            $unit = $this->sanitizeStockUnit($validated['unit']);
            $isDry = array_key_exists('is_dry', $validated)
                ? (bool) $validated['is_dry']
                : $this->isDryStockUnit($unit);
            $quantity = (float) $validated['quantity'];
            $minStock = (float) ($validated['min_stock'] ?? 0);
            $costPerUnit = (float) ($validated['cost_per_unit'] ?? 0);

            $ingredient = Ingredient::create([
                'name' => $validated['name'],
                'unit' => $unit,
                'pieces_per_box' => $validated['pieces_per_box'] ?? null,
                'is_dry' => $isDry,
                'quantity' => 0,
                'min_stock' => 0,
                'cost_per_unit' => $costPerUnit,
            ]);

            $this->initializeStocksForIngredient($ingredient->id, $quantity, $minStock, $costPerUnit, $poolCode);
            DB::commit();

            $serialized = collect($this->serializedIngredients($poolCode, false))
                ->firstWhere('id', $ingredient->id);

            return response()->json([
                'success' => true,
                'message' => 'Ingredient added successfully!',
                'pool' => $poolCode,
                'ingredient' => $serialized,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create ingredient: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to add ingredient: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update an existing ingredient
     */
    public function updateIngredient(Request $request, Ingredient $ingredient)
    {
        try {
            $poolCode = $this->resolvePoolFromRequest($request, true);
            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:ingredients,name,' . $ingredient->id,
                'unit' => 'required|string|max:50',
                'pieces_per_box' => 'nullable|integer|min:1',
                'is_dry' => 'nullable|boolean',
                'quantity' => 'required|numeric|min:0',
                'min_stock' => 'nullable|numeric|min:0',
                'cost_per_unit' => 'nullable|numeric|min:0',
            ]);

            DB::beginTransaction();
            $unit = $this->sanitizeStockUnit($validated['unit']);
            $isDry = array_key_exists('is_dry', $validated)
                ? (bool) $validated['is_dry']
                : $this->isDryStockUnit($unit);
            $stock = $this->findOrCreateStock($ingredient->id, $poolCode, true);
            $costPerUnit = array_key_exists('cost_per_unit', $validated)
                ? (float) $validated['cost_per_unit']
                : (float) ($stock->cost_per_unit ?? $ingredient->cost_per_unit ?? 0);
            $minStock = array_key_exists('min_stock', $validated)
                ? (float) $validated['min_stock']
                : (float) ($stock->min_stock ?? 0);
            $ingredientData = [
                'name' => $validated['name'],
                'unit' => $unit,
                'is_dry' => $isDry,
                'cost_per_unit' => $costPerUnit,
            ];

            if (array_key_exists('pieces_per_box', $validated)) {
                $ingredientData['pieces_per_box'] = $validated['pieces_per_box'];
            }

            $ingredient->update($ingredientData);
            $oldQuantity = (float) $stock->quantity;
            $newQuantity = (float) $validated['quantity'];
            $delta = $newQuantity - $oldQuantity;

            $stock->update([
                'quantity' => $newQuantity,
                'min_stock' => $minStock,
                'cost_per_unit' => $costPerUnit,
            ]);

            if (abs($delta) > 0) {
                $this->logInventoryTransaction(
                    $ingredient->id,
                    $stock->inventory_pool_id,
                    $delta,
                    'manual_adjustment',
                    null,
                    null,
                    null,
                    ['source' => 'updateIngredient']
                );
            }

            DB::commit();

            $serialized = collect($this->serializedIngredients($poolCode, false))
                ->firstWhere('id', $ingredient->id);

            return response()->json([
                'success' => true,
                'message' => 'Ingredient updated successfully!',
                'pool' => $poolCode,
                'ingredient' => $serialized,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update ingredient: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to update ingredient: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete an ingredient
     */
    public function deleteIngredient(Request $request, Ingredient $ingredient)
    {
        try {
            $this->resolvePoolFromRequest($request, true);
            $role = strtolower((string) optional($request->user())->role);
            if (!in_array($role, ['admin', 'resto_admin'], true)) {
                abort(403, 'Only admin accounts can delete ingredients.');
            }

            $ingredientName = $ingredient->name;
            $ingredient->items()->detach();
            $ingredient->delete();

            Log::info('Ingredient deleted', [
                'name' => $ingredientName,
                'user' => auth()->id(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Ingredient deleted successfully!',
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to delete ingredient: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete ingredient: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Bulk update ingredient stock
     */
    public function bulkUpdateStock(Request $request)
    {
        try {
            DB::beginTransaction();

            $poolCode = $this->resolvePoolFromRequest($request, true);
            $validated = $request->validate([
                'updates' => 'required|array',
                'updates.*.id' => 'required|exists:ingredients,id',
                'updates.*.quantity' => 'required|numeric|min:0',
            ]);

            foreach ($validated['updates'] as $update) {
                $stock = $this->findOrCreateStock((int) $update['id'], $poolCode, true);
                $oldQuantity = (float) $stock->quantity;
                $newQuantity = (float) $update['quantity'];
                $delta = $newQuantity - $oldQuantity;

                $stock->quantity = $newQuantity;
                $stock->save();

                if (abs($delta) > 0) {
                    $this->logInventoryTransaction(
                        (int) $update['id'],
                        $stock->inventory_pool_id,
                        $delta,
                        'manual_adjustment',
                        null,
                        null,
                        null,
                        ['source' => 'bulkUpdateStock']
                    );
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Stock updated successfully!',
                'pool' => $poolCode,
                'ingredients' => $this->serializedIngredients($poolCode, false),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to bulk update stock: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to update stock: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function availablePoolsForUser(Request $request): array
    {
        $role = strtolower((string) optional($request->user())->role);

        if (in_array($role, ['admin', 'resto_admin'], true)) {
            return ['resto', 'kitchen', 'combined'];
        }

        if ($role === 'kitchen') {
            return ['kitchen'];
        }

        return ['resto'];
    }

    private function resolvePoolFromRequest(Request $request, bool $mutating): string
    {
        $requestedPool = strtolower((string) ($request->input('pool') ?? $request->query('pool') ?? ''));
        $allowedPools = $this->availablePoolsForUser($request);
        $defaultPool = $allowedPools[0] ?? InventoryPool::RESTO;
        $poolCode = $requestedPool !== '' ? $requestedPool : $defaultPool;

        if (!in_array($poolCode, $allowedPools, true)) {
            abort(403, "Pool '{$poolCode}' is not allowed for this account.");
        }

        if ($mutating && $poolCode === 'combined') {
            abort(422, 'Combined pool is read-only.');
        }

        return $poolCode;
    }

    private function serializedIngredients(string $poolCode, bool $withItems): array
    {
        $ingredients = Ingredient::query()
            ->when($withItems, fn ($query) => $query->with('items'))
            ->with(['stocks.pool'])
            ->orderBy('name')
            ->get();

        return $ingredients->map(function (Ingredient $ingredient) use ($poolCode) {
            $stocks = $ingredient->stocks;
            $stock = null;

            if ($poolCode !== 'combined') {
                $stock = $stocks->first(fn ($s) => optional($s->pool)->code === $poolCode);
            }

            $quantity = $poolCode === 'combined'
                ? (float) $stocks->sum('quantity')
                : (float) optional($stock)->quantity;
            $minStock = $poolCode === 'combined'
                ? (float) $stocks->sum('min_stock')
                : (float) optional($stock)->min_stock;
            $costPerUnit = $poolCode === 'combined'
                ? (float) ($stocks->avg('cost_per_unit') ?? $ingredient->cost_per_unit)
                : (float) (optional($stock)->cost_per_unit ?? $ingredient->cost_per_unit);

            return [
                'id' => $ingredient->id,
                'name' => $ingredient->name,
                'unit' => $ingredient->unit,
                'is_dry' => (bool) $ingredient->is_dry,
                'quantity' => $quantity,
                'min_stock' => $minStock,
                'cost_per_unit' => $costPerUnit,
                'pieces_per_box' => $ingredient->pieces_per_box,
                'pool' => $poolCode,
            ];
        })->values()->all();
    }

    private function availableQuantityForIngredient(Ingredient $ingredient, string $poolCode): float
    {
        if ($poolCode === 'combined') {
            return (float) $ingredient->stocks->sum('quantity');
        }

        return (float) optional(
            $ingredient->stocks->first(fn ($stock) => optional($stock->pool)->code === $poolCode)
        )->quantity;
    }

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
            default => $normalized,
        };
    }

    private function findOrCreateStock(int $ingredientId, string $poolCode, bool $lockForUpdate = false): IngredientStock
    {
        $poolId = InventoryPool::where('code', $poolCode)->value('id');
        $query = IngredientStock::where('ingredient_id', $ingredientId)
            ->where('inventory_pool_id', $poolId);

        if ($lockForUpdate) {
            $query->lockForUpdate();
        }

        $stock = $query->first();
        if ($stock) {
            return $stock;
        }

        return IngredientStock::create([
            'ingredient_id' => $ingredientId,
            'inventory_pool_id' => $poolId,
            'quantity' => 0,
            'min_stock' => 0,
            'cost_per_unit' => 0,
        ]);
    }

    private function initializeStocksForIngredient(
        int $ingredientId,
        float $quantity,
        float $minStock,
        float $cost,
        string $targetPoolCode
    ): void
    {
        $pools = InventoryPool::all();

        foreach ($pools as $pool) {
            $isTarget = $pool->code === $targetPoolCode;
            $poolQuantity = $isTarget ? $quantity : 0;
            $poolMinStock = $isTarget ? $minStock : 0;

            $stock = IngredientStock::create([
                'ingredient_id' => $ingredientId,
                'inventory_pool_id' => $pool->id,
                'quantity' => $poolQuantity,
                'min_stock' => $poolMinStock,
                'cost_per_unit' => $cost,
            ]);

            if ($poolQuantity > 0) {
                $this->logInventoryTransaction(
                    $ingredientId,
                    $stock->inventory_pool_id,
                    $poolQuantity,
                    'manual_adjustment',
                    null,
                    null,
                    'Initial stock on ingredient creation',
                    ['source' => 'storeIngredient']
                );
            }
        }
    }

    private function sanitizeStockUnit(?string $unit): string
    {
        $normalized = strtolower(trim((string) $unit));

        return match ($normalized) {
            'kilogram', 'kilograms', 'kgs' => 'kg',
            'gram', 'grams', 'gm', 'gms' => 'g',
            'liter', 'litre', 'liters', 'litres', 'ltr', 'ltrs' => 'l',
            'milliliter', 'millilitre', 'milliliters', 'millilitres', 'mls' => 'ml',
            'pack' => 'box',
            'pc', 'piece', 'pieces' => 'pcs',
            default => $normalized,
        };
    }

    private function isDryStockUnit(string $unit): bool
    {
        return !in_array(strtolower(trim($unit)), ['ml', 'l'], true);
    }

    private function logInventoryTransaction(
        int $ingredientId,
        int $poolId,
        float $delta,
        string $reason,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $notes = null,
        array $meta = []
    ): void {
        InventoryTransaction::create([
            'ingredient_id' => $ingredientId,
            'inventory_pool_id' => $poolId,
            'quantity_delta' => $delta,
            'reason' => $reason,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'user_id' => auth()->id(),
            'notes' => $notes,
            'meta' => $meta,
        ]);
    }
}