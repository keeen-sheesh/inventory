<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_orders', 'inventory_pool_code')) {
                $table->string('inventory_pool_code')->default('resto')->after('status');
                $table->index('inventory_pool_code');
            }
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_orders', 'inventory_pool_code')) {
                $table->dropIndex(['inventory_pool_code']);
                $table->dropColumn('inventory_pool_code');
            }
        });
    }
};

