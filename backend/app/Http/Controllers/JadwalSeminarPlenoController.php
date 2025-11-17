<?php

namespace App\Http\Controllers;

use App\Models\JadwalSeminarPleno;
use App\Models\User;
use App\Models\Ruangan;
use App\Models\Notification;
use App\Models\AbsensiSeminarPleno;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\Collection;
use App\Models\KelompokBesar;
use App\Models\KelompokBesarAntara;

class JadwalSeminarPlenoController extends Controller
{
    // List semua jadwal Seminar Pleno untuk satu mata kuliah blok
    public function index($kode)
    {
        $jadwal = JadwalSeminarPleno::with(['ruangan', 'mataKuliah', 'kelompokBesar', 'kelompokBesarAntara'])
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

            // Ensure kelompok_besar_id and kelompok_besar_antara_id are included
            $j->kelompok_besar_id = $j->kelompok_besar_id ?? null;
            $j->kelompok_besar_antara_id = $j->kelompok_besar_antara_id ?? null;

            // Set kelompok_besar object if relasi exists
            if ($j->kelompokBesar) {
                $j->kelompok_besar = (object) [
                    'id' => $j->kelompokBesar->id,
                    'semester' => $j->kelompokBesar->semester,
                ];
            } else {
                $j->kelompok_besar = null;
            }

            // Set kelompok_besar_antara object if relasi exists
            if ($j->kelompokBesarAntara) {
                $j->kelompok_besar_antara = (object) [
                    'id' => $j->kelompokBesarAntara->id,
                    'nama_kelompok' => $j->kelompokBesarAntara->nama_kelompok,
                ];
            } else {
                $j->kelompok_besar_antara = null;
            }
        }

