<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('sales', function (Blueprint $table) {
            if (!Schema::hasColumn('sales', 'user_id')) {
                $table->foreignId('user_id')->nullable()->after('customer_id');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            }

            if (!Schema::hasColumn('sales', 'people_count')) {
                $table->integer('people_count')->default(1);
            }

            if (!Schema::hasColumn('sales', 'cards_presented')) {
                $table->integer('cards_presented')->default(0)->after('people_count');
            }

            if (!Schema::hasColumn('sales', 'payment_method_id')) {
                $table->foreignId('payment_method_id')->nullable()->after('cards_presented');
                $table->foreign('payment_method_id')->references('id')->on('payment_methods')->onDelete('set null');
            }

            if (!Schema::hasColumn('sales', 'paid_at')) {
                $table->timestamp('paid_at')->nullable()->after('payment_method_id');
            }

            if (!Schema::hasColumn('sales', 'order_type')) {
                $table->string('order_type')->default('dine_in')->after('status');
            }
        });
    }

    public function down()
    {
        Schema::table('sales', function (Blueprint $table) {
            // Drop foreign keys first
            $columnsToDrop = ['user_id', 'payment_method_id'];
            foreach ($columnsToDrop as $column) {
                if (Schema::hasColumn('sales', $column)) {
                    $table->dropForeign(['user_id']);
                    $table->dropForeign(['payment_method_id']);
                }
            }
            
            // Drop columns
            $table->dropColumn([
                'user_id',
                'people_count', 
                'cards_presented',
                'payment_method_id',
                'paid_at',
                'order_type'
            ]);
        });
    }
};