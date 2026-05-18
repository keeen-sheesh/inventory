<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_pools', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->timestamps();
        });

        DB::table('inventory_pools')->insert([
            [
                'code' => 'resto',
                'name' => 'Resto',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'kitchen',
                'name' => 'Kitchen',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_pools');
    }
};

