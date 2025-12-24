<?php

namespace App\Http\Controllers;

use App\Models\IKDPedoman;
use App\Models\IKDRekap;
use App\Models\IKDBuktiFisik;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class RekapIKDController extends Controller
{
    /**
     * Get all pedoman poin IKD
     */
    public function getPedomanPoin(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            // Check if user is super admin or ketua_ikd
            if (!in_array($user->role, ['super_admin', 'ketua_ikd'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized access'
                ], 403);
            }

            $query = IKDPedoman::query();

            // Filter by bidang if provided
            if ($request->has('bidang')) {
                $query->where('bidang', $request->bidang);
            }

            // Filter by active status
            if ($request->has('is_active')) {
                $query->where('is_active', $request->is_active);
            }

            $pedoman = $query->orderBy('bidang')->orderBy('no')->get();

            return response()->json([
                'success' => true,
                'data' => $pedoman
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching pedoman poin IKD: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store new pedoman poin IKD
     */
    public function storePedomanPoin(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            // Check if user is super admin or ketua_ikd
            if (!in_array($user->role, ['super_admin', 'ketua_ikd'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized access'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'no' => 'required|string',
                'kegiatan' => 'required|string',
                'indeks_poin' => 'nullable|numeric|min:0',
                'unit_kerja' => 'nullable|string',
                'bukti_fisik' => 'nullable|string',
                'prosedur' => 'nullable|string',
                'bidang' => 'required|string',
                'bidang_nama' => 'nullable|string',
                'parent_id' => 'nullable|exists:ikd_pedoman,id',
                'level' => 'nullable|integer|in:0,1',
                'is_active' => 'nullable|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();
            // Convert empty strings to null for nullable fields
            // unit_kerja should be preserved as string (don't convert to null) for proper filtering
            if (isset($data['bukti_fisik']) && $data['bukti_fisik'] === '') {
                $data['bukti_fisik'] = null;
            }
            if (isset($data['prosedur']) && $data['prosedur'] === '') {
                $data['prosedur'] = null;
            }
            // Don't convert unit_kerja to null - keep as string for filtering
            // If unit_kerja is provided (even if empty string), keep it as is

            $pedoman = IKDPedoman::create($data);

            return response()->json([
                'success' => true,
                'message' => 'Pedoman poin IKD berhasil ditambahkan',
                'data' => $pedoman
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error storing pedoman poin IKD: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update pedoman poin IKD
     */
    public function updatePedomanPoin(Request $request, $id): JsonResponse
    {
        try {
            $user = Auth::user();
            
            // Check if user is super admin or ketua_ikd
            if (!in_array($user->role, ['super_admin', 'ketua_ikd'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized access'
                ], 403);
            }

            $pedoman = IKDPedoman::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'no' => 'sometimes|required|string',
                'kegiatan' => 'sometimes|required|string',
                'indeks_poin' => 'nullable|numeric|min:0',
                'unit_kerja' => 'nullable|string',
                'bukti_fisik' => 'nullable|string',
                'prosedur' => 'nullable|string',
                'bidang' => 'sometimes|required|string',
                'bidang_nama' => 'nullable|string',
                'parent_id' => 'nullable|exists:ikd_pedoman,id',
                'level' => 'nullable|integer|in:0,1',
                'is_active' => 'nullable|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();
            // Convert empty strings to null for nullable fields
            // unit_kerja should be preserved as string (don't convert to null) for proper filtering
            if (isset($data['bukti_fisik']) && $data['bukti_fisik'] === '') {
                $data['bukti_fisik'] = null;
            }
            if (isset($data['prosedur']) && $data['prosedur'] === '') {
                $data['prosedur'] = null;
            }
            // Don't convert unit_kerja to null - keep as string for filtering
            // If unit_kerja is provided (even if empty string), keep it as is

            $pedoman->update($data);

            return response()->json([
                'success' => true,
                'message' => 'Pedoman poin IKD berhasil diupdate',
                'data' => $pedoman
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error updating pedoman poin IKD: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete pedoman poin IKD
     */
    public function destroyPedomanPoin($id): JsonResponse
    {
        try {
            $user = Auth::user();
            
            // Check if user is super admin or ketua_ikd
            if (!in_array($user->role, ['super_admin', 'ketua_ikd'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized access'
                ], 403);
            }

            $pedoman = IKDPedoman::find($id);

            if (!$pedoman) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pedoman poin IKD tidak ditemukan'
                ], 404);
            }

            // Delete related sub items if any (cascade delete)
            $pedoman->delete();

            return response()->json([
                'success' => true,
                'message' => 'Pedoman poin IKD berhasil dihapus'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error deleting pedoman poin IKD: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get rekap IKD by unit
     */
    public function getRekapByUnit(Request $request, $unit): JsonResponse
    {
        try {
            $user = Auth::user();
            
            // Mapping role to unit
            $roleToUnitMapping = [
                'akademik' => 'Akademik',
                'verifikator' => 'Dosen',
                'aik' => 'AIK',
                'meu' => 'MEU',
                'profesi' => 'Profesi',
                'kemahasiswaan' => 'Kemahasiswaan',
                'sdm' => 'SDM',
                'upt_jurnal' => 'UPT Jurnal',
                'upt_ppm' => 'UPT PPM',
            ];
            
            // Check authorization
            $userRole = $user->role;
            $allowedUnits = [];
            
            // Super admin and ketua_ikd can access all units
            if (in_array($userRole, ['super_admin', 'ketua_ikd'])) {
                $allowedUnits = ['Akademik', 'Dosen', 'AIK', 'MEU', 'Profesi', 'Kemahasiswaan', 'SDM', 'UPT Jurnal', 'UPT PPM'];
            } else {
                // Check if user's role maps to the requested unit
                $userUnit = $roleToUnitMapping[$userRole] ?? null;
                if ($userUnit && $userUnit === $unit) {
                    $allowedUnits = [$unit];
                } else {
                    return response()->json([
                        'success' => false,
                        'message' => 'Unauthorized access: Anda tidak memiliki akses untuk unit ini'
                    ], 403);
                }
            }
            
            // Validate unit is in allowed list
            if (!in_array($unit, $allowedUnits)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized access: Unit tidak valid atau tidak diizinkan'
                ], 403);
            }

            // Query dengan global scope aktif (otomatis filter semester aktif)
            // Jika ingin melihat semua semester, gunakan withoutSemesterFilter()
            $query = IKDRekap::with(['user', 'pedoman', 'semester'])
                ->where('unit', $unit);

            // Filter by tahun if provided
            if ($request->has('tahun')) {
                $query->where('tahun', $request->tahun);
            }

            // Filter by semester (1/2) if provided - untuk backward compatibility
            if ($request->has('semester')) {
                $query->where('semester', $request->semester);
            }

            // Filter by semester_id if provided (untuk melihat semester tertentu)
            if ($request->has('semester_id')) {
                $query->withoutSemesterFilter()->where('semester_id', $request->semester_id);
            }

            $rekap = $query->orderBy('tahun', 'desc')
                ->orderBy('semester', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $rekap
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching rekap IKD: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store rekap IKD
     */
    public function storeRekap(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            // Mapping role to unit
            $roleToUnitMapping = [
                'akademik' => 'Akademik',
                'verifikator' => 'Dosen',
                'aik' => 'AIK',
                'meu' => 'MEU',
                'profesi' => 'Profesi',
                'kemahasiswaan' => 'Kemahasiswaan',
                'sdm' => 'SDM',
                'upt_jurnal' => 'UPT Jurnal',
                'upt_ppm' => 'UPT PPM',
            ];

            $validator = Validator::make($request->all(), [
                'user_id' => 'nullable|exists:users,id',
                'ikd_pedoman_id' => 'required|exists:ikd_pedoman,id',
                'unit' => 'required|string|in:Akademik,Dosen,AIK,MEU,Profesi,Kemahasiswaan,SDM,UPT Jurnal,UPT PPM',
                'tahun' => 'required|integer|min:2000|max:3000',
                'semester' => 'nullable|integer|in:1,2',
                'poin' => 'required|integer|min:0',
                'keterangan' => 'nullable|string',
                'status' => 'sometimes|string|in:draft,submitted,approved,rejected',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            $validated = $validator->validated();
            $requestedUnit = $validated['unit'];
            $userRole = $user->role;
            
            // Check authorization
            // Super admin and ketua_ikd can create for any unit
            if (!in_array($userRole, ['super_admin', 'ketua_ikd'])) {
                // Check if user's role maps to the requested unit
                $userUnit = $roleToUnitMapping[$userRole] ?? null;
                if (!$userUnit || $userUnit !== $requestedUnit) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Unauthorized access: Anda tidak memiliki akses untuk membuat rekap di unit ini'
                    ], 403);
                }
            }

            $rekap = IKDRekap::create($validated);

            return response()->json([
                'success' => true,
                'message' => 'Rekap IKD berhasil ditambahkan',
                'data' => $rekap->load(['user', 'pedoman'])
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error storing rekap IKD: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get pedoman poin IKD by unit kerja
     * Unit kerja bisa multiple (dipisah koma), contoh: "Akademik, MEU"
     */
    public function getPedomanPoinByUnit(Request $request, $unit): JsonResponse
    {
        try {
            $user = Auth::user();
            
            // Mapping role to unit
            $roleToUnitMapping = [
                'akademik' => 'Akademik',
                'verifikator' => 'Dosen',
                'aik' => 'AIK',
                'meu' => 'MEU',
                'profesi' => 'Profesi',
                'kemahasiswaan' => 'Kemahasiswaan',
                'sdm' => 'SDM',
                'upt_jurnal' => 'UPT Jurnal',
                'upt_ppm' => 'UPT PPM',
            ];
            
            // Check authorization
            $userRole = $user->role;
            $allowedUnits = [];
            
            // Super admin, ketua_ikd, and tim_akademik can access all units
            if (in_array($userRole, ['super_admin', 'ketua_ikd', 'tim_akademik'])) {
                $allowedUnits = ['Akademik', 'Dosen', 'AIK', 'MEU', 'Profesi', 'Kemahasiswaan', 'SDM', 'UPT Jurnal', 'UPT PPM'];
            } else if ($userRole === 'dosen') {
                // Dosen can access all units to view their own data (for RekapIKDDetail page)
                $allowedUnits = ['Akademik', 'Dosen', 'AIK', 'MEU', 'Profesi', 'Kemahasiswaan', 'SDM', 'UPT Jurnal', 'UPT PPM'];
            } else {
                // Check if user's role maps to the requested unit
                $userUnit = $roleToUnitMapping[$userRole] ?? null;
                if ($userUnit && $userUnit === $unit) {
                    $allowedUnits = [$unit];
                } else {
                    return response()->json([
                        'success' => false,
                        'message' => 'Unauthorized access: Anda tidak memiliki akses untuk unit ini'
                    ], 403);
                }
            }
            
            // Validate unit is in allowed list
            if (!in_array($unit, $allowedUnits)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized access: Unit tidak valid atau tidak diizinkan'
                ], 403);
            }

            // Fetch pedoman poin IKD where unit_kerja contains the requested unit
            // Unit kerja bisa multiple (dipisah koma), jadi kita perlu check dengan lebih ketat
            // Mengambil level 0 (main items), level 1 (sub-items), level 2 (sub-sub-items), dan null (untuk kompatibilitas)
            $unitLower = strtolower(trim($unit));
            $query = IKDPedoman::where('is_active', true)
                ->where(function($q) use ($unit, $unitLower) {
                    // Exact match
                    $q->whereRaw('LOWER(TRIM(unit_kerja)) = ?', [$unitLower])
                      // Unit di awal (dipisah koma)
                      ->orWhereRaw('LOWER(TRIM(unit_kerja)) LIKE ?', [$unitLower . ',%'])
                      // Unit di tengah (dipisah koma di kedua sisi)
                      ->orWhereRaw('LOWER(TRIM(unit_kerja)) LIKE ?', ['%, ' . $unitLower . ',%'])
                      ->orWhereRaw('LOWER(TRIM(unit_kerja)) LIKE ?', ['%,' . $unitLower . ',%'])
                      // Unit di akhir (dipisah koma)
                      ->orWhereRaw('LOWER(TRIM(unit_kerja)) LIKE ?', ['%, ' . $unitLower])
                      ->orWhereRaw('LOWER(TRIM(unit_kerja)) LIKE ?', ['%,' . $unitLower]);
                })
                ->where(function($q) {
                    // Include level 0 (main items), 1 (sub-items), 2 (sub-sub-items), atau null (untuk kompatibilitas dengan data lama)
                    $q->whereIn('level', [0, 1, 2])
                      ->orWhereNull('level');
                })
                ->whereNotNull('kegiatan')
                ->where('kegiatan', '!=', '');

            // Filter by bidang if provided
            if ($request->has('bidang')) {
                $query->where('bidang', $request->bidang);
            }

            $pedoman = $query->orderBy('bidang')->orderBy('no')->orderBy('kegiatan')->get();

            return response()->json([
                'success' => true,
                'data' => $pedoman
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching pedoman poin IKD by unit: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get parent items by IDs (for indicators)
     */
    public function getParentItems(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            // Check authorization - same as getPedomanPoinByUnit
            $validator = Validator::make($request->all(), [
                'ids' => 'required|array',
                'ids.*' => 'required|integer'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            $ids = $request->ids;
            
            // Fetch parent items (level 0 dan level 1) berdasarkan IDs
            // Untuk nested structure seperti 33.1.a, kita perlu parent 33.1 (level 1) dan 33 (level 0)
            $parents = IKDPedoman::whereIn('id', $ids)
                ->where('is_active', true)
                ->whereIn('level', [0, 1]) // Level 0 (main items) dan level 1 (sub-items)
                ->get();

            return response()->json([
                'success' => true,
                'data' => $parents
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching parent items: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Upload bukti fisik file
     */
    public function uploadBuktiFisik(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            $validator = Validator::make($request->all(), [
                'user_id' => 'required|exists:users,id',
                'ikd_pedoman_id' => 'required|exists:ikd_pedoman,id',
                'unit' => 'required|string|in:Akademik,Dosen,AIK,MEU,Profesi,Kemahasiswaan,SDM,UPT Jurnal,UPT PPM',
                'file' => 'required|file|mimes:pdf,xlsx,xls,docx,doc,ppt,pptx,jpg,jpeg,png,gif,zip,rar|max:51200', // 50MB max
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Check authorization: 
            // Validasi upload berdasarkan unit:
            // - Untuk unit "Dosen": hanya dosen yang bisa upload untuk dirinya sendiri
            // - Untuk unit lain: verifikator dan super_admin bisa upload untuk user di unit tersebut
            $requestedUserId = $request->input('user_id');
            $file = $request->file('file');
            $ikdPedomanId = $request->input('ikd_pedoman_id');
            $unit = trim($request->input('unit'));
            
            // Validasi khusus untuk unit "Dosen"
            if ($unit === 'Dosen') {
                // Verifikator dan super_admin tidak boleh upload file untuk unit Dosen
                if (in_array($user->role, ['verifikator', 'super_admin', 'ketua_ikd'])) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Unauthorized: Verifikator dan Super Admin tidak dapat mengupload file. Hanya dosen yang dapat mengupload file untuk dirinya sendiri.'
                    ], 403);
                }
                
                // Dosen hanya bisa upload untuk dirinya sendiri
                if ($user->role === 'dosen' && $user->id != $requestedUserId) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Unauthorized: Anda hanya dapat mengupload file untuk diri sendiri'
                    ], 403);
                }
            } else {
                // Untuk unit lain (Akademik, AIK, MEU, dll):
                // - Super admin, ketua_ikd, dan verifikator bisa upload untuk siapa saja
                // - User dengan role sesuai unit bisa upload untuk dirinya sendiri
                
                // Mapping role to unit (hanya role yang bisa upload)
                $roleToUnitMapping = [
                    'akademik' => 'Akademik', // hanya role "akademik", bukan "tim_akademik"
                    'aik' => 'AIK',
                    'meu' => 'MEU',
                    'profesi' => 'Profesi',
                    'kemahasiswaan' => 'Kemahasiswaan',
                    'sdm' => 'SDM',
                    'upt_jurnal' => 'UPT Jurnal',
                    'upt_ppm' => 'UPT PPM',
                ];
                
                // Super admin, ketua_ikd, dan verifikator bisa upload untuk semua unit (kecuali Dosen)
                if (!in_array($user->role, ['super_admin', 'ketua_ikd', 'verifikator'])) {
                    // User biasa hanya bisa upload untuk dirinya sendiri di unit yang sesuai
                    $userUnit = $roleToUnitMapping[$user->role] ?? null;
                    if ($userUnit !== $unit) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Unauthorized: Anda tidak memiliki akses untuk mengupload file di unit ini'
                        ], 403);
                    }
                    
                    // User hanya bisa upload untuk dirinya sendiri
                    if ($user->id != $requestedUserId) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Unauthorized: Anda hanya dapat mengupload file untuk diri sendiri'
                        ], 403);
                    }
                }
            }
            
            // Generate unique filename
            $originalName = $file->getClientOriginalName();
            $extension = $file->getClientOriginalExtension();
            $filename = 'ikd_' . $requestedUserId . '_' . $ikdPedomanId . '_' . time() . '_' . $originalName;
            
            // Store file in storage/app/public/ikd_bukti_fisik
            $path = Storage::disk('public')->putFileAs('ikd_bukti_fisik', $file, $filename);
            
            // Get file info
            $fileType = $extension;
            $fileSize = $file->getSize();
            
            // Always create new record (support multiple files)
            // Reset status_verifikasi to null when new file is uploaded
            $buktiFisik = IKDBuktiFisik::create([
                'user_id' => $requestedUserId,
                'ikd_pedoman_id' => $ikdPedomanId,
                'unit' => $unit,
                'file_path' => $path,
                'file_name' => $originalName,
                'file_type' => $fileType,
                'file_size' => $fileSize,
                'status_verifikasi' => null, // Reset status saat upload baru
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'Bukti fisik berhasil diupload',
                'data' => $buktiFisik->load(['user', 'pedoman'])
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error uploading bukti fisik: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get bukti fisik per dosen (for realtime update)
     */
    public function getBuktiFisik(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            $validator = Validator::make($request->all(), [
                'user_id' => 'nullable|exists:users,id', // If null, return all for verifikator/super_admin/ketua_ikd
                'unit' => 'nullable|string', // Filter by unit
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            $query = IKDBuktiFisik::with(['user', 'pedoman']);
            
            // If user_id is provided, filter by user_id
            // If not provided and user is verifikator/super_admin/ketua_ikd/tim_akademik, return all
            $requestedUserId = $request->input('user_id');
            if ($requestedUserId) {
                // Check authorization: user can only view their own, unless super_admin/ketua_ikd/verifikator/tim_akademik
                if (!in_array($user->role, ['super_admin', 'ketua_ikd', 'verifikator', 'tim_akademik']) && $user->id != $requestedUserId) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Unauthorized: Anda hanya dapat melihat file Anda sendiri'
                    ], 403);
                }
                $query->where('user_id', $requestedUserId);
            } else {
                // If no user_id, only super_admin/ketua_ikd/verifikator/tim_akademik can see all
                // Role dosen hanya bisa melihat data dirinya sendiri
                if (!in_array($user->role, ['super_admin', 'ketua_ikd', 'verifikator', 'tim_akademik'])) {
                    // For other roles (including dosen), only show their own
                    $query->where('user_id', $user->id);
                }
            }
            
            // Filter by unit if provided
            // Sekarang filter berdasarkan kolom unit di tabel bukti fisik, bukan dari pedoman
            // Juga include data yang unit-nya NULL untuk backward compatibility dengan data lama
            if ($request->has('unit') && $request->input('unit')) {
                $unit = trim($request->input('unit'));
                if (!empty($unit)) {
                    $query->where(function($q) use ($unit) {
                        $q->where('unit', $unit)
                          ->orWhereNull('unit'); // Include data lama yang belum punya unit
                    });
                }
            }
            
            $buktiFisik = $query->get();
            
            // Add file URL for each bukti fisik
            $buktiFisik->transform(function($item) {
                $item->file_url = Storage::disk('public')->url($item->file_path);
                return $item;
            });
            
            return response()->json([
                'success' => true,
                'data' => $buktiFisik
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching bukti fisik: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete bukti fisik
     */
    public function deleteBuktiFisik($id): JsonResponse
    {
        try {
            $user = Auth::user();
            
            $buktiFisik = IKDBuktiFisik::findOrFail($id);
            
            // Check authorization: user can only delete their own, unless super_admin/ketua_ikd/verifikator
            if (!in_array($user->role, ['super_admin', 'ketua_ikd', 'verifikator']) && $user->id != $buktiFisik->user_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized: Anda hanya dapat menghapus file Anda sendiri'
                ], 403);
            }
            
            // Delete file from storage
            if (Storage::disk('public')->exists($buktiFisik->file_path)) {
                Storage::disk('public')->delete($buktiFisik->file_path);
            }
            
            // Delete record
            $buktiFisik->delete();
            
            return response()->json([
                'success' => true,
                'message' => 'Bukti fisik berhasil dihapus'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error deleting bukti fisik: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mark key as deleted (to prevent files from appearing after refresh)
     */
    public function markKeyAsDeleted(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            $validator = Validator::make($request->all(), [
                'unit' => 'required|string',
                'key' => 'required|string', // Format: user_id_ikd_pedoman_id
            ]);
            
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }
            
            $unit = $request->input('unit');
            $key = $request->input('key');
            
            // Store in cache with expiration (24 hours)
            $cacheKey = "deleted_keys_{$unit}";
            $deletedKeys = cache()->get($cacheKey, []);
            if (!in_array($key, $deletedKeys)) {
                $deletedKeys[] = $key;
                cache()->put($cacheKey, $deletedKeys, now()->addHours(24));
            }
            
            return response()->json([
                'success' => true,
                'message' => 'Key marked as deleted'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error marking key as deleted: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Get deleted keys for a unit
     */
    public function getDeletedKeys(Request $request): JsonResponse
    {
        try {
            $unit = $request->input('unit');
            if (!$unit) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unit is required'
                ], 422);
            }
            
            $cacheKey = "deleted_keys_{$unit}";
            $deletedKeys = cache()->get($cacheKey, []);
            
            return response()->json([
                'success' => true,
                'data' => $deletedKeys
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error getting deleted keys: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Remove key from deleted list (when new file is uploaded)
     */
    public function removeDeletedKey(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'unit' => 'required|string',
                'key' => 'required|string',
            ]);
            
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }
            
            $unit = $request->input('unit');
            $key = $request->input('key');
            
            $cacheKey = "deleted_keys_{$unit}";
            $deletedKeys = cache()->get($cacheKey, []);
            $deletedKeys = array_values(array_filter($deletedKeys, fn($k) => $k !== $key));
            cache()->put($cacheKey, $deletedKeys, now()->addHours(24));
            
            return response()->json([
                'success' => true,
                'message' => 'Key removed from deleted list'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error removing deleted key: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update skor for bukti fisik
     */
    public function updateSkor(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            $validator = Validator::make($request->all(), [
                'user_id' => 'required|exists:users,id',
                'ikd_pedoman_id' => 'required|exists:ikd_pedoman,id',
                'unit' => 'nullable|string|in:Akademik,Dosen,AIK,MEU,Profesi,Kemahasiswaan,SDM,UPT Jurnal,UPT PPM',
                'skor' => 'nullable|numeric|min:0|max:999999.99',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Check authorization: 
            // - Hanya verifikator dan super_admin yang bisa update skor (untuk menilai dosen)
            // - Dosen tidak bisa update skor sendiri
            $requestedUserId = $request->input('user_id');
            
            if (!in_array($user->role, ['super_admin', 'ketua_ikd', 'verifikator'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized: Hanya verifikator dan super admin yang dapat memberikan skor'
                ], 403);
            }

            $ikdPedomanId = $request->input('ikd_pedoman_id');
            $skor = $request->input('skor');
            $unit = $request->input('unit');

            // Find bukti fisik record
            // Jika unit disediakan, cari berdasarkan unit. Jika tidak, cari yang unit-nya NULL (backward compatibility)
            $query = IKDBuktiFisik::where('user_id', $requestedUserId)
                ->where('ikd_pedoman_id', $ikdPedomanId);
            
            if ($unit) {
                $query->where(function($q) use ($unit) {
                    $q->where('unit', $unit)
                      ->orWhereNull('unit'); // Include data lama
                });
            } else {
                $query->whereNull('unit'); // Jika tidak ada unit, hanya cari yang NULL
            }
            
            $buktiFisik = $query->first();

            if ($buktiFisik) {
                // Update existing record
                // Jika unit disediakan dan record belum punya unit, update unit juga
                $updateData = [
                    'skor' => $skor ? (float)$skor : null,
                ];
                
                if ($unit && !$buktiFisik->unit) {
                    $updateData['unit'] = $unit;
                }
                
                $buktiFisik->update($updateData);
            } else {
                // Create new record with only skor (no file)
                // Hanya create jika ada unit (untuk mencegah duplikasi)
                if ($unit) {
                    $buktiFisik = IKDBuktiFisik::create([
                        'user_id' => $requestedUserId,
                        'ikd_pedoman_id' => $ikdPedomanId,
                        'unit' => $unit,
                        'file_path' => '', // Empty for now
                        'file_name' => '', // Empty for now
                        'skor' => $skor ? (float)$skor : null,
                    ]);
                } else {
                    // Jika tidak ada unit, tidak bisa create (harus ada unit untuk data baru)
                    return response()->json([
                        'success' => false,
                        'message' => 'Unit harus disediakan untuk membuat record baru'
                    ], 422);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Skor berhasil diupdate',
                'data' => $buktiFisik->load(['user', 'pedoman'])
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error updating skor: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update status verifikasi bukti fisik
     */
    public function updateStatusVerifikasi(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            $validator = Validator::make($request->all(), [
                'bukti_fisik_id' => 'required|exists:ikd_bukti_fisik,id',
                'status_verifikasi' => 'required|in:salah,benar,perbaiki',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Check authorization: hanya verifikator dan super_admin yang bisa update status
            if (!in_array($user->role, ['super_admin', 'ketua_ikd', 'verifikator'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized: Hanya verifikator dan super admin yang dapat mengupdate status verifikasi'
                ], 403);
            }

            $buktiFisikId = $request->input('bukti_fisik_id');
            $statusVerifikasi = $request->input('status_verifikasi');
            
            $buktiFisik = IKDBuktiFisik::findOrFail($buktiFisikId);
            
            // Ambil semua file untuk kombinasi user_id + ikd_pedoman_id + unit yang sama
            $allFiles = IKDBuktiFisik::where('user_id', $buktiFisik->user_id)
                ->where('ikd_pedoman_id', $buktiFisik->ikd_pedoman_id)
                ->where('unit', $buktiFisik->unit)
                ->get();
            
            // Jika status = 'perbaiki', hapus semua file untuk user_id + ikd_pedoman_id + unit ini
            if ($statusVerifikasi === 'perbaiki') {
                // Hapus file fisik dari storage dan record dari database
                foreach ($allFiles as $file) {
                    if (Storage::disk('public')->exists($file->file_path)) {
                        Storage::disk('public')->delete($file->file_path);
                    }
                    $file->delete();
                }
                
                return response()->json([
                    'success' => true,
                    'message' => 'Semua file telah dihapus. Dosen harus upload ulang.',
                    'data' => null
                ]);
            }
            
            // Update status verifikasi untuk SEMUA file dengan status 'salah' atau 'benar'
            $updateData = [
                'status_verifikasi' => $statusVerifikasi,
            ];
            
            // Jika status = 'salah', set skor = 0 untuk semua file
            if ($statusVerifikasi === 'salah') {
                $updateData['skor'] = 0;
            }
            
            // Update semua file sekaligus
            IKDBuktiFisik::where('user_id', $buktiFisik->user_id)
                ->where('ikd_pedoman_id', $buktiFisik->ikd_pedoman_id)
                ->where('unit', $buktiFisik->unit)
                ->update($updateData);

            // Reload untuk mendapatkan data terbaru
            $updatedFiles = IKDBuktiFisik::where('user_id', $buktiFisik->user_id)
                ->where('ikd_pedoman_id', $buktiFisik->ikd_pedoman_id)
                ->where('unit', $buktiFisik->unit)
                ->with(['user', 'pedoman'])
                ->get();

            return response()->json([
                'success' => true,
                'message' => 'Status verifikasi berhasil diupdate untuk semua file',
                'data' => $updatedFiles
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error updating status verifikasi: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Download bukti fisik file
     */
    public function downloadBuktiFisik($id): \Symfony\Component\HttpFoundation\StreamedResponse|\Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();
            
            $buktiFisik = IKDBuktiFisik::find($id);
            
            if (!$buktiFisik) {
                \Log::error('Download bukti fisik - Not found', ['id' => $id]);
                return response()->json([
                    'success' => false,
                    'message' => 'Bukti fisik tidak ditemukan'
                ], 404);
            }

            // Check authorization: user can only download their own, unless super_admin/ketua_ikd/verifikator/tim_akademik
            if (!in_array($user->role, ['super_admin', 'ketua_ikd', 'verifikator', 'tim_akademik']) && $user->id != $buktiFisik->user_id) {
                \Log::warning('Download bukti fisik - Unauthorized', [
                    'user_id' => $user->id,
                    'user_role' => $user->role,
                    'bukti_fisik_user_id' => $buktiFisik->user_id
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized: Anda hanya dapat mengunduh file Anda sendiri'
                ], 403);
            }

            // Get file path from database (path relatif dari storage/app/public)
            $filePath = trim($buktiFisik->file_path);
            
            // Ensure file_path is not empty
            if (empty($filePath)) {
                \Log::error('Download bukti fisik - Empty file path', ['id' => $id]);
                return response()->json([
                    'success' => false,
                    'message' => 'File path tidak ditemukan di database'
                ], 404);
            }
            
            // Normalize path: remove leading slashes and ensure correct format
            $filePath = ltrim($filePath, '/\\');
            
            // Get absolute paths for verification (with error handling)
            $storagePath = storage_path('app/public/' . $filePath);
            $diskPath = null;
            $fileExists = false;
            $existsStorage = false;
            $existsFilesystem = false;
            
            try {
                $diskPath = Storage::disk('public')->path($filePath);
                $existsStorage = Storage::disk('public')->exists($filePath);
                $existsFilesystem = file_exists($diskPath);
                $fileExists = $existsStorage || $existsFilesystem;
            } catch (\Exception $pathException) {
                \Log::error('Download bukti fisik - Error getting path', [
                    'id' => $id,
                    'file_path' => $filePath,
                    'error' => $pathException->getMessage()
                ]);
                // Fallback: construct path manually
                $diskPath = $storagePath;
                $existsFilesystem = file_exists($diskPath);
                $fileExists = $existsFilesystem;
            }
            
            // Log for debugging
            \Log::info('Download bukti fisik - Attempting', [
                'id' => $id,
                'file_path_db' => $buktiFisik->file_path,
                'file_path_normalized' => $filePath,
                'file_name' => $buktiFisik->file_name,
                'storage_path' => $storagePath,
                'disk_path' => $diskPath,
                'exists_storage' => $existsStorage,
                'exists_filesystem' => $existsFilesystem
            ]);
            
            if (!$fileExists) {
                // Try to find file by pattern (in case filename in DB is truncated)
                $checkPath = $diskPath ?? $storagePath;
                $directory = dirname($checkPath);
                $baseName = basename($checkPath);
                
                // Safely get files in directory
                $filesInDir = 'N/A';
                try {
                    if (is_dir($directory) && is_readable($directory)) {
                        $files = scandir($directory);
                        if ($files !== false) {
                            $filesInDir = implode(', ', array_slice($files, 0, 10));
                        }
                    }
                } catch (\Exception $scanException) {
                    $filesInDir = 'Error reading directory: ' . $scanException->getMessage();
                }
                
                \Log::error('Download bukti fisik - File not found in storage', [
                    'id' => $id,
                    'file_path' => $filePath,
                    'storage_path' => $storagePath,
                    'disk_path' => $diskPath,
                    'check_path' => $checkPath,
                    'directory' => $directory,
                    'base_name' => $baseName,
                    'directory_exists' => is_dir($directory),
                    'directory_readable' => is_dir($directory) ? is_readable($directory) : false,
                    'files_in_dir' => $filesInDir
                ]);
                
                $errorPath = $diskPath ?? $storagePath;
                return response()->json([
                    'success' => false,
                    'message' => 'File tidak ditemukan di storage. Path: ' . $filePath . ' | Full path: ' . $errorPath
                ], 404);
            }

            // Sanitize filename for download
            $safeFileName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $buktiFisik->file_name);

            // Try Storage::download() first (menggunakan path dari database yang sudah dinormalisasi)
            try {
                \Log::info('Download bukti fisik - Using Storage::download()', [
                    'id' => $id,
                    'file_path' => $filePath,
                    'file_name' => $safeFileName,
                    'disk_path' => $diskPath
                ]);
                
                // Gunakan path yang sudah dinormalisasi dari database
                return Storage::disk('public')->download($filePath, $safeFileName);
            } catch (\Exception $storageException) {
                \Log::warning('Download bukti fisik - Storage::download() failed, trying fallback', [
                    'id' => $id,
                    'file_path' => $filePath,
                    'error' => $storageException->getMessage()
                ]);
                
                // Fallback: use response()->download() with absolute path (menggunakan $diskPath yang sudah ada)
                try {
                    // Ensure $diskPath is set (fallback to $storagePath if null)
                    $downloadPath = $diskPath ?? $storagePath;
                    
                    // Gunakan $downloadPath yang sudah dihitung sebelumnya
                    if (!file_exists($downloadPath)) {
                        \Log::error('Download bukti fisik - File not found in fallback', [
                            'id' => $id,
                            'file_path' => $filePath,
                            'disk_path' => $diskPath,
                            'storage_path' => $storagePath,
                            'download_path' => $downloadPath
                        ]);
                        return response()->json([
                            'success' => false,
                            'message' => 'File tidak ditemukan: ' . $downloadPath
                        ], 404);
                    }
                    
                    // Try to get mime type
                    $mimeType = 'application/octet-stream';
                    if (function_exists('mime_content_type')) {
                        $mimeType = mime_content_type($downloadPath) ?: $mimeType;
                    }
                    
                    \Log::info('Download bukti fisik - Using fallback response()->download()', [
                        'id' => $id,
                        'file_path' => $filePath,
                        'disk_path' => $diskPath,
                        'download_path' => $downloadPath,
                        'file_name' => $safeFileName
                    ]);
                    
                    return response()->download($downloadPath, $safeFileName, [
                        'Content-Type' => $mimeType,
                    ]);
                } catch (\Exception $fallbackException) {
                    \Log::error('Download bukti fisik - Both methods failed', [
                        'id' => $id,
                        'storage_error' => $storageException->getMessage(),
                        'fallback_error' => $fallbackException->getMessage(),
                        'trace' => $fallbackException->getTraceAsString()
                    ]);
                    throw $fallbackException; // Re-throw to be caught by outer catch
                }
            }
        } catch (\Exception $e) {
            \Log::error('Download bukti fisik - Exception', [
                'id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error downloading file: ' . $e->getMessage()
            ], 500);
        }
    }
}
