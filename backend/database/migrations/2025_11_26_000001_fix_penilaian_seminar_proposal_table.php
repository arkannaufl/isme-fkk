<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the old table
        Schema::dropIfExists('penilaian_seminar_proposal');
        
        // Recreate without strict FK on mahasiswa_id
        Schema::create('penilaian_seminar_proposal', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_id');
            $table->unsignedBigInteger('mahasiswa_id'); // ID mahasiswa (bisa dari users atau mahasiswa table)
            $table->unsignedBigInteger('penguji_id');
            $table->string('peran_penguji'); // moderator, komentator_1, komentator_2
            
            // 5 Aspek Penilaian (nilai 0-100)
            $table->decimal('nilai_penyajian_lisan', 5, 2)->nullable();
            $table->decimal('nilai_sistematika_penulisan', 5, 2)->nullable();
            $table->decimal('nilai_isi_tulisan', 5, 2)->nullable();
            $table->decimal('nilai_originalitas', 5, 2)->nullable();
            $table->decimal('nilai_tanya_jawab', 5, 2)->nullable();
            
            // Nilai akhir per penguji
            $table->decimal('nilai_akhir', 5, 2)->nullable();
            
            $table->text('catatan')->nullable();
            $table->timestamps();
            
            // Unique constraint
            $table->unique(['jadwal_id', 'mahasiswa_id', 'penguji_id'], 'unique_penilaian_sempro');
            
            // Only FK for jadwal and penguji
            $table->foreign('jadwal_id')->references('id')->on('jadwal_non_blok_non_csr')->onDelete('cascade');
            $table->foreign('penguji_id')->references('id')->on('users')->onDelete('cascade');
            
            // Index for faster queries
            $table->index('mahasiswa_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('penilaian_seminar_proposal');
    }
};

