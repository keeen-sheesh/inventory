<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('expenses')) {
            return;
        }

        Schema::table('expenses', function (Blueprint $table) {
            if (! Schema::hasColumn('expenses', 'date')) {
                $table->date('date')->nullable()->index();
            }

            if (! Schema::hasColumn('expenses', 'amount')) {
                $table->decimal('amount', 10, 2)->default(0);
            }

            if (! Schema::hasColumn('expenses', 'description')) {
                $table->text('description')->nullable();
            }

            if (! Schema::hasColumn('expenses', 'category')) {
                $table->string('category')->nullable();
            }

            if (! Schema::hasColumn('expenses', 'payment_method')) {
                $table->string('payment_method')->nullable();
            }
        });
    }

    public function down(): void
    {
        // Non-destructive: existing systems may already rely on these columns.
    }
};

