<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingredient_stocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ingredient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inventory_pool_id')->constrained('inventory_pools')->cascadeOnDelete();
            $table->decimal('quantity', 12, 3)->default(0);
            $table->decimal('min_stock', 12, 3)->default(0);
            $table->decimal('cost_per_unit', 12, 2)->nullable();
            $table->timestamps();

            $table->unique(['ingredient_id', 'inventory_pool_id']);
        });

        $restoPoolId = DB::table('inventory_pools')->where('code', 'resto')->value('id');
        $kitchenPoolId = DB::table('inventory_pools')->where('code', 'kitchen')->value('id');

        $ingredients = DB::table('ingredients')->select('id', 'quantity', 'min_stock', 'cost_per_unit')->get();

        foreach ($ingredients as $ingredient) {
            DB::table('ingredient_stocks')->insert([
                [
                    'ingredient_id' => $ingredient->id,
                    'inventory_pool_id' => $restoPoolId,
                    'quantity' => $ingredient->quantity ?? 0,
                    'min_stock' => $ingredient->min_stock ?? 0,
                    'cost_per_unit' => $ingredient->cost_per_unit ?? 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'ingredient_id' => $ingredient->id,
                    'inventory_pool_id' => $kitchenPoolId,
                    'quantity' => 0,
                    'min_stock' => 0,
                    'cost_per_unit' => $ingredient->cost_per_unit ?? 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ingredient_stocks');
    }
};

