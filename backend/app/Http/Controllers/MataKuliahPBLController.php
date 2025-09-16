<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\PBL;
use App\Models\MataKuliah;
use Illuminate\Http\Response;
use App\Models\PBLMapping;
use App\Models\User;
use App\Models\DosenPeran;
use App\Models\JadwalPBL;
use App\Models\KelompokKecil;
use App\Models\Ruangan;
use App\Http\Controllers\NotificationController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class MataKuliahPBLController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index($kode)
    {
        $pbls = PBL::where('mata_kuliah_kode', $kode)->get();
        return response()->json($pbls);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request, $kode)
    {
        $validated = $request->validate([
            'modul_ke' => 'required|string',
            'nama_modul' => 'required|string',
        ]);
        $validated['mata_kuliah_kode'] = $kode;
        $pbl = PBL::create($validated);

        return response()->json($pbl, Response::HTTP_CREATED);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $pbl = \App\Models\PBL::findOrFail($id);
        return response()->json($pbl);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $pbl = \App\Models\PBL::findOrFail($id);
        $validated = $request->validate([
            'modul_ke' => 'sometimes|required|string',
            'nama_modul' => 'sometimes|required|string',
        ]);

        $pbl->update($validated);

        return response()->json($pbl);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $pbl = \App\Models\PBL::findOrFail($id);
        $pbl->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Get all PBL grouped by mata_kuliah_kode for Blok courses only
     */
    public function all()
    {
        $blokCourses = \App\Models\MataKuliah::where('jenis', 'Blok')->get(['kode', 'nama', 'semester', 'blok', 'periode', 'keahlian_required']);
        $blokKodes = $blokCourses->pluck('kode');
        $pbls = \App\Models\PBL::whereIn('mata_kuliah_kode', $blokKodes)->get();
        $grouped = $pbls->groupBy('mata_kuliah_kode');
        $result = [];
        foreach ($blokCourses as $mk) {
            $result[$mk->kode] = [
                'mata_kuliah' => [
                    'kode' => $mk->kode,
                    'nama' => $mk->nama,
                    'semester' => $mk->semester,
                    'blok' => $mk->blok,
                    'periode' => $mk->periode,
                    'keahlian_required' => $mk->keahlian_required,
                ],
                'pbls' => isset($grouped[$mk->kode]) ? $grouped[$mk->kode]->values()->toArray() : [],
            ];
        }
        return response()->json($result);
    }

    /**
     * Get all PBLs
     */
    public function getAllPbls()
    {
        $pbls = \App\Models\PBL::all();
        return response()->json($pbls);
    }

    /**
     * Check if a blok has been generated
     */
    public function checkBlokGenerated($blokId)
    {
        $status = $this->checkBlokGeneratedInternal($blokId);
        return response()->json($status);
    }

    /**
     * Assign dosen ke PBL
     */
    public function assignDosen(Request $request, $pblId)
    {
        $validated = $request->validate([
            'dosen_id' => 'required|exists:users,id',
            'role' => 'nullable|string|in:koordinator,tim_blok,dosen_mengajar',
        ]);
        $pbl = PBL::findOrFail($pblId);
        // Ambil semester dan blok dari mata kuliah terkait
        $mataKuliah = $pbl->mataKuliah;
        $semester = $mataKuliah->semester;
        $blok = $mataKuliah->blok;

        // === VALIDASI CONSTRAINT DOSEN MENGAJAR ===
        // Constraint: Jika dosen sudah jadi Dosen Mengajar di blok tertentu,
        // tidak boleh jadi Dosen Mengajar lagi di blok yang sama dengan semester berbeda
        $dosenId = $validated['dosen_id'];

        // Cek apakah dosen ini adalah Koordinator atau Tim Blok untuk mata kuliah ini
        $user = User::find($dosenId);
        $isKoordinatorOrTimBlok = false;

        if ($user && $user->dosenPeran) {
            $isKoordinatorOrTimBlok = $user->dosenPeran->contains(function ($peran) use ($mataKuliah) {
                return ($peran->tipe_peran === 'koordinator' || $peran->tipe_peran === 'tim_blok') &&
                    $peran->mata_kuliah_kode === $mataKuliah->kode &&
                    $peran->semester === $mataKuliah->semester;
            });
        }

        // Hanya validasi constraint untuk Dosen Mengajar
        if (!$isKoordinatorOrTimBlok) {
            // Cek apakah dosen sudah di-assign sebagai Dosen Mengajar di blok yang sama
            // tapi semester berbeda dalam data yang sudah ada di database
            $existingAssignments = PBLMapping::where('dosen_id', $dosenId)
                ->whereHas('pbl.mataKuliah', function ($query) use ($blok) {
                    $query->where('blok', $blok);
                })
                ->with('pbl.mataKuliah')
                ->get();

            foreach ($existingAssignments as $existingAssignment) {
                $existingMk = $existingAssignment->pbl->mataKuliah;
                if ($existingMk->semester !== $semester) {
                    // PERUBAHAN: Berikan warning alih-alih memblokir assignment
                    $dosenName = $user ? $user->name : "ID {$dosenId}";

                    // Log warning untuk monitoring
                    \Log::warning("Constraint Warning: Dosen {$dosenName} (ID: {$dosenId}) akan mengajar di Blok {$blok} di multiple semester", [
                        'existing_semester' => $existingMk->semester,
                        'new_semester' => $semester,
                        'blok' => $blok
                    ]);

                    // Berikan warning response tapi tetap izinkan assignment
                    return response()->json([
                        'warning' => true,
                        'message' => "⚠️ PERINGATAN: Dosen {$dosenName} sudah mengajar di Blok {$blok} Semester {$existingMk->semester}. Assignment ke Semester {$semester} tetap diizinkan, namun perhatikan distribusi beban mengajar.",
                        'constraint_warning' => true,
                        'dosen_id' => $dosenId,
                        'dosen_name' => $dosenName,
                        'existing_blok' => $blok,
                        'existing_semester' => $existingMk->semester,
                        'new_semester' => $semester
                    ], 200); // 200 alih-alih 422
                }
            }
        }

        // Validasi: Mata kuliah harus punya keahlian_required
        if (empty($mataKuliah->keahlian_required) || count($mataKuliah->keahlian_required) === 0) {
            return response()->json([
                'message' => 'Mata kuliah ini belum diisi keahlian yang diperlukan. Silakan lengkapi keahlian_required pada mata kuliah sebelum assign dosen.'
            ], 422);
        }

        // Cek apakah dosen sudah di CSR X.Y
        $csr = \App\Models\CSR::where('nomor_csr', $semester . '.' . $blok)->first();
        if ($csr) {
            $csrMapping = \App\Models\CSRMapping::where('csr_id', $csr->id)
                ->where('dosen_id', $validated['dosen_id'])
                ->first();
            if ($csrMapping) {
                return response()->json([
                    'message' => 'Dosen ini sudah di CSR ' . $csr->nomor_csr . ', tidak bisa di PBL blok ' . $blok . ' semester ' . $semester
                ], 422);
            }
        }
        // Cek apakah sudah ada assignment
        $existing = PBLMapping::where('pbl_id', $pblId)->where('dosen_id', $validated['dosen_id'])->first();
        if ($existing) {
            return response()->json(['message' => 'Dosen sudah diassign ke PBL ini'], 422);
        }
        $mapping = PBLMapping::create([
            'pbl_id' => $pblId,
            'dosen_id' => $validated['dosen_id'],
            'role' => $validated['role'] ?? 'dosen_mengajar',
        ]);

        // === PENTING: Buat DosenPeran record untuk Dosen Mengajar ===
        // Jika dosen ini bukan Koordinator atau Tim Blok, buat record DosenPeran
        if (!$isKoordinatorOrTimBlok) {
            try {
                // Cek apakah sudah ada DosenPeran record untuk dosen ini di mata kuliah ini
                $existingDosenPeran = DosenPeran::where([
                    'user_id' => $validated['dosen_id'],
                    'mata_kuliah_kode' => $mataKuliah->kode,
                    'semester' => $mataKuliah->semester,
                    'tipe_peran' => 'dosen_mengajar'
                ])->first();

                if (!$existingDosenPeran) {
                    // Buat DosenPeran record baru
                    DosenPeran::create([
                        'user_id' => $validated['dosen_id'],
                        'mata_kuliah_kode' => $mataKuliah->kode,
                        'semester' => $mataKuliah->semester,
                        'blok' => $mataKuliah->blok,
                        'tipe_peran' => 'dosen_mengajar',
                        'peran_kurikulum' => 'PBL'
                    ]);
                }
            } catch (\Exception $e) {
                // Log error tapi jangan gagalkan assignment
                \Log::error('Error creating DosenPeran record: ' . $e->getMessage(), [
                    'user_id' => $validated['dosen_id'],
                    'mata_kuliah_kode' => $mataKuliah->kode,
                    'semester' => $mataKuliah->semester
                ]);
            }
        }

        activity()
            ->causedBy(Auth::user())
            ->performedOn($pbl)
            ->withProperties(['attributes' => ['dosen_id' => $validated['dosen_id']]])
            ->log("Dosen dengan ID {$validated['dosen_id']} di-assign ke PBL");

        // Tambahkan increment pbl_assignment_count
        $user = \App\Models\User::find($validated['dosen_id']);
        if ($user) $user->increment('pbl_assignment_count');

        // Kirim notifikasi ke dosen
        $notificationController = new NotificationController();
        $pblData = [
            'pbl_id' => $pblId,
            'mata_kuliah_kode' => $mataKuliah->kode,
            'mata_kuliah_nama' => $mataKuliah->nama,
            'modul_ke' => $pbl->modul_ke,
            'nama_modul' => $pbl->nama_modul,
        ];
        $notificationController->createPBLAssignmentNotification($validated['dosen_id'], $pblData);

        return response()->json($mapping->load('dosen'));
    }

    /**
     * Unassign dosen dari PBL
     */
    public function unassignDosen($pblId, $dosenId)
    {
        $mapping = PBLMapping::where('pbl_id', $pblId)->where('dosen_id', $dosenId)->first();
        if (!$mapping) {
            return response()->json(['message' => 'Mapping tidak ditemukan'], 404);
        }
        $pbl = $mapping->pbl;
        $mapping->delete();

        activity()
            ->causedBy(Auth::user())
            ->performedOn($pbl)
            ->withProperties(['attributes' => ['dosen_id' => $dosenId]])
            ->log("Dosen dengan ID {$dosenId} di-unassign dari PBL");

        // Decrement pbl_assignment_count
        $user = \App\Models\User::find($dosenId);
        if ($user && $user->pbl_assignment_count > 0) $user->decrement('pbl_assignment_count');
        return response()->json(['message' => 'Dosen unassigned']);
    }

    /**
     * Get dosen yang sudah diassign ke PBL
     */
    public function assignedDosen($pblId)
    {
        $pbl = PBL::with('dosen')->findOrFail($pblId);
        return response()->json($pbl->dosen);
    }

    /**
     * Batch get assigned dosen untuk banyak PBL sekaligus
     */
    public function assignedDosenBatch(Request $request)
    {
        $validated = $request->validate([
            'pbl_ids' => 'required|array',
            'pbl_ids.*' => 'integer',
        ]);
        $result = [];
        $pbls = PBL::with(['dosen' => function ($query) {
            $query->withPivot('role');
        }])->whereIn('id', $validated['pbl_ids'])->get();
        foreach ($pbls as $pbl) {
            // Pastikan pbl_assignment_count di-load untuk setiap dosen
            $pbl->dosen->each(function ($dosen) {
                $dosen->pbl_assignment_count = $dosen->pbl_assignment_count ?? 0;
                // Tambahkan role dari pivot table
                $dosen->pbl_role = $dosen->pivot->role ?? 'dosen_mengajar';
            });
            $result[$pbl->id] = $pbl->dosen;
        }
        return response()->json($result);
    }

    /**
     * Reset assignment dosen pada PBL (hapus semua mapping dosen pada PBL)
     */
    public function resetDosen($pblId)
    {
        $pbl = PBL::findOrFail($pblId);
        $deleted = PBLMapping::where('pbl_id', $pblId)->delete();

        activity()
            ->causedBy(Auth::user())
            ->performedOn($pbl)
            ->log("Semua dosen pada PBL ini telah di-reset");

        return response()->json(['message' => 'Semua dosen pada PBL ini telah direset', 'deleted' => $deleted]);
    }

    /**
     * Batch assign dosen ke banyak PBL sekaligus
     */
    public function assignDosenBatch(Request $request)
    {
        try {
            $data = $request->validate([
                'assignments' => 'required|array',
                'assignments.*.pbl_id' => 'required|integer|exists:pbls,id',
                'assignments.*.dosen_id' => 'required|integer|exists:users,id',
                'assignments.*.role' => 'nullable|string|in:koordinator,tim_blok,dosen_mengajar',
            ]);

            // Validasi berurutan: cek apakah blok sebelumnya sudah di-generate
            $pblIds = collect($data['assignments'])->pluck('pbl_id')->unique();
            $pbls = PBL::with('mataKuliah')->whereIn('id', $pblIds)->get();

            // Kelompokkan PBL berdasarkan blok
            $pblsByBlok = $pbls->groupBy(function ($pbl) {
                return $pbl->mataKuliah->blok ?? 0;
            });

            // Cek setiap blok yang akan di-generate
            foreach ($pblsByBlok as $blokId => $pblsInBlok) {
                if ($blokId > 1) { // Hanya validasi untuk blok > 1
                    $previousBlokId = $blokId - 1;

                    // Cek apakah blok sebelumnya sudah di-generate
                    $previousBlokStatus = $this->checkBlokGeneratedInternal($previousBlokId);

                    if (!$previousBlokStatus['has_pbl']) {
                        return response()->json([
                            'error' => true,
                            'message' => "Blok {$previousBlokId} tidak memiliki modul PBL. Silakan generate Blok {$previousBlokId} terlebih dahulu sebelum generate Blok {$blokId}.",
                            'required_blok' => $previousBlokId,
                            'current_blok' => $blokId
                        ], 400);
                    }

                    if (!$previousBlokStatus['has_generated']) {
                        return response()->json([
                            'error' => true,
                            'message' => "Blok {$previousBlokId} belum di-generate. Silakan generate Blok {$previousBlokId} terlebih dahulu sebelum generate Blok {$blokId}.",
                            'required_blok' => $previousBlokId,
                            'current_blok' => $blokId
                        ], 400);
                    }
                }
            }

            // === VALIDASI CONSTRAINT DOSEN MENGAJAR ===
            // Constraint: Jika dosen sudah jadi Dosen Mengajar di blok tertentu,
            // tidak boleh jadi Dosen Mengajar lagi di blok yang sama dengan semester berbeda
            $dosenBlokSemesterMap = []; // dosen_id -> [blok -> [semester]]
            $warnings = []; // Untuk menyimpan warning tanpa memblokir assignment

            // === NOTIFIKASI KONSOLIDASI ===
            // Kumpulkan data untuk notifikasi konsolidasi per blok
            $blockNotifications = []; // dosen_id -> [blok -> [semester -> [moduls, mata_kuliah, tipe_peran]]]

            foreach ($data['assignments'] as $item) {
                $pbl = PBL::find($item['pbl_id']);
                if (!$pbl || !$pbl->mataKuliah) continue;

                $mataKuliah = $pbl->mataKuliah;
                $dosenId = $item['dosen_id'];
                $blok = $mataKuliah->blok;
                $semester = $mataKuliah->semester;

                // Skip constraint check untuk Koordinator dan Tim Blok
                $user = User::find($dosenId);
                $isKoordinatorOrTimBlok = false;

                if ($user && $user->dosenPeran) {
                    $isKoordinatorOrTimBlok = $user->dosenPeran->contains(function ($peran) use ($mataKuliah) {
                        return ($peran->tipe_peran === 'koordinator' || $peran->tipe_peran === 'tim_blok') &&
                            $peran->mata_kuliah_kode === $mataKuliah->kode &&
                            $peran->semester === $mataKuliah->semester;
                    });
                }

                // Hanya validasi constraint untuk Dosen Mengajar
                if (!$isKoordinatorOrTimBlok) {
                    // Cek apakah dosen sudah di-assign sebagai Dosen Mengajar di blok yang sama
                    // tapi semester berbeda dalam data yang sudah ada di database
                    $existingAssignments = PBLMapping::where('dosen_id', $dosenId)
                        ->whereHas('pbl.mataKuliah', function ($query) use ($blok) {
                            $query->where('blok', $blok);
                        })
                        ->with('pbl.mataKuliah')
                        ->get();

                    foreach ($existingAssignments as $existingAssignment) {
                        $existingMk = $existingAssignment->pbl->mataKuliah;
                        if ($existingMk->semester !== $semester) {
                            // PERUBAHAN: Berikan warning alih-alih memblokir assignment
                            $dosenName = $user ? $user->name : "ID {$dosenId}";

                            // Log warning untuk monitoring
                            \Log::warning("Constraint Warning: Dosen {$dosenName} (ID: {$dosenId}) akan mengajar di Blok {$blok} di multiple semester", [
                                'existing_semester' => $existingMk->semester,
                                'new_semester' => $semester,
                                'blok' => $blok
                            ]);

                            // Catat warning untuk response (tidak memblokir)
                            if (!isset($warnings)) $warnings = [];
                            $warnings[] = [
                                'type' => 'constraint_warning',
                                'message' => "⚠️ PERINGATAN: Dosen {$dosenName} sudah mengajar di Blok {$blok} Semester {$existingMk->semester}. Assignment ke Semester {$semester} tetap diizinkan, namun perhatikan distribusi beban mengajar.",
                                'dosen_id' => $dosenId,
                                'dosen_name' => $dosenName,
                                'existing_blok' => $blok,
                                'existing_semester' => $existingMk->semester,
                                'new_semester' => $semester
                            ];
                        }
                    }

                    // Cek apakah dosen akan di-assign ke blok yang sama di semester berbeda
                    // dalam batch assignment yang sama
                    if (!isset($dosenBlokSemesterMap[$dosenId])) {
                        $dosenBlokSemesterMap[$dosenId] = [];
                    }
                    if (!isset($dosenBlokSemesterMap[$dosenId][$blok])) {
                        $dosenBlokSemesterMap[$dosenId][$blok] = [];
                    }

                    // PERUBAHAN: Izinkan assignment ke blok yang sama di semester yang sama
                    // karena ini adalah assignment yang berbeda (modul PBL yang berbeda)
                    // Yang penting adalah mencegah assignment ke blok yang sama di semester BERBEDA

                    $dosenBlokSemesterMap[$dosenId][$blok][] = $semester;
                }
            }

            $results = [];

            foreach ($data['assignments'] as $item) {
                try {
                    $pbl = PBL::find($item['pbl_id']);
                    if (!$pbl) {
                        $results[] = [
                            'pbl_id' => $item['pbl_id'],
                            'dosen_id' => $item['dosen_id'],
                            'status' => 'error',
                            'message' => 'PBL tidak ditemukan',
                        ];
                        continue;
                    }

                    // Ambil mata kuliah untuk validasi keahlian
                    $mataKuliah = $pbl->mataKuliah;
                    if (!$mataKuliah) {
                        $results[] = [
                            'pbl_id' => $item['pbl_id'],
                            'dosen_id' => $item['dosen_id'],
                            'status' => 'error',
                            'message' => 'Mata kuliah tidak ditemukan',
                        ];
                        continue;
                    }

                    // Cek apakah dosen ini adalah Koordinator atau Tim Blok untuk mata kuliah ini
                    $user = User::find($item['dosen_id']);
                    $isKoordinatorOrTimBlok = false;

                    if ($user && $user->dosenPeran) {
                        $isKoordinatorOrTimBlok = $user->dosenPeran->contains(function ($peran) use ($mataKuliah) {
                            return ($peran->tipe_peran === 'koordinator' || $peran->tipe_peran === 'tim_blok') &&
                                $peran->mata_kuliah_kode === $mataKuliah->kode &&
                                $peran->semester === $mataKuliah->semester;
                        });
                    }

                    // Validasi keahlian_required hanya untuk Dosen Mengajar (bukan Koordinator/Tim Blok)
                    if (!$isKoordinatorOrTimBlok) {
                        if (empty($mataKuliah->keahlian_required) || count($mataKuliah->keahlian_required) === 0) {
                            $results[] = [
                                'pbl_id' => $item['pbl_id'],
                                'dosen_id' => $item['dosen_id'],
                                'status' => 'error',
                                'message' => 'Mata kuliah belum diisi keahlian_required',
                            ];
                            continue;
                        }
                    }

                    // Cek existing assignment
                    $existing = PBLMapping::where('pbl_id', $item['pbl_id'])->where('dosen_id', $item['dosen_id'])->first();
                    if ($existing) {
                        $results[] = [
                            'pbl_id' => $item['pbl_id'],
                            'dosen_id' => $item['dosen_id'],
                            'status' => 'skipped',
                            'message' => 'Sudah diassign',
                        ];
                        continue;
                    }

                    // Assign
                    PBLMapping::create([
                        'pbl_id' => $item['pbl_id'],
                        'dosen_id' => $item['dosen_id'],
                        'role' => $item['role'] ?? 'dosen_mengajar',
                    ]);

                    // === PENTING: Buat DosenPeran record untuk Dosen Mengajar ===
                    // Jika dosen ini bukan Koordinator atau Tim Blok, buat record DosenPeran
                    if (!$isKoordinatorOrTimBlok) {
                        try {
                            // Cek apakah sudah ada DosenPeran record untuk dosen ini di mata kuliah ini
                            $existingDosenPeran = \App\Models\DosenPeran::where([
                                'user_id' => $item['dosen_id'],
                                'mata_kuliah_kode' => $mataKuliah->kode,
                                'semester' => $mataKuliah->semester,
                                'tipe_peran' => 'dosen_mengajar'
                            ])->first();

                            if (!$existingDosenPeran) {
                                // Buat DosenPeran record baru
                                \App\Models\DosenPeran::create([
                                    'user_id' => $item['dosen_id'],
                                    'mata_kuliah_kode' => $mataKuliah->kode,
                                    'blok' => $mataKuliah->blok ?? 0,
                                    'semester' => $mataKuliah->semester,
                                    'tipe_peran' => 'dosen_mengajar',
                                    'peran_kurikulum' => $user->peran_kurikulum_mengajar ?? null,
                                    'created_at' => now(),
                                    'updated_at' => now()
                                ]);

                                \Log::info("Created DosenPeran record for Dosen Mengajar", [
                                    'user_id' => $item['dosen_id'],
                                    'mata_kuliah_kode' => $mataKuliah->kode,
                                    'blok' => $mataKuliah->blok,
                                    'semester' => $mataKuliah->semester,
                                    'tipe_peran' => 'dosen_mengajar'
                                ]);
                            }
                        } catch (\Exception $e) {
                            \Log::error("Failed to create DosenPeran record", [
                                'user_id' => $item['dosen_id'],
                                'mata_kuliah_kode' => $mataKuliah->kode,
                                'error' => $e->getMessage()
                            ]);
                            // Don't fail the entire assignment if DosenPeran creation fails
                        }
                    }

                    // Increment pbl_assignment_count
                    $user = User::find($item['dosen_id']);
                    if ($user) $user->increment('pbl_assignment_count');

                    // === KUMPULKAN DATA UNTUK NOTIFIKASI KONSOLIDASI ===
                    $dosenId = $item['dosen_id'];
                    $blok = $mataKuliah->blok ?? 0;
                    $semester = $mataKuliah->semester ?? 1; // Default ke semester 1 (Ganjil) jika tidak ada

                    // Ambil peran yang sebenarnya dari database DosenPeran
                    $tipePeran = 'Dosen Mengajar'; // default
                    if ($isKoordinatorOrTimBlok) {
                        // Cari peran yang sebenarnya dari DosenPeran
                        $dosenPeran = \App\Models\DosenPeran::where([
                            'user_id' => $item['dosen_id'],
                            'mata_kuliah_kode' => $mataKuliah->kode,
                            'semester' => $mataKuliah->semester
                        ])->whereIn('tipe_peran', ['koordinator', 'tim_blok'])->first();

                        if ($dosenPeran) {
                            // Gunakan peran yang sebenarnya dari database
                            $tipePeran = ucfirst(str_replace('_', ' ', $dosenPeran->tipe_peran));
                        } else {
                            $tipePeran = 'Tim Blok'; // fallback
                        }
                    }

                    if (!isset($blockNotifications[$dosenId])) {
                        $blockNotifications[$dosenId] = [];
                    }
                    if (!isset($blockNotifications[$dosenId][$blok])) {
                        $blockNotifications[$dosenId][$blok] = [];
                    }
                    if (!isset($blockNotifications[$dosenId][$blok][$semester])) {
                        $blockNotifications[$dosenId][$blok][$semester] = [
                            'moduls' => [],
                            'mata_kuliah_kode' => $mataKuliah->kode,
                            'mata_kuliah_nama' => $mataKuliah->nama,
                            'tipe_peran' => $tipePeran,
                            'periode' => '2024/2025',
                            'durasi' => '8 Minggu'
                        ];
                    }

                    // Tambahkan modul ke array
                    $blockNotifications[$dosenId][$blok][$semester]['moduls'][] = [
                        'modul_ke' => $pbl->modul_ke,
                        'nama_modul' => $pbl->nama_modul,
                        'pbl_id' => $item['pbl_id']
                    ];

                    // Buat jadwal PBL untuk dosen ini
                    $jadwalResult = $this->createJadwalPBL($pbl, $item['dosen_id']);
                    \Log::info("JadwalPBL creation result for PBL {$pbl->id}, Dosen {$item['dosen_id']}: " . ($jadwalResult ? 'Success' : 'Failed'));

                    activity()
                        ->causedBy(Auth::user())
                        ->performedOn($pbl)
                        ->withProperties(['attributes' => ['dosen_id' => $item['dosen_id']]])
                        ->log("Dosen dengan ID {$item['dosen_id']} di-assign ke PBL (batch)");

                    $results[] = [
                        'pbl_id' => $item['pbl_id'],
                        'dosen_id' => $item['dosen_id'],
                        'status' => 'success',
                    ];
                } catch (\Exception $e) {
                    $results[] = [
                        'pbl_id' => $item['pbl_id'],
                        'dosen_id' => $item['dosen_id'],
                        'status' => 'error',
                        'message' => 'Terjadi error: ' . $e->getMessage(),
                    ];
                }
            }

            // === KIRIM NOTIFIKASI KONSOLIDASI PER BLOK ===
            $notificationController = new NotificationController();

            foreach ($blockNotifications as $dosenId => $blokData) {
                foreach ($blokData as $blok => $semesterData) {
                    foreach ($semesterData as $semester => $blockInfo) {
                        // Hitung total kelompok untuk semester ini (bukan per mata kuliah)
                        $totalKelompok = \App\Models\KelompokKecil::where('semester', $semester)
                            ->distinct('nama_kelompok')
                            ->count('nama_kelompok');

                        // Tambahkan total kelompok ke data
                        $blockInfo['total_kelompok'] = $totalKelompok;
                        $blockInfo['blok'] = $blok;
                        $blockInfo['semester'] = $semester; // Tambahkan kembali untuk NotificationController

                        // Kirim notifikasi konsolidasi
                        try {
                            $notificationController->createPBLBlockAssignmentNotification($dosenId, $blockInfo);
                            \Log::info("Sent consolidated notification for Dosen {$dosenId}, Blok {$blok}, Semester {$semester}", [
                                'modul_count' => count($blockInfo['moduls']),
                                'total_kelompok' => $totalKelompok
                            ]);
                        } catch (\Exception $e) {
                            \Log::error("Failed to send consolidated notification", [
                                'dosen_id' => $dosenId,
                                'blok' => $blok,
                                'semester' => $semester,
                                'error' => $e->getMessage()
                            ]);
                        }
                    }
                }
            }

            return response()->json([
                'results' => $results,
                'warnings' => $warnings ?? [],
                'has_warnings' => !empty($warnings)
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Terjadi error fatal: ' . $e->getMessage(),
                'results' => []
            ], 500);
        }
    }

    /**
     * Batch reset assignment dosen pada banyak PBL sekaligus
     */
    public function resetDosenBatch(Request $request)
    {
        $data = $request->validate([
            'pbl_ids' => 'required|array',
            'pbl_ids.*' => 'required|integer|exists:pbls,id',
        ]);

        $results = [];

        foreach ($data['pbl_ids'] as $pblId) {
            try {
                $pbl = PBL::find($pblId);
                if ($pbl) {
                    activity()
                        ->causedBy(Auth::user())
                        ->performedOn($pbl)
                        ->log("Semua dosen pada PBL ini telah di-reset (batch)");
                }

                // Ambil semua dosen yang di-assign ke PBL ini sebelum dihapus
                $assignedDosenIds = PBLMapping::where('pbl_id', $pblId)
                    ->pluck('dosen_id')
                    ->unique();

                // Hapus mapping
                $deleted = PBLMapping::where('pbl_id', $pblId)->delete();

                // === PENTING: Hapus DosenPeran records untuk Dosen Mengajar ===
                // Hapus DosenPeran records yang terkait dengan PBL ini
                $deletedDosenPeran = 0;
                foreach ($assignedDosenIds as $dosenId) {
                    // Cari mata kuliah dari PBL
                    $pbl = PBL::find($pblId);
                    if ($pbl && $pbl->mataKuliah) {
                        // Hapus DosenPeran record dengan tipe_peran 'dosen_mengajar' untuk mata kuliah ini
                        $deletedCount = DosenPeran::where([
                            'user_id' => $dosenId,
                            'mata_kuliah_kode' => $pbl->mata_kuliah_kode,
                            'tipe_peran' => 'dosen_mengajar'
                        ])->delete();
                        $deletedDosenPeran += $deletedCount;
                    }
                }

                // Reset pbl_assignment_count untuk semua dosen yang terpengaruh
                foreach ($assignedDosenIds as $dosenId) {
                    $user = User::find($dosenId);
                    if ($user && $user->pbl_assignment_count > 0) {
                        $user->decrement('pbl_assignment_count');
                    }
                }

                $results[] = [
                    'pbl_id' => $pblId,
                    'status' => 'success',
                    'deleted_count' => $deleted,
                    'deleted_dosen_peran_count' => $deletedDosenPeran,
                    'reset_dosen_count' => count($assignedDosenIds),
                ];
            } catch (\Exception $e) {
                Log::error('Error in resetDosenBatch for PBL ID: ' . $pblId, [
                    'pbl_id' => $pblId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);

                $results[] = [
                    'pbl_id' => $pblId,
                    'status' => 'error',
                    'message' => 'Terjadi error: ' . $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'message' => 'Batch reset selesai',
            'results' => $results
        ]);
    }

    /**
     * Internal method to check if a blok has been generated
     */
    private function checkBlokGeneratedInternal($blokId)
    {
        // Get all mata kuliah for the specified blok
        $mataKuliahBlok = \App\Models\MataKuliah::where('blok', $blokId)
            ->where('jenis', 'Blok')
            ->pluck('kode');

        if ($mataKuliahBlok->isEmpty()) {
            return [
                'blok_id' => $blokId,
                'has_pbl' => false,
                'has_generated' => false,
                'message' => 'Blok tidak memiliki mata kuliah PBL'
            ];
        }

        // Get all PBLs for this blok
        $pbls = \App\Models\PBL::whereIn('mata_kuliah_kode', $mataKuliahBlok)->get();

        if ($pbls->isEmpty()) {
            return [
                'blok_id' => $blokId,
                'has_pbl' => false,
                'has_generated' => false,
                'message' => 'Blok tidak memiliki modul PBL'
            ];
        }

        // Get all PBL IDs
        $pblIds = $pbls->pluck('id');

        // Check if there are any assignments
        $assignments = \App\Models\PBLMapping::whereIn('pbl_id', $pblIds)->get();

        if ($assignments->isEmpty()) {
            return [
                'blok_id' => $blokId,
                'has_pbl' => true,
                'has_generated' => false,
                'message' => 'Blok belum di-generate'
            ];
        }

        // Check if there are any assignments (any assignment counts as "generated")
        $hasDosenMengajar = $assignments->isNotEmpty();

        // Log untuk debugging
        Log::info("Blok {$blokId} validation", [
            'has_pbl' => true,
            'has_generated' => $hasDosenMengajar,
            'total_assignments' => $assignments->count(),
            'message' => $hasDosenMengajar ? 'Blok sudah di-generate' : 'Blok belum di-generate',
            'note' => 'Validasi berlaku untuk semua blok: Blok 1, 2, 3, 4'
        ]);

        return [
            'blok_id' => $blokId,
            'has_pbl' => true,
            'has_generated' => $hasDosenMengajar,
            'message' => $hasDosenMengajar ? 'Blok sudah di-generate' : 'Blok belum di-generate (hanya koordinator/tim_blok)'
        ];
    }

    /**
     * Buat jadwal PBL untuk dosen
     */
    private function createJadwalPBL($pbl, $dosenId)
    {
        try {
            \Log::info("Creating JadwalPBL for PBL ID: {$pbl->id}, Dosen ID: {$dosenId}");

            // Ambil data mata kuliah
            $mataKuliah = $pbl->mataKuliah;
            if (!$mataKuliah) {
                \Log::error("MataKuliah not found for PBL ID: {$pbl->id}");
                return false;
            }

            // Ambil kelompok kecil yang tersedia untuk mata kuliah ini
            $kelompokKecil = \App\Models\KelompokKecil::where('mata_kuliah_kode', $mataKuliah->kode)
                ->where('semester', $mataKuliah->semester)
                ->first();

            if (!$kelompokKecil) {
                // Jika tidak ada kelompok kecil, buat default
                $kelompokKecil = \App\Models\KelompokKecil::create([
                    'nama_kelompok' => 'Kelompok 1',
                    'mata_kuliah_kode' => $mataKuliah->kode,
                    'semester' => $mataKuliah->semester,
                    'kapasitas' => 8,
                ]);
            }

            // Ambil ruangan yang tersedia
            $ruangan = \App\Models\Ruangan::first();
            if (!$ruangan) {
                // Jika tidak ada ruangan, buat default
                $ruangan = \App\Models\Ruangan::create([
                    'nama' => 'Ruang PBL 1',
                    'kapasitas' => 30,
                    'jenis' => 'PBL',
                ]);
            }

            // Buat jadwal PBL
            $jadwalPBL = \App\Models\JadwalPBL::create([
                'mata_kuliah_kode' => $mataKuliah->kode,
                'pbl_id' => $pbl->id,
                'kelompok_kecil_id' => $kelompokKecil->id,
                'dosen_id' => $dosenId,
                'ruangan_id' => $ruangan->id,
                'tanggal' => now()->addDays(7)->format('Y-m-d'), // Jadwal 1 minggu dari sekarang
                'jam_mulai' => '08:00',
                'jam_selesai' => '10:00',
                'pbl_tipe' => 'PBL ' . $pbl->modul_ke,
                'status_konfirmasi' => 'belum_konfirmasi',
            ]);

            \Log::info("JadwalPBL created successfully: {$jadwalPBL->id}");
            return $jadwalPBL;
        } catch (\Exception $e) {
            \Log::error('Error creating JadwalPBL: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get PBL assignments for specific dosen
     */
    public function getDosenPBLAssignments($dosenId)
    {
        try {
            // Check if dosen exists
            $dosen = User::find($dosenId);
            if (!$dosen) {
                return response()->json([
                    'message' => 'Dosen tidak ditemukan',
                    'data' => []
                ], 404);
            }

            // Get PBL mappings for this dosen
            $pblMappings = PBLMapping::with([
                'pbl.mataKuliah',
                'dosen'
            ])
                ->where('dosen_id', $dosenId)
                ->get();

            // Group by blok and semester
            $groupedAssignments = [];

            foreach ($pblMappings as $mapping) {
                $pbl = $mapping->pbl;
                $mataKuliah = $pbl->mataKuliah;

                if (!$mataKuliah) continue;

                $blok = $mataKuliah->blok;
                $semester = $mataKuliah->semester;
                $semesterType = $semester % 2 === 1 ? 'ganjil' : 'genap';

                $key = "blok_{$blok}_semester_{$semester}";

                if (!isset($groupedAssignments[$key])) {
                    $groupedAssignments[$key] = [
                        'blok' => $blok,
                        'semester' => $semester,
                        'semester_type' => $semesterType,
                        'mata_kuliah' => [
                            'kode' => $mataKuliah->kode,
                            'nama' => $mataKuliah->nama,
                            'periode' => $mataKuliah->periode ?? '2024/2025',
                            'durasi' => $mataKuliah->durasi ?? '8 Minggu'
                        ],
                        'pbl_assignments' => [],
                        'total_pbl' => 0,
                        'status' => 'generated'
                    ];
                }

                // Get dosen peran for this assignment
                $dosenPeran = DosenPeran::where([
                    'user_id' => $dosenId,
                    'mata_kuliah_kode' => $mataKuliah->kode,
                    'semester' => $semester
                ])->first();

                $tipePeran = $dosenPeran ? $dosenPeran->tipe_peran : 'dosen_mengajar';

                $groupedAssignments[$key]['pbl_assignments'][] = [
                    'pbl_id' => $pbl->id,
                    'modul_ke' => $pbl->modul_ke,
                    'nama_modul' => $pbl->nama_modul,
                    'tipe_peran' => $tipePeran,
                    'peran_display' => $this->getPeranDisplay($tipePeran),
                    'waktu' => '5x50 menit',
                    'durasi_modul' => '2 Minggu'
                ];

                $groupedAssignments[$key]['total_pbl']++;
            }

            // Convert to array and sort by blok and semester
            $result = array_values($groupedAssignments);
            usort($result, function ($a, $b) {
                if ($a['semester'] !== $b['semester']) {
                    return $a['semester'] - $b['semester'];
                }
                return $a['blok'] - $b['blok'];
            });

            return response()->json([
                'message' => 'Data PBL assignments berhasil diambil',
                'data' => $result,
                'total_blok' => count($result)
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in getDosenPBLAssignments: ' . $e->getMessage(), [
                'dosen_id' => $dosenId,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Terjadi kesalahan saat mengambil data PBL assignments',
                'data' => []
            ], 500);
        }
    }

    /**
     * Helper method to get display text for peran
     */
    private function getPeranDisplay($tipePeran)
    {
        switch ($tipePeran) {
            case 'koordinator':
                return '👑 Koordinator';
            case 'tim_blok':
                return '🚀 Tim Blok';
            case 'dosen_mengajar':
                return '🎯 Dosen Mengajar';
            default:
                return '📚 Dosen';
        }
    }
}
