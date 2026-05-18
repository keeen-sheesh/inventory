<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('items')) {
            return;
        }

        if (!Schema::hasColumn('items', 'vat_type')) {
            Schema::table('items', function (Blueprint $table) {
                $table->enum('vat_type', ['vatable', 'vat_exempt', 'zero_rated'])
                      ->default('vatable')
                      ->after('price');
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('items')) {
            return;
        }

        if (Schema::hasColumn('items', 'vat_type')) {
            Schema::table('items', function (Blueprint $table) {
                $table->dropColumn('vat_type');
            });
        }
    }
};