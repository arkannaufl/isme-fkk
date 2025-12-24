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
     * 2. Populate dari jadwal yang terkait untuk data existing
     * 3. Set default untuk data baru
     * 4. Buat foreign key dan index
     */
    public function up(): void
    {
        // Daftar tabel penilaian yang perlu ditambahkan semester_id
        // Format: ['table_name' => ['jadwal_table' => 'jadwal_table_name', 'foreign_key' => 'foreign_key_column']]
        $penilaianTables = [
            'penilaian_pbl' => ['jadwal_table' => 'jadwal_pbl', 'foreign_key' => 'jadwal_pbl_id'],
            'penilaian_jurnal' => ['jadwal_table' => 'jadwal_jurnal_reading', 'foreign_key' => 'jurnal_reading_id'],
            'penilaian_seminar_proposal' => ['jadwal_table' => 'jadwal_non_blok_non_csr', 'foreign_key' => 'jadwal_id'],
            'penilaian_sidang_skripsi' => ['jadwal_table' => 'jadwal_non_blok_non_csr', 'foreign_key' => 'jadwal_id'],
        ];

        foreach ($penilaianTables as $tableName => $config) {
            if (Schema::hasTable($tableName) && Schema::hasTable($config['jadwal_table'])) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName, $config) {
                    // Tambahkan kolom semester_id nullable
                    $table->unsignedBigInteger('semester_id')->nullable()->after('id');
                });
                
                // Populate semester_id dari jadwal yang terkait
                $foreignKey = $config['foreign_key'];
                $jadwalTable = $config['jadwal_table'];
                
                // Cek apakah kolom foreign key ada di tabel penilaian
                if (Schema::hasColumn($tableName, $foreignKey)) {
                    DB::statement("
                        UPDATE {$tableName} p
                        INNER JOIN {$jadwalTable} j ON p.{$foreignKey} = j.id
                        SET p.semester_id = j.semester_id
                        WHERE p.semester_id IS NULL AND j.semester_id IS NOT NULL
                    ");
                }
                
                // Tambahkan foreign key dan index setelah populate
                Schema::table($tableName, function (Blueprint $table) {
                    $table->foreign('semester_id')
                          ->references('id')
                          ->on('semesters')
                          ->onDelete('restrict');
                    
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
        $penilaianTables = [
            'penilaian_pbl',
            'penilaian_jurnal',
            'penilaian_seminar_proposal',
            'penilaian_sidang_skripsi',
        ];

        foreach ($penilaianTables as $tableName) {
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
