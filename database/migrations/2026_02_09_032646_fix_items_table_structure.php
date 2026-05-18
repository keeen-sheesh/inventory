<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // First, add the category_id column if it doesn't exist
        if (!Schema::hasColumn('items', 'category_id')) {
            Schema::table('items', function (Blueprint $table) {
                $table->foreignId('category_id')->nullable()->constrained('categories')->onDelete('set null');
            });
        }

        // Add other missing columns
        if (!Schema::hasColumn('items', 'pricing_type')) {
            Schema::table('items', function (Blueprint $table) {
                $table->string('pricing_type')->default('single')->nullable(); // single, dual
                $table->decimal('price_solo', 10, 2)->nullable();
                $table->decimal('price_whole', 10, 2)->nullable();
            });
        }
    }

    public function down(): void
    {
        // We won't rollback these changes as they're necessary
    }
};