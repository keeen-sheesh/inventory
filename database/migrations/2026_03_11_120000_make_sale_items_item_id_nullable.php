<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('sale_items')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            $columns = Schema::getColumnListing('sale_items');
            $hasKitchenItemId = in_array('kitchen_item_id', $columns, true);
            $hasKitchenStatus = in_array('kitchen_status', $columns, true);
            $hasKitchenStartedAt = in_array('kitchen_started_at', $columns, true);
            $hasKitchenCompletedAt = in_array('kitchen_completed_at', $columns, true);
            $hasSpecialInstructions = in_array('special_instructions', $columns, true);
            $hasKitchenItemsTable = Schema::hasTable('kitchen_items');

            DB::statement('PRAGMA foreign_keys=OFF');

            Schema::create('sale_items_tmp', function (Blueprint $table) use ($hasKitchenItemsTable) {
                $table->id();
                $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
                $table->foreignId('item_id')->nullable()->constrained()->cascadeOnDelete();

                if ($hasKitchenItemsTable) {
                    $table->foreignId('kitchen_item_id')
                        ->nullable()
                        ->constrained('kitchen_items')
                        ->cascadeOnDelete();
                } else {
                    $table->unsignedBigInteger('kitchen_item_id')->nullable();
                }

                $table->integer('quantity');
                $table->decimal('unit_price', 10, 2);
                $table->decimal('total_price', 10, 2);
                $table->text('special_instructions')->nullable();
                $table->string('kitchen_status', 20)->nullable();
                $table->timestamp('kitchen_started_at')->nullable();
                $table->timestamp('kitchen_completed_at')->nullable();
                $table->timestamps();
            });

            $insertColumns = [
                'id',
                'sale_id',
                'item_id',
                'kitchen_item_id',
                'quantity',
                'unit_price',
                'total_price',
                'special_instructions',
                'kitchen_status',
                'kitchen_started_at',
                'kitchen_completed_at',
                'created_at',
                'updated_at',
            ];

            $selectExpressions = [
                'id',
                'sale_id',
                'item_id',
                $hasKitchenItemId ? 'kitchen_item_id' : 'NULL as kitchen_item_id',
                'quantity',
                'unit_price',
                'total_price',
                $hasSpecialInstructions ? 'special_instructions' : 'NULL as special_instructions',
                $hasKitchenStatus ? 'kitchen_status' : 'NULL as kitchen_status',
                $hasKitchenStartedAt ? 'kitchen_started_at' : 'NULL as kitchen_started_at',
                $hasKitchenCompletedAt ? 'kitchen_completed_at' : 'NULL as kitchen_completed_at',
                'created_at',
                'updated_at',
            ];

            DB::statement(sprintf(
                'INSERT INTO sale_items_tmp (%s) SELECT %s FROM sale_items',
                implode(', ', $insertColumns),
                implode(', ', $selectExpressions)
            ));

            Schema::drop('sale_items');
            Schema::rename('sale_items_tmp', 'sale_items');

            DB::statement('PRAGMA foreign_keys=ON');

            return;
        }

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE sale_items DROP FOREIGN KEY sale_items_item_id_foreign');
            DB::statement('ALTER TABLE sale_items MODIFY item_id BIGINT UNSIGNED NULL');
            DB::statement('ALTER TABLE sale_items ADD CONSTRAINT sale_items_item_id_foreign FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE');
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE sale_items DROP CONSTRAINT sale_items_item_id_foreign');
            DB::statement('ALTER TABLE sale_items ALTER COLUMN item_id DROP NOT NULL');
            DB::statement('ALTER TABLE sale_items ADD CONSTRAINT sale_items_item_id_foreign FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE');
            return;
        }

        Schema::table('sale_items', function (Blueprint $table) {
            $table->foreignId('item_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Intentionally left blank to avoid breaking existing kitchen-item rows.
    }
};
