<?php

namespace App\Observers;

use App\Models\Ingredient;

class IngredientObserver
{
    /**
     * Handle the Ingredient "created" event.
     */
    public function created(Ingredient $ingredient): void
    {
        // Observers no longer auto-create stocks - handled by storeIngredient
        // Ingredients are pool-specific
    }

    /**
     * Handle the Ingredient "updated" event.
     */
    public function updated(Ingredient $ingredient): void
    {
        // Update cost_per_unit and min_stock in all related stocks if they changed
        if ($ingredient->isDirty(['cost_per_unit', 'min_stock'])) {
            try {
                $updateData = [];
                
                if ($ingredient->isDirty('cost_per_unit')) {
                    $updateData['cost_per_unit'] = $ingredient->cost_per_unit;
                }
                
                if ($ingredient->isDirty('min_stock')) {
                    $updateData['min_stock'] = $ingredient->min_stock;
                }
                
                if (!empty($updateData)) {
                    $ingredient->stocks()->update($updateData);
                }
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error('Failed to update ingredient stocks: ' . $e->getMessage());
            }
        }
    }

    /**
     * Handle the Ingredient "deleted" event.
     */
    public function deleted(Ingredient $ingredient): void
    {
        // Note: This is handled by cascadeOnDelete in the migration
    }
}
