<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds cogs (Cost of Goods Sold) field to sale_items table.
     * This stores the calculated COGS for each line item at the time of order.
     */
    public function up(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->decimal('cogs', 12, 2)->nullable()->after('total_price')
                  ->comment('Cost of Goods Sold for this line item');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropColumn('cogs');
        });
    }
};
