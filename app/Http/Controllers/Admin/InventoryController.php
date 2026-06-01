<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Models\IngredientStock;
use App\Models\InventoryPool;
use App\Models\InventoryTransaction;
use App\Models\Item;
use App\Models\PurchaseReceipt;
use App\Models\PurchaseReceiptItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        $ingredients = $this->getAllIngredientsWithStock();
        $items = Item::with('category')->orderBy('name')->get();
        $recentReceipts = PurchaseReceipt::with(['items.ingredient', 'user', 'pool'])
            ->latest()
            ->limit(50)
            ->get();
        
        $lowStockAlerts = collect($ingredients)->filter(function($ing) {
            return $ing['current_stock'] <= $ing['min_stock'] && $ing['current_stock'] > 0;
        })->values();
        
        $outOfStockAlerts = collect($ingredients)->filter(function($ing) {
            return $ing['current_stock'] <= 0;
        })->values();
        
        return Inertia::render('Admin/Inventory', [
            'ingredients' => $ingredients,
            'items' => $items,
            'recentReceipts' => $recentReceipts,
            'stats' => [
                'total_ingredients' => count($ingredients),
                'low_stock_count' => $lowStockAlerts->count(),
                'out_of_stock_count' => $outOfStockAlerts->count(),
                'critical_stock_count' => 0,
                'total_value' => collect($ingredients)->sum('total_value'),
            ],
            'alerts' => [
                'low_stock' => $lowStockAlerts,
                'out_of_stock' => $outOfStockAlerts,
            ],
        ]);
    }
    
    public function getIngredients(Request $request)
    {
        $ingredients = $this->getAllIngredientsWithStock();
        
        return response()->json([
            'success' => true,
            'ingredients' => $ingredients,
        ]);
    }
    
    public function storeIngredient(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:ingredients,name',
            'unit' => 'required|string|max:50',
            'category' => 'nullable|string|max:100',
            'min_stock' => 'nullable|integer|min:0',
            'initial_stock' => 'nullable|numeric|min:0',
            'pool' => 'required|string|in:resto,kitchen',
            'cost_per_unit' => 'nullable|numeric|min:0',
        ]);
        
        try {
            DB::beginTransaction();
            
            $ingredient = Ingredient::create([
                'name' => $validated['name'],
                'unit' => $validated['unit'],
                'category' => $validated['category'] ?? null,
                'min_stock' => $validated['min_stock'] ?? 0,
                'quantity' => $validated['initial_stock'] ?? 0,
                'cost_per_unit' => $validated['cost_per_unit'] ?? 0,
            ]);
            
            $pool = InventoryPool::where('code', $validated['pool'])->first();
            if ($pool) {
                IngredientStock::create([
                    'ingredient_id' => $ingredient->id,
                    'inventory_pool_id' => $pool->id,
                    'quantity' => $validated['initial_stock'] ?? 0,
                    'cost_per_unit' => $validated['cost_per_unit'] ?? 0,
                ]);
                
                if (($validated['initial_stock'] ?? 0) > 0) {
                    InventoryTransaction::create([
                        'ingredient_id' => $ingredient->id,
                        'inventory_pool_id' => $pool->id,
                        'quantity_delta' => $validated['initial_stock'] ?? 0,
                        'reason' => 'initial_stock',
                        'user_id' => auth()->id(),
                        'notes' => "Initial stock added: {$validated['initial_stock']} {$ingredient->unit}",
                    ]);
                }
            }
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'Ingredient added successfully',
                'ingredient' => $ingredient,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to add ingredient: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to add ingredient: ' . $e->getMessage(),
            ], 500);
        }
    }
    
    public function updateIngredient(Request $request, Ingredient $ingredient)
    {
        // Log the incoming request for debugging
        Log::info('=== UPDATE INGREDIENT REQUEST ===');
        Log::info('Request payload:', $request->all());
        Log::info('Ingredient ID: ' . $ingredient->id);
        Log::info('Current ingredient data:', $ingredient->toArray());
        
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:ingredients,name,' . $ingredient->id,
            'unit' => 'required|string|max:50',
            'category_id' => 'nullable|integer|exists:categories,id',
            'min_stock' => 'nullable|integer|min:0',
            'current_stock' => 'nullable|integer|min:0',
            'pool' => 'required|string|in:resto,kitchen',
            'cost_per_unit' => 'nullable|numeric|min:0',
        ]);
        
        Log::info('Validated data:', $validated);
        
        try {
            DB::beginTransaction();
            
            // DIRECT UPDATE using individual property assignments
            $ingredient->name = $validated['name'];
            $ingredient->unit = $validated['unit'];
            $ingredient->min_stock = $validated['min_stock'] ?? 0;
            
            // Set category_id (the foreign key, not the relationship)
            $ingredient->category_id = $validated['category_id'] ?? null;
            
            Log::info('Saving ingredient with category_id: ' . ($ingredient->category_id ?? 'null'));
            
            // Save the model
            $ingredient->save();
            
            Log::info('Ingredient after save:', $ingredient->toArray());
            
            // Handle pool and stock
            $pool = InventoryPool::where('code', $validated['pool'])->first();
            if (!$pool) {
                throw new \Exception('Invalid inventory pool: ' . $validated['pool']);
            }
            
            Log::info('Using pool:', ['id' => $pool->id, 'code' => $pool->code]);
            
            // Get the stock for the selected pool
            $stock = IngredientStock::where('ingredient_id', $ingredient->id)
                ->where('inventory_pool_id', $pool->id)
                ->first();
            
            $newQuantity = $validated['current_stock'] ?? 0;
            Log::info('Stock management - New quantity: ' . $newQuantity);
            
            if ($stock) {
                Log::info('Existing stock found, updating quantity from ' . $stock->quantity . ' to ' . $newQuantity);
                $oldQuantity = $stock->quantity;
                $stock->quantity = $newQuantity;
                
                if (isset($validated['cost_per_unit']) && $validated['cost_per_unit'] > 0) {
                    $stock->cost_per_unit = $validated['cost_per_unit'];
                }
                
                $stock->save();
                
                if ($oldQuantity != $newQuantity) {
                    InventoryTransaction::create([
                        'ingredient_id' => $ingredient->id,
                        'inventory_pool_id' => $pool->id,
                        'quantity_delta' => $newQuantity - $oldQuantity,
                        'reason' => 'manual_adjustment',
                        'user_id' => auth()->id(),
                        'notes' => "Manual stock update from {$oldQuantity} to {$newQuantity}",
                    ]);
                }
            } else {
                Log::info('No existing stock found, creating new stock record');
                IngredientStock::create([
                    'ingredient_id' => $ingredient->id,
                    'inventory_pool_id' => $pool->id,
                    'quantity' => $newQuantity,
                    'cost_per_unit' => $validated['cost_per_unit'] ?? 0,
                ]);
                
                // Check if there's stock in the other pool
                $otherPoolCode = $validated['pool'] === 'resto' ? 'kitchen' : 'resto';
                $otherPool = InventoryPool::where('code', $otherPoolCode)->first();
                
                if ($otherPool) {
                    $otherStock = IngredientStock::where('ingredient_id', $ingredient->id)
                        ->where('inventory_pool_id', $otherPool->id)
                        ->first();
                    
                    if ($otherStock) {
                        Log::info('Removing stock from other pool: ' . $otherPoolCode);
                        $otherStock->delete();
                    }
                }
                
                if ($newQuantity > 0) {
                    InventoryTransaction::create([
                        'ingredient_id' => $ingredient->id,
                        'inventory_pool_id' => $pool->id,
                        'quantity_delta' => $newQuantity,
                        'reason' => 'manual_adjustment',
                        'user_id' => auth()->id(),
                        'notes' => "Stock created in {$validated['pool']} pool with quantity {$newQuantity}",
                    ]);
                }
            }
            
            DB::commit();
            
            // Get fresh ingredients list
            $ingredients = $this->getAllIngredientsWithStock();
            
            Log::info('Update successful, returning response');
            
            $updatedIngredient = $ingredient->fresh();
            
            return response()->json([
                'success' => true,
                'message' => 'Ingredient updated successfully!',
                'ingredients' => $ingredients,
                'updated_ingredient' => array_merge($updatedIngredient->toArray(), [
                    'category_name' => $updatedIngredient->category?->name,
                ]),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update ingredient: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update ingredient: ' . $e->getMessage(),
            ], 500);
        }
    }
    
    public function deleteIngredient(Ingredient $ingredient)
    {
        try {
            if ($ingredient->items()->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete ingredient that is used in recipes',
                ], 422);
            }
            
            $ingredient->stocks()->delete();
            $ingredient->transactions()->delete();
            $ingredient->delete();
            
            return response()->json([
                'success' => true,
                'message' => 'Ingredient deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete ingredient: ' . $e->getMessage(),
            ], 500);
        }
    }
    
    public function bulkUpdateStock(Request $request)
    {
        $validated = $request->validate([
            'receipt_number' => 'nullable|string|max:100',
            'supplier_name' => 'nullable|string|max:255',
            'receipt_date' => 'required|date',
            'notes' => 'nullable|string',
            'pool' => 'required|string|in:resto,kitchen',
            'items' => 'required|array|min:1',
            'items.*.ingredient_id' => 'required|exists:ingredients,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.cost_per_unit' => 'required|numeric|min:0',
        ]);
        
        try {
            DB::beginTransaction();
            
            $pool = InventoryPool::where('code', $validated['pool'])->first();
            $receiptNumber = $validated['receipt_number'] ?? 'REC-' . date('Ymd') . '-' . rand(1000, 9999);
            
            $receipt = PurchaseReceipt::create([
                'receipt_number' => $receiptNumber,
                'supplier_name' => $validated['supplier_name'],
                'receipt_date' => $validated['receipt_date'],
                'notes' => $validated['notes'],
                'inventory_pool_id' => $pool->id,
                'user_id' => auth()->id(),
                'total_amount' => 0,
            ]);
            
            $totalAmount = 0;
            $updatedIngredients = [];
            
            foreach ($validated['items'] as $item) {
                $ingredient = Ingredient::find($item['ingredient_id']);
                $stock = IngredientStock::firstOrCreate(
                    [
                        'ingredient_id' => $item['ingredient_id'],
                        'inventory_pool_id' => $pool->id,
                    ],
                    [
                        'quantity' => 0,
                        'cost_per_unit' => 0,
                    ]
                );
                
                $oldQuantity = (int) $stock->quantity;
                $oldCost = (float) $stock->cost_per_unit;
                $newQuantity = $oldQuantity + (int) $item['quantity'];
                $itemTotal = (int) $item['quantity'] * (float) $item['cost_per_unit'];
                $totalAmount += $itemTotal;
                
                $totalCost = ($oldQuantity * $oldCost) + ((int) $item['quantity'] * (float) $item['cost_per_unit']);
                $newCost = $newQuantity > 0 ? $totalCost / $newQuantity : (float) $item['cost_per_unit'];
                
                $stock->quantity = $newQuantity;
                $stock->cost_per_unit = round($newCost, 2);
                $stock->save();
                
                PurchaseReceiptItem::create([
                    'purchase_receipt_id' => $receipt->id,
                    'ingredient_id' => $item['ingredient_id'],
                    'quantity' => (int) $item['quantity'],
                    'cost_per_unit' => (float) $item['cost_per_unit'],
                    'total' => $itemTotal,
                ]);
                
                InventoryTransaction::create([
                    'ingredient_id' => $item['ingredient_id'],
                    'inventory_pool_id' => $pool->id,
                    'quantity_delta' => (int) $item['quantity'],
                    'reason' => 'purchase',
                    'user_id' => auth()->id(),
                    'notes' => "Receipt: {$receiptNumber} - Added {$item['quantity']} {$ingredient->unit} @ ₱{$item['cost_per_unit']}/unit",
                ]);
                
                $updatedIngredients[] = $ingredient->name;
            }
            
            $receipt->update(['total_amount' => $totalAmount]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => "Stock updated successfully for: " . implode(', ', $updatedIngredients),
                'receipt' => $receipt->load('items.ingredient'),
                'ingredients' => $this->getAllIngredientsWithStock(),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Bulk stock update failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update stock: ' . $e->getMessage(),
            ], 500);
        }
    }
    
    public function addStock(Request $request)
    {
        $validated = $request->validate([
            'ingredient_id' => 'required|exists:ingredients,id',
            'quantity' => 'required|numeric|min:0.01',
            'cost_per_unit' => 'required|numeric|min:0',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            DB::beginTransaction();
            
            $ingredient = Ingredient::find($validated['ingredient_id']);
            $poolCode = $request->input('pool', 'resto');
            $pool = InventoryPool::where('code', $poolCode)->first();
            
            if (!$pool) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid inventory pool',
                ], 422);
            }
            
            $stock = IngredientStock::where('ingredient_id', $validated['ingredient_id'])
                ->where('inventory_pool_id', $pool->id)
                ->first();
            
            if (!$stock) {
                $stock = IngredientStock::create([
                    'ingredient_id' => $validated['ingredient_id'],
                    'inventory_pool_id' => $pool->id,
                    'quantity' => 0,
                    'cost_per_unit' => $validated['cost_per_unit'],
                ]);
            }
            
            $oldQuantity = $stock->quantity;
            $oldCost = $stock->cost_per_unit;
            $newQuantity = $oldQuantity + $validated['quantity'];
            
            $totalCost = ($oldQuantity * $oldCost) + ($validated['quantity'] * $validated['cost_per_unit']);
            $newCost = $newQuantity > 0 ? $totalCost / $newQuantity : $validated['cost_per_unit'];
            
            $stock->quantity = $newQuantity;
            $stock->cost_per_unit = round($newCost, 2);
            $stock->save();
            
            $ingredient->quantity = $newQuantity;
            $ingredient->cost_per_unit = round($newCost, 2);
            $ingredient->save();
            
            InventoryTransaction::create([
                'ingredient_id' => $validated['ingredient_id'],
                'inventory_pool_id' => $pool->id,
                'quantity_delta' => $validated['quantity'],
                'reason' => 'stock_addition',
                'user_id' => auth()->id(),
                'notes' => $validated['notes'] ?? "Added {$validated['quantity']} {$ingredient->unit} at ₱" . number_format($validated['cost_per_unit'], 2) . "/unit",
            ]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => "Added {$validated['quantity']} {$ingredient->unit} to {$ingredient->name}. New average cost: ₱" . number_format($newCost, 2),
                'ingredient' => [
                    'id' => $ingredient->id,
                    'name' => $ingredient->name,
                    'current_stock' => $newQuantity,
                    'cost_per_unit' => round($newCost, 2),
                ],
                'ingredients' => $this->getAllIngredientsWithStock(),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to add stock: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to add stock: ' . $e->getMessage(),
            ], 500);
        }
    }
    
    public function saveRecipe(Request $request, Item $item)
    {
        $validated = $request->validate([
            'ingredients' => 'required|array|min:1',
            'ingredients.*.id' => 'required|exists:ingredients,id',
            'ingredients.*.quantity_required' => 'required|numeric|min:0.001',
            'ingredients.*.unit' => 'nullable|string',
            'ingredients.*.notes' => 'nullable|string',
        ]);
        
        try {
            DB::beginTransaction();
            
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
            
            return response()->json([
                'success' => true,
                'message' => 'Recipe saved successfully!',
                'item' => $item->load('ingredients'),
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
    
    public function getItemRecipe(Item $item)
    {
        $item->load(['category', 'ingredients']);
        
        return response()->json([
            'success' => true,
            'item' => $item,
        ]);
    }
    
    public function checkAvailability(Request $request, Item $item)
    {
        $quantity = (float) $request->get('quantity', 1);
        $item->load('ingredients');
        
        $insufficient = [];
        $totalCost = 0;
        $maxPossible = null;
        
        foreach ($item->ingredients as $ingredient) {
            $required = (float) $ingredient->pivot->quantity_required * $quantity;
            
            $stock = $this->getIngredientStock($ingredient->id);
            $available = $stock;
            
            $costPerUnit = $this->getIngredientCost($ingredient->id);
            $totalCost += $required * $costPerUnit;
            
            $possibleForThis = floor($available / (float) $ingredient->pivot->quantity_required);
            if ($maxPossible === null || $possibleForThis < $maxPossible) {
                $maxPossible = $possibleForThis;
            }
            
            if ($available < $required) {
                $insufficient[] = [
                    'id' => $ingredient->id,
                    'name' => $ingredient->name,
                    'required' => round($required, 2),
                    'available' => (int) $available,
                    'unit' => $ingredient->unit,
                    'shortage' => round($required - $available, 2),
                ];
            }
        }
        
        return response()->json([
            'success' => true,
            'available' => empty($insufficient),
            'insufficient_ingredients' => $insufficient,
            'total_cost' => round($totalCost, 2),
            'max_possible' => (int) $maxPossible ?? 0,
        ]);
    }
    
    public function getLowStockAlerts(Request $request)
    {
        $ingredients = $this->getAllIngredientsWithStock();
        
        $lowStock = collect($ingredients)->filter(function($ing) {
            return $ing['current_stock'] <= $ing['min_stock'] && $ing['current_stock'] > 0;
        })->values();
        
        $outOfStock = collect($ingredients)->filter(function($ing) {
            return $ing['current_stock'] <= 0;
        })->values();
        
        return response()->json([
            'success' => true,
            'low_stock' => $lowStock,
            'out_of_stock' => $outOfStock,
            'total_alerts' => $lowStock->count() + $outOfStock->count(),
        ]);
    }
    
    public function getTransactions(Request $request)
    {
        $transactions = InventoryTransaction::with(['ingredient', 'user', 'pool'])
            ->when($request->ingredient_id, function($q, $id) {
                $q->where('ingredient_id', $id);
            })
            ->when($request->start_date, function($q, $date) {
                $q->whereDate('created_at', '>=', $date);
            })
            ->when($request->end_date, function($q, $date) {
                $q->whereDate('created_at', '<=', $date);
            })
            ->orderBy('created_at', 'desc')
            ->paginate(50);
        
        return response()->json([
            'success' => true,
            'transactions' => $transactions,
        ]);
    }
    
    public function getReceipt(PurchaseReceipt $receipt)
    {
        $receipt->load(['items.ingredient', 'user', 'pool']);
        
        return response()->json([
            'success' => true,
            'receipt' => $receipt,
        ]);
    }
    
    private function getAllIngredientsWithStock(): array
    {
        $restoPool = InventoryPool::where('code', 'resto')->first();
        $kitchenPool = InventoryPool::where('code', 'kitchen')->first();
        
        $ingredients = Ingredient::with('category')->orderBy('name')->get();
        $result = [];
        
        foreach ($ingredients as $ingredient) {
            $restoStock = $restoPool ? $ingredient->stocks()->where('inventory_pool_id', $restoPool->id)->first() : null;
            $kitchenStock = $kitchenPool ? $ingredient->stocks()->where('inventory_pool_id', $kitchenPool->id)->first() : null;
            
            $pool = null;
            $currentStock = 0;
            $costPerUnit = 0;
            
            if ($restoStock && $restoStock->quantity > 0) {
                $pool = 'resto';
                $currentStock = (int) $restoStock->quantity;
                $costPerUnit = (float) $restoStock->cost_per_unit;
            } elseif ($kitchenStock && $kitchenStock->quantity > 0) {
                $pool = 'kitchen';
                $currentStock = (int) $kitchenStock->quantity;
                $costPerUnit = (float) $kitchenStock->cost_per_unit;
            } elseif ($restoStock) {
                $pool = 'resto';
                $currentStock = (int) $restoStock->quantity;
                $costPerUnit = (float) $restoStock->cost_per_unit;
            } elseif ($kitchenStock) {
                $pool = 'kitchen';
                $currentStock = (int) $kitchenStock->quantity;
                $costPerUnit = (float) $kitchenStock->cost_per_unit;
            } else {
                $pool = null;
                $currentStock = 0;
                $costPerUnit = 0;
            }
            
            $totalValue = $currentStock * $costPerUnit;
            $categoryName = null;
            if ($ingredient->category_id) {
                $categoryName = is_object($ingredient->category) ? $ingredient->category->name : $ingredient->category;
            }
            
            $result[] = [
                'id' => $ingredient->id,
                'name' => $ingredient->name,
                'unit' => $ingredient->unit,
                'category_id' => $ingredient->category_id,
                'category' => $categoryName,
                'pool' => $pool,
                'current_stock' => $currentStock,
                'min_stock' => (int) ($ingredient->min_stock ?? 0),
                'cost_per_unit' => $costPerUnit,
                'total_value' => $totalValue,
                'status' => $this->getStockStatus($currentStock, (int) ($ingredient->min_stock ?? 0)),
                'price_range' => $this->getPriceRange($ingredient->id, $costPerUnit),
            ];
        }
        
        return $result;
    }
    
    private function getPriceRange(int $ingredientId, float $currentCost = 0): ?array
    {
        $receiptPrices = PurchaseReceiptItem::where('ingredient_id', $ingredientId)
            ->select('cost_per_unit')
            ->distinct()
            ->orderBy('cost_per_unit')
            ->get()
            ->pluck('cost_per_unit')
            ->toArray();
        
        $allPrices = $receiptPrices;
        
        if ($currentCost > 0 && !in_array($currentCost, $allPrices)) {
            $allPrices[] = $currentCost;
            sort($allPrices);
        }
        
        if (empty($allPrices)) {
            return null;
        }
        
        $min = min($allPrices);
        $max = max($allPrices);
        
        if ($min == $max) {
            return ['single' => $min];
        }
        
        return ['min' => $min, 'max' => $max];
    }
    
    private function getIngredientStock(int $ingredientId): int
    {
        $restoPool = InventoryPool::where('code', 'resto')->first();
        $kitchenPool = InventoryPool::where('code', 'kitchen')->first();
        
        $total = 0;
        
        if ($restoPool) {
            $restoStock = IngredientStock::where('ingredient_id', $ingredientId)
                ->where('inventory_pool_id', $restoPool->id)
                ->first();
            $total += (int) ($restoStock->quantity ?? 0);
        }
        
        if ($kitchenPool) {
            $kitchenStock = IngredientStock::where('ingredient_id', $ingredientId)
                ->where('inventory_pool_id', $kitchenPool->id)
                ->first();
            $total += (int) ($kitchenStock->quantity ?? 0);
        }
        
        return $total;
    }
    
    private function getIngredientCost(int $ingredientId): float
    {
        $restoPool = InventoryPool::where('code', 'resto')->first();
        
        if ($restoPool) {
            $stock = IngredientStock::where('ingredient_id', $ingredientId)
                ->where('inventory_pool_id', $restoPool->id)
                ->first();
            
            if ($stock && $stock->cost_per_unit > 0) {
                return (float) $stock->cost_per_unit;
            }
        }
        
        return 0;
    }
    
    private function getStockStatus(int $current, int $min): string
    {
        if ($current <= 0) return 'out_of_stock';
        if ($current <= $min * 0.5) return 'critical';
        if ($current <= $min) return 'low';
        return 'good';
    }
    
    public function getStockValue(Request $request)
    {
        $ingredients = $this->getAllIngredientsWithStock();
        $total = collect($ingredients)->sum('total_value');
        
        $byCategory = collect($ingredients)
            ->groupBy(fn($i) => $i['category'] ?: 'Uncategorized')
            ->map(fn($g, $cat) => [
                'category' => $cat,
                'count'    => $g->count(),
                'value'    => round($g->sum('total_value'), 2),
            ])->values();
        
        $byPool = collect($ingredients)
            ->groupBy(fn($i) => $i['pool'] ?: 'unassigned')
            ->map(fn($g, $pool) => [
                'pool'  => $pool,
                'count' => $g->count(),
                'value' => round($g->sum('total_value'), 2),
            ])->values();
        
        return response()->json([
            'success'    => true,
            'stockValue' => [
                'total_value'        => round($total, 2),
                'by_category'        => $byCategory,
                'by_pool'            => $byPool,
                'ingredient_values'  => collect($ingredients)->map(fn($i) => [
                    'id'            => $i['id'],
                    'name'          => $i['name'],
                    'unit'          => $i['unit'],
                    'category'      => $i['category'],
                    'pool'          => $i['pool'],
                    'current_stock' => $i['current_stock'],
                    'cost_per_unit' => $i['cost_per_unit'],
                    'total_value'   => round($i['total_value'], 2),
                    'status'        => $i['status'],
                ])->values(),
            ],
        ]);
    }
    
    public function storeStockReturn(Request $request)
    {
        $validated = $request->validate([
            'ingredient_id' => 'required|exists:ingredients,id',
            'pool'          => 'required|string|in:resto,kitchen',
            'quantity'      => 'required|integer|min:1',
            'reason'        => 'nullable|string|max:500',
            'notes'         => 'nullable|string|max:1000',
        ]);
        
        try {
            DB::beginTransaction();
            $pool  = InventoryPool::where('code', $validated['pool'])->firstOrFail();
            $stock = IngredientStock::where('ingredient_id', $validated['ingredient_id'])
                ->where('inventory_pool_id', $pool->id)->firstOrFail();
            
            if ($stock->quantity < $validated['quantity']) {
                return response()->json(['success' => false, 'message' => 'Return quantity exceeds available stock.'], 422);
            }
            
            $stock->quantity -= $validated['quantity'];
            $stock->save();
            
            InventoryTransaction::create([
                'ingredient_id'     => $validated['ingredient_id'],
                'inventory_pool_id' => $pool->id,
                'quantity_delta'    => -$validated['quantity'],
                'reason'            => 'stock_return',
                'user_id'           => auth()->id(),
                'notes'             => $validated['notes'] ?? $validated['reason'] ?? 'Stock return',
            ]);
            
            DB::commit();
            return response()->json(['success' => true, 'message' => 'Stock return recorded.', 'ingredients' => $this->getAllIngredientsWithStock()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    public function getStockReturns(Request $request)
    {
        $records = InventoryTransaction::with(['ingredient', 'user', 'pool'])
            ->where('reason', 'stock_return')
            ->orderBy('created_at', 'desc')
            ->limit((int) $request->get('limit', 50))
            ->get()
            ->map(fn($t) => [
                'id'         => $t->id,
                'ingredient' => $t->ingredient?->name ?? '—',
                'unit'       => $t->ingredient?->unit ?? '',
                'pool'       => $t->pool?->name ?? '—',
                'quantity'   => abs($t->quantity_delta),
                'notes'      => $t->notes,
                'user'       => $t->user?->name ?? 'System',
                'created_at' => $t->created_at->toISOString(),
            ]);
        
        return response()->json(['success' => true, 'records' => $records]);
    }
    
    public function submitStockTake(Request $request)
    {
        $validated = $request->validate([
            'batch_label' => 'nullable|string|max:255',
            'notes'       => 'nullable|string',
            'items'       => 'required|array|min:1',
            'items.*.ingredient_id'    => 'required|exists:ingredients,id',
            'items.*.pool'             => 'required|string|in:resto,kitchen',
            'items.*.counted_quantity' => 'required|integer|min:0',
        ]);
        
        try {
            DB::beginTransaction();
            $batchLabel  = $validated['batch_label'] ?? 'Stock Take ' . now()->format('Y-m-d H:i');
            $adjustments = [];
            
            foreach ($validated['items'] as $item) {
                $pool  = InventoryPool::where('code', $item['pool'])->first();
                if (!$pool) continue;
                
                $stock     = IngredientStock::where('ingredient_id', $item['ingredient_id'])
                    ->where('inventory_pool_id', $pool->id)->first();
                $systemQty  = $stock ? (int) $stock->quantity : 0;
                $countedQty = (int) $item['counted_quantity'];
                $delta      = $countedQty - $systemQty;
                
                if ($stock) {
                    $stock->quantity = $countedQty;
                    $stock->save();
                } else {
                    IngredientStock::create([
                        'ingredient_id'     => $item['ingredient_id'],
                        'inventory_pool_id' => $pool->id,
                        'quantity'          => $countedQty,
                        'cost_per_unit'     => 0,
                    ]);
                }
                
                InventoryTransaction::create([
                    'ingredient_id'     => $item['ingredient_id'],
                    'inventory_pool_id' => $pool->id,
                    'quantity_delta'    => $delta,
                    'reason'            => 'stock_take',
                    'user_id'           => auth()->id(),
                    'notes'             => "{$batchLabel}: System={$systemQty}, Counted={$countedQty}, Variance={$delta}. " . ($validated['notes'] ?? ''),
                ]);
                
                $adjustments[] = ['ingredient_id' => $item['ingredient_id'], 'system_qty' => $systemQty, 'counted_qty' => $countedQty, 'variance' => $delta];
            }
            
            DB::commit();
            return response()->json(['success' => true, 'message' => "Stock take completed: {$batchLabel}", 'adjustments' => $adjustments, 'ingredients' => $this->getAllIngredientsWithStock()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    public function getStockTakes(Request $request)
    {
        $records = InventoryTransaction::with(['ingredient', 'user', 'pool'])
            ->where('reason', 'stock_take')
            ->orderBy('created_at', 'desc')
            ->limit((int) $request->get('limit', 50))
            ->get()
            ->map(fn($t) => [
                'id'             => $t->id,
                'ingredient'     => $t->ingredient?->name ?? '—',
                'unit'           => $t->ingredient?->unit ?? '',
                'pool'           => $t->pool?->name ?? '—',
                'quantity_delta' => $t->quantity_delta,
                'notes'          => $t->notes,
                'user'           => $t->user?->name ?? 'System',
                'created_at'     => $t->created_at->toISOString(),
            ]);
        
        return response()->json(['success' => true, 'records' => $records]);
    }
    
    public function storeStockLoss(Request $request)
    {
        $validated = $request->validate([
            'ingredient_id' => 'required|exists:ingredients,id',
            'pool'          => 'required|string|in:resto,kitchen',
            'quantity'      => 'required|integer|min:1',
            'loss_type'     => 'required|string|in:spoilage,breakage,theft,other',
            'notes'         => 'nullable|string|max:1000',
        ]);
        
        try {
            DB::beginTransaction();
            $pool  = InventoryPool::where('code', $validated['pool'])->firstOrFail();
            $stock = IngredientStock::where('ingredient_id', $validated['ingredient_id'])
                ->where('inventory_pool_id', $pool->id)->firstOrFail();
            
            $deduct = min($validated['quantity'], (int) $stock->quantity);
            $stock->quantity -= $deduct;
            $stock->save();
            
            InventoryTransaction::create([
                'ingredient_id'     => $validated['ingredient_id'],
                'inventory_pool_id' => $pool->id,
                'quantity_delta'    => -$deduct,
                'reason'            => 'stock_loss',
                'user_id'           => auth()->id(),
                'notes'             => "[{$validated['loss_type']}] " . ($validated['notes'] ?? 'Stock loss recorded'),
            ]);
            
            DB::commit();
            return response()->json(['success' => true, 'message' => 'Stock loss recorded.', 'ingredients' => $this->getAllIngredientsWithStock()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    public function getStockLosses(Request $request)
    {
        $records = InventoryTransaction::with(['ingredient', 'user', 'pool'])
            ->where('reason', 'stock_loss')
            ->orderBy('created_at', 'desc')
            ->limit((int) $request->get('limit', 50))
            ->get()
            ->map(fn($t) => [
                'id'         => $t->id,
                'ingredient' => $t->ingredient?->name ?? '—',
                'unit'       => $t->ingredient?->unit ?? '',
                'pool'       => $t->pool?->name ?? '—',
                'quantity'   => abs($t->quantity_delta),
                'notes'      => $t->notes,
                'user'       => $t->user?->name ?? 'System',
                'created_at' => $t->created_at->toISOString(),
            ]);
        
        return response()->json(['success' => true, 'records' => $records]);
    }
    
    public function transferStock(Request $request)
    {
        $validated = $request->validate([
            'ingredient_id' => 'required|exists:ingredients,id',
            'from_pool'     => 'required|string|in:resto,kitchen',
            'to_pool'       => 'required|string|in:resto,kitchen',
            'quantity'      => 'required|integer|min:1',
            'notes'         => 'nullable|string|max:1000',
        ]);
        
        if ($validated['from_pool'] === $validated['to_pool']) {
            return response()->json(['success' => false, 'message' => 'Source and destination pools must differ.'], 422);
        }
        
        try {
            DB::beginTransaction();
            $fromPool  = InventoryPool::where('code', $validated['from_pool'])->firstOrFail();
            $toPool    = InventoryPool::where('code', $validated['to_pool'])->firstOrFail();
            $fromStock = IngredientStock::where('ingredient_id', $validated['ingredient_id'])
                ->where('inventory_pool_id', $fromPool->id)->firstOrFail();
            
            if ($fromStock->quantity < $validated['quantity']) {
                return response()->json(['success' => false, 'message' => 'Transfer quantity exceeds available stock.'], 422);
            }
            
            $fromStock->quantity -= $validated['quantity'];
            $fromStock->save();
            
            $toStock = IngredientStock::firstOrCreate(
                ['ingredient_id' => $validated['ingredient_id'], 'inventory_pool_id' => $toPool->id],
                ['quantity' => 0, 'cost_per_unit' => $fromStock->cost_per_unit]
            );
            $toStock->quantity += $validated['quantity'];
            $toStock->save();
            
            $ingredient = Ingredient::find($validated['ingredient_id']);
            $note = "Transfer {$validated['quantity']} {$ingredient->unit} from {$validated['from_pool']} → {$validated['to_pool']}. " . ($validated['notes'] ?? '');
            
            InventoryTransaction::create(['ingredient_id' => $validated['ingredient_id'], 'inventory_pool_id' => $fromPool->id, 'quantity_delta' => -$validated['quantity'], 'reason' => 'stock_transfer_out', 'user_id' => auth()->id(), 'notes' => $note]);
            InventoryTransaction::create(['ingredient_id' => $validated['ingredient_id'], 'inventory_pool_id' => $toPool->id,   'quantity_delta' =>  $validated['quantity'], 'reason' => 'stock_transfer_in',  'user_id' => auth()->id(), 'notes' => $note]);
            
            DB::commit();
            return response()->json(['success' => true, 'message' => "Transferred {$validated['quantity']} {$ingredient->unit} of {$ingredient->name}.", 'ingredients' => $this->getAllIngredientsWithStock()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    public function getStockTransfers(Request $request)
    {
        $records = InventoryTransaction::with(['ingredient', 'user', 'pool'])
            ->whereIn('reason', ['stock_transfer_out', 'stock_transfer_in'])
            ->orderBy('created_at', 'desc')
            ->limit((int) $request->get('limit', 50))
            ->get()
            ->map(fn($t) => [
                'id'         => $t->id,
                'ingredient' => $t->ingredient?->name ?? '—',
                'unit'       => $t->ingredient?->unit ?? '',
                'pool'       => $t->pool?->name ?? '—',
                'direction'  => $t->reason === 'stock_transfer_out' ? 'out' : 'in',
                'quantity'   => abs($t->quantity_delta),
                'notes'      => $t->notes,
                'user'       => $t->user?->name ?? 'System',
                'created_at' => $t->created_at->toISOString(),
            ]);
        
        return response()->json(['success' => true, 'records' => $records]);
    }
    
    public function getAuditTrailData(Request $request)
    {
        $records = InventoryTransaction::with(['ingredient', 'user', 'pool'])
            ->when($request->ingredient_id, fn($q, $id) => $q->where('ingredient_id', $id))
            ->when($request->reason, fn($q, $r) => $q->where('reason', $r))
            ->when($request->start_date, fn($q, $d) => $q->whereDate('created_at', '>=', $d))
            ->when($request->end_date,   fn($q, $d) => $q->whereDate('created_at', '<=', $d))
            ->orderBy('created_at', 'desc')
            ->limit((int) $request->get('limit', 100))
            ->get()
            ->map(fn($t) => [
                'id'             => $t->id,
                'ingredient'     => $t->ingredient?->name ?? '—',
                'unit'           => $t->ingredient?->unit ?? '',
                'pool'           => $t->pool?->name ?? '—',
                'quantity_delta' => $t->quantity_delta,
                'reason'         => $t->reason,
                'notes'          => $t->notes,
                'user'           => $t->user?->name ?? 'System',
                'created_at'     => $t->created_at->toISOString(),
            ]);
        
        return response()->json(['success' => true, 'records' => $records]);
    }
    
    public function storeWastage(Request $request)
    {
        $validated = $request->validate([
            'ingredient_id'  => 'required|exists:ingredients,id',
            'pool'           => 'required|string|in:resto,kitchen',
            'quantity'       => 'required|numeric|min:0.01',
            'wastage_reason' => 'nullable|string|max:500',
            'notes'          => 'nullable|string|max:1000',
        ]);
        
        try {
            DB::beginTransaction();
            $pool  = InventoryPool::where('code', $validated['pool'])->firstOrFail();
            $stock = IngredientStock::where('ingredient_id', $validated['ingredient_id'])
                ->where('inventory_pool_id', $pool->id)->firstOrFail();
            
            $deduct = min((float) $validated['quantity'], (float) $stock->quantity);
            $stock->quantity = max(0, $stock->quantity - $deduct);
            $stock->save();
            
            InventoryTransaction::create([
                'ingredient_id'     => $validated['ingredient_id'],
                'inventory_pool_id' => $pool->id,
                'quantity_delta'    => -$deduct,
                'reason'            => 'wastage',
                'user_id'           => auth()->id(),
                'notes'             => ($validated['wastage_reason'] ? "[{$validated['wastage_reason']}] " : '') . ($validated['notes'] ?? 'Wastage recorded'),
            ]);
            
            DB::commit();
            return response()->json(['success' => true, 'message' => 'Wastage recorded.', 'ingredients' => $this->getAllIngredientsWithStock()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    public function getWastageData(Request $request)
    {
        $records = InventoryTransaction::with(['ingredient', 'user', 'pool'])
            ->where('reason', 'wastage')
            ->orderBy('created_at', 'desc')
            ->limit((int) $request->get('limit', 50))
            ->get()
            ->map(fn($t) => [
                'id'         => $t->id,
                'ingredient' => $t->ingredient?->name ?? '—',
                'unit'       => $t->ingredient?->unit ?? '',
                'pool'       => $t->pool?->name ?? '—',
                'quantity'   => abs($t->quantity_delta),
                'notes'      => $t->notes,
                'user'       => $t->user?->name ?? 'System',
                'created_at' => $t->created_at->toISOString(),
            ]);
        
        return response()->json(['success' => true, 'records' => $records]);
    }
}