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
        Schema::create('kelompok_kecil', function (Blueprint $table) {
            $table->id();
            $table->string('semester');
            $table->string('nama_kelompok'); // Kelompok 1, Kelompok 2, dst
            $table->unsignedBigInteger('mahasiswa_id');
            $table->integer('jumlah_kelompok'); // Total jumlah kelompok yang dibuat
            $table->timestamps();

            // Foreign key ke tabel users (mahasiswa)
            $table->foreign('mahasiswa_id')->references('id')->on('users')->onDelete('cascade');
            
            // Unique constraint: satu mahasiswa hanya bisa ada di satu kelompok per semester
            $table->unique(['mahasiswa_id', 'semester']);
            
            // Index untuk performa query
            $table->index(['semester', 'nama_kelompok']);
            $table->index(['semester', 'mahasiswa_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kelompok_kecil');
    }
}; 