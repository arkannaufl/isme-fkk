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
        Schema::create('mata_kuliah_pbl_kelompok_kecil', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->string('nama_kelompok');
            $table->string('semester');
            $table->timestamps();

            // Foreign key constraint ke mata_kuliah saja
            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');

            // Unique constraint untuk mencegah duplikasi mapping
            $table->unique(['mata_kuliah_kode', 'nama_kelompok', 'semester'], 'pbl_kelompok_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mata_kuliah_pbl_kelompok_kecil');
    }
}; 