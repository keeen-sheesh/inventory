<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // First check if table exists
        if (!Schema::hasTable('payment_methods')) {
            Schema::create('payment_methods', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        } else {
            // Table exists, add missing columns
            if (!Schema::hasColumn('payment_methods', 'name')) {
                Schema::table('payment_methods', function (Blueprint $table) {
                    $table->string('name')->after('id');
                });
            }
        }
    }

    public function down(): void
    {
        // Don't rollback - this is a fix
    }
};