<?php

namespace App\Http\Controllers;

use App\Models\MataKuliahPBLKelompokKecil;
use App\Models\KelompokKecil;
use App\Models\MataKuliah;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class MataKuliahPBLKelompokKecilController extends Controller
{
    /**
     * Store kelompok kecil mapping for a mata kuliah PBL
     */
    public function store(Request $request, $mataKuliahKode)
    {
        $request->validate([
            'nama_kelompok_list' => 'array',
            'nama_kelompok_list.*' => 'string',
            'semester' => 'required|string',
        ]);
        $semester = $request->semester;
        $namaKelompokList = $request->nama_kelompok_list ?? [];

        // Hapus mapping yang tidak ada di list baru (atau hapus semua jika list kosong)
        MataKuliahPBLKelompokKecil::where('mata_kuliah_kode', $mataKuliahKode)
            ->where('semester', $semester)
            ->when(count($namaKelompokList) > 0, function ($query) use ($namaKelompokList) {
                $query->whereNotIn('nama_kelompok', $namaKelompokList);
            })
            ->when(count($namaKelompokList) === 0, function ($query) {
                // Jika list kosong, hapus semua mapping
                return $query;
            })
            ->delete();

        // Check if mata kuliah exists and is a Blok type
        $mataKuliah = MataKuliah::where('kode', $mataKuliahKode)
            ->where('jenis', 'Blok')
            ->first();
        if (!$mataKuliah) {
            return response()->json(['message' => 'Mata kuliah tidak ditemukan atau bukan jenis Blok'], 404);
        }
        // Cek duplikasi mapping
        $usedKelompok = MataKuliahPBLKelompokKecil::whereIn('nama_kelompok', $namaKelompokList)
            ->where('semester', $semester)
            ->where('mata_kuliah_kode', '!=', $mataKuliahKode)
            ->first();
        if ($usedKelompok) {
            return response()->json([
                'message' => "Beberapa kelompok sudah digunakan oleh mata kuliah lain di semester ini"
            ], 400);
        }
        DB::transaction(function () use ($mataKuliahKode, $semester, $namaKelompokList) {
            foreach ($namaKelompokList as $namaKelompok) {
                // Cek apakah mapping sudah ada
                $exists = MataKuliahPBLKelompokKecil::where('mata_kuliah_kode', $mataKuliahKode)
                    ->where('semester', $semester)
                    ->where('nama_kelompok', $namaKelompok)
                    ->exists();
                if (!$exists) {
                    MataKuliahPBLKelompokKecil::create([
                        'mata_kuliah_kode' => $mataKuliahKode,
                        'nama_kelompok' => $namaKelompok,
                        'semester' => $semester,
                    ]);
                }
            }
        });

        // Log aktivitas mapping kelompok
        activity()
            ->causedBy(Auth::user())
            ->log("Menambahkan mapping kelompok untuk mata kuliah {$mataKuliahKode} dengan " . count($namaKelompokList) . " kelompok");

        return response()->json(['message' => 'Mapping kelompok berhasil disimpan']);
    }

    /**
     * Get available kelompok kecil for PBL (not used by other mata kuliah)
     */
    public function getAvailableKelompok()
    {
        // Get active semester
        $activeSemester = DB::table('semesters')
            ->where('aktif', true)
            ->first();

        if (!$activeSemester) {
            return response()->json(['message' => 'Tidak ada semester aktif'], 404);
        }

        // Get kelompok kecil dari semester aktif
        $kelompokKecil = KelompokKecil::where('semester', $activeSemester->jenis)->get();

        // Get nama_kelompok yang sudah dipakai di mapping PBL untuk semester aktif
        $usedNamaKelompok = MataKuliahPBLKelompokKecil::where('semester', $activeSemester->jenis)
            ->pluck('nama_kelompok')
            ->toArray();

        // Filter kelompok yang belum dipakai
        $availableKelompok = $kelompokKecil->filter(function ($kelompok) use ($usedNamaKelompok) {
            return !in_array($kelompok->nama_kelompok, $usedNamaKelompok);
        });

        return response()->json($availableKelompok->values());
    }

    /**
     * Get all kelompok kecil with usage status
     */
    public function getAllKelompokWithStatus()
    {
        // Get active semester
        $activeSemester = DB::table('semesters')
            ->where('aktif', true)
            ->first();

        if (!$activeSemester) {
            return response()->json(['message' => 'Tidak ada semester aktif'], 404);
        }

        // Get kelompok kecil from active semester
        $kelompokKecil = KelompokKecil::where('semester', $activeSemester->jenis)
            ->get();

        // Get mapping data
        $mappings = MataKuliahPBLKelompokKecil::with('mataKuliah')->get();

        // Add usage status to each kelompok (berdasarkan nama_kelompok dan semester)
        $kelompokWithStatus = $kelompokKecil->map(function ($kelompok) use ($mappings, $activeSemester) {
            $mapping = $mappings->where('nama_kelompok', $kelompok->nama_kelompok)
                ->where('semester', $activeSemester->jenis)
                ->first();
            return [
                'id' => $kelompok->id,
                'nama_kelompok' => $kelompok->nama_kelompok,
                'jumlah_anggota' => $kelompok->jumlah_anggota,
                'semester' => $kelompok->semester,
                'is_used' => $mapping ? true : false,
                'used_by' => $mapping ? $mapping->mataKuliah->nama : null,
                'used_by_kode' => $mapping ? $mapping->mata_kuliah_kode : null,
            ];
        });

        return response()->json($kelompokWithStatus);
    }

    /**
     * Hapus mapping kelompok dari mata kuliah dan semester tertentu
     */
    public function destroyMapping(Request $request, $mataKuliahKode)
    {
        $request->validate([
            'nama_kelompok' => 'required|string',
            'semester' => 'required|string',
        ]);
        $deleted = MataKuliahPBLKelompokKecil::where('mata_kuliah_kode', $mataKuliahKode)
            ->where('nama_kelompok', $request->nama_kelompok)
            ->where('semester', $request->semester)
            ->delete();
        if ($deleted) {
            return response()->json(['message' => 'Mapping kelompok berhasil dihapus']);
        } else {
            return response()->json(['message' => 'Mapping tidak ditemukan'], 404);
        }
    }

    /**
     * Endpoint: GET /api/pbl-kelompok-kecil/list?semester=...
     * Mengembalikan semua kelompok kecil semester tsb + status mapping PBL
     */
    public function listKelompokWithStatus(Request $request)
    {
        $semester = $request->query('semester');
        if (!$semester) {
            return response()->json(['message' => 'Parameter semester diperlukan'], 400);
        }
        $kelompokKecil = \App\Models\KelompokKecil::where('semester', $semester)->get();
        $mappings = \App\Models\MataKuliahPBLKelompokKecil::where('semester', $semester)->get();
        $result = $kelompokKecil->map(function ($kelompok) use ($mappings) {
            $mapping = $mappings->where('nama_kelompok', $kelompok->nama_kelompok)->first();
            return [
                'id' => $kelompok->id,
                'nama_kelompok' => $kelompok->nama_kelompok,
                'jumlah_anggota' => $kelompok->jumlah_anggota,
                'is_used' => $mapping ? true : false,
                'used_by' => $mapping ? $mapping->mata_kuliah_kode : null,
            ];
        });
        return response()->json($result);
    }

    /**
     * Batch mapping kelompok kecil untuk banyak mata kuliah sekaligus
     * Endpoint: POST /api/mata-kuliah/pbl-kelompok-kecil/batch
     * Body: { "mata_kuliah_kode": ["MK001", "MK002"], "semester": "1" }
     * Response: { "MK001": ["A", "B"], "MK002": ["C"] }
     */
    public function batchMapping(Request $request)
    {
        $kodeList = $request->input('mata_kuliah_kode', []);
        $semester = $request->input('semester');
        if (!is_array($kodeList) || !$semester) {
            return response()->json(['message' => 'Parameter mata_kuliah_kode (array) dan semester (string) diperlukan'], 400);
        }
        
        // OPTIMIZATION: Use single query with whereIn instead of foreach
        $allMappings = MataKuliahPBLKelompokKecil::where('semester', $semester)
            ->whereIn('mata_kuliah_kode', $kodeList)
            ->get()
            ->groupBy('mata_kuliah_kode');
        
        $result = [];
        foreach ($kodeList as $kode) {
            $mappings = $allMappings->get($kode, collect())->pluck('nama_kelompok')->toArray();
            $result[$kode] = $mappings;
        }
        
        return response()->json($result);
    }

    /**
     * Batch detail kelompok kecil berdasarkan array nama_kelompok dan semester
     * Endpoint: POST /api/kelompok-kecil/batch-detail
     * Body: { "nama_kelompok": ["A", "B"], "semester": "1" }
     * Response: [ { kelompok detail ... }, ... ]
     */
    public function batchKelompokDetail(Request $request)
    {
        $namaList = $request->input('nama_kelompok', []);
        $semester = $request->input('semester');
        if (!is_array($namaList) || !$semester) {
            return response()->json(['message' => 'Parameter nama_kelompok (array) dan semester (string) diperlukan'], 400);
        }
        
        // OPTIMIZATION: Use single query with whereIn
        $data = KelompokKecil::where('semester', $semester)
            ->whereIn('nama_kelompok', $namaList)
            ->get();
            
        return response()->json($data);
    }


    public function batchMappingMultiSemester(Request $request)
    {
        $semesterMap = $request->input('semester_map', []);
        $result = [];
        foreach ($semesterMap as $semester => $kodeList) {
            $allMappings = \App\Models\MataKuliahPBLKelompokKecil::where('semester', $semester)
                ->whereIn('mata_kuliah_kode', $kodeList)
                ->get()
                ->groupBy('mata_kuliah_kode');
            $result[$semester] = [];
            foreach ($kodeList as $kode) {
                $result[$semester][$kode] = $allMappings->get($kode, collect())->pluck('nama_kelompok')->toArray();
            }
        }
        return response()->json($result);
    }
}
