<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('sales', function (Blueprint $table) {
            // Add ALL missing columns in the correct order
            $missingColumns = [
                ['subtotal', 'decimal', ['precision' => 10, 'scale' => 2], 0],
                ['tax_amount', 'decimal', ['precision' => 10, 'scale' => 2], 0],
                ['discount_amount', 'decimal', ['precision' => 10, 'scale' => 2], 0],
                ['total_amount', 'decimal', ['precision' => 10, 'scale' => 2], 0],
                ['status', 'string', 255, 'pending'],
                ['order_type', 'string', 255, 'dine_in'],
                ['table_id', 'integer', null, null],
                ['people_count', 'integer', null, 1],
                ['cards_presented', 'integer', null, 0],
                ['payment_method_id', 'integer', null, null],
                ['paid_at', 'timestamp', null, null],
            ];
            
            foreach ($missingColumns as $column) {
                [$name, $type, $params, $default] = $column;
                
                if (!Schema::hasColumn('sales', $name)) {
                    if ($type === 'decimal') {
                        $table->decimal($name, $params['precision'], $params['scale'])->default($default);
                    } elseif ($type === 'string') {
                        $table->string($name, $params)->default($default);
                    } elseif ($type === 'integer') {
                        $table->integer($name)->default($default)->nullable();
                    } elseif ($type === 'timestamp') {
                        $table->timestamp($name)->nullable();
                    }
                }
            }
            
            // Also ensure user_id exists (we already added it)
            if (!Schema::hasColumn('sales', 'user_id')) {
                $table->integer('user_id')->nullable();
            }
        });
    }

    public function down()
    {
        // We won't drop columns in down() to be safe
    }
};