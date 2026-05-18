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
            if (!Schema::hasColumn('sales', 'vatable_total')) {
                $table->decimal('vatable_total', 10, 2)->default(0)->after('total_amount');
            }
            if (!Schema::hasColumn('sales', 'vat_exempt_total')) {
                $table->decimal('vat_exempt_total', 10, 2)->default(0)->after('vatable_total');
            }
            if (!Schema::hasColumn('sales', 'zero_rated_total')) {
                $table->decimal('zero_rated_total', 10, 2)->default(0)->after('vat_exempt_total');
            }
            if (!Schema::hasColumn('sales', 'vat_amount')) {
                $table->decimal('vat_amount', 10, 2)->default(0)->after('zero_rated_total');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $columns = ['vatable_total', 'vat_exempt_total', 'zero_rated_total', 'vat_amount'];
            foreach ($columns as $column) {
                if (Schema::hasColumn('sales', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
