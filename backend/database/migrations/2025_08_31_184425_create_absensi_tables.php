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
        // Tabel absensi untuk jurnal reading
        Schema::create('absensi_jurnal', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_jurnal_reading_id');
            $table->string('mahasiswa_nim');
            $table->boolean('hadir')->default(false); // 0 = tidak hadir, 1 = hadir
            $table->timestamps();
            
            $table->foreign('jadwal_jurnal_reading_id')->references('id')->on('jadwal_jurnal_reading')->onDelete('cascade');
            $table->unique(['jadwal_jurnal_reading_id', 'mahasiswa_nim']);
        });

        // Tabel absensi untuk PBL
        Schema::create('absensi_pbl', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode', 20);
            $table->string('kelompok', 50);
            $table->string('pertemuan', 20); // Ubah dari integer ke string untuk mendukung "PBL 1", "PBL 2", dll
            $table->string('mahasiswa_npm', 20);
            $table->boolean('hadir')->default(false); // 0 = tidak hadir, 1 = hadir
            $table->timestamps();
            
            $table->unique(['mata_kuliah_kode', 'kelompok', 'pertemuan', 'mahasiswa_npm'], 'absensi_pbl_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('absensi_jurnal');
        Schema::dropIfExists('absensi_pbl');
    }
};
