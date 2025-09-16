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
        $data = PenilaianPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok', $kelompok)
            ->where('pertemuan', $pertemuan)
            ->get();

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
        ]);
    }

    // Simpan/update penilaian (bulk per kelompok & pertemuan)
    public function store(Request $request, $kode, $kelompok, $pertemuan)
    {
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
            'penilaian.*.peta_konsep' => 'nullable|integer',
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
        $data = PenilaianPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok', $kelompok)
            ->where('pertemuan', $pertemuan)
            ->get();

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
        ]);
    }

    // Method untuk semester Antara - Simpan/update penilaian
    public function storeAntara(Request $request, $kode, $kelompok, $pertemuan)
    {
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
            'penilaian.*.peta_konsep' => 'nullable|integer',
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
}
