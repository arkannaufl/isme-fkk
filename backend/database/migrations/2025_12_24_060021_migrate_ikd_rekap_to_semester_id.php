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
     * 2. Populate dari tahun + semester ke semester_id berdasarkan tahun ajaran
     * 3. Set default untuk data baru
     * 4. Buat foreign key dan index
     * 5. Hapus kolom tahun dan semester setelah migrate (opsional, bisa dipertahankan untuk backward compatibility)
     */
    public function up(): void
    {
        if (Schema::hasTable('ikd_rekap')) {
            Schema::table('ikd_rekap', function (Blueprint $table) {
                // Tambahkan kolom semester_id nullable
                $table->unsignedBigInteger('semester_id')->nullable()->after('id');
            });
            
            // Populate semester_id dari tahun + semester
            // Mapping: tahun (integer) + semester (1 atau 2) -> semester_id
            // Kita perlu mencari semester berdasarkan tahun ajaran dan jenis semester
            DB::statement("
                UPDATE ikd_rekap ir
                INNER JOIN tahun_ajaran ta ON (
                    SUBSTRING_INDEX(ta.tahun, '/', 1) = ir.tahun
                )
                INNER JOIN semesters s ON (
                    s.tahun_ajaran_id = ta.id 
                    AND s.jenis = CASE 
                        WHEN ir.semester = 1 THEN 'Ganjil'
                        WHEN ir.semester = 2 THEN 'Genap'
                        ELSE NULL
                    END
                )
                SET ir.semester_id = s.id
                WHERE ir.semester_id IS NULL 
                AND ir.semester IS NOT NULL
                AND ir.tahun IS NOT NULL
            ");
            
            // Untuk data yang tidak bisa di-mapping (semester NULL atau tahun tidak match),
            // populate dengan semester aktif
            $activeSemester = DB::table('semesters')->where('aktif', true)->first();
            if ($activeSemester) {
                DB::table('ikd_rekap')
                    ->whereNull('semester_id')
                    ->update(['semester_id' => $activeSemester->id]);
            }
            
            // Tambahkan foreign key dan index setelah populate
            Schema::table('ikd_rekap', function (Blueprint $table) {
                $table->foreign('semester_id')
                      ->references('id')
                      ->on('semesters')
                      ->onDelete('restrict');
                
                $table->index('semester_id');
                
                // Update index yang sudah ada untuk include semester_id
                // Note: Kita tetap pertahankan index dengan tahun dan semester untuk backward compatibility
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('ikd_rekap')) {
            Schema::table('ikd_rekap', function (Blueprint $table) {
                $table->dropForeign(['semester_id']);
                $table->dropIndex(['semester_id']);
                $table->dropColumn('semester_id');
            });
        }
    }
};
