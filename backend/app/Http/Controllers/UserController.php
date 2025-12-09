<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Imports\DosenImport;
use Maatwebsite\Excel\Facades\Excel;
use App\Imports\MahasiswaImport;
use App\Imports\TimAkademikImport;
use Illuminate\Validation\Rule;
use App\Models\DosenPeran;
use App\Services\SemesterService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\AbsensiDosenPraktikum;


class UserController extends Controller
{
    protected $semesterService;

    public function __construct(SemesterService $semesterService)
    {
        $this->semesterService = $semesterService;
    }

    // GET /users?role=tim_akademik|dosen|mahasiswa
    public function index(Request $request)
    {
        $query = User::query();
        if ($request->has('role')) {
            $query->where('role', $request->role);
        }
        if ($request->has('semester')) {
            $query->where('semester', $request->semester);
        }
        if ($request->has('keahlian')) {
            $keahlian = trim($request->keahlian);
            $keahlianLower = strtolower($keahlian);
            
            // Case-insensitive search for keahlian
            // Use multiple approaches to handle different data formats and case variations
            $query->where(function ($q) use ($keahlian, $keahlianLower) {
                // 1. Exact match (case-sensitive) - for exact matches
                $q->whereJsonContains('keahlian', $keahlian)
                    // 2. Case-insensitive JSON search - check if any array element matches (case-insensitive)
                    ->orWhereRaw('LOWER(JSON_EXTRACT(keahlian, "$")) LIKE ?', ['%"' . $keahlianLower . '"%'])
                    // 3. Fallback: LIKE search on JSON string representation (handles edge cases)
                    ->orWhereRaw('LOWER(CAST(keahlian AS CHAR)) LIKE ?', ['%"' . $keahlianLower . '"%'])
                    ->orWhereRaw('LOWER(CAST(keahlian AS CHAR)) LIKE ?', ['%' . $keahlianLower . '%']);
            });
        }
        
        // Optimize: Gunakan pagination untuk menghindari load semua data sekaligus
        $perPage = $request->get('per_page', 50); // Default 50 items per page
        $users = $query->paginate($perPage);
        
        // Tambahan: jika role dosen, tambahkan field peran multi
        if ($request->role === 'dosen') {
            $users->getCollection()->transform(function ($user) {
                $userArr = $user->toArray();
                $userArr['dosen_peran'] = $user->dosenPeran()->with('mataKuliah')->get()->map(function ($peran) {
                    return [
                        'id' => $peran->id,
                        'tipe_peran' => $peran->tipe_peran,
                        'mata_kuliah_kode' => $peran->mata_kuliah_kode,
                        'mata_kuliah_nama' => $peran->mataKuliah ? $peran->mataKuliah->nama : null,
                        'blok' => $peran->blok,
                        'semester' => $peran->semester,
                        'peran_kurikulum' => $peran->peran_kurikulum,
                    ];
                });
                return $userArr;
            });
        }
        return response()->json($users);
    }

    // GET /users/{id}
    public function show($id)
    {
        try {
            $user = User::findOrFail($id);

            // Jika user adalah dosen, tambahkan data dosen_peran
            if ($user->role === 'dosen') {
                $userArr = $user->toArray();
                $userArr['dosen_peran'] = $user->dosenPeran()->with('mataKuliah')->get()->map(function ($peran) {
                    return [
                        'id' => $peran->id,
                        'tipe_peran' => $peran->tipe_peran,
                        'mata_kuliah_kode' => $peran->mata_kuliah_kode,
                        'mata_kuliah_nama' => $peran->mataKuliah ? $peran->mataKuliah->nama : null,
                        'blok' => $peran->blok,
                        'semester' => $peran->semester,
                        'peran_kurikulum' => $peran->peran_kurikulum,
                    ];
                });
                return response()->json($userArr);
            }

            return response()->json($user);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'User tidak ditemukan',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    // POST /users
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'username' => [
                'required',
                'string',
                Rule::unique('users')->where(function ($query) use ($request) {
                    return $query->where('role', $request->role);
                }),
            ],
            'email' => [
                'nullable',
                'email',
                Rule::unique('users')->where(function ($query) use ($request) {
                    return $query->where('role', $request->role);
                }),
            ],
            'nip' => 'nullable|unique:users,nip',
            'nid' => 'nullable|unique:users,nid',
            'nidn' => 'nullable',
            'nuptk' => 'nullable',
            'nim' => 'nullable|unique:users,nim|min:8|max:15',
            'telp' => 'nullable',
            'ket' => 'nullable',
            'gender' => 'nullable',
            'ipk' => 'nullable|numeric',
            'status' => 'nullable',
            'angkatan' => 'nullable',
            'role' => 'required|in:super_admin,tim_akademik,dosen,mahasiswa',
            'password' => 'required|string|min:6',
            'kompetensi' => 'nullable',
            'keahlian' => 'nullable',
            'semester' => 'nullable|integer|min:1|max:8',
            'dosen_peran' => 'nullable|array', // array of peran
        ]);
        $validated['password'] = Hash::make($validated['password']);

        // Convert kompetensi from string to array if it's a string (e.g., from form input)
        if (isset($validated['kompetensi']) && is_string($validated['kompetensi'])) {
            $validated['kompetensi'] = array_map('trim', explode(',', $validated['kompetensi']));
        }

        // Hilangkan validasi dan assignment peran_utama dan peran_kurikulum
        $dosenPeran = $request->input('dosen_peran', []);

        // Tambahkan validasi: maksimal 2 peran di blok yang sama untuk satu dosen
        $blokCount = [];
        foreach ($dosenPeran as $peran) {
            if (($peran['tipe_peran'] ?? null) !== 'mengajar' && !empty($peran['mata_kuliah_kode'])) {
                $kode = $peran['mata_kuliah_kode'];
                $blokCount[$kode] = ($blokCount[$kode] ?? 0) + 1;
            }
        }
        foreach ($blokCount as $kode => $count) {
            if ($count > 2) {
                // Ambil nama blok jika bisa
                $mk = \App\Models\MataKuliah::where('kode', $kode)->first();
                $nama = $mk ? $mk->nama : $kode;
                return response()->json([
                    'message' => "Maksimal 2 peran di blok $nama untuk satu dosen.",
                ], 422);
            }
        }
        $user = User::create($validated);

        // Jika user adalah mahasiswa, update semester berdasarkan semester aktif
        if ($user->role === 'mahasiswa') {
            $this->semesterService->updateNewStudentSemester($user);
        }

        // Simpan peran ke tabel dosen_peran
        foreach ($dosenPeran as $peran) {
            DosenPeran::create([
                'user_id' => $user->id,
                'tipe_peran' => $peran['tipe_peran'],
                'mata_kuliah_kode' => $peran['tipe_peran'] === 'mengajar' ? null : $peran['mata_kuliah_kode'],
                'peran_kurikulum' => $peran['peran_kurikulum'],
                'blok' => $peran['tipe_peran'] === 'mengajar' ? null : ($peran['blok'] ?? null),
                'semester' => $peran['tipe_peran'] === 'mengajar' ? null : ($peran['semester'] ?? null),
            ]);
        }

