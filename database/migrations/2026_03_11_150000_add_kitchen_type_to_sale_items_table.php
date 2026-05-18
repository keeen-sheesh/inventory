<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('sale_items')) return;

        if (!Schema::hasColumn('sale_items', 'kitchen_type')) {
            Schema::table('sale_items', function (Blueprint $table) {
                // 'kitchen' = goes to kitchen display, 'resto' = goes to kitchen_resto display
                $table->string('kitchen_type')->nullable()->after('kitchen_status');
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('sale_items')) return;

        if (Schema::hasColumn('sale_items', 'kitchen_type')) {
            Schema::table('sale_items', function (Blueprint $table) {
                $table->dropColumn('kitchen_type');
            });
        }
    }
};