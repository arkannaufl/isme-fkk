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
        // Fix kelompok_besar
        Schema::table('kelompok_besar', function (Blueprint $table) {
            // 1. Add new index first so foreign key is happy
            $table->index('mahasiswa_id', 'mahasiswa_id_temp_index');
            
            // 2. Drop old unique constraint
            $table->dropUnique(['mahasiswa_id', 'semester']);
            
            // 3. Add new unique constraint
            $table->unique(['mahasiswa_id', 'semester_id'], 'kb_mahasiswa_semester_id_unique');
            
            // 4. Drop temp index
            $table->dropIndex('mahasiswa_id_temp_index');
        });

        // Fix kelompok_kecil
        Schema::table('kelompok_kecil', function (Blueprint $table) {
            $table->index('mahasiswa_id', 'mahasiswa_id_temp_index_kk');
            
            // Use try-catch or existence check because we might have modified it manually or partially
            try {
                $table->dropUnique(['mahasiswa_id', 'semester']);
            } catch (\Exception $e) {
                // Ignore if index doesn't exist
            }
            
            $table->unique(['mahasiswa_id', 'semester_id'], 'kk_mahasiswa_semester_id_unique');
            $table->dropIndex('mahasiswa_id_temp_index_kk');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kelompok_besar', function (Blueprint $table) {
            $table->dropUnique('kb_mahasiswa_semester_id_unique');
            $table->unique(['mahasiswa_id', 'semester']);
        });

        Schema::table('kelompok_kecil', function (Blueprint $table) {
            $table->dropUnique('kk_mahasiswa_semester_id_unique');
            $table->unique(['mahasiswa_id', 'semester']);
        });
    }
};
