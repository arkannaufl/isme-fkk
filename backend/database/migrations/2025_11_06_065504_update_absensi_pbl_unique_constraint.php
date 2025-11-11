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
        Schema::table('absensi_pbl', function (Blueprint $table) {
            // Hapus constraint lama
            $table->dropUnique('absensi_pbl_unique');
            
            // Buat constraint baru yang include jadwal_pbl_id
            // MySQL memperlakukan NULL sebagai nilai yang berbeda dalam unique constraint,
            // jadi multiple NULL tidak akan konflik, tapi kita perlu memastikan
            // bahwa jika jadwal_pbl_id ada, kombinasi harus unik
            $table->unique(['mata_kuliah_kode', 'kelompok', 'pertemuan', 'mahasiswa_npm', 'jadwal_pbl_id'], 'absensi_pbl_unique_with_jadwal');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('absensi_pbl', function (Blueprint $table) {
            // Hapus constraint baru
            $table->dropUnique('absensi_pbl_unique_with_jadwal');
            
            // Kembalikan constraint lama
            $table->unique(['mata_kuliah_kode', 'kelompok', 'pertemuan', 'mahasiswa_npm'], 'absensi_pbl_unique');
        });
    }
};
