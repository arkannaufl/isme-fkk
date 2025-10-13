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
            return response()->json(['error' => 'Jadwal tidak ditemukan'], 404);
        }

        $data = PenilaianPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok', $kelompok)
            ->where('pertemuan', $pertemuan)
            ->get();

        $modul_pbl_id = $jadwal->modul_pbl_id ?? null;
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
        ]);
    }

    // Simpan/update penilaian (bulk per kelompok & pertemuan)
    public function store(Request $request, $kode, $kelompok, $pertemuan)
    {
        // Validasi akses dosen
        $this->validateDosenAccess($kode, $kelompok, $pertemuan);

        // Tentukan apakah ini PBL 1 atau PBL 2
        $isPBL2 = $this->isPBL2($pertemuan);

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
                'kelompok' => $kelompok,
                'pertemuan' => $pertemuan,
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

            // Untuk PBL 2, simpan peta_konsep
            if ($isPBL2) {
                $dataToSave['peta_konsep'] = $row['peta_konsep'];
            } else {
                // Untuk PBL 1, set peta_konsep ke null
                $dataToSave['peta_konsep'] = null;
            }

            \Illuminate\Support\Facades\Log::info('Data to save:', $dataToSave);

            PenilaianPBL::updateOrCreate(
                [
                    'mata_kuliah_kode' => $kode,
                    'kelompok' => $kelompok,
                    'pertemuan' => $pertemuan,
                    'mahasiswa_npm' => $row['mahasiswa_npm'],
                ],
                $dataToSave
            );
        }

        // Update jadwal PBL status penilaian_submitted
        $this->updateJadwalPenilaianStatus($kode, $kelompok, $pertemuan);

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

        // Validasi: Cek apakah jadwal ada
        if (!$jadwal) {
            return response()->json(['error' => 'Jadwal tidak ditemukan'], 404);
        }

        // Validasi akses sudah dilakukan di validateDosenAccessAntara di atas

        $data = PenilaianPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok', $kelompok)
            ->where('pertemuan', $pertemuan)
            ->get();

        $modul_pbl_id = $jadwal->modul_pbl_id ?? null;
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
        ]);
    }

    // Method untuk semester Antara - Simpan/update penilaian
    public function storeAntara(Request $request, $kode, $kelompok, $pertemuan)
    {
        // Validasi akses dosen untuk semester antara
        $this->validateDosenAccessAntara($kode, $kelompok, $pertemuan);

        // Tentukan apakah ini PBL 1 atau PBL 2
        $isPBL2 = $this->isPBL2($pertemuan);

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
                'kelompok' => $kelompok,
                'pertemuan' => $pertemuan,
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

            // Untuk PBL 2, simpan peta_konsep
            if ($isPBL2) {
                $dataToSave['peta_konsep'] = $row['peta_konsep'];
            } else {
                // Untuk PBL 1, set peta_konsep ke null
                $dataToSave['peta_konsep'] = null;
            }

            \Illuminate\Support\Facades\Log::info('Data to save (Antara):', $dataToSave);

            PenilaianPBL::updateOrCreate(
                [
                    'mata_kuliah_kode' => $kode,
                    'kelompok' => $kelompok,
                    'pertemuan' => $pertemuan,
                    'mahasiswa_npm' => $row['mahasiswa_npm'],
                ],
                $dataToSave
            );
        }

        // Update jadwal PBL status penilaian_submitted untuk semester antara
        $this->updateJadwalPenilaianStatusAntara($kode, $kelompok, $pertemuan);

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
            // Validasi akses dosen (termasuk super_admin dan tim_akademik)
            $this->validateDosenAccess($kode, $kelompok, $pertemuan);

            // Ambil data absensi yang sudah ada
            $absensi = AbsensiPBL::where('mata_kuliah_kode', $kode)
                ->where('kelompok', $kelompok)
                ->where('pertemuan', $pertemuan)
                ->get()
                ->keyBy('mahasiswa_npm');

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
            // Validasi akses dosen (termasuk super_admin dan tim_akademik)
            $this->validateDosenAccess($kode, $kelompok, $pertemuan);

            $request->validate([
                'absensi' => 'required|array',
                'absensi.*.mahasiswa_npm' => 'required|string',
                'absensi.*.hadir' => 'required|boolean',
                'absensi.*.catatan' => 'nullable|string',
            ]);

            // Hapus data absensi yang lama
            AbsensiPBL::where('mata_kuliah_kode', $kode)
                ->where('kelompok', $kelompok)
                ->where('pertemuan', $pertemuan)
                ->delete();

            // Simpan data absensi baru
            foreach ($request->absensi as $absen) {
                AbsensiPBL::create([
                    'mata_kuliah_kode' => $kode,
                    'kelompok' => $kelompok,
                    'pertemuan' => $pertemuan,
                    'mahasiswa_npm' => $absen['mahasiswa_npm'],
                    'hadir' => $absen['hadir'],
                    'catatan' => $absen['catatan'] ?? '',
                ]);
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
            \Illuminate\Support\Facades\Log::error('Error updating jadwal penilaian status: ' . $e->getMessage());
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
            \Illuminate\Support\Facades\Log::error('Error updating jadwal penilaian status (Antara): ' . $e->getMessage());
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
        \Illuminate\Support\Facades\Log::info("Validating access for user {$user->id} with role {$user->role}");
        \Illuminate\Support\Facades\Log::info("Jadwal dosen_ids: " . json_encode($jadwal->dosen_ids));

        if ($user->role === 'dosen') {
            // Cek apakah dosen ini ada di daftar dosen_ids
            $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
            \Illuminate\Support\Facades\Log::info("Parsed dosen_ids: " . json_encode($dosenIds));

            // Jika dosen_ids kosong atau null, cek konfirmasi dosen
            if (!is_array($dosenIds) || empty($dosenIds)) {
                \Illuminate\Support\Facades\Log::warning("Jadwal PBL {$kode} - {$kelompok} - {$pertemuan} tidak memiliki dosen_ids, checking confirmation");

                // Check if dosen has confirmed availability for this jadwal
                if ($this->isDosenConfirmedForJadwal($user->id, $kode, $kelompok, $pertemuan)) {
                    \Illuminate\Support\Facades\Log::info("Dosen {$user->id} is confirmed for jadwal, allowing access");
                    // Don't abort - allow access for confirmed dosen
                } else {
                    \Illuminate\Support\Facades\Log::error("Dosen {$user->id} is not confirmed for jadwal, denying access");
                    abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini');
                }
            } else {
                \Illuminate\Support\Facades\Log::info("Checking if user {$user->id} is in dosen_ids: " . json_encode($dosenIds));

                // Convert dosen_ids to integers for comparison
                $dosenIdsInt = array_map('intval', $dosenIds);
                \Illuminate\Support\Facades\Log::info("Converted dosen_ids to int: " . json_encode($dosenIdsInt));

                if (!in_array((int)$user->id, $dosenIdsInt)) {
                    \Illuminate\Support\Facades\Log::error("User {$user->id} not found in dosen_ids: " . json_encode($dosenIdsInt));

                    // Check if dosen has confirmed availability for this jadwal
                    if ($this->isDosenConfirmedForJadwal($user->id, $kode, $kelompok, $pertemuan)) {
                        \Illuminate\Support\Facades\Log::info("Dosen {$user->id} is confirmed for jadwal, allowing access");
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
                \Illuminate\Support\Facades\Log::info("Jadwal not found for {$kode}/{$kelompok}/{$pertemuan}");
                return false;
            }

            // STRICT CHECK: Dosen must be assigned to this jadwal
            $isAssigned = false;
            if ($jadwal->dosen_id == $dosenId) {
                $isAssigned = true;
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is assigned as single dosen for jadwal {$jadwal->id}");
            } elseif ($jadwal->dosen_ids && in_array($dosenId, $jadwal->dosen_ids)) {
                $isAssigned = true;
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is assigned in dosen_ids for jadwal {$jadwal->id}");
            }

            if (!$isAssigned) {
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is NOT assigned to jadwal {$jadwal->id}");
                return false;
            }

            // STRICT CHECK: Dosen must have confirmed "bisa"
            if ($jadwal->status_konfirmasi === 'bisa') {
                \Illuminate\Support\Facades\Log::info("Jadwal {$jadwal->id} has status_konfirmasi = bisa");
                return true;
            }

            // Check riwayat konfirmasi as additional verification
            $riwayat = \App\Models\RiwayatKonfirmasiDosen::where('dosen_id', $dosenId)
                ->where('jadwal_id', $jadwal->id)
                ->where('status_konfirmasi', 'bisa')
                ->first();

            if ($riwayat) {
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} has confirmed 'bisa' in riwayat for jadwal {$jadwal->id}");
                return true;
            }

            \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is assigned but NOT confirmed for jadwal {$jadwal->id}");
            return false;
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Error checking dosen confirmation: " . $e->getMessage());
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
                \Illuminate\Support\Facades\Log::info("Jadwal antara not found for {$kode}/{$kelompok}/{$pertemuan}");
                return false;
            }

            // STRICT CHECK: Dosen must be assigned to this jadwal
            $isAssigned = false;
            if ($jadwal->dosen_id == $dosenId) {
                $isAssigned = true;
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is assigned as single dosen for jadwal antara {$jadwal->id}");
            } elseif ($jadwal->dosen_ids && in_array($dosenId, $jadwal->dosen_ids)) {
                $isAssigned = true;
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is assigned in dosen_ids for jadwal antara {$jadwal->id}");
            }

            if (!$isAssigned) {
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is NOT assigned to jadwal antara {$jadwal->id}");
                return false;
            }

            // STRICT CHECK: Dosen must have confirmed "bisa"
            if ($jadwal->status_konfirmasi === 'bisa') {
                \Illuminate\Support\Facades\Log::info("Jadwal antara {$jadwal->id} has status_konfirmasi = bisa");
                return true;
            }

            // Check riwayat konfirmasi as additional verification
            $riwayat = \App\Models\RiwayatKonfirmasiDosen::where('dosen_id', $dosenId)
                ->where('jadwal_id', $jadwal->id)
                ->where('status_konfirmasi', 'bisa')
                ->first();

            if ($riwayat) {
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} has confirmed 'bisa' in riwayat for jadwal antara {$jadwal->id}");
                return true;
            }

            \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is assigned but NOT confirmed for jadwal antara {$jadwal->id}");
            return false;
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Error checking dosen confirmation untuk jadwal antara: " . $e->getMessage());
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
