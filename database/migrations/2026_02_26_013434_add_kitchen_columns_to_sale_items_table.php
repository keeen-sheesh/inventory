<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('sale_items', function (Blueprint $table) {
            if (!Schema::hasColumn('sale_items', 'kitchen_status')) {
                $table->string('kitchen_status', 20)->nullable()->after('special_instructions');
            }
            
            if (!Schema::hasColumn('sale_items', 'kitchen_started_at')) {
                $table->timestamp('kitchen_started_at')->nullable()->after('kitchen_status');
            }
            
            if (!Schema::hasColumn('sale_items', 'kitchen_completed_at')) {
                $table->timestamp('kitchen_completed_at')->nullable()->after('kitchen_started_at');
            }
        });
    }

    public function down()
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $columns = ['kitchen_status', 'kitchen_started_at', 'kitchen_completed_at'];
            
            foreach ($columns as $column) {
                if (Schema::hasColumn('sale_items', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};