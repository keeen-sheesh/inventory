<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::create('purchase_receipts', function (Blueprint $table) {
        $table->id();
        $table->string('receipt_number')->unique();
        $table->string('supplier_name')->nullable();
        $table->date('receipt_date');
        $table->text('notes')->nullable();
        $table->foreignId('inventory_pool_id')->constrained()->cascadeOnDelete();
        $table->foreignId('user_id')->constrained()->cascadeOnDelete();
        $table->decimal('total_amount', 10, 2)->default(0);
        $table->timestamps();
    });
}

public function down(): void
{
    Schema::dropIfExists('purchase_receipts');
}
};
