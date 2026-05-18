<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds kitchen_item_id foreign key to sale_items table.
     * A SaleItem now has either item_id (Resto item) OR kitchen_item_id (Kitchen item) - never both.
     */
    public function up(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            // Add kitchen_item_id as nullable foreign key
            if (!Schema::hasColumn('sale_items', 'kitchen_item_id')) {
                $table->foreignId('kitchen_item_id')
                    ->nullable()
                    ->constrained('kitchen_items')
                    ->onDelete('cascade')
                    ->after('item_id');
            }
        });

        // Add check constraint at database level (if supported)
        // MySQL 8.0.16+ supports CHECK constraints
        Schema::table('sale_items', function (Blueprint $table) {
            // We'll handle validation at model level since MySQL before 8.0.16 doesn't support CHECK
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            // Drop foreign key first
            if (Schema::hasColumn('sale_items', 'kitchen_item_id')) {
                $table->dropForeign(['kitchen_item_id']);
                $table->dropColumn('kitchen_item_id');
            }
        });
    }
};

