<?php

namespace App\Http\Controllers;

use App\Models\PenilaianSeminarProposal;
use App\Models\JadwalNonBlokNonCSR;
use App\Models\HasilSeminarProposal;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PenilaianSeminarProposalController extends Controller
{
    /**
     * Get penilaian for a specific jadwal
     */
    public function getByJadwal($jadwalId)
    {
        $jadwal = JadwalNonBlokNonCSR::findOrFail($jadwalId);
        
        // Get all penilaian for this jadwal
        $penilaian = PenilaianSeminarProposal::where('jadwal_id', $jadwalId)
            ->with(['mahasiswa:id,name,nim', 'penguji:id,name,nid'])
            ->get();

        // Group by mahasiswa
        $grouped = $penilaian->groupBy('mahasiswa_id')->map(function ($items, $mahasiswaId) {
            $mahasiswa = $items->first()->mahasiswa;
            $nilaiPerPenguji = $items->map(function ($item) {
                return [
                    'id' => $item->id,
                    'penguji_id' => $item->penguji_id,
                    'penguji_name' => $item->penguji->name ?? null,
                    'peran_penguji' => $item->peran_penguji,
                    'nilai_penyajian_lisan' => $item->nilai_penyajian_lisan,
                    'nilai_sistematika_penulisan' => $item->nilai_sistematika_penulisan,
                    'nilai_isi_tulisan' => $item->nilai_isi_tulisan,
                    'nilai_originalitas' => $item->nilai_originalitas,
                    'nilai_tanya_jawab' => $item->nilai_tanya_jawab,
                    'nilai_akhir' => $item->nilai_akhir,
                    'catatan' => $item->catatan,
                ];
            });

            // Hitung nilai akhir mahasiswa (rata-rata dari semua penguji)
            $nilaiAkhirPenguji = $nilaiPerPenguji->pluck('nilai_akhir')->filter()->values();
            $nilaiAkhirMahasiswa = $nilaiAkhirPenguji->count() > 0 
                ? round($nilaiAkhirPenguji->avg(), 2) 
                : null;

            return [
                'mahasiswa_id' => $mahasiswaId,
                'mahasiswa_name' => $mahasiswa->name ?? null,
                'mahasiswa_nim' => $mahasiswa->nim ?? null,
                'nilai_per_penguji' => $nilaiPerPenguji->values(),
                'nilai_akhir' => $nilaiAkhirMahasiswa,
                'nilai_huruf' => $nilaiAkhirMahasiswa ? PenilaianSeminarProposal::konversiNilaiHuruf($nilaiAkhirMahasiswa) : null,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $grouped,
        ]);
    }

    /**
     * Store or update penilaian
     */
    public function store(Request $request)
    {
        $request->validate([
            'jadwal_id' => 'required|exists:jadwal_non_blok_non_csr,id',
            'mahasiswa_id' => 'required|integer',
            'peran_penguji' => 'required|in:moderator,komentator_1,komentator_2',
            'nilai_penyajian_lisan' => 'nullable|numeric|min:0|max:100',
            'nilai_sistematika_penulisan' => 'nullable|numeric|min:0|max:100',
            'nilai_isi_tulisan' => 'nullable|numeric|min:0|max:100',
            'nilai_originalitas' => 'nullable|numeric|min:0|max:100',
            'nilai_tanya_jawab' => 'nullable|numeric|min:0|max:100',
            'catatan' => 'nullable|string',
        ]);

        $pengujiId = Auth::id();
        $user = Auth::user();

        // Check if hasil is finalized
        $hasil = HasilSeminarProposal::where('jadwal_id', $request->jadwal_id)
            ->where('mahasiswa_id', $request->mahasiswa_id)
            ->first();

        // Jika sudah finalized, hanya admin yang bisa edit
        if ($hasil && $hasil->is_finalized) {
            $isAdmin = in_array($user->role, ['super_admin', 'tim_akademik']);
            if (!$isAdmin) {
                return response()->json([
                    'success' => false,
                    'message' => 'Penilaian tidak dapat diubah karena keputusan sudah di-finalize. Silakan hubungi admin jika perlu perubahan.',
                ], 403);
            }
        }

        // Find or create penilaian
        $penilaian = PenilaianSeminarProposal::updateOrCreate(
            [
                'jadwal_id' => $request->jadwal_id,
                'mahasiswa_id' => $request->mahasiswa_id,
                'penguji_id' => $pengujiId,
            ],
            [
                'peran_penguji' => $request->peran_penguji,
                'nilai_penyajian_lisan' => $request->nilai_penyajian_lisan,
                'nilai_sistematika_penulisan' => $request->nilai_sistematika_penulisan,
                'nilai_isi_tulisan' => $request->nilai_isi_tulisan,
                'nilai_originalitas' => $request->nilai_originalitas,
                'nilai_tanya_jawab' => $request->nilai_tanya_jawab,
                'catatan' => $request->catatan,
            ]
        );

        // Hitung dan simpan nilai akhir
        $penilaian->nilai_akhir = $penilaian->hitungNilaiAkhir();
        $penilaian->save();

        return response()->json([
            'success' => true,
            'message' => 'Penilaian berhasil disimpan',
            'data' => $penilaian,
        ]);
    }

    /**
     * Get penilaian summary for a mahasiswa in a jadwal
     */
    public function getSummary($jadwalId, $mahasiswaId)
    {
        $penilaian = PenilaianSeminarProposal::where('jadwal_id', $jadwalId)
            ->where('mahasiswa_id', $mahasiswaId)
            ->with(['penguji:id,name,nid'])
            ->get();

        $nilaiAkhirPenguji = $penilaian->pluck('nilai_akhir')->filter()->values();
        $nilaiAkhirMahasiswa = $nilaiAkhirPenguji->count() > 0 
            ? round($nilaiAkhirPenguji->avg(), 2) 
            : null;

        return response()->json([
            'success' => true,
            'data' => [
                'nilai_per_penguji' => $penilaian->map(function ($item) {
                    return [
                        'penguji_id' => $item->penguji_id,
                        'penguji_name' => $item->penguji->name ?? null,
                        'peran_penguji' => $item->peran_penguji,
                        'nilai_akhir' => $item->nilai_akhir,
                    ];
                }),
                'nilai_akhir' => $nilaiAkhirMahasiswa,
                'nilai_huruf' => $nilaiAkhirMahasiswa ? PenilaianSeminarProposal::konversiNilaiHuruf($nilaiAkhirMahasiswa) : null,
            ],
        ]);
    }

    /**
     * Get my penilaian for a specific jadwal and mahasiswa (untuk penguji yang login)
     */
    public function getMyPenilaian($jadwalId, $mahasiswaId)
    {
        $pengujiId = Auth::id();

        $penilaian = PenilaianSeminarProposal::where('jadwal_id', $jadwalId)
            ->where('mahasiswa_id', $mahasiswaId)
            ->where('penguji_id', $pengujiId)
            ->first();

        return response()->json([
            'success' => true,
            'data' => $penilaian,
        ]);
    }
}

