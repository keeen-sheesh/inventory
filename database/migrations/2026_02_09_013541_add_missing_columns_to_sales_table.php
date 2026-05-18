<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            // Add payment_method_id foreign key
            if (!Schema::hasColumn('sales', 'payment_method_id')) {
                $table->foreignId('payment_method_id')->nullable()->after('customer_id')->constrained('payment_methods')->nullOnDelete();
            }
            
            // Add tax and discount columns
            if (!Schema::hasColumn('sales', 'tax_amount')) {
                $table->decimal('tax_amount', 10, 2)->default(0)->after('total_amount');
            }
            
            if (!Schema::hasColumn('sales', 'discount_amount')) {
                $table->decimal('discount_amount', 10, 2)->default(0)->after('tax_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropForeign(['payment_method_id']);
            $table->dropColumn(['payment_method_id', 'tax_amount', 'discount_amount']);
        });
    }
};