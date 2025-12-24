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
     * 2. Populate dari semester aktif untuk data existing (karena semester string tidak bisa langsung di-mapping)
     * 3. Set default untuk data baru
     * 4. Buat foreign key dan index
     * 5. Hapus kolom semester string setelah migrate (opsional, bisa dipertahankan untuk backward compatibility)
     */
    public function up(): void
    {
        // Ambil semester aktif untuk populate data existing
        $activeSemester = DB::table('semesters')->where('aktif', true)->first();
        
        // Daftar tabel kelompok yang perlu ditambahkan semester_id
        $kelompokTables = [
            'kelompok_besar',
            'kelompok_kecil',
            'kelompok_csr', // Jika ada
        ];

        foreach ($kelompokTables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName, $activeSemester) {
                    // Tambahkan kolom semester_id nullable
                    $table->unsignedBigInteger('semester_id')->nullable()->after('id');
                });
                
                // Populate dengan semester aktif untuk data existing
                // Note: Karena semester string tidak bisa langsung di-mapping ke semester_id,
                // kita akan populate dengan semester aktif saat ini
                // Data lama tetap bisa diakses melalui kolom semester string
                if ($activeSemester) {
                    DB::table($tableName)->whereNull('semester_id')->update([
                        'semester_id' => $activeSemester->id
                    ]);
                }
                
                // Tambahkan foreign key dan index setelah populate
                Schema::table($tableName, function (Blueprint $table) {
                    $table->foreign('semester_id')
                          ->references('id')
                          ->on('semesters')
                          ->onDelete('restrict');
                    
                    $table->index('semester_id');
                });
                
                // Update unique constraint untuk include semester_id
                // Note: Kita tetap pertahankan unique constraint dengan semester string untuk backward compatibility
                // Tapi kita juga perlu unique constraint dengan semester_id
                try {
                    Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                        // Cek apakah ada unique constraint dengan mahasiswa_id dan semester
                        $indexes = DB::select("SHOW INDEXES FROM {$tableName} WHERE Key_name LIKE '%mahasiswa%'");
                        
                        // Jika ada unique constraint dengan mahasiswa_id dan semester string,
                        // kita perlu membuat unique constraint baru dengan semester_id
                        if (Schema::hasColumn($tableName, 'mahasiswa_id')) {
                            // Buat unique constraint baru dengan semester_id
                            // Tapi kita perlu hati-hati karena mungkin ada data duplikat
                            // Jadi kita skip dulu, akan dibuat manual jika diperlukan
                        }
                    });
                } catch (\Exception $e) {
                    // Skip jika ada error, mungkin constraint sudah ada atau struktur berbeda
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $kelompokTables = [
            'kelompok_besar',
            'kelompok_kecil',
            'kelompok_csr',
        ];

        foreach ($kelompokTables as $tableName) {
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
