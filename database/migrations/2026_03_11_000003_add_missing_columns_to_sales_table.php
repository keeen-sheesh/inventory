<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (!Schema::hasColumn('sales', 'service_charge_amount')) {
                $table->decimal('service_charge_amount', 10, 2)->default(0)->after('discount_amount');
            }
            if (!Schema::hasColumn('sales', 'paid_at')) {
                $table->timestamp('paid_at')->nullable()->after('payment_method_id');
            }
            if (!Schema::hasColumn('sales', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('paid_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $columns = ['service_charge_amount', 'paid_at', 'completed_at'];
            foreach ($columns as $column) {
                if (Schema::hasColumn('sales', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};