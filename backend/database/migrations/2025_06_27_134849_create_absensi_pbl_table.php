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
        // Tabel absensi untuk PBL
        Schema::create('absensi_pbl', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('semester_id')->nullable();
            $table->unsignedBigInteger('jadwal_pbl_id')->nullable();
            $table->string('mata_kuliah_kode', 20);
            $table->string('kelompok', 50);
            $table->string('pertemuan', 20); // Ubah dari integer ke string untuk mendukung "PBL 1", "PBL 2", dll
            $table->string('mahasiswa_npm', 20);
            $table->boolean('hadir')->default(false); // 0 = tidak hadir, 1 = hadir
            $table->text('catatan')->nullable();
            $table->timestamps();
            
            $table->foreign('jadwal_pbl_id')->references('id')->on('jadwal_pbl')->onDelete('cascade');
            $table->foreign('semester_id')->references('id')->on('semesters')->onDelete('restrict');
            $table->index('semester_id');
            $table->unique(['mata_kuliah_kode', 'kelompok', 'pertemuan', 'mahasiswa_npm', 'jadwal_pbl_id'], 'absensi_pbl_unique_with_jadwal');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('absensi_pbl');
    }
};

