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
        Schema::create('jadwal_praktikum_kelompok', function (Blueprint $table) {
            $table->id();
            $table->foreignId('jadwal_praktikum_id')->constrained('jadwal_praktikum')->onDelete('cascade');
            $table->foreignId('kelompok_kecil_id')->constrained('kelompok_kecil')->onDelete('cascade');
            $table->timestamps();
        });

        // Optional: migrate existing data if needed
        // DB::statement("INSERT INTO jadwal_praktikum_kelompok (jadwal_praktikum_id, kelompok_kecil_id, created_at, updated_at) SELECT id, kelompok_kecil_id, created_at, updated_at FROM jadwal_praktikum WHERE kelompok_kecil_id IS NOT NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jadwal_praktikum_kelompok');
    }
};
