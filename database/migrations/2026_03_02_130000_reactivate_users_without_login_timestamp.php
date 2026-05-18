<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'is_active') || ! Schema::hasColumn('users', 'last_login_at')) {
            return;
        }

        DB::table('users')
            ->where('is_active', false)
            ->whereNull('last_login_at')
            ->update([
                'is_active' => true,
                'updated_at' => now(),
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // no-op
    }
};
