<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->decimal('opening_float', 10, 2)->default(0);   // cash declared at start of shift
            $table->decimal('expected_cash', 10, 2)->default(0);   // opening_float + all cash sales
            $table->decimal('actual_cash', 10, 2)->nullable();     // what cashier counted at close
            $table->decimal('discrepancy', 10, 2)->nullable();     // actual - expected (negative = short)
            $table->enum('status', ['open', 'closed', 'override'])->default('open');
            $table->foreignId('override_by')->nullable()->constrained('users')->nullOnDelete(); // manager who overrode
            $table->text('override_reason')->nullable();
            $table->timestamp('opened_at')->useCurrent();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_sessions');
    }
};