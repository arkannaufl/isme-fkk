<?php

namespace App\Http\Controllers;

use App\Models\HasilSidangSkripsi;
use App\Models\JadwalNonBlokNonCSR;
use App\Models\PenilaianSidangSkripsi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class HasilSidangSkripsiController extends Controller
{
    /**
     * Get hasil for a specific jadwal
     */
    public function getByJadwal($jadwalId)
    {
        $hasil = HasilSidangSkripsi::where('jadwal_id', $jadwalId)
            ->with('moderator:id,name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $hasil,
        ]);
    }

    /**
     * Get hasil for a specific mahasiswa in a jadwal
     */
    public function getByMahasiswa($jadwalId, $mahasiswaId)
    {
        $hasil = HasilSidangSkripsi::where('jadwal_id', $jadwalId)
            ->where('mahasiswa_id', $mahasiswaId)
            ->first();

        return response()->json([
            'success' => true,
            'data' => $hasil,
        ]);
    }

    /**
     * Store or update hasil sidang skripsi
     */
    public function store(Request $request)
    {
        $request->validate([
            'jadwal_id' => 'required|numeric',
            'mahasiswa_id' => 'required|numeric',
            'judul_skripsi' => 'required|string',
            'keputusan' => 'required|in:tidak_lulus,lulus_tanpa_perbaikan,lulus_dengan_perbaikan',
            'catatan_perbaikan' => 'nullable|string',
        ]);

        $userId = Auth::id();
        $user = Auth::user();

        // Verify user is moderator/pembimbing for this jadwal
        $jadwal = JadwalNonBlokNonCSR::find($request->jadwal_id);
        if (!$jadwal) {
            return response()->json([
                'success' => false,
                'message' => 'Jadwal tidak ditemukan',
            ], 404);
        }

        // Check if hasil already exists and is finalized
        $existingHasil = HasilSidangSkripsi::where('jadwal_id', $request->jadwal_id)
            ->where('mahasiswa_id', $request->mahasiswa_id)
            ->first();

        // Jika sudah finalized, hanya admin/tim akademik yang bisa edit
        if ($existingHasil && $existingHasil->is_finalized) {
            $isAdmin = in_array($user->role, ['super_admin', 'tim_akademik']);
            if (!$isAdmin) {
                return response()->json([
                    'success' => false,
                    'message' => 'Keputusan sudah di-finalize dan tidak dapat diubah. Silakan hubungi admin jika perlu perubahan.',
                ], 403);
            }
        }

        $hasil = HasilSidangSkripsi::updateOrCreate(
            [
                'jadwal_id' => $request->jadwal_id,
                'mahasiswa_id' => $request->mahasiswa_id,
            ],
            [
                'moderator_id' => $userId,
                'judul_skripsi' => $request->judul_skripsi,
                'keputusan' => $request->keputusan,
                'catatan_perbaikan' => $request->keputusan === 'lulus_dengan_perbaikan'
                    ? $request->catatan_perbaikan
                    : null,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Keputusan berhasil disimpan',
            'data' => $hasil,
        ]);
    }

    /**
     * Finalize hasil sidang skripsi
     */
    public function finalize(Request $request)
    {
        $request->validate([
            'jadwal_id' => 'required|numeric',
            'mahasiswa_id' => 'required|numeric',
        ]);

        $userId = Auth::id();

        // Verify user is moderator/pembimbing for this jadwal
        $jadwal = JadwalNonBlokNonCSR::find($request->jadwal_id);
        if (!$jadwal) {
            return response()->json([
                'success' => false,
                'message' => 'Jadwal tidak ditemukan',
            ], 404);
        }

        $hasil = HasilSidangSkripsi::where('jadwal_id', $request->jadwal_id)
            ->where('mahasiswa_id', $request->mahasiswa_id)
            ->first();

        if (!$hasil) {
            return response()->json([
                'success' => false,
                'message' => 'Keputusan belum dibuat',
            ], 404);
        }

        if ($hasil->is_finalized) {
            return response()->json([
                'success' => false,
                'message' => 'Keputusan sudah di-finalize sebelumnya',
            ], 400);
        }

        // Validasi: Pastikan semua penguji sudah memberikan nilai
        $expectedPengujiIds = [];

        // Tambahkan pembimbing
        if ($jadwal->pembimbing_id) {
            $expectedPengujiIds[] = $jadwal->pembimbing_id;
        }

        // Tambahkan penguji (penguji_ids)
        $pengujiIds = $jadwal->penguji_ids;
        if ($pengujiIds) {
            // Jika berupa JSON string, decode dulu
            if (is_string($pengujiIds)) {
                $pengujiIds = json_decode($pengujiIds, true);
            }

            if (is_array($pengujiIds)) {
                foreach ($pengujiIds as $pengujiId) {
                    if (is_numeric($pengujiId)) {
                        $expectedPengujiIds[] = $pengujiId;
                    }
                }
            }
        }

        // Cek penilaian yang sudah ada
        $existingPenilaian = PenilaianSidangSkripsi::where('jadwal_id', $request->jadwal_id)
            ->where('mahasiswa_id', $request->mahasiswa_id)
            ->whereNotNull('nilai_akhir')
            ->pluck('penguji_id')
            ->toArray();

        // Cek apakah semua penguji sudah memberikan nilai
        $missingPenguji = array_diff($expectedPengujiIds, $existingPenilaian);

        if (!empty($missingPenguji)) {
            $missingCount = count($missingPenguji);
            return response()->json([
                'success' => false,
                'message' => "Masih ada {$missingCount} penguji yang belum memberikan nilai. Semua penguji harus memberikan nilai terlebih dahulu sebelum dapat mem-finalize keputusan.",
            ], 400);
        }

        $hasil->update([
            'is_finalized' => true,
            'finalized_at' => now(),
            'finalized_by' => $userId,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Keputusan berhasil di-finalize',
            'data' => $hasil->load('finalizedBy'),
        ]);
    }

    /**
     * Unfinalize hasil sidang skripsi (hanya untuk admin)
     */
    public function unfinalize(Request $request)
    {
        $request->validate([
            'jadwal_id' => 'required|numeric',
            'mahasiswa_id' => 'required|numeric',
        ]);

        $user = Auth::user();

        // Hanya admin/tim akademik yang bisa unfinalize
        $isAdmin = in_array($user->role, ['super_admin', 'tim_akademik']);
        if (!$isAdmin) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya admin yang dapat membatalkan finalize',
            ], 403);
        }

        $hasil = HasilSidangSkripsi::where('jadwal_id', $request->jadwal_id)
            ->where('mahasiswa_id', $request->mahasiswa_id)
            ->first();

        if (!$hasil) {
            return response()->json([
                'success' => false,
                'message' => 'Keputusan tidak ditemukan',
            ], 404);
        }

        if (!$hasil->is_finalized) {
            return response()->json([
                'success' => false,
                'message' => 'Keputusan belum di-finalize',
            ], 400);
        }

        $hasil->update([
            'is_finalized' => false,
            'finalized_at' => null,
            'finalized_by' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Finalize berhasil dibatalkan',
            'data' => $hasil,
        ]);
    }
}
