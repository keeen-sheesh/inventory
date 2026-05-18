<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cashier_shift_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shift_id')->constrained('cashier_shifts')->cascadeOnDelete();

            $table->enum('type', ['sale', 'expense']);
            $table->decimal('amount', 10, 2);
            $table->string('description')->nullable();
            $table->enum('source', ['pos', 'manual'])->default('manual');

            $table->foreignId('sale_id')->nullable()->constrained('sales')->nullOnDelete();

            $table->timestamps();

            $table->unique('sale_id');
            $table->index(['shift_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cashier_shift_transactions');
    }
};

