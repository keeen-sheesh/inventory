<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            // ensure a featured flag exists for items
            if (!Schema::hasColumn('items', 'is_featured')) {
                $table->boolean('is_featured')->default(false)->after('is_available');
            }

            if (!Schema::hasColumn('items', 'has_sizes')) {
                $table->boolean('has_sizes')->default(false)->after('is_featured');
            }
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            if (Schema::hasColumn('items', 'has_sizes')) {
                $table->dropColumn('has_sizes');
            }
            // we don't remove is_featured dropped here since other code may rely on it
        });
    }
};