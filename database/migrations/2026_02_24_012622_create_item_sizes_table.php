<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('item_sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained()->onDelete('cascade');
            $table->foreignId('size_id')->constrained()->onDelete('cascade');
            $table->decimal('price', 10, 2);
            $table->decimal('additional_price', 10, 2)->default(0);
            $table->timestamps();
            
            $table->unique(['item_id', 'size_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('item_sizes');
    }
};