        return response()->json($jadwal);
    }

    // Tambah jadwal Seminar Pleno baru
    public function store(Request $request, $kode)
    {
        $data = $request->validate([
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
            'dosen_ids' => 'required|array|min:1', // Pengampu (non-koordinator)
            'dosen_ids.*' => 'exists:users,id',
            'koordinator_ids' => 'nullable|array|max:1', // Koordinator (opsional, maksimal 1)
            'koordinator_ids.*' => 'exists:users,id',
            'ruangan_id' => 'nullable|exists:ruangan,id',
            'use_ruangan' => 'required|boolean',
            'topik' => 'nullable|string',
            'kelompok_besar_id' => 'nullable|exists:kelompok_besar,id',
            'kelompok_besar_antara_id' => 'nullable|exists:kelompok_besar_antara,id',
        ]);

        // Gabungkan koordinator_ids dan dosen_ids untuk validasi kapasitas dan bentrok
        $koordinatorIds = $data['koordinator_ids'] ?? [];
        $pengampuIds = $data['dosen_ids'] ?? [];

        // Validasi: Koordinator hanya boleh 1 orang untuk Seminar Pleno
        if (count($koordinatorIds) > 1) {
            return response()->json([
                'message' => 'Koordinator Seminar Pleno hanya boleh 1 orang'
            ], 422);
        }

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
        $data['created_by'] = $request->input('created_by', Auth::id());

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

        // Set status_konfirmasi otomatis menjadi 'bisa' untuk Seminar Pleno (tidak perlu konfirmasi)
        $data['status_konfirmasi'] = 'bisa';

        $jadwal = JadwalSeminarPleno::create($data);

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
            ->log("Jadwal Seminar Pleno created");

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

                    Notification::create([
                        'user_id' => $dosenId,
                        'title' => 'Jadwal Seminar Pleno Baru',
                        'message' => "Anda telah di-assign untuk Seminar Pleno {$jadwal->mataKuliah->nama} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} {$ruanganInfo}. Silakan konfirmasi ketersediaan Anda.",
                        'type' => 'info',
                        'data' => [
                            'topik' => $jadwal->topik,
                            'ruangan' => $ruanganNama,
                            'tanggal' => $jadwal->tanggal,
                            'jadwal_id' => $jadwal->id,
                            'jam_mulai' => $jadwal->jam_mulai,
                            'jadwal_type' => 'seminar_pleno',
                            'jam_selesai' => $jadwal->jam_selesai,
                            'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                            'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
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
        }

        return response()->json($jadwal, Response::HTTP_CREATED);
    }

    // Update jadwal Seminar Pleno
    public function update(Request $request, $kode, $id)
    {
        $jadwal = JadwalSeminarPleno::findOrFail($id);

        $data = $request->validate([
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
            'dosen_ids' => 'required|array|min:1', // Pengampu (non-koordinator)
            'dosen_ids.*' => 'exists:users,id',
            'koordinator_ids' => 'nullable|array|max:1', // Koordinator (opsional, maksimal 1)
            'koordinator_ids.*' => 'exists:users,id',
            'ruangan_id' => 'nullable|exists:ruangan,id',
            'use_ruangan' => 'required|boolean',
            'topik' => 'nullable|string',
            'kelompok_besar_id' => 'nullable|exists:kelompok_besar,id',
            'kelompok_besar_antara_id' => 'nullable|exists:kelompok_besar_antara,id',
        ]);

        // Gabungkan koordinator_ids dan dosen_ids untuk validasi kapasitas dan bentrok
        $koordinatorIds = $data['koordinator_ids'] ?? [];
        $pengampuIds = $data['dosen_ids'] ?? [];

        // Validasi: Koordinator hanya boleh 1 orang untuk Seminar Pleno
        if (count($koordinatorIds) > 1) {
            return response()->json([
                'message' => 'Koordinator Seminar Pleno hanya boleh 1 orang'
            ], 422);
        }

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

        // Set status_konfirmasi otomatis menjadi 'bisa' untuk Seminar Pleno (tidak perlu konfirmasi)
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
            ->log("Jadwal Seminar Pleno updated");

        // Load relasi
        $jadwal->load(['ruangan', 'mataKuliah']);

        // Tambahkan nama dosen untuk response
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
            $jadwal->dosen_names = implode(', ', $dosenNames);
        }

        return response()->json($jadwal);
    }

    // Hapus jadwal Seminar Pleno
    public function destroy($kode, $id)
    {
        $jadwal = JadwalSeminarPleno::findOrFail($id);

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
            ->log("Jadwal Seminar Pleno deleted");

        $jadwal->delete();
        return response()->json(['message' => 'Jadwal Seminar Pleno berhasil dihapus']);
    }

    /**
     * Import multiple jadwal Seminar Pleno
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
                'data.*.koordinator_ids' => 'nullable|array|max:1', // Koordinator (opsional, maksimal 1)
                'data.*.koordinator_ids.*' => 'exists:users,id',
                'data.*.ruangan_id' => 'nullable|integer|min:1',
                'data.*.use_ruangan' => 'required|boolean',
                'data.*.topik' => 'nullable|string',
                'data.*.kelompok_besar_id' => 'nullable|integer', // Bisa berupa ID atau semester
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
                // Validasi koordinator hanya boleh 1 orang untuk Seminar Pleno
                if (count($koordinatorIds) > 1) {
                    $rowErrors[] = "Baris " . ($index + 1) . ": Koordinator Seminar Pleno hanya boleh 1 orang";
                }
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
                    // Handle kelompok_besar_id: bisa berupa ID atau semester
                    $kelompokBesarId = null;
                    if (isset($row['kelompok_besar_id']) && $row['kelompok_besar_id'] !== null) {
                        $inputKelompokBesarId = $row['kelompok_besar_id'];

                        // Cek apakah ini ID sebenarnya (cek di database)
                        $kelompokBesarById = KelompokBesar::find($inputKelompokBesarId);
                        if ($kelompokBesarById) {
                            // Jika ditemukan sebagai ID, gunakan ID tersebut
                            $kelompokBesarId = $kelompokBesarById->id;
                        } else {
                            // Jika tidak ditemukan sebagai ID, coba sebagai semester
                            $kelompokBesarBySemester = KelompokBesar::where('semester', $inputKelompokBesarId)->first();
                            if ($kelompokBesarBySemester) {
                                // Ambil ID pertama dari semester tersebut
                                $kelompokBesarId = $kelompokBesarBySemester->id;
                            }
                            // Jika tidak ditemukan juga, biarkan null (opsional)
                        }
                    }

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
                        'kelompok_besar_id' => $kelompokBesarId,
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
                    $rowData['created_by'] = Auth::id();
                    $jadwal = JadwalSeminarPleno::create($rowData);

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
                        ->log("Jadwal Seminar Pleno imported");

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
                                    'title' => 'Jadwal Seminar Pleno Baru',
                                    'message' => "Anda telah di-assign untuk Seminar Pleno {$jadwal->mataKuliah->nama} pada tanggal {$rowData['tanggal']} jam {$rowData['jam_mulai']}-{$rowData['jam_selesai']} {$ruanganInfo}. Silakan konfirmasi ketersediaan Anda.",
                                    'type' => 'info',
                                    'data' => [
                                        'topik' => $rowData['topik'] ?? '',
                                        'ruangan' => $ruanganNama,
                                        'tanggal' => $rowData['tanggal'],
                                        'jadwal_id' => $jadwal->id,
                                        'jam_mulai' => $rowData['jam_mulai'],
                                        'jadwal_type' => 'seminar_pleno',
                                        'jam_selesai' => $rowData['jam_selesai'],
                                        'mata_kuliah_kode' => $kode,
                                        'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
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
                    }

                    $created[] = $jadwal;
                }

                // Commit transaction jika semua berhasil
                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => count($created) . ' jadwal Seminar Pleno berhasil diimport',
                    'data' => $created
                ]);
            } catch (\Exception $e) {
                // Rollback transaction jika ada error
                DB::rollBack();
                Log::error('Error importing Seminar Pleno: ' . $e->getMessage());
                return response()->json([
                    'success' => false,
                    'message' => 'Terjadi kesalahan saat mengimport data: ' . $e->getMessage()
                ], 500);
            }
        } catch (\Exception $e) {
            Log::error('Error importing Seminar Pleno: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan saat mengimport data: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Validasi preview data import (tanpa menyimpan ke database)
     */
    public function validatePreview(Request $request, $kode)
    {
        try {
            $data = $request->validate([
                'data' => 'required|array',
                'data.*.tanggal' => 'required|date',
                'data.*.jam_mulai' => 'required|string',
                'data.*.jam_selesai' => 'required|string',
                'data.*.jumlah_sesi' => 'required|integer|min:1|max:6',
                'data.*.dosen_ids' => 'required|array|min:1',
                'data.*.dosen_ids.*' => 'exists:users,id',
                'data.*.koordinator_ids' => 'nullable|array|max:1',
                'data.*.koordinator_ids.*' => 'exists:users,id',
                'data.*.ruangan_id' => 'nullable|integer|min:1',
                'data.*.use_ruangan' => 'required|boolean',
                'data.*.topik' => 'nullable|string',
                'data.*.kelompok_besar_id' => 'nullable|integer',
            ]);

            $mataKuliah = \App\Models\MataKuliah::find($kode);
            if (!$mataKuliah) {
                return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
            }

            $errors = [];

            // Validasi semua data
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
                            // Validasi kapasitas ruangan
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
                if (count($koordinatorIds) > 1) {
                    $rowErrors[] = "Baris " . ($index + 1) . ": Koordinator Seminar Pleno hanya boleh 1 orang";
                }
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
                    'dosen_ids' => $allDosenIds,
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
                    $prevKoordinatorIds = $previousData['koordinator_ids'] ?? [];
                    $prevPengampuIds = $previousData['dosen_ids'] ?? [];
                    $prevAllDosenIds = array_unique(array_merge($prevKoordinatorIds, $prevPengampuIds));

                    $previousRowData = [
                        'mata_kuliah_kode' => $kode,
                        'tanggal' => $previousData['tanggal'],
                        'jam_mulai' => $previousData['jam_mulai'],
                        'jam_selesai' => $previousData['jam_selesai'],
                        'jumlah_sesi' => $previousData['jumlah_sesi'],
                        'dosen_ids' => $prevAllDosenIds,
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
                        $rowErrors[] = "Baris " . ($index + 1) . ": Jadwal bentrok dengan data pada baris " . ($j + 1) . " (Dosen: {$dosenNamesStrPrev}, Ruangan: {$ruanganNamePrev})";
                        break;
                    }
                }

                if (!empty($rowErrors)) {
                    $errors = array_merge($errors, $rowErrors);
                }
            }

            // Return hasil validasi
            return response()->json([
                'valid' => empty($errors),
                'errors' => $errors,
                'message' => empty($errors) ? 'Data valid' : 'Terdapat error pada data'
            ]);
        } catch (\Exception $e) {
            Log::error('Error validating Seminar Pleno preview: ' . $e->getMessage());
            return response()->json([
                'valid' => false,
                'errors' => ['Terjadi kesalahan saat memvalidasi data: ' . $e->getMessage()],
                'message' => 'Terjadi kesalahan saat memvalidasi data'
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
        if (isset($data1['dosen_ids']) && is_array($data1['dosen_ids']) &&
            isset($data2['dosen_ids']) && is_array($data2['dosen_ids'])) {
            $intersectingDosen = array_intersect($data1['dosen_ids'], $data2['dosen_ids']);
            if (!empty($intersectingDosen)) {
                $dosenBentrok = true;
            }
        }

        // Cek bentrok ruangan
        $ruanganBentrok = false;
        if (isset($data1['ruangan_id']) && isset($data2['ruangan_id']) &&
            $data1['ruangan_id'] == $data2['ruangan_id']) {
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

        // Cek bentrok dengan jadwal Seminar Pleno lain
        $persepsiQuery = JadwalSeminarPleno::where('tanggal', $data['tanggal'])
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
            return "Jadwal bentrok dengan Jadwal Seminar Pleno lain pada tanggal " .
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
        if (isset($data['ruangan_id']) && $data['ruangan_id'] &&
            isset($jadwalBentrok->ruangan_id) && $jadwalBentrok->ruangan_id &&
            $data['ruangan_id'] == $jadwalBentrok->ruangan_id) {
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
     * Get jadwal Seminar Pleno for specific dosen
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
            Log::info("Getting jadwal seminar pleno for dosen ID: {$dosenId}, semester_type: {$semesterType}");

            // PENTING: Query harus mengambil jadwal dimana:
            // 1. $dosenId ada di koordinator_ids (dosen aktif sebagai koordinator)
            // 2. ATAU $dosenId ada di dosen_ids (dosen aktif sebagai pengampu atau dosen lama/history)
            // Filter semester_type harus diterapkan ke kedua kondisi
            $rawJadwal = DB::table('jadwal_seminar_pleno')
                ->join('mata_kuliah', 'jadwal_seminar_pleno.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                ->where(function ($q) use ($dosenId, $semesterType) {
                    // Kondisi 1: Dosen aktif sebagai koordinator ($dosenId ada di koordinator_ids)
                    $q->whereNotNull('jadwal_seminar_pleno.koordinator_ids')
                        ->where(function ($subQ) use ($dosenId) {
                            $subQ->whereRaw('JSON_CONTAINS(jadwal_seminar_pleno.koordinator_ids, ?)', [json_encode($dosenId)])
                                ->orWhereRaw('JSON_SEARCH(jadwal_seminar_pleno.koordinator_ids, "one", ?) IS NOT NULL', [$dosenId])
                                ->orWhereRaw('CAST(jadwal_seminar_pleno.koordinator_ids AS CHAR) LIKE ?', ['%"' . $dosenId . '"%'])
                                ->orWhereRaw('CAST(jadwal_seminar_pleno.koordinator_ids AS CHAR) LIKE ?', ['%' . $dosenId . '%']);
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
                    $q->whereNotNull('jadwal_seminar_pleno.dosen_ids')
                        ->where(function ($subQ) use ($dosenId) {
                            $subQ->whereRaw('JSON_CONTAINS(jadwal_seminar_pleno.dosen_ids, ?)', [json_encode($dosenId)])
                                ->orWhereRaw('JSON_SEARCH(jadwal_seminar_pleno.dosen_ids, "one", ?) IS NOT NULL', [$dosenId])
                                ->orWhereRaw('CAST(jadwal_seminar_pleno.dosen_ids AS CHAR) LIKE ?', ['%"' . $dosenId . '"%'])
                                ->orWhereRaw('CAST(jadwal_seminar_pleno.dosen_ids AS CHAR) LIKE ?', ['%' . $dosenId . '%']);
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
                ->select('jadwal_seminar_pleno.*')
                ->orderBy('jadwal_seminar_pleno.tanggal')
                ->orderBy('jadwal_seminar_pleno.jam_mulai')
                ->get();

            Log::info("Raw query found {$rawJadwal->count()} records for dosen ID: {$dosenId}");

            // Convert to Eloquent models for relationships
            $jadwal = JadwalSeminarPleno::with([
                'mataKuliah:kode,nama,semester',
                'ruangan:id,nama,gedung',
                'kelompokBesar:id,semester',
                'kelompokBesarAntara:id,nama_kelompok'
            ])
                ->whereIn('id', $rawJadwal->pluck('id'))
                ->get();

            Log::info("Found {$jadwal->count()} JadwalSeminarPleno records for dosen ID: {$dosenId}");

            if ($jadwal->count() === 0) {
                Log::warning("No jadwal found for dosen ID: {$dosenId}");
                return response()->json([
                    'message' => 'Tidak ada jadwal Seminar Pleno untuk dosen ini',
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
                // Untuk seminar pleno, jika dosen tidak aktif, berarti hanya ada di history
                if (!$isActiveDosen && (!empty($koordinatorIds) || !empty($dosenIds))) {
                    // Cek apakah dosen ini pernah ada di history (sudah diganti)
                    // Untuk sekarang, kita anggap jika tidak aktif, berarti di history
                    $isInHistory = true;
                }

                // Untuk Seminar Pleno, status_konfirmasi selalu 'bisa' (tidak perlu konfirmasi)
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

                // Get kelompok besar data
                $kelompokBesar = null;
                if ($jadwal->kelompokBesar) {
                    $kelompokBesar = (object) [
                        'id' => $jadwal->kelompokBesar->id,
                        'semester' => $jadwal->kelompokBesar->semester,
                    ];
                } elseif ($jadwal->kelompokBesarAntara) {
                    $kelompokBesar = (object) [
                        'id' => $jadwal->kelompokBesarAntara->id,
                        'nama_kelompok' => $jadwal->kelompokBesarAntara->nama_kelompok,
                    ];
                }

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
                    'kelompok_besar' => $kelompokBesar,
                    'kelompok_besar_antara' => $jadwal->kelompokBesarAntara ? (object) [
                        'id' => $jadwal->kelompokBesarAntara->id,
                        'nama_kelompok' => $jadwal->kelompokBesarAntara->nama_kelompok,
                    ] : null,
                ];
            });

            return response()->json([
                'message' => 'Data jadwal Seminar Pleno berhasil diambil',
                'data' => $mappedJadwal,
                'count' => $mappedJadwal->count()
            ]);
        } catch (\Exception $e) {
            Log::error("Error getting jadwal seminar pleno for dosen: " . $e->getMessage());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengambil data jadwal',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Konfirmasi ketersediaan dosen untuk jadwal Seminar Pleno
     */
    public function konfirmasi(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:bisa,tidak_bisa',
            'alasan' => 'nullable|string|max:1000',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $jadwal = JadwalSeminarPleno::with(['mataKuliah', 'ruangan'])->findOrFail($id);

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
     * Ajukan reschedule jadwal Seminar Pleno
     */
    public function reschedule(Request $request, $id)
    {
        $request->validate([
            'reschedule_reason' => 'required|string|max:1000',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $jadwal = JadwalSeminarPleno::with(['mataKuliah', 'ruangan'])->findOrFail($id);

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
                    'title' => 'Dosen Tidak Bisa - Seminar Pleno',
                    'message' => "Dosen {$dosen->name} tidak bisa mengajar pada jadwal Seminar Pleno mata kuliah {$mataKuliah->nama} pada " . date('d/m/Y', strtotime($jadwal->tanggal)) . " jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai}. Alasan: {$alasan}",
                    'data' => [
                        'jadwal_type' => 'seminar_pleno',
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

            Log::info("Replacement notification sent for Seminar Pleno jadwal ID: {$jadwal->id}");
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
                    'title' => 'Konfirmasi Seminar Pleno',
                    'message' => "Dosen {$dosen->name} mengkonfirmasi bisa mengajar pada jadwal Seminar Pleno mata kuliah {$mataKuliah->nama} pada " . date('d/m/Y', strtotime($jadwal->tanggal)) . " jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai}.",
                    'data' => [
                        'jadwal_type' => 'seminar_pleno',
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

            Log::info("Confirmation notification sent for Seminar Pleno jadwal ID: {$jadwal->id}");
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
                    'title' => 'Permintaan Reschedule - Seminar Pleno',
                    'message' => "Dosen " . implode(', ', $dosenNames) . " mengajukan reschedule untuk jadwal Seminar Pleno mata kuliah {$mataKuliah->nama} pada " . date('d/m/Y', strtotime($jadwal->tanggal)) . " jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai}. Alasan: {$reason}",
                    'data' => [
                        'jadwal_type' => 'seminar_pleno',
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

            Log::info("Reschedule notification sent for Seminar Pleno jadwal ID: {$jadwal->id}");
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
     * Get absensi untuk jadwal Seminar Pleno tertentu
     */
    public function getAbsensi($kode, $jadwalId)
    {
        try {
            // Verifikasi bahwa jadwal ini ada dan milik mata kuliah yang benar
            $jadwal = JadwalSeminarPleno::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Cek apakah user adalah dosen yang terdaftar (koordinator atau pengampu) atau super_admin/tim_akademik
            // Atau mahasiswa yang ingin melihat absensi mereka sendiri
            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Super admin dan tim akademik selalu bisa
            if (!in_array($user->role, ['super_admin', 'tim_akademik'])) {
                // Jika mahasiswa, izinkan untuk melihat absensi mereka sendiri
                if ($user->role === 'mahasiswa') {
                    // Mahasiswa bisa melihat absensi mereka sendiri
                    // Tidak perlu permission check tambahan
                } else {
                    // Cek apakah user adalah koordinator atau pengampu
                    $koordinatorIds = $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : [];
                    $dosenIds = $jadwal->dosen_ids && is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : [];

                    // Parse JSON jika masih string
                    if (is_string($koordinatorIds)) {
                        $koordinatorIds = json_decode($koordinatorIds, true) ?? [];
                    }
                    if (is_string($dosenIds)) {
                        $dosenIds = json_decode($dosenIds, true) ?? [];
                    }

                    $isKoordinator = in_array($user->id, $koordinatorIds);
                    $isPengampu = in_array($user->id, $dosenIds);

                    if (!$isKoordinator && !$isPengampu) {
                        return response()->json(['message' => 'Anda tidak memiliki akses untuk melihat absensi ini'], 403);
                    }
                }
            }

            // Ambil data absensi yang sudah ada
            $absensiRecords = AbsensiSeminarPleno::where('jadwal_seminar_pleno_id', $jadwalId)
                ->with('dosen')
                ->get();

            // Konversi ke format yang diharapkan frontend (key by NIM mahasiswa)
            // Note: dosen_id di sini sebenarnya adalah mahasiswa_id (bug di model)
            $absensi = [];
            foreach ($absensiRecords as $record) {
                // Ambil NIM dari user (dosen_id sebenarnya adalah mahasiswa_id)
                $mahasiswa = \App\Models\User::find($record->dosen_id);
                if ($mahasiswa && $mahasiswa->nim) {
                    $absensi[$mahasiswa->nim] = [
                        'hadir' => $record->hadir,
                        'catatan' => $record->catatan ?? ''
                    ];
                }
            }

            // Ambil informasi apakah sudah submitted
            $penilaianSubmitted = $jadwal->penilaian_submitted ?? false;

            return response()->json([
                'absensi' => $absensi,
                'qr_enabled' => $jadwal->qr_enabled ?? false,
                'penilaian_submitted' => $penilaianSubmitted,
                'report_submitted' => $penilaianSubmitted,
                'submitted' => $penilaianSubmitted,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal memuat data absensi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Store absensi untuk jadwal Seminar Pleno tertentu
     */
    public function storeAbsensi(Request $request, $kode, $jadwalId)
    {
        try {
            // Verifikasi bahwa jadwal ini ada dan milik mata kuliah yang benar
            $jadwal = JadwalSeminarPleno::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Tentukan apakah user adalah dosen atau mahasiswa
            $isDosen = in_array($user->role, ['dosen', 'super_admin', 'tim_akademik']);
            $isMahasiswa = $user->role === 'mahasiswa';

            // VALIDASI: Pastikan QR code sudah diaktifkan oleh dosen (hanya untuk mahasiswa)
            // Dosen bisa input manual tanpa perlu QR code aktif
            if (!$isDosen && !$jadwal->qr_enabled) {
                Log::warning('Absensi ditolak: QR code belum diaktifkan', [
                    'jadwal_id' => $jadwalId,
                    'qr_enabled' => $jadwal->qr_enabled,
                    'user_role' => $user->role ?? 'unknown'
                ]);
                return response()->json([
                    'message' => 'QR code belum diaktifkan oleh dosen. Silakan tunggu hingga dosen mengaktifkan QR code untuk absensi ini.',
                    'qr_enabled' => false
                ], 403);
            }

            // VALIDASI: Cek token QR code untuk mahasiswa (jika submit via QR)
            if (!$isDosen && $jadwal->qr_enabled) {
                $token = $request->input('qr_token');
                $cacheKey = "qr_token_seminar_pleno_{$kode}_{$jadwalId}";

                if (!$token) {
                    Log::warning('Absensi ditolak: QR token tidak ditemukan', [
                        'jadwal_id' => $jadwalId,
                        'user_nim' => $user->nim ?? 'unknown'
                    ]);
                    return response()->json([
                        'message' => 'Token QR code tidak valid atau sudah expired. Silakan scan QR code yang baru.',
                        'code' => 'QR_TOKEN_INVALID'
                    ], 403);
                }

                $validToken = Cache::get($cacheKey);

                if (!$validToken || $validToken !== $token) {
                    Log::warning('Absensi ditolak: QR token tidak valid atau expired', [
                        'jadwal_id' => $jadwalId,
                        'user_nim' => $user->nim ?? 'unknown',
                        'token_provided' => substr($token, 0, 8) . '...'
                    ]);
                    return response()->json([
                        'message' => 'Token QR code tidak valid atau sudah expired. Silakan scan QR code yang baru.',
                        'code' => 'QR_TOKEN_EXPIRED'
                    ], 403);
                }

                // Token valid, hapus dari cache untuk mencegah penggunaan ulang
                Cache::forget($cacheKey);

                Log::info('QR token validated successfully for Seminar Pleno', [
                    'jadwal_id' => $jadwalId,
                    'user_nim' => $user->nim ?? 'unknown'
                ]);
            }

            // Permission check untuk dosen
            if ($isDosen) {
                // Super admin dan tim akademik selalu bisa
                if (in_array($user->role, ['super_admin', 'tim_akademik'])) {
                    // Allow access
                } else {
                    // Cek apakah user adalah koordinator atau pengampu
                    $koordinatorIds = $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : [];
                    $dosenIds = $jadwal->dosen_ids && is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : [];

                    // Parse JSON jika masih string
                    if (is_string($koordinatorIds)) {
                        $koordinatorIds = json_decode($koordinatorIds, true) ?? [];
                    }
                    if (is_string($dosenIds)) {
                        $dosenIds = json_decode($dosenIds, true) ?? [];
                    }

                    $isKoordinator = in_array($user->id, $koordinatorIds);
                    $isPengampu = in_array($user->id, $dosenIds);

                    if (!$isKoordinator && !$isPengampu) {
                        return response()->json(['message' => 'Anda tidak memiliki akses untuk menyimpan absensi ini'], 403);
                    }
                }
            }

            // Validasi payload berbeda untuk dosen dan mahasiswa
            if ($isDosen) {
                // Dosen mengirim dosen_id (yang sebenarnya adalah mahasiswa_id)
                $request->validate([
                    'absensi' => 'required|array',
                    'absensi.*.dosen_id' => 'required|integer|exists:users,id',
                    'absensi.*.hadir' => 'required|boolean',
                    'absensi.*.catatan' => 'nullable|string',
                    'penilaian_submitted' => 'nullable|boolean',
                ]);
            } else {
                // Mahasiswa mengirim mahasiswa_nim
                $request->validate([
                    'absensi' => 'required|array',
                    'absensi.*.mahasiswa_nim' => 'required|string',
                    'absensi.*.hadir' => 'required|boolean',
                    'absensi.*.catatan' => 'nullable|string',
                ]);
            }

            // Update jadwal Seminar Pleno dengan status penilaian_submitted (hanya untuk dosen)
            if ($isDosen && $request->has('penilaian_submitted')) {
                $jadwal->update([
                    'penilaian_submitted' => $request->penilaian_submitted
                ]);
            }

            // Untuk mahasiswa, validasi bahwa mereka terdaftar di jadwal
            if ($isMahasiswa) {
                // Get mahasiswa yang terdaftar di jadwal Seminar Pleno ini
                $mahasiswaTerdaftar = [];
                $mahasiswaList = [];

                // Cek apakah ini semester antara (menggunakan kelompok_besar_antara_id)
                if ($jadwal->kelompok_besar_antara_id) {
                    $kelompokAntara = KelompokBesarAntara::find($jadwal->kelompok_besar_antara_id);

                    if ($kelompokAntara && $kelompokAntara->mahasiswa_ids) {
                        $mahasiswaIds = is_array($kelompokAntara->mahasiswa_ids)
                            ? $kelompokAntara->mahasiswa_ids
                            : json_decode($kelompokAntara->mahasiswa_ids, true);

                        if (is_array($mahasiswaIds) && !empty($mahasiswaIds)) {
                            $mahasiswaList = User::where('role', 'mahasiswa')
                                ->whereIn('id', $mahasiswaIds)
                                ->get();
                            $mahasiswaTerdaftar = $mahasiswaList->pluck('nim')->toArray();
                        }
                    }
                } else {
                    // Semester reguler - ambil dari kelompok besar berdasarkan semester
                    $semester = $jadwal->kelompok_besar_id ?? ($jadwal->mataKuliah->semester ?? null);

                    if ($semester && $semester !== 'Antara') {
                        $kelompokBesar = KelompokBesar::where('semester', $semester)->get();

                        if ($kelompokBesar->isNotEmpty()) {
                            $mahasiswaIds = $kelompokBesar->pluck('mahasiswa_id')->toArray();

                            $mahasiswaList = User::where('role', 'mahasiswa')
                                ->whereIn('id', $mahasiswaIds)
                                ->get();
                            $mahasiswaTerdaftar = $mahasiswaList->pluck('nim')->toArray();
                        }
                    }
                }

                // Validasi NIM yang di-submit harus terdaftar di jadwal ini
                $absensiData = $request->input('absensi', []);
                $invalidNims = [];
                foreach ($absensiData as $absen) {
                    $submittedNim = trim((string)($absen['mahasiswa_nim'] ?? ''));

                    // Cek dengan perbandingan yang case-insensitive dan trimmed
                    $isValid = false;
                    foreach ($mahasiswaTerdaftar as $registeredNim) {
                        if (strtolower($registeredNim) === strtolower($submittedNim)) {
                            $isValid = true;
                            break;
                        }
                    }

                    if (!$isValid && !empty($submittedNim)) {
                        $invalidNims[] = $submittedNim;
                    }
                }

                if (!empty($invalidNims)) {
                    Log::warning('Absensi ditolak: mahasiswa tidak terdaftar', [
                        'invalid_nims' => $invalidNims,
                        'mahasiswa_terdaftar' => $mahasiswaTerdaftar
                    ]);

                    return response()->json([
                        'message' => 'Beberapa mahasiswa tidak terdaftar di jadwal ini: ' . implode(', ', $invalidNims),
                        'invalid_nims' => $invalidNims
                    ], 422);
                }
            }

            // Hapus data absensi yang lama (hanya untuk dosen yang submit semua absensi)
            // Untuk mahasiswa, gunakan updateOrCreate agar tidak menghapus absensi mahasiswa lain
            if ($isDosen && $request->has('penilaian_submitted')) {
                // Jika dosen submit semua absensi sekaligus, hapus yang lama
                AbsensiSeminarPleno::where('jadwal_seminar_pleno_id', $jadwalId)->delete();
            }

            // Simpan data absensi baru
            foreach ($request->absensi as $absen) {
                if ($isDosen) {
                    // Dosen mengirim dosen_id (yang sebenarnya adalah mahasiswa_id)
                    AbsensiSeminarPleno::updateOrCreate(
                        [
                            'jadwal_seminar_pleno_id' => $jadwalId,
                            'dosen_id' => $absen['dosen_id']
                        ],
                        [
                            'hadir' => $absen['hadir'],
                            'catatan' => $absen['catatan'] ?? '',
                        ]
                    );
                } else {
                    // Mahasiswa mengirim mahasiswa_nim, perlu konversi ke user ID
                    $mahasiswaNim = trim((string)($absen['mahasiswa_nim'] ?? ''));
                    $mahasiswaUser = User::where('role', 'mahasiswa')
                        ->where('nim', $mahasiswaNim)
                        ->first();

                    if (!$mahasiswaUser) {
                        Log::warning('Mahasiswa tidak ditemukan', [
                            'nim' => $mahasiswaNim
                        ]);
                        continue; // Skip jika mahasiswa tidak ditemukan
                    }

                    AbsensiSeminarPleno::updateOrCreate(
                        [
                            'jadwal_seminar_pleno_id' => $jadwalId,
                            'dosen_id' => $mahasiswaUser->id // Simpan sebagai dosen_id (karena struktur database)
                        ],
                        [
                            'hadir' => $absen['hadir'] ?? true,
                            'catatan' => $absen['catatan'] ?? '',
                        ]
                    );
                }
            }

            return response()->json(['message' => 'Absensi berhasil disimpan']);
        } catch (\Exception $e) {
            Log::error('Error storing absensi Seminar Pleno', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['message' => 'Gagal menyimpan absensi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get mahasiswa untuk jadwal Seminar Pleno tertentu
     */
    public function getMahasiswa($kode, $jadwalId)
    {
        try {
            $jadwal = JadwalSeminarPleno::with(['mataKuliah', 'kelompokBesar', 'kelompokBesarAntara'])
                ->where('mata_kuliah_kode', $kode)
                ->where('id', $jadwalId)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            $mahasiswaList = [];

            // Cek apakah ini semester antara (menggunakan kelompok_besar_antara_id)
            if ($jadwal->kelompok_besar_antara_id) {
                $kelompokAntara = KelompokBesarAntara::find($jadwal->kelompok_besar_antara_id);

                if ($kelompokAntara && $kelompokAntara->mahasiswa_ids) {
                    $mahasiswaIds = is_array($kelompokAntara->mahasiswa_ids)
                        ? $kelompokAntara->mahasiswa_ids
                        : json_decode($kelompokAntara->mahasiswa_ids, true);

                    if (is_array($mahasiswaIds) && !empty($mahasiswaIds)) {
                        $mahasiswaList = User::where('role', 'mahasiswa')
                            ->whereIn('id', $mahasiswaIds)
                            ->get()
                            ->map(function ($user) {
                                return [
                                    'id' => $user->id,
                                    'nim' => $user->nim,
                                    'nama' => $user->name
                                ];
                            });
                    }
                }
            } else {
                // Semester reguler - ambil dari kelompok besar berdasarkan semester
                $isSemesterAntara = $jadwal->mataKuliah && $jadwal->mataKuliah->semester === 'Antara';

                if (!$isSemesterAntara) {
                    $semester = null;

                    // Ambil semester dari kelompok_besar_id (menyimpan semester langsung)
                    if ($jadwal->kelompok_besar_id) {
                        $semester = $jadwal->kelompok_besar_id;
                    } elseif ($jadwal->mataKuliah && $jadwal->mataKuliah->semester) {
                        // Fallback: ambil dari mata kuliah
                        $semester = $jadwal->mataKuliah->semester;
                    }

                    if ($semester && $semester !== 'Antara') {
                        // Get mahasiswa dari kelompok besar berdasarkan semester
                        $kelompokBesar = KelompokBesar::where('semester', $semester)->get();

                        if ($kelompokBesar->isNotEmpty()) {
                            $mahasiswaIds = $kelompokBesar->pluck('mahasiswa_id')->toArray();

                            $mahasiswaList = User::where('role', 'mahasiswa')
                                ->whereIn('id', $mahasiswaIds)
                                ->get()
                                ->map(function ($user) {
                                    return [
                                        'id' => $user->id,
                                        'nim' => $user->nim,
                                        'nama' => $user->name
                                    ];
                                });
                        }
                    }
                }
            }

            return response()->json([
                'mahasiswa' => $mahasiswaList
            ]);
        } catch (\Exception $e) {
            Log::error("Error getting mahasiswa for Seminar Pleno: " . $e->getMessage());
            return response()->json(['message' => 'Gagal mengambil data mahasiswa: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Toggle QR code enabled/disabled untuk jadwal Seminar Pleno
     */
    public function toggleQr($kode, $jadwalId)
    {
        try {
            $jadwal = JadwalSeminarPleno::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Cek apakah user adalah dosen yang terdaftar (koordinator atau pengampu) atau super_admin/tim_akademik
            $userId = Auth::id();
            $user = Auth::user();

            // Super admin dan tim akademik selalu bisa
            if (!in_array($user->role, ['super_admin', 'tim_akademik'])) {
                // Parse koordinator_ids (bisa array atau JSON string)
                $koordinatorIds = [];
                if ($jadwal->koordinator_ids) {
                    $koordinatorIds = is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : json_decode($jadwal->koordinator_ids, true);
                    if (!is_array($koordinatorIds)) {
                        $koordinatorIds = [];
                    }
                }

                // Parse dosen_ids (bisa array atau JSON string)
                $dosenIds = [];
                if ($jadwal->dosen_ids) {
                    $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
                    if (!is_array($dosenIds)) {
                        $dosenIds = [];
                    }
                }

                $isKoordinator = in_array($userId, $koordinatorIds);
                $isPengampu = in_array($userId, $dosenIds);

                if (!$isKoordinator && !$isPengampu) {
                    return response()->json(['message' => 'Anda tidak memiliki akses untuk mengubah status QR code'], 403);
                }
            }

            // Toggle qr_enabled
            $jadwal->qr_enabled = !$jadwal->qr_enabled;
            $jadwal->save();

            Log::info('QR code toggled for Seminar Pleno', [
                'jadwal_id' => $jadwalId,
                'qr_enabled' => $jadwal->qr_enabled,
                'user_id' => $userId
            ]);

            return response()->json([
                'message' => $jadwal->qr_enabled ? 'QR code diaktifkan' : 'QR code dinonaktifkan',
                'qr_enabled' => $jadwal->qr_enabled
            ]);
        } catch (\Exception $e) {
            Log::error("Error toggling QR for Seminar Pleno: " . $e->getMessage());
            return response()->json(['message' => 'Gagal mengubah status QR code: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Generate QR token untuk absensi (expired setiap 20 detik)
     */
    public function generateQrToken($kode, $jadwalId)
    {
        try {
            $jadwal = JadwalSeminarPleno::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Validasi: Hanya bisa generate token jika QR enabled
            if (!$jadwal->qr_enabled) {
                return response()->json([
                    'message' => 'QR code belum diaktifkan',
                    'qr_enabled' => false
                ], 403);
            }

            // Cek apakah user adalah dosen yang terdaftar (koordinator atau pengampu) atau super_admin/tim_akademik
            $userId = Auth::id();
            $user = Auth::user();

            // Super admin dan tim akademik selalu bisa
            if (!in_array($user->role, ['super_admin', 'tim_akademik'])) {
                // Parse koordinator_ids (bisa array atau JSON string)
                $koordinatorIds = [];
                if ($jadwal->koordinator_ids) {
                    $koordinatorIds = is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : json_decode($jadwal->koordinator_ids, true);
                    if (!is_array($koordinatorIds)) {
                        $koordinatorIds = [];
                    }
                }

                // Parse dosen_ids (bisa array atau JSON string)
                $dosenIds = [];
                if ($jadwal->dosen_ids) {
                    $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
                    if (!is_array($dosenIds)) {
                        $dosenIds = [];
                    }
                }

                $isKoordinator = in_array($userId, $koordinatorIds);
                $isPengampu = in_array($userId, $dosenIds);

                if (!$isKoordinator && !$isPengampu) {
                    return response()->json(['message' => 'Anda tidak memiliki akses untuk generate QR token'], 403);
                }
            }

            // Generate random token
            $token = Str::random(32);
            $cacheKey = "qr_token_seminar_pleno_{$kode}_{$jadwalId}";

            // Simpan token di cache dengan expiry 20 detik
            Cache::put($cacheKey, $token, now()->addSeconds(20));

            // Calculate expires timestamp (unix timestamp in milliseconds untuk frontend)
            $expiresAt = now()->addSeconds(20);
            $expiresAtTimestamp = $expiresAt->timestamp * 1000; // Convert to milliseconds

            Log::info('QR token generated for Seminar Pleno', [
                'kode' => $kode,
                'jadwal_id' => $jadwalId,
                'token' => substr($token, 0, 8) . '...', // Log hanya sebagian untuk security
                'expires_at' => $expiresAt->toDateTimeString(),
                'expires_at_timestamp' => $expiresAtTimestamp
            ]);

            return response()->json([
                'token' => $token,
                'expires_in' => 20, // detik
                'expires_at' => $expiresAt->toDateTimeString(), // Untuk display
                'expires_at_timestamp' => $expiresAtTimestamp // Unix timestamp in milliseconds (untuk frontend)
            ]);
        } catch (\Exception $e) {
            Log::error("Error generating QR token for Seminar Pleno: " . $e->getMessage());
            return response()->json(['message' => 'Gagal generate QR token: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get absensi dosen untuk jadwal Seminar Pleno tertentu (hanya koordinator)
     */
    public function getAbsensiDosen($kode, $jadwalId)
    {
        try {
            // Verifikasi bahwa jadwal ini ada dan milik mata kuliah yang benar
            $jadwal = JadwalSeminarPleno::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Cek apakah user adalah koordinator atau super_admin/tim_akademik
            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Super admin dan tim akademik selalu bisa
            if (!in_array($user->role, ['super_admin', 'tim_akademik'])) {
                // Parse koordinator_ids (bisa array atau JSON string)
                $koordinatorIds = [];
                if ($jadwal->koordinator_ids) {
                    $koordinatorIds = is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : json_decode($jadwal->koordinator_ids, true);
                    if (!is_array($koordinatorIds)) {
                        $koordinatorIds = [];
                    }
                }

                // Hanya koordinator yang bisa mengakses
                if (!in_array($user->id, $koordinatorIds)) {
                    return response()->json(['message' => 'Hanya koordinator yang dapat mengakses absensi dosen'], 403);
                }
            }

            // Ambil data absensi dosen yang sudah ada
            // Note: Kita menggunakan tabel absensi_seminar_pleno yang sama
            // Untuk membedakan, kita akan filter berdasarkan dosen_id yang ada di koordinator_ids atau dosen_ids
            $allDosenIds = array_unique(array_merge(
                is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : (json_decode($jadwal->koordinator_ids, true) ?: []),
                is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : (json_decode($jadwal->dosen_ids, true) ?: [])
            ));

            $absensiRecords = \App\Models\AbsensiSeminarPleno::where('jadwal_seminar_pleno_id', $jadwalId)
                ->whereIn('dosen_id', $allDosenIds)
                ->with('dosen')
                ->get();

            // Konversi ke format yang diharapkan frontend (key by dosen_id)
            $absensi = [];
            foreach ($absensiRecords as $record) {
                $absensi[$record->dosen_id] = [
                    'hadir' => $record->hadir,
                    'catatan' => $record->catatan ?? ''
                ];
            }

            return response()->json([
                'absensi' => $absensi
            ]);
        } catch (\Exception $e) {
            Log::error("Error getting absensi dosen for Seminar Pleno: " . $e->getMessage());
            return response()->json(['message' => 'Gagal memuat data absensi dosen: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Store absensi dosen untuk jadwal Seminar Pleno tertentu (hanya koordinator)
     */
    public function storeAbsensiDosen(Request $request, $kode, $jadwalId)
    {
        try {
            // Verifikasi bahwa jadwal ini ada dan milik mata kuliah yang benar
            $jadwal = JadwalSeminarPleno::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Cek apakah user adalah koordinator atau super_admin/tim_akademik
            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Super admin dan tim akademik selalu bisa
            if (!in_array($user->role, ['super_admin', 'tim_akademik'])) {
                // Parse koordinator_ids (bisa array atau JSON string)
                $koordinatorIds = [];
                if ($jadwal->koordinator_ids) {
                    $koordinatorIds = is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : json_decode($jadwal->koordinator_ids, true);
                    if (!is_array($koordinatorIds)) {
                        $koordinatorIds = [];
                    }
                }

                // Hanya koordinator yang bisa menyimpan
                if (!in_array($user->id, $koordinatorIds)) {
                    return response()->json(['message' => 'Hanya koordinator yang dapat menyimpan absensi dosen'], 403);
                }
            }

            // Validasi request
            $request->validate([
                'absensi' => 'required|array',
                'absensi.*.dosen_id' => 'required|exists:users,id',
                'absensi.*.hadir' => 'required|boolean',
                'absensi.*.catatan' => 'nullable|string|max:1000',
            ]);

            // Ambil semua dosen_id yang valid untuk jadwal ini
            $allDosenIds = array_unique(array_merge(
                is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : (json_decode($jadwal->koordinator_ids, true) ?: []),
                is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : (json_decode($jadwal->dosen_ids, true) ?: [])
            ));

            // Validasi bahwa semua dosen_id yang dikirim ada di jadwal
            foreach ($request->absensi as $absen) {
                if (!in_array($absen['dosen_id'], $allDosenIds)) {
                    return response()->json([
                        'message' => 'Dosen dengan ID ' . $absen['dosen_id'] . ' tidak terdaftar dalam jadwal ini'
                    ], 400);
                }
            }

            // Hapus absensi lama untuk dosen-dosen ini
            $dosenIdsToUpdate = array_column($request->absensi, 'dosen_id');
            \App\Models\AbsensiSeminarPleno::where('jadwal_seminar_pleno_id', $jadwalId)
                ->whereIn('dosen_id', $dosenIdsToUpdate)
                ->delete();

            // Simpan absensi baru
            foreach ($request->absensi as $absen) {
                \App\Models\AbsensiSeminarPleno::create([
                    'jadwal_seminar_pleno_id' => $jadwalId,
                    'dosen_id' => $absen['dosen_id'],
                    'hadir' => $absen['hadir'],
                    'catatan' => $absen['catatan'] ?? '',
                ]);
            }

            Log::info('Absensi dosen saved for Seminar Pleno', [
                'jadwal_id' => $jadwalId,
                'user_id' => $user->id,
                'count' => count($request->absensi)
            ]);

            return response()->json([
                'message' => 'Absensi dosen berhasil disimpan',
                'count' => count($request->absensi)
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Validasi gagal',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error("Error storing absensi dosen for Seminar Pleno: " . $e->getMessage());
            return response()->json(['message' => 'Gagal menyimpan absensi dosen: ' . $e->getMessage()], 500);
        }
    }
}

