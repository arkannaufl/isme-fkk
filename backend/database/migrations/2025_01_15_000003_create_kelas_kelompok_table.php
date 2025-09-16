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
        Schema::create('kelas_kelompok', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('kelas_id');
            $table->string('semester');
            $table->string('nama_kelompok'); // Kelompok 1, Kelompok 2, dst
            $table->timestamps();

            // Foreign key ke tabel kelas
            $table->foreign('kelas_id')->references('id')->on('kelas')->onDelete('cascade');
            
            // Unique constraint: satu kelompok hanya bisa ada di satu kelas per semester
            $table->unique(['kelas_id', 'semester', 'nama_kelompok']);
            
            // Index untuk performa query
            $table->index(['kelas_id', 'semester']);
            $table->index(['semester', 'nama_kelompok']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kelas_kelompok');
    }
}; 