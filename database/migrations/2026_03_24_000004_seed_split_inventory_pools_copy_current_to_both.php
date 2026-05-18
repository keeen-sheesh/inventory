<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('ingredient_stocks') || !Schema::hasTable('inventory_pools')) {
            return;
        }

        $restoPoolId = DB::table('inventory_pools')->where('code', 'resto')->value('id');
        $kitchenPoolId = DB::table('inventory_pools')->where('code', 'kitchen')->value('id');

        if (!$restoPoolId || !$kitchenPoolId) {
            return;
        }

        $totals = DB::table('ingredient_stocks')
            ->select(
                'ingredient_id',
                DB::raw('SUM(quantity) as total_quantity'),
                DB::raw('SUM(min_stock) as total_min_stock'),
                DB::raw('AVG(COALESCE(cost_per_unit, 0)) as avg_cost_per_unit')
            )
            ->groupBy('ingredient_id')
            ->get();

        foreach ($totals as $row) {
            $payload = [
                'quantity' => (float) ($row->total_quantity ?? 0),
                'min_stock' => (float) ($row->total_min_stock ?? 0),
                'cost_per_unit' => (float) ($row->avg_cost_per_unit ?? 0),
                'updated_at' => now(),
            ];

            DB::table('ingredient_stocks')->updateOrInsert(
                [
                    'ingredient_id' => $row->ingredient_id,
                    'inventory_pool_id' => $restoPoolId,
                ],
                array_merge($payload, ['created_at' => now()])
            );

            DB::table('ingredient_stocks')->updateOrInsert(
                [
                    'ingredient_id' => $row->ingredient_id,
                    'inventory_pool_id' => $kitchenPoolId,
                ],
                array_merge($payload, ['created_at' => now()])
            );
        }
    }

    public function down(): void
    {
        // Irreversible data migration.
    }
};
