<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('kitchen_item_ingredients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kitchen_item_id')->constrained('kitchen_items')->onDelete('cascade');
            $table->foreignId('ingredient_id')->constrained('ingredients')->onDelete('cascade');
            $table->decimal('quantity_required', 10, 3)->default(0);
            $table->string('unit')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->unique(['kitchen_item_id', 'ingredient_id']);
            $table->index('ingredient_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kitchen_item_ingredients');
    }
};

