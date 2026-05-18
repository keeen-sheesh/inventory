<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('sales', function (Blueprint $table) {
            // Add missing columns based on your Sale model
            if (!Schema::hasColumn('sales', 'room_number')) {
                $table->string('room_number', 20)->nullable()->after('customer_name');
            }
            
            if (!Schema::hasColumn('sales', 'customer_name')) {
                $table->string('customer_name')->nullable()->after('customer_id');
            }
            
            if (!Schema::hasColumn('sales', 'customer_phone')) {
                $table->string('customer_phone', 20)->nullable()->after('customer_name');
            }
            
            if (!Schema::hasColumn('sales', 'customer_address')) {
                $table->string('customer_address', 500)->nullable()->after('customer_phone');
            }
            
            if (!Schema::hasColumn('sales', 'discount_type')) {
                $table->string('discount_type', 20)->default('none')->after('discount_amount');
            }
            
            if (!Schema::hasColumn('sales', 'discount_value')) {
                $table->decimal('discount_value', 10, 2)->default(0)->after('discount_type');
            }
            
            if (!Schema::hasColumn('sales', 'kitchen_status')) {
                $table->string('kitchen_status', 20)->nullable()->after('status');
            }
            
            if (!Schema::hasColumn('sales', 'people_count')) {
                $table->integer('people_count')->default(1)->after('order_type');
            }
            
            if (!Schema::hasColumn('sales', 'cards_presented')) {
                $table->integer('cards_presented')->default(0)->after('people_count');
            }
        });
    }

    public function down()
    {
        Schema::table('sales', function (Blueprint $table) {
            $columns = [
                'room_number',
                'customer_name',
                'customer_phone',
                'customer_address',
                'discount_type',
                'discount_value',
                'kitchen_status',
                'people_count',
                'cards_presented'
            ];
            
            foreach ($columns as $column) {
                if (Schema::hasColumn('sales', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};