<?php

namespace App\Http\Controllers;

use App\Models\JadwalAgendaKhusus;
use App\Models\MataKuliah;
use App\Services\JadwalValidationService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class JadwalAgendaKhususController extends Controller
{
    private JadwalValidationService $validationService;

    public function __construct(JadwalValidationService $validationService)
    {
        $this->validationService = $validationService;
    }

    // List semua jadwal agenda khusus untuk satu mata kuliah blok
    public function index($kode)
    {
        $jadwal = JadwalAgendaKhusus::WithoutSemesterFilter()
            ->with(['mataKuliah', 'ruangan'])
            ->where('mata_kuliah_kode', $kode)
            ->orderBy('tanggal')
            ->orderBy('jam_mulai')
            ->get();
        return response()->json($jadwal);
    }

    // Tambah jadwal agenda khusus baru
    public function store(Request $request, $kode)
    {
        $data = $request->validate([
            'agenda' => 'required|string',
            'ruangan_id' => 'nullable|exists:ruangan,id',
            'kelompok_besar_id' => 'nullable|integer|min:1',
            'kelompok_besar_antara_id' => 'nullable|integer|min:1',
            'use_ruangan' => 'required|boolean',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
        ]);
        $data['mata_kuliah_kode'] = $kode;
        $isSemesterAntara = !empty($data['kelompok_besar_antara_id']);

        $mataKuliah = MataKuliah::where('kode', $kode)->first();
        if (!$mataKuliah) {
            return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
        }

        $tanggalMessage = $this->validationService->validateTanggalMataKuliah($data, $mataKuliah);
        if ($tanggalMessage) {
            return response()->json(['message' => $tanggalMessage], 422);
        }

        // Validasi kapasitas ruangan hanya jika menggunakan ruangan
        if ($data['use_ruangan'] && $data['ruangan_id']) {
            $kapasitasMessage = $this->validationService->validateRoomCapacity($data, 'agenda_khusus', $isSemesterAntara);
            if ($kapasitasMessage) {
                return response()->json(['message' => $kapasitasMessage], 422);
            }
        }

        // Validasi bentrok
        $bentrokMessage = $this->validationService->validateConflict(
            $data,
            'agenda_khusus',
            null,
            $isSemesterAntara
        );
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        $jadwal = JadwalAgendaKhusus::create($data);

        // Send notification to mahasiswa
        $this->sendNotificationToMahasiswa($jadwal);

        // Log activity
        activity()
            ->log('Jadwal Agenda Khusus created');
        return response()->json($jadwal, Response::HTTP_CREATED);
    }

    // Update jadwal agenda khusus
    public function update(Request $request, $kode, $id)
    {
        $jadwal = JadwalAgendaKhusus::findOrFail($id);
        $data = $request->validate([
            'agenda' => 'required|string',
            'ruangan_id' => 'nullable|exists:ruangan,id',
            'kelompok_besar_id' => 'nullable|integer|min:1',
            'kelompok_besar_antara_id' => 'nullable|integer|min:1',
            'use_ruangan' => 'required|boolean',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
        ]);
        $data['mata_kuliah_kode'] = $kode;
        $isSemesterAntara = !empty($data['kelompok_besar_antara_id']);

        $mataKuliah = MataKuliah::where('kode', $kode)->first();
        if (!$mataKuliah) {
            return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
        }

        $tanggalMessage = $this->validationService->validateTanggalMataKuliah($data, $mataKuliah);
        if ($tanggalMessage) {
            return response()->json(['message' => $tanggalMessage], 422);
        }

        // Validasi kapasitas ruangan hanya jika menggunakan ruangan
        if ($data['use_ruangan'] && $data['ruangan_id']) {
            $kapasitasMessage = $this->validationService->validateRoomCapacity($data, 'agenda_khusus', $isSemesterAntara);
            if ($kapasitasMessage) {
                return response()->json(['message' => $kapasitasMessage], 422);
            }
        }

        // Validasi bentrok (kecuali dirinya sendiri)
        $bentrokMessage = $this->validationService->validateConflict(
            $data,
            'agenda_khusus',
            $id,
            $isSemesterAntara
        );
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        $jadwal->update($data);

        // Send notification to mahasiswa
        $this->sendNotificationToMahasiswa($jadwal);

        // Log activity
        activity()
            ->log('Jadwal Agenda Khusus updated');
        return response()->json($jadwal);
    }

    // Hapus jadwal agenda khusus
    public function destroy($kode, $id)
    {
        $jadwal = JadwalAgendaKhusus::findOrFail($id);
        $jadwal->delete();

        // Log activity
        activity()
            ->log('Jadwal Agenda Khusus deleted');
        return response()->json(['message' => 'Jadwal agenda khusus berhasil dihapus']);
    }

    /**
     * Import jadwal agenda khusus dari Excel
     */
    public function importExcel(Request $request, $kode)
    {
        try {
            // Validasi input
            $request->validate([
                'data' => 'required|array|min:1',
                'data.*.tanggal' => 'required|date',
                'data.*.jam_mulai' => 'required|string',
                'data.*.jam_selesai' => 'required|string',
                'data.*.agenda' => 'required|string',
                'data.*.ruangan_id' => 'nullable|exists:ruangan,id',
                'data.*.jumlah_sesi' => 'required|integer|min:1|max:6',
            ]);

            $excelData = $request->input('data');
            $successCount = 0;
            $errors = [];

            // Cek apakah mata kuliah ada
            $mataKuliah = MataKuliah::where('kode', $kode)->first();
            if (!$mataKuliah) {
                return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
            }

            // Validasi semua data terlebih dahulu (all or nothing approach)
            
            // 1️⃣ Validasi bentrok antar baris Excel DULU (priority check)
            $antarBarisErrors = $this->validationService->validateAntarBarisExcel(
                $excelData, 'agenda_khusus', false // $isSemesterAntara akan di-handle per baris
            );
            
            // Jika ada error antar baris, return error tanpa lanjut ke validasi database
            if (!empty($antarBarisErrors)) {
                return response()->json([
                    'success' => 0,
                    'total' => count($excelData),
                    'errors' => $antarBarisErrors,
                    'message' => "Gagal mengimport data. Ada bentrok antar baris di file Excel. Perbaiki terlebih dahulu."
                ], 422);
            }
            
            // 2️⃣ Jika tidak ada bentrok antar baris, lanjut validasi per baris (tanggal, kapasitas, database bentrok)
            foreach ($excelData as $index => $data) {
                $data['mata_kuliah_kode'] = $kode;
                $data['use_ruangan'] = $data['use_ruangan'] ?? true;
                $isSemesterAntara = !empty($data['kelompok_besar_antara_id']);

                // Validasi ruangan_id jika diisi
                if (isset($data['ruangan_id']) && $data['ruangan_id'] !== null && $data['ruangan_id'] !== 0) {
                    $ruangan = \App\Models\Ruangan::find($data['ruangan_id']);
                    if (!$ruangan) {
                        $errors[] = "Baris " . ($index + 1) . ": Ruangan tidak ditemukan";
                    }
                }

                // Validasi tanggal dalam rentang mata kuliah
                $tanggalMessage = $this->validationService->validateTanggalMataKuliah($data, $mataKuliah);
                if ($tanggalMessage) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $tanggalMessage;
                }

                // Validasi kapasitas ruangan
                if ($data['use_ruangan'] && isset($data['ruangan_id']) && $data['ruangan_id'] !== null && $data['ruangan_id'] !== 0) {
                    $kapasitasMessage = $this->validationService->validateRoomCapacity($data, 'agenda_khusus', $isSemesterAntara);
                    if ($kapasitasMessage) {
                        $errors[] = "Baris " . ($index + 1) . ": " . $kapasitasMessage;
                    }
                }

                // Validasi bentrok dengan database
                $bentrokMessage = $this->validationService->validateConflict(
                    $data,
                    'agenda_khusus',
                    null,
                    $isSemesterAntara
                );
                if ($bentrokMessage) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $bentrokMessage;
                }
            }

            // Jika ada error validasi, return error tanpa import apapun
            if (count($errors) > 0) {
                return response()->json([
                    'success' => 0,
                    'total' => count($excelData),
                    'errors' => $errors,
                    'message' => "Gagal mengimport data. Perbaiki error terlebih dahulu."
                ], 422);
            }

            // Jika tidak ada error, import semua data menggunakan database transaction
            \DB::beginTransaction();
            try {
                $importedData = [];
                foreach ($excelData as $index => $data) {
                    // Siapkan data untuk disimpan
                    $jadwalData = [
                        'mata_kuliah_kode' => $kode,
                        'tanggal' => $data['tanggal'],
                        'jam_mulai' => $data['jam_mulai'],
                        'jam_selesai' => $data['jam_selesai'],
                        'agenda' => $data['agenda'],
                        'ruangan_id' => ($data['ruangan_id'] && $data['ruangan_id'] !== 0) ? $data['ruangan_id'] : null,
                        'jumlah_sesi' => $data['jumlah_sesi'],
                        'kelompok_besar_id' => $data['kelompok_besar_id'] ?? null,
                        'kelompok_besar_antara_id' => $data['kelompok_besar_antara_id'] ?? null,
                        'use_ruangan' => $data['use_ruangan'] ?? true,
                    ];

                    // Simpan data
                    $jadwal = JadwalAgendaKhusus::create($jadwalData);
                    $importedData[] = $jadwal;

                    // Log activity
                    activity()
                        ->performedOn($jadwal)
                        ->withProperties([
                            'mata_kuliah_kode' => $kode,
                            'agenda' => $data['agenda'],
                            'tanggal' => $data['tanggal'],
                            'jam_mulai' => $data['jam_mulai'],
                            'jam_selesai' => $data['jam_selesai'],
                            'ruangan_id' => $data['ruangan_id'],
                            'jumlah_sesi' => $data['jumlah_sesi'],
                            'import_type' => 'excel'
                        ])
                        ->log('Jadwal agenda khusus diimport dari Excel');

                    $successCount++;
                }

                \DB::commit();
            } catch (\Exception $e) {
                \DB::rollback();
                return response()->json([
                    'success' => 0,
                    'total' => count($excelData),
                    'errors' => ["Terjadi kesalahan saat menyimpan data: " . $e->getMessage()],
                    'message' => "Gagal mengimport data. Terjadi kesalahan saat menyimpan."
                ], 422);
            }

            // Jika tidak ada error, return status 200
            return response()->json([
                'success' => count($importedData),
                'total' => count($excelData),
                'errors' => $errors,
                'message' => "Berhasil mengimport " . count($importedData) . " dari " . count($excelData) . " jadwal agenda khusus"
            ]);
        } catch (\Exception $e) {
            \Log::error('Error importing jadwal agenda khusus: ' . $e->getMessage());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengimport data: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get kelompok besar options for agenda khusus
     */
    public function kelompokBesar(Request $request)
    {
        $semester = $request->query('semester');
        if (!$semester) {
            return response()->json(['message' => 'Parameter semester diperlukan'], 400);
        }

        // Jika semester antara, ambil dari kelompok_besar_antara
        if ($semester === 'Antara') {
            $kelompokBesarAntara = \App\Models\KelompokBesarAntara::orderBy('nama_kelompok')->get();

            return response()->json($kelompokBesarAntara->map(function ($kelompok) {
                $mahasiswaCount = count($kelompok->mahasiswa_ids ?? []);
                return [
                    'id' => $kelompok->id,
                    'label' => "{$kelompok->nama_kelompok} ({$mahasiswaCount} mahasiswa)",
                    'jumlah_mahasiswa' => $mahasiswaCount
                ];
            }));
        }

        // Untuk semester biasa
        $jumlahMahasiswa = \App\Models\KelompokBesar::where('semester', $semester)->count();
        if ($jumlahMahasiswa > 0) {
            return response()->json([
                [
                    'id' => $semester, // Gunakan semester sebagai ID
                    'label' => "Kelompok Besar Semester {$semester} ({$jumlahMahasiswa} mahasiswa)",
                    'jumlah_mahasiswa' => $jumlahMahasiswa
                ]
            ]);
        }
        return response()->json([]);
    }

    /**
     * Send notification to mahasiswa for Agenda Khusus
     */
    private function sendNotificationToMahasiswa($jadwal)
    {
        try {
            \Log::info("Agenda Khusus sendNotificationToMahasiswa - Starting for jadwal ID: {$jadwal->id}");

            // Get all mahasiswa in the same semester as the mata kuliah
            $mahasiswaList = \App\Models\User::where('role', 'mahasiswa')
                ->where('semester', $jadwal->mataKuliah->semester)
                ->get();

            \Log::info("Agenda Khusus sendNotificationToMahasiswa - Found {$mahasiswaList->count()} mahasiswa for semester {$jadwal->mataKuliah->semester}");

            foreach ($mahasiswaList as $mahasiswa) {
                \App\Models\Notification::create([
                    'user_id' => $mahasiswa->id,
                    'title' => 'Jadwal Agenda Khusus Baru',
                    'message' => "Agenda Khusus: {$jadwal->agenda} pada {$jadwal->tanggal} jam " . substr($jadwal->jam_mulai, 0, 5) . "-" . substr($jadwal->jam_selesai, 0, 5),
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'agenda_khusus',
                        'agenda' => $jadwal->agenda,
                        'tanggal' => $jadwal->tanggal,
                        'waktu' => substr($jadwal->jam_mulai, 0, 5) . " - " . substr($jadwal->jam_selesai, 0, 5),
                        'ruangan' => $jadwal->ruangan ? $jadwal->ruangan->nama : 'Tidak ada ruangan',
                        'kelompok_besar_id' => $jadwal->kelompok_besar_id,
                        'mata_kuliah' => $jadwal->mataKuliah->nama ?? 'Agenda Khusus'
                    ]
                ]);
            }

            \Log::info("Agenda Khusus sendNotificationToMahasiswa - Successfully sent notifications to {$mahasiswaList->count()} mahasiswa");
        } catch (\Exception $e) {
            \Log::error("Agenda Khusus sendNotificationToMahasiswa - Error: " . $e->getMessage());
        }
    }

    /**
     * Get jadwal for mahasiswa
     */
    public function getJadwalForMahasiswa($mahasiswaId, Request $request)
    {
        try {
            $mahasiswa = \App\Models\User::where('id', $mahasiswaId)->where('role', 'mahasiswa')->first();
            if (!$mahasiswa) {
                return response()->json(['message' => 'Mahasiswa tidak ditemukan', 'data' => []], 404);
            }

            // Get jadwal agenda khusus for mahasiswa's semester
            $jadwal = JadwalAgendaKhusus::with(['mataKuliah', 'ruangan'])
                ->whereHas('mataKuliah', function ($query) use ($mahasiswa) {
                    $query->where('semester', $mahasiswa->semester);
                })
                ->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();

            $mappedJadwal = $jadwal->map(function ($item) {
                return [
                    'id' => $item->id,
                    'tanggal' => date('d-m-Y', strtotime($item->tanggal)),
                    'jam_mulai' => str_replace(':', '.', substr($item->jam_mulai, 0, 5)),
                    'jam_selesai' => str_replace(':', '.', substr($item->jam_selesai, 0, 5)),
                    'agenda' => $item->agenda ?? 'N/A',
                    'dosen' => [], // No dosen for agenda khusus
                    'ruangan' => $item->ruangan ? ['id' => $item->ruangan->id, 'nama' => $item->ruangan->nama] : null,
                    'jumlah_sesi' => $item->jumlah_sesi ?? 1,
                    'status_konfirmasi' => '-', // No status for agenda khusus
                    'status_reschedule' => null,
                    'semester_type' => 'reguler',
                ];
            });

            return response()->json(['message' => 'Data jadwal Agenda Khusus berhasil diambil', 'data' => $mappedJadwal]);
        } catch (\Exception $e) {
            \Log::error('Error fetching jadwal Agenda Khusus for mahasiswa: ' . $e->getMessage());
            return response()->json(['message' => 'Terjadi kesalahan', 'error' => $e->getMessage(), 'data' => []], 500);
        }
    }
}
