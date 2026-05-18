<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Fix item_ingredients rows where:
     * - unit is NULL (was never saved)
     * - quantity_required is > 1 but the ingredient stock unit is 'kg' or 'l'
     *
     * In those cases the value was entered in grams/ml but stored without conversion.
     * We divide by 1000 and set unit = stock unit.
     */
    public function up(): void
    {
        $rows = DB::table('item_ingredients')
            ->join('ingredients', 'item_ingredients.ingredient_id', '=', 'ingredients.id')
            ->whereNull('item_ingredients.unit')
            ->whereIn('ingredients.unit', ['kg', 'l'])
            ->where('item_ingredients.quantity_required', '>', 1)
            ->select(
                'item_ingredients.item_id',
                'item_ingredients.ingredient_id',
                'item_ingredients.quantity_required',
                'ingredients.unit as stock_unit',
                'ingredients.name as ingredient_name'
            )
            ->get();

        foreach ($rows as $row) {
            $converted = round($row->quantity_required / 1000, 6);
            Log::info("Fixing recipe: {$row->ingredient_name} {$row->quantity_required} → {$converted} {$row->stock_unit}");

            DB::table('item_ingredients')
                ->where('item_id', $row->item_id)
                ->where('ingredient_id', $row->ingredient_id)
                ->update([
                    'quantity_required' => $converted,
                    'unit' => $row->stock_unit,
                ]);
        }
    }

    public function down(): void
    {
        // Irreversible — log was written so you can restore manually if needed
    }
};