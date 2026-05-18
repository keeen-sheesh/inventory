<?php
// app/Http/Controllers/Admin/KitchenCategoryController.php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\KitchenCategory;
use App\Models\KitchenItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class KitchenCategoryController extends Controller
{
    /**
     * Display a listing of the resource (Inertia view)
     */
    public function index()
    {
        $categories = KitchenCategory::orderBy('sort_order', 'asc')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($category) {
                return [
                    'id' => $category->id,
                    'name' => $category->name,
                    'description' => $category->description,
                    'is_active' => (bool)$category->is_active,
                    'sort_order' => $category->sort_order,
                    'items_count' => $category->items()->count(),
                ];
            });
            
        $items = KitchenItem::with('category')
            ->orderBy('kitchen_category_id')
            ->orderBy('sort_order', 'asc')
            ->orderBy('name')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'description' => $item->description,
                    'price' => (float) $item->price,
                    'kitchen_category_id' => $item->kitchen_category_id,
                    'category_name' => $item->category->name ?? '',
                    'is_available' => (bool) $item->is_available,
                    'is_featured' => (bool) $item->is_featured,
                    'stock_quantity' => $item->stock_quantity ?? 0,
                    'low_stock_threshold' => $item->low_stock_threshold ?? 10,
                    'sort_order' => $item->sort_order ?? 999,
                    'image' => $item->image,
                    'pricing_type' => $item->pricing_type ?? 'single',
                    'price_solo' => $item->price_solo ? (float) $item->price_solo : null,
                    'price_whole' => $item->price_whole ? (float) $item->price_whole : null,
                    'has_recipe' => (bool) $item->has_recipe,
                ];
            });
        
        // Get stats
        $stats = $this->getStats();
        
        return Inertia::render('Admin/KitchenItems/Categories', [
            'categories' => $categories,
            'items' => $items,
            'total_categories' => $stats['total_categories'],
            'total_items' => $stats['total_items'],
            'active_categories' => $stats['active_categories'],
            'available_items' => $stats['available_items'],
        ]);
    }

    /**
     * API endpoint for real-time updates
     */
    public function apiIndex(Request $request)
    {
        $categories = KitchenCategory::orderBy('sort_order', 'asc')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($category) {
                return [
                    'id' => $category->id,
                    'name' => $category->name,
                    'description' => $category->description,
                    'is_active' => (bool)$category->is_active,
                    'sort_order' => $category->sort_order,
                    'items_count' => $category->items()->count(),
                ];
            });
            
        return response()->json([
            'success' => true,
            'categories' => $categories
        ]);
    }

    /**
     * Store a newly created category
     */
    public function store(Request $request)
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:kitchen_categories,name',
                'description' => 'nullable|string|max:500',
            ]);
            
            // Get the max sort_order and add 1
            $maxOrder = KitchenCategory::max('sort_order') ?? 0;
            
            $category = KitchenCategory::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'sort_order' => $maxOrder + 1,
                'is_active' => true,
            ]);
            
            DB::commit();

            // Broadcast update to POS
            $this->broadcastMenuUpdate();
            
            // Get updated stats
            $stats = $this->getStats();
            
            return response()->json([
                'success' => true,
                'message' => 'Kitchen category added successfully!',
                'category' => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'description' => $category->description,
                    'is_active' => (bool)$category->is_active,
                    'sort_order' => $category->sort_order,
                    'items_count' => 0,
                ],
                'stats' => $stats,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create kitchen category: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to create category: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified category
     */
    public function update(Request $request, KitchenCategory $category)
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:kitchen_categories,name,' . $category->id,
                'description' => 'nullable|string|max:500',
            ]);
            
            $category->update([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
            ]);
            
            DB::commit();

            // Broadcast update to POS
            $this->broadcastMenuUpdate();
            
            return response()->json([
                'success' => true,
                'message' => 'Kitchen category updated successfully!',
                'category' => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'description' => $category->description,
                    'is_active' => (bool)$category->is_active,
                    'sort_order' => $category->sort_order,
                    'items_count' => $category->items()->count(),
                ],
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update kitchen category: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update category: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified category
     */
    public function destroy(KitchenCategory $category)
    {
        try {
            DB::beginTransaction();

            // Check if category has items
            if ($category->items()->count() > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete category with existing menu items. Please delete or reassign items first.',
                ], 400);
            }
            
            $category->delete();
            
            DB::commit();

            // Broadcast update to POS
            $this->broadcastMenuUpdate();
            
            $stats = $this->getStats();
            
            return response()->json([
                'success' => true,
                'message' => 'Kitchen category deleted successfully!',
                'stats' => $stats,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to delete kitchen category: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete category: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle category active status
     */
    public function toggleStatus(Request $request, KitchenCategory $category)
    {
        try {
            DB::beginTransaction();

            $category->update([
                'is_active' => !$category->is_active,
            ]);
            
            DB::commit();

            // Broadcast update to POS
            $this->broadcastMenuUpdate();
            
            $stats = $this->getStats();
            
            return response()->json([
                'success' => true,
                'message' => 'Kitchen category status updated!',
                'is_active' => $category->is_active,
                'stats' => $stats,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to toggle kitchen category status: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update category status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update category order (for drag & drop)
     */
    public function updateOrder(Request $request)
    {
        try {
            DB::beginTransaction();
            
            $request->validate([
                'categories' => 'required|array',
                'categories.*.id' => 'required|exists:kitchen_categories,id',
                'categories.*.sort_order' => 'required|integer|min:1',
            ]);
            
            foreach ($request->categories as $categoryData) {
                KitchenCategory::where('id', $categoryData['id'])
                    ->update(['sort_order' => $categoryData['sort_order']]);
            }
            
            DB::commit();

            // Broadcast update to POS
            $this->broadcastMenuUpdate();
            
            return response()->json([
                'success' => true,
                'message' => 'Order updated successfully!',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update kitchen category order: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update order: ' . $e->getMessage()
            ], 500);
        }
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
            Log::info('Kitchen category menu update broadcasted', ['timestamp' => now()->timestamp]);
        } catch (\Exception $e) {
            Log::error('Failed to broadcast menu update: ' . $e->getMessage());
        }
    }
}

