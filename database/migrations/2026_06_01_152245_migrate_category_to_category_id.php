<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Migrate data from category (string) to category_id (foreign key)
        // Match category names with existing categories in the categories table
        DB::statement("
            UPDATE ingredients
            SET category_id = (
                SELECT id FROM categories 
                WHERE categories.name = ingredients.category 
                LIMIT 1
            )
            WHERE category IS NOT NULL AND category != ''
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Clear category_id values (reverse the migration)
        DB::statement("UPDATE ingredients SET category_id = NULL");
    }
};
