<?php

namespace App\Http\Controllers;

use App\Models\PenilaianPBL;
use App\Models\AbsensiPBL;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PenilaianPBLController extends Controller
{
    // Ambil semua penilaian untuk satu kelompok & pertemuan
    public function index($kode, $kelompok, $pertemuan)
    {
        // Validasi akses dosen (termasuk super_admin dan tim_akademik)
        $this->validateDosenAccess($kode, $kelompok, $pertemuan);

        // Cek apakah ada jadwal_id dari query parameter (prioritas tertinggi)
        $jadwalId = request()->query('jadwal_id');
        $jadwal = null;
        
        if ($jadwalId) {
            // Jika ada jadwal_id, langsung ambil berdasarkan ID
            $jadwal = \App\Models\JadwalPBL::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();
        }

        // Jika tidak ada jadwal_id atau tidak ditemukan, gunakan metode lama
        if (!$jadwal) {
        // Ambil id kelompok kecil dari nama (jika perlu)
        $kelompokId = $kelompok;
        if (!is_numeric($kelompok)) {
            $kelompokObj = \App\Models\KelompokKecil::where('nama_kelompok', $kelompok)->first();
            $kelompokId = $kelompokObj ? $kelompokObj->id : null;
        }

        // Ambil jadwal PBL yang sesuai - coba dengan kelompok_kecil_id dulu
        $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok_kecil_id', $kelompokId)
            ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
            ->first();

        // Jika tidak ditemukan, coba dengan nama_kelompok melalui relasi
        if (!$jadwal) {
            $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                ->whereHas('kelompokKecil', function ($query) use ($kelompok) {
                    $query->where('nama_kelompok', $kelompok);
                })
                ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                ->first();
            }
        }

        // Validasi: Cek apakah jadwal ada
        if (!$jadwal) {
            return response()->json(['error' => 'Jadwal tidak ditemukan'], 404);
        }

        // Load relasi dosen untuk mendapatkan nama dosen pengampu
        $jadwal->load('dosen');
        
        // Ambil nama dosen pengampu
        $nama_dosen_pengampu = null;
        if ($jadwal->dosen) {
            $nama_dosen_pengampu = $jadwal->dosen->name ?? $jadwal->dosen->nama ?? null;
        } elseif ($jadwal->dosen_ids) {
            // Jika menggunakan dosen_ids, ambil dosen pertama
            $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
            if (is_array($dosenIds) && !empty($dosenIds)) {
                $dosen = \App\Models\User::find($dosenIds[0]);
                if ($dosen) {
                    $nama_dosen_pengampu = $dosen->name ?? $dosen->nama ?? null;
                }
            }
        }

        // Normalisasi parameter untuk query
        $kelompokNormalized = trim($kelompok);
        $pertemuanNormalized = trim($pertemuan);

        // Query penilaian - gunakan jadwal_pbl_id jika ada untuk memastikan data sesuai dengan jadwal yang spesifik
        // Jika tidak ada jadwal_pbl_id, gunakan metode lama (kompatibilitas dengan data lama)
        $query = PenilaianPBL::where('mata_kuliah_kode', $kode)
            ->whereRaw('TRIM(kelompok) = ?', [$kelompokNormalized])
            ->whereRaw('TRIM(pertemuan) = ?', [$pertemuanNormalized]);
        
        // Filter berdasarkan jadwal_pbl_id jika jadwal sudah ditemukan
        if ($jadwal && $jadwal->id) {
            $query->where('jadwal_pbl_id', $jadwal->id);
        }
        
        $data = $query->get();

        // Gunakan pbl_id dari jadwal (field yang sebenarnya di database)
        $modul_pbl_id = $jadwal->pbl_id ?? null;
        $nama_modul = null;

        if ($modul_pbl_id) {
            // Ambil nama modul dari tabel pbls
            $modul = \App\Models\PBL::find($modul_pbl_id);
            $nama_modul = $modul ? $modul->nama_modul : null;
        } else {
            // Fallback: coba ambil modul berdasarkan mata_kuliah_kode dan modul_ke
            // Jika pertemuan adalah "PBL 1", maka modul_ke = "1"
            $modulKe = null;
            if (preg_match('/PBL\s*(\d+)/i', $pertemuan, $matches)) {
                $modulKe = $matches[1];
            }

            if ($modulKe) {
                $modul = \App\Models\PBL::where('mata_kuliah_kode', $kode)
                    ->where('modul_ke', $modulKe)
                    ->first();

                $nama_modul = $modul ? $modul->nama_modul : null;
            }
        }

        // Tentukan apakah ini PBL 1 atau PBL 2
        $isPBL2 = $this->isPBL2($pertemuan);

        return response()->json([
            'penilaian' => $data,
            'modul_pbl_id' => $modul_pbl_id,
            'nama_modul' => $nama_modul,
            'is_pbl_2' => $isPBL2,
            'penilaian_submitted' => $jadwal->penilaian_submitted ?? false,
            'nama_dosen_pengampu' => $nama_dosen_pengampu,
        ]);
    }

    // Simpan/update penilaian (bulk per kelompok & pertemuan)
    public function store(Request $request, $kode, $kelompok, $pertemuan)
    {
        // Normalisasi parameter untuk konsistensi (sama dengan saat query)
        $kelompokNormalized = trim($kelompok);
        $pertemuanNormalized = trim($pertemuan);

        // Ambil jadwal PBL untuk mendapatkan jadwal_pbl_id SEBELUM validasi
        $jadwalId = request()->query('jadwal_id');
        $jadwal = null;
        
        if ($jadwalId) {
            // Jika ada jadwal_id, langsung ambil berdasarkan ID
            $jadwal = \App\Models\JadwalPBL::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();
                
            if (!$jadwal) {
                return response()->json([
                    'message' => 'Jadwal PBL tidak ditemukan dengan ID yang diberikan'
                ], 404);
            }
        }

        // Jika tidak ada jadwal_id atau tidak ditemukan, gunakan metode lama
        // Tapi hanya jika jadwal_id tidak diberikan (untuk kompatibilitas data lama)
        if (!$jadwal && !$jadwalId) {
            // Ambil id kelompok kecil dari nama (jika perlu)
            $kelompokId = $kelompokNormalized;
            if (!is_numeric($kelompokNormalized)) {
                $kelompokObj = \App\Models\KelompokKecil::where('nama_kelompok', $kelompokNormalized)->first();
                $kelompokId = $kelompokObj ? $kelompokObj->id : null;
            }

            // Ambil jadwal PBL yang sesuai - coba dengan kelompok_kecil_id dulu
            $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                ->where('kelompok_kecil_id', $kelompokId)
                ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuanNormalized)])
                ->first();

            // Jika tidak ditemukan, coba dengan nama_kelompok melalui relasi
            if (!$jadwal) {
                $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                    ->whereHas('kelompokKecil', function ($query) use ($kelompokNormalized) {
                        $query->where('nama_kelompok', $kelompokNormalized);
                    })
                    ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuanNormalized)])
                    ->first();
            }
        }

        // Validasi akses dosen - gunakan jadwal yang sudah ditemukan
        if ($jadwal) {
            $this->validateDosenAccessWithJadwal($kode, $kelompok, $pertemuan, $jadwal);
        } else {
        $this->validateDosenAccess($kode, $kelompok, $pertemuan);
        }

        // Tentukan apakah ini PBL 1 atau PBL 2
        $isPBL2 = $this->isPBL2($pertemuanNormalized);

        // Validasi dasar
        $validated = $request->validate([
            'penilaian' => 'required|array',
            'penilaian.*.mahasiswa_npm' => 'required|string',
            'penilaian.*.nilai_a' => 'required|integer',
            'penilaian.*.nilai_b' => 'required|integer',
            'penilaian.*.nilai_c' => 'required|integer',
            'penilaian.*.nilai_d' => 'required|integer',
            'penilaian.*.nilai_e' => 'required|integer',
            'penilaian.*.nilai_f' => 'required|integer',
            'penilaian.*.nilai_g' => 'required|integer',
            'penilaian.*.peta_konsep' => 'nullable|integer|min:0|max:100',
            'tanggal_paraf' => 'nullable|date',
            'signature_paraf' => 'nullable|string',
            'nama_tutor' => 'nullable|string',
        ]);

        foreach ($validated['penilaian'] as $row) {
            $dataToSave = [
                'mata_kuliah_kode' => $kode,
                'kelompok' => $kelompokNormalized,
                'pertemuan' => $pertemuanNormalized,
                'mahasiswa_npm' => $row['mahasiswa_npm'],
                'nilai_a' => $row['nilai_a'],
                'nilai_b' => $row['nilai_b'],
                'nilai_c' => $row['nilai_c'],
                'nilai_d' => $row['nilai_d'],
                'nilai_e' => $row['nilai_e'],
                'nilai_f' => $row['nilai_f'],
                'nilai_g' => $row['nilai_g'],
                'tanggal_paraf' => $validated['tanggal_paraf'] ?? null,
                'signature_paraf' => $validated['signature_paraf'] ?? null,
                'nama_tutor' => $validated['nama_tutor'] ?? null,
            ];

            // Tambahkan jadwal_pbl_id jika jadwal ditemukan - HARUS SEBELUM peta_konsep
            if ($jadwal && $jadwal->id) {
                $dataToSave['jadwal_pbl_id'] = $jadwal->id;
            } elseif ($jadwalId) {
                // Jika jadwal_id diberikan tapi jadwal tidak ditemukan, throw error
                return response()->json([
                    'message' => 'Jadwal PBL tidak ditemukan dengan ID yang diberikan'
                ], 404);
            }

            // Untuk PBL 2, simpan peta_konsep
            if ($isPBL2) {
                $dataToSave['peta_konsep'] = $row['peta_konsep'];
            } else {
                // Untuk PBL 1, set peta_konsep ke null
                $dataToSave['peta_konsep'] = null;
            }

            // UpdateOrCreate dengan kondisi yang mencakup jadwal_pbl_id jika ada
            $whereConditions = [
                    'mata_kuliah_kode' => $kode,
                'kelompok' => $kelompokNormalized,
                'pertemuan' => $pertemuanNormalized,
                    'mahasiswa_npm' => $row['mahasiswa_npm'],
            ];
            
            // Jika ada jadwal_pbl_id, tambahkan ke kondisi where
            if (isset($dataToSave['jadwal_pbl_id'])) {
                $whereConditions['jadwal_pbl_id'] = $dataToSave['jadwal_pbl_id'];
            }
            
            PenilaianPBL::updateOrCreate(
                $whereConditions,
                $dataToSave
            );
        }

        // Update jadwal PBL status penilaian_submitted
        // Gunakan jadwal yang sudah ditemukan jika ada, jika tidak gunakan method lama
        if ($jadwal && $jadwal->id) {
            $jadwal->update([
                'penilaian_submitted' => true,
                'penilaian_submitted_by' => auth()->id(),
                'penilaian_submitted_at' => now(),
            ]);
        } else {
            $this->updateJadwalPenilaianStatus($kode, $kelompokNormalized, $pertemuanNormalized);
        }

        // Log activity
        activity()
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'kelompok' => $kelompok,
                'pertemuan' => $pertemuan,
                'is_pbl2' => $isPBL2,
                'penilaian_count' => count($validated['penilaian'])
            ])
            ->log($isPBL2 ? 'Penilaian PBL 2 created' : 'Penilaian PBL 1 created');

        $message = $isPBL2 ? 'Penilaian PBL 2 berhasil disimpan' : 'Penilaian PBL 1 berhasil disimpan';
        return response()->json(['message' => $message]);
    }

    /**
     * Tentukan apakah pertemuan adalah PBL 2
     */
    private function isPBL2($pertemuan)
    {
        // Normalisasi pertemuan untuk pengecekan
        $pertemuanLower = strtolower(trim($pertemuan));

        // Cek berbagai kemungkinan format PBL 2
        $pbl2Patterns = [
            'pbl 2',
            'pbl2',
            '2',
            'pertemuan 2',
            'pertemuan2'
        ];

        foreach ($pbl2Patterns as $pattern) {
            if (strpos($pertemuanLower, $pattern) !== false) {
                return true;
            }
        }

        return false;
    }

    // Method untuk semester Antara - Ambil semua penilaian untuk satu kelompok & pertemuan
    public function indexAntara($kode, $kelompok, $pertemuan)
    {
        // Validasi akses dosen untuk semester antara
        $this->validateDosenAccessAntara($kode, $kelompok, $pertemuan);

        // Decode URL-encoded parameters
        $kelompokDecoded = urldecode($kelompok);
        $pertemuanDecoded = urldecode($pertemuan);

        // Cek apakah ada jadwal_id dari query parameter (prioritas tertinggi)
        $jadwalId = request()->query('jadwal_id');
        $jadwal = null;
        
        if ($jadwalId) {
            // Jika ada jadwal_id, langsung ambil berdasarkan ID
            $jadwal = \App\Models\JadwalPBL::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();
        }

        // Jika tidak ada jadwal_id atau tidak ditemukan, gunakan metode lama
        if (!$jadwal) {
        // Ambil id kelompok kecil antara dari nama
        $kelompokId = $kelompokDecoded;
        if (!is_numeric($kelompokDecoded)) {
            $kelompokObj = \App\Models\KelompokKecilAntara::where('nama_kelompok', $kelompokDecoded)->first();
            $kelompokId = $kelompokObj ? $kelompokObj->id : null;
        }

        // Ambil jadwal PBL yang sesuai untuk semester Antara
        $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok_kecil_antara_id', $kelompokId)
            ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuanDecoded)])
            ->first();
        }

        // Validasi: Cek apakah jadwal ada
        if (!$jadwal) {
            return response()->json(['error' => 'Jadwal tidak ditemukan'], 404);
        }

        // Load relasi dosen untuk mendapatkan nama dosen pengampu
        $jadwal->load('dosen');
        
        // Ambil nama dosen pengampu
        $nama_dosen_pengampu = null;
        if ($jadwal->dosen) {
            $nama_dosen_pengampu = $jadwal->dosen->name ?? $jadwal->dosen->nama ?? null;
        } elseif ($jadwal->dosen_ids) {
            // Jika menggunakan dosen_ids, ambil dosen pertama
            $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
            if (is_array($dosenIds) && !empty($dosenIds)) {
                $dosen = \App\Models\User::find($dosenIds[0]);
                if ($dosen) {
                    $nama_dosen_pengampu = $dosen->name ?? $dosen->nama ?? null;
                }
            }
        }

        // Validasi akses sudah dilakukan di validateDosenAccessAntara di atas

        // Normalisasi parameter untuk query
        $kelompokNormalized = trim($kelompokDecoded);
        $pertemuanNormalized = trim($pertemuanDecoded);

        // Query penilaian - gunakan jadwal_pbl_id jika ada untuk memastikan data sesuai dengan jadwal yang spesifik
        // Jika tidak ada jadwal_pbl_id, gunakan metode lama (kompatibilitas dengan data lama)
        $query = PenilaianPBL::where('mata_kuliah_kode', $kode)
            ->whereRaw('TRIM(kelompok) = ?', [$kelompokNormalized])
            ->whereRaw('TRIM(pertemuan) = ?', [$pertemuanNormalized]);
        
        // Filter berdasarkan jadwal_pbl_id jika jadwal sudah ditemukan
        if ($jadwal && $jadwal->id) {
            $query->where('jadwal_pbl_id', $jadwal->id);
        }
        
        $data = $query->get();

        // Gunakan pbl_id dari jadwal (field yang sebenarnya di database)
        $modul_pbl_id = $jadwal->pbl_id ?? null;
        $nama_modul = null;

        if ($modul_pbl_id) {
            // Ambil nama modul dari tabel pbls
            $modul = \App\Models\PBL::find($modul_pbl_id);
            $nama_modul = $modul ? $modul->nama_modul : null;
        } else {
            // Fallback: coba ambil modul berdasarkan mata_kuliah_kode dan modul_ke
            $modulKe = null;
            if (preg_match('/PBL\s*(\d+)/i', $pertemuan, $matches)) {
                $modulKe = $matches[1];
            }

            if ($modulKe) {
                $modul = \App\Models\PBL::where('mata_kuliah_kode', $kode)
                    ->where('modul_ke', $modulKe)
                    ->first();

                $nama_modul = $modul ? $modul->nama_modul : null;
            }
        }

        // Tentukan apakah ini PBL 1 atau PBL 2
        $isPBL2 = $this->isPBL2($pertemuan);

        return response()->json([
            'penilaian' => $data,
            'modul_pbl_id' => $modul_pbl_id,
            'nama_modul' => $nama_modul,
            'is_pbl_2' => $isPBL2,
            'penilaian_submitted' => $jadwal->penilaian_submitted ?? false,
            'nama_dosen_pengampu' => $nama_dosen_pengampu,
        ]);
    }

    // Method untuk semester Antara - Simpan/update penilaian
    public function storeAntara(Request $request, $kode, $kelompok, $pertemuan)
    {
        // Validasi akses dosen untuk semester antara
        $this->validateDosenAccessAntara($kode, $kelompok, $pertemuan);

        // Decode URL-encoded parameters
        $kelompokDecoded = urldecode($kelompok);
        $pertemuanDecoded = urldecode($pertemuan);

        // Tentukan apakah ini PBL 1 atau PBL 2
        $isPBL2 = $this->isPBL2($pertemuanDecoded);

        // Normalisasi parameter untuk konsistensi (sama dengan saat query)
        $kelompokNormalized = trim($kelompokDecoded);
        $pertemuanNormalized = trim($pertemuanDecoded);

        // Ambil jadwal PBL untuk mendapatkan jadwal_pbl_id
        $jadwalId = request()->query('jadwal_id');
        $jadwal = null;
        
        if ($jadwalId) {
            $jadwal = \App\Models\JadwalPBL::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();
        }
        
        // Jika tidak ada jadwal_id, coba cari berdasarkan kelompok dan pertemuan
        if (!$jadwal) {
            $kelompokId = $kelompokNormalized;
            if (!is_numeric($kelompokNormalized)) {
                $kelompokObj = \App\Models\KelompokKecilAntara::where('nama_kelompok', $kelompokNormalized)->first();
                $kelompokId = $kelompokObj ? $kelompokObj->id : null;
            }
            
            $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                ->where('kelompok_kecil_antara_id', $kelompokId)
                ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuanNormalized)])
                ->first();
        }

        // Validasi dasar
        $validated = $request->validate([
            'penilaian' => 'required|array',
            'penilaian.*.mahasiswa_npm' => 'required|string',
            'penilaian.*.nilai_a' => 'required|integer',
            'penilaian.*.nilai_b' => 'required|integer',
            'penilaian.*.nilai_c' => 'required|integer',
            'penilaian.*.nilai_d' => 'required|integer',
            'penilaian.*.nilai_e' => 'required|integer',
            'penilaian.*.nilai_f' => 'required|integer',
            'penilaian.*.nilai_g' => 'required|integer',
            'penilaian.*.peta_konsep' => 'nullable|integer|min:0|max:100',
            'tanggal_paraf' => 'nullable|date',
            'signature_paraf' => 'nullable|string',
            'nama_tutor' => 'nullable|string',
        ]);

        foreach ($validated['penilaian'] as $row) {
            $dataToSave = [
                'mata_kuliah_kode' => $kode,
                'kelompok' => $kelompokNormalized,
                'pertemuan' => $pertemuanNormalized,
                'mahasiswa_npm' => $row['mahasiswa_npm'],
                'nilai_a' => $row['nilai_a'],
                'nilai_b' => $row['nilai_b'],
                'nilai_c' => $row['nilai_c'],
                'nilai_d' => $row['nilai_d'],
                'nilai_e' => $row['nilai_e'],
                'nilai_f' => $row['nilai_f'],
                'nilai_g' => $row['nilai_g'],
                'tanggal_paraf' => $validated['tanggal_paraf'] ?? null,
                'signature_paraf' => $validated['signature_paraf'] ?? null,
                'nama_tutor' => $validated['nama_tutor'] ?? null,
            ];
            
            // Tambahkan jadwal_pbl_id jika jadwal ditemukan
            // Wajibkan jika jadwal_id diberikan di query parameter
            if ($jadwal && $jadwal->id) {
                $dataToSave['jadwal_pbl_id'] = $jadwal->id;
            } elseif ($jadwalId) {
                // Jika jadwal_id diberikan tapi jadwal tidak ditemukan, throw error
                return response()->json([
                    'message' => 'Jadwal PBL tidak ditemukan dengan ID yang diberikan'
                ], 404);
            }

            // Untuk PBL 2, simpan peta_konsep
            if ($isPBL2) {
                $dataToSave['peta_konsep'] = $row['peta_konsep'];
            } else {
                // Untuk PBL 1, set peta_konsep ke null
                $dataToSave['peta_konsep'] = null;
            }


            // UpdateOrCreate dengan kondisi yang mencakup jadwal_pbl_id jika ada
            $whereConditions = [
                    'mata_kuliah_kode' => $kode,
                'kelompok' => $kelompokNormalized,
                'pertemuan' => $pertemuanNormalized,
                    'mahasiswa_npm' => $row['mahasiswa_npm'],
            ];
            
            // Jika ada jadwal_pbl_id, tambahkan ke kondisi where
            if (isset($dataToSave['jadwal_pbl_id'])) {
                $whereConditions['jadwal_pbl_id'] = $dataToSave['jadwal_pbl_id'];
            }
            
            PenilaianPBL::updateOrCreate(
                $whereConditions,
                $dataToSave
            );
        }

        // Update jadwal PBL status penilaian_submitted untuk semester antara
        // Jika jadwal sudah ditemukan, update langsung
        if ($jadwal && $jadwal->id) {
            $jadwal->update([
                'penilaian_submitted' => true,
                'penilaian_submitted_by' => auth()->id(),
                'penilaian_submitted_at' => now(),
            ]);
        } else {
            // Fallback: update menggunakan metode lama
            $this->updateJadwalPenilaianStatusAntara($kode, $kelompokNormalized, $pertemuanNormalized);
        }

        // Log activity
        activity()
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'kelompok' => $kelompok,
                'pertemuan' => $pertemuan,
                'is_pbl2' => $isPBL2,
                'penilaian_count' => count($validated['penilaian']),
                'semester' => 'Antara'
            ])
            ->log($isPBL2 ? 'Penilaian PBL 2 (Antara) created' : 'Penilaian PBL 1 (Antara) created');

        $message = $isPBL2 ? 'Penilaian PBL 2 (Antara) berhasil disimpan' : 'Penilaian PBL 1 (Antara) berhasil disimpan';
        return response()->json(['message' => $message]);
    }

    // Method untuk absensi PBL
    public function getAbsensi($kode, $kelompok, $pertemuan)
    {
        try {
            // Normalisasi parameter
            $kelompokNormalized = trim($kelompok);
            $pertemuanNormalized = trim($pertemuan);

            // Cek apakah ada jadwal_id dari query parameter (prioritas tertinggi)
            $jadwalId = request()->query('jadwal_id');
            $jadwal = null;
            
            if ($jadwalId) {
                // Jika ada jadwal_id, langsung ambil berdasarkan ID
                $jadwal = \App\Models\JadwalPBL::where('id', $jadwalId)
                    ->where('mata_kuliah_kode', $kode)
                    ->first();
            }

            // Jika tidak ada jadwal_id atau tidak ditemukan, coba cari berdasarkan kelompok dan pertemuan
            // Cek dulu apakah ini semester antara atau reguler
            if (!$jadwal) {
                // Coba cari sebagai semester reguler dulu
                $kelompokId = $kelompokNormalized;
                if (!is_numeric($kelompokNormalized)) {
                    $kelompokObj = \App\Models\KelompokKecil::where('nama_kelompok', $kelompokNormalized)->first();
                    $kelompokId = $kelompokObj ? $kelompokObj->id : null;
                }
                
                if ($kelompokId) {
                    $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                        ->where('kelompok_kecil_id', $kelompokId)
                        ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuanNormalized)])
                        ->first();
                }
                
                // Jika tidak ditemukan sebagai reguler, coba sebagai semester antara
                if (!$jadwal) {
                    $kelompokAntaraId = $kelompokNormalized;
                    if (!is_numeric($kelompokNormalized)) {
                        $kelompokAntaraObj = \App\Models\KelompokKecilAntara::where('nama_kelompok', $kelompokNormalized)->first();
                        $kelompokAntaraId = $kelompokAntaraObj ? $kelompokAntaraObj->id : null;
                    }
                    
                    if ($kelompokAntaraId) {
                        $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                            ->where('kelompok_kecil_antara_id', $kelompokAntaraId)
                            ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuanNormalized)])
                            ->first();
                    }
                }
            }

            // Validasi akses dosen - gunakan jadwal yang sudah ditemukan jika ada
            if ($jadwal) {
                // Cek apakah ini semester antara atau reguler berdasarkan jadwal
                if ($jadwal->kelompok_kecil_antara_id) {
                    $this->validateDosenAccessAntara($kode, $kelompok, $pertemuan);
                } else {
            $this->validateDosenAccess($kode, $kelompok, $pertemuan);
                }
            } else {
                // Fallback: coba validasi sebagai reguler dulu
                try {
                    $this->validateDosenAccess($kode, $kelompok, $pertemuan);
                } catch (\Exception $e) {
                    // Jika gagal, coba sebagai semester antara
                    $this->validateDosenAccessAntara($kode, $kelompok, $pertemuan);
                }
            }

            // Query absensi - gunakan jadwal_pbl_id jika ada untuk memastikan data sesuai dengan jadwal yang spesifik
            $query = AbsensiPBL::where('mata_kuliah_kode', $kode)
                ->whereRaw('TRIM(kelompok) = ?', [$kelompokNormalized])
                ->whereRaw('TRIM(pertemuan) = ?', [$pertemuanNormalized]);
            
            // Filter berdasarkan jadwal_pbl_id jika jadwal sudah ditemukan
            if ($jadwal && $jadwal->id) {
                // Jika jadwal ditemukan, hanya ambil data dengan jadwal_pbl_id yang sesuai
                $query->where('jadwal_pbl_id', $jadwal->id);
            } elseif ($jadwalId) {
                // Jika jadwal_id diberikan tapi jadwal tidak ditemukan, return empty
                // (tapi seharusnya sudah di-handle di atas dengan error 404)
                $absensi = collect();
                return response()->json([
                    'absensi' => $absensi
                ]);
            }
            // Jika tidak ada jadwal_id dan jadwal tidak ditemukan, ambil semua data yang sesuai
            // (termasuk yang jadwal_pbl_id NULL untuk kompatibilitas data lama)
            
            $absensi = $query->get()->keyBy('mahasiswa_npm');

            return response()->json([
                'absensi' => $absensi
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal memuat data absensi: ' . $e->getMessage()], 500);
        }
    }

    public function storeAbsensi(Request $request, $kode, $kelompok, $pertemuan)
    {
        try {
            // Normalisasi parameter
            $kelompokNormalized = trim($kelompok);
            $pertemuanNormalized = trim($pertemuan);

            // Ambil jadwal PBL untuk mendapatkan jadwal_pbl_id SEBELUM validasi
            $jadwalId = request()->query('jadwal_id');
            $jadwal = null;
            
            if ($jadwalId) {
                $jadwal = \App\Models\JadwalPBL::where('id', $jadwalId)
                    ->where('mata_kuliah_kode', $kode)
                    ->first();
                    
                if (!$jadwal) {
                    return response()->json([
                        'message' => 'Jadwal PBL tidak ditemukan dengan ID yang diberikan'
                    ], 404);
                }
            }
            
            // Jika tidak ada jadwal_id atau tidak ditemukan, coba cari berdasarkan kelompok dan pertemuan
            // Cek dulu apakah ini semester antara atau reguler
            if (!$jadwal && !$jadwalId) {
                // Coba cari sebagai semester reguler dulu
                $kelompokId = $kelompokNormalized;
                if (!is_numeric($kelompokNormalized)) {
                    $kelompokObj = \App\Models\KelompokKecil::where('nama_kelompok', $kelompokNormalized)->first();
                    $kelompokId = $kelompokObj ? $kelompokObj->id : null;
                }
                
                if ($kelompokId) {
                    $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                        ->where('kelompok_kecil_id', $kelompokId)
                        ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuanNormalized)])
                        ->first();
                }
                
                // Jika tidak ditemukan sebagai reguler, coba sebagai semester antara
                if (!$jadwal) {
                    $kelompokAntaraId = $kelompokNormalized;
                    if (!is_numeric($kelompokNormalized)) {
                        $kelompokAntaraObj = \App\Models\KelompokKecilAntara::where('nama_kelompok', $kelompokNormalized)->first();
                        $kelompokAntaraId = $kelompokAntaraObj ? $kelompokAntaraObj->id : null;
                    }
                    
                    if ($kelompokAntaraId) {
                        $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                            ->where('kelompok_kecil_antara_id', $kelompokAntaraId)
                            ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuanNormalized)])
                            ->first();
                    }
                }
            }
            
            // Validasi akses dosen - gunakan jadwal yang sudah ditemukan jika ada
            if ($jadwal) {
                // Cek apakah ini semester antara atau reguler berdasarkan jadwal
                if ($jadwal->kelompok_kecil_antara_id) {
                    // Semester antara
                    $this->validateDosenAccessAntara($kode, $kelompok, $pertemuan);
                } else {
                    // Semester reguler
                    $this->validateDosenAccessWithJadwal($kode, $kelompok, $pertemuan, $jadwal);
                }
            } else {
                // Fallback: coba validasi sebagai reguler dulu
                try {
            $this->validateDosenAccess($kode, $kelompok, $pertemuan);
                } catch (\Exception $e) {
                    // Jika gagal, coba sebagai semester antara
                    $this->validateDosenAccessAntara($kode, $kelompok, $pertemuan);
                }
            }

            $request->validate([
                'absensi' => 'required|array',
                'absensi.*.mahasiswa_npm' => 'required|string',
                'absensi.*.hadir' => 'required|boolean',
                'absensi.*.catatan' => 'nullable|string',
            ]);

            // Simpan/update data absensi menggunakan updateOrCreate
            foreach ($request->absensi as $absen) {
                $whereConditions = [
                    'mata_kuliah_kode' => $kode,
                    'kelompok' => $kelompokNormalized,
                    'pertemuan' => $pertemuanNormalized,
                    'mahasiswa_npm' => $absen['mahasiswa_npm'],
                ];
                
                $absensiData = [
                    'hadir' => $absen['hadir'],
                    'catatan' => $absen['catatan'] ?? '',
                ];
                
                // Tambahkan jadwal_pbl_id jika jadwal ditemukan
                if ($jadwal && $jadwal->id) {
                    $whereConditions['jadwal_pbl_id'] = $jadwal->id;
                    $absensiData['jadwal_pbl_id'] = $jadwal->id;
                } elseif ($jadwalId) {
                    // Jika jadwal_id diberikan tapi jadwal tidak ditemukan, throw error
                    // (tapi sudah di-handle di atas)
                    continue;
                }
                
                AbsensiPBL::updateOrCreate(
                    $whereConditions,
                    $absensiData
                );
            }

            // Log activity
            activity()
                ->withProperties([
                    'mata_kuliah_kode' => $kode,
                    'kelompok' => $kelompok,
                    'pertemuan' => $pertemuan,
                    'absensi_count' => count($request->absensi)
                ])
                ->log("Absensi PBL created: {$kode} - {$kelompok} - {$pertemuan}");

            return response()->json(['message' => 'Absensi berhasil disimpan']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal menyimpan absensi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Update jadwal PBL penilaian_submitted status
     */
    private function updateJadwalPenilaianStatus($kode, $kelompok, $pertemuan)
    {
        try {
            // 1) Coba cari berdasarkan kelompok_kecil_id (jika yang diterima memang ID)
            $jadwal = null;
            if (is_numeric($kelompok)) {
                $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                    ->where('kelompok_kecil_id', $kelompok)
                    ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                    ->first();
            }

            // 2) Jika belum ketemu ATAU parameter sebenarnya nama kelompok numerik ("2"), cari berdasarkan nama_kelompok
            if (!$jadwal) {
                $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                    ->whereHas('kelompokKecil', function ($q) use ($kelompok) {
                        $q->where('nama_kelompok', $kelompok);
                    })
                    ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                    ->first();
            }

            if ($jadwal) {
                $jadwal->update([
                    'penilaian_submitted' => true,
                    'penilaian_submitted_by' => auth()->id(),
                    'penilaian_submitted_at' => now(),
                ]);
            }
        } catch (\Exception $e) {
            // Silently fail
        }
    }

    /**
     * Update jadwal PBL penilaian_submitted status untuk semester antara
     */
    private function updateJadwalPenilaianStatusAntara($kode, $kelompok, $pertemuan)
    {
        try {
            // 1) Coba cari berdasarkan kelompok_kecil_antara_id
            $jadwal = null;
            if (is_numeric($kelompok)) {
                $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                    ->where('kelompok_kecil_antara_id', $kelompok)
                    ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                    ->first();
            }

            // 2) Fallback berdasarkan nama_kelompok antara
            if (!$jadwal) {
                $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                    ->whereHas('kelompokKecilAntara', function ($q) use ($kelompok) {
                        $q->where('nama_kelompok', $kelompok);
                    })
                    ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                    ->first();
            }

            if ($jadwal) {
                $jadwal->update([
                    'penilaian_submitted' => true,
                    'penilaian_submitted_by' => auth()->id(),
                    'penilaian_submitted_at' => now(),
                ]);
            }
        } catch (\Exception $e) {
            // Silently fail
        }
    }

    // Validasi akses dosen untuk jadwal tertentu
    private function validateDosenAccess($kode, $kelompok, $pertemuan)
    {
        // Ambil id kelompok kecil dari nama (jika perlu)
        $kelompokId = $kelompok;
        if (!is_numeric($kelompok)) {
            $kelompokObj = \App\Models\KelompokKecil::where('nama_kelompok', $kelompok)->first();
            $kelompokId = $kelompokObj ? $kelompokObj->id : null;
        }

        // Ambil jadwal PBL yang sesuai - coba dengan kelompok_kecil_id dulu
        $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok_kecil_id', $kelompokId)
            ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
            ->first();

        // Jika tidak ditemukan, coba dengan nama_kelompok melalui relasi
        if (!$jadwal) {
            $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                ->whereHas('kelompokKecil', function ($query) use ($kelompok) {
                    $query->where('nama_kelompok', $kelompok);
                })
                ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                ->first();
        }

        // Validasi: Cek apakah jadwal ada
        if (!$jadwal) {
            abort(404, 'Jadwal tidak ditemukan');
        }

        // Validasi: Cek apakah user yang akses adalah dosen yang terdaftar atau admin
        $user = auth()->user();

        if ($user->role === 'dosen') {
            // Cek apakah dosen ini ada di daftar dosen_ids
            $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);

            // Jika dosen_ids kosong atau null, cek konfirmasi dosen
            if (!is_array($dosenIds) || empty($dosenIds)) {
                // Check if dosen has confirmed availability for this jadwal
                if ($this->isDosenConfirmedForJadwal($user->id, $kode, $kelompok, $pertemuan)) {
                    // Don't abort - allow access for confirmed dosen
                } else {
                    abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini');
                }
            } else {
                // Convert dosen_ids to integers for comparison
                $dosenIdsInt = array_map('intval', $dosenIds);

                if (!in_array((int)$user->id, $dosenIdsInt)) {
                    // Check if dosen has confirmed availability for this jadwal
                    if ($this->isDosenConfirmedForJadwal($user->id, $kode, $kelompok, $pertemuan)) {
                        // Don't abort - allow access for confirmed dosen
                    } else {
                        abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini');
                    }
                }
            }
        } elseif (!in_array($user->role, ['super_admin', 'tim_akademik'])) {
            // Hanya super_admin dan tim_akademik yang bisa akses selain dosen
            abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini');
        }
    }

    // Validasi akses dosen dengan jadwal yang sudah diketahui (untuk menghindari query ulang)
    private function validateDosenAccessWithJadwal($kode, $kelompok, $pertemuan, $jadwal)
    {
        // Validasi: Cek apakah user yang akses adalah dosen yang terdaftar atau admin
        $user = auth()->user();

        if ($user->role === 'dosen') {
            // Cek apakah dosen ini ada di daftar dosen_ids
            $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);

            // Jika dosen_ids kosong atau null, cek konfirmasi dosen
            if (!is_array($dosenIds) || empty($dosenIds)) {
                // Check if dosen has confirmed availability for this jadwal
                if ($this->isDosenConfirmedForJadwal($user->id, $kode, $kelompok, $pertemuan)) {
                    // Don't abort - allow access for confirmed dosen
                } else {
                    abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini');
                }
            } else {
                // Convert dosen_ids to integers for comparison
                $dosenIdsInt = array_map('intval', $dosenIds);

                if (!in_array((int)$user->id, $dosenIdsInt)) {
                    // Check if dosen has confirmed availability for this jadwal
                    if ($this->isDosenConfirmedForJadwal($user->id, $kode, $kelompok, $pertemuan)) {
                        // Don't abort - allow access for confirmed dosen
                    } else {
                        abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini');
                    }
                }
            }
        } elseif (!in_array($user->role, ['super_admin', 'tim_akademik'])) {
            // Hanya super_admin dan tim_akademik yang bisa akses selain dosen
            abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini');
        }
    }

    /**
     * Check if dosen has confirmed availability for specific jadwal
     * STRICT VALIDATION: Only allow if dosen is assigned AND has confirmed "bisa"
     */
    private function isDosenConfirmedForJadwal($dosenId, $kode, $kelompok, $pertemuan)
    {
        try {
            // Ambil id kelompok kecil dari nama (jika perlu)
            $kelompokId = $kelompok;
            if (!is_numeric($kelompok)) {
                $kelompokObj = \App\Models\KelompokKecil::where('nama_kelompok', $kelompok)->first();
                $kelompokId = $kelompokObj ? $kelompokObj->id : null;
            }

            // Cari jadwal PBL yang sesuai - prioritaskan yang memiliki dosen yang sesuai
            $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                ->where('kelompok_kecil_id', $kelompokId)
                ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                ->where(function ($query) use ($dosenId) {
                    $query->where('dosen_id', $dosenId)
                        ->orWhereJsonContains('dosen_ids', $dosenId);
                })
                ->first();

            // Jika tidak ditemukan, coba dengan nama_kelompok melalui relasi
            if (!$jadwal) {
                $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                    ->whereHas('kelompokKecil', function ($query) use ($kelompok) {
                        $query->where('nama_kelompok', $kelompok);
                    })
                    ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                    ->where(function ($query) use ($dosenId) {
                        $query->where('dosen_id', $dosenId)
                            ->orWhereJsonContains('dosen_ids', $dosenId);
                    })
                    ->first();
            }

            // Jika masih tidak ditemukan, ambil jadwal pertama yang cocok (fallback)
            if (!$jadwal) {
                $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                    ->where('kelompok_kecil_id', $kelompokId)
                    ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                    ->first();

                if (!$jadwal) {
                    $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                        ->whereHas('kelompokKecil', function ($query) use ($kelompok) {
                            $query->where('nama_kelompok', $kelompok);
                        })
                        ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                        ->first();
                }
            }

            if (!$jadwal) {
                return false;
            }

            // STRICT CHECK: Dosen must be assigned to this jadwal
            $isAssigned = false;
            if ($jadwal->dosen_id == $dosenId) {
                $isAssigned = true;
            } elseif ($jadwal->dosen_ids && in_array($dosenId, $jadwal->dosen_ids)) {
                $isAssigned = true;
            }

            if (!$isAssigned) {
                return false;
            }

            // STRICT CHECK: Dosen must have confirmed "bisa"
            if ($jadwal->status_konfirmasi === 'bisa') {
                return true;
            }

            // Check riwayat konfirmasi as additional verification
            $riwayat = \App\Models\RiwayatKonfirmasiDosen::where('dosen_id', $dosenId)
                ->where('jadwal_id', $jadwal->id)
                ->where('status_konfirmasi', 'bisa')
                ->first();

            if ($riwayat) {
                return true;
            }

            return false;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Check if dosen has confirmed availability for specific jadwal antara
     * STRICT VALIDATION: Only allow if dosen is assigned AND has confirmed "bisa"
     */
    private function isDosenConfirmedForJadwalAntara($dosenId, $kode, $kelompok, $pertemuan)
    {
        try {
            // Decode URL-encoded kelompok name
            $kelompokDecoded = urldecode($kelompok);

            // Ambil id kelompok kecil antara dari nama (jika perlu)
            $kelompokId = $kelompokDecoded;
            if (!is_numeric($kelompokDecoded)) {
                $kelompokObj = \App\Models\KelompokKecilAntara::where('nama_kelompok', $kelompokDecoded)->first();
                $kelompokId = $kelompokObj ? $kelompokObj->id : null;
            }

            // Cari jadwal PBL yang sesuai untuk semester antara - prioritaskan yang memiliki dosen yang sesuai
            $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                ->where('kelompok_kecil_antara_id', $kelompokId)
                ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                ->where(function ($query) use ($dosenId) {
                    $query->where('dosen_id', $dosenId)
                        ->orWhereJsonContains('dosen_ids', $dosenId);
                })
                ->first();

            // Jika tidak ditemukan, coba dengan nama_kelompok melalui relasi
            if (!$jadwal) {
                $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                    ->whereHas('kelompokKecilAntara', function ($query) use ($kelompok) {
                        $query->where('nama_kelompok', $kelompok);
                    })
                    ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                    ->where(function ($query) use ($dosenId) {
                        $query->where('dosen_id', $dosenId)
                            ->orWhereJsonContains('dosen_ids', $dosenId);
                    })
                    ->first();
            }

            // Jika masih tidak ditemukan, ambil jadwal pertama yang cocok (fallback)
            if (!$jadwal) {
                $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                    ->where('kelompok_kecil_antara_id', $kelompokId)
                    ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                    ->first();

                if (!$jadwal) {
                    $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                        ->whereHas('kelompokKecilAntara', function ($query) use ($kelompok) {
                            $query->where('nama_kelompok', $kelompok);
                        })
                        ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                        ->first();
                }
            }

            if (!$jadwal) {
                return false;
            }

            // STRICT CHECK: Dosen must be assigned to this jadwal
            $isAssigned = false;
            if ($jadwal->dosen_id == $dosenId) {
                $isAssigned = true;
            } elseif ($jadwal->dosen_ids && in_array($dosenId, $jadwal->dosen_ids)) {
                $isAssigned = true;
            }

            if (!$isAssigned) {
                return false;
            }

            // STRICT CHECK: Dosen must have confirmed "bisa"
            if ($jadwal->status_konfirmasi === 'bisa') {
                return true;
            }

            // Check riwayat konfirmasi as additional verification
            $riwayat = \App\Models\RiwayatKonfirmasiDosen::where('dosen_id', $dosenId)
                ->where('jadwal_id', $jadwal->id)
                ->where('status_konfirmasi', 'bisa')
                ->first();

            if ($riwayat) {
                return true;
            }

            return false;
        } catch (\Exception $e) {
            return false;
        }
    }

    // Validasi akses dosen untuk jadwal semester antara
    private function validateDosenAccessAntara($kode, $kelompok, $pertemuan)
    {
        // Decode URL-encoded parameters
        $kelompokDecoded = urldecode($kelompok);
        $pertemuanDecoded = urldecode($pertemuan);

        // Ambil id kelompok kecil antara dari nama (jika perlu)
        $kelompokId = $kelompokDecoded;
        if (!is_numeric($kelompokDecoded)) {
            $kelompokObj = \App\Models\KelompokKecilAntara::where('nama_kelompok', $kelompokDecoded)->first();
            $kelompokId = $kelompokObj ? $kelompokObj->id : null;
        }

        // Ambil jadwal PBL yang sesuai untuk semester antara
        $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok_kecil_antara_id', $kelompokId)
            ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuanDecoded)])
            ->first();

        // Validasi: Cek apakah jadwal ada
        if (!$jadwal) {
            abort(404, 'Jadwal tidak ditemukan');
        }

        // Validasi: Cek apakah user yang akses adalah dosen yang terdaftar atau admin
        $user = auth()->user();
        if ($user->role === 'dosen') {
            // Cek apakah dosen ini ada di daftar dosen_ids
            $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);

            // Jika dosen_ids kosong atau null, cek konfirmasi dosen
            if (!is_array($dosenIds) || empty($dosenIds)) {
                \Illuminate\Support\Facades\Log::warning("Jadwal PBL Antara {$kode} - {$kelompok} - {$pertemuan} tidak memiliki dosen_ids, checking confirmation");

                // Check if dosen has confirmed availability for this jadwal
                if ($this->isDosenConfirmedForJadwalAntara($user->id, $kode, $kelompok, $pertemuan)) {
                    \Illuminate\Support\Facades\Log::info("Dosen {$user->id} is confirmed for jadwal antara, allowing access");
                    // Don't abort - allow access for confirmed dosen
                } else {
                    \Illuminate\Support\Facades\Log::error("Dosen {$user->id} is not confirmed for jadwal antara, denying access");
                    abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini');
                }
            } else {
                // Convert dosen_ids to integers for comparison
                $dosenIdsInt = array_map('intval', $dosenIds);

                if (!in_array((int)$user->id, $dosenIdsInt)) {
                    // Dosen tidak ada di dosen_ids, cek konfirmasi
                    if ($this->isDosenConfirmedForJadwalAntara($user->id, $kode, $kelompok, $pertemuan)) {
                        \Illuminate\Support\Facades\Log::info("Dosen {$user->id} is confirmed for jadwal antara, allowing access");
                        // Don't abort - allow access for confirmed dosen
                    } else {
                        abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini');
                    }
                } else {
                    // Dosen ada di dosen_ids, tapi tetap harus cek konfirmasi
                    if ($jadwal->status_konfirmasi === 'bisa') {
                        \Illuminate\Support\Facades\Log::info("Dosen {$user->id} is in dosen_ids and jadwal is confirmed, allowing access");
                        // Don't abort - allow access
                    } else {
                        // Check riwayat konfirmasi as additional verification
                        $riwayat = \App\Models\RiwayatKonfirmasiDosen::where('dosen_id', $user->id)
                            ->where('jadwal_id', $jadwal->id)
                            ->where('status_konfirmasi', 'bisa')
                            ->first();

                        if ($riwayat) {
                            \Illuminate\Support\Facades\Log::info("Dosen {$user->id} has confirmed 'bisa' in riwayat for jadwal antara {$jadwal->id}");
                            // Don't abort - allow access
                        } else {
                            \Illuminate\Support\Facades\Log::error("Dosen {$user->id} is in dosen_ids but NOT confirmed for jadwal antara {$jadwal->id}");
                            abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini. Hanya dosen yang ditugaskan dan telah mengkonfirmasi ketersediaan yang dapat mengakses halaman ini.');
                        }
                    }
                }
            }
        } elseif (!in_array($user->role, ['super_admin', 'tim_akademik'])) {
            // Hanya super_admin dan tim_akademik yang bisa akses selain dosen
            abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini');
        }
    }
}
