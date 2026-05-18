<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\ItemSize;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ItemSizeController extends Controller
{
    /**
     * Get all sizes for a specific item
     */
    public function getItemSizes(Item $item)
    {
        try {
            $sizes = $item->itemSizes()->with('size')->get()->map(function($itemSize) {
                return [
                    'id' => $itemSize->id,
                    'size_id' => $itemSize->size_id,
                    'size_name' => $itemSize->size->name,
                    'display_name' => $itemSize->size->display_name,
                    'price' => (float) $itemSize->price,
                    'additional_price' => (float) $itemSize->additional_price,
                ];
            });

            return response()->json([
                'success' => true,
                'sizes' => $sizes,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch item sizes: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch sizes',
            ], 500);
        }
    }

    /**
     * Store a new size for an item
     */
    public function store(Request $request, Item $item)
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'size_id' => 'required|exists:sizes,id',
                'price' => 'required|numeric|min:0',
                'additional_price' => 'nullable|numeric|min:0',
            ]);

            // Check if size already exists for this item
            $exists = ItemSize::where('item_id', $item->id)
                ->where('size_id', $validated['size_id'])
                ->exists();

            if ($exists) {
                return response()->json([
                    'success' => false,
                    'message' => 'This size already exists for this item',
                ], 400);
            }

            $itemSize = ItemSize::create([
                'item_id' => $item->id,
                'size_id' => $validated['size_id'],
                'price' => $validated['price'],
                'additional_price' => $validated['additional_price'] ?? 0,
            ]);

            $itemSize->load('size');

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Size added successfully',
                'size' => [
                    'id' => $itemSize->id,
                    'size_id' => $itemSize->size_id,
                    'size_name' => $itemSize->size->name,
                    'display_name' => $itemSize->size->display_name,
                    'price' => (float) $itemSize->price,
                    'additional_price' => (float) $itemSize->additional_price,
                ],
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to add item size: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to add size: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update an item size
     */
    public function update(Request $request, ItemSize $itemSize)
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'price' => 'required|numeric|min:0',
                'additional_price' => 'nullable|numeric|min:0',
            ]);

            $itemSize->update([
                'price' => $validated['price'],
                'additional_price' => $validated['additional_price'] ?? 0,
            ]);

            $itemSize->load('size');

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Size updated successfully',
                'size' => [
                    'id' => $itemSize->id,
                    'size_id' => $itemSize->size_id,
                    'size_name' => $itemSize->size->name,
                    'display_name' => $itemSize->size->display_name,
                    'price' => (float) $itemSize->price,
                    'additional_price' => (float) $itemSize->additional_price,
                ],
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update item size: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update size: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete an item size
     */
    public function destroy(ItemSize $itemSize)
    {
        try {
            DB::beginTransaction();

            $itemSize->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Size deleted successfully',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to delete item size: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete size: ' . $e->getMessage(),
            ], 500);
        }
    }
}