        return response()->json($user, 201);
    }

    // PUT /users/{id}
    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string',
            'username' => [
                'sometimes',
                'required',
                'string',
                Rule::unique('users')->where(function ($query) use ($request, $user) {
                    return $query->where('role', $request->role ?? $user->role);
                })->ignore($user->id),
            ],
            'email' => [
                'nullable',
                'email',
                Rule::unique('users')->where(function ($query) use ($request, $user) {
                    return $query->where('role', $request->role ?? $user->role);
                })->ignore($user->id),
            ],
            'nip' => 'nullable|unique:users,nip,' . $user->id,
            'nid' => 'nullable|unique:users,nid,' . $user->id,
            'nidn' => 'nullable',
            'nuptk' => 'nullable',
            'nim' => 'nullable|unique:users,nim,' . $user->id . '|min:8|max:15',
            'telp' => 'nullable',
            'ket' => 'nullable',
            'gender' => 'nullable',
            'ipk' => 'nullable|numeric',
            'status' => 'nullable',
            'angkatan' => 'nullable',
            'role' => 'sometimes|required|in:super_admin,tim_akademik,dosen,mahasiswa',
            'password' => 'nullable|string|min:6',
            'kompetensi' => 'nullable',
            'keahlian' => 'nullable',
            'semester' => 'nullable|integer|min:1|max:8',
            // Tidak boleh update dosen_peran dari sini
        ]);
        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }
        if (isset($validated['kompetensi']) && is_string($validated['kompetensi'])) {
            $validated['kompetensi'] = array_map('trim', explode(',', $validated['kompetensi']));
        }
        // Tambahkan konversi keahlian jika string
        if (isset($validated['keahlian']) && is_string($validated['keahlian'])) {
            $validated['keahlian'] = array_map('trim', explode(',', $validated['keahlian']));
        }
        $user->update($validated);

        // Handle dosen_peran jika ada
        if ($request->has('dosen_peran') && is_array($request->dosen_peran)) {
            // Hapus hanya dosen_peran dengan tipe_peran koordinator atau tim_blok
            // Jangan hapus dosen_mengajar karena itu di-generate otomatis dari assignment
            DosenPeran::where('user_id', $user->id)
                ->whereIn('tipe_peran', ['koordinator', 'tim_blok'])
                ->delete();

            // Tambahkan dosen_peran yang baru (hanya koordinator dan tim_blok)
            foreach ($request->dosen_peran as $peran) {
                // Pastikan hanya koordinator dan tim_blok yang disimpan
                if (in_array($peran['tipe_peran'] ?? '', ['koordinator', 'tim_blok'])) {
                DosenPeran::create([
                    'user_id' => $user->id,
                    'mata_kuliah_kode' => $peran['mata_kuliah_kode'],
                    'peran_kurikulum' => $peran['peran_kurikulum'],
                    'blok' => $peran['blok'] ?? null,
                    'semester' => $peran['semester'] ?? null,
                    'tipe_peran' => $peran['tipe_peran'],
                ]);
            }
            }
        } else {
            // Jika dosen_peran tidak ada di request (selectedPeranType === "none"),
            // hapus hanya koordinator dan tim_blok, biarkan dosen_mengajar tetap ada
            DosenPeran::where('user_id', $user->id)
                ->whereIn('tipe_peran', ['koordinator', 'tim_blok'])
                ->delete();
        }

        return response()->json($user);
    }

    // DELETE /users/{id}
    public function destroy($id)
    {
        $user = User::findOrFail($id);

        // Reset login status and delete all tokens
        $user->is_logged_in = 0;
        $user->current_token = null;
        $user->save();
        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }

    // Import Dosen
    public function importDosen(Request $request)
    {
        // Set timeout yang lebih lama untuk import data banyak
        set_time_limit(300); // 5 menit

        $request->validate([
            'file' => 'required|mimes:xlsx,xls',
        ]);

        $import = new DosenImport();
        Excel::import($import, $request->file('file'));

        $errors = $import->getErrors();
        $failedRows = $import->getFailedRows();
        $cellErrors = $import->getCellErrors();

        // Hitung jumlah baris di file (tanpa header)
        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($request->file('file')->getPathname());
        $sheet = $spreadsheet->getActiveSheet();
        $totalRows = $sheet->getHighestDataRow() - 1; // -1 untuk header

        $importedCount = $totalRows - count($failedRows);

        activity()
            ->causedBy(Auth::user())
            ->log("Mengimpor {$importedCount} data dosen dari file: {$request->file('file')->getClientOriginalName()}");

        if ($importedCount > 0) {
            // Ada data valid yang berhasil diimpor
            return response()->json([
                'imported_count' => $importedCount,
                'errors' => $errors,
                'failed_rows' => $failedRows,
                'cell_errors' => $cellErrors,
            ], 200);
        } else {
            // Semua data gagal, return 422
            return response()->json([
                'message' => 'Semua data gagal diimpor. Periksa kembali format dan isian data.',
                'errors' => $errors,
                'cell_errors' => $cellErrors,
            ], 422);
        }
    }

    // Import Mahasiswa
    public function importMahasiswa(Request $request)
    {
        try {
            $request->validate([
                'file' => 'required|mimes:xlsx,xls',
            ]);

            // Set timeout untuk proses import yang besar
            set_time_limit(1200); // 20 menit
            ini_set('memory_limit', '2048M'); // 2GB
            ini_set('max_execution_time', 1200);

            // Optimize database for speed (removed problematic settings)
            DB::statement('SET SESSION sql_mode = ""');

            $import = new \App\Imports\HybridMahasiswaImport();

            // Gunakan chunk untuk import yang lebih efisien dengan transaction safety
            DB::beginTransaction();
            try {
                \Maatwebsite\Excel\Facades\Excel::import($import, $request->file('file'));
                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                Log::error("Import failed, transaction rolled back: " . $e->getMessage());
                throw $e;
            }

            $errors = $import->getErrors();
            $failedRows = $import->getFailedRows();
            $cellErrors = $import->getCellErrors();
            $totalProcessed = $import->getTotalProcessed();
            $totalFailed = $import->getTotalFailed();
            $importedCount = $import->getImportedCount();

            // Debug logging
            Log::info("Import Debug - Total processed: {$totalProcessed}, Total failed: {$totalFailed}, Imported count: {$importedCount}");
            Log::info("Import Response - Errors count: " . count($errors) . ", Failed rows count: " . count($failedRows));

            // Database settings restored automatically

            activity()
                ->causedBy(Auth::user())
                ->log("Mengimpor {$importedCount} data mahasiswa dari file: {$request->file('file')->getClientOriginalName()}");

            if ($importedCount > 0) {
                // Ada data valid yang berhasil diimpor
                if ($totalFailed > 0) {
                    $message = "Berhasil mengimpor {$importedCount} dari {$totalProcessed} data mahasiswa. Ada {$totalFailed} data yang gagal diimpor.";
                } else {
                    $message = "Berhasil mengimpor {$importedCount} data mahasiswa.";
                }

                return response()->json([
                    'imported_count' => $importedCount,
                    'total_rows' => $totalProcessed,
                    'failed_count' => $totalFailed,
                    'errors' => $errors,
                    'failed_rows' => $failedRows,
                    'cell_errors' => $cellErrors,
                    'message' => $message,
                    'success' => true
                ], 200);
            } else {
                // Semua data gagal, return 422
                return response()->json([
                    'imported_count' => 0,
                    'total_rows' => $totalProcessed,
                    'failed_count' => $totalFailed,
                    'message' => 'Semua data gagal diimpor. Periksa kembali format dan isian data.',
                    'errors' => $errors,
                    'cell_errors' => $cellErrors,
                    'success' => false
                ], 422);
            }
        } catch (\Exception $e) {
            Log::error("Error in importMahasiswa: " . $e->getMessage());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengimpor data: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Import Tim Akademik
    public function importTimAkademik(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls',
        ]);

        $import = new TimAkademikImport();
        \Maatwebsite\Excel\Facades\Excel::import($import, $request->file('file'));

        $errors = $import->getErrors();
        $failedRows = $import->getFailedRows();
        $cellErrors = $import->getCellErrors();

        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($request->file('file')->getPathname());
        $sheet = $spreadsheet->getActiveSheet();
        $totalRows = $sheet->getHighestDataRow() - 1; // -1 untuk header

        $importedCount = $totalRows - count($failedRows);

        activity()
            ->causedBy(Auth::user())
            ->log("Mengimpor {$importedCount} data tim akademik dari file: {$request->file('file')->getClientOriginalName()}");

        if ($importedCount > 0) {
            // Ada data valid yang berhasil diimpor
            return response()->json([
                'imported_count' => $importedCount,
                'errors' => $errors,
                'failed_rows' => $failedRows,
                'cell_errors' => $cellErrors,
            ], 200);
        } else {
            // Semua data gagal, return 422
            return response()->json([
                'message' => 'Semua data gagal diimpor. Periksa kembali format dan isian data.',
                'errors' => $errors,
                'cell_errors' => $cellErrors,
            ], 422);
        }
    }

    public function getJadwalMengajar($id, Request $request)
    {
        try {
            $dosen = User::findOrFail($id);
            // Default ke 'all' untuk mendapatkan semua jadwal (reguler + antara)
            $semesterType = $request->query('semester_type', 'all');

            // Log untuk debug
            Log::info("Fetching jadwal mengajar for dosen ID: {$id}, semester_type: {$semesterType}");

            // Ambil semua jadwal mengajar dosen menggunakan controller yang sudah ada
            $jadwalMengajar = collect();

            // 1. Jadwal Kuliah Besar
            try {
                $kuliahBesarController = new \App\Http\Controllers\JadwalKuliahBesarController();
                $kuliahBesarRequest = new \Illuminate\Http\Request();
                $kuliahBesarRequest->query->set('semester_type', $semesterType);
                $kuliahBesarResponse = $kuliahBesarController->getJadwalForDosen($id, $kuliahBesarRequest);
                $kuliahBesarData = $kuliahBesarResponse->getData();

                if (isset($kuliahBesarData->data)) {
                    $jadwalKuliahBesar = collect($kuliahBesarData->data)->map(function ($item) {
                        // Handle item bisa array atau object
                        $isArray = is_array($item);

                        // Ambil mata_kuliah_kode untuk fetch dari database
                        $mataKuliahKode = $isArray ? ($item['mata_kuliah_kode'] ?? '') : ($item->mata_kuliah_kode ?? '');

                        // Fetch mata kuliah dari database untuk konsistensi
                        $mataKuliah = null;
                        if ($mataKuliahKode) {
                            try {
                                $mataKuliah = \App\Models\MataKuliah::where('kode', $mataKuliahKode)->first();
                            } catch (\Exception $e) {
                                Log::error("Error fetching mata kuliah for kuliah besar: " . $e->getMessage());
                            }
                        }

                        // Handle ruangan_nama (bisa dari array atau object)
                        $ruanganNama = '';
                        if ($isArray) {
                            if (isset($item['ruangan']) && is_array($item['ruangan'])) {
                                $ruanganNama = $item['ruangan']['nama'] ?? '';
                            }
                        } else {
                            if ($item->ruangan) {
                                if (is_object($item->ruangan)) {
                                    $ruanganNama = $item->ruangan->nama ?? '';
                                } elseif (is_array($item->ruangan)) {
                                    $ruanganNama = $item->ruangan['nama'] ?? '';
                                }
                            }
                        }

                        // Handle tanggal (bisa format d/m/Y dari response)
                        $tanggal = $isArray ? ($item['tanggal'] ?? '') : ($item->tanggal ?? '');
                        if ($tanggal && strpos($tanggal, '/') !== false) {
                            // Convert dari d/m/Y ke Y-m-d
                            $dateParts = explode('/', $tanggal);
                            if (count($dateParts) === 3) {
                                $tanggal = $dateParts[2] . '-' . $dateParts[1] . '-' . $dateParts[0];
                            }
                        }

                        // Handle kelompok_besar dan kelompok_kecil
                        $kelompokBesar = null;
                        $kelompokKecil = '';

                        if ($isArray) {
                            if (isset($item['kelompok_besar']) && is_array($item['kelompok_besar'])) {
                                $kelompokBesar = (object) $item['kelompok_besar'];
                                $kelompokKecil = $item['kelompok_besar']['nama_kelompok'] ?? '';
                            }
                            // Fallback jika tidak ada kelompok_besar object
                            if (empty($kelompokKecil) && isset($item['kelompok_besar_id'])) {
                                // kelompok_besar_id bisa berisi ID atau semester, coba ambil dari kelompok_besar jika ada
                                $kelompokKecil = 'Kelompok Besar Semester ' . $item['kelompok_besar_id'];
                            }
                        } else {
                            if ($item->kelompok_besar) {
                                if (is_object($item->kelompok_besar)) {
                                    $kelompokBesar = $item->kelompok_besar;
                                    $kelompokKecil = $item->kelompok_besar->nama_kelompok ?? '';
                                } elseif (is_array($item->kelompok_besar)) {
                                    $kelompokBesar = (object) $item->kelompok_besar;
                                    $kelompokKecil = $item->kelompok_besar['nama_kelompok'] ?? '';
                                }
                            }
                            // Fallback jika tidak ada kelompok_besar object
                            if (empty($kelompokKecil) && isset($item->kelompok_besar_id)) {
                                $kelompokKecil = 'Kelompok Besar Semester ' . $item->kelompok_besar_id;
                            }
                        }

                        return (object) [
                            'id' => $isArray ? ($item['id'] ?? 0) : ($item->id ?? 0),
                            'mata_kuliah_kode' => $mataKuliahKode,
                            'mata_kuliah_nama' => $isArray ? ($item['mata_kuliah_nama'] ?? '') : ($item->mata_kuliah_nama ?? ($mataKuliah ? $mataKuliah->nama : '')),
                            'tanggal' => $tanggal,
                            'jam_mulai' => $isArray ? ($item['jam_mulai'] ?? '') : ($item->jam_mulai ?? ''),
                            'jam_selesai' => $isArray ? ($item['jam_selesai'] ?? '') : ($item->jam_selesai ?? ''),
                            'jenis_jadwal' => 'kuliah_besar',
                            'topik' => $isArray ? ($item['materi'] ?? $item['topik'] ?? '') : ($item->materi ?? $item->topik ?? ''),
                            'ruangan_nama' => $ruanganNama,
                            'jumlah_sesi' => $isArray ? ($item['jumlah_sesi'] ?? 1) : ($item->jumlah_sesi ?? 1),
                            'semester' => $mataKuliah ? $mataKuliah->semester : ($isArray ? '' : ''),
                            'blok' => $mataKuliah ? $mataKuliah->blok : null,
                            'kelompok_kecil' => $kelompokKecil,
                            'kelompok_besar' => $kelompokBesar, // Tambahkan object kelompok_besar
                            'kelompok_besar_id' => $isArray ? ($item['kelompok_besar_id'] ?? null) : ($item->kelompok_besar_id ?? null),
                            'status_konfirmasi' => $isArray ? ($item['status_konfirmasi'] ?? 'belum_konfirmasi') : ($item->status_konfirmasi ?? 'belum_konfirmasi'),
                            'alasan_konfirmasi' => $isArray ? ($item['alasan_konfirmasi'] ?? null) : ($item->alasan_konfirmasi ?? null),
                            'status_reschedule' => $isArray ? ($item['status_reschedule'] ?? null) : ($item->status_reschedule ?? null),
                            'reschedule_reason' => $isArray ? ($item['reschedule_reason'] ?? null) : ($item->reschedule_reason ?? null),
                            'semester_type' => $isArray ? ($item['semester_type'] ?? 'reguler') : ($item->semester_type ?? 'reguler'),
                            'penilaian_submitted' => $isArray ? (bool)($item['penilaian_submitted'] ?? false) : (bool)($item->penilaian_submitted ?? false),
                            'mata_kuliah' => $mataKuliah ? (object) [
                                'kode' => $mataKuliah->kode,
                                'nama' => $mataKuliah->nama,
                                'semester' => $mataKuliah->semester,
                                'blok' => $mataKuliah->blok,
                            ] : null,
                        ];
                    });
                    $jadwalMengajar = $jadwalMengajar->concat($jadwalKuliahBesar);
                }
            } catch (\Exception $e) {
                Log::error("Error fetching Kuliah Besar: " . $e->getMessage());
            }

            // 2. Jadwal Praktikum
            try {
                $praktikumController = new \App\Http\Controllers\JadwalPraktikumController();
                $praktikumRequest = new \Illuminate\Http\Request();
                $praktikumRequest->query->set('semester_type', $semesterType);
                $praktikumResponse = $praktikumController->getJadwalForDosen($id, $praktikumRequest);
                $praktikumData = $praktikumResponse->getData();

                if (isset($praktikumData->data)) {
                    $jadwalPraktikum = collect($praktikumData->data)->map(function ($item) use ($id) {
                        // Fetch absensi dosen untuk jadwal ini
                        $absensiDosen = AbsensiDosenPraktikum::where('jadwal_praktikum_id', $item->id)
                            ->where('dosen_id', $id)
                            ->first();

                        // Pastikan boolean casting yang benar
                        $absensiHadir = $absensiDosen ? (bool)($absensiDosen->hadir ?? false) : false;
                        $absensiCatatan = $absensiDosen ? ($absensiDosen->catatan ?? null) : null;
                        // Pastikan penilaian_submitted di-cast sebagai boolean
                        $penilaianSubmitted = (bool)($item->penilaian_submitted ?? false);

                        // Tentukan absensi_status berdasarkan logika:
                        // 1. Jika status_konfirmasi = "tidak_bisa" → langsung "tidak_hadir"
                        // 2. Jika penilaian_submitted = false → "menunggu" (walaupun sudah simpan, tetap menunggu sampai submit)
                        // 3. Jika penilaian_submitted = true:
                        //    - Jika absensi_hadir = true → "hadir"
                        //    - Jika absensi_hadir = false → "tidak_hadir"
                        $statusKonfirmasi = $item->status_konfirmasi ?? 'belum_konfirmasi';
                        $absensiStatus = 'menunggu'; // Default

                        if ($statusKonfirmasi === 'tidak_bisa') {
                            // Jika tidak bisa mengajar, langsung tidak hadir
                            $absensiStatus = 'tidak_hadir';
                        } elseif ($penilaianSubmitted) {
                            // Jika sudah submit, tentukan berdasarkan absensi_hadir
                            $absensiStatus = $absensiHadir ? 'hadir' : 'tidak_hadir';
                        } else {
                            // Jika belum submit, tetap menunggu (walaupun sudah simpan)
                            $absensiStatus = 'menunggu';
                        }

                        return (object) [
                            'id' => $item->id,
                            'mata_kuliah_kode' => $item->mata_kuliah_kode,
                            'mata_kuliah_nama' => $item->mata_kuliah->nama ?? '',
                            'tanggal' => $item->tanggal,
                            'jam_mulai' => $item->jam_mulai,
                            'jam_selesai' => $item->jam_selesai,
                            'jenis_jadwal' => 'praktikum',
                            'topik' => $item->topik,
                            'ruangan_nama' => $item->ruangan->nama ?? '',
                            'jumlah_sesi' => $item->jumlah_sesi,
                            'semester' => $item->mata_kuliah->semester ?? '',
                            'blok' => $item->mata_kuliah->blok ?? null,
                            'kelompok_kecil' => $item->kelas_praktikum,
                            'status_konfirmasi' => $statusKonfirmasi,
                            'alasan_konfirmasi' => $item->alasan_konfirmasi ?? null,
                            'status_reschedule' => $item->status_reschedule ?? null,
                            'reschedule_reason' => $item->reschedule_reason ?? null,
                            'semester_type' => $item->semester_type ?? ($item->mata_kuliah && $item->mata_kuliah->semester === 'Antara' ? 'antara' : 'reguler'),
                            'mata_kuliah' => $item->mata_kuliah ?? null,
                            'absensi_hadir' => $absensiHadir,
                            'absensi_catatan' => $absensiCatatan,
                            'penilaian_submitted' => $penilaianSubmitted,
                            'absensi_status' => $absensiStatus
                        ];
                    });
                    $jadwalMengajar = $jadwalMengajar->concat($jadwalPraktikum);
                }
            } catch (\Exception $e) {
                Log::error("Error fetching Praktikum: " . $e->getMessage());
            }

            // 3. Jadwal Jurnal Reading
            try {
                $jurnalController = new \App\Http\Controllers\JadwalJurnalReadingController();
                $jurnalRequest = new \Illuminate\Http\Request();
                $jurnalRequest->query->set('semester_type', $semesterType);
                $jurnalResponse = $jurnalController->getJadwalForDosen($id, $jurnalRequest);
                $jurnalData = $jurnalResponse->getData();

                if (isset($jurnalData->data)) {
                    $jadwalJurnal = collect($jurnalData->data)->map(function ($item) {
                        return (object) [
                            'id' => $item->id,
                            'mata_kuliah_kode' => $item->mata_kuliah_kode,
                            'mata_kuliah_nama' => $item->mata_kuliah->nama ?? '',
                            'tanggal' => $item->tanggal,
                            'jam_mulai' => $item->jam_mulai,
                            'jam_selesai' => $item->jam_selesai,
                            'jenis_jadwal' => 'jurnal_reading',
                            'topik' => $item->topik,
                            'ruangan_nama' => $item->ruangan->nama ?? '',
                            'jumlah_sesi' => $item->jumlah_sesi,
                            'semester' => $item->mata_kuliah->semester ?? '',
                            'blok' => $item->mata_kuliah->blok ?? null,
                            'kelompok_kecil' => $item->kelompok_kecil->nama ?? $item->kelompok_kecil_antara->nama_kelompok ?? '',
                            'penilaian_submitted' => (bool)($item->penilaian_submitted ?? false),
                            'status_konfirmasi' => $item->status_konfirmasi ?? 'belum_konfirmasi',
                            'alasan_konfirmasi' => $item->alasan_konfirmasi ?? null,
                            'status_reschedule' => $item->status_reschedule ?? null,
                            'reschedule_reason' => $item->reschedule_reason ?? null
                        ];
                    });
                    $jadwalMengajar = $jadwalMengajar->concat($jadwalJurnal);
                }
            } catch (\Exception $e) {
                Log::error("Error fetching Jurnal Reading: " . $e->getMessage());
            }

            // 4. Jadwal PBL
            try {
                $pblController = new \App\Http\Controllers\JadwalPBLController();
                $pblRequest = new \Illuminate\Http\Request();
                $pblRequest->query->set('semester_type', $semesterType);
                $pblResponse = $pblController->getJadwalForDosen($id, $pblRequest);
                $pblData = $pblResponse->getData();

                if (isset($pblData->data)) {
                    Log::info("PBL data found: " . count($pblData->data) . " records for semester_type: {$semesterType}");
                    $jadwalPBL = collect($pblData->data)->map(function ($item) {
                        // Handle both array and object data
                        $isArray = is_array($item);

                        return (object) [
                            'id' => $isArray ? $item['id'] : $item->id,
                            'mata_kuliah_kode' => $isArray ? $item['mata_kuliah_kode'] : $item->mata_kuliah_kode,
                            'mata_kuliah_nama' => $isArray ? ($item['mata_kuliah_nama'] ?? '') : ($item->mata_kuliah_nama ?? ''),
                            'tanggal' => $isArray ? $item['tanggal'] : $item->tanggal,
                            'jam_mulai' => $isArray ? $item['jam_mulai'] : $item->jam_mulai,
                            'jam_selesai' => $isArray ? $item['jam_selesai'] : $item->jam_selesai,
                            'jenis_jadwal' => 'pbl',
                            'modul_pbl' => $isArray ? ($item['modul'] ?? '') : ($item->modul ?? ''),
                            'pbl_tipe' => $isArray ? $item['tipe_pbl'] : $item->tipe_pbl,
                            'ruangan_nama' => $isArray ? ($item['ruangan'] ?? '') : ($item->ruangan ?? ''),
                            'jumlah_sesi' => $isArray ? $item['x50'] : $item->x50,
                            'semester' => $isArray ? ($item['semester'] ?? '') : ($item->semester ?? ''),
                            'blok' => $isArray ? ($item['blok'] ?? null) : ($item->blok ?? null),
                            'kelompok_kecil' => $isArray ? ($item['kelompok'] ?? '') : ($item->kelompok ?? ''),
                            'semester_type' => $isArray ? ($item['semester_type'] ?? 'reguler') : ($item->semester_type ?? 'reguler'),
                            'penilaian_submitted' => $isArray ? (bool)($item['penilaian_submitted'] ?? false) : (bool)($item->penilaian_submitted ?? false),
                            'status_konfirmasi' => $isArray ? ($item['status_konfirmasi'] ?? 'belum_konfirmasi') : ($item->status_konfirmasi ?? 'belum_konfirmasi'),
                            'alasan_konfirmasi' => $isArray ? ($item['alasan_konfirmasi'] ?? null) : ($item->alasan_konfirmasi ?? null),
                            'status_reschedule' => $isArray ? ($item['status_reschedule'] ?? null) : ($item->status_reschedule ?? null),
                            'reschedule_reason' => $isArray ? ($item['reschedule_reason'] ?? null) : ($item->reschedule_reason ?? null)
                        ];
                    });
                    $jadwalMengajar = $jadwalMengajar->concat($jadwalPBL);
                    Log::info("PBL mapped: " . $jadwalPBL->count() . " records added to jadwalMengajar");
                }
            } catch (\Exception $e) {
                Log::error("Error fetching PBL: " . $e->getMessage());
            }

            // 5. Jadwal CSR
            try {
                $csrController = new \App\Http\Controllers\JadwalCSRController();
                $csrRequest = new \Illuminate\Http\Request();
                $csrRequest->query->set('semester_type', $semesterType);
                $csrResponse = $csrController->getJadwalForDosen($id, $csrRequest);
                $csrData = $csrResponse->getData();

                if (isset($csrData->data)) {
                    $jadwalCSR = collect($csrData->data)->map(function ($item) {
                        // Handle both array and object data
                        $isArray = is_array($item);

                        return (object) [
                            'id' => $isArray ? $item['id'] : $item->id,
                            'mata_kuliah_kode' => $isArray ? $item['mata_kuliah_kode'] : $item->mata_kuliah_kode,
                            'mata_kuliah_nama' => $isArray ? ($item['mata_kuliah_nama'] ?? '') : ($item->mata_kuliah_nama ?? ''),
                            'tanggal' => $isArray ? $item['tanggal'] : $item->tanggal,
                            'jam_mulai' => $isArray ? $item['jam_mulai'] : $item->jam_mulai,
                            'jam_selesai' => $isArray ? $item['jam_selesai'] : $item->jam_selesai,
                            'jenis_jadwal' => 'csr',
                            'topik' => $isArray ? $item['topik'] : $item->topik,
                            'kategori_csr' => $isArray ? ($item['kategori']['nama'] ?? '') : ($item->kategori->nama ?? ''),
                            'jenis_csr' => $isArray ? $item['jenis_csr'] : $item->jenis_csr,
                            'nomor_csr' => $isArray ? ($item['nomor_csr'] ?? '') : ($item->nomor_csr ?? ''),
                            'ruangan_nama' => $isArray ? ($item['ruangan']['nama'] ?? '') : ($item->ruangan->nama ?? ''),
                            'jumlah_sesi' => $isArray ? $item['jumlah_sesi'] : $item->jumlah_sesi,
                            'semester' => '',
                            'blok' => null,
                            'kelompok_kecil' => $isArray ? ($item['kelompok_kecil']['nama'] ?? '') : ($item->kelompok_kecil->nama ?? ''),
                            'status_konfirmasi' => $isArray ? ($item['status_konfirmasi'] ?? 'belum_konfirmasi') : ($item->status_konfirmasi ?? 'belum_konfirmasi'),
                            'alasan_konfirmasi' => $isArray ? ($item['alasan_konfirmasi'] ?? null) : ($item->alasan_konfirmasi ?? null),
                            'status_reschedule' => $isArray ? ($item['status_reschedule'] ?? null) : ($item->status_reschedule ?? null),
                            'reschedule_reason' => $isArray ? ($item['reschedule_reason'] ?? null) : ($item->reschedule_reason ?? null),
                            'penilaian_submitted' => $isArray ? ($item['penilaian_submitted'] ?? false) : ($item->penilaian_submitted ?? false)
                        ];
                    });
                    $jadwalMengajar = $jadwalMengajar->concat($jadwalCSR);
                }
            } catch (\Exception $e) {
                Log::error("Error fetching CSR: " . $e->getMessage());
            }

            // 6. Jadwal Non Blok Non CSR
            try {
                $nonBlokController = new \App\Http\Controllers\JadwalNonBlokNonCSRController();
                $nonBlokRequest = new \Illuminate\Http\Request();
                $nonBlokRequest->query->set('semester_type', $semesterType);
                $nonBlokResponse = $nonBlokController->getJadwalForDosen($id, $nonBlokRequest);
                $nonBlokData = $nonBlokResponse->getData();

                if (isset($nonBlokData->data)) {
                    $jadwalNonBlok = collect($nonBlokData->data)->map(function ($item) {
                        // Handle both array and object data
                        $isArray = is_array($item);

                        return (object) [
                            'id' => $isArray ? $item['id'] : $item->id,
                            'mata_kuliah_kode' => $isArray ? $item['mata_kuliah_kode'] : $item->mata_kuliah_kode,
                            'mata_kuliah_nama' => $isArray ? ($item['mata_kuliah_nama'] ?? '') : ($item->mata_kuliah_nama ?? ''),
                            'tanggal' => $isArray ? $item['tanggal'] : $item->tanggal,
                            'jam_mulai' => $isArray ? $item['jam_mulai'] : $item->jam_mulai,
                            'jam_selesai' => $isArray ? $item['jam_selesai'] : $item->jam_selesai,
                            'jenis_jadwal' => $isArray ? $item['jenis_baris'] : $item->jenis_baris,
                            'materi' => $isArray ? $item['materi'] : $item->materi,
                            'agenda' => $isArray ? $item['agenda'] : $item->agenda,
                            'ruangan_nama' => $isArray ? ($item['ruangan']['nama'] ?? '') : ($item->ruangan->nama ?? ''),
                            'jumlah_sesi' => $isArray ? $item['jumlah_sesi'] : $item->jumlah_sesi,
                            'semester' => '',
                            'blok' => null,
                            'kelompok_kecil' => $isArray ?
                                ($item['kelompok_besar']['semester'] ?? $item['kelompok_besar_antara']['nama_kelompok'] ?? '') : ($item->kelompok_besar->semester ?? $item->kelompok_besar_antara->nama_kelompok ?? ''),
                            'status_konfirmasi' => $isArray ? ($item['status_konfirmasi'] ?? 'belum_konfirmasi') : ($item->status_konfirmasi ?? 'belum_konfirmasi'),
                            'alasan_konfirmasi' => $isArray ? ($item['alasan_konfirmasi'] ?? null) : ($item->alasan_konfirmasi ?? null),
                            'status_reschedule' => $isArray ? ($item['status_reschedule'] ?? null) : ($item->status_reschedule ?? null),
                            'reschedule_reason' => $isArray ? ($item['reschedule_reason'] ?? null) : ($item->reschedule_reason ?? null),
                            'semester_type' => $isArray ?
                                (isset($item['kelompok_besar_antara']) && !empty($item['kelompok_besar_antara']) ? 'antara' : 'reguler') : (isset($item->kelompok_besar_antara) && !empty($item->kelompok_besar_antara) ? 'antara' : 'reguler'),
                            'mata_kuliah' => $isArray ? ($item['mata_kuliah'] ?? null) : ($item->mata_kuliah ?? null)
                        ];
                    });
                    $jadwalMengajar = $jadwalMengajar->concat($jadwalNonBlok);
                }
            } catch (\Exception $e) {
                Log::error("Error fetching Non Blok Non CSR: " . $e->getMessage());
            }

            // 7. Jadwal Persamaan Persepsi
            try {
                $persepsiController = new \App\Http\Controllers\JadwalPersamaanPersepsiController();
                $persepsiRequest = new \Illuminate\Http\Request();
                $persepsiRequest->query->set('semester_type', $semesterType);
                $persepsiResponse = $persepsiController->getJadwalForDosen($id, $persepsiRequest);
                $persepsiData = $persepsiResponse->getData();

                Log::info("Persamaan Persepsi data response for dosen ID: {$id}, has data: " . (isset($persepsiData->data) ? 'yes' : 'no'));

                if (isset($persepsiData->data)) {
                    Log::info("Persamaan Persepsi data found: " . count($persepsiData->data) . " records for semester_type: {$semesterType}");
                    $jadwalPersepsi = collect($persepsiData->data)->map(function ($item) use ($id) {
                        // Handle both array and object data
                        $isArray = is_array($item);

                        // Get jadwal ID for absensi check
                        $jadwalId = $isArray ? $item['id'] : $item->id;
                        $mataKuliahKode = $isArray ? $item['mata_kuliah_kode'] : $item->mata_kuliah_kode;

                        // Parse koordinator_ids dan dosen_ids
                        $koordinatorIds = [];
                        $dosenIds = [];
                        if ($isArray) {
                            $koordinatorIds = $item['koordinator_ids'] ?? [];
                            $dosenIds = $item['dosen_ids'] ?? [];
                        } else {
                            $koordinatorIds = $item->koordinator_ids ?? [];
                            $dosenIds = $item->dosen_ids ?? [];
                        }

                        // Ensure arrays
                        if (!is_array($koordinatorIds)) {
                            $koordinatorIds = is_string($koordinatorIds) ? json_decode($koordinatorIds, true) : [];
                        }
                        if (!is_array($dosenIds)) {
                            $dosenIds = is_string($dosenIds) ? json_decode($dosenIds, true) : [];
                        }

                        // Check if dosen is koordinator or pengampu
                        $isKoordinator = in_array($id, $koordinatorIds);
                        $roleType = $isKoordinator ? 'koordinator' : 'pengampu';

                        // Get penilaian_submitted dari jadwal terlebih dahulu
                        $penilaianSubmitted = false;
                        $absensiHadir = false;
                        $absensiStatus = 'menunggu'; // Default: menunggu

                        try {
                            // Cek penilaian_submitted dari jadwal
                            $jadwalPP = \App\Models\JadwalPersamaanPersepsi::find($jadwalId);
                            if ($jadwalPP) {
                                $penilaianSubmitted = (bool)($jadwalPP->penilaian_submitted ?? false);
                            }

                            // Tentukan status absensi berdasarkan penilaian_submitted dan absensi data
                            // Logic: Jika sudah disubmit, koordinator selalu hadir, pengampu cek dari absensi
                            if ($penilaianSubmitted) {
                                // Jika sudah submitted, koordinator selalu hadir
                                if ($isKoordinator) {
                                    // Untuk koordinator: absensi_hadir selalu true jika sudah disubmit
                                    $absensiHadir = true;
                                    $absensiStatus = 'hadir';
                                } else {
                                    // Untuk pengampu: cek data absensi
                                    $absensiData = \App\Models\AbsensiPersamaanPersepsi::where('jadwal_persamaan_persepsi_id', $jadwalId)
                                        ->where('dosen_id', $id)
                                        ->first();

                                    if ($absensiData) {
                                        // Ada data absensi, cek apakah hadir
                                        $absensiHadir = (bool)($absensiData->hadir ?? false);
                                        $absensiStatus = $absensiHadir ? 'hadir' : 'tidak_hadir';
                                        $absensiCatatan = $absensiData->catatan ?? null;
                                    } else {
                                        // Belum ada data absensi untuk pengampu, status menunggu
                                        $absensiHadir = false;
                                        $absensiStatus = 'menunggu';
                                        $absensiCatatan = null;
                                    }
                                }
                            } else {
                                // Belum submitted, status menunggu
                                $absensiStatus = 'menunggu';
                                $absensiHadir = false;
                                $absensiCatatan = null;
                            }
                        } catch (\Exception $e) {
                            Log::warning("Error fetching absensi for persamaan persepsi jadwal {$jadwalId}: " . $e->getMessage());
                            $absensiCatatan = null;
                        }

                        return (object) [
                            'id' => $jadwalId,
                            'mata_kuliah_kode' => $mataKuliahKode,
                            'mata_kuliah_nama' => $isArray ? ($item['mata_kuliah_nama'] ?? '') : ($item->mata_kuliah_nama ?? ''),
                            'tanggal' => $isArray ? $item['tanggal'] : $item->tanggal,
                            'jam_mulai' => $isArray ? $item['jam_mulai'] : $item->jam_mulai,
                            'jam_selesai' => $isArray ? $item['jam_selesai'] : $item->jam_selesai,
                            'jenis_jadwal' => 'persamaan_persepsi',
                            'topik' => $isArray ? ($item['topik'] ?? '') : ($item->topik ?? ''),
                            'ruangan_nama' => (function () use ($isArray, $item) {
                                // Cek use_ruangan
                                $useRuangan = false;
                                $ruanganNama = '';

                                if ($isArray) {
                                    $useRuangan = $item['use_ruangan'] ?? false;
                                    // Handle ruangan bisa array atau object
                                    if (isset($item['ruangan'])) {
                                        if (is_array($item['ruangan'])) {
                                            $ruanganNama = $item['ruangan']['nama'] ?? '';
                                        } else {
                                            $ruanganNama = $item['ruangan']->nama ?? '';
                                        }
                                    }
                                } else {
                                    $useRuangan = $item->use_ruangan ?? false;
                                    // Handle ruangan bisa object atau nested object
                                    if ($item->ruangan) {
                                        if (is_object($item->ruangan)) {
                                            $ruanganNama = $item->ruangan->nama ?? '';
                                        } else {
                                            $ruanganNama = $item->ruangan;
                                        }
                                    }
                                }

                                // Jika use_ruangan = false atau ruangan kosong, return "Online"
                                if (!$useRuangan || empty($ruanganNama)) {
                                    return 'Online';
                                }
                                return $ruanganNama;
                            })(),
                            'jumlah_sesi' => $isArray ? ($item['jumlah_sesi'] ?? 1) : ($item->jumlah_sesi ?? 1),
                            'semester' => (function () use ($isArray, $item, $mataKuliahKode) {
                                // Response dari getJadwalForDosen tidak include mataKuliah object
                                // Kita perlu fetch dari database atau gunakan semester_type
                                try {
                                    $mataKuliah = \App\Models\MataKuliah::where('kode', $mataKuliahKode)->first(['semester']);
                                    if ($mataKuliah && $mataKuliah->semester) {
                                        return $mataKuliah->semester;
                                    }
                                } catch (\Exception $e) {
                                    Log::warning("Error fetching mata kuliah semester for {$mataKuliahKode}: " . $e->getMessage());
                                }
                                // Fallback: return empty string
                                return '';
                            })(),
                            'blok' => (function () use ($isArray, $item, $mataKuliahKode) {
                                // Response dari getJadwalForDosen tidak include mataKuliah object
                                // Kita perlu fetch dari database
                                try {
                                    $mataKuliah = \App\Models\MataKuliah::where('kode', $mataKuliahKode)->first(['blok']);
                                    if ($mataKuliah && $mataKuliah->blok !== null) {
                                        return $mataKuliah->blok;
                                    }
                                } catch (\Exception $e) {
                                    Log::warning("Error fetching mata kuliah blok for {$mataKuliahKode}: " . $e->getMessage());
                                }
                                // Fallback: return null
                                return null;
                            })(),
                            'kelompok_kecil' => '',
                            'status_konfirmasi' => 'bisa', // Persamaan Persepsi selalu "bisa"
                            'alasan_konfirmasi' => null,
                            'status_reschedule' => null,
                            'reschedule_reason' => null,
                            'semester_type' => $isArray ? ($item['semester_type'] ?? 'reguler') : ($item->semester_type ?? 'reguler'),
                            'penilaian_submitted' => $penilaianSubmitted,
                            'dosen_ids' => $dosenIds,
                            'koordinator_ids' => $koordinatorIds,
                            'absensi_hadir' => $absensiHadir,
                            'absensi_catatan' => $absensiCatatan ?? null,
                            'role_type' => $roleType, // 'koordinator' atau 'pengampu'
                            'absensi_status' => $absensiStatus, // 'menunggu', 'hadir', atau 'tidak_hadir'
                            'mata_kuliah' => (function () use ($mataKuliahKode) {
                                // Fetch mata_kuliah object untuk konsistensi
                                try {
                                    $mataKuliah = \App\Models\MataKuliah::where('kode', $mataKuliahKode)->first();
                                    return $mataKuliah ? (object) [
                                        'kode' => $mataKuliah->kode,
                                        'nama' => $mataKuliah->nama,
                                        'semester' => $mataKuliah->semester,
                                        'blok' => $mataKuliah->blok,
                                    ] : null;
                                } catch (\Exception $e) {
                                    Log::warning("Error fetching mata kuliah object for {$mataKuliahKode}: " . $e->getMessage());
                                    return null;
                                }
                            })()
                        ];
                    });
                    $jadwalMengajar = $jadwalMengajar->concat($jadwalPersepsi);
                    Log::info("Persamaan Persepsi mapped: " . $jadwalPersepsi->count() . " records added to jadwalMengajar");
                } else {
                    Log::warning("Persamaan Persepsi data is not set or empty for dosen ID: {$id}");
                }
            } catch (\Exception $e) {
                Log::error("Error fetching Persamaan Persepsi: " . $e->getMessage());
                Log::error("Stack trace: " . $e->getTraceAsString());
            }

            // 8. Jadwal Seminar Pleno
            try {
                $seminarPlenoController = new \App\Http\Controllers\JadwalSeminarPlenoController();
                $seminarPlenoRequest = new \Illuminate\Http\Request();
                $seminarPlenoRequest->query->set('semester_type', $semesterType);
                $seminarPlenoResponse = $seminarPlenoController->getJadwalForDosen($id, $seminarPlenoRequest);
                $seminarPlenoData = $seminarPlenoResponse->getData();

                if (isset($seminarPlenoData->data)) {
                    $jadwalSeminarPleno = collect($seminarPlenoData->data)->map(function ($item) use ($id) {
                        // Handle both array and object data
                        $isArray = is_array($item);

                        // Get jadwal ID for absensi check
                        $jadwalId = $isArray ? $item['id'] : $item->id;
                        $mataKuliahKode = $isArray ? $item['mata_kuliah_kode'] : $item->mata_kuliah_kode;

                        // Parse koordinator_ids dan dosen_ids
                        $koordinatorIds = [];
                        $dosenIds = [];
                        if ($isArray) {
                            $koordinatorIds = isset($item['koordinator_ids']) && is_array($item['koordinator_ids'])
                                ? $item['koordinator_ids']
                                : (isset($item['koordinator_ids']) ? json_decode($item['koordinator_ids'], true) : []);
                            $dosenIds = isset($item['dosen_ids']) && is_array($item['dosen_ids'])
                                ? $item['dosen_ids']
                                : (isset($item['dosen_ids']) ? json_decode($item['dosen_ids'], true) : []);
                        } else {
                            $koordinatorIds = isset($item->koordinator_ids) && is_array($item->koordinator_ids)
                                ? $item->koordinator_ids
                                : (isset($item->koordinator_ids) ? json_decode($item->koordinator_ids, true) : []);
                            $dosenIds = isset($item->dosen_ids) && is_array($item->dosen_ids)
                                ? $item->dosen_ids
                                : (isset($item->dosen_ids) ? json_decode($item->dosen_ids, true) : []);
                        }
                        if (!is_array($koordinatorIds)) {
                            $koordinatorIds = [];
                        }
                        if (!is_array($dosenIds)) {
                            $dosenIds = [];
                        }

                        // Check if dosen is koordinator or pengampu
                        $isKoordinator = in_array($id, $koordinatorIds);
                        $roleType = $isKoordinator ? 'koordinator' : 'pengampu';
                        $peran = $isKoordinator ? 'koordinator' : 'pengampu';
                        $peran_display = $isKoordinator ? 'Koordinator' : 'Pengampu';

                        // Get penilaian_submitted dari jadwal terlebih dahulu
                        $penilaianSubmitted = false;
                        $absensiHadir = false;
                        $absensiStatus = 'menunggu'; // Default: menunggu

                        try {
                            // Cek penilaian_submitted dari jadwal
                            // Gunakan fresh() untuk memastikan mendapatkan data terbaru dari database
                            $jadwalSP = \App\Models\JadwalSeminarPleno::find($jadwalId);
                            if ($jadwalSP) {
                                // Gunakan fresh() untuk mendapatkan data terbaru setelah submit
                                $jadwalSP = $jadwalSP->fresh();
                                $penilaianSubmitted = (bool)($jadwalSP->penilaian_submitted ?? false);
                            } else {
                                // Jika tidak ditemukan dari response, cek dari response data juga
                                $penilaianSubmitted = $isArray
                                    ? (bool)($item['penilaian_submitted'] ?? false)
                                    : (bool)($item->penilaian_submitted ?? false);
                            }

                            // Tentukan status absensi berdasarkan penilaian_submitted dan absensi data
                            // Logic: Jika sudah disubmit, koordinator selalu hadir, pengampu cek dari absensi
                            if ($penilaianSubmitted) {
                                // Jika sudah submitted, koordinator selalu hadir
                                if ($isKoordinator) {
                                    // Untuk koordinator: absensi_hadir selalu true jika sudah disubmit
                                    $absensiHadir = true;
                                    $absensiStatus = 'hadir';
                                } else {
                                    // Untuk pengampu: cek data absensi
                                    $absensiData = \App\Models\AbsensiSeminarPleno::where('jadwal_seminar_pleno_id', $jadwalId)
                                        ->where('dosen_id', $id)
                                        ->first();

                                    if ($absensiData) {
                                        // Ada data absensi, cek apakah hadir
                                        $absensiHadir = (bool)($absensiData->hadir ?? false);
                                        $absensiStatus = $absensiHadir ? 'hadir' : 'tidak_hadir';
                                        $absensiCatatan = $absensiData->catatan ?? null;
                                    } else {
                                        // Belum ada data absensi untuk pengampu, status menunggu
                                        $absensiHadir = false;
                                        $absensiStatus = 'menunggu';
                                        $absensiCatatan = null;
                                    }
                                }
                            } else {
                                // Belum submitted, status menunggu
                                $absensiStatus = 'menunggu';
                                $absensiHadir = false;
                                $absensiCatatan = null;
                            }
                        } catch (\Exception $e) {
                            Log::warning("Error fetching absensi for seminar pleno jadwal {$jadwalId}: " . $e->getMessage());
                            $absensiCatatan = null;
                        }

                        // Get kelompok besar
                        $kelompokBesarId = null;
                        if ($isArray) {
                            if (isset($item['kelompok_besar']) && isset($item['kelompok_besar']['id'])) {
                                $kelompokBesarId = $item['kelompok_besar']['id'];
                            } elseif (isset($item['kelompok_besar_antara']) && isset($item['kelompok_besar_antara']['id'])) {
                                $kelompokBesarId = $item['kelompok_besar_antara']['id'];
                            }
                        } else {
                            if (isset($item->kelompok_besar) && isset($item->kelompok_besar->id)) {
                                $kelompokBesarId = $item->kelompok_besar->id;
                            } elseif (isset($item->kelompok_besar_antara) && isset($item->kelompok_besar_antara->id)) {
                                $kelompokBesarId = $item->kelompok_besar_antara->id;
                            }
                        }

                        // Handle ruangan (mirip dengan Persamaan Persepsi)
                        $ruanganNama = '';
                        $useRuangan = false;
                        if ($isArray) {
                            $useRuangan = $item['use_ruangan'] ?? false;
                            if (isset($item['ruangan'])) {
                                if (is_array($item['ruangan'])) {
                                    $ruanganNama = $item['ruangan']['nama'] ?? '';
                                } else {
                                    $ruanganNama = $item['ruangan']->nama ?? '';
                                }
                            }
                        } else {
                            $useRuangan = $item->use_ruangan ?? false;
                            if ($item->ruangan) {
                                if (is_object($item->ruangan)) {
                                    $ruanganNama = $item->ruangan->nama ?? '';
                                } else {
                                    $ruanganNama = $item->ruangan;
                                }
                            }
                        }

                        // Jika use_ruangan = false atau ruangan kosong, return "Online"
                        if (!$useRuangan || empty($ruanganNama)) {
                            $ruanganNama = 'Online';
                        }

                        return (object) [
                            'id' => $jadwalId,
                            'mata_kuliah_kode' => $mataKuliahKode,
                            'mata_kuliah_nama' => $isArray ? ($item['mata_kuliah_nama'] ?? '') : ($item->mata_kuliah_nama ?? ''),
                            'tanggal' => $isArray ? $item['tanggal'] : $item->tanggal,
                            'jam_mulai' => $isArray ? $item['jam_mulai'] : $item->jam_mulai,
                            'jam_selesai' => $isArray ? $item['jam_selesai'] : $item->jam_selesai,
                            'jenis_jadwal' => 'seminar_pleno',
                            'topik' => $isArray ? ($item['topik'] ?? null) : ($item->topik ?? null),
                            'ruangan_nama' => $ruanganNama,
                            'jumlah_sesi' => $isArray ? ($item['jumlah_sesi'] ?? 1) : ($item->jumlah_sesi ?? 1),
                            'semester' => (function () use ($isArray, $item, $mataKuliahKode) {
                                // Fetch dari database untuk konsistensi
                                try {
                                    $mataKuliah = \App\Models\MataKuliah::where('kode', $mataKuliahKode)->first(['semester']);
                                    if ($mataKuliah && $mataKuliah->semester) {
                                        return $mataKuliah->semester;
                                    }
                                } catch (\Exception $e) {
                                    Log::warning("Error fetching mata kuliah semester for {$mataKuliahKode}: " . $e->getMessage());
                                }
                                // Fallback
                                if ($isArray) {
                                    return $item['mata_kuliah']['semester'] ?? '';
                                } else {
                                    return $item->mata_kuliah->semester ?? '';
                                }
                            })(),
                            'blok' => (function () use ($isArray, $item, $mataKuliahKode) {
                                // Fetch dari database untuk konsistensi
                                try {
                                    $mataKuliah = \App\Models\MataKuliah::where('kode', $mataKuliahKode)->first(['blok']);
                                    if ($mataKuliah && $mataKuliah->blok !== null) {
                                        return $mataKuliah->blok;
                                    }
                                } catch (\Exception $e) {
                                    Log::warning("Error fetching mata kuliah blok for {$mataKuliahKode}: " . $e->getMessage());
                                }
                                // Fallback
                                if ($isArray) {
                                    return $item['mata_kuliah']['blok'] ?? null;
                                } else {
                                    return $item->mata_kuliah->blok ?? null;
                                }
                            })(),
                            'kelompok_kecil' => '',
                            'kelompok_besar_id' => $kelompokBesarId,
                            'status_konfirmasi' => $isArray ? ($item['status_konfirmasi'] ?? 'bisa') : ($item->status_konfirmasi ?? 'bisa'),
                            'alasan_konfirmasi' => $isArray ? ($item['alasan_konfirmasi'] ?? null) : ($item->alasan_konfirmasi ?? null),
                            'status_reschedule' => $isArray ? ($item['status_reschedule'] ?? null) : ($item->status_reschedule ?? null),
                            'reschedule_reason' => $isArray ? ($item['reschedule_reason'] ?? null) : ($item->reschedule_reason ?? null),
                            'semester_type' => $isArray ? ($item['semester_type'] ?? 'reguler') : ($item->semester_type ?? 'reguler'),
                            'penilaian_submitted' => $penilaianSubmitted,
                            'dosen_ids' => $dosenIds,
                            'koordinator_ids' => $koordinatorIds,
                            'absensi_hadir' => $absensiHadir,
                            'role_type' => $roleType, // 'koordinator' atau 'pengampu'
                            'absensi_status' => $absensiStatus, // 'menunggu', 'hadir', atau 'tidak_hadir'
                            'peran' => $peran,
                            'peran_display' => $peran_display,
                            'mata_kuliah' => (function () use ($mataKuliahKode) {
                                // Fetch mata_kuliah object untuk konsistensi
                                try {
                                    $mataKuliah = \App\Models\MataKuliah::where('kode', $mataKuliahKode)->first();
                                    return $mataKuliah ? (object) [
                                        'kode' => $mataKuliah->kode,
                                        'nama' => $mataKuliah->nama,
                                        'semester' => $mataKuliah->semester,
                                        'blok' => $mataKuliah->blok,
                                    ] : null;
                                } catch (\Exception $e) {
                                    Log::warning("Error fetching mata kuliah object for {$mataKuliahKode}: " . $e->getMessage());
                                    return null;
                                }
                            })()
                        ];
                    });
                    $jadwalMengajar = $jadwalMengajar->concat($jadwalSeminarPleno);
                }
            } catch (\Exception $e) {
                Log::error("Error fetching Seminar Pleno: " . $e->getMessage());
            }

            Log::info("Total jadwal mengajar untuk semester {$semesterType}: " . $jadwalMengajar->count());

            // Sort berdasarkan tanggal dan jam
            $jadwalMengajar = $jadwalMengajar->sortBy([
                ['tanggal', 'desc'],
                ['jam_mulai', 'asc']
            ]);

            Log::info("Total jadwal mengajar: " . $jadwalMengajar->count());

            return response()->json($jadwalMengajar->values());
        } catch (\Exception $e) {
            Log::error("Error in getJadwalMengajar: " . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil data jadwal mengajar',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    // GET /users/search?q=query
    public function search(Request $request)
    {
        try {
            $query = $request->get('q');

            if (!$query || strlen($query) < 2) {
                return response()->json([
                    'success' => true,
                    'data' => []
                ]);
            }

            $users = User::where('name', 'like', "%{$query}%")
                ->orWhere('username', 'like', "%{$query}%")
                ->orWhere('email', 'like', "%{$query}%")
                ->select(['id', 'name', 'username', 'email', 'role'])
                ->limit(20)
                ->get();

            return response()->json([
                'success' => true,
                'data' => $users
            ]);
        } catch (\Exception $e) {
            Log::error("Error in user search: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal mencari user',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // PUT /users/{id}/update-email - Update email untuk dosen
    public function updateEmail(Request $request, $id)
    {
        try {
            $user = User::findOrFail($id);

            // Validasi hanya untuk dosen
            if ($user->role !== 'dosen') {
                return response()->json([
                    'success' => false,
                    'message' => 'Hanya dosen yang dapat mengupdate email'
                ], 403);
            }

            $validated = $request->validate([
                'email' => 'required|email|unique:users,email,' . $user->id
            ]);

            $user->update([
                'email' => $validated['email']
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Email berhasil diupdate',
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email
                ]
            ]);
        } catch (\Exception $e) {
            Log::error("Error updating email: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengupdate email',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // GET /users/{id}/email-status - Cek status email dosen
    public function getEmailStatus($id)
    {
        try {
            $user = User::findOrFail($id);

            if ($user->role !== 'dosen') {
                return response()->json([
                    'success' => false,
                    'message' => 'Hanya dosen yang dapat mengecek status email'
                ], 403);
            }

            $isEmailValid = !empty($user->email) && filter_var($user->email, FILTER_VALIDATE_EMAIL);

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'email_verified' => $user->email_verified ?? false,
                    'is_email_valid' => $isEmailValid,
                    'needs_email_update' => !$isEmailValid || !($user->email_verified ?? false)
                ]
            ]);
        } catch (\Exception $e) {
            Log::error("Error checking email status: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengecek status email',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // PUT /users/{id}/verify-email - Aktifkan email dosen
    public function verifyEmail(Request $request, $id)
    {
        try {
            $user = User::findOrFail($id);

            // Validasi hanya untuk dosen
            if ($user->role !== 'dosen') {
                return response()->json([
                    'success' => false,
                    'message' => 'Hanya dosen yang dapat mengaktifkan email'
                ], 403);
            }

            $validated = $request->validate([
                'email' => 'required|email'
            ]);

            // Check if email already exists for other users (only if email is different)
            if ($validated['email'] !== $user->email) {
                $existingUser = User::where('email', $validated['email'])
                    ->where('id', '!=', $user->id)
                    ->first();

                if ($existingUser) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Email sudah digunakan oleh user lain'
                    ], 422);
                }
            }

            $user->update([
                'email' => $validated['email'],
                'email_verified' => true
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Email berhasil diaktifkan',
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'email_verified' => true
                ]
            ]);
        } catch (\Exception $e) {
            Log::error("Error verifying email: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengaktifkan email',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
