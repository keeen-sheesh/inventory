<?php
// database/migrations/xxxx_xx_xx_create_kitchen_item_sizes_table.php
// Run: php artisan migrate

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kitchen_item_sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kitchen_item_id')->constrained('kitchen_items')->cascadeOnDelete();
            $table->foreignId('size_id')->constrained('sizes')->cascadeOnDelete();
            // hot | iced | both (both = available in either temp)
            $table->enum('temperature', ['hot', 'iced', 'both'])->default('both');
            $table->decimal('price', 10, 2);
            $table->timestamps();

            // Each kitchen item can only have one price per size+temperature combo
            $table->unique(['kitchen_item_id', 'size_id', 'temperature']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kitchen_item_sizes');
    }
};