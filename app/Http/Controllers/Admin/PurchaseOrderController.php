<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use App\Models\Ingredient;
use App\Models\IngredientStock;
use App\Models\InventoryPool;
use App\Models\InventoryTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PurchaseOrderController extends Controller
{
    /**
     * Display a listing of the purchase orders.
     */
    public function index(Request $request)
    {
        return redirect()->route('admin.inventory.index', ['tab' => 'purchase-orders']);
    }

    /**
     * Store a newly created purchase order.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'order_date' => 'required|date',
            'expected_delivery' => 'nullable|date',
            'notes' => 'nullable|string',
            'inventory_pool_code' => 'nullable|string|in:resto,kitchen',
            'items' => 'required|array|min:1',
            'items.*.ingredient_id' => 'required|exists:ingredients,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'required|numeric|min:0'
        ]);

        try {
            DB::beginTransaction();

            $subtotal = 0;
            foreach ($validated['items'] as $item) {
                $subtotal += $item['quantity'] * $item['unit_price'];
            }

            $tax = $subtotal * 0.12; // 12% tax
            $total = $subtotal + $tax;

            $purchaseOrder = PurchaseOrder::create([
                'po_number' => PurchaseOrder::generatePONumber(),
                'supplier_id' => $validated['supplier_id'],
                'order_date' => $validated['order_date'],
                'expected_delivery' => $validated['expected_delivery'] ?? null,
                'status' => 'pending',
                'inventory_pool_code' => $validated['inventory_pool_code'] ?? InventoryPool::RESTO,
                'subtotal' => $subtotal,
                'tax' => $tax,
                'total' => $total,
                'notes' => $validated['notes'] ?? null,
                'created_by' => auth()->id()
            ]);

            foreach ($validated['items'] as $item) {
                PurchaseOrderItem::create([
                    'purchase_order_id' => $purchaseOrder->id,
                    'ingredient_id' => $item['ingredient_id'],
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_price'],
                    'total_cost' => $item['quantity'] * $item['unit_price']
                ]);
            }

            DB::commit();

            return redirect()->back()->with('success', 'Purchase order created successfully.');
        } catch (\Exception $e) {
            DB::rollBack();
            return redirect()->back()->with('error', 'Failed to create purchase order: ' . $e->getMessage());
        }
    }

    /**
     * Display the specified purchase order.
     */
    public function show(PurchaseOrder $purchaseOrder)
    {
        $purchaseOrder->load(['supplier', 'items.ingredient']);

        return response()->json([
            'purchaseOrder' => $purchaseOrder
        ]);
    }

    /**
     * Update the specified purchase order.
     */
    public function update(Request $request, PurchaseOrder $purchaseOrder)
    {
        if (!in_array($purchaseOrder->status, ['pending', 'approved'])) {
            return redirect()->back()->with('error', 'Cannot update purchase order in current status.');
        }

        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'order_date' => 'required|date',
            'expected_delivery' => 'nullable|date',
            'notes' => 'nullable|string',
            'status' => 'in:pending,approved,cancelled'
        ]);

        $purchaseOrder->update($validated);

        return redirect()->back()->with('success', 'Purchase order updated successfully.');
    }

    /**
     * Receive the specified purchase order (mark as received and update inventory).
     */
    public function receive(Request $request, PurchaseOrder $purchaseOrder)
    {
        if ($purchaseOrder->status !== 'approved') {
            return redirect()->back()->with('error', 'Only approved purchase orders can be received.');
        }

        try {
            DB::beginTransaction();

            $poolId = $this->resolveInventoryPoolId((string) ($purchaseOrder->inventory_pool_code ?? InventoryPool::RESTO));

            $purchaseOrder->update([
                'status' => 'received',
                'delivery_date' => now()
            ]);

            $purchaseOrder->load('items.ingredient');

            // Update ingredient stock quantities
            foreach ($purchaseOrder->items as $item) {
                $ingredient = Ingredient::find($item->ingredient_id);
                if (!$ingredient) {
                    continue;
                }

                $stock = IngredientStock::where('ingredient_id', $item->ingredient_id)
                    ->where('inventory_pool_id', $poolId)
                    ->lockForUpdate()
                    ->first();

                if (!$stock) {
                    $stock = IngredientStock::create([
                        'ingredient_id' => $item->ingredient_id,
                        'inventory_pool_id' => $poolId,
                        'quantity' => 0,
                        'min_stock' => 0,
                        'cost_per_unit' => (float) $item->unit_cost,
                    ]);
                }

                $stock->quantity = (float) $stock->quantity + (float) $item->quantity;
                if ((float) $item->unit_cost > 0) {
                    $stock->cost_per_unit = (float) $item->unit_cost;
                }
                $stock->save();

                InventoryTransaction::create([
                    'ingredient_id' => (int) $item->ingredient_id,
                    'inventory_pool_id' => $poolId,
                    'quantity_delta' => (float) $item->quantity,
                    'reason' => 'purchase_receive',
                    'reference_type' => 'purchase_order',
                    'reference_id' => $item->id,
                    'user_id' => (int) auth()->id(),
                    'notes' => 'Stock-in from purchase order receipt',
                    'meta' => [
                        'po_number' => $purchaseOrder->po_number,
                        'unit_cost' => (float) $item->unit_cost,
                    ],
                ]);
            }

            DB::commit();

            return redirect()->back()->with('success', 'Purchase order received and inventory updated.');
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to receive purchase order', [
                'purchase_order_id' => $purchaseOrder->id ?? null,
                'error' => $e->getMessage(),
            ]);
            return redirect()->back()->with('error', 'Failed to receive purchase order: ' . $e->getMessage());
        }
    }

    /**
     * Remove the specified purchase order.
     */
    public function destroy(PurchaseOrder $purchaseOrder)
    {
        if ($purchaseOrder->status === 'received') {
            return redirect()->back()->with('error', 'Cannot delete received purchase orders.');
        }

        $purchaseOrder->delete();

        return redirect()->back()->with('success', 'Purchase order deleted successfully.');
    }

    /**
     * Get all purchase orders (API endpoint).
     */
    public function apiIndex()
    {
        $purchaseOrders = PurchaseOrder::with('supplier')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'purchaseOrders' => $purchaseOrders
        ]);
    }

    private function resolveInventoryPoolId(string $poolCode): int
    {
        $effectiveCode = in_array($poolCode, [InventoryPool::RESTO, InventoryPool::KITCHEN], true)
            ? $poolCode
            : InventoryPool::RESTO;

        $poolId = InventoryPool::where('code', $effectiveCode)->value('id');
        if ($poolId) {
            return (int) $poolId;
        }

        $fallback = InventoryPool::where('code', 'resto')->value('id')
            ?? InventoryPool::query()->value('id');

        return (int) ($fallback ?: 1);
    }
}
