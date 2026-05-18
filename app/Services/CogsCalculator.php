<?php

namespace App\Services;

use App\Models\Ingredient;
use App\Models\Item;
use App\Models\KitchenItem;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class CogsCalculator
{
    /**
     * Unit conversion factors to base units (kg for weight, l for volume, pcs for pieces)
     */
    private const UNIT_CONVERSIONS = [
        // Weight conversions to kg
        'kg' => ['kg' => 1, 'g' => 0.001, 'mg' => 0.000001, 'lb' => 0.453592, 'oz' => 0.0283495],
        'g' => ['kg' => 1000, 'g' => 1, 'mg' => 0.001, 'lb' => 453.592, 'oz' => 28.3495],
        
        // Volume conversions to liters
        'l' => ['l' => 1, 'ml' => 0.001, 'cl' => 0.01, 'fl_oz' => 0.0295735, 'cup' => 0.236588, 'tbsp' => 0.014787, 'tsp' => 0.004929],
        'ml' => ['l' => 1000, 'ml' => 1, 'cl' => 10, 'fl_oz' => 29.5735, 'cup' => 236.588, 'tbsp' => 67.628, 'tsp' => 202.884],
        
        // Pieces
        'pcs' => ['pcs' => 1, 'box' => 1, 'pack' => 1, 'dozen' => 12],
    ];

    /**
     * Calculate COGS for a menu item (Item model)
     * 
     * @param Item $item The menu item
     * @param array $options Options for calculation (e.g., portion type: 'solo' or 'whole')
     * @return float The calculated COGS
     */
    public function calculateItemCogs(Item $item, array $options = []): float
    {
        $totalCogs = 0.0;
        
        $item->load('ingredients');
        
        foreach ($item->ingredients as $ingredient) {
            $pivot = $ingredient->pivot;
            $quantityRequired = (float) ($pivot->quantity_required ?? 0);
            $recipeUnit = $pivot->unit ?? $ingredient->unit;
            
            // Handle portion-based pricing (solo/whole)
            $portionMultiplier = $this->getPortionMultiplier($options, $pivot);
            $adjustedQuantity = $quantityRequired * $portionMultiplier;
            
            $ingredientCost = $this->calculateIngredientCost(
                $ingredient,
                $adjustedQuantity,
                $recipeUnit
            );
            
            $totalCogs += $ingredientCost;
        }
        
        return round($totalCogs, 2);
    }

    /**
     * Calculate COGS for a kitchen item (KitchenItem model)
     * 
     * @param KitchenItem $item The kitchen menu item
     * @param array $options Options for calculation (e.g., size, temperature)
     * @return float The calculated COGS
     */
    public function calculateKitchenItemCogs(KitchenItem $item, array $options = []): float
    {
        $totalCogs = 0.0;
        
        $item->load('ingredients');
        
        foreach ($item->ingredients as $ingredient) {
            $pivot = $ingredient->pivot;
            $quantityRequired = (float) ($pivot->quantity_required ?? 0);
            $recipeUnit = $pivot->unit ?? $ingredient->unit;
            
            // Handle size-based adjustments
            $sizeMultiplier = $this->getSizeMultiplier($options, $pivot);
            $adjustedQuantity = $quantityRequired * $sizeMultiplier;
            
            $ingredientCost = $this->calculateIngredientCost(
                $ingredient,
                $adjustedQuantity,
                $recipeUnit
            );
            
            $totalCogs += $ingredientCost;
        }
        
        return round($totalCogs, 2);
    }

    /**
     * Calculate cost for a single ingredient based on quantity and unit
     * 
     * @param Ingredient $ingredient The ingredient
     * @param float $quantity Quantity needed
     * @param string $recipeUnit Unit in the recipe
     * @return float The calculated cost
     */
    public function calculateIngredientCost(Ingredient $ingredient, float $quantity, string $recipeUnit): float
    {
        // If ingredient has pieces_per_box and recipe uses pieces, use cost per piece
        if ($ingredient->pieces_per_box && $ingredient->pieces_per_box > 0) {
            if ($this->normalizeUnit($recipeUnit) === 'pcs') {
                return round($ingredient->cost_per_piece * $quantity, 2);
            }
        }
        
        // Get the stock unit for this ingredient
        $stockUnit = $this->normalizeUnit($ingredient->unit);
        $recipeUnitNormalized = $this->normalizeUnit($recipeUnit);
        
        // If units match, simple multiplication
        if ($recipeUnitNormalized === $stockUnit) {
            return round($ingredient->cost_per_unit * $quantity, 2);
        }
        
        // Convert recipe quantity to stock unit
        $convertedQuantity = $this->convertUnits($quantity, $recipeUnitNormalized, $stockUnit);
        
        return round($ingredient->cost_per_unit * $convertedQuantity, 2);
    }

    /**
     * Convert quantity from one unit to another
     * 
     * @param float $quantity The quantity to convert
     * @param string $fromUnit Source unit (normalized)
     * @param string $toUnit Target unit (normalized)
     * @return float Converted quantity
     */
    public function convertUnits(float $quantity, string $fromUnit, string $toUnit): float
    {
        // Same unit, no conversion needed
        if ($fromUnit === $toUnit) {
            return $quantity;
        }
        
        // Weight conversions (base: kg)
        $weightToKg = [
            'kg' => 1,
            'g' => 0.001,
            'mg' => 0.000001,
            'lb' => 0.453592,
            'oz' => 0.0283495,
        ];
        
        // Volume conversions (base: l)
        $volumeToL = [
            'l' => 1,
            'ml' => 0.001,
            'cl' => 0.01,
            'fl_oz' => 0.0295735,
            'cup' => 0.236588,
            'tbsp' => 0.014787,
            'tsp' => 0.004929,
        ];
        
        // Check if both units are weight units
        if (isset($weightToKg[$fromUnit]) && isset($weightToKg[$toUnit])) {
            // Convert to kg first, then to target unit
            $inKg = $quantity * $weightToKg[$fromUnit];
            return $inKg / $weightToKg[$toUnit];
        }
        
        // Check if both units are volume units
        if (isset($volumeToL[$fromUnit]) && isset($volumeToL[$toUnit])) {
            // Convert to liters first, then to target unit
            $inLiters = $quantity * $volumeToL[$fromUnit];
            return $inLiters / $volumeToL[$toUnit];
        }
        
        // If no conversion found, assume 1:1 ratio
        Log::warning("No conversion found from {$fromUnit} to {$toUnit}, using 1:1 ratio");
        return $quantity;
    }

    /**
     * Get portion multiplier based on options and pivot notes
     * 
     * @param array $options Calculation options
     * @param object $pivot Recipe pivot data
     * @return float Multiplier (1.0 for whole, 0.5 for solo by default)
     */
    private function getPortionMultiplier(array $options, object $pivot): float
    {
        $portion = $options['portion'] ?? null;
        
        // Check pivot notes for portion info
        if (!$portion && isset($pivot->notes)) {
            if (stripos($pivot->notes, '[portion:solo]') !== false) {
                $portion = 'solo';
            } elseif (stripos($pivot->notes, '[portion:whole]') !== false) {
                $portion = 'whole';
            }
        }
        
        if ($portion === 'solo') {
            return 0.5; // Solo is half portion by default
        }
        
        return 1.0; // Whole or default
    }

    /**
     * Get size multiplier based on options
     * 
     * @param array $options Calculation options
     * @param object $pivot Recipe pivot data
     * @return float Size multiplier
     */
    private function getSizeMultiplier(array $options, object $pivot): float
    {
        $size = $options['size'] ?? null;
        
        if (!$size) {
            return 1.0;
        }
        
        // Size multipliers (can be customized per establishment)
        $multipliers = [
            'small' => 0.75,
            'medium' => 1.0,
            'large' => 1.25,
            'tall' => 0.85,
            'grande' => 1.0,
            'venti' => 1.3,
            'solo' => 0.5,
            'whole' => 1.0,
        ];
        
        return $multipliers[strtolower($size)] ?? 1.0;
    }

    /**
     * Normalize unit string for comparison
     */
    private function normalizeUnit(string $unit): string
    {
        $unit = strtolower(trim($unit));
        
        // Common aliases
        $aliases = [
            'kilogram' => 'kg',
            'kilograms' => 'kg',
            'gram' => 'g',
            'grams' => 'g',
            'liter' => 'l',
            'liters' => 'l',
            'litre' => 'l',
            'litres' => 'l',
            'milliliter' => 'ml',
            'milliliters' => 'ml',
            'millilitre' => 'ml',
            'millilitres' => 'ml',
            'piece' => 'pcs',
            'pieces' => 'pcs',
            'unit' => 'pcs',
            'units' => 'pcs',
            'box' => 'box',
            'boxes' => 'box',
            'pack' => 'pack',
            'packs' => 'pack',
        ];
        
        return $aliases[$unit] ?? $unit;
    }

    /**
     * Recalculate COGS for all menu items when an ingredient price changes
     * 
     * @param Ingredient $ingredient The ingredient that changed
     * @return array Results with affected items
     */
    public function recalculateAffectedItems(Ingredient $ingredient): array
    {
        $affectedItems = [];
        
        // Find all items using this ingredient
        $items = Item::whereHas('ingredients', function ($query) use ($ingredient) {
            $query->where('ingredient_id', $ingredient->id);
        })->with('ingredients')->get();
        
        foreach ($items as $item) {
            $oldCogs = $item->recipe_cost ?? 0;
            $newCogs = $this->calculateItemCogs($item);
            
            $affectedItems[] = [
                'item_id' => $item->id,
                'item_name' => $item->name,
                'old_cogs' => $oldCogs,
                'new_cogs' => $newCogs,
                'change' => round($newCogs - $oldCogs, 2),
            ];
        }
        
        // Also check kitchen items
        $kitchenItems = KitchenItem::whereHas('ingredients', function ($query) use ($ingredient) {
            $query->where('ingredient_id', $ingredient->id);
        })->with('ingredients')->get();
        
        foreach ($kitchenItems as $kitchenItem) {
            $oldCogs = $kitchenItem->recipe_cost ?? 0;
            $newCogs = $this->calculateKitchenItemCogs($kitchenItem);
            
            $affectedItems[] = [
                'item_id' => $kitchenItem->id,
                'item_name' => $kitchenItem->name,
                'item_type' => 'kitchen',
                'old_cogs' => $oldCogs,
                'new_cogs' => $newCogs,
                'change' => round($newCogs - $oldCogs, 2),
            ];
        }
        
        return [
            'ingredient_id' => $ingredient->id,
            'ingredient_name' => $ingredient->name,
            'new_cost_per_unit' => $ingredient->cost_per_unit,
            'affected_items_count' => count($affectedItems),
            'affected_items' => $affectedItems,
        ];
    }
}
