<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('items', function (Blueprint $table) {
            if (!Schema::hasColumn('items', 'stock_quantity')) {
                $table->integer('stock_quantity')->default(0)->nullable();
            }
            if (!Schema::hasColumn('items', 'low_stock_threshold')) {
                $table->integer('low_stock_threshold')->default(10)->nullable();
            }
            if (!Schema::hasColumn('items', 'sort_order')) {
                $table->integer('sort_order')->default(999)->nullable();
            }
        });
    }

    public function down()
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn(['stock_quantity', 'low_stock_threshold', 'sort_order']);
        });
    }
};