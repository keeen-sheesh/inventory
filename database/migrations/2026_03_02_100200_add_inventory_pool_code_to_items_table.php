<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            if (!Schema::hasColumn('items', 'inventory_pool_code')) {
                $table->string('inventory_pool_code')->default('resto')->after('category_id');
                $table->index('inventory_pool_code');
            }
        });

        DB::table('items')
            ->join('categories', 'categories.id', '=', 'items.category_id')
            ->where('categories.is_kitchen_category', 1)
            ->update(['items.inventory_pool_code' => 'kitchen']);

        DB::table('items')
            ->whereNull('inventory_pool_code')
            ->update(['inventory_pool_code' => 'resto']);
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            if (Schema::hasColumn('items', 'inventory_pool_code')) {
                $table->dropIndex(['inventory_pool_code']);
                $table->dropColumn('inventory_pool_code');
            }
        });
    }
};

