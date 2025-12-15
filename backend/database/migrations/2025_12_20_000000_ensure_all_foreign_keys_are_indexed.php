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
     * This migration ensures all foreign keys have indexes for optimal query performance.
     * Foreign keys are automatically indexed in MySQL, but this migration adds explicit
     * indexes for any that might be missing and adds composite indexes for frequently
     * queried column combinations.
     */
    public function up(): void
    {
        // Get all tables with foreign keys that might need indexes
        $tables = [
            'jadwal_kuliah_besar' => [
                ['mata_kuliah_kode', 'tanggal'],
                ['dosen_id', 'tanggal'],
                ['ruangan_id', 'tanggal'],
            ],
            'jadwal_praktikum' => [
                ['mata_kuliah_kode', 'tanggal'],
                ['kelompok_kecil_id', 'tanggal'],
                ['ruangan_id', 'tanggal'],
            ],
            'jadwal_pbl' => [
                ['mata_kuliah_kode', 'tanggal'],
                ['modul_pbl_id', 'tanggal'],
                ['kelompok_kecil_id', 'tanggal'],
                ['ruangan_id', 'tanggal'],
            ],
            'jadwal_csr' => [
                ['mata_kuliah_kode', 'tanggal'],
                ['ruangan_id', 'tanggal'],
            ],
            'jadwal_jurnal_reading' => [
                ['mata_kuliah_kode', 'tanggal'],
                ['kelompok_kecil_id', 'tanggal'],
                ['dosen_id', 'tanggal'],
                ['ruangan_id', 'tanggal'],
            ],
            'jadwal_non_blok_non_csr' => [
                ['mata_kuliah_kode', 'tanggal'],
                ['ruangan_id', 'tanggal'],
                ['pembimbing_id', 'tanggal'],
            ],
            'jadwal_agenda_khusus' => [
                ['mata_kuliah_kode', 'tanggal'],
                ['ruangan_id', 'tanggal'],
            ],
            'jadwal_seminar_pleno' => [
                ['mata_kuliah_kode', 'tanggal'],
                ['ruangan_id', 'tanggal'],
            ],
            'kelompok_kecil' => [
                ['kelompok_besar_id', 'nama_kelompok'],
            ],
            'mata_kuliah_pbl' => [
                ['mata_kuliah_kode', 'modul_ke'],
            ],
            'absensi' => [
                ['jadwal_id', 'mahasiswa_id', 'tanggal'],
                ['mahasiswa_id', 'tanggal'],
            ],
            'absensi_dosen_praktikum' => [
                ['jadwal_praktikum_id', 'dosen_id', 'tanggal'],
            ],
            'penilaian_pbl' => [
                ['jadwal_pbl_id', 'mahasiswa_id'],
                ['mahasiswa_id', 'created_at'],
            ],
            'penilaian_jurnal_reading' => [
                ['jadwal_jurnal_reading_id', 'mahasiswa_id'],
                ['mahasiswa_id', 'created_at'],
            ],
            'penilaian_seminar_proposal' => [
                ['jadwal_id', 'mahasiswa_id'],
                ['mahasiswa_id', 'created_at'],
            ],
            'penilaian_sidang_skripsi' => [
                ['jadwal_id', 'mahasiswa_id'],
                ['mahasiswa_id', 'created_at'],
            ],
            'forums' => [
                ['category_id', 'status', 'created_at'],
                ['user_id', 'status'],
            ],
            'forum_replies' => [
                ['forum_id', 'user_id', 'created_at'],
                ['parent_id', 'created_at'],
            ],
            'notifications' => [
                ['user_id', 'read_at', 'created_at'],
                ['user_id', 'type'],
            ],
            'activity_log' => [
                ['causer_id', 'subject_type', 'created_at'],
                ['subject_id', 'subject_type', 'created_at'],
            ],
        ];

        foreach ($tables as $tableName => $indexes) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            foreach ($indexes as $indexColumns) {
                $indexName = $tableName . '_' . implode('_', $indexColumns) . '_index';
                
                // Check if index already exists
                $indexExists = DB::select("
                    SELECT COUNT(*) as count
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = ?
                    AND INDEX_NAME = ?
                ", [$tableName, $indexName]);

                if ($indexExists[0]->count == 0) {
                    // Check if all columns exist
                    $columnsExist = true;
                    foreach ($indexColumns as $column) {
                        if (!Schema::hasColumn($tableName, $column)) {
                            $columnsExist = false;
                            break;
                        }
                    }

                    if ($columnsExist) {
                        try {
                            Schema::table($tableName, function (Blueprint $table) use ($indexColumns, $indexName) {
                                $table->index($indexColumns, $indexName);
                            });
                        } catch (\Exception $e) {
                            \Log::warning("Failed to create index {$indexName} on {$tableName}: " . $e->getMessage());
                        }
                    }
                }
            }
        }

        // Add indexes for frequently queried single columns
        $singleColumnIndexes = [
            'users' => ['role', 'semester', 'is_logged_in', 'created_at'],
            'mata_kuliah' => ['semester', 'jenis', 'kurikulum', 'created_at'],
            'ruangan' => ['nama', 'kapasitas'],
            'kelompok_besar' => ['nama_kelompok'],
            'kelompok_kecil' => ['nama_kelompok'],
            'jadwal_kuliah_besar' => ['tanggal', 'jam_mulai'],
            'jadwal_praktikum' => ['tanggal', 'jam_mulai'],
            'jadwal_pbl' => ['tanggal', 'jam_mulai'],
            'jadwal_csr' => ['tanggal', 'jam_mulai'],
            'jadwal_jurnal_reading' => ['tanggal', 'jam_mulai'],
            'jadwal_non_blok_non_csr' => ['tanggal', 'jam_mulai'],
            'jadwal_agenda_khusus' => ['tanggal', 'jam_mulai'],
            'notifications' => ['type', 'created_at'],
            'activity_log' => ['event', 'created_at'],
        ];

        foreach ($singleColumnIndexes as $tableName => $columns) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            foreach ($columns as $column) {
                if (!Schema::hasColumn($tableName, $column)) {
                    continue;
                }

                $indexName = $tableName . '_' . $column . '_index';
                
                $indexExists = DB::select("
                    SELECT COUNT(*) as count
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = ?
                    AND INDEX_NAME = ?
                ", [$tableName, $indexName]);

                if ($indexExists[0]->count == 0) {
                    try {
                        Schema::table($tableName, function (Blueprint $table) use ($column, $indexName) {
                            $table->index($column, $indexName);
                        });
                    } catch (\Exception $e) {
                        \Log::warning("Failed to create index {$indexName} on {$tableName}: " . $e->getMessage());
                    }
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Note: We don't drop indexes in down() to avoid breaking production
        // If you need to rollback, do it manually after careful consideration
    }
};

