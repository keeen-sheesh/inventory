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
            if (!Schema::hasColumn('sales', 'bir_invoice_number')) {
                $table->string('bir_invoice_number')->nullable()->after('id');
            }
            if (!Schema::hasColumn('sales', 'pos_machine_number')) {
                $table->string('pos_machine_number')->nullable()->after('bir_invoice_number');
            }
            if (!Schema::hasColumn('sales', 'bir_accreditation_number')) {
                $table->string('bir_accreditation_number')->nullable()->after('pos_machine_number');
            }
            if (!Schema::hasColumn('sales', 'bir_permit_number')) {
                $table->string('bir_permit_number')->nullable()->after('bir_accreditation_number');
            }
        });

        if (!Schema::hasTable('settings')) {
            return;
        }

        DB::table('settings')->insertOrIgnore([
            ['key' => 'bir_accreditation_number', 'value' => ''],
            ['key' => 'bir_permit_number',         'value' => ''],
            ['key' => 'pos_machine_number',         'value' => '001'],
            ['key' => 'invoice_series_prefix',      'value' => 'A'],
            ['key' => 'current_invoice_number',     'value' => '1'],
        ]);
    }

    public function down(): void
    {
        if (!Schema::hasTable('sales')) {
            return;
        }

        Schema::table('sales', function (Blueprint $table) {
            foreach (['bir_invoice_number', 'pos_machine_number', 'bir_accreditation_number', 'bir_permit_number'] as $col) {
                if (Schema::hasColumn('sales', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        if (Schema::hasTable('settings')) {
            DB::table('settings')->whereIn('key', [
                'bir_accreditation_number',
                'bir_permit_number',
                'pos_machine_number',
                'invoice_series_prefix',
                'current_invoice_number',
            ])->delete();
        }
    }
};