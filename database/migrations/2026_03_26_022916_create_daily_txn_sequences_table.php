<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_txn_sequences', function (Blueprint $table) {
            $table->date('txn_date')->primary();
            $table->unsignedInteger('current_sequence')->default(0);
            $table->timestamp('last_updated')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_txn_sequences');
    }
};
