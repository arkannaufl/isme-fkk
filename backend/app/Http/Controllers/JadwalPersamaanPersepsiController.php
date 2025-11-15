<?php

namespace App\Http\Controllers;

use App\Models\JadwalPersamaanPersepsi;
use App\Models\User;
use App\Models\Ruangan;
use App\Models\Notification;
use App\Models\AbsensiPersamaanPersepsi;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Collection;

class JadwalPersamaanPersepsiController extends Controller
{
    // List semua jadwal Persamaan Persepsi untuk satu mata kuliah blok
    public function index($kode)
    {
        $jadwal = JadwalPersamaanPersepsi::with(['ruangan', 'mataKuliah'])
            ->where('mata_kuliah_kode', $kode)
            ->orderBy('tanggal')
            ->orderBy('jam_mulai')
            ->get();

        // Tambahkan nama dosen untuk setiap jadwal, pisahkan koordinator dan pengampu
        foreach ($jadwal as $j) {
            $mataKuliah = $j->mataKuliah;

            // Koordinator dari koordinator_ids
            $koordinatorIds = $j->koordinator_ids && is_array($j->koordinator_ids) ? $j->koordinator_ids : [];
            $koordinatorList = !empty($koordinatorIds) ? User::whereIn('id', $koordinatorIds)->get() : collect([]);

            // Pengampu (non-koordinator) dari dosen_ids yang tidak ada di koordinator_ids
            $dosenIds = $j->dosen_ids && is_array($j->dosen_ids) ? $j->dosen_ids : [];
            $pengampuIds = array_diff($dosenIds, $koordinatorIds);
            $pengampuList = !empty($pengampuIds) ? User::whereIn('id', $pengampuIds)->get() : collect([]);

            // Format koordinator (untuk kolom Koordinator)
            $koordinatorNames = $koordinatorList->pluck('name')->toArray();
            $j->koordinator_names = implode(', ', $koordinatorNames);

            // Format pengampu (untuk kolom Pengampu - non-koordinator)
            $pengampuNames = $pengampuList->pluck('name')->toArray();
            $j->pengampu_names = implode(', ', $pengampuNames);

            // Format dosen_with_roles untuk kompatibilitas (semua dosen, dengan flag is_koordinator)
            $allDosenIds = array_unique(array_merge($koordinatorIds, $pengampuIds));
            $allDosenList = !empty($allDosenIds) ? User::whereIn('id', $allDosenIds)->get() : collect([]);

            $dosenWithRoles = [];
            foreach ($allDosenList as $dosen) {
                $isKoordinator = in_array($dosen->id, $koordinatorIds);
                $dosenWithRoles[] = [
                    'id' => $dosen->id,
                    'name' => $dosen->name,
                    'peran' => $isKoordinator ? 'koordinator' : 'dosen_mengajar',
                    'peran_display' => $isKoordinator ? 'Koordinator' : 'Dosen Mengajar',
                    'is_koordinator' => $isKoordinator,
                ];
            }

            $j->dosen_with_roles = $dosenWithRoles;
            $j->dosen_names = implode(', ', array_column($dosenWithRoles, 'name'));
        }

        return response()->json($jadwal);
    }

