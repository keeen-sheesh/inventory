<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_count_batches', function (Blueprint $table) {
            $table->id();
            $table->string('inventory_pool_code', 32);
            $table->string('or_number', 64);
            $table->date('count_date');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['inventory_pool_code', 'count_date'], 'stock_count_batches_pool_date_idx');
        });

        Schema::create('stock_count_batch_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_count_batch_id')->constrained('stock_count_batches')->cascadeOnDelete();
            $table->foreignId('ingredient_id')->constrained()->cascadeOnDelete();
            $table->decimal('current_stock', 12, 3);
            $table->decimal('actual_counted_stock', 12, 3);
            $table->decimal('variance', 12, 3);
            $table->timestamps();

            $table->index('ingredient_id', 'stock_count_batch_items_ingredient_idx');
            $table->index('stock_count_batch_id', 'stock_count_batch_items_batch_idx');
            $table->unique(['stock_count_batch_id', 'ingredient_id'], 'stock_count_batch_items_batch_ingredient_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_count_batch_items');
        Schema::dropIfExists('stock_count_batches');
    }
};
