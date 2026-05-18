<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('sales', 'kitchen_kitchen_status')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->string('kitchen_kitchen_status')->default('pending')->after('kitchen_status');
            });
        }

        if (!Schema::hasColumn('sales', 'resto_kitchen_status')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->string('resto_kitchen_status')->default('pending')->after('kitchen_kitchen_status');
            });
        }

        // Backfill from existing kitchen_status
        DB::statement("UPDATE sales SET kitchen_kitchen_status = kitchen_status, resto_kitchen_status = kitchen_status WHERE kitchen_status IS NOT NULL");
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['kitchen_kitchen_status', 'resto_kitchen_status']);
        });
    }
};