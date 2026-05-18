<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Ingredient;

class IngredientSeeder extends Seeder
{
    public function run()
    {
        $ingredients = [
            [
                'name' => 'Ground Beef',
                'unit' => 'kg',
                'quantity' => 10,
                'min_stock' => 2,
                'cost_per_unit' => 350.00,
            ],
            [
                'name' => 'Chicken Breast',
                'unit' => 'kg',
                'quantity' => 8,
                'min_stock' => 2,
                'cost_per_unit' => 180.00,
            ],
            [
                'name' => 'Rice',
                'unit' => 'kg',
                'quantity' => 25,
                'min_stock' => 5,
                'cost_per_unit' => 55.00,
            ],
            [
                'name' => 'Eggs',
                'unit' => 'piece',
                'quantity' => 120,
                'min_stock' => 30,
                'cost_per_unit' => 8.00,
            ],
            [
                'name' => 'Flour',
                'unit' => 'kg',
                'quantity' => 15,
                'min_stock' => 3,
                'cost_per_unit' => 45.00,
            ],
            [
                'name' => 'Sugar',
                'unit' => 'kg',
                'quantity' => 20,
                'min_stock' => 4,
                'cost_per_unit' => 52.00,
            ],
            [
                'name' => 'Salt',
                'unit' => 'kg',
                'quantity' => 5,
                'min_stock' => 1,
                'cost_per_unit' => 20.00,
            ],
            [
                'name' => 'Cooking Oil',
                'unit' => 'liter',
                'quantity' => 10,
                'min_stock' => 2,
                'cost_per_unit' => 95.00,
            ],
            [
                'name' => 'Tomato Sauce',
                'unit' => 'kg',
                'quantity' => 8,
                'min_stock' => 2,
                'cost_per_unit' => 85.00,
            ],
            [
                'name' => 'Cheese',
                'unit' => 'kg',
                'quantity' => 5,
                'min_stock' => 1,
                'cost_per_unit' => 320.00,
            ],
        ];

        foreach ($ingredients as $ingredient) {
            Ingredient::create($ingredient);
        }
    }
}