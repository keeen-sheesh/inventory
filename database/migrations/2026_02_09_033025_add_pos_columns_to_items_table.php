<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            // Check if columns exist before adding
            if (!Schema::hasColumn('items', 'category_id')) {
                $table->foreignId('category_id')->nullable()->constrained('categories')->onDelete('set null')->after('id');
            }
            
            if (!Schema::hasColumn('items', 'pricing_type')) {
                $table->string('pricing_type')->default('single')->nullable()->after('price');
                $table->decimal('price_solo', 10, 2)->nullable()->after('pricing_type');
                $table->decimal('price_whole', 10, 2)->nullable()->after('price_solo');
            }
            
            // Remove old category column if exists
            if (Schema::hasColumn('items', 'category')) {
                $table->dropColumn('category');
            }
        });
    }

    public function down(): void
    {
        // We won't rollback these changes
    }
};