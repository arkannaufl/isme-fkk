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
        $users = $query->get();
        // Tambahan: jika role dosen, tambahkan field peran multi
        if ($request->role === 'dosen') {
            $users = $users->map(function ($user) {
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
            'nim' => 'nullable|unique:users,nim',
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
            'nim' => 'nullable|unique:users,nim,' . $user->id,
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
            $semesterType = $request->query('semester_type', 'reguler');

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
                    $jadwalKuliahBesar = collect($kuliahBesarData->data)->map(function($item) {
                        return (object) [
                            'id' => $item->id,
                            'mata_kuliah_kode' => $item->mata_kuliah_kode,
                            'mata_kuliah_nama' => $item->mata_kuliah->nama ?? '',
                            'tanggal' => $item->tanggal,
                            'jam_mulai' => $item->jam_mulai,
                            'jam_selesai' => $item->jam_selesai,
                            'jenis_jadwal' => 'kuliah_besar',
                            'topik' => $item->materi ?? $item->topik,
                            'ruangan_nama' => $item->ruangan->nama ?? '',
                            'jumlah_sesi' => $item->jumlah_sesi,
                            'semester' => $item->mata_kuliah->semester ?? '',
                            'blok' => $item->mata_kuliah->blok ?? null,
                            'kelompok_kecil' => $item->kelompok_besar_antara->nama_kelompok ?? 'Semester ' . $item->kelompok_besar_id
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
                    $jadwalPraktikum = collect($praktikumData->data)->map(function($item) {
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
                            'kelompok_kecil' => $item->kelas_praktikum
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
                    $jadwalJurnal = collect($jurnalData->data)->map(function($item) {
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
                            'kelompok_kecil' => $item->kelompok_kecil->nama ?? $item->kelompok_kecil_antara->nama_kelompok ?? ''
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
                    $jadwalPBL = collect($pblData->data)->map(function($item) {
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
                            'semester_type' => $isArray ? ($item['semester_type'] ?? 'reguler') : ($item->semester_type ?? 'reguler')
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
                    $jadwalCSR = collect($csrData->data)->map(function($item) {
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
                            'ruangan_nama' => $isArray ? ($item['ruangan']['nama'] ?? '') : ($item->ruangan->nama ?? ''),
                            'jumlah_sesi' => $isArray ? $item['jumlah_sesi'] : $item->jumlah_sesi,
                            'semester' => '',
                            'blok' => null,
                            'kelompok_kecil' => $isArray ? ($item['kelompok_kecil']['nama'] ?? '') : ($item->kelompok_kecil->nama ?? '')
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
                    $jadwalNonBlok = collect($nonBlokData->data)->map(function($item) {
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
                                ($item['kelompok_besar']['semester'] ?? $item['kelompok_besar_antara']['nama_kelompok'] ?? '') :
                                ($item->kelompok_besar->semester ?? $item->kelompok_besar_antara->nama_kelompok ?? '')
                        ];
                    });
                    $jadwalMengajar = $jadwalMengajar->concat($jadwalNonBlok);
                }
            } catch (\Exception $e) {
                Log::error("Error fetching Non Blok Non CSR: " . $e->getMessage());
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
}
