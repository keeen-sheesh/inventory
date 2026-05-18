<?php
// database/migrations/2024_01_01_000001_create_item_ingredients_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('item_ingredients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained()->onDelete('cascade');
            $table->foreignId('ingredient_id')->constrained()->onDelete('cascade');
            $table->decimal('quantity_required', 10, 3); // Amount needed per serving
            $table->string('unit')->nullable(); // Override ingredient unit if needed
            $table->text('notes')->nullable();
            $table->timestamps();
            
            // Ensure unique combination
            $table->unique(['item_id', 'ingredient_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('item_ingredients');
    }
};