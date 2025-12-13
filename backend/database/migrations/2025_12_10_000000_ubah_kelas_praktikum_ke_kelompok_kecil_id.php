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
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            // 1. Tambah kolom kelompok_kecil_id (nullable dulu untuk migration data existing)
            $table->unsignedBigInteger('kelompok_kecil_id')->nullable()->after('topik');
            $table->foreign('kelompok_kecil_id')
                ->references('id')
                ->on('kelompok_kecil')
                ->onDelete('cascade');
        });
        
        // 2. Migrate data existing dari kelas_praktikum ke kelompok_kecil_id
        $this->migrateExistingData();
        
        // 3. Set nullable = false dan hapus kolom kelas_praktikum
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            $table->unsignedBigInteger('kelompok_kecil_id')->nullable(false)->change();
            $table->dropColumn('kelas_praktikum');
        });
    }
    
    /**
     * Migrate existing data from kelas_praktikum to kelompok_kecil_id
     */
    private function migrateExistingData(): void
    {
        // Ambil semua jadwal yang masih punya kelas_praktikum
        $jadwals = DB::table('jadwal_praktikum')
            ->whereNotNull('kelas_praktikum')
            ->whereNull('kelompok_kecil_id')
            ->get();
        
        foreach ($jadwals as $jadwal) {
            // Ambil mata kuliah untuk dapatkan semester
            $mataKuliah = DB::table('mata_kuliah')
                ->where('kode', $jadwal->mata_kuliah_kode)
                ->first();
            
            if (!$mataKuliah) {
                continue;
            }
            
            // Cari kelas berdasarkan nama_kelas dan semester
            $kelas = DB::table('kelas')
                ->where('nama_kelas', $jadwal->kelas_praktikum)
                ->where('semester', $mataKuliah->semester)
                ->first();
            
            if (!$kelas) {
                // Jika kelas tidak ditemukan, log warning dan skip
                \Log::warning("Kelas praktikum tidak ditemukan untuk migration", [
                    'jadwal_id' => $jadwal->id,
                    'kelas_praktikum' => $jadwal->kelas_praktikum,
                    'semester' => $mataKuliah->semester
                ]);
                continue;
            }
            
            // Ambil kelompok pertama dari kelas ini
            $kelompokKelas = DB::table('kelas_kelompok')
                ->where('kelas_id', $kelas->id)
                ->where('semester', $mataKuliah->semester)
                ->first();
            
            if ($kelompokKelas) {
                // Cari ID kelompok kecil berdasarkan nama_kelompok dan semester
                $kelompokKecil = DB::table('kelompok_kecil')
                    ->where('nama_kelompok', $kelompokKelas->nama_kelompok)
                    ->where('semester', $mataKuliah->semester)
                    ->first();
                
                if ($kelompokKecil) {
                    // Update jadwal dengan kelompok_kecil_id
                    DB::table('jadwal_praktikum')
                        ->where('id', $jadwal->id)
                        ->update(['kelompok_kecil_id' => $kelompokKecil->id]);
                } else {
                    \Log::warning("Kelompok kecil tidak ditemukan untuk migration", [
                        'jadwal_id' => $jadwal->id,
                        'nama_kelompok' => $kelompokKelas->nama_kelompok,
                        'semester' => $mataKuliah->semester
                    ]);
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            // Kembalikan kolom kelas_praktikum
            $table->string('kelas_praktikum')->nullable()->after('topik');
        });
        
        // Migrate data kembali dari kelompok_kecil_id ke kelas_praktikum
        // Note: Ini hanya akan mengambil kelas pertama yang berisi kelompok tersebut
        $jadwals = DB::table('jadwal_praktikum')
            ->whereNotNull('kelompok_kecil_id')
            ->get();
        
        foreach ($jadwals as $jadwal) {
            $kelompokKecil = DB::table('kelompok_kecil')
                ->where('id', $jadwal->kelompok_kecil_id)
                ->first();
            
            if ($kelompokKecil) {
                // Cari kelas yang berisi kelompok ini
                $kelasKelompok = DB::table('kelas_kelompok')
                    ->where('nama_kelompok', $kelompokKecil->nama_kelompok)
                    ->where('semester', $kelompokKecil->semester)
                    ->first();
                
                if ($kelasKelompok) {
                    $kelas = DB::table('kelas')
                        ->where('id', $kelasKelompok->kelas_id)
                        ->first();
                    
                    if ($kelas) {
                        DB::table('jadwal_praktikum')
                            ->where('id', $jadwal->id)
                            ->update(['kelas_praktikum' => $kelas->nama_kelas]);
                    }
                }
            }
        }
        
        // Hapus foreign key dan kolom kelompok_kecil_id
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            $table->dropForeign(['kelompok_kecil_id']);
            $table->dropColumn('kelompok_kecil_id');
        });
    }
};

