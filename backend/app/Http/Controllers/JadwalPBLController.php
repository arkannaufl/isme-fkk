<?php

namespace App\Http\Controllers;

use App\Models\JadwalPBL;
use App\Models\MataKuliah;
use App\Models\User;
use App\Models\Notification;
use App\Services\JadwalValidationService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;

class JadwalPBLController extends Controller
{
    private JadwalValidationService $validationService;

    public function __construct(JadwalValidationService $validationService)
    {
        $this->validationService = $validationService;
    }

    // List semua jadwal PBL untuk satu mata kuliah blok
    public function index($kode)
    {
        $jadwal = JadwalPBL::WithoutSemesterFilter()
            ->with(['modulPBL', 'kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan'])
            ->where('mata_kuliah_kode', $kode)
            ->orderBy('tanggal')
            ->orderBy('jam_mulai')
            ->get();

        // Tambahkan modul_pbl_id dan nama_kelompok untuk kompatibilitas dengan frontend
        $jadwal->transform(function ($item) {
            $item->modul_pbl_id = $item->pbl_id;

            // Tambahkan nama kelompok untuk kompatibilitas dengan frontend
            if ($item->kelompok_kecil_antara) {
                $item->nama_kelompok = $item->kelompok_kecil_antara->nama_kelompok;
            } elseif ($item->kelompok_kecil) {
                $item->nama_kelompok = $item->kelompok_kecil->nama_kelompok;
            }

            return $item;
        });

        return response()->json($jadwal);
    }

    // Tambah jadwal PBL baru
    public function store(Request $request, $kode)
    {
        // Debug logging untuk data yang diterima
        Log::info("Jadwal PBL store request data:", $request->all());

        $data = $request->validate([
            'modul_pbl_id' => 'required|exists:pbls,id',
            'kelompok_kecil_id' => 'nullable|exists:kelompok_kecil,id',
            'kelompok_kecil_antara_id' => 'nullable|exists:kelompok_kecil_antara,id',
            'dosen_id' => 'nullable|exists:users,id',
            'dosen_ids' => 'nullable|array',
            'dosen_ids.*' => 'exists:users,id',
            'ruangan_id' => 'required|exists:ruangan,id',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'nullable|integer|min:1|max:6',
            'pbl_tipe' => 'nullable|string',
            // SIAKAD fields
            'siakad_kurikulum' => 'nullable|string',
            'siakad_kode_mk' => 'nullable|string',
            'siakad_nama_kelas' => 'nullable|string',
            'topik' => 'nullable|string',
            'siakad_substansi' => 'nullable|string',
            'siakad_jenis_pertemuan' => 'nullable|string',
            'siakad_metode' => 'nullable|string',
            'siakad_dosen_pengganti' => 'nullable|string',
        ]);

        // Validasi: harus ada salah satu dari kelompok_kecil_id atau kelompok_kecil_antara_id
        if ((!isset($data['kelompok_kecil_id']) || !$data['kelompok_kecil_id']) &&
            (!isset($data['kelompok_kecil_antara_id']) || !$data['kelompok_kecil_antara_id'])
        ) {
            return response()->json([
                'message' => 'Kelompok kecil harus dipilih.',
                'errors' => [
                    'kelompok_kecil_id' => ['Kelompok kecil harus dipilih.']
                ]
            ], 422);
        }

        $mataKuliah = MataKuliah::where('kode', $kode)->first();
        if (!$mataKuliah) {
            return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
        }
        $isSemesterAntara = $mataKuliah->semester === 'Antara';

        $data['mata_kuliah_kode'] = $kode;
        $data['pbl_id'] = $data['modul_pbl_id']; // Map modul_pbl_id ke pbl_id

        // Set jumlah_sesi berdasarkan pbl_tipe jika tidak disediakan
        if (!isset($data['jumlah_sesi'])) {
            $data['jumlah_sesi'] = $data['pbl_tipe'] === 'PBL 2' ? 3 : 2;
        }

        // Pastikan kelompok_kecil_id ada untuk semester reguler, atau null untuk semester antara
        if (!isset($data['kelompok_kecil_id'])) {
            $data['kelompok_kecil_id'] = null;
        }

        // Pastikan dosen_id diset ke null jika menggunakan dosen_ids
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
            $data['dosen_id'] = null;
        }

        $tanggalMessage = $this->validationService->validateTanggalMataKuliah($data, $mataKuliah);
        if ($tanggalMessage) {
            return response()->json(['message' => $tanggalMessage], 422);
        }

        $kapasitasMessage = $this->validationService->validateRoomCapacity($data, 'pbl', $isSemesterAntara);
        if ($kapasitasMessage) {
            return response()->json(['message' => $kapasitasMessage], 422);
        }

        $bentrokMessage = $this->validationService->validateConflict($data, 'pbl', null, $isSemesterAntara);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        $jadwal = JadwalPBL::create(array_merge($data, [
            'status_konfirmasi' => 'belum_konfirmasi'
        ]));

