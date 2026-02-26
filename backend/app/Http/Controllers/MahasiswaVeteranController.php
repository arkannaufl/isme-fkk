<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class MahasiswaVeteranController extends Controller
{
    /**
     * Get all veteran mahasiswa
     */
    public function index(Request $request): JsonResponse
    {
        try {
                $query = User::where('role', 'mahasiswa')
                    ->with('veteranSetBy:id,name')
                    ->select([
                        'id', 'name', 'nim', 'gender', 'ipk', 'status', 'angkatan', 'semester',
                        'is_veteran', 'is_multi_veteran', 'veteran_notes', 'veteran_set_at', 'veteran_set_by', 'veteran_semester', 'veteran_semesters', 'veteran_status',
                        'veteran_completed_at', 'veteran_duration_months', 'veteran_total_semesters'
                    ]);

            // Filter by veteran status
            if ($request->has('veteran_only') && $request->veteran_only) {
                $query->where('is_veteran', true);
            }

            // Filter by angkatan
            if ($request->has('angkatan') && $request->angkatan !== 'all') {
                $query->where('angkatan', $request->angkatan);
            }

            // Search
            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('nim', 'like', "%{$search}%")
                      ->orWhere('angkatan', 'like', "%{$search}%");
                });
            }

            $mahasiswa = $query->orderBy('name')->get();

            return response()->json($mahasiswa);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengambil data mahasiswa veteran',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle veteran status for a mahasiswa
     */
    public function toggleVeteran(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'is_veteran' => 'required|boolean',
            'veteran_notes' => 'nullable|string|max:1000',
            'veteran_semester' => 'nullable|string' // Deprecated: akan dihapus
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi gagal',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = User::findOrFail($request->user_id);

            // Check if user is mahasiswa
            if ($user->role !== 'mahasiswa') {
                return response()->json([
                    'message' => 'User bukan mahasiswa'
                ], 400);
            }

            $user->is_veteran = $request->is_veteran;
            $user->veteran_notes = $request->veteran_notes;

            if ($request->is_veteran) {
                $user->veteran_set_at = now();
                $user->veteran_set_by = Auth::id();

                // Handle mahasiswa yang sudah lulus
                if ($user->status === 'lulus') {
                    // Simpan semester saat lulus sebelum jadi veteran
                    $user->semester_saat_lulus = $user->semester;
                    
                    // Set status veteran tapi TIDAK naik semester dulu
                    $user->veteran_semester_count = 0; // Mulai dari 0, akan naik saat update semester
                    $user->semester = $user->semester_saat_lulus; // Tetap semester lulus dulu
                    
                    // Ubah status jadi "pre-veteran" (masih aktif tapi belum veteran aktif)
                    $user->status = 'aktif';
                    $user->veteran_status = 'pre_veteran'; // Status baru untuk pre-veteran
                } else {
                    // Mahasiswa aktif yang jadi pre-veteran
                    $user->veteran_semester_count = 0;
                    $user->veteran_status = 'pre_veteran'; // Status pre-veteran
                    // Semester TETAP, belum naik
                }

                // Hanya set status veteran, veteran_semesters kosong dulu
                // Semester akan diisi saat dipilih di Kelompok Besar/Kecil
                if ($request->veteran_semester) {
                    $user->veteran_semesters = [$request->veteran_semester];

                    // Tambah ke veteran_history jika ada semester
                    $history = $user->veteran_history ?? [];
                    $history[] = [
                        'semester' => $request->veteran_semester,
                        'active' => true,
                        'created_at' => now()->toISOString(),
                        'action' => 'set_veteran'
                    ];
                    $user->veteran_history = $history;
                } else {
                    // Jika tidak ada semester, veteran_semesters kosong
                    $user->veteran_semesters = [];
                }
            } else {
                $user->veteran_set_at = null;
                $user->veteran_set_by = null;
                $user->veteran_notes = null;

                // Handle hapus veteran status
                if ($user->veteran_status === 'aktif') {
                    // Jika veteran aktif yang dihapus (selesai veteran)
                    $completionDate = now();
                    $durationMonths = $user->veteran_set_at ? 
                        $completionDate->diffInMonths($user->veteran_set_at) : 0;
                    
                    $user->status = 'lulus';
                    $user->veteran_status = 'non_veteran';
                    $user->veteran_completed_at = $completionDate;
                    $user->veteran_duration_months = $durationMonths;
                    $user->veteran_total_semesters = $user->veteran_semester_count ?? 0;
                    
                    // Semester saat lulus adalah semester veteran terakhir
                    $user->semester = $user->semester; // Tetap semester veteran terakhir
                } elseif ($user->veteran_status === 'pre_veteran') {
                    // Jika pre-veteran yang dihapus, kembali ke mahasiswa normal
                    $user->veteran_status = 'non_veteran';
                    // Reset completion tracking (karena belum veteran aktif)
                    $user->veteran_completed_at = null;
                    $user->veteran_duration_months = null;
                    $user->veteran_total_semesters = null;
                    // Status tetap aktif, semester tetap (karena belum veteran aktif)
                }

                // Hapus veteran_semesters (status aktif)
                $user->veteran_semesters = [];

                // Tambah ke veteran_history bahwa veteran dihapus
                $history = $user->veteran_history ?? [];
                $history[] = [
                    'semester' => null,
                    'active' => false,
                    'created_at' => now()->toISOString(),
                    'action' => 'remove_veteran',
                    'previous_status' => $user->veteran_status === 'pre_veteran' ? 'pre_veteran' : 'aktif'
                ];
                $user->veteran_history = $history;
            }

            $user->save();

            // Log activity
            activity()
                ->performedOn($user)
                ->withProperties([
                    'is_veteran' => $request->is_veteran,
                    'veteran_notes' => $request->veteran_notes,
                    'veteran_semester' => $request->veteran_semester ?? null,
                    'previous_veteran_status' => $user->veteran_status
                ])
                ->log($request->is_veteran ? 'Mahasiswa ditetapkan sebagai veteran' : 'Status veteran mahasiswa dihapus');

            // Load relationship for response
            $user->load('veteranSetBy:id,name');

            return response()->json([
                'message' => $request->is_veteran ? 'Mahasiswa berhasil ditetapkan sebagai veteran' : 'Status veteran berhasil dihapus',
                'data' => $user
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengupdate status veteran',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk toggle veteran status
     */
    public function bulkToggleVeteran(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'exists:users,id',
            'is_veteran' => 'required|boolean',
            'veteran_notes' => 'nullable|string|max:1000'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi gagal',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $users = User::whereIn('id', $request->user_ids)
                ->where('role', 'mahasiswa')
                ->get();

            if ($users->isEmpty()) {
                return response()->json([
                    'message' => 'Tidak ada mahasiswa yang ditemukan'
                ], 400);
            }

            $updateData = [
                'is_veteran' => $request->is_veteran,
                'veteran_notes' => $request->veteran_notes
            ];

            if ($request->is_veteran) {
                $updateData['veteran_set_at'] = now();
                $updateData['veteran_set_by'] = Auth::id();
            } else {
                $updateData['veteran_set_at'] = null;
                $updateData['veteran_set_by'] = null;
                $updateData['veteran_notes'] = null;
            }

            User::whereIn('id', $request->user_ids)
                ->where('role', 'mahasiswa')
                ->update($updateData);

            // Log bulk activity
            activity()
                ->withProperties([
                    'user_ids' => $request->user_ids,
                    'is_veteran' => $request->is_veteran,
                    'veteran_notes' => $request->veteran_notes,
                    'count' => $users->count()
                ])
                ->log($request->is_veteran
                    ? "Bulk set veteran: {$users->count()} mahasiswa ditetapkan sebagai veteran"
                    : "Bulk remove veteran: Status veteran dihapus dari {$users->count()} mahasiswa"
                );

            return response()->json([
                'message' => $request->is_veteran
                    ? "{$users->count()} mahasiswa berhasil ditetapkan sebagai veteran"
                    : "Status veteran berhasil dihapus dari {$users->count()} mahasiswa"
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengupdate status veteran',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get veteran statistics
     */
    public function statistics(): JsonResponse
    {
        try {
            $totalMahasiswa = User::where('role', 'mahasiswa')->count();
            $totalVeteran = User::where('role', 'mahasiswa')->where('is_veteran', true)->count();
            $totalNonVeteran = $totalMahasiswa - $totalVeteran;

            $veteranByAngkatan = User::where('role', 'mahasiswa')
                ->where('is_veteran', true)
                ->selectRaw('angkatan, COUNT(*) as count')
                ->groupBy('angkatan')
                ->orderBy('angkatan', 'desc')
                ->get();

            return response()->json([
                'data' => [
                    'total_mahasiswa' => $totalMahasiswa,
                    'total_veteran' => $totalVeteran,
                    'total_non_veteran' => $totalNonVeteran,
                    'veteran_by_angkatan' => $veteranByAngkatan
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengambil statistik veteran',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle multi-veteran status for a mahasiswa
     */
    public function toggleMultiVeteran(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'is_multi_veteran' => 'required|boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi gagal',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = User::findOrFail($request->user_id);

            // Check if user is mahasiswa and veteran
            if ($user->role !== 'mahasiswa' || !$user->is_veteran) {
                return response()->json([
                    'message' => 'User harus mahasiswa veteran terlebih dahulu'
                ], 400);
            }

            $user->is_multi_veteran = $request->is_multi_veteran;

            // Jika multi-veteran dihapus, hapus semua veteran_semesters kecuali yang pertama kali didaftarkan
            if (!$request->is_multi_veteran && $user->veteran_semesters && count($user->veteran_semesters) > 1) {
                // Cari semester pertama dari veteran_history (yang pertama kali didaftarkan)
                $history = $user->veteran_history ?? [];
                $firstVeteranEntry = null;

                // Cari entry pertama dengan action 'set_veteran' atau 'add_to_semester'
                foreach ($history as $entry) {
                    if (isset($entry['action']) && in_array($entry['action'], ['set_veteran', 'add_to_semester']) && $entry['active'] === true) {
                        $firstVeteranEntry = $entry;
                        break;
                    }
                }

                // Jika ditemukan, gunakan semester dari entry pertama
                if ($firstVeteranEntry && isset($firstVeteranEntry['semester'])) {
                    $originalSemester = $firstVeteranEntry['semester'];
                    $user->veteran_semesters = [$originalSemester];

                    // Update veteran_history untuk mencatat penghapusan multi-veteran
                    $history[] = [
                        'semester' => null,
                        'active' => false,
                        'created_at' => now()->toISOString(),
                        'action' => 'remove_multi_veteran',
                        'note' => 'Multi-veteran dihapus, kembali ke semester asli: ' . $originalSemester
                    ];
                    $user->veteran_history = $history;
                } else {
                    // Fallback: gunakan semester pertama dari array
                    $firstSemester = $user->veteran_semesters[0];
                    $user->veteran_semesters = [$firstSemester];

                    $history[] = [
                        'semester' => null,
                        'active' => false,
                        'created_at' => now()->toISOString(),
                        'action' => 'remove_multi_veteran',
                        'note' => 'Multi-veteran dihapus, tersisa semester ' . $firstSemester
                    ];
                    $user->veteran_history = $history;
                }
            }

            $user->save();

            // Log activity
            activity()
                ->performedOn($user)
                ->withProperties([
                    'is_multi_veteran' => $request->is_multi_veteran
                ])
                ->log($request->is_multi_veteran ? 'Mahasiswa veteran dijadikan multi-veteran' : 'Status multi-veteran mahasiswa dihapus');

            // Load relationship for response
            $user->load('veteranSetBy:id,name');

            return response()->json([
                'message' => $request->is_multi_veteran ? 'Mahasiswa berhasil dijadikan multi-veteran' : 'Status multi-veteran berhasil dihapus',
                'data' => $user
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengupdate status multi-veteran',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add veteran to semester (tambahkan veteran ke semester)
     */
    public function addVeteranToSemester(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'semester' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi gagal',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = User::findOrFail($request->user_id);

            // Check if user is mahasiswa and veteran
            if ($user->role !== 'mahasiswa' || !$user->is_veteran) {
                return response()->json([
                    'message' => 'User bukan mahasiswa veteran'
                ], 400);
            }

            // Get current veteran_semesters array
            $currentSemesters = $user->veteran_semesters ?? [];

            // Add semester if not already exists
            if (!in_array($request->semester, $currentSemesters)) {
                $currentSemesters[] = $request->semester;
                $user->veteran_semesters = $currentSemesters;

                // Tambah ke veteran_history
                $history = $user->veteran_history ?? [];
                $history[] = [
                    'semester' => $request->semester,
                    'active' => true,
                    'created_at' => now()->toISOString(),
                    'action' => 'add_to_semester'
                ];
                $user->veteran_history = $history;

                $user->save();

                activity()
                    ->performedOn($user)
                    ->withProperties([
                        'semester' => $request->semester,
                        'veteran_semesters' => $currentSemesters
                    ])
                    ->log('Veteran ditambahkan ke semester ' . $request->semester);

                return response()->json([
                    'message' => 'Veteran berhasil ditambahkan ke semester',
                    'data' => $user
                ]);
            } else {
                return response()->json([
                    'message' => 'Veteran sudah terdaftar di semester ini'
                ], 400);
            }
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal menambahkan veteran ke semester',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove veteran from semester (keluarkan veteran dari semester)
     */
    public function removeVeteranFromSemester(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'semester' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi gagal',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = User::findOrFail($request->user_id);

            // Check if user is mahasiswa and veteran
            if ($user->role !== 'mahasiswa' || !$user->is_veteran) {
                return response()->json([
                    'message' => 'User bukan mahasiswa veteran'
                ], 400);
            }

            // Get current veteran_semesters array
            $currentSemesters = $user->veteran_semesters ?? [];

            // Remove semester if exists
            $key = array_search($request->semester, $currentSemesters);
            if ($key !== false) {
                unset($currentSemesters[$key]);
                $currentSemesters = array_values($currentSemesters); // Re-index array
                $user->veteran_semesters = $currentSemesters;
                $user->save();

                activity()
                    ->performedOn($user)
                    ->withProperties([
                        'semester' => $request->semester,
                        'veteran_semesters' => $currentSemesters
                    ])
                    ->log('Veteran dikeluarkan dari semester ' . $request->semester);

                return response()->json([
                    'message' => 'Veteran berhasil dikeluarkan dari semester',
                    'data' => $user
                ]);
            } else {
                return response()->json([
                    'message' => 'Veteran tidak terdaftar di semester ini'
                ], 400);
            }
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengeluarkan veteran dari semester',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Release veteran from semester (keluarkan veteran dari semester)
     */
    public function releaseFromSemester(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'semester' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi gagal',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = User::findOrFail($request->user_id);

            // Check if user is mahasiswa and veteran
            if ($user->role !== 'mahasiswa' || !$user->is_veteran) {
                return response()->json([
                    'message' => 'User bukan mahasiswa veteran'
                ], 400);
            }

            // Check if veteran is assigned to the specified semester
            if ($user->veteran_semester !== $request->semester) {
                return response()->json([
                    'message' => 'Veteran tidak terdaftar di semester ini'
                ], 400);
            }

            // Release veteran from semester
            $user->veteran_semester = null;
            $user->save();

            // Load relationship for response
            $user->load('veteranSetBy:id,name');

            return response()->json([
                'message' => 'Veteran berhasil dikeluarkan dari semester',
                'data' => $user
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengeluarkan veteran dari semester',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
