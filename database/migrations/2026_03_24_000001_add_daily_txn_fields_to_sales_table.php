<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('sales')) {
            return;
        }

        Schema::table('sales', function (Blueprint $table) {
            if (!Schema::hasColumn('sales', 'txn_date')) {
                $table->date('txn_date')->nullable()->after('created_at');
            }
            if (!Schema::hasColumn('sales', 'txn_sequence')) {
                $table->unsignedInteger('txn_sequence')->nullable()->after('txn_date');
            }
            if (!Schema::hasColumn('sales', 'txn_number')) {
                $table->string('txn_number', 32)->nullable()->after('txn_sequence');
            }
        });

        $sales = DB::table('sales')
            ->select('id', 'created_at')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $sequencesByDate = [];
        foreach ($sales as $sale) {
            $txnDate = $sale->created_at
                ? \Carbon\Carbon::parse($sale->created_at, 'Asia/Manila')->toDateString()
                : now('Asia/Manila')->toDateString();

            $next = ($sequencesByDate[$txnDate] ?? 0) + 1;
            $sequencesByDate[$txnDate] = $next;
            $txnNumber = sprintf('TXN-%s-%03d', str_replace('-', '', $txnDate), $next);

            DB::table('sales')
                ->where('id', $sale->id)
                ->update([
                    'txn_date' => $txnDate,
                    'txn_sequence' => $next,
                    'txn_number' => $txnNumber,
                ]);
        }

        Schema::table('sales', function (Blueprint $table) {
            $table->unique('txn_number', 'sales_txn_number_unique');
            $table->unique(['txn_date', 'txn_sequence'], 'sales_txn_date_sequence_unique');
            $table->index('txn_date', 'sales_txn_date_index');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('sales')) {
            return;
        }

        Schema::table('sales', function (Blueprint $table) {
            try {
                $table->dropUnique('sales_txn_number_unique');
            } catch (\Throwable $e) {
            }
            try {
                $table->dropUnique('sales_txn_date_sequence_unique');
            } catch (\Throwable $e) {
            }
            try {
                $table->dropIndex('sales_txn_date_index');
            } catch (\Throwable $e) {
            }

            if (Schema::hasColumn('sales', 'txn_number')) {
                $table->dropColumn('txn_number');
            }
            if (Schema::hasColumn('sales', 'txn_sequence')) {
                $table->dropColumn('txn_sequence');
            }
            if (Schema::hasColumn('sales', 'txn_date')) {
                $table->dropColumn('txn_date');
            }
        });
    }
};
