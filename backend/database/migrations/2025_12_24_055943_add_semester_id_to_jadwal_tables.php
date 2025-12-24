<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Strategi aman:
     * 1. Tambahkan semester_id nullable
     * 2. Populate dengan semester aktif untuk data existing
     * 3. Set default untuk data baru
     * 4. Buat foreign key dan index
     */
    public function up(): void
    {
        // Ambil semester aktif untuk populate data existing
        $activeSemester = DB::table('semesters')->where('aktif', true)->first();
        
        // Daftar tabel jadwal yang perlu ditambahkan semester_id
        $jadwalTables = [
            'jadwal_pbl',
            'jadwal_csr',
            'jadwal_kuliah_besar',
            'jadwal_praktikum',
            'jadwal_jurnal_reading',
            'jadwal_non_blok_non_csr',
            'jadwal_seminar_pleno',
            'jadwal_persamaan_persepsi',
            'jadwal_agenda_khusus',
        ];

        foreach ($jadwalTables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) use ($activeSemester, $tableName) {
                    // Tambahkan kolom semester_id nullable
                    $table->unsignedBigInteger('semester_id')->nullable()->after('id');
                    
                    // Populate dengan semester aktif untuk data existing
                    if ($activeSemester) {
                        DB::table($tableName)->whereNull('semester_id')->update([
                            'semester_id' => $activeSemester->id
                        ]);
                    }
                    
                    // Set default untuk data baru (akan di-set otomatis oleh model/controller)
                    // Tapi kita tetap buat nullable untuk backward compatibility
                });
                
                // Tambahkan foreign key dan index setelah populate
                Schema::table($tableName, function (Blueprint $table) {
                    $table->foreign('semester_id')
                          ->references('id')
                          ->on('semesters')
                          ->onDelete('restrict'); // Restrict untuk mencegah penghapusan semester yang masih digunakan
                    
                    $table->index('semester_id');
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $jadwalTables = [
            'jadwal_pbl',
            'jadwal_csr',
            'jadwal_kuliah_besar',
            'jadwal_praktikum',
            'jadwal_jurnal_reading',
            'jadwal_non_blok_non_csr',
            'jadwal_seminar_pleno',
            'jadwal_persamaan_persepsi',
            'jadwal_agenda_khusus',
        ];

        foreach ($jadwalTables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->dropForeign(['semester_id']);
                    $table->dropIndex(['semester_id']);
                    $table->dropColumn('semester_id');
                });
            }
        }
    }
};
