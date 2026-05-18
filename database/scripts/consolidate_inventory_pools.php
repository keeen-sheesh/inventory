<?php
// database/scripts/consolidate_inventory_pools.php
// Run once: php artisan tinker --execute="require base_path('database/scripts/consolidate_inventory_pools.php');"

use App\Models\IngredientStock;
use App\Models\InventoryPool;
use Illuminate\Support\Facades\DB;

echo "=== Inventory Pool Consolidation ===\n\n";

$restoPool  = InventoryPool::where('code', 'resto')->first();
$kitchenPool = InventoryPool::where('code', 'kitchen')->first();

if (!$restoPool) {
    echo "ERROR: 'resto' pool not found. Aborting.\n";
    return;
}

if (!$kitchenPool) {
    echo "No 'kitchen' pool found — nothing to consolidate.\n";
    return;
}

echo "Resto pool ID:   {$restoPool->id}\n";
echo "Kitchen pool ID: {$kitchenPool->id}\n\n";

$kitchenStocks = IngredientStock::where('inventory_pool_id', $kitchenPool->id)
    ->where('quantity', '>', 0)
    ->get();

echo "Kitchen stock entries with quantity > 0: {$kitchenStocks->count()}\n\n";

DB::beginTransaction();
try {
    $merged   = 0;
    $skipped  = 0;

    foreach ($kitchenStocks as $ks) {
        $restoStock = IngredientStock::where('ingredient_id', $ks->ingredient_id)
            ->where('inventory_pool_id', $restoPool->id)
            ->first();

        if ($restoStock) {
            $oldQty     = $restoStock->quantity;
            $newQty     = $oldQty + $ks->quantity;
            $newMinStock = max((float)$restoStock->min_stock, (float)$ks->min_stock);
            // Keep whichever cost_per_unit is non-zero; prefer resto's
            $newCost    = (float)$restoStock->cost_per_unit > 0
                ? $restoStock->cost_per_unit
                : $ks->cost_per_unit;

            $restoStock->update([
                'quantity'      => $newQty,
                'min_stock'     => $newMinStock,
                'cost_per_unit' => $newCost,
            ]);

            echo "  Merged ingredient #{$ks->ingredient_id}: "
               . "{$oldQty} (resto) + {$ks->quantity} (kitchen) = {$newQty}\n";
            $merged++;
        } else {
            // No resto entry — reassign this stock row to resto pool
            $ks->update(['inventory_pool_id' => $restoPool->id]);
            echo "  Reassigned ingredient #{$ks->ingredient_id}: "
               . "moved {$ks->quantity} from kitchen → resto pool\n";
            $merged++;
        }
    }

    // Zero-out all remaining kitchen pool entries (quantity already 0, just clean min_stock)
    $zeroed = IngredientStock::where('inventory_pool_id', $kitchenPool->id)->count();
    IngredientStock::where('inventory_pool_id', $kitchenPool->id)
        ->update(['quantity' => 0, 'min_stock' => 0]);

    echo "\nZeroed out {$zeroed} kitchen pool stock entries.\n";
    echo "Merged / reassigned: {$merged}\n";

    DB::commit();
    echo "\n✓ Consolidation complete. All stock is now in the shared 'resto' pool.\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "\n✗ ERROR: " . $e->getMessage() . "\n";
    echo "All changes rolled back — nothing was modified.\n";
}