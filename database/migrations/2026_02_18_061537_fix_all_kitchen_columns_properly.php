<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class FixAllKitchenColumnsProperly extends Migration
{
    public function up()
    {
        // FIRST: Fix categories table - add is_kitchen_category if not exists
        if (Schema::hasTable('categories')) {
            Schema::table('categories', function (Blueprint $table) {
                if (!Schema::hasColumn('categories', 'is_kitchen_category')) {
                    $table->boolean('is_kitchen_category')->default(false)->after('is_active');
                }
            });
        }

        // SECOND: Fix sales table - add ALL missing columns
        if (Schema::hasTable('sales')) {
            Schema::table('sales', function (Blueprint $table) {
                // Kitchen status
                if (!Schema::hasColumn('sales', 'kitchen_status')) {
                    $table->string('kitchen_status')->nullable()->after('status');
                }
                
                // Completed at
                if (!Schema::hasColumn('sales', 'completed_at')) {
                    $table->timestamp('completed_at')->nullable()->after('paid_at');
                }
                
                // Customer fields
                if (!Schema::hasColumn('sales', 'customer_name')) {
                    $table->string('customer_name')->nullable()->after('user_id');
                }
                if (!Schema::hasColumn('sales', 'customer_phone')) {
                    $table->string('customer_phone')->nullable()->after('customer_name');
                }
                if (!Schema::hasColumn('sales', 'customer_address')) {
                    $table->text('customer_address')->nullable()->after('customer_phone');
                }
                
                // Order details
                if (!Schema::hasColumn('sales', 'people_count')) {
                    $table->integer('people_count')->default(1)->after('order_type');
                }
                if (!Schema::hasColumn('sales', 'cards_presented')) {
                    $table->integer('cards_presented')->default(0)->after('people_count');
                }
                
                // Discount fields
                if (!Schema::hasColumn('sales', 'discount_type')) {
                    $table->string('discount_type')->default('none')->after('cards_presented');
                }
                if (!Schema::hasColumn('sales', 'discount_value')) {
                    $table->decimal('discount_value', 10, 2)->default(0)->after('discount_type');
                }
                
                // Subtotal and discount amount (if missing)
                if (!Schema::hasColumn('sales', 'subtotal')) {
                    $table->decimal('subtotal', 10, 2)->default(0)->after('total_amount');
                }
                if (!Schema::hasColumn('sales', 'discount_amount')) {
                    $table->decimal('discount_amount', 10, 2)->default(0)->after('subtotal');
                }
            });
        }

        // THIRD: Fix sale_items table - add ALL missing columns
        if (Schema::hasTable('sale_items')) {
            Schema::table('sale_items', function (Blueprint $table) {
                // Kitchen status - check if exists first
                if (!Schema::hasColumn('sale_items', 'kitchen_status')) {
                    $table->string('kitchen_status')->nullable()->after('total_price');
                }
                
                // Kitchen timestamps
                if (!Schema::hasColumn('sale_items', 'kitchen_started_at')) {
                    $table->timestamp('kitchen_started_at')->nullable()->after('kitchen_status');
                }
                if (!Schema::hasColumn('sale_items', 'kitchen_completed_at')) {
                    $table->timestamp('kitchen_completed_at')->nullable()->after('kitchen_started_at');
                }
                
                // Special instructions (if missing)
                if (!Schema::hasColumn('sale_items', 'special_instructions')) {
                    $table->text('special_instructions')->nullable()->after('kitchen_completed_at');
                }
            });
        }

        // FOURTH: Update Main Dish category to be kitchen category
        if (Schema::hasTable('categories')) {
            DB::table('categories')
                ->where('name', 'Main Dish')
                ->update(['is_kitchen_category' => true]);
        }
    }

    public function down()
    {
        // We won't drop columns in down() to be safe
    }
}