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
            // Tambahkan kolom untuk Seminar Proposal
            if (!Schema::hasColumn('jadwal_non_blok_non_csr', 'pembimbing_id')) {
                $table->unsignedBigInteger('pembimbing_id')->nullable()->after('dosen_id');
                $table->foreign('pembimbing_id')->references('id')->on('users')->onDelete('set null');
            }
            
            if (!Schema::hasColumn('jadwal_non_blok_non_csr', 'komentator_ids')) {
                $table->json('komentator_ids')->nullable()->after('pembimbing_id');
            }
            
            if (!Schema::hasColumn('jadwal_non_blok_non_csr', 'mahasiswa_nims')) {
                $table->json('mahasiswa_nims')->nullable()->after('kelompok_besar_antara_id');
            }
        });

        // Update enum jenis_baris untuk menambahkan 'seminar_proposal'
        // MySQL tidak support ALTER ENUM langsung, jadi kita perlu menggunakan DB::statement
        DB::statement("ALTER TABLE jadwal_non_blok_non_csr MODIFY COLUMN jenis_baris ENUM('materi', 'agenda', 'seminar_proposal') NOT NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_non_blok_non_csr', function (Blueprint $table) {
            // Hapus foreign key dan kolom
            if (Schema::hasColumn('jadwal_non_blok_non_csr', 'pembimbing_id')) {
                $table->dropForeign(['pembimbing_id']);
                $table->dropColumn('pembimbing_id');
            }
            
            if (Schema::hasColumn('jadwal_non_blok_non_csr', 'komentator_ids')) {
                $table->dropColumn('komentator_ids');
            }
            
            if (Schema::hasColumn('jadwal_non_blok_non_csr', 'mahasiswa_nims')) {
                $table->dropColumn('mahasiswa_nims');
            }
        });

        // Kembalikan enum jenis_baris ke versi sebelumnya
        DB::statement("ALTER TABLE jadwal_non_blok_non_csr MODIFY COLUMN jenis_baris ENUM('materi', 'agenda') NOT NULL");
    }
};
