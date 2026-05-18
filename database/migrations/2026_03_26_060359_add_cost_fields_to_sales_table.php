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
        Schema::table('sales', function (Blueprint $table) {
            // Add cost and profit tracking fields
            $table->decimal('total_cost', 10, 2)->nullable()->after('total_amount');
            $table->decimal('gross_profit', 10, 2)->nullable()->after('total_cost');
            $table->decimal('profit_margin', 5, 2)->nullable()->after('gross_profit');
            
            // Add invoice number
            $table->string('invoice_number')->unique()->nullable()->after('order_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['total_cost', 'gross_profit', 'profit_margin', 'invoice_number']);
        });
    }
};
