<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            if (!Schema::hasColumn('items', 'menu_visibility')) {
                // 'both'    = visible in Resto POS and Kitchen POS
                // 'resto'   = visible only in Resto POS (admin/cashier)
                // 'kitchen' = visible only in Kitchen POS (kitchen staff)
                $table->string('menu_visibility')->default('both')->after('has_recipe');
                $table->index('menu_visibility');
            }
        });

        // All existing items default to 'both' so nothing breaks
        DB::table('items')
            ->whereNull('menu_visibility')
            ->update(['menu_visibility' => 'both']);
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            if (Schema::hasColumn('items', 'menu_visibility')) {
                $table->dropIndex(['menu_visibility']);
                $table->dropColumn('menu_visibility');
            }
        });
    }
};