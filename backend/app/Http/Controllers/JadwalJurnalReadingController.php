<?php

namespace App\Http\Controllers;

use App\Models\JadwalJurnalReading;
use App\Models\User;
use App\Models\Notification;
use App\Models\MataKuliah;
use App\Services\JadwalValidationService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class JadwalJurnalReadingController extends Controller
{
    protected JadwalValidationService $validationService;

    public function __construct(JadwalValidationService $validationService)
    {
        $this->validationService = $validationService;
    }

    // List semua jadwal Jurnal Reading untuk satu mata kuliah blok
    public function index($kode)
    {
        $jadwal = JadwalJurnalReading::WithoutSemesterFilter()
            ->with(['mataKuliah', 'kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan'])
            ->where('mata_kuliah_kode', $kode)
            ->orderBy('tanggal')
            ->orderBy('jam_mulai')
            ->get();

        // Tambahkan nama dosen untuk setiap jadwal
        foreach ($jadwal as $j) {
            if ($j->dosen_ids && is_array($j->dosen_ids)) {
                $dosenNames = User::whereIn('id', $j->dosen_ids)->pluck('name')->toArray();
                $j->dosen_names = implode(', ', $dosenNames);
            }
        }

        return response()->json($jadwal);
    }

    // Tambah jadwal Jurnal Reading baru
    public function store(Request $request, $kode)
    {
        // Debug: log semua data yang diterima
        \Illuminate\Support\Facades\Log::info('Store Jurnal Reading - All request data:', $request->all());
        \Illuminate\Support\Facades\Log::info('Store Jurnal Reading - Content type:', ['content_type' => $request->header('Content-Type')]);

        $data = $request->validate([
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
            'kelompok_kecil_id' => 'nullable',
            'kelompok_kecil_antara_id' => 'nullable|exists:kelompok_kecil_antara,id',
            'dosen_id' => 'nullable|exists:users,id',
            'dosen_ids' => 'nullable|string', // Hanya terima string JSON dari FormData
            'ruangan_id' => 'required|exists:ruangan,id',
            'topik' => 'required|string',
            'file_jurnal' => 'nullable|file|mimes:xlsx,xls,docx,doc,pdf|max:10240', // 10MB max
        ]);

        // Proses dosen_ids jika dikirim sebagai string JSON (dari FormData)
        if (isset($data['dosen_ids']) && is_string($data['dosen_ids'])) {
            $data['dosen_ids'] = json_decode($data['dosen_ids'], true);
            \Illuminate\Support\Facades\Log::info('Store Jurnal Reading - dosen_ids after JSON decode:', ['dosen_ids' => $data['dosen_ids']]);
        }

        // Validasi manual untuk dosen_ids setelah JSON decode
        if (isset($data['dosen_ids']) && !is_array($data['dosen_ids'])) {
            return response()->json([
                'message' => 'Format dosen_ids tidak valid.',
                'errors' => [
                    'dosen_ids' => ['Format dosen_ids tidak valid.']
                ]
            ], 422);
        }

        // Validasi setiap ID dosen
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids'])) {
            foreach ($data['dosen_ids'] as $dosenId) {
                if (!\App\Models\User::where('id', $dosenId)->exists()) {
                    return response()->json([
                        'message' => 'Dosen tidak ditemukan.',
                        'errors' => [
                            'dosen_ids' => ["Dosen dengan ID {$dosenId} tidak ditemukan."]
                        ]
                    ], 422);
                }
            }
        } elseif (isset($data['dosen_ids']) && is_array($data['dosen_ids'])) {
            foreach ($data['dosen_ids'] as $dosenId) {
                if (!\App\Models\User::where('id', $dosenId)->exists()) {
                    return response()->json([
                        'message' => 'Dosen tidak ditemukan.',
                        'errors' => [
                            'dosen_ids' => ["Dosen dengan ID {$dosenId} tidak ditemukan."]
                        ]
                    ], 422);
                }
            }
        }

        // Pastikan dosen_id diset ke null jika menggunakan dosen_ids
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
            $data['dosen_id'] = null;
        }

        $data['mata_kuliah_kode'] = $kode;
        $data['created_by'] = $request->input('created_by', auth()->id());

        // Untuk semester antara, pastikan kelompok_kecil_id diset ke null jika menggunakan kelompok_kecil_antara_id
        if (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
            $data['kelompok_kecil_id'] = null;
        }

        $isSemesterAntara = !empty($data['kelompok_kecil_antara_id'] ?? null);

        // Handle file upload
        if ($request->hasFile('file_jurnal')) {
            $file = $request->file('file_jurnal');
            $fileName = $file->getClientOriginalName();
            $filePath = $file->storeAs('jurnal_reading', $fileName, 'public');
            $data['file_jurnal'] = $filePath;
        }

        $mataKuliah = MataKuliah::where('kode', $kode)->first();
        $tanggalMessage = $this->validationService->validateTanggalMataKuliah($data, $mataKuliah);
        if ($tanggalMessage) {
            return response()->json(['message' => $tanggalMessage], 422);
        }

        $kapasitasMessage = $this->validationService->validateRoomCapacity($data, 'jurnal_reading', $isSemesterAntara);
        if ($kapasitasMessage) {
            return response()->json(['message' => $kapasitasMessage], 422);
        }

        $bentrokMessage = $this->validationService->validateConflict($data, 'jurnal_reading', null, $isSemesterAntara);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        $jadwal = JadwalJurnalReading::create($data);



        // Log activity


        activity()


            ->log('Jadwal Jurnal Reading deleted');



        // Log activity


        activity()


            ->log('Jadwal Jurnal Reading updated');



        // Log activity


        activity()


            ->log('Jadwal Jurnal Reading created');

        // Load relasi dan tambahkan dosen_names
        $jadwal->load(['kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan', 'mataKuliah']);

        // Tambahkan nama dosen untuk response
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
            $jadwal->dosen_names = implode(', ', $dosenNames);
        }

        // Buat notifikasi untuk dosen yang di-assign
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            foreach ($jadwal->dosen_ids as $dosenId) {
                $dosen = User::find($dosenId);
                if ($dosen) {
                    \App\Models\Notification::create([
                        'user_id' => $dosenId,
                        'title' => 'Jadwal Jurnal Reading Baru',
                        'message' => "Anda telah di-assign untuk mengajar Jurnal Reading {$jadwal->mataKuliah->nama} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}. Silakan konfirmasi ketersediaan Anda.",
                        'type' => 'info',
                        'data' => [
                            'topik' => $jadwal->topik,
                            'materi' => $jadwal->topik,
                            'ruangan' => $jadwal->ruangan->nama,
                            'tanggal' => $jadwal->tanggal,
                            'jadwal_id' => $jadwal->id,
                            'jam_mulai' => $jadwal->jam_mulai,
                            'jadwal_type' => 'jurnal_reading',
                            'jam_selesai' => $jadwal->jam_selesai,
                            'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                            'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                            'file_jurnal' => $jadwal->file_jurnal,
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
        } elseif ($jadwal->dosen_id) {
            \App\Models\Notification::create([
                'user_id' => $jadwal->dosen_id,
                'title' => 'Jadwal Jurnal Reading Baru',
                'message' => "Anda telah di-assign untuk mengajar Jurnal Reading {$jadwal->mataKuliah->nama} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}. Silakan konfirmasi ketersediaan Anda.",
                'type' => 'info',
                'data' => [
                    'topik' => $jadwal->topik,
                    'materi' => $jadwal->topik,
                    'ruangan' => $jadwal->ruangan->nama,
                    'tanggal' => $jadwal->tanggal,
                    'jadwal_id' => $jadwal->id,
                    'jam_mulai' => $jadwal->jam_mulai,
                    'jadwal_type' => 'jurnal_reading',
                    'jam_selesai' => $jadwal->jam_selesai,
                    'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                    'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                    'file_jurnal' => $jadwal->file_jurnal,
                    'dosen_id' => $jadwal->dosen->id,
                    'dosen_name' => $jadwal->dosen->name,
                    'dosen_role' => $jadwal->dosen->role,
                    'created_by' => auth()->user()->name ?? 'Admin',
                    'created_by_role' => auth()->user()->role ?? 'admin',
                    'sender_name' => auth()->user()->name ?? 'Admin',
                    'sender_role' => auth()->user()->role ?? 'admin'
                ]
            ]);
        }

        // Send notification to mahasiswa
        $this->sendNotificationToMahasiswa($jadwal);

        return response()->json($jadwal, Response::HTTP_CREATED);
    }

    // Update jadwal Jurnal Reading
    public function update(Request $request, $kode, $id)
    {
        $jadwal = JadwalJurnalReading::findOrFail($id);

        // Debug: log semua data yang diterima
        \Illuminate\Support\Facades\Log::info('Update Jurnal Reading - All request data:', $request->all());
        \Illuminate\Support\Facades\Log::info('Update Jurnal Reading - Has file:', ['has_file' => $request->hasFile('file_jurnal')]);
        \Illuminate\Support\Facades\Log::info('Update Jurnal Reading - Content type:', ['content_type' => $request->header('Content-Type')]);

        $data = $request->validate([
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
            'kelompok_kecil_id' => 'nullable',
            'kelompok_kecil_antara_id' => 'nullable|exists:kelompok_kecil_antara,id',
            'dosen_id' => 'nullable|exists:users,id',
            'dosen_ids' => 'nullable', // Hanya terima string JSON dari FormData
            'ruangan_id' => 'required|exists:ruangan,id',
            'topik' => 'required|string',
            'file_jurnal' => 'nullable|file|mimes:xlsx,xls,docx,doc,pdf|max:10240',
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

        // Untuk semester antara, pastikan kelompok_kecil_id diset ke null jika menggunakan kelompok_kecil_antara_id
        if (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
            $data['kelompok_kecil_id'] = null;
        }

        // Proses dosen_ids jika dikirim sebagai string JSON (dari FormData)
        if (isset($data['dosen_ids']) && is_string($data['dosen_ids'])) {
            $data['dosen_ids'] = json_decode($data['dosen_ids'], true);

            // Validasi manual untuk dosen_ids setelah JSON decode
            if (!is_array($data['dosen_ids'])) {
                return response()->json([
                    'message' => 'Format dosen_ids tidak valid.',
                    'errors' => [
                        'dosen_ids' => ['Format dosen_ids tidak valid.']
                    ]
                ], 422);
            }

            // Validasi setiap ID dosen
            foreach ($data['dosen_ids'] as $dosenId) {
                if (!\App\Models\User::where('id', $dosenId)->exists()) {
                    return response()->json([
                        'message' => 'Dosen tidak ditemukan.',
                        'errors' => [
                            'dosen_ids' => ["Dosen dengan ID {$dosenId} tidak ditemukan."]
                        ]
                    ], 422);
                }
            }
        }

        // Pastikan dosen_id diset ke null jika menggunakan dosen_ids
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
            $data['dosen_id'] = null;
        }

        $data['mata_kuliah_kode'] = $kode;
        $data['created_by'] = $request->input('created_by', auth()->id());

        $isSemesterAntara = !empty($data['kelompok_kecil_antara_id'] ?? null);

        // Handle file upload
        if ($request->hasFile('file_jurnal')) {
            // Hapus file lama jika ada
            if ($jadwal->file_jurnal) {
                Storage::disk('public')->delete($jadwal->file_jurnal);
            }

            $file = $request->file('file_jurnal');
            $fileName = $file->getClientOriginalName();
            $filePath = $file->storeAs('jurnal_reading', $fileName, 'public');
            $data['file_jurnal'] = $filePath;
        }

        $mataKuliah = MataKuliah::where('kode', $kode)->first();
        $tanggalMessage = $this->validationService->validateTanggalMataKuliah($data, $mataKuliah);
        if ($tanggalMessage) {
            return response()->json(['message' => $tanggalMessage], 422);
        }

        $kapasitasMessage = $this->validationService->validateRoomCapacity($data, 'jurnal_reading', $isSemesterAntara);
        if ($kapasitasMessage) {
            return response()->json(['message' => $kapasitasMessage], 422);
        }

        $bentrokMessage = $this->validationService->validateConflict($data, 'jurnal_reading', $id, $isSemesterAntara);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        // Reset penilaian submitted status jika jadwal diubah
        // Ini memungkinkan dosen pengampu untuk mengisi ulang penilaian
        $jadwal->resetPenilaianSubmitted();

        $jadwal->update($data);


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading deleted');


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading updated');


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading created');

        // Load relasi dan tambahkan dosen_names
        $jadwal->load(['kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan']);

        // Tambahkan nama dosen untuk response
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
            $jadwal->dosen_names = implode(', ', $dosenNames);
        }

        return response()->json($jadwal);
    }

    // Hapus jadwal Jurnal Reading
    public function destroy($kode, $id)
    {
        $jadwal = JadwalJurnalReading::findOrFail($id);

        // Hapus file jika ada
        if ($jadwal->file_jurnal) {
            Storage::disk('public')->delete($jadwal->file_jurnal);
        }

        $jadwal->delete();


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading deleted');


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading updated');


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading created');
        return response()->json(['message' => 'Jadwal Jurnal Reading berhasil dihapus']);
    }

    // Download file jurnal
    public function downloadFile($kode, $id)
    {
        try {
            \Log::info('Download Jurnal Reading - Start:', [
                'kode' => $kode,
                'id' => $id,
                'request_url' => request()->url(),
                'user_agent' => request()->userAgent()
            ]);

            $jadwal = JadwalJurnalReading::findOrFail($id);

            \Log::info('Download Jurnal Reading - Found jadwal:', [
                'kode' => $kode,
                'id' => $id,
                'file_jurnal' => $jadwal->file_jurnal,
                'exists' => $jadwal->file_jurnal ? Storage::disk('public')->exists($jadwal->file_jurnal) : false
            ]);

            if (!$jadwal->file_jurnal || !Storage::disk('public')->exists($jadwal->file_jurnal)) {
                \Log::warning('Download Jurnal Reading - File not found:', [
                    'kode' => $kode,
                    'id' => $id,
                    'file_jurnal' => $jadwal->file_jurnal
                ]);
                return response()->json(['message' => 'File tidak ditemukan'], 404);
            }

            $path = Storage::disk('public')->path($jadwal->file_jurnal);
            $fileName = basename($jadwal->file_jurnal);

            // Handle nama file dengan spasi dan karakter khusus
            $safeFileName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $fileName);

            \Log::info('Download Jurnal Reading - Success:', [
                'path' => $path,
                'fileName' => $fileName,
                'safeFileName' => $safeFileName,
                'file_exists' => file_exists($path)
            ]);

            return response()->download($path, $safeFileName, [
                'Content-Disposition' => 'attachment; filename="' . $safeFileName . '"',
                'Content-Type' => 'application/octet-stream',
            ]);
        } catch (\Exception $e) {
            \Log::error('Error downloading jurnal reading:', [
                'kode' => $kode,
                'id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json(['message' => 'Error downloading file: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Send notification to mahasiswa in the kelompok
     */
    private function sendNotificationToMahasiswa($jadwal)
    {
        try {
            // Get mahasiswa in the kelompok
            $mahasiswaList = [];

            if ($jadwal->kelompok_kecil_id) {
                // Get all mahasiswa in the same kelompok (same nama_kelompok and semester)
                $kelompokKecil = \App\Models\KelompokKecil::find($jadwal->kelompok_kecil_id);
                if ($kelompokKecil) {
                    $mahasiswaIds = \App\Models\KelompokKecil::where('nama_kelompok', $kelompokKecil->nama_kelompok)
                        ->where('semester', $kelompokKecil->semester)
                        ->pluck('mahasiswa_id')
                        ->toArray();

                    $mahasiswaList = \App\Models\User::whereIn('id', $mahasiswaIds)->get();
                }
            }

            if ($jadwal->kelompok_kecil_antara_id) {
                $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($jadwal->kelompok_kecil_antara_id);
                if ($kelompokKecilAntara && $kelompokKecilAntara->mahasiswa_ids) {
                    $mahasiswaList = \App\Models\User::whereIn('id', $kelompokKecilAntara->mahasiswa_ids)->get();
                }
            }

            // Send notification to each mahasiswa
            foreach ($mahasiswaList as $mahasiswa) {
                \App\Models\Notification::create([
                    'user_id' => $mahasiswa->id,
                    'title' => 'Jadwal Jurnal Reading Baru',
                    'message' => "Jadwal Jurnal Reading baru telah ditambahkan: {$jadwal->mataKuliah->nama} - {$jadwal->topik} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}.",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'jurnal_reading',
                        'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                        'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                        'topik' => $jadwal->topik,
                        'tanggal' => $jadwal->tanggal,
                        'jam_mulai' => $jadwal->jam_mulai,
                        'jam_selesai' => $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'dosen' => $jadwal->dosen ? $jadwal->dosen->name : 'N/A',
                        'created_by' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->name ?? 'Admin' : 'Admin',
                        'created_by_role' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->role ?? 'admin' : 'admin',
                        'sender_name' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->name ?? 'Admin' : 'Admin',
                        'sender_role' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->role ?? 'admin' : 'admin'
                    ]
                ]);
            }

            \Log::info("Jurnal Reading notifications sent to " . count($mahasiswaList) . " mahasiswa for jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Error sending Jurnal Reading notifications to mahasiswa: " . $e->getMessage());
        }
    }

    // Get jadwal Jurnal Reading untuk dosen tertentu
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
            \Log::info("Getting jadwal jurnal reading for dosen ID: {$dosenId}, semester_type: {$semesterType}");

            // PENTING: Query harus mengambil jadwal dimana:
            // 1. dosen_id = $dosenId (dosen aktif saat ini)
            // 2. ATAU $dosenId ada di dosen_ids (dosen lama/history)
            // Filter semester_type harus diterapkan ke kedua kondisi
            $rawJadwal = \DB::table('jadwal_jurnal_reading')
                ->where(function ($q) use ($dosenId, $semesterType) {
                    // Kondisi 1: Dosen aktif (dosen_id = $dosenId)
                    $q->where('dosen_id', $dosenId);
                    
                    // Filter semester_type untuk kondisi 1
                    if ($semesterType === 'antara') {
                        $q->whereNotNull('kelompok_kecil_antara_id');
                    } elseif ($semesterType === 'reguler') {
                        $q->whereNull('kelompok_kecil_antara_id');
                    }
                })
                ->orWhere(function ($q) use ($dosenId, $semesterType) {
                    // Kondisi 2: Dosen lama/history ($dosenId ada di dosen_ids)
                    $q->whereNotNull('dosen_ids')
                        ->where(function ($subQ) use ($dosenId) {
                            // Coba beberapa metode untuk kompatibilitas
                            $subQ->whereRaw('JSON_CONTAINS(dosen_ids, ?)', [json_encode($dosenId)])
                                ->orWhereRaw('JSON_SEARCH(dosen_ids, "one", ?) IS NOT NULL', [$dosenId])
                                ->orWhereRaw('CAST(dosen_ids AS CHAR) LIKE ?', ['%"' . $dosenId . '"%'])
                                ->orWhereRaw('CAST(dosen_ids AS CHAR) LIKE ?', ['%' . $dosenId . '%']);
                        });
                    
                    // Filter semester_type untuk kondisi 2
                    if ($semesterType === 'antara') {
                        $q->whereNotNull('kelompok_kecil_antara_id');
                    } elseif ($semesterType === 'reguler') {
                        $q->whereNull('kelompok_kecil_antara_id');
                    }
                })
                ->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();

            \Log::info("Raw query found {$rawJadwal->count()} records for dosen ID: {$dosenId}");

            // Convert to Eloquent models for relationships
            $jadwal = JadwalJurnalReading::with([
                'mataKuliah:kode,nama,semester',
                'ruangan:id,nama,gedung',
                'dosen:id,name',
                'kelompokKecil:id,nama_kelompok',
                'kelompokKecilAntara:id,nama_kelompok'
            ])
                ->select([
                    'id',
                    'mata_kuliah_kode',
                    'tanggal',
                    'jam_mulai',
                    'jam_selesai',
                    'topik',
                    'ruangan_id',
                    'dosen_id',
                    'dosen_ids',
                    'jumlah_sesi',
                    'kelompok_kecil_id',
                    'kelompok_kecil_antara_id',
                    'file_jurnal',
                    'status_konfirmasi',
                    'alasan_konfirmasi',
                    'status_reschedule',
                    'reschedule_reason',
                    'created_at',
                    // flag penilaian submitted jika tersedia di schema
                    \DB::raw('IFNULL(penilaian_submitted, 0) as penilaian_submitted'),
                    \DB::raw('penilaian_submitted_at'),
                    \DB::raw('penilaian_submitted_by')
                ])
                ->whereIn('id', $rawJadwal->pluck('id'))->get();


            \Log::info("Found {$jadwal->count()} JadwalJurnalReading records for dosen ID: {$dosenId}");

            if ($jadwal->count() === 0) {
                \Log::warning("No jadwal found for dosen ID: {$dosenId}");
                return response()->json([
                    'message' => 'Tidak ada jadwal Jurnal Reading untuk dosen ini',
                    'data' => []
                ]);
            }

            $mappedJadwal = $jadwal->map(function ($jadwal) use ($dosenId) {
                // Parse dosen_ids jika ada
                $dosenIds = [];
                if ($jadwal->dosen_ids) {
                    $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
                    if (!is_array($dosenIds)) {
                        $dosenIds = [];
                    }
                }

                // PENTING: Tentukan apakah dosen ini adalah dosen aktif (dosen_id) atau hanya ada di history (dosen_ids)
                $isActiveDosen = ($jadwal->dosen_id == $dosenId);
                $isInHistory = false;
                if (!$isActiveDosen && !empty($dosenIds)) {
                    $isInHistory = in_array($dosenId, $dosenIds);
                }

                // Jika dosen hanya ada di history (sudah diganti), status harus "tidak_bisa" dan tidak bisa diubah
                $statusKonfirmasi = $jadwal->status_konfirmasi ?? 'belum_konfirmasi';
                if ($isInHistory && !$isActiveDosen) {
                    // Dosen lama yang sudah diganti: status tetap "tidak_bisa"
                    $statusKonfirmasi = 'tidak_bisa';
                }

                // Determine semester type based on kelompok_kecil_antara_id
                $semesterType = $jadwal->kelompok_kecil_antara_id ? 'antara' : 'reguler';

                // Get dosen names - only show current dosen, not history
                $dosenNames = [];

                // Only show current dosen_id, ignore history
                if ($jadwal->dosen_id) {
                    $currentDosen = User::find($jadwal->dosen_id);
                    if ($currentDosen) {
                        $dosenNames[] = $currentDosen->name;
                    }
                }

                // Fallback to single dosen if no current dosen
                if (empty($dosenNames) && $jadwal->dosen) {
                    $dosenNames = [$jadwal->dosen->name];
                }

                return (object) [
                    'id' => $jadwal->id,
                    'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                    'mata_kuliah' => (object) [
                        'kode' => $jadwal->mataKuliah->kode ?? '',
                        'nama' => $jadwal->mataKuliah->nama ?? 'Unknown',
                        'semester' => $jadwal->mataKuliah->semester ?? ''
                    ],
                    'tanggal' => is_string($jadwal->tanggal) ? $jadwal->tanggal : $jadwal->tanggal->format('Y-m-d'),
                    'jam_mulai' => $jadwal->jam_mulai,
                    'jam_selesai' => $jadwal->jam_selesai,
                    'topik' => $jadwal->topik,
                    'ruangan' => (object) [
                        'id' => $jadwal->ruangan->id ?? null,
                        'nama' => $jadwal->ruangan->nama ?? 'Unknown'
                    ],
                    'status_konfirmasi' => $statusKonfirmasi, // Status berdasarkan apakah dosen aktif atau history
                    'alasan_konfirmasi' => $jadwal->alasan_konfirmasi ?? null,
                    'status_reschedule' => $jadwal->status_reschedule ?? null,
                    'reschedule_reason' => $jadwal->reschedule_reason ?? null,
                    'dosen' => !empty($dosenNames) ? (object) [
                        'id' => $jadwal->dosen_id,
                        'name' => implode(', ', $dosenNames)
                    ] : null,
                    'dosen_id' => $jadwal->dosen_id,
                    'dosen_ids' => $dosenIds,
                    'is_active_dosen' => $isActiveDosen, // Flag: apakah dosen ini adalah dosen aktif
                    'is_in_history' => $isInHistory, // Flag: apakah dosen ini hanya ada di history
                    'jumlah_sesi' => $jadwal->jumlah_sesi ?? 1,
                    'kelompok_kecil_id' => $jadwal->kelompok_kecil_id,
                    'kelompok_kecil_antara_id' => $jadwal->kelompok_kecil_antara_id,
                    'kelompok_kecil' => $jadwal->kelompokKecil ? (object) [
                        'id' => $jadwal->kelompokKecil->id,
                        'nama' => $jadwal->kelompokKecil->nama_kelompok
                    ] : null,
                    'kelompok_kecil_antara' => $jadwal->kelompokKecilAntara ? (object) [
                        'id' => $jadwal->kelompokKecilAntara->id,
                        'nama_kelompok' => $jadwal->kelompokKecilAntara->nama_kelompok
                    ] : null,
                    'file_jurnal' => $jadwal->file_jurnal,
                    // gunakan default false bila kolom tidak ada
                    'penilaian_submitted' => (bool)($jadwal->penilaian_submitted ?? false),
                    'penilaian_submitted_at' => $jadwal->penilaian_submitted_at ?? null,
                    'penilaian_submitted_by' => $jadwal->penilaian_submitted_by ?? null,
                    'semester_type' => $semesterType,
                    'created_at' => $jadwal->created_at,
                ];
            });

            return response()->json([
                'message' => 'Data jadwal Jurnal Reading berhasil diambil',
                'data' => $mappedJadwal,
                'count' => $mappedJadwal->count()
            ]);
        } catch (\Exception $e) {
            \Log::error("Error getting jadwal jurnal reading for dosen: " . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil data jadwal Jurnal Reading',
                'data' => []
            ], 500);
        }
    }

    // Konfirmasi jadwal Jurnal Reading
    public function konfirmasi(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:bisa,tidak_bisa',
            'alasan' => 'nullable|string|max:1000',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $jadwal = JadwalJurnalReading::with(['mataKuliah', 'ruangan'])->findOrFail($id);

        // Check if dosen is assigned to this jadwal
        $isAssigned = false;
        if ($jadwal->dosen_id == $request->dosen_id) {
            $isAssigned = true;
        } elseif ($jadwal->dosen_ids && in_array($request->dosen_id, $jadwal->dosen_ids)) {
            $isAssigned = true;
        }

        if (!$isAssigned) {
            return response()->json([
                'message' => 'Anda tidak memiliki akses untuk mengkonfirmasi jadwal ini'
            ], 403);
        }

        $jadwal->update([
            'status_konfirmasi' => $request->status,
            'alasan_konfirmasi' => $request->alasan
        ]);

        // LONG-TERM FIX: Update dosen_ids based on confirmation status
        $this->updateDosenIdsBasedOnConfirmation($jadwal, $request->dosen_id, $request->status);


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading deleted');


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading updated');


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading created');

        // Get dosen info
        $dosen = User::find($request->dosen_id);

        // Save to history
        $this->saveRiwayatKonfirmasi($jadwal, $request->status, $request->alasan, $request->dosen_id);

        // Send notification
        if ($request->status === 'tidak_bisa') {
            $this->sendReplacementNotification($jadwal, $request->dosen_id, $request->alasan);
        } elseif ($request->status === 'bisa') {
            $this->sendConfirmationNotification($jadwal, 'bisa', $dosen);
        }

        return response()->json(['message' => 'Konfirmasi berhasil disimpan', 'status' => $request->status]);
    }

    // Ajukan reschedule jadwal Jurnal Reading
    public function reschedule(Request $request, $id)
    {
        $request->validate([
            'reschedule_reason' => 'required|string|max:1000',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $jadwal = JadwalJurnalReading::with(['mataKuliah', 'ruangan'])->findOrFail($id);

        // Check if dosen is assigned to this jadwal
        $isAssigned = false;
        if ($jadwal->dosen_id == $request->dosen_id) {
            $isAssigned = true;
        } elseif ($jadwal->dosen_ids && in_array($request->dosen_id, $jadwal->dosen_ids)) {
            $isAssigned = true;
        }

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

    // Get jadwal Jurnal Reading for mahasiswa
    public function getJadwalForMahasiswa($mahasiswaId, Request $request)
    {
        try {
            $mahasiswa = User::where('id', $mahasiswaId)->where('role', 'mahasiswa')->first();
            if (!$mahasiswa) {
                return response()->json(['message' => 'Mahasiswa tidak ditemukan', 'data' => []], 404);
            }

            $kelompokKecil = KelompokKecil::where('mahasiswa_id', $mahasiswaId)->first();
            if (!$kelompokKecil) {
                return response()->json(['message' => 'Mahasiswa belum memiliki kelompok', 'data' => []]);
            }

            // Cari jadwal berdasarkan nama_kelompok dan semester, bukan hanya kelompok_kecil_id
            // Ini mengatasi masalah duplikasi kelompok dengan nama yang sama
            $jadwal = JadwalJurnalReading::with(['mataKuliah', 'kelompokKecil', 'dosen', 'ruangan'])
                ->whereHas('kelompokKecil', function ($query) use ($kelompokKecil) {
                    $query->where('nama_kelompok', $kelompokKecil->nama_kelompok)
                        ->where('semester', $kelompokKecil->semester);
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
                    'topik' => $item->topik ?? 'N/A',
                    'mata_kuliah_nama' => $item->mataKuliah->nama ?? 'N/A',
                    'dosen' => $item->dosen ? ['id' => $item->dosen->id, 'name' => $item->dosen->name] : null,
                    'ruangan' => $item->ruangan ? ['id' => $item->ruangan->id, 'nama' => $item->ruangan->nama] : null,
                    'jumlah_sesi' => 2,
                    'status_konfirmasi' => $item->status_konfirmasi ?? 'belum_konfirmasi',
                    'status_reschedule' => $item->status_reschedule ?? null,
                    'semester_type' => 'reguler',
                ];
            });

            return response()->json([
                'message' => 'Data jadwal Jurnal Reading berhasil diambil',
                'data' => $mappedJadwal,
                'count' => $mappedJadwal->count()
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching jadwal Jurnal Reading for mahasiswa: ' . $e->getMessage());
            return response()->json(['message' => 'Terjadi kesalahan', 'error' => $e->getMessage(), 'data' => []], 500);
        }
    }

    /**
     * Kirim notifikasi reschedule ke admin
     */
    private function sendRescheduleNotification($jadwal, $reason)
    {
        try {
            $dosen = User::find($jadwal->dosen_id);

            // Buat hanya 1 notifikasi yang bisa dilihat oleh semua admin
            // Gunakan user_id = 1 (super admin pertama) sebagai representasi
            $firstAdmin = User::where('role', 'super_admin')->first() ?? User::where('role', 'tim_akademik')->first();

            if ($firstAdmin) {
                Notification::create([
                    'user_id' => $firstAdmin->id,
                    'title' => 'Permintaan Reschedule Jadwal',
                    'message' => "Dosen {$dosen->name} mengajukan reschedule untuk jadwal Jurnal Reading. Alasan: {$reason}",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'jurnal_reading',
                        'dosen_name' => $dosen->name,
                        'dosen_id' => $dosen->id,
                        'reschedule_reason' => $reason,
                        'notification_type' => 'reschedule_request'
                    ]
                ]);
            }

            \Log::info("Reschedule notification sent for Jurnal Reading jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Error sending reschedule notification for Jurnal Reading jadwal ID: {$jadwal->id}: " . $e->getMessage());
        }
    }

    // Import Excel untuk Jurnal Reading
    public function importExcel(Request $request, $kode)
    {
        try {
            $data = $request->validate([
                'data' => 'required|array',
                'data.*.tanggal' => 'required|date',
                'data.*.jam_mulai' => 'required|string',
                'data.*.jam_selesai' => 'required|string',
                'data.*.jumlah_sesi' => 'required|integer|min:1|max:6',
                'data.*.kelompok_kecil_id' => 'nullable|integer|min:1',
                'data.*.kelompok_kecil_antara_id' => 'nullable|integer|min:1',
                'data.*.dosen_id' => 'required|integer|min:1',
                'data.*.ruangan_id' => 'required|integer|min:1',
                'data.*.topik' => 'required|string',
            ]);

            $mataKuliah = MataKuliah::where('kode', $kode)->first();
            if (!$mataKuliah) {
                return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
            }

            $isSemesterAntara = !empty($data['data'][0]['kelompok_kecil_antara_id'] ?? null);

            $excelDataForAntarBaris = array_map(function ($row) use ($kode) {
                $row['mata_kuliah_kode'] = $kode;
                return $row;
            }, $data['data']);

            $antarBarisErrors = $this->validationService->validateAntarBarisExcel($excelDataForAntarBaris, 'jurnal_reading', $isSemesterAntara);
            if (!empty($antarBarisErrors)) {
                return response()->json([
                    'success' => 0,
                    'total' => count($data['data']),
                    'errors' => $antarBarisErrors,
                    'message' => 'Gagal mengimport data. Perbaiki error terlebih dahulu.'
                ], 422);
            }

            $errors = [];
            $validData = [];

            // Validasi semua data terlebih dahulu (all or nothing approach)
            foreach ($data['data'] as $index => $row) {
                $rowErrors = [];

                $row['mata_kuliah_kode'] = $kode;
                $rowIsSemesterAntara = !empty($row['kelompok_kecil_antara_id'] ?? null);

                if ($rowIsSemesterAntara) {
                    $row['kelompok_kecil_id'] = null;
                } else {
                    $row['kelompok_kecil_antara_id'] = null;
                }

                $tanggalMessage = $this->validationService->validateTanggalMataKuliah($row, $mataKuliah);
                if ($tanggalMessage) {
                    $rowErrors[] = $tanggalMessage;
                }

                // Validasi kelompok kecil (reguler vs antara)
                if ($rowIsSemesterAntara) {
                    $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($row['kelompok_kecil_antara_id']);
                    if (!$kelompokKecilAntara) {
                        $rowErrors[] = "Kelompok kecil antara tidak ditemukan";
                    }
                } else {
                    $kelompokKecil = \App\Models\KelompokKecil::find($row['kelompok_kecil_id']);
                    if (!$kelompokKecil) {
                        $rowErrors[] = "Kelompok kecil tidak ditemukan";
                    } else {
                        // Validasi semester kelompok kecil sesuai dengan mata kuliah
                        if ($kelompokKecil->semester != $mataKuliah->semester) {
                            $rowErrors[] = "Semester kelompok kecil tidak sesuai dengan mata kuliah";
                        }
                    }
                }

                // Validasi dosen
                $dosen = \App\Models\User::find($row['dosen_id']);
                if (!$dosen) {
                    $rowErrors[] = "Dosen tidak ditemukan";
                } else {
                    // Validasi dosen harus sudah di-assign untuk PBL atau standby
                    $isAssignedPBL = \App\Models\PBLMapping::where('dosen_id', $row['dosen_id'])->exists();
                    $isStandby = is_array($dosen->keahlian)
                        ? in_array('standby', $dosen->keahlian)
                        : (strpos($dosen->keahlian ?? '', 'standby') !== false);

                    if (!$isAssignedPBL && !$isStandby) {
                        $rowErrors[] = "Dosen belum di-generate untuk PBL. Hanya dosen yang sudah di-generate atau dosen standby yang boleh digunakan";
                    }
                }

                // Validasi ruangan
                $ruangan = \App\Models\Ruangan::find($row['ruangan_id']);
                if (!$ruangan) {
                    $rowErrors[] = "Ruangan tidak ditemukan";
                }

                $kapasitasMessage = $this->validationService->validateRoomCapacity($row, 'jurnal_reading', $rowIsSemesterAntara);
                if ($kapasitasMessage) {
                    $rowErrors[] = $kapasitasMessage;
                }

                $bentrokMessage = $this->validationService->validateConflict($row, 'jurnal_reading', null, $rowIsSemesterAntara);
                if ($bentrokMessage) {
                    $rowErrors[] = $bentrokMessage;
                }

                if (!empty($rowErrors)) {
                    $errors[] = "Baris " . ($index + 1) . ": " . implode(', ', $rowErrors);
                } else {
                    $validData[] = $row;
                }
            }

            // Jika ada error, return semua error (all or nothing)
            if (!empty($errors)) {
                return response()->json([
                    'success' => 0,
                    'total' => count($data['data']),
                    'errors' => $errors,
                    'message' => 'Gagal mengimport data. Perbaiki error terlebih dahulu.'
                ], 422);
            }

            // Jika semua data valid, import semua data menggunakan database transaction
            \DB::beginTransaction();
            try {
                $importedCount = 0;
                foreach ($validData as $row) {
                    $jadwalData = [
                        'mata_kuliah_kode' => $kode,
                        'tanggal' => $row['tanggal'],
                        'jam_mulai' => $row['jam_mulai'],
                        'jam_selesai' => $row['jam_selesai'],
                        'jumlah_sesi' => $row['jumlah_sesi'],
                        'kelompok_kecil_id' => $row['kelompok_kecil_id'],
                        'kelompok_kecil_antara_id' => $row['kelompok_kecil_antara_id'],
                        'dosen_id' => $row['dosen_id'],
                        'ruangan_id' => $row['ruangan_id'],
                        'topik' => $row['topik'],
                    ];

                    $jadwal = \App\Models\JadwalJurnalReading::create($jadwalData);

                    // Kirim notifikasi ke dosen yang di-assign
                    if ($row['dosen_id']) {
                        $dosen = \App\Models\User::find($row['dosen_id']);
                        if ($dosen) {
                            \App\Models\Notification::create([
                                'user_id' => $row['dosen_id'],
                                'title' => 'Jadwal Jurnal Reading Baru',
                                'message' => "Anda telah di-assign untuk mengajar Jurnal Reading {$mataKuliah->nama} pada tanggal {$row['tanggal']} jam {$row['jam_mulai']}-{$row['jam_selesai']} di ruangan {$jadwal->ruangan->nama}. Silakan konfirmasi ketersediaan Anda.",
                                'type' => 'info',
                                'data' => [
                                    'topik' => $row['topik'],
                                    'materi' => $row['topik'],
                                    'ruangan' => $jadwal->ruangan->nama,
                                    'tanggal' => $row['tanggal'],
                                    'jadwal_id' => $jadwal->id,
                                    'jam_mulai' => $row['jam_mulai'],
                                    'jadwal_type' => 'jurnal_reading',
                                    'jam_selesai' => $row['jam_selesai'],
                                    'mata_kuliah_kode' => $kode,
                                    'mata_kuliah_nama' => $mataKuliah->nama,
                                    'kelompok_kecil_id' => $row['kelompok_kecil_id'],
                                    'dosen_id' => $dosen->id,
                                    'dosen_name' => $dosen->name,
                                    'dosen_role' => $dosen->role
                                ]
                            ]);
                        }
                    }

                    $importedCount++;
                }

                \DB::commit();

                // Log activity
                activity()
                    ->withProperties([
                        'mata_kuliah_kode' => $kode,
                        'imported_count' => $importedCount,
                        'total_data' => count($data['data'])
                    ])
                    ->log('Import Excel Jadwal Jurnal Reading');

                return response()->json([
                    'success' => $importedCount,
                    'total' => count($data['data']),
                    'errors' => [],
                    'message' => "Berhasil mengimport {$importedCount} dari " . count($data['data']) . " jadwal jurnal reading"
                ]);
            } catch (\Exception $e) {
                \DB::rollback();
                return response()->json([
                    'success' => 0,
                    'total' => count($data['data']),
                    'errors' => ["Terjadi kesalahan saat menyimpan data: " . $e->getMessage()],
                    'message' => "Gagal mengimport data. Terjadi kesalahan saat menyimpan."
                ], 422);
            }
        } catch (\Exception $e) {
            \Log::error('Error importing Jurnal Reading Excel: ' . $e->getMessage());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengimport data: ' . $e->getMessage()
            ], 500);
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
                    \Illuminate\Support\Facades\Log::info("Adding dosen {$dosenId} to dosen_ids for jurnal jadwal {$jadwal->id}");
                }
            } elseif ($status === 'tidak_bisa') {
                // Remove dosen from dosen_ids
                $currentDosenIds = array_filter($currentDosenIds, function ($id) use ($dosenId) {
                    return $id != $dosenId;
                });
                $currentDosenIds = array_values($currentDosenIds); // Re-index array
                \Illuminate\Support\Facades\Log::info("Removing dosen {$dosenId} from dosen_ids for jurnal jadwal {$jadwal->id}");
            }

            // Update jadwal with new dosen_ids
            $jadwal->update(['dosen_ids' => $currentDosenIds]);

            \Illuminate\Support\Facades\Log::info("Updated dosen_ids for jurnal jadwal {$jadwal->id}: " . json_encode($currentDosenIds));
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Error updating dosen_ids for jurnal jadwal {$jadwal->id}: " . $e->getMessage());
        }
    }

    private function saveRiwayatKonfirmasi($jadwal, $status, $alasan = null, $dosen_id = null)
    {
        try {
            \App\Models\RiwayatKonfirmasiDosen::create([
                'dosen_id' => $dosen_id ?: $jadwal->dosen_id,
                'jadwal_type' => 'jurnal_reading',
                'jadwal_id' => $jadwal->id,
                'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                'tanggal' => $jadwal->tanggal,
                'jam_mulai' => $jadwal->jam_mulai,
                'jam_selesai' => $jadwal->jam_selesai,
                'ruangan' => $jadwal->ruangan->nama,
                'materi' => $jadwal->topik,
                'topik' => $jadwal->topik,
                'status_konfirmasi' => $status,
                'alasan_konfirmasi' => $alasan,
                'waktu_konfirmasi' => now()
            ]);
        } catch (\Exception $e) {
            \Log::error("Gagal menyimpan riwayat konfirmasi jurnal reading: " . $e->getMessage());
        }
    }

    private function sendConfirmationNotification($jadwal, $status, $dosen)
    {
        try {
            \Log::info("Memulai pengiriman notifikasi konfirmasi untuk jadwal ID: {$jadwal->id}, Status: {$status}");
            $superAdmins = \App\Models\User::where('role', 'super_admin')->get();
            \Log::info("Ditemukan {$superAdmins->count()} super admin");
            $statusText = $status === 'bisa' ? 'Bisa Mengajar' : 'Tidak Bisa Mengajar';
            $type = $status === 'bisa' ? 'success' : 'warning';
            foreach ($superAdmins as $admin) {
                \Log::info("Mengirim notifikasi ke admin ID: {$admin->id}, Nama: {$admin->name}");
                \App\Models\Notification::create([
                    'user_id' => $dosen->id,
                    'title' => "Konfirmasi Jadwal - {$statusText}",
                    'message' => "Dosen {$dosen->name} telah mengkonfirmasi {$statusText} untuk jadwal Jurnal Reading {$jadwal->mataKuliah->nama} pada tanggal " .
                        date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                        str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                        " di ruangan {$jadwal->ruangan->nama}.",
                    'type' => $type,
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'jurnal_reading',
                        'dosen_id' => $dosen->id,
                        'dosen_name' => $dosen->name,
                        'dosen_role' => $dosen->role,
                        'mata_kuliah' => $jadwal->mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal,
                        'waktu' => $jadwal->jam_mulai . ' - ' . $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'status_konfirmasi' => $status
                    ]
                ]);
            }
            \Log::info("Notifikasi konfirmasi {$status} berhasil dikirim ke super admin untuk jadwal jurnal reading ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Gagal mengirim notifikasi konfirmasi: " . $e->getMessage());
        }
    }


    /**
     * Kirim notifikasi replacement ke super admin
     */
    private function sendReplacementNotification($jadwal, $dosenId, $alasan = null)
    {
        try {
            $dosen = \App\Models\User::find($dosenId);
            $superAdmins = \App\Models\User::where('role', 'super_admin')->get();
            $alasanText = $alasan ? "\n\nAlasan: {$alasan}" : "";

            foreach ($superAdmins as $admin) {
                \App\Models\Notification::create([
                    'user_id' => $admin->id,
                    'title' => 'Dosen Tidak Bisa Mengajar - Jurnal Reading',
                    'message' => "Dosen {$dosen->name} tidak bisa mengajar pada jadwal Jurnal Reading {$jadwal->mataKuliah->nama} pada tanggal " .
                        date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                        str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                        " di ruangan {$jadwal->ruangan->nama}.{$alasanText}",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'jurnal_reading',
                        'dosen_id' => $dosenId,
                        'dosen_name' => $dosen->name, // Simpan nama dosen untuk ditampilkan di frontend
                        'mata_kuliah' => $jadwal->mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal,
                        'waktu' => $jadwal->jam_mulai . ' - ' . $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'alasan' => $alasan
                    ]
                ]);
            }

            \Log::info("Jurnal Reading replacement notification sent for jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Error sending Jurnal Reading replacement notification for jadwal ID: {$jadwal->id}: " . $e->getMessage());
        }
    }
}
