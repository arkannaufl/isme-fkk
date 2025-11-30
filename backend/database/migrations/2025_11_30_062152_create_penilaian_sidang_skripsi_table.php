<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('penilaian_sidang_skripsi', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_id'); // FK ke jadwal_non_blok_non_csr
            $table->unsignedBigInteger('mahasiswa_id'); // FK ke users (mahasiswa)
            $table->unsignedBigInteger('penguji_id'); // FK ke users (dosen penguji)
            $table->string('peran_penguji'); // pembimbing, penguji_1, penguji_2
            
            // 5 Aspek Penilaian (nilai 0-100)
            $table->decimal('nilai_penyajian_lisan', 5, 2)->nullable(); // Bobot 2
            $table->decimal('nilai_sistematika_penulisan', 5, 2)->nullable(); // Bobot 1
            $table->decimal('nilai_isi_tulisan', 5, 2)->nullable(); // Bobot 3
            $table->decimal('nilai_originalitas', 5, 2)->nullable(); // Bobot 1
            $table->decimal('nilai_tanya_jawab', 5, 2)->nullable(); // Bobot 3
            
            // Nilai akhir per penguji (hasil perhitungan)
            $table->decimal('nilai_akhir', 5, 2)->nullable();
            
            $table->text('catatan')->nullable(); // Catatan/masukan dari penguji
            $table->timestamps();
            
            // Unique constraint: 1 penguji hanya bisa nilai 1 mahasiswa 1x per jadwal
            $table->unique(['jadwal_id', 'mahasiswa_id', 'penguji_id'], 'unique_penilaian_sidang');
            
            // Foreign keys
            $table->foreign('jadwal_id')->references('id')->on('jadwal_non_blok_non_csr')->onDelete('cascade');
            $table->foreign('mahasiswa_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('penguji_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('penilaian_sidang_skripsi');
    }
};
