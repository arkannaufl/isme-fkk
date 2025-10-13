<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\KelompokKecil;
use App\Models\KelompokBesar;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MahasiswaController extends Controller
{
    /**
     * Get profil akademik mahasiswa
     */
    public function getProfilAkademik($id)
    {
        try {
            $mahasiswa = User::where('id', $id)
                ->where('role', 'mahasiswa')
                ->first();

            if (!$mahasiswa) {
                return response()->json([
                    'message' => 'Mahasiswa tidak ditemukan'
                ], 404);
            }

            // Get kelompok kecil from kelompok_kecil table where mahasiswa_id = $id
            $kelompokKecil = KelompokKecil::where('mahasiswa_id', $id)->first();

            // Get kelompok besar based on semester
            $kelompokBesar = KelompokBesar::where('semester', $mahasiswa->semester)->first();

            return response()->json([
                'message' => 'Profil akademik berhasil diambil',
                'data' => [
                    'id' => $mahasiswa->id,
                    'nim' => $mahasiswa->nim,
                    'name' => $mahasiswa->name,
                    'email' => $mahasiswa->email,
                    'semester' => (string)$mahasiswa->semester,
                    'semester_aktif' => (string)$mahasiswa->semester,
                    'angkatan' => $mahasiswa->angkatan,
                    'ipk' => $mahasiswa->ipk,
                    'status' => $mahasiswa->status,
                    'kelompok_kecil' => $kelompokKecil ? [
                        'id' => $kelompokKecil->id,
                        'nama' => $kelompokKecil->nama_kelompok,
                        'semester' => $kelompokKecil->semester,
                    ] : null,
                    'kelompok_besar' => $kelompokBesar ? [
                        'id' => $kelompokBesar->id,
                        'semester' => $kelompokBesar->semester,
                    ] : null,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching profil akademik: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil profil akademik',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get jadwal hari ini untuk mahasiswa
     */
    public function getJadwalHariIni($id)
    {
        try {
            // This is placeholder - will implement later
            return response()->json([
                'message' => 'Jadwal hari ini berhasil diambil',
                'data' => []
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching jadwal hari ini: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil jadwal hari ini',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get jadwal mendatang untuk mahasiswa
     */
    public function getJadwalMendatang($id)
    {
        try {
            // This is placeholder - will implement later
            return response()->json([
                'message' => 'Jadwal mendatang berhasil diambil',
                'data' => []
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching jadwal mendatang: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil jadwal mendatang',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get attendance summary
     */
    public function getAttendanceSummary($id)
    {
        try {
            // This is placeholder - will implement later
            return response()->json([
                'message' => 'Ringkasan kehadiran berhasil diambil',
                'data' => [
                    'total_pertemuan' => 0,
                    'hadir' => 0,
                    'izin' => 0,
                    'sakit' => 0,
                    'alpha' => 0,
                    'persentase_kehadiran' => 0
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching attendance summary: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil ringkasan kehadiran',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get score summary
     */
    public function getScoreSummary($id)
    {
        try {
            // This is placeholder - will implement later
            return response()->json([
                'message' => 'Ringkasan nilai berhasil diambil',
                'data' => [
                    'ipk' => 0,
                    'total_sks' => 0,
                    'matkul_lulus' => 0,
                    'matkul_tidak_lulus' => 0
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching score summary: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil ringkasan nilai',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
