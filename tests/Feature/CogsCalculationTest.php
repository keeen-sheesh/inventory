<?php

namespace Tests\Feature;

use App\Models\Ingredient;
use App\Models\Item;
use App\Models\Category;
use App\Services\CogsCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CogsCalculationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test the example scenario from requirements:
     * - Patty: 1kg = 360 (cost_per_unit = 360/kg)
     * - Buns: 12 pcs = 150 (cost_per_piece = 12.5)
     * - Burger recipe: Patty (0.3kg) + Bun (1pc)
     * - Expected COGS: 108 + 12.5 = 120.5
     */
    public function test_burger_cogs_calculation(): void
    {
        // Create category
        $category = Category::create([
            'name' => 'Main Course',
            'slug' => 'main-course',
        ]);

        // Create Patty ingredient: 1kg = 360
        $patty = Ingredient::create([
            'name' => 'Patty',
            'unit' => 'kg',
            'quantity' => 1.0,
            'total_price' => 360.00,
            'cost_per_unit' => 360.00, // Auto-calculated
            'min_stock' => 0.5,
        ]);

        // Create Buns ingredient: 12 pcs = 150
        $buns = Ingredient::create([
            'name' => 'Buns',
            'unit' => 'pcs',
            'quantity' => 12.0,
            'total_price' => 150.00,
            'pieces_per_box' => 12,
            'cost_per_unit' => 12.50, // Auto-calculated (150/12)
            'cost_per_piece' => 12.50,
            'min_stock' => 6,
        ]);

        // Create Burger menu item with price 250
        $burger = Item::create([
            'name' => 'Burger',
            'description' => 'Delicious burger',
            'price' => 250.00,
            'category_id' => $category->id,
        ]);

        // Add recipe: Patty 0.3kg + 1 Bun
        $burger->ingredients()->attach($patty->id, [
            'quantity_required' => 0.3,
            'unit' => 'kg',
        ]);

        $burger->ingredients()->attach($buns->id, [
            'quantity_required' => 1,
            'unit' => 'pcs',
        ]);

        // Calculate COGS
        $calculator = new CogsCalculator();
        $cogs = $calculator->calculateItemCogs($burger);

        // Assert COGS calculation
        // Patty: 0.3kg × 360/kg = 108
        // Buns: 1pc × 12.5/pc = 12.5
        // Total: 120.5
        $this->assertEquals(120.50, $cogs);

        // Test model accessor
        $burger->refresh();
        $this->assertEquals(120.50, $burger->recipe_cost);

        // Test profit calculation
        $profit = $burger->price - $burger->recipe_cost;
        $this->assertEquals(129.50, $profit);

        // Test profit margin
        $margin = ($profit / $burger->price) * 100;
        $this->assertEquals(51.80, round($margin, 2));
    }

    /**
     * Test unit conversion (g to kg)
     */
    public function test_unit_conversion_grams_to_kg(): void
    {
        $category = Category::create([
            'name' => 'Test',
            'slug' => 'test',
        ]);

        // Create ingredient priced per kg
        $ingredient = Ingredient::create([
            'name' => 'Cheese',
            'unit' => 'kg',
            'quantity' => 1.0,
            'total_price' => 500.00,
            'cost_per_unit' => 500.00,
            'min_stock' => 0.1,
        ]);

        $item = Item::create([
            'name' => 'Cheese Burger',
            'price' => 300.00,
            'category_id' => $category->id,
        ]);

        // Recipe uses grams (100g = 0.1kg)
        $item->ingredients()->attach($ingredient->id, [
            'quantity_required' => 100,
            'unit' => 'g',
        ]);

        $calculator = new CogsCalculator();
        $cogs = $calculator->calculateItemCogs($item);

        // 100g = 0.1kg, cost = 0.1 × 500 = 50
        $this->assertEquals(50.00, $cogs);
    }

    /**
     * Test piece-based ingredient cost
     */
    public function test_piece_based_ingredient(): void
    {
        // Create ingredient with pieces_per_box
        $ingredient = Ingredient::create([
            'name' => 'Napkins',
            'unit' => 'box',
            'quantity' => 1.0,
            'total_price' => 100.00,
            'pieces_per_box' => 50,
            'cost_per_unit' => 2.00, // Per piece
            'min_stock' => 1,
        ]);

        $this->assertEquals(2.00, $ingredient->cost_per_piece);
        $this->assertEquals(2.00, $ingredient->unit_cost);
    }
}