    // Tambah jadwal Persamaan Persepsi baru
    public function store(Request $request, $kode)
    {
        $data = $request->validate([
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
            'dosen_ids' => 'required|array|min:1', // Pengampu (non-koordinator)
            'dosen_ids.*' => 'exists:users,id',
            'koordinator_ids' => 'nullable|array', // Koordinator (opsional)
            'koordinator_ids.*' => 'exists:users,id',
            'ruangan_id' => 'nullable|exists:ruangan,id',
            'use_ruangan' => 'required|boolean',
            'topik' => 'nullable|string',
        ]);

        // Gabungkan koordinator_ids dan dosen_ids untuk validasi kapasitas dan bentrok
        $koordinatorIds = $data['koordinator_ids'] ?? [];
        $pengampuIds = $data['dosen_ids'] ?? [];

        // Validasi: Cek apakah ada dosen yang sama di koordinator_ids dan dosen_ids
        $duplicateIds = array_intersect($koordinatorIds, $pengampuIds);
        if (!empty($duplicateIds)) {
            $duplicateNames = \App\Models\User::whereIn('id', $duplicateIds)->pluck('name')->toArray();
            return response()->json([
                'message' => 'Dosen yang sama tidak boleh dipilih sebagai Koordinator Dosen dan Pengampu: ' . implode(', ', $duplicateNames)
            ], 422);
        }

        $allDosenIds = array_unique(array_merge($koordinatorIds, $pengampuIds));

        $data['mata_kuliah_kode'] = $kode;
        $data['created_by'] = $request->input('created_by', auth()->id());

        // Set topik ke null jika kosong
        if (empty($data['topik'])) {
            $data['topik'] = null;
        }

        // Validasi ruangan hanya jika menggunakan ruangan
        if ($data['use_ruangan']) {
            if (!$data['ruangan_id']) {
                return response()->json(['message' => 'Ruangan wajib dipilih jika menggunakan ruangan'], 422);
            }
        } else {
            // Jika tidak menggunakan ruangan, set ruangan_id ke null
            $data['ruangan_id'] = null;
        }

        // Untuk validasi kapasitas dan bentrok, gunakan semua dosen (koordinator + pengampu)
        $dataForValidation = $data;
        $dataForValidation['dosen_ids'] = $allDosenIds;

        // Validasi kapasitas ruangan hanya jika menggunakan ruangan
        if ($data['use_ruangan'] && $data['ruangan_id']) {
            $kapasitasMessage = $this->validateRuanganCapacity($dataForValidation);
            if ($kapasitasMessage) {
                return response()->json(['message' => $kapasitasMessage], 422);
            }
        }

        // Validasi bentrok (cek semua dosen - koordinator + pengampu)
        $bentrokMessage = $this->checkBentrokWithDetail($dataForValidation, null);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        // Set status_konfirmasi otomatis menjadi 'bisa' untuk Persamaan Persepsi (tidak perlu konfirmasi)
        $data['status_konfirmasi'] = 'bisa';

        $jadwal = JadwalPersamaanPersepsi::create($data);

        // Log activity
        activity()
            ->performedOn($jadwal)
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'tanggal' => $data['tanggal'],
                'jam_mulai' => $data['jam_mulai'],
                'jam_selesai' => $data['jam_selesai'],
                'topik' => $data['topik']
            ])
            ->log("Jadwal Persamaan Persepsi created");

        // Load relasi
        $jadwal->load(['ruangan', 'mataKuliah']);

        // Tambahkan nama dosen untuk response
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
            $jadwal->dosen_names = implode(', ', $dosenNames);
        }

        // Buat notifikasi untuk semua dosen yang di-assign (koordinator + pengampu)
        $allDosenIdsForNotification = array_unique(array_merge(
            $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : [],
            $jadwal->dosen_ids && is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : []
        ));

        if (!empty($allDosenIdsForNotification)) {
            foreach ($allDosenIdsForNotification as $dosenId) {
                $dosen = User::find($dosenId);
                if ($dosen) {
                    $ruanganNama = $jadwal->ruangan ? $jadwal->ruangan->nama : 'Online';
                    $ruanganInfo = $jadwal->use_ruangan && $jadwal->ruangan
                        ? "di ruangan {$ruanganNama}"
                        : "secara online";

                    // Cek apakah dosen adalah koordinator atau pengampu
                    $isKoordinator = $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) && in_array($dosenId, $jadwal->koordinator_ids);

                    // Ambil daftar pengampu untuk koordinator
                    $pengampuList = [];
                    if ($isKoordinator && $jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
                        $pengampuIds = array_diff($jadwal->dosen_ids, $jadwal->koordinator_ids ?? []);
                        if (!empty($pengampuIds)) {
                            $pengampuList = User::whereIn('id', $pengampuIds)
                                ->pluck('name')
                                ->toArray();
                        }
                    }

                    // Ambil daftar koordinator untuk pengampu
                    $koordinatorList = [];
                    if (!$isKoordinator && $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) && !empty($jadwal->koordinator_ids)) {
                        $koordinatorList = User::whereIn('id', $jadwal->koordinator_ids)
                            ->pluck('name')
                            ->toArray();
                    }

                    // Buat pesan berbeda untuk koordinator dan pengampu
                    if ($isKoordinator) {
                        $title = 'Jadwal Persamaan Persepsi Baru - Koordinator';
                        $message = "Anda telah menjadi koordinator dosen untuk Persamaan Persepsi {$jadwal->mataKuliah->nama} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} {$ruanganInfo}.";
                        if (!empty($pengampuList)) {
                            $message .= " Dosen pengampu: " . implode(', ', $pengampuList) . ".";
                        }
                        $message .= " Silakan persiapkan diri untuk mengajar.";
                    } else {
                        $title = 'Jadwal Persamaan Persepsi Baru';
                        $message = "Anda telah di-assign untuk Persamaan Persepsi {$jadwal->mataKuliah->nama} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} {$ruanganInfo}.";
                        if (!empty($koordinatorList)) {
                            $message .= " Koordinator dosen: " . implode(', ', $koordinatorList) . ".";
                        }
                        $message .= " Silakan persiapkan diri untuk mengajar.";
                    }

                    Notification::create([
                        'user_id' => $dosenId,
                        'title' => $title,
                        'message' => $message,
                        'type' => 'info',
                        'data' => [
                            'topik' => $jadwal->topik,
                            'ruangan' => $ruanganNama,
                            'tanggal' => $jadwal->tanggal,
                            'jadwal_id' => $jadwal->id,
                            'jam_mulai' => $jadwal->jam_mulai,
                            'jadwal_type' => 'persamaan_persepsi',
                            'jam_selesai' => $jadwal->jam_selesai,
                            'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                            'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                            'dosen_id' => $dosen->id,
                            'dosen_name' => $dosen->name,
                            'dosen_role' => $dosen->role,
                            'created_by' => auth()->user()->name ?? 'Admin',
                            'created_by_role' => auth()->user()->role ?? 'admin',
                            'sender_name' => auth()->user()->name ?? 'Admin',
                            'sender_role' => auth()->user()->role ?? 'admin'
                        ]
                    ]);
                }
            }
        }

        return response()->json($jadwal, Response::HTTP_CREATED);
    }

    // Update jadwal Persamaan Persepsi
    public function update(Request $request, $kode, $id)
    {
        $jadwal = JadwalPersamaanPersepsi::findOrFail($id);

        $data = $request->validate([
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
            'dosen_ids' => 'required|array|min:1', // Pengampu (non-koordinator)
            'dosen_ids.*' => 'exists:users,id',
            'koordinator_ids' => 'nullable|array', // Koordinator (opsional)
            'koordinator_ids.*' => 'exists:users,id',
            'ruangan_id' => 'nullable|exists:ruangan,id',
            'use_ruangan' => 'required|boolean',
            'topik' => 'nullable|string',
        ]);

        // Gabungkan koordinator_ids dan dosen_ids untuk validasi kapasitas dan bentrok
        $koordinatorIds = $data['koordinator_ids'] ?? [];
        $pengampuIds = $data['dosen_ids'] ?? [];

        // Validasi: Cek apakah ada dosen yang sama di koordinator_ids dan dosen_ids
        $duplicateIds = array_intersect($koordinatorIds, $pengampuIds);
        if (!empty($duplicateIds)) {
            $duplicateNames = \App\Models\User::whereIn('id', $duplicateIds)->pluck('name')->toArray();
            return response()->json([
                'message' => 'Dosen yang sama tidak boleh dipilih sebagai Koordinator Dosen dan Pengampu: ' . implode(', ', $duplicateNames)
            ], 422);
        }

        $allDosenIds = array_unique(array_merge($koordinatorIds, $pengampuIds));

        $data['mata_kuliah_kode'] = $kode;

        // Set topik ke null jika kosong
        if (empty($data['topik'])) {
            $data['topik'] = null;
        }

        // Validasi ruangan hanya jika menggunakan ruangan
        if ($data['use_ruangan']) {
            if (!$data['ruangan_id']) {
                return response()->json(['message' => 'Ruangan wajib dipilih jika menggunakan ruangan'], 422);
            }
        } else {
            // Jika tidak menggunakan ruangan, set ruangan_id ke null
            $data['ruangan_id'] = null;
        }

        // Untuk validasi kapasitas dan bentrok, gunakan semua dosen (koordinator + pengampu)
        $dataForValidation = $data;
        $dataForValidation['dosen_ids'] = $allDosenIds;

        // Validasi kapasitas ruangan hanya jika menggunakan ruangan
        if ($data['use_ruangan'] && $data['ruangan_id']) {
            $kapasitasMessage = $this->validateRuanganCapacity($dataForValidation);
            if ($kapasitasMessage) {
                return response()->json(['message' => $kapasitasMessage], 422);
            }
        }

        // Validasi bentrok (cek semua dosen - koordinator + pengampu, kecuali dirinya sendiri)
        $bentrokMessage = $this->checkBentrokWithDetail($dataForValidation, $id);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        // Set status_konfirmasi otomatis menjadi 'bisa' untuk Persamaan Persepsi (tidak perlu konfirmasi)
        $data['status_konfirmasi'] = 'bisa';

        $jadwal->update($data);

        // Log activity
        activity()
            ->performedOn($jadwal)
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'tanggal' => $data['tanggal'],
                'jam_mulai' => $data['jam_mulai'],
                'jam_selesai' => $data['jam_selesai'],
                'topik' => $data['topik']
            ])
            ->log("Jadwal Persamaan Persepsi updated");

        // Load relasi
        $jadwal->load(['ruangan', 'mataKuliah']);

        // Tambahkan nama dosen untuk response
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
            $jadwal->dosen_names = implode(', ', $dosenNames);
        }

        return response()->json($jadwal);
    }

    // Hapus jadwal Persamaan Persepsi
    public function destroy($kode, $id)
    {
        $jadwal = JadwalPersamaanPersepsi::findOrFail($id);

        // Log activity before deletion
        activity()
            ->performedOn($jadwal)
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'tanggal' => $jadwal->tanggal,
                'jam_mulai' => $jadwal->jam_mulai,
                'jam_selesai' => $jadwal->jam_selesai,
                'topik' => $jadwal->topik
            ])
            ->log("Jadwal Persamaan Persepsi deleted");

        $jadwal->delete();
        return response()->json(['message' => 'Jadwal Persamaan Persepsi berhasil dihapus']);
    }

    /**
     * Import multiple jadwal Persamaan Persepsi
     */
    public function import(Request $request, $kode)
    {
        try {
            $data = $request->validate([
                'data' => 'required|array',
                'data.*.tanggal' => 'required|date',
                'data.*.jam_mulai' => 'required|string',
                'data.*.jam_selesai' => 'required|string',
                'data.*.jumlah_sesi' => 'required|integer|min:1|max:6',
                'data.*.dosen_ids' => 'required|array|min:1', // Pengampu (non-koordinator)
                'data.*.dosen_ids.*' => 'exists:users,id',
                'data.*.koordinator_ids' => 'nullable|array', // Koordinator (opsional)
                'data.*.koordinator_ids.*' => 'exists:users,id',
                'data.*.ruangan_id' => 'nullable|integer|min:1',
                'data.*.use_ruangan' => 'required|boolean',
                'data.*.topik' => 'nullable|string',
            ]);

            $mataKuliah = \App\Models\MataKuliah::find($kode);
            if (!$mataKuliah) {
                return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
            }

            $errors = [];
            $validData = [];

            // Validasi semua data terlebih dahulu (all or nothing approach)
            foreach ($data['data'] as $index => $row) {
                $rowErrors = [];

                // Validasi tanggal dalam rentang mata kuliah
                if ($row['tanggal'] < $mataKuliah->tanggal_mulai || $row['tanggal'] > $mataKuliah->tanggal_akhir) {
                    $rowErrors[] = "Baris " . ($index + 1) . ": Tanggal di luar rentang mata kuliah";
                }

                // Validasi ruangan hanya jika menggunakan ruangan
                $useRuangan = $row['use_ruangan'] ?? true;
                if ($useRuangan) {
                    if (!$row['ruangan_id']) {
                        $rowErrors[] = "Baris " . ($index + 1) . ": Ruangan wajib dipilih jika menggunakan ruangan";
                    } else {
                        $ruangan = Ruangan::find($row['ruangan_id']);
                        if (!$ruangan) {
                            $rowErrors[] = "Baris " . ($index + 1) . ": Ruangan tidak ditemukan";
                        } else {
                            // Validasi kapasitas ruangan (koordinator + pengampu)
                            $koordinatorIds = $row['koordinator_ids'] ?? [];
                            $pengampuIds = $row['dosen_ids'] ?? [];

                            // Validasi: Cek apakah ada dosen yang sama di koordinator_ids dan dosen_ids
                            $duplicateIds = array_intersect($koordinatorIds, $pengampuIds);
                            if (!empty($duplicateIds)) {
                                $duplicateNames = \App\Models\User::whereIn('id', $duplicateIds)->pluck('name')->toArray();
                                $rowErrors[] = "Baris " . ($index + 1) . ": Dosen yang sama tidak boleh dipilih sebagai Koordinator Dosen dan Pengampu: " . implode(', ', $duplicateNames);
                            }

                            $allDosenIds = array_unique(array_merge($koordinatorIds, $pengampuIds));
                            $jumlahDosen = count($allDosenIds);
                            if ($jumlahDosen > $ruangan->kapasitas) {
                                $rowErrors[] = "Baris " . ($index + 1) . ": Kapasitas ruangan tidak mencukupi. Ruangan {$ruangan->nama} hanya dapat menampung {$ruangan->kapasitas} orang, sedangkan diperlukan {$jumlahDosen} dosen";
                            }
                        }
                    }
                } else {
                    // Jika tidak menggunakan ruangan, set ruangan_id ke null
                    $row['ruangan_id'] = null;
                }

                // Validasi dosen pengampu
                foreach ($row['dosen_ids'] as $dosenId) {
                    $dosen = User::find($dosenId);
                    if (!$dosen) {
                        $rowErrors[] = "Baris " . ($index + 1) . ": Dosen dengan ID {$dosenId} tidak ditemukan";
                    }
                }

                // Validasi dosen koordinator
                $koordinatorIds = $row['koordinator_ids'] ?? [];
                foreach ($koordinatorIds as $dosenId) {
                    $dosen = User::find($dosenId);
                    if (!$dosen) {
                        $rowErrors[] = "Baris " . ($index + 1) . ": Koordinator dengan ID {$dosenId} tidak ditemukan";
                    }
                }

                // Gabungkan koordinator_ids dan dosen_ids untuk validasi bentrok
                $koordinatorIds = $row['koordinator_ids'] ?? [];
                $pengampuIds = $row['dosen_ids'] ?? [];
                $allDosenIds = array_unique(array_merge($koordinatorIds, $pengampuIds));

                // Validasi bentrok (cek semua dosen - koordinator + pengampu)
                $rowData = [
                    'mata_kuliah_kode' => $kode,
                    'tanggal' => $row['tanggal'],
                    'jam_mulai' => $row['jam_mulai'],
                    'jam_selesai' => $row['jam_selesai'],
                    'jumlah_sesi' => $row['jumlah_sesi'],
                    'dosen_ids' => $allDosenIds, // Semua dosen untuk validasi bentrok
                    'ruangan_id' => $row['ruangan_id'],
                    'use_ruangan' => $row['use_ruangan'] ?? true,
                    'topik' => $row['topik'] ?? '',
                ];

                $bentrokMessage = $this->checkBentrokWithDetail($rowData, null);
                if ($bentrokMessage) {
                    $rowErrors[] = "Baris " . ($index + 1) . ": " . $bentrokMessage;
                }

                // Validasi bentrok dengan data dalam batch import yang sama
                for ($j = 0; $j < $index; $j++) {
                    $previousData = $data['data'][$j];
                    // Gabungkan koordinator_ids dan dosen_ids untuk validasi bentrok
                    $prevKoordinatorIds = $previousData['koordinator_ids'] ?? [];
                    $prevPengampuIds = $previousData['dosen_ids'] ?? [];
                    $prevAllDosenIds = array_unique(array_merge($prevKoordinatorIds, $prevPengampuIds));

                    $previousRowData = [
                        'mata_kuliah_kode' => $kode,
                        'tanggal' => $previousData['tanggal'],
                        'jam_mulai' => $previousData['jam_mulai'],
                        'jam_selesai' => $previousData['jam_selesai'],
                        'jumlah_sesi' => $previousData['jumlah_sesi'],
                        'dosen_ids' => $prevAllDosenIds, // Semua dosen untuk validasi bentrok
                        'ruangan_id' => $previousData['ruangan_id'],
                        'use_ruangan' => $previousData['use_ruangan'] ?? true,
                        'topik' => $previousData['topik'] ?? '',
                    ];
                    if ($this->isDataBentrok($rowData, $previousRowData)) {
                        $ruanganPrev = Ruangan::find($previousData['ruangan_id']);
                        $ruanganNamePrev = $ruanganPrev ? $ruanganPrev->nama : 'N/A';
                        $dosenNamesPrev = [];
                        foreach ($prevAllDosenIds as $dosenIdPrev) {
                            $dosenPrev = User::find($dosenIdPrev);
                            if ($dosenPrev) {
                                $dosenNamesPrev[] = $dosenPrev->name;
                            }
                        }
                        $dosenNamesStrPrev = implode(', ', $dosenNamesPrev);
                        if (empty($dosenNamesStrPrev)) {
                            $dosenNamesStrPrev = 'N/A';
                        }
                        $rowErrors[] = "Jadwal bentrok dengan data pada baris " . ($j + 1) . " (Dosen: {$dosenNamesStrPrev}, Ruangan: {$ruanganNamePrev})";
                        break;
                    }
                }

                if (empty($rowErrors)) {
                    // Simpan koordinator_ids dan dosen_ids terpisah untuk insert ke database
                    $validRowData = [
                        'mata_kuliah_kode' => $kode,
                        'tanggal' => $row['tanggal'],
                        'jam_mulai' => $row['jam_mulai'],
                        'jam_selesai' => $row['jam_selesai'],
                        'jumlah_sesi' => $row['jumlah_sesi'],
                        'dosen_ids' => $row['dosen_ids'], // Pengampu (non-koordinator)
                        'koordinator_ids' => $row['koordinator_ids'] ?? [], // Koordinator (opsional)
                        'ruangan_id' => $row['ruangan_id'],
                        'use_ruangan' => $row['use_ruangan'] ?? true,
                        'topik' => $row['topik'] ?? '',
                    ];
                    $validData[] = $validRowData;
                } else {
                    $errors = array_merge($errors, $rowErrors);
                }
            }

            // Jika ada error, return semua error (all or nothing)
            if (!empty($errors)) {
                return response()->json([
                    'success' => false,
                    'total' => count($data['data']),
                    'errors' => $errors,
                    'message' => 'Gagal mengimport data. Perbaiki error terlebih dahulu.'
                ], 422);
            }

            // Jika tidak ada data valid, return error
            if (empty($validData)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tidak ada data yang valid untuk diimport'
                ], 422);
            }

            // Jika semua data valid, import semua data menggunakan database transaction (all or nothing)
            DB::beginTransaction();
            try {
                $created = [];
                foreach ($validData as $rowData) {
                    $rowData['created_by'] = auth()->id();
                    $jadwal = JadwalPersamaanPersepsi::create($rowData);

                    // Log activity
                    activity()
                        ->performedOn($jadwal)
                        ->withProperties([
                            'mata_kuliah_kode' => $kode,
                            'tanggal' => $rowData['tanggal'],
                            'jam_mulai' => $rowData['jam_mulai'],
                            'jam_selesai' => $rowData['jam_selesai'],
                            'topik' => $rowData['topik']
                        ])
                        ->log("Jadwal Persamaan Persepsi imported");

                    // Buat notifikasi untuk semua dosen yang di-assign (koordinator + pengampu)
                    $allDosenIdsForNotification = array_unique(array_merge(
                        $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : [],
                        $jadwal->dosen_ids && is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : []
                    ));

                    if (!empty($allDosenIdsForNotification)) {
                        // Load relasi untuk notifikasi (hanya load ruangan jika ada)
                        $loadRelations = ['mataKuliah'];
                        if ($jadwal->ruangan_id) {
                            $loadRelations[] = 'ruangan';
                        }
                        $jadwal->load($loadRelations);

                        foreach ($allDosenIdsForNotification as $dosenId) {
                            $dosen = User::find($dosenId);
                            if ($dosen) {
                                $ruanganNama = $jadwal->ruangan ? $jadwal->ruangan->nama : 'Online';
                                $ruanganInfo = $jadwal->use_ruangan && $jadwal->ruangan
                                    ? "di ruangan {$ruanganNama}"
                                    : "secara online";

                                Notification::create([
                                    'user_id' => $dosenId,
                                    'title' => 'Jadwal Persamaan Persepsi Baru',
                                    'message' => "Anda telah di-assign untuk Persamaan Persepsi {$jadwal->mataKuliah->nama} pada tanggal {$rowData['tanggal']} jam {$rowData['jam_mulai']}-{$rowData['jam_selesai']} {$ruanganInfo}. Silakan konfirmasi ketersediaan Anda.",
                                    'type' => 'info',
                                    'data' => [
                                        'topik' => $rowData['topik'] ?? '',
                                        'ruangan' => $ruanganNama,
                                        'tanggal' => $rowData['tanggal'],
                                        'jadwal_id' => $jadwal->id,
                                        'jam_mulai' => $rowData['jam_mulai'],
                                        'jadwal_type' => 'persamaan_persepsi',
                                        'jam_selesai' => $rowData['jam_selesai'],
                                        'mata_kuliah_kode' => $kode,
                                        'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                                        'dosen_id' => $dosen->id,
                                        'dosen_name' => $dosen->name,
                                        'dosen_role' => $dosen->role,
                                        'created_by' => auth()->user()->name ?? 'Admin',
                                        'created_by_role' => auth()->user()->role ?? 'admin',
                                        'sender_name' => auth()->user()->name ?? 'Admin',
                                        'sender_role' => auth()->user()->role ?? 'admin'
                                    ]
                                ]);
                            }
                        }
                    }

                    $created[] = $jadwal;
                }

                // Commit transaction jika semua berhasil
                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => count($created) . ' jadwal Persamaan Persepsi berhasil diimport',
                    'data' => $created
                ]);
            } catch (\Exception $e) {
                // Rollback transaction jika ada error
                DB::rollBack();
                Log::error('Error importing Persamaan Persepsi: ' . $e->getMessage());
                return response()->json([
                    'success' => false,
                    'message' => 'Terjadi kesalahan saat mengimport data: ' . $e->getMessage()
                ], 500);
            }
        } catch (\Exception $e) {
            Log::error('Error importing Persamaan Persepsi: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan saat mengimport data: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Helper method untuk mengecek apakah dua data bentrok
     */
    private function isDataBentrok($data1, $data2): bool
    {
        // Cek apakah tanggal sama
        if ($data1['tanggal'] !== $data2['tanggal']) {
            return false;
        }

        // Cek apakah jam bentrok
        $jamMulai1 = $data1['jam_mulai'];
        $jamSelesai1 = $data1['jam_selesai'];
        $jamMulai2 = $data2['jam_mulai'];
        $jamSelesai2 = $data2['jam_selesai'];

        // Cek apakah jam bentrok
        $jamBentrok = ($jamMulai1 < $jamSelesai2 && $jamSelesai1 > $jamMulai2);

        if (!$jamBentrok) {
            return false;
        }

        // Cek bentrok dosen (multi-select)
        $dosenBentrok = false;
        if (
            isset($data1['dosen_ids']) && is_array($data1['dosen_ids']) &&
            isset($data2['dosen_ids']) && is_array($data2['dosen_ids'])
        ) {
            $intersectingDosen = array_intersect($data1['dosen_ids'], $data2['dosen_ids']);
            if (!empty($intersectingDosen)) {
                $dosenBentrok = true;
            }
        }

        // Cek bentrok ruangan
        $ruanganBentrok = false;
        if (
            isset($data1['ruangan_id']) && isset($data2['ruangan_id']) &&
            $data1['ruangan_id'] == $data2['ruangan_id']
        ) {
            $ruanganBentrok = true;
        }

        // Jika bentrok dosen ATAU bentrok ruangan, maka ada bentrok
        return $dosenBentrok || $ruanganBentrok;
    }

    /**
     * Validasi bentrok dengan detail
     */
    private function checkBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Jika tidak menggunakan ruangan, hanya cek bentrok berdasarkan dosen
        $useRuangan = isset($data['use_ruangan']) ? $data['use_ruangan'] : true;

        // Ambil data mata kuliah untuk mendapatkan semester
        $mataKuliah = \App\Models\MataKuliah::where('kode', $data['mata_kuliah_kode'])->first();
        $semester = $mataKuliah ? $mataKuliah->semester : null;

        // Cek bentrok dengan jadwal Persamaan Persepsi lain
        $persepsiQuery = JadwalPersamaanPersepsi::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data, $useRuangan) {
                // Cek bentrok ruangan hanya jika menggunakan ruangan
                if ($useRuangan && isset($data['ruangan_id']) && $data['ruangan_id']) {
                    $q->where('ruangan_id', $data['ruangan_id']);
                }

                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    // Cek apakah ada dosen yang sama dengan jadwal lain
                    $q->where(function ($subQ) use ($data) {
                        foreach ($data['dosen_ids'] as $dosenId) {
                            $subQ->orWhereJsonContains('dosen_ids', $dosenId);
                        }
                    });
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $persepsiQuery->where('id', '!=', $ignoreId);
        }

        $persepsiBentrok = $persepsiQuery->first();
        if ($persepsiBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $persepsiBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $persepsiBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $persepsiBentrok);
            return "Jadwal bentrok dengan Jadwal Persamaan Persepsi lain pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal PBL (dengan filter semester)
        $pblQuery = \App\Models\JadwalPBL::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data, $useRuangan) {
                // Cek bentrok ruangan hanya jika menggunakan ruangan
                if ($useRuangan && isset($data['ruangan_id']) && $data['ruangan_id']) {
                    $q->where('ruangan_id', $data['ruangan_id']);
                }

                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->orWhereIn('dosen_id', $data['dosen_ids']);

                    // Cek jika jadwal PBL juga menggunakan multiple dosen
                    $q->orWhere(function ($subQ) use ($data) {
                        foreach ($data['dosen_ids'] as $dosenId) {
                            $subQ->orWhereJsonContains('dosen_ids', $dosenId);
                        }
                    });
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        $pblBentrok = $pblQuery->first();
        if ($pblBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $pblBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $pblBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $pblBentrok);
            return "Jadwal bentrok dengan Jadwal PBL pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Jurnal Reading (dengan filter semester)
        $jurnalQuery = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data, $useRuangan) {
                // Cek bentrok ruangan hanya jika menggunakan ruangan
                if ($useRuangan && isset($data['ruangan_id']) && $data['ruangan_id']) {
                    $q->where('ruangan_id', $data['ruangan_id']);
                }

                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->orWhereIn('dosen_id', $data['dosen_ids']);

                    // Cek jika jadwal Jurnal juga menggunakan multiple dosen
                    $q->orWhere(function ($subQ) use ($data) {
                        foreach ($data['dosen_ids'] as $dosenId) {
                            $subQ->orWhereJsonContains('dosen_ids', $dosenId);
                        }
                    });
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        $jurnalBentrok = $jurnalQuery->first();
        if ($jurnalBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $jurnalBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jurnalBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $jurnalBentrok);
            return "Jadwal bentrok dengan Jadwal Jurnal Reading pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Kuliah Besar (dengan filter semester)
        $kuliahBesarQuery = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data, $useRuangan) {
                // Cek bentrok ruangan hanya jika menggunakan ruangan
                if ($useRuangan && isset($data['ruangan_id']) && $data['ruangan_id']) {
                    $q->where('ruangan_id', $data['ruangan_id']);
                }

                // Cek bentrok dosen (single dosen_id)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->orWhereIn('dosen_id', $data['dosen_ids']);

                    // Cek jika jadwal Kuliah Besar juga menggunakan multiple dosen
                    $q->orWhere(function ($subQ) use ($data) {
                        foreach ($data['dosen_ids'] as $dosenId) {
                            $subQ->orWhereJsonContains('dosen_ids', $dosenId);
                        }
                    });
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        $kuliahBesarBentrok = $kuliahBesarQuery->first();
        if ($kuliahBesarBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $kuliahBesarBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $kuliahBesarBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $kuliahBesarBentrok);
            return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Agenda Khusus (dengan filter semester)
        $agendaKhususQuery = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            });

        // Cek bentrok ruangan hanya jika menggunakan ruangan
        if ($useRuangan && isset($data['ruangan_id']) && $data['ruangan_id']) {
            $agendaKhususQuery->where('ruangan_id', $data['ruangan_id']);
        }

        $agendaKhususBentrok = $agendaKhususQuery
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($agendaKhususBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $agendaKhususBentrok);
            return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Praktikum (dengan filter semester)
        $praktikumBentrok = \App\Models\JadwalPraktikum::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->where(function ($q) use ($data) {
                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->whereExists(function ($subQ) use ($data) {
                        $subQ->select(DB::raw(1))
                            ->from('jadwal_praktikum_dosen')
                            ->whereColumn('jadwal_praktikum_dosen.jadwal_praktikum_id', 'jadwal_praktikum.id')
                            ->whereIn('jadwal_praktikum_dosen.dosen_id', $data['dosen_ids']);
                    });
                }
            })
            ->first();

        if ($praktikumBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $praktikumBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $praktikumBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $praktikumBentrok);
            return "Jadwal bentrok dengan Jadwal Praktikum pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        return null; // Tidak ada bentrok
    }

    /**
     * Mendapatkan alasan bentrok yang detail
     */
    private function getBentrokReason($data, $jadwalBentrok): string
    {
        $reasons = [];

        // Cek bentrok dosen (multiple dosen_ids)
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
            $otherDosenIds = [];

            // Handle different models that might have dosen_ids
            if (isset($jadwalBentrok->dosen_ids)) {
                $otherDosenIds = is_array($jadwalBentrok->dosen_ids)
                    ? $jadwalBentrok->dosen_ids
                    : (is_string($jadwalBentrok->dosen_ids) ? json_decode($jadwalBentrok->dosen_ids, true) : []);
            } elseif (isset($jadwalBentrok->dosen_id)) {
                $otherDosenIds = [$jadwalBentrok->dosen_id];
            } elseif (method_exists($jadwalBentrok, 'dosen') && $jadwalBentrok->dosen) {
                // For models with relationship
                if (is_array($jadwalBentrok->dosen)) {
                    $otherDosenIds = array_map(function ($d) {
                        return is_object($d) ? $d->id : $d;
                    }, $jadwalBentrok->dosen);
                } elseif ($jadwalBentrok->dosen instanceof Collection) {
                    // Handle collection (hasMany, belongsToMany)
                    $otherDosenIds = $jadwalBentrok->dosen->pluck('id')->toArray();
                } else {
                    // Single model (belongsTo)
                    $otherDosenIds = [$jadwalBentrok->dosen->id];
                }
            }

            if (!empty($otherDosenIds)) {
                $intersectingDosenIds = array_intersect($data['dosen_ids'], $otherDosenIds);
                if (!empty($intersectingDosenIds)) {
                    $dosenNames = User::whereIn('id', $intersectingDosenIds)->pluck('name')->toArray();
                    $reasons[] = "Dosen: " . implode(', ', $dosenNames);
                }
            }
        }

        // Cek bentrok ruangan (hanya jika menggunakan ruangan)
        if (
            isset($data['ruangan_id']) && $data['ruangan_id'] &&
            isset($jadwalBentrok->ruangan_id) && $jadwalBentrok->ruangan_id &&
            $data['ruangan_id'] == $jadwalBentrok->ruangan_id
        ) {
            $ruangan = Ruangan::find($data['ruangan_id']);
            $reasons[] = "Ruangan: " . ($ruangan ? $ruangan->nama : 'Tidak diketahui');
        }

        // Fallback: jika belum ada alasan spesifik
        if (empty($reasons)) {
            $reasons[] = "Konflik jadwal";
        }

        return implode(', ', $reasons);
    }

    /**
     * Validasi kapasitas ruangan berdasarkan jumlah dosen (tidak ada kelompok)
     */
    private function validateRuanganCapacity($data)
    {
        // Ambil data ruangan
        $ruangan = Ruangan::find($data['ruangan_id']);
        if (!$ruangan) {
            return 'Ruangan tidak ditemukan';
        }

        // Hitung jumlah dosen
        $jumlahDosen = 0;
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids'])) {
            $jumlahDosen = count($data['dosen_ids']);
        }

        if ($jumlahDosen == 0) {
            return 'Minimal 1 dosen harus dipilih';
        }

        // Cek apakah kapasitas ruangan mencukupi (hanya mempertimbangkan jumlah dosen)
        if ($jumlahDosen > $ruangan->kapasitas) {
            return "Kapasitas ruangan tidak mencukupi. Ruangan {$ruangan->nama} hanya dapat menampung {$ruangan->kapasitas} orang, sedangkan diperlukan {$jumlahDosen} dosen.";
        }

        return null; // Kapasitas mencukupi
    }

    /**
     * Get jadwal Persamaan Persepsi for specific dosen
     */
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
            Log::info("Getting jadwal persamaan persepsi for dosen ID: {$dosenId}, semester_type: {$semesterType}");

            // PENTING: Query harus mengambil jadwal dimana:
            // 1. $dosenId ada di koordinator_ids (dosen aktif sebagai koordinator)
            // 2. ATAU $dosenId ada di dosen_ids (dosen aktif sebagai pengampu atau dosen lama/history)
            // Filter semester_type harus diterapkan ke kedua kondisi
            $rawJadwal = DB::table('jadwal_persamaan_persepsi')
                ->join('mata_kuliah', 'jadwal_persamaan_persepsi.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                ->where(function ($q) use ($dosenId, $semesterType) {
                    // Kondisi 1: Dosen aktif sebagai koordinator ($dosenId ada di koordinator_ids)
                    $q->whereNotNull('jadwal_persamaan_persepsi.koordinator_ids')
                        ->where(function ($subQ) use ($dosenId) {
                            $subQ->whereRaw('JSON_CONTAINS(jadwal_persamaan_persepsi.koordinator_ids, ?)', [json_encode($dosenId)])
                                ->orWhereRaw('JSON_SEARCH(jadwal_persamaan_persepsi.koordinator_ids, "one", ?) IS NOT NULL', [$dosenId])
                                ->orWhereRaw('CAST(jadwal_persamaan_persepsi.koordinator_ids AS CHAR) LIKE ?', ['%"' . $dosenId . '"%'])
                                ->orWhereRaw('CAST(jadwal_persamaan_persepsi.koordinator_ids AS CHAR) LIKE ?', ['%' . $dosenId . '%']);
                        });

                    // Filter semester_type untuk kondisi 1
                    if ($semesterType && $semesterType !== 'all') {
                        if ($semesterType === 'antara') {
                            $q->where('mata_kuliah.semester', 'Antara');
                        } elseif ($semesterType === 'reguler') {
                            $q->where('mata_kuliah.semester', '!=', 'Antara');
                        }
                    }
                })
                ->orWhere(function ($q) use ($dosenId, $semesterType) {
                    // Kondisi 2: Dosen aktif sebagai pengampu atau dosen lama/history ($dosenId ada di dosen_ids)
                    $q->whereNotNull('jadwal_persamaan_persepsi.dosen_ids')
                        ->where(function ($subQ) use ($dosenId) {
                            $subQ->whereRaw('JSON_CONTAINS(jadwal_persamaan_persepsi.dosen_ids, ?)', [json_encode($dosenId)])
                                ->orWhereRaw('JSON_SEARCH(jadwal_persamaan_persepsi.dosen_ids, "one", ?) IS NOT NULL', [$dosenId])
                                ->orWhereRaw('CAST(jadwal_persamaan_persepsi.dosen_ids AS CHAR) LIKE ?', ['%"' . $dosenId . '"%'])
                                ->orWhereRaw('CAST(jadwal_persamaan_persepsi.dosen_ids AS CHAR) LIKE ?', ['%' . $dosenId . '%']);
                        });

                    // Filter semester_type untuk kondisi 2
                    if ($semesterType && $semesterType !== 'all') {
                        if ($semesterType === 'antara') {
                            $q->where('mata_kuliah.semester', 'Antara');
                        } elseif ($semesterType === 'reguler') {
                            $q->where('mata_kuliah.semester', '!=', 'Antara');
                        }
                    }
                })
                ->select('jadwal_persamaan_persepsi.*')
                ->orderBy('jadwal_persamaan_persepsi.tanggal')
                ->orderBy('jadwal_persamaan_persepsi.jam_mulai')
                ->get();

            Log::info("Raw query found {$rawJadwal->count()} records for dosen ID: {$dosenId}");

            // Convert to Eloquent models for relationships
            $jadwal = JadwalPersamaanPersepsi::with([
                'mataKuliah:kode,nama,semester',
                'ruangan:id,nama,gedung'
            ])
                ->whereIn('id', $rawJadwal->pluck('id'))
                ->get();

            Log::info("Found {$jadwal->count()} JadwalPersamaanPersepsi records for dosen ID: {$dosenId}");

            if ($jadwal->count() === 0) {
                Log::warning("No jadwal found for dosen ID: {$dosenId}");
                return response()->json([
                    'message' => 'Tidak ada jadwal Persamaan Persepsi untuk dosen ini',
                    'data' => []
                ]);
            }

            $mappedJadwal = $jadwal->map(function ($jadwal) use ($dosenId) {
                // Parse koordinator_ids dan dosen_ids jika ada
                $koordinatorIds = [];
                if ($jadwal->koordinator_ids) {
                    $koordinatorIds = is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : json_decode($jadwal->koordinator_ids, true);
                    if (!is_array($koordinatorIds)) {
                        $koordinatorIds = [];
                    }
                }

                $dosenIds = [];
                if ($jadwal->dosen_ids) {
                    $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
                    if (!is_array($dosenIds)) {
                        $dosenIds = [];
                    }
                }

                // PENTING: Tentukan apakah dosen ini adalah dosen aktif (ada di koordinator_ids atau dosen_ids) atau hanya ada di history
                $isActiveDosen = in_array($dosenId, $koordinatorIds) || in_array($dosenId, $dosenIds);
                $isInHistory = false;
                // Untuk persamaan persepsi, jika dosen tidak aktif, berarti hanya ada di history
                if (!$isActiveDosen && (!empty($koordinatorIds) || !empty($dosenIds))) {
                    // Cek apakah dosen ini pernah ada di history (sudah diganti)
                    // Untuk sekarang, kita anggap jika tidak aktif, berarti di history
                    $isInHistory = true;
                }

                // Untuk Persamaan Persepsi, status_konfirmasi selalu 'bisa' (tidak perlu konfirmasi)
                // Tidak peduli apakah dosen aktif atau di history
                $statusKonfirmasi = 'bisa';

                // Determine semester type based on mata_kuliah semester
                $semesterType = 'reguler';
                if ($jadwal->mataKuliah && $jadwal->mataKuliah->semester === 'Antara') {
                    $semesterType = 'antara';
                }

                // Get koordinator and pengampu names
                $koordinatorList = !empty($koordinatorIds) ? User::whereIn('id', $koordinatorIds)->get() : collect([]);
                $pengampuIds = array_diff($dosenIds, $koordinatorIds);
                $pengampuList = !empty($pengampuIds) ? User::whereIn('id', $pengampuIds)->get() : collect([]);

                $koordinatorNames = $koordinatorList->pluck('name')->toArray();
                $pengampuNames = $pengampuList->pluck('name')->toArray();

                return (object) [
                    'id' => $jadwal->id,
                    'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                    'mata_kuliah_nama' => $jadwal->mataKuliah->nama ?? 'Unknown',
                    'tanggal' => $jadwal->tanggal,
                    'jam_mulai' => $jadwal->jam_mulai,
                    'jam_selesai' => $jadwal->jam_selesai,
                    'topik' => $jadwal->topik,
                    'ruangan' => (object) [
                        'id' => $jadwal->ruangan_id ?? null,
                        'nama' => $jadwal->ruangan ? $jadwal->ruangan->nama : ($jadwal->use_ruangan ? 'Unknown' : 'Online')
                    ],
                    'status_konfirmasi' => $statusKonfirmasi,
                    'alasan_konfirmasi' => $jadwal->alasan_konfirmasi ?? null,
                    'status_reschedule' => $jadwal->status_reschedule ?? null,
                    'reschedule_reason' => $jadwal->reschedule_reason ?? null,
                    'dosen_ids' => $dosenIds,
                    'koordinator_ids' => $koordinatorIds,
                    'koordinator_names' => implode(', ', $koordinatorNames),
                    'pengampu_names' => implode(', ', $pengampuNames),
                    'is_active_dosen' => $isActiveDosen,
                    'is_in_history' => $isInHistory,
                    'jumlah_sesi' => $jadwal->jumlah_sesi ?? 1,
                    'semester_type' => $semesterType,
                    'created_at' => $jadwal->created_at,
                ];
            });

            return response()->json([
                'message' => 'Data jadwal Persamaan Persepsi berhasil diambil',
                'data' => $mappedJadwal,
                'count' => $mappedJadwal->count()
            ]);
        } catch (\Exception $e) {
            Log::error("Error getting jadwal persamaan persepsi for dosen: " . $e->getMessage());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengambil data jadwal',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Konfirmasi ketersediaan dosen untuk jadwal Persamaan Persepsi
     */
    public function konfirmasi(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:bisa,tidak_bisa',
            'alasan' => 'nullable|string|max:1000',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $jadwal = JadwalPersamaanPersepsi::with(['mataKuliah', 'ruangan'])->findOrFail($id);

        // Parse koordinator_ids dan dosen_ids
        $koordinatorIds = $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : [];
        $dosenIds = $jadwal->dosen_ids && is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : [];

        // Check if dosen is assigned to this jadwal (either as koordinator or pengampu)
        $isAssigned = in_array($request->dosen_id, $koordinatorIds) || in_array($request->dosen_id, $dosenIds);

        if (!$isAssigned) {
            return response()->json([
                'message' => 'Anda tidak memiliki akses untuk mengkonfirmasi jadwal ini'
            ], 403);
        }

        $jadwal->update([
            'status_konfirmasi' => $request->status,
            'alasan_konfirmasi' => $request->alasan
        ]);

        // Get dosen info
        $dosen = User::find($request->dosen_id);

        // Send notification
        if ($request->status === 'tidak_bisa') {
            $this->sendReplacementNotification($jadwal, $request->dosen_id, $request->alasan);
        } elseif ($request->status === 'bisa') {
            $this->sendConfirmationNotification($jadwal, 'bisa', $dosen);
        }

        return response()->json([
            'message' => 'Konfirmasi berhasil disimpan',
            'status' => $request->status
        ]);
    }

    /**
     * Ajukan reschedule jadwal Persamaan Persepsi
     */
    public function reschedule(Request $request, $id)
    {
        $request->validate([
            'reschedule_reason' => 'required|string|max:1000',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $jadwal = JadwalPersamaanPersepsi::with(['mataKuliah', 'ruangan'])->findOrFail($id);

        // Parse koordinator_ids dan dosen_ids
        $koordinatorIds = $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : [];
        $dosenIds = $jadwal->dosen_ids && is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : [];

        // Check if dosen is assigned to this jadwal (either as koordinator or pengampu)
        $isAssigned = in_array($request->dosen_id, $koordinatorIds) || in_array($request->dosen_id, $dosenIds);

        if (!$isAssigned) {
            return response()->json([
                'message' => 'Anda tidak memiliki akses untuk mengajukan reschedule jadwal ini'
            ], 403);
        }

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
     * Kirim notifikasi replacement ke admin
     */
    private function sendReplacementNotification($jadwal, $dosenId, $alasan)
    {
        try {
            $dosen = User::find($dosenId);
            $mataKuliah = $jadwal->mataKuliah;

            if (!$dosen || !$mataKuliah) {
                return;
            }

            $adminUsers = User::whereIn('role', ['super_admin', 'admin', 'tim_akademik'])->get();

            foreach ($adminUsers as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'type' => 'warning',
                    'title' => 'Dosen Tidak Bisa - Persamaan Persepsi',
                    'message' => "Dosen {$dosen->name} tidak bisa mengajar pada jadwal Persamaan Persepsi mata kuliah {$mataKuliah->nama} pada " . date('d/m/Y', strtotime($jadwal->tanggal)) . " jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai}. Alasan: {$alasan}",
                    'data' => [
                        'jadwal_type' => 'persamaan_persepsi',
                        'jadwal_id' => $jadwal->id,
                        'dosen_id' => $dosenId,
                        'dosen_name' => $dosen->name,
                        'mata_kuliah_kode' => $mataKuliah->kode,
                        'mata_kuliah_nama' => $mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal,
                        'jam_mulai' => $jadwal->jam_mulai,
                        'jam_selesai' => $jadwal->jam_selesai,
                        'alasan' => $alasan
                    ]
                ]);
            }

            Log::info("Replacement notification sent for Persamaan Persepsi jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            Log::error("Error sending replacement notification: " . $e->getMessage());
        }
    }

    /**
     * Kirim notifikasi konfirmasi
     */
    private function sendConfirmationNotification($jadwal, $status, $dosen)
    {
        try {
            $mataKuliah = $jadwal->mataKuliah;

            if (!$dosen || !$mataKuliah) {
                return;
            }

            $adminUsers = User::whereIn('role', ['super_admin', 'admin', 'tim_akademik'])->get();

            foreach ($adminUsers as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'type' => 'success',
                    'title' => 'Konfirmasi Persamaan Persepsi',
                    'message' => "Dosen {$dosen->name} mengkonfirmasi bisa mengajar pada jadwal Persamaan Persepsi mata kuliah {$mataKuliah->nama} pada " . date('d/m/Y', strtotime($jadwal->tanggal)) . " jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai}.",
                    'data' => [
                        'jadwal_type' => 'persamaan_persepsi',
                        'jadwal_id' => $jadwal->id,
                        'dosen_id' => $dosen->id,
                        'dosen_name' => $dosen->name,
                        'mata_kuliah_kode' => $mataKuliah->kode,
                        'mata_kuliah_nama' => $mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal,
                        'jam_mulai' => $jadwal->jam_mulai,
                        'jam_selesai' => $jadwal->jam_selesai,
                        'status' => $status
                    ]
                ]);
            }

            Log::info("Confirmation notification sent for Persamaan Persepsi jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            Log::error("Error sending confirmation notification: " . $e->getMessage());
        }
    }

    /**
     * Kirim notifikasi reschedule ke admin
     */
    private function sendRescheduleNotification($jadwal, $reason)
    {
        try {
            $mataKuliah = $jadwal->mataKuliah;

            if (!$mataKuliah) {
                return;
            }

            // Get dosen yang mengajukan reschedule (from koordinator_ids or dosen_ids)
            $koordinatorIds = $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : [];
            $dosenIds = $jadwal->dosen_ids && is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : [];
            $allDosenIds = array_unique(array_merge($koordinatorIds, $dosenIds));
            $dosenList = !empty($allDosenIds) ? User::whereIn('id', $allDosenIds)->get() : collect([]);
            $dosenNames = $dosenList->pluck('name')->toArray();

            $adminUsers = User::whereIn('role', ['super_admin', 'admin', 'tim_akademik'])->get();

            foreach ($adminUsers as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'type' => 'warning',
                    'title' => 'Permintaan Reschedule - Persamaan Persepsi',
                    'message' => "Dosen " . implode(', ', $dosenNames) . " mengajukan reschedule untuk jadwal Persamaan Persepsi mata kuliah {$mataKuliah->nama} pada " . date('d/m/Y', strtotime($jadwal->tanggal)) . " jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai}. Alasan: {$reason}",
                    'data' => [
                        'jadwal_type' => 'persamaan_persepsi',
                        'jadwal_id' => $jadwal->id,
                        'mata_kuliah_kode' => $mataKuliah->kode,
                        'mata_kuliah_nama' => $mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal,
                        'jam_mulai' => $jadwal->jam_mulai,
                        'jam_selesai' => $jadwal->jam_selesai,
                        'reschedule_reason' => $reason
                    ]
                ]);
            }

            Log::info("Reschedule notification sent for Persamaan Persepsi jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            Log::error("Error sending reschedule notification: " . $e->getMessage());
        }
    }

    /**
     * Helper to get display text for peran
     */
    private function getPeranDisplay($tipePeran)
    {
        switch ($tipePeran) {
            case 'koordinator':
                return 'Koordinator';
            case 'tim_blok':
                return 'Tim Blok';
            case 'mengajar':
                return 'Dosen Mengajar';
            default:
                return 'Dosen Mengajar';
        }
    }

    /**
     * Get absensi untuk jadwal Persamaan Persepsi tertentu
     */
    public function getAbsensi($kode, $jadwalId)
    {
        try {
            // Verifikasi bahwa jadwal ini ada dan milik mata kuliah yang benar
            $jadwal = JadwalPersamaanPersepsi::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Cek apakah user adalah koordinator
            $user = auth()->user();
            $koordinatorIds = $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : [];

            if (!in_array($user->id, $koordinatorIds)) {
                return response()->json(['message' => 'Anda tidak memiliki akses untuk melihat absensi ini'], 403);
            }

            // Ambil data absensi yang sudah ada
            $absensi = AbsensiPersamaanPersepsi::where('jadwal_persamaan_persepsi_id', $jadwalId)
                ->get()
                ->keyBy('dosen_id');

            // Ambil informasi apakah sudah submitted
            $penilaianSubmitted = $jadwal->penilaian_submitted ?? false;

            return response()->json([
                'absensi' => $absensi,
                'penilaian_submitted' => $penilaianSubmitted,
                'report_submitted' => $penilaianSubmitted,
                'submitted' => $penilaianSubmitted,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal memuat data absensi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Store absensi untuk jadwal Persamaan Persepsi tertentu
     */
    public function storeAbsensi(Request $request, $kode, $jadwalId)
    {
        try {
            // Verifikasi bahwa jadwal ini ada dan milik mata kuliah yang benar
            $jadwal = JadwalPersamaanPersepsi::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Cek apakah user adalah koordinator
            $user = auth()->user();
            $koordinatorIds = $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : [];

            if (!in_array($user->id, $koordinatorIds)) {
                return response()->json(['message' => 'Anda tidak memiliki akses untuk menyimpan absensi ini'], 403);
            }

            $request->validate([
                'absensi' => 'required|array',
                'absensi.*.dosen_id' => 'required|integer|exists:users,id',
                'absensi.*.hadir' => 'required|boolean',
                'absensi.*.catatan' => 'nullable|string',
                'penilaian_submitted' => 'nullable|boolean',
            ]);

            // Update jadwal Persamaan Persepsi dengan status penilaian_submitted
            if ($request->has('penilaian_submitted')) {
                $jadwal->update([
                    'penilaian_submitted' => $request->penilaian_submitted
                ]);
            }

            // Hapus data absensi yang lama
            AbsensiPersamaanPersepsi::where('jadwal_persamaan_persepsi_id', $jadwalId)->delete();

            // Simpan data absensi baru
            foreach ($request->absensi as $absen) {
                AbsensiPersamaanPersepsi::create([
                    'jadwal_persamaan_persepsi_id' => $jadwalId,
                    'dosen_id' => $absen['dosen_id'],
                    'hadir' => $absen['hadir'],
                    'catatan' => $absen['catatan'] ?? '',
                ]);
            }

            return response()->json(['message' => 'Absensi berhasil disimpan']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal menyimpan absensi: ' . $e->getMessage()], 500);
        }
    }
}
