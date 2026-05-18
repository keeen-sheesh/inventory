<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('item_ingredients')) {
            Schema::table('item_ingredients', function (Blueprint $table) {
                if (!Schema::hasColumn('item_ingredients', 'is_main')) {
                    $table->boolean('is_main')->default(false)->after('notes');
                }
            });
        }

        if (Schema::hasTable('kitchen_item_ingredients')) {
            Schema::table('kitchen_item_ingredients', function (Blueprint $table) {
                if (!Schema::hasColumn('kitchen_item_ingredients', 'is_main')) {
                    $table->boolean('is_main')->default(false)->after('notes');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('item_ingredients') && Schema::hasColumn('item_ingredients', 'is_main')) {
            Schema::table('item_ingredients', function (Blueprint $table) {
                $table->dropColumn('is_main');
            });
        }

        if (Schema::hasTable('kitchen_item_ingredients') && Schema::hasColumn('kitchen_item_ingredients', 'is_main')) {
            Schema::table('kitchen_item_ingredients', function (Blueprint $table) {
                $table->dropColumn('is_main');
            });
        }
    }
};
