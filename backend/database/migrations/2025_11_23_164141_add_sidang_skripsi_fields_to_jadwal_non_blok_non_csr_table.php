<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('jadwal_non_blok_non_csr', function (Blueprint $table) {
            // Tambahkan kolom untuk Sidang Skripsi
            if (!Schema::hasColumn('jadwal_non_blok_non_csr', 'penguji_ids')) {
                $table->json('penguji_ids')->nullable()->after('komentator_ids');
            }
        });

        // Update enum jenis_baris untuk menambahkan 'sidang_skripsi'
        DB::statement("ALTER TABLE jadwal_non_blok_non_csr MODIFY COLUMN jenis_baris ENUM('materi', 'agenda', 'seminar_proposal', 'sidang_skripsi') NOT NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_non_blok_non_csr', function (Blueprint $table) {
            // Hapus kolom
            if (Schema::hasColumn('jadwal_non_blok_non_csr', 'penguji_ids')) {
                $table->dropColumn('penguji_ids');
            }
        });

        // Kembalikan enum jenis_baris ke versi sebelumnya
        DB::statement("ALTER TABLE jadwal_non_blok_non_csr MODIFY COLUMN jenis_baris ENUM('materi', 'agenda', 'seminar_proposal') NOT NULL");
    }
};
