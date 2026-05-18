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
        Schema::create('kitchen_items', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2)->nullable();
            $table->foreignId('kitchen_category_id')->constrained('kitchen_categories')->onDelete('cascade');
            $table->string('inventory_pool_code')->default('kitchen')->after('kitchen_category_id');
            $table->boolean('is_available')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->integer('stock_quantity')->default(0);
            $table->integer('low_stock_threshold')->default(10);
            $table->string('pricing_type')->default('single');
            $table->decimal('price_solo', 10, 2)->nullable();
            $table->decimal('price_whole', 10, 2)->nullable();
            $table->integer('sort_order')->default(0);
            $table->string('image')->nullable();
            $table->boolean('has_sizes')->default(false);
            $table->boolean('has_recipe')->default(false);
            $table->timestamps();
            
            $table->index('kitchen_category_id');
            $table->index('inventory_pool_code');
            $table->index('is_available');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kitchen_items');
    }
};

