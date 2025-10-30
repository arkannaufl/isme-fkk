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
        Schema::table('jadwal_pbl', function (Blueprint $table) {
            // Kolom SIAKAD yang tidak di-mapping ke sistem
            $table->string('siakad_kurikulum')->nullable();
            $table->string('siakad_kode_mk')->nullable();
            $table->string('siakad_nama_kelas')->nullable();
            $table->string('topik')->nullable();
            $table->string('siakad_substansi')->nullable();
            $table->string('siakad_jenis_pertemuan')->nullable();
            $table->string('siakad_metode')->nullable();
            $table->string('siakad_dosen_pengganti')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_pbl', function (Blueprint $table) {
            $table->dropColumn([
                'siakad_kurikulum',
                'siakad_kode_mk',
                'siakad_nama_kelas',
                'topik',
                'siakad_substansi',
                'siakad_jenis_pertemuan',
                'siakad_metode',
                'siakad_dosen_pengganti'
            ]);
        });
    }
};
