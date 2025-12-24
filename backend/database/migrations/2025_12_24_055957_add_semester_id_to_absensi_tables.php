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
        // Daftar tabel absensi yang perlu ditambahkan semester_id
        // Format: ['table_name' => ['jadwal_table' => 'jadwal_table_name', 'foreign_key' => 'foreign_key_column', 'has_fk' => true/false]]
        // has_fk: true jika foreign key sudah ada, false jika perlu populate dari semester aktif
        $absensiTables = [
            'absensi_pbl' => ['jadwal_table' => 'jadwal_pbl', 'foreign_key' => 'jadwal_pbl_id', 'has_fk' => true],
            'absensi_csr' => ['jadwal_table' => 'jadwal_csr', 'foreign_key' => 'jadwal_csr_id', 'has_fk' => true],
            'absensi_kuliah_besar' => ['jadwal_table' => 'jadwal_kuliah_besar', 'foreign_key' => 'jadwal_kuliah_besar_id', 'has_fk' => true],
            'absensi_praktikum' => ['jadwal_table' => 'jadwal_praktikum', 'foreign_key' => 'jadwal_praktikum_id', 'has_fk' => true],
            'absensi_jurnal' => ['jadwal_table' => 'jadwal_jurnal_reading', 'foreign_key' => 'jadwal_jurnal_reading_id', 'has_fk' => true],
            'absensi_non_blok_non_csr' => ['jadwal_table' => 'jadwal_non_blok_non_csr', 'foreign_key' => 'jadwal_non_blok_non_csr_id', 'has_fk' => true],
            'absensi_seminar_pleno' => ['jadwal_table' => 'jadwal_seminar_pleno', 'foreign_key' => 'jadwal_seminar_pleno_id', 'has_fk' => true],
            'absensi_persamaan_persepsi' => ['jadwal_table' => 'jadwal_persamaan_persepsi', 'foreign_key' => 'jadwal_persamaan_persepsi_id', 'has_fk' => true],
            'absensi_agenda_khusus' => ['jadwal_table' => 'jadwal_agenda_khusus', 'foreign_key' => 'jadwal_agenda_khusus_id', 'has_fk' => true],
            'absensi_dosen_praktikum' => ['jadwal_table' => 'jadwal_praktikum', 'foreign_key' => 'jadwal_praktikum_id', 'has_fk' => true],
        ];

        // Ambil semester aktif untuk populate data yang tidak punya foreign key
        $activeSemester = DB::table('semesters')->where('aktif', true)->first();
        
        foreach ($absensiTables as $tableName => $config) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName, $config) {
                    // Tambahkan kolom semester_id nullable
                    $table->unsignedBigInteger('semester_id')->nullable()->after('id');
                });
                
                // Populate semester_id dari jadwal yang terkait jika foreign key ada
                $foreignKey = $config['foreign_key'];
                $jadwalTable = $config['jadwal_table'];
                $hasFk = $config['has_fk'];
                
                // Cek apakah kolom foreign key ada di tabel absensi dan jadwal table ada
                if ($hasFk && Schema::hasColumn($tableName, $foreignKey) && Schema::hasTable($jadwalTable)) {
                    try {
                        DB::statement("
                            UPDATE {$tableName} a
                            INNER JOIN {$jadwalTable} j ON a.{$foreignKey} = j.id
                            SET a.semester_id = j.semester_id
                            WHERE a.semester_id IS NULL AND j.semester_id IS NOT NULL
                        ");
                    } catch (\Exception $e) {
                        // Jika error, populate dengan semester aktif
                        if ($activeSemester) {
                            DB::table($tableName)->whereNull('semester_id')->update([
                                'semester_id' => $activeSemester->id
                            ]);
                        }
                    }
                } else {
                    // Jika tidak punya foreign key, populate dengan semester aktif
                    if ($activeSemester) {
                        DB::table($tableName)->whereNull('semester_id')->update([
                            'semester_id' => $activeSemester->id
                        ]);
                    }
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
        $absensiTables = [
            'absensi_pbl',
            'absensi_csr',
            'absensi_kuliah_besar',
            'absensi_praktikum',
            'absensi_jurnal',
            'absensi_non_blok_non_csr',
            'absensi_seminar_pleno',
            'absensi_persamaan_persepsi',
            'absensi_agenda_khusus',
            'absensi_dosen_praktikum',
        ];

        foreach ($absensiTables as $tableName) {
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