        // Log activity
        activity()
            ->performedOn($jadwal)
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'pbl_id' => $data['modul_pbl_id'],
                'tanggal' => $data['tanggal'],
                'jam_mulai' => $data['jam_mulai'],
                'jam_selesai' => $data['jam_selesai'],
                'pbl_tipe' => $data['pbl_tipe']
            ])
            ->log("Jadwal PBL created: {$jadwal->modulPBL->nama}");

        // Debug logging
        Log::info("Jadwal PBL created with pbl_tipe: {$jadwal->pbl_tipe}, modul: {$jadwal->modulPBL->nama_modul}");

        // Load relasi dan tambahkan modul_pbl_id
        $jadwal->load(['modulPBL', 'kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan']);
        $jadwal->modul_pbl_id = $jadwal->pbl_id;

        // Tambahkan nama dosen untuk response
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
            $jadwal->dosen_names = implode(', ', $dosenNames);
        }

        // Buat notifikasi untuk dosen yang di-assign
        $modulName = $jadwal->modulPBL->nama_modul;
        if ($jadwal->pbl_tipe && $jadwal->pbl_tipe !== 'PBL 1') {
            // Cek apakah nama_modul sudah memiliki prefix yang benar
            if (!str_starts_with($modulName, $jadwal->pbl_tipe . ':')) {
                // Jika belum memiliki prefix yang benar, tambahkan
                $cleanModulName = str_replace(['PBL 1: ', 'PBL 2: '], '', $modulName);
                $modulName = $jadwal->pbl_tipe . ': ' . $cleanModulName;
            }
        }

        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            foreach ($jadwal->dosen_ids as $dosenId) {
                $dosen = User::find($dosenId);
                if ($dosen) {
                    \App\Models\Notification::create([
                        'user_id' => $dosenId,
                        'title' => 'Jadwal PBL Baru',
                        'message' => "Anda telah di-assign untuk mengajar PBL {$jadwal->modulPBL->mataKuliah->nama} - {$modulName} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}. Silakan konfirmasi ketersediaan Anda.",
                        'type' => 'info',
                        'data' => [
                            'topik' => $modulName,
                            'materi' => $modulName,
                            'ruangan' => $jadwal->ruangan->nama,
                            'tanggal' => $jadwal->tanggal,
                            'jadwal_id' => $jadwal->id,
                            'jam_mulai' => $jadwal->jam_mulai,
                            'jadwal_type' => 'pbl',
                            'jam_selesai' => $jadwal->jam_selesai,
                            'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                            'mata_kuliah_nama' => $jadwal->modulPBL->mataKuliah->nama,
                            'modul_ke' => $jadwal->modulPBL->modul_ke,
                            'pbl_tipe' => $jadwal->pbl_tipe,
                            'dosen_id' => $dosen->id,
                            'dosen_name' => $dosen->name,
                            'dosen_role' => $dosen->role,
                            'created_by' => Auth::user()?->name ?? 'Admin',
                            'created_by_role' => Auth::user()?->role ?? 'admin',
                            'sender_name' => Auth::user()?->name ?? 'Admin',
                            'sender_role' => Auth::user()?->role ?? 'admin'
                        ]
                    ]);
                }
            }
        } elseif ($jadwal->dosen_id) {
            $dosen = User::find($jadwal->dosen_id);
            if ($dosen) {
                \App\Models\Notification::create([
                    'user_id' => $jadwal->dosen_id,
                    'title' => 'Jadwal PBL Baru',
                    'message' => "Anda telah di-assign untuk mengajar PBL {$jadwal->modulPBL->mataKuliah->nama} - {$modulName} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}. Silakan konfirmasi ketersediaan Anda.",
                    'type' => 'info',
                    'data' => [
                        'topik' => $modulName,
                        'materi' => $modulName,
                        'ruangan' => $jadwal->ruangan->nama,
                        'tanggal' => $jadwal->tanggal,
                        'jadwal_id' => $jadwal->id,
                        'jam_mulai' => $jadwal->jam_mulai,
                        'jadwal_type' => 'pbl',
                        'jam_selesai' => $jadwal->jam_selesai,
                        'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                        'mata_kuliah_nama' => $jadwal->modulPBL->mataKuliah->nama,
                        'modul_ke' => $jadwal->modulPBL->modul_ke,
                        'pbl_tipe' => $jadwal->pbl_tipe,
                        'dosen_id' => $dosen->id,
                        'dosen_name' => $dosen->name,
                        'dosen_role' => $dosen->role,
                        'created_by' => Auth::user()?->name ?? 'Admin',
                        'created_by_role' => Auth::user()?->role ?? 'admin',
                        'sender_name' => Auth::user()?->name ?? 'Admin',
                        'sender_role' => Auth::user()?->role ?? 'admin'
                    ]
                ]);
            }
        }

        // Send notification to mahasiswa in the kelompok
        $this->sendNotificationToMahasiswa($jadwal);

        return response()->json($jadwal, Response::HTTP_CREATED);
    }

    // Update jadwal PBL
    public function update(Request $request, $kode, $id)
    {
        $jadwal = JadwalPBL::findOrFail($id);
        $data = $request->validate([
            'modul_pbl_id' => 'required|exists:pbls,id',
            'kelompok_kecil_id' => 'nullable|exists:kelompok_kecil,id',
            'kelompok_kecil_antara_id' => 'nullable|exists:kelompok_kecil_antara,id',
            'dosen_id' => 'nullable|exists:users,id',
            'dosen_ids' => 'nullable|array',
            'dosen_ids.*' => 'exists:users,id',
            'ruangan_id' => 'required|exists:ruangan,id',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'nullable|integer|min:1|max:6',
            'pbl_tipe' => 'nullable|string',
            // SIAKAD fields
            'siakad_kurikulum' => 'nullable|string',
            'siakad_kode_mk' => 'nullable|string',
            'siakad_nama_kelas' => 'nullable|string',
            'topik' => 'nullable|string',
            'siakad_substansi' => 'nullable|string',
            'siakad_jenis_pertemuan' => 'nullable|string',
            'siakad_metode' => 'nullable|string',
            'siakad_dosen_pengganti' => 'nullable|string',
        ]);

        // Validasi: harus ada salah satu dari kelompok_kecil_id atau kelompok_kecil_antara_id
        if ((!isset($data['kelompok_kecil_id']) || !$data['kelompok_kecil_id']) &&
            (!isset($data['kelompok_kecil_antara_id']) || !$data['kelompok_kecil_antara_id'])
        ) {
            return response()->json([
                'message' => 'Kelompok kecil harus dipilih.',
                'errors' => [
                    'kelompok_kecil_id' => ['Kelompok kecil harus dipilih.']
                ]
            ], 422);
        }

        $mataKuliah = MataKuliah::where('kode', $kode)->first();
        if (!$mataKuliah) {
            return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
        }
        $isSemesterAntara = $mataKuliah->semester === 'Antara';

        $data['mata_kuliah_kode'] = $kode;
        $data['pbl_id'] = $data['modul_pbl_id']; // Map modul_pbl_id ke pbl_id

        // Set jumlah_sesi berdasarkan pbl_tipe jika tidak disediakan
        if (!isset($data['jumlah_sesi'])) {
            $data['jumlah_sesi'] = $data['pbl_tipe'] === 'PBL 2' ? 3 : 2;
        }

        // Pastikan kelompok_kecil_id ada untuk semester reguler, atau null untuk semester antara
        // JANGAN override jika sudah ada nilai (untuk semester reguler)
        // Hanya set null jika benar-benar tidak ada dan tidak ada kelompok_kecil_antara_id
        if (!isset($data['kelompok_kecil_id']) && !isset($data['kelompok_kecil_antara_id'])) {
            $data['kelompok_kecil_id'] = null;
        }

        // Log untuk debugging
        Log::info('Jadwal PBL Update - Request data:', [
            'kelompok_kecil_id' => $data['kelompok_kecil_id'] ?? 'not set',
            'kelompok_kecil_antara_id' => $data['kelompok_kecil_antara_id'] ?? 'not set',
        ]);

        // Pastikan dosen_id diset ke null jika menggunakan dosen_ids
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
            $data['dosen_id'] = null;
        }

        $tanggalMessage = $this->validationService->validateTanggalMataKuliah($data, $mataKuliah);
        if ($tanggalMessage) {
            return response()->json(['message' => $tanggalMessage], 422);
        }

        $kapasitasMessage = $this->validationService->validateRoomCapacity($data, 'pbl', $isSemesterAntara);
        if ($kapasitasMessage) {
            return response()->json(['message' => $kapasitasMessage], 422);
        }

        $bentrokMessage = $this->validationService->validateConflict($data, 'pbl', $id, $isSemesterAntara);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        // Simpan PBL type lama untuk perbandingan
        $oldPBLType = $jadwal->pbl_tipe;

        // Reset penilaian submitted status jika jadwal diubah
        // Ini memungkinkan dosen pengampu untuk mengisi ulang penilaian
        $jadwal->resetPenilaianSubmitted();

        $jadwal->update($data);

        // Log untuk debugging - pastikan data tersimpan dengan benar
        $jadwal->refresh();
        Log::info('Jadwal PBL Update - After save:', [
            'id' => $jadwal->id,
            'kelompok_kecil_id' => $jadwal->kelompok_kecil_id,
            'kelompok_kecil_antara_id' => $jadwal->kelompok_kecil_antara_id,
        ]);

        // Log activity
        activity()
            ->performedOn($jadwal)
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'pbl_id' => $data['modul_pbl_id'],
                'tanggal' => $data['tanggal'],
                'jam_mulai' => $data['jam_mulai'],
                'jam_selesai' => $data['jam_selesai'],
                'pbl_tipe' => $data['pbl_tipe']
            ])
            ->log("Jadwal PBL updated: {$jadwal->modulPBL->nama}");

        // Update penilaian data jika PBL type berubah
        if ($oldPBLType !== $data['pbl_tipe']) {
            $jadwal->updatePenilaianForPBLTypeChange($oldPBLType, $data['pbl_tipe']);
        }

        // Load relasi dan tambahkan modul_pbl_id
        $jadwal->load(['modulPBL', 'kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan']);
        $jadwal->modul_pbl_id = $jadwal->pbl_id;

        // Tambahkan nama dosen untuk response
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
            $jadwal->dosen_names = implode(', ', $dosenNames);
        }

        return response()->json($jadwal);
    }

    // Hapus jadwal PBL
    public function destroy($kode, $id)
    {
        $jadwal = JadwalPBL::findOrFail($id);

        // Cascade delete: hapus penilaian PBL yang terkait
        $kelompokKecil = \App\Models\KelompokKecil::find($jadwal->kelompok_kecil_id);
        $namaKelompok = $kelompokKecil ? $kelompokKecil->nama_kelompok : $jadwal->kelompok_kecil_id;

        // Log activity before deletion
        activity()
            ->performedOn($jadwal)
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'pbl_id' => $jadwal->pbl_id,
                'tanggal' => $jadwal->tanggal,
                'jam_mulai' => $jadwal->jam_mulai,
                'jam_selesai' => $jadwal->jam_selesai,
                'pbl_tipe' => $jadwal->pbl_tipe
            ])
            ->log("Jadwal PBL deleted: {$jadwal->modulPBL->nama}");

        // Hapus penilaian PBL berdasarkan mata_kuliah_kode, kelompok, dan pbl_tipe
        \App\Models\PenilaianPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok', $namaKelompok)
            ->where('pertemuan', $jadwal->pbl_tipe)
            ->delete();

        $jadwal->delete();
        return response()->json(['message' => 'Jadwal dan penilaian PBL terkait berhasil dihapus']);
    }

    // Import Excel jadwal PBL
    public function importExcel(Request $request, $kode)
    {
        try {
            $data = $request->validate([
                'data' => 'required|array',
                'data.*.tanggal' => 'required|date',
                'data.*.jam_mulai' => 'required|string',
                'data.*.jam_selesai' => 'required|string',
                'data.*.modul_pbl_id' => 'required|exists:pbls,id',
                'data.*.kelompok_kecil_id' => 'nullable|exists:kelompok_kecil,id',
                'data.*.kelompok_kecil_antara_id' => 'nullable|exists:kelompok_kecil_antara,id',
                'data.*.dosen_id' => 'nullable|exists:users,id',
                'data.*.dosen_ids' => 'nullable|array|min:1',
                'data.*.dosen_ids.*' => 'exists:users,id',
                'data.*.ruangan_id' => 'required|exists:ruangan,id',
                'data.*.pbl_tipe' => 'required|string|in:PBL 1,PBL 2',
                'data.*.topik' => 'nullable|string',
                'data.*.jumlah_sesi' => 'nullable|integer|min:1|max:6',
                // SIAKAD fields
                'data.*.siakad_kurikulum' => 'nullable|string',
                'data.*.siakad_kode_mk' => 'nullable|string',
                'data.*.siakad_nama_kelas' => 'nullable|string',
                'data.*.siakad_substansi' => 'nullable|string',
                'data.*.siakad_jenis_pertemuan' => 'nullable|string',
                'data.*.siakad_metode' => 'nullable|string',
                'data.*.siakad_dosen_pengganti' => 'nullable|string',
            ]);

            $importedData = [];
            $errors = [];

            $mataKuliah = MataKuliah::where('kode', $kode)->first();
            if (!$mataKuliah) {
                return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
            }
            $isSemesterAntara = $mataKuliah->semester === 'Antara';

            $excelDataForAntarBaris = [];
            foreach ($data['data'] as $row) {
                if (!isset($row['jumlah_sesi'])) {
                    $row['jumlah_sesi'] = $row['pbl_tipe'] === 'PBL 2' ? 3 : 2;
                }
                $row['mata_kuliah_kode'] = $kode;
                $row['pbl_id'] = $row['modul_pbl_id'];

                if (!isset($row['dosen_ids']) || empty($row['dosen_ids'])) {
                    if (isset($row['dosen_id']) && $row['dosen_id']) {
                        $row['dosen_ids'] = [$row['dosen_id']];
                    }
                }
                $excelDataForAntarBaris[] = $row;
            }

            $antarBarisErrors = $this->validationService->validateAntarBarisExcel($excelDataForAntarBaris, 'pbl', $isSemesterAntara);
            if (!empty($antarBarisErrors)) {
                return response()->json([
                    'success' => 0,
                    'total' => count($data['data']),
                    'errors' => $antarBarisErrors,
                    'message' => "Gagal mengimport data. Perbaiki error terlebih dahulu."
                ], 422);
            }

            // Validasi semua data terlebih dahulu (all or nothing approach)
            foreach ($data['data'] as $index => $row) {
                // Set jumlah_sesi berdasarkan pbl_tipe jika tidak disediakan
                if (!isset($row['jumlah_sesi'])) {
                    $row['jumlah_sesi'] = $row['pbl_tipe'] === 'PBL 2' ? 3 : 2;
                }

                // Set mata_kuliah_kode dan pbl_id
                $row['mata_kuliah_kode'] = $kode;
                $row['pbl_id'] = $row['modul_pbl_id'];

                // Validasi: harus ada salah satu dari kelompok_kecil_id atau kelompok_kecil_antara_id
                if ((!isset($row['kelompok_kecil_id']) || !$row['kelompok_kecil_id']) &&
                    (!isset($row['kelompok_kecil_antara_id']) || !$row['kelompok_kecil_antara_id'])
                ) {
                    $errors[] = "Baris " . ($index + 1) . ": Kelompok kecil harus dipilih.";
                    continue;
                }

                // Handle dosen_ids: gunakan dosen_ids jika ada, jika tidak gunakan dosen_id (backward compatibility)
                if (!isset($row['dosen_ids']) || empty($row['dosen_ids'])) {
                    if (isset($row['dosen_id']) && $row['dosen_id']) {
                        $row['dosen_ids'] = [$row['dosen_id']];
                    } else {
                        $errors[] = "Baris " . ($index + 1) . ": Dosen wajib diisi (minimal 1 dosen)";
                        continue;
                    }
                }

                if (isset($row['dosen_ids']) && is_array($row['dosen_ids']) && !empty($row['dosen_ids'])) {
                    $row['dosen_id'] = null;
                }

                $tanggalMessage = $this->validationService->validateTanggalMataKuliah($row, $mataKuliah);
                if ($tanggalMessage) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $tanggalMessage;
                }

                // Validasi kapasitas ruangan
                $kapasitasMessage = $this->validationService->validateRoomCapacity($row, 'pbl', $isSemesterAntara);
                if ($kapasitasMessage) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $kapasitasMessage;
                }

                // Validasi bentrok dengan data yang sudah ada di database
                $row['mata_kuliah_kode'] = $kode;
                $bentrokMessage = $this->validationService->validateConflict($row, 'pbl', null, $isSemesterAntara);
                if ($bentrokMessage) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $bentrokMessage;
                }
            }

            // Jika ada error validasi, return error tanpa import apapun
            if (count($errors) > 0) {
                return response()->json([
                    'success' => 0,
                    'total' => count($data['data']),
                    'errors' => $errors,
                    'message' => "Gagal mengimport data. Perbaiki error terlebih dahulu."
                ], 422);
            }

            // Jika tidak ada error, import semua data
            foreach ($data['data'] as $index => $row) {
                try {
                    // Set jumlah_sesi berdasarkan pbl_tipe jika tidak disediakan
                    if (!isset($row['jumlah_sesi'])) {
                        $row['jumlah_sesi'] = $row['pbl_tipe'] === 'PBL 2' ? 3 : 2;
                    }

                    // Set mata_kuliah_kode dan pbl_id
                    $row['mata_kuliah_kode'] = $kode;
                    $row['pbl_id'] = $row['modul_pbl_id'];

                    // Buat jadwal PBL
                    $jadwal = JadwalPBL::create($row);
                    $importedData[] = $jadwal;

                    // Kirim notifikasi ke dosen yang di-assign
                    if (isset($row['dosen_id']) && $row['dosen_id']) {
                        $dosen = \App\Models\User::find($row['dosen_id']);
                        if ($dosen) {
                            \App\Models\Notification::create([
                                'user_id' => $row['dosen_id'],
                                'title' => 'Jadwal PBL Baru',
                                'message' => "Anda telah di-assign untuk mengajar PBL {$jadwal->modulPBL->mataKuliah->nama} - {$jadwal->modulPBL->nama_modul} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}. Silakan konfirmasi ketersediaan Anda.",
                                'type' => 'info',
                                'data' => [
                                    'topik' => $jadwal->modulPBL->nama_modul,
                                    'materi' => $jadwal->modulPBL->nama_modul,
                                    'ruangan' => $jadwal->ruangan->nama,
                                    'tanggal' => $jadwal->tanggal,
                                    'jadwal_id' => $jadwal->id,
                                    'jam_mulai' => $jadwal->jam_mulai,
                                    'jadwal_type' => 'pbl',
                                    'jam_selesai' => $jadwal->jam_selesai,
                                    'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                                    'mata_kuliah_nama' => $jadwal->modulPBL->mataKuliah->nama,
                                    'modul_ke' => $jadwal->modulPBL->modul_ke,
                                    'pbl_tipe' => $jadwal->pbl_tipe,
                                    'dosen_id' => $dosen->id,
                                    'dosen_name' => $dosen->name,
                                    'dosen_role' => $dosen->role
                                ]
                            ]);
                        }
                    }

                    // Log activity
                    activity()
                        ->performedOn($jadwal)
                        ->withProperties([
                            'mata_kuliah_kode' => $kode,
                            'pbl_id' => $row['modul_pbl_id'],
                            'tanggal' => $row['tanggal'],
                            'jam_mulai' => $row['jam_mulai'],
                            'jam_selesai' => $row['jam_selesai'],
                            'pbl_tipe' => $row['pbl_tipe']
                        ])
                        ->log("Jadwal PBL imported: {$jadwal->modulPBL->nama}");
                } catch (\Exception $e) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $e->getMessage();
                }
            }

            if (count($errors) > 0) {
                return response()->json([
                    'success' => count($importedData),
                    'total' => count($data['data']),
                    'errors' => $errors,
                    'message' => 'Gagal mengimport ' . (count($data['data']) - count($importedData)) . ' dari ' . count($data['data']) . ' jadwal'
                ], 422);
            }

            return response()->json([
                'success' => count($importedData),
                'total' => count($data['data']),
                'message' => 'Berhasil mengimport ' . count($importedData) . ' jadwal PBL'
            ]);
        } catch (\Exception $e) {
            Log::error('Error importing PBL data: ' . $e->getMessage());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengimport data: ' . $e->getMessage()
            ], 500);
        }
    }

    // Get jadwal PBL untuk dosen tertentu
    public function getJadwalForDosen($dosenId, Request $request)
    {
        try {
            // Check if user exists
            $user = User::find($dosenId);
            if (!$user) {
                return response()->json([
                    'message' => 'Dosen tidak ditemukan',
                    'data' => []
                ], 404);
            }

            $semesterType = $request->query('semester_type');

            // PENTING: Query harus mengambil jadwal dimana:
            // 1. dosen_id = $dosenId (dosen aktif saat ini)
            // 2. ATAU $dosenId ada di dosen_ids (dosen lama/history)
            // Filter semester_type harus diterapkan ke kedua kondisi

            // Gunakan Eloquent untuk query yang lebih reliable
            $jadwalQuery = JadwalPBL::with([
                'modulPBL.mataKuliah',
                'kelompokKecil',
                'kelompokKecilAntara',
                'dosen',
                'ruangan'
            ])
            ->where(function ($query) use ($dosenId, $semesterType) {
                // Kondisi 1: Dosen aktif (dosen_id = $dosenId)
                    $query->where('dosen_id', $dosenId);

                // Filter semester_type untuk kondisi 1
                if ($semesterType && $semesterType !== 'all') {
                    if ($semesterType === 'reguler') {
                        $query->whereNull('kelompok_kecil_antara_id');
                    } elseif ($semesterType === 'antara') {
                        $query->whereNotNull('kelompok_kecil_antara_id');
                    }
                }
            })
            ->orWhere(function ($query) use ($dosenId, $semesterType) {
                // Kondisi 2: Dosen lama/history ($dosenId ada di dosen_ids)
                // Coba beberapa metode untuk memastikan kompatibilitas
                $query->whereNotNull('dosen_ids')
                    ->where(function ($q) use ($dosenId) {
                        // Metode 1: JSON_CONTAINS untuk MySQL
                        $q->whereRaw('JSON_CONTAINS(dosen_ids, ?)', [json_encode($dosenId)])
                            // Metode 2: JSON_SEARCH untuk MySQL (fallback)
                            ->orWhereRaw('JSON_SEARCH(dosen_ids, "one", ?) IS NOT NULL', [$dosenId])
                            // Metode 3: LIKE untuk string (fallback jika JSON tidak bekerja)
                            ->orWhereRaw('CAST(dosen_ids AS CHAR) LIKE ?', ['%"' . $dosenId . '"%'])
                            ->orWhereRaw('CAST(dosen_ids AS CHAR) LIKE ?', ['%' . $dosenId . '%']);
                    });

                // Filter semester_type untuk kondisi 2
            if ($semesterType && $semesterType !== 'all') {
                if ($semesterType === 'reguler') {
                    $query->whereNull('kelompok_kecil_antara_id');
                } elseif ($semesterType === 'antara') {
                    $query->whereNotNull('kelompok_kecil_antara_id');
                }
            }
                })
                ->orderBy('tanggal')
            ->orderBy('jam_mulai');

            // Get all jadwal
            $jadwal = $jadwalQuery->get();

            // Fallback: Jika tidak ada hasil, coba ambil semua jadwal dan filter di PHP
            if ($jadwal->isEmpty()) {
                Log::warning("No jadwal found with query, trying fallback method for dosen ID: {$dosenId}");
                $allJadwal = JadwalPBL::with([
                'modulPBL.mataKuliah',
                'kelompokKecil',
                'kelompokKecilAntara',
                'dosen',
                'ruangan'
                ])->get();

                $jadwal = $allJadwal->filter(function ($item) use ($dosenId, $semesterType) {
                    // Cek apakah dosen_id atau dosen_ids cocok
                    $isDosenActive = ($item->dosen_id == $dosenId);
                    $isDosenInHistory = false;

                    if ($item->dosen_ids) {
                        $dosenIds = is_array($item->dosen_ids) ? $item->dosen_ids : json_decode($item->dosen_ids, true);
                        $isDosenInHistory = is_array($dosenIds) && in_array($dosenId, $dosenIds);
                    }

                    if (!$isDosenActive && !$isDosenInHistory) {
                        return false;
                    }

                    // Filter semester_type
                    if ($semesterType && $semesterType !== 'all') {
                        if ($semesterType === 'reguler' && $item->kelompok_kecil_antara_id) {
                            return false;
                        } elseif ($semesterType === 'antara' && !$item->kelompok_kecil_antara_id) {
                            return false;
                        }
                    }

                    return true;
                })->sortBy([
                    ['tanggal', 'asc'],
                    ['jam_mulai', 'asc']
                ])->values();
            }

            Log::info("Found {$jadwal->count()} JadwalPBL records for dosen ID: {$dosenId}");

            // Log untuk debugging: cek apakah ada jadwal dengan dosen_ids yang mengandung $dosenId
            $jadwal->each(function ($item) use ($dosenId) {
                if ($item->dosen_ids) {
                    $dosenIds = is_array($item->dosen_ids) ? $item->dosen_ids : json_decode($item->dosen_ids, true);
                    if (is_array($dosenIds) && in_array($dosenId, $dosenIds)) {
                        Log::info("Jadwal ID {$item->id}: dosen_id={$item->dosen_id}, dosen_ids=" . json_encode($dosenIds) . ", current_dosen={$dosenId}, is_active=" . ($item->dosen_id == $dosenId ? 'yes' : 'no'));
                    }
                }
            });

            // Load dosen for each jadwal based on dosen_ids
            $jadwal->each(function ($item) {
                if ($item->dosen_ids) {
                    $dosenIds = is_array($item->dosen_ids) ? $item->dosen_ids : json_decode($item->dosen_ids, true);
                    if ($dosenIds && count($dosenIds) > 0) {
                        $dosen = User::whereIn('id', $dosenIds)->first();
                    if ($dosen) {
                        $item->dosen = $dosen;
                        }
                    }
                }
            });

            $mappedJadwal = $jadwal->map(function ($jadwal) use ($dosenId) {
                // Determine semester type based on kelompok_kecil_antara_id
                $semesterType = $jadwal->kelompok_kecil_antara_id ? 'antara' : 'reguler';

                // PENTING: Tentukan apakah dosen ini adalah dosen aktif (dosen_id) atau hanya ada di history (dosen_ids)
                $isActiveDosen = ($jadwal->dosen_id == $dosenId);
                $isInHistory = false;
                if (!$isActiveDosen && $jadwal->dosen_ids) {
                    $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
                    $isInHistory = is_array($dosenIds) && in_array($dosenId, $dosenIds);
                }

                // Jika dosen hanya ada di history (sudah diganti), status harus "tidak_bisa" dan tidak bisa diubah
                $statusKonfirmasi = $jadwal->status_konfirmasi ?? 'belum_konfirmasi';
                if ($isInHistory && !$isActiveDosen) {
                    // Dosen lama yang sudah diganti: status tetap "tidak_bisa"
                    $statusKonfirmasi = 'tidak_bisa';
                }

                return [
                    'id' => $jadwal->id,
                    'dosen_id' => $jadwal->dosen_id,
                    'dosen_ids' => $jadwal->dosen_ids,
                    'is_active_dosen' => $isActiveDosen, // Flag: apakah dosen ini adalah dosen aktif
                    'is_in_history' => $isInHistory, // Flag: apakah dosen ini hanya ada di history
                    'mata_kuliah_kode' => $jadwal->modulPBL->mataKuliah->kode ?? $jadwal->mata_kuliah_kode,
                    'mata_kuliah_nama' => $jadwal->modulPBL->mataKuliah->nama ?? 'Unknown',
                    'modul' => $jadwal->modulPBL->nama_modul ?? 'Unknown',
                    'blok' => $jadwal->modulPBL->mataKuliah->blok ?? 1,
                    'pertemuan_ke' => $jadwal->modulPBL->modul_ke ?? 1,
                    'topik' => $jadwal->modulPBL->nama_modul ?? 'Unknown',
                    'tipe_pbl' => $jadwal->pbl_tipe ?? 'PBL 1',
                    'kelompok' => $jadwal->kelompokKecilAntara ? $jadwal->kelompokKecilAntara->nama_kelompok : ($jadwal->kelompokKecil ? $jadwal->kelompokKecil->nama_kelompok : 'Unknown'),
                    'x50' => $jadwal->jumlah_sesi ?? 2,
                    'tanggal' => is_string($jadwal->tanggal) ? $jadwal->tanggal : $jadwal->tanggal->format('Y-m-d'),
                    'waktu_mulai' => $jadwal->jam_mulai,
                    'jam_mulai' => $jadwal->jam_mulai,
                    'jam_selesai' => $jadwal->jam_selesai,
                    'durasi' => $jadwal->jumlah_sesi ?? 2,
                    'pengampu' => $jadwal->dosen ? $jadwal->dosen->name : ($jadwal->dosen_ids ? (function () use ($jadwal) {
                        $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
                        return $dosenIds && count($dosenIds) > 0 ? \App\Models\User::whereIn('id', $dosenIds)->pluck('name')->join(', ') : 'Unknown';
                    })() : 'Unknown'),
                    'ruangan' => $jadwal->ruangan->nama ?? 'Unknown',
                    'lokasi' => $jadwal->ruangan->nama ?? 'Unknown',
                    'status_konfirmasi' => $statusKonfirmasi, // Status berdasarkan apakah dosen aktif atau history
                    'alasan_konfirmasi' => $jadwal->alasan_konfirmasi ?? null,
                    'status_reschedule' => $jadwal->status_reschedule ?? null,
                    'reschedule_reason' => $jadwal->reschedule_reason ?? null,
                    'semester_type' => $semesterType,
                    'penilaian_submitted' => (bool)($jadwal->penilaian_submitted ?? false),
                    'penilaian_submitted_at' => $jadwal->penilaian_submitted_at ?? null,
                    'penilaian_submitted_by' => $jadwal->penilaian_submitted_by ?? null,
                    'created_at' => $jadwal->created_at,
                ];
            });

            return response()->json([
                'message' => 'Data jadwal PBL berhasil diambil',
                'data' => $mappedJadwal->toArray(),
                'count' => $mappedJadwal->count()
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengambil data jadwal PBL',
                'error' => $e->getMessage(),
                'data' => []
            ], 500);
        }
    }

    // Get jadwal PBL for mahasiswa
    public function getJadwalForMahasiswa($mahasiswaId, Request $request)
    {
        try {
            // Check if user exists and is mahasiswa
            $mahasiswa = User::where('id', $mahasiswaId)->where('role', 'mahasiswa')->first();
            if (!$mahasiswa) {
                return response()->json([
                    'message' => 'Mahasiswa tidak ditemukan',
                    'data' => []
                ], 404);
            }

            // Get mahasiswa's kelompok kecil
            $kelompokKecil = \App\Models\KelompokKecil::where('mahasiswa_id', $mahasiswaId)->first();
            if (!$kelompokKecil) {
                return response()->json([
                    'message' => 'Mahasiswa belum memiliki kelompok',
                    'data' => []
                ]);
            }

            // Debug logging
            Log::info("PBL getJadwalForMahasiswa - Mahasiswa ID: {$mahasiswaId}, Kelompok Kecil ID: {$kelompokKecil->id}, Nama Kelompok: {$kelompokKecil->nama_kelompok}, Semester: {$kelompokKecil->semester}");

            $semesterType = $request->query('semester_type');

            // Get jadwal PBL based on mahasiswa's kelompok kecil
            // Cari semua jadwal PBL yang memiliki nama_kelompok dan semester yang sama dengan mahasiswa
            $query = JadwalPBL::with([
                'modulPBL.mataKuliah',
                'kelompokKecil',
                'dosen',
                'ruangan'
            ])->whereHas('kelompokKecil', function ($q) use ($kelompokKecil) {
                $q->where('nama_kelompok', $kelompokKecil->nama_kelompok)
                    ->where('semester', $kelompokKecil->semester);
            });

            $jadwal = $query->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();

            // Debug logging
            Log::info("PBL getJadwalForMahasiswa - Found {$jadwal->count()} jadwal PBL for kelompok: {$kelompokKecil->nama_kelompok} semester: {$kelompokKecil->semester}");

            $mappedJadwal = $jadwal->map(function ($item) {
                // Buat modul name yang sesuai dengan pbl_tipe
                $modulName = $item->modulPBL->nama_modul ?? 'N/A';
                if ($item->pbl_tipe && $item->pbl_tipe !== 'PBL 1') {
                    // Jika bukan PBL 1, cek apakah nama_modul sudah memiliki prefix yang benar
                    if (!str_starts_with($modulName, $item->pbl_tipe . ':')) {
                        // Jika belum memiliki prefix yang benar, tambahkan
                        $cleanModulName = str_replace(['PBL 1: ', 'PBL 2: '], '', $modulName);
                        $modulName = $item->pbl_tipe . ': ' . $cleanModulName;
                    }
                }

                return [
                    'id' => $item->id,
                    'tanggal' => date('d-m-Y', strtotime($item->tanggal)),
                    'jam_mulai' => str_replace(':', '.', substr($item->jam_mulai, 0, 5)),
                    'jam_selesai' => str_replace(':', '.', substr($item->jam_selesai, 0, 5)),
                    'modul' => $modulName,
                    'topik' => $item->modulPBL->topik ?? 'N/A',
                    'tipe_pbl' => $item->pbl_tipe ?? 'N/A',
                    'kelompok' => $item->kelompokKecil->nama_kelompok ?? 'N/A',
                    'x50' => $item->jumlah_sesi,
                    'pengampu' => $item->dosen->name ?? 'N/A',
                    'ruangan' => $item->ruangan->nama ?? 'N/A',
                    'status_konfirmasi' => $item->status_konfirmasi ?? 'belum_konfirmasi',
                    'status_reschedule' => $item->status_reschedule ?? null,
                    'alasan_konfirmasi' => $item->alasan_konfirmasi ?? null,
                    'reschedule_reason' => $item->reschedule_reason ?? null,
                    'semester_type' => 'reguler', // Default semester type
                ];
            });

            // Debug logging untuk response
            Log::info("PBL getJadwalForMahasiswa - Response data count: " . $mappedJadwal->count());
            Log::info("PBL getJadwalForMahasiswa - First item: " . json_encode($mappedJadwal->first()));

            return response()->json([
                'message' => 'Data jadwal PBL berhasil diambil',
                'data' => $mappedJadwal
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching jadwal PBL for mahasiswa: ' . $e->getMessage());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengambil data jadwal PBL',
                'error' => $e->getMessage(),
                'data' => []
            ], 500);
        }
    }

    // Konfirmasi jadwal PBL oleh dosen
    public function konfirmasiJadwal(Request $request, $jadwalId)
    {
        $request->validate([
            'status' => 'required|in:bisa,tidak_bisa',
            'dosen_id' => 'required|exists:users,id',
            'alasan' => 'nullable|string|max:1000'
        ]);

        $jadwal = JadwalPBL::with(['modulPBL.mataKuliah', 'dosen'])
            ->where('id', $jadwalId)
            ->where(function ($query) use ($request) {
                $query->where('dosen_id', $request->dosen_id)
                    ->orWhereJsonContains('dosen_ids', $request->dosen_id);
            })
            ->firstOrFail();

        // Update status konfirmasi
        $jadwal->update([
            'status_konfirmasi' => $request->status,
            'alasan_konfirmasi' => $request->alasan
        ]);

        // LONG-TERM FIX: Update dosen_ids based on confirmation status
        $this->updateDosenIdsBasedOnConfirmation($jadwal, $request->dosen_id, $request->status);

        // Jika dosen tidak bisa, kirim notifikasi ke admin
        if ($request->status === 'tidak_bisa') {
            $this->sendReplacementNotification($jadwal);
        }

        return response()->json([
            'message' => 'Status konfirmasi berhasil diperbarui',
            'status' => $request->status
        ]);
    }

    // Ajukan reschedule jadwal PBL
    public function reschedule(Request $request, $jadwalId)
    {
        $request->validate([
            'reschedule_reason' => 'required|string|max:1000',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $jadwal = JadwalPBL::with(['modulPBL.mataKuliah', 'dosen'])
            ->where('id', $jadwalId)
            ->where(function ($query) use ($request) {
                $query->where('dosen_id', $request->dosen_id)
                    ->orWhereJsonContains('dosen_ids', $request->dosen_id);
            })
            ->firstOrFail();

        // Update status menjadi waiting_reschedule
        $jadwal->update([
            'status_konfirmasi' => 'waiting_reschedule',
            'reschedule_reason' => $request->reschedule_reason,
            'status_reschedule' => 'waiting'
        ]);

        // Kirim notifikasi ke admin
        $this->sendRescheduleNotification($jadwal, $request->reschedule_reason);

        return response()->json([
            'message' => 'Permintaan reschedule berhasil diajukan',
            'status' => 'waiting_reschedule'
        ]);
    }

    /**
     * Kirim notifikasi reschedule ke admin
     */
    private function sendRescheduleNotification($jadwal, $reason)
    {
        try {
            $dosen = User::find($jadwal->dosen_id);

            // Buat hanya 1 notifikasi yang bisa dilihat oleh semua admin
            $firstAdmin = User::where('role', 'super_admin')->first() ?? User::where('role', 'tim_akademik')->first();

            if ($firstAdmin) {
                Notification::create([
                    'user_id' => $firstAdmin->id,
                    'title' => 'Permintaan Reschedule Jadwal',
                    'message' => "Dosen {$jadwal->dosen->name} mengajukan reschedule untuk jadwal PBL. Alasan: {$reason}",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'pbl',
                        'dosen_name' => $jadwal->dosen->name,
                        'dosen_id' => $jadwal->dosen->id,
                        'reschedule_reason' => $reason,
                        'notification_type' => 'reschedule_request'
                    ]
                ]);
            }

            Log::info("Reschedule notification sent for PBL jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            Log::error("Error sending reschedule notification for PBL jadwal ID: {$jadwal->id}: " . $e->getMessage());
        }
    }

    /**
     * Update dosen_ids based on confirmation status
     * This ensures dosen_ids reflects actual confirmed dosen
     */
    private function updateDosenIdsBasedOnConfirmation($jadwal, $dosenId, $status)
    {
        try {
            $currentDosenIds = $jadwal->dosen_ids ? (is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true)) : [];

            if ($status === 'bisa') {
                // Add dosen to dosen_ids if not already present
                if (!in_array($dosenId, $currentDosenIds)) {
                    $currentDosenIds[] = $dosenId;
                    Log::info("Adding dosen {$dosenId} to dosen_ids for jadwal {$jadwal->id}");
                }
            } elseif ($status === 'tidak_bisa') {
                // PENTING: Jangan hapus dosen dari dosen_ids saat status "tidak_bisa"
                // dosen_ids tetap menyimpan history (dosen pengampu awal di index 0, dosen pengganti di index selanjutnya)
                // Hanya update status_konfirmasi, jangan ubah dosen_ids
                Log::info("Dosen {$dosenId} status changed to tidak_bisa for jadwal {$jadwal->id}, but keeping in dosen_ids for history");
            }

            // Update jadwal with new dosen_ids (hanya jika ada perubahan untuk status 'bisa')
            if ($status === 'bisa') {
            $jadwal->update(['dosen_ids' => $currentDosenIds]);
            }

            Log::info("Updated dosen_ids for jadwal {$jadwal->id}: " . json_encode($currentDosenIds));
        } catch (\Exception $e) {
            Log::error("Error updating dosen_ids for jadwal {$jadwal->id}: " . $e->getMessage());
        }
    }

    // Kirim notifikasi ke admin untuk replace dosen
    private function sendReplacementNotification($jadwal)
    {
        // Ambil semua super admin
        $superAdmins = User::where('role', 'super_admin')->get();

        // Get dosen name - handle both single dosen and multiple dosen cases
        $dosenName = 'Unknown';
        if ($jadwal->dosen) {
            $dosenName = $jadwal->dosen->name;
        } elseif ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosen = User::whereIn('id', $jadwal->dosen_ids)->first();
            if ($dosen) {
                $dosenName = $dosen->name;
            }
        }

        foreach ($superAdmins as $admin) {
            \App\Models\Notification::create([
                'user_id' => $admin->id,
                'title' => 'Dosen Tidak Bisa Mengajar',
                'message' => "Dosen {$dosenName} tidak bisa mengajar pada jadwal PBL {$jadwal->modulPBL->mataKuliah->nama} - Modul {$jadwal->modulPBL->modul_ke}",
                'type' => 'warning',
                'is_read' => false,
                'data' => [
                    'jadwal_id' => $jadwal->id,
                    'jadwal_type' => 'pbl',
                    'dosen_id' => $jadwal->dosen_id,
                    'dosen_ids' => $jadwal->dosen_ids,
                    'dosen_name' => $dosenName, // Simpan nama dosen untuk ditampilkan di frontend
                    'mata_kuliah' => $jadwal->modulPBL->mataKuliah->nama,
                    'modul' => $jadwal->modulPBL->modul_ke,
                    'tanggal' => $jadwal->tanggal,
                    'waktu' => $jadwal->jam_mulai . ' - ' . $jadwal->jam_selesai,
                    'ruangan' => $jadwal->ruangan->nama
                ]
            ]);
        }
    }

    /**
     * Send notification to mahasiswa in the kelompok
     */
    private function sendNotificationToMahasiswa($jadwal)
    {
        try {
            // Get mahasiswa in the specific kelompok kecil that was assigned
            $mahasiswaList = [];

            if ($jadwal->kelompok_kecil_id) {
                // Get the kelompok kecil info
                $kelompokKecil = \App\Models\KelompokKecil::find($jadwal->kelompok_kecil_id);
                if ($kelompokKecil) {
                    // Get ALL mahasiswa in the same kelompok (nama_kelompok) and semester
                    $kelompokKecilList = \App\Models\KelompokKecil::with('mahasiswa')
                        ->where('semester', $kelompokKecil->semester)
                        ->where('nama_kelompok', $kelompokKecil->nama_kelompok)
                        ->get();

                    // Extract mahasiswa from kelompok kecil
                    foreach ($kelompokKecilList as $kk) {
                        if ($kk->mahasiswa) {
                            $mahasiswaList[] = $kk->mahasiswa;
                        }
                    }
                }
            }

            // Send notification to each mahasiswa in the assigned group
            foreach ($mahasiswaList as $mahasiswa) {
                // Buat modul name yang sesuai dengan pbl_tipe
                $modulName = $jadwal->modulPBL->nama_modul;
                if ($jadwal->pbl_tipe && $jadwal->pbl_tipe !== 'PBL 1') {
                    // Cek apakah nama_modul sudah memiliki prefix yang benar
                    if (!str_starts_with($modulName, $jadwal->pbl_tipe . ':')) {
                        // Jika belum memiliki prefix yang benar, tambahkan
                        $cleanModulName = str_replace(['PBL 1: ', 'PBL 2: '], '', $modulName);
                        $modulName = $jadwal->pbl_tipe . ': ' . $cleanModulName;
                    }
                }

                \App\Models\Notification::create([
                    'user_id' => $mahasiswa->id,
                    'title' => 'Jadwal PBL Baru',
                    'message' => "Jadwal PBL baru telah ditambahkan: {$jadwal->modulPBL->mataKuliah->nama} - {$modulName} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}.",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'pbl',
                        'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                        'mata_kuliah_nama' => $jadwal->modulPBL->mataKuliah->nama,
                        'modul' => $modulName,
                        'pbl_tipe' => $jadwal->pbl_tipe,
                        'tanggal' => $jadwal->tanggal,
                        'jam_mulai' => $jadwal->jam_mulai,
                        'jam_selesai' => $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'dosen' => $jadwal->dosen ? $jadwal->dosen->name : 'N/A',
                        'created_by' => Auth::user()?->name ?? 'Admin',
                        'created_by_role' => Auth::user()?->role ?? 'admin',
                        'sender_name' => Auth::user()?->name ?? 'Admin',
                        'sender_role' => Auth::user()?->role ?? 'admin'
                    ]
                ]);
            }

            Log::info("PBL notifications sent to " . count($mahasiswaList) . " mahasiswa for jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            Log::error("Error sending PBL notifications to mahasiswa: " . $e->getMessage());
        }
    }

    /**
     * Get jadwal PBL berdasarkan PBL ID
     */
    public function getJadwalByPblId($kode, $pblId)
    {
        try {
            $jadwal = JadwalPBL::with(['modulPBL', 'kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan'])
                ->where('mata_kuliah_kode', $kode)
                ->where('pbl_id', $pblId)
                ->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();

            // Tambahkan modul_pbl_id dan nama_kelompok untuk kompatibilitas dengan frontend
            $jadwal->transform(function ($item) {
                $item->modul_pbl_id = $item->pbl_id;

                // Tambahkan nama kelompok untuk kompatibilitas dengan frontend
                if ($item->kelompok_kecil_antara) {
                    $item->nama_kelompok = $item->kelompok_kecil_antara->nama_kelompok;
                } elseif ($item->kelompok_kecil) {
                    $item->nama_kelompok = $item->kelompok_kecil->nama_kelompok;
                }

                return $item;
            });

            return response()->json([
                'message' => 'Jadwal PBL berhasil diambil',
                'data' => $jadwal
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengambil jadwal PBL',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        try {
            $jadwal = JadwalPBL::with(['modulPBL', 'kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan'])
                ->find($id);

            if (!$jadwal) {
                return response()->json([
                    'message' => 'Jadwal PBL tidak ditemukan'
                ], 404);
            }

            // Tambahkan modul_pbl_id untuk kompatibilitas dengan frontend
            $jadwal->modul_pbl_id = $jadwal->pbl_id;

            // Tambahkan nama kelompok untuk kompatibilitas dengan frontend
            if ($jadwal->kelompokKecil) {
                $jadwal->nama_kelompok = $jadwal->kelompokKecil->nama_kelompok;
            } elseif ($jadwal->kelompokKecilAntara) {
                $jadwal->nama_kelompok = $jadwal->kelompokKecilAntara->nama_kelompok;
            }

            return response()->json([
                'message' => 'Data jadwal PBL berhasil diambil',
                'data' => $jadwal
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengambil jadwal PBL',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
