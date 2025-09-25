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
                        'is_veteran', 'veteran_notes', 'veteran_set_at', 'veteran_set_by', 'veteran_semester'
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
            'veteran_semester' => 'nullable|string'
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
                $user->veteran_semester = $request->veteran_semester ?? null;
            } else {
                $user->veteran_set_at = null;
                $user->veteran_set_by = null;
                $user->veteran_notes = null;
                $user->veteran_semester = null;
            }

            $user->save();

            // Log activity
            activity()
                ->performedOn($user)
                ->withProperties([
                    'is_veteran' => $request->is_veteran,
                    'veteran_notes' => $request->veteran_notes,
                    'veteran_semester' => $request->veteran_semester ?? null
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
