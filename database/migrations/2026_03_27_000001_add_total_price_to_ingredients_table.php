<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds total_price field to ingredients table for proper COGS calculation.
     * cost_per_unit will be auto-computed as total_price / quantity.
     */
    public function up(): void
    {
        Schema::table('ingredients', function (Blueprint $table) {
            $table->decimal('total_price', 12, 2)->nullable()->after('unit');
        });

        // Backfill: If cost_per_unit exists and quantity > 0, calculate total_price
        DB::statement("
            UPDATE ingredients 
            SET total_price = ROUND(cost_per_unit * quantity, 2)
            WHERE quantity > 0 AND cost_per_unit > 0 AND total_price IS NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ingredients', function (Blueprint $table) {
            $table->dropColumn('total_price');
        });
    }
};
