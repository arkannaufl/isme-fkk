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
        // Ambil id kelompok kecil dari nama (jika perlu)
        $kelompokId = $kelompok;
        if (!is_numeric($kelompok)) {
            $kelompokObj = \App\Models\KelompokKecil::where('nama_kelompok', $kelompok)->first();
            $kelompokId = $kelompokObj ? $kelompokObj->id : null;
        }

        // Ambil jadwal PBL yang sesuai
        $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok_kecil_id', $kelompokId)
            ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
            ->first();

        // Validasi: Cek apakah jadwal ada
        if (!$jadwal) {
            return response()->json(['error' => 'Jadwal tidak ditemukan'], 404);
        }

        // Validasi: Cek apakah user yang akses adalah dosen yang "bisa ngajar"
        $user = auth()->user();
        if ($user->role === 'dosen') {
            // Cek apakah dosen ini ada di daftar dosen_ids dan status_konfirmasi = 'bisa'
            $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
            if (!in_array($user->id, $dosenIds) || $jadwal->status_konfirmasi !== 'bisa') {
                return response()->json(['error' => 'Anda tidak memiliki akses untuk menilai jadwal ini'], 403);
            }
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
        // Ambil id kelompok kecil antara dari nama
        $kelompokId = $kelompok;
        if (!is_numeric($kelompok)) {
            $kelompokObj = \App\Models\KelompokKecilAntara::where('nama_kelompok', $kelompok)->first();
            $kelompokId = $kelompokObj ? $kelompokObj->id : null;
        }

        // Ambil jadwal PBL yang sesuai untuk semester Antara
        $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok_kecil_antara_id', $kelompokId)
            ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
            ->first();

        // Validasi: Cek apakah jadwal ada
        if (!$jadwal) {
            return response()->json(['error' => 'Jadwal tidak ditemukan'], 404);
        }

        // Validasi: Cek apakah user yang akses adalah dosen yang "bisa ngajar"
        $user = auth()->user();
        if ($user->role === 'dosen') {
            // Cek apakah dosen ini ada di daftar dosen_ids dan status_konfirmasi = 'bisa'
            $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
            if (!in_array($user->id, $dosenIds) || $jadwal->status_konfirmasi !== 'bisa') {
                return response()->json(['error' => 'Anda tidak memiliki akses untuk menilai jadwal ini'], 403);
            }
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

        $message = $isPBL2 ? 'Penilaian PBL 2 (Antara) berhasil disimpan' : 'Penilaian PBL 1 (Antara) berhasil disimpan';
        return response()->json(['message' => $message]);
    }

    // Method untuk absensi PBL
    public function getAbsensi($kode, $kelompok, $pertemuan)
    {
        try {
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
            $request->validate([
                'absensi' => 'required|array',
                'absensi.*.mahasiswa_npm' => 'required|string',
                'absensi.*.hadir' => 'required|boolean',
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
                ]);
            }

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
            // Ambil id kelompok kecil dari nama (jika perlu)
            $kelompokId = $kelompok;
            if (!is_numeric($kelompok)) {
                $kelompokObj = \App\Models\KelompokKecil::where('nama_kelompok', $kelompok)->first();
                $kelompokId = $kelompokObj ? $kelompokObj->id : null;
            }

            // Update jadwal PBL
            $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                ->where('kelompok_kecil_id', $kelompokId)
                ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                ->first();

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
            // Ambil id kelompok kecil antara dari nama (jika perlu)
            $kelompokId = $kelompok;
            if (!is_numeric($kelompok)) {
                $kelompokObj = \App\Models\KelompokKecilAntara::where('nama_kelompok', $kelompok)->first();
                $kelompokId = $kelompokObj ? $kelompokObj->id : null;
            }

            // Update jadwal PBL
            $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
                ->where('kelompok_kecil_antara_id', $kelompokId)
                ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
                ->first();

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

        // Ambil jadwal PBL yang sesuai
        $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok_kecil_id', $kelompokId)
            ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
            ->first();

        // Validasi: Cek apakah jadwal ada
        if (!$jadwal) {
            abort(404, 'Jadwal tidak ditemukan');
        }

        // Validasi: Cek apakah user yang akses adalah dosen yang "bisa ngajar"
        $user = auth()->user();
        if ($user->role === 'dosen') {
            // Cek apakah dosen ini ada di daftar dosen_ids dan status_konfirmasi = 'bisa'
            $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
            if (!in_array($user->id, $dosenIds) || $jadwal->status_konfirmasi !== 'bisa') {
                abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini');
            }
        }
    }

    // Validasi akses dosen untuk jadwal semester antara
    private function validateDosenAccessAntara($kode, $kelompok, $pertemuan)
    {
        // Ambil id kelompok kecil antara dari nama (jika perlu)
        $kelompokId = $kelompok;
        if (!is_numeric($kelompok)) {
            $kelompokObj = \App\Models\KelompokKecilAntara::where('nama_kelompok', $kelompok)->first();
            $kelompokId = $kelompokObj ? $kelompokObj->id : null;
        }

        // Ambil jadwal PBL yang sesuai untuk semester antara
        $jadwal = \App\Models\JadwalPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok_kecil_antara_id', $kelompokId)
            ->whereRaw('LOWER(pbl_tipe) = ?', [strtolower($pertemuan)])
            ->first();

        // Validasi: Cek apakah jadwal ada
        if (!$jadwal) {
            abort(404, 'Jadwal tidak ditemukan');
        }

        // Validasi: Cek apakah user yang akses adalah dosen yang "bisa ngajar"
        $user = auth()->user();
        if ($user->role === 'dosen') {
            // Cek apakah dosen ini ada di daftar dosen_ids dan status_konfirmasi = 'bisa'
            $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
            if (!in_array($user->id, $dosenIds) || $jadwal->status_konfirmasi !== 'bisa') {
                abort(403, 'Anda tidak memiliki akses untuk menilai jadwal ini');
            }
        }
    }
}
