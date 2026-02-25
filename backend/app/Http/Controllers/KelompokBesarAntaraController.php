<?php

namespace App\Http\Controllers;

use App\Models\KelompokBesarAntara;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class KelompokBesarAntaraController extends Controller
{
    /**
     * Get all mahasiswa for selection
     */
    public function getMahasiswa()
    {
        $mahasiswa = User::where('role', 'mahasiswa')
            ->select('id', 'name', 'email', 'ipk')
            ->orderBy('name')
            ->get();

        return response()->json($mahasiswa);
    }

    /**
     * Get all kelompok besar antara (global for Antara semester)
     */
    public function index($mataKuliahKode = null)
    {
        $kelompokBesar = KelompokBesarAntara::all()
            ->map(function($kelompok) {
                $mahasiswa = User::whereIn('id', $kelompok->mahasiswa_ids ?? [])->get();
                return [
                    'id' => $kelompok->id,
                    'label' => $kelompok->nama_kelompok . ' (' . $mahasiswa->count() . ' mahasiswa)',
                    'jumlah_mahasiswa' => $mahasiswa->count(),
                    'mahasiswa' => $mahasiswa
                ];
            });

        return response()->json($kelompokBesar);
    }

    /**
     * Get single kelompok besar antara by ID
     */
    public function show($id)
    {
        $kelompokBesar = KelompokBesarAntara::findOrFail($id);

        return response()->json([
            'id' => $kelompokBesar->id,
            'nama_kelompok' => $kelompokBesar->nama_kelompok,
            'mahasiswa_ids' => $kelompokBesar->mahasiswa_ids ?? [],
            'created_at' => $kelompokBesar->created_at,
            'updated_at' => $kelompokBesar->updated_at
        ]);
    }

    /**
     * Create new kelompok besar antara
     */
    public function store(Request $request, $mataKuliahKode = null)
    {
        try {
            $data = $request->validate([
                'nama_kelompok' => 'required|string|max:255',
                'mahasiswa_ids' => 'required|array|min:1',
                'mahasiswa_ids.*' => 'exists:users,id',
            ]);

            // Check if mahasiswa already in another kelompok
            // Gunakan pendekatan yang lebih kompatibel dengan MySQL
            $existingKelompok = KelompokBesarAntara::all();
            $conflictingMahasiswa = [];

            foreach ($existingKelompok as $kelompok) {
                if (!empty($kelompok->mahasiswa_ids) && is_array($kelompok->mahasiswa_ids)) {
                    $overlap = array_intersect($data['mahasiswa_ids'], $kelompok->mahasiswa_ids);
                    if (!empty($overlap)) {
                        $conflictingMahasiswa = array_merge($conflictingMahasiswa, $overlap);
                    }
                }
            }

            if (!empty($conflictingMahasiswa)) {
                $conflictingNames = User::whereIn('id', array_unique($conflictingMahasiswa))
                    ->pluck('name')
                    ->toArray();
                return response()->json([
                    'message' => 'Beberapa mahasiswa sudah terdaftar di kelompok besar lain: ' . implode(', ', $conflictingNames)
                ], 422);
            }

            $kelompokBesar = KelompokBesarAntara::create($data);

            // Log activity
            activity()
                ->performedOn($kelompokBesar)
                ->withProperties([
                    'nama_kelompok' => $data['nama_kelompok'],
                    'mahasiswa_count' => count($data['mahasiswa_ids']),
                    'mata_kuliah_kode' => $mataKuliahKode
                ])
                ->log("Kelompok Besar Antara created: {$data['nama_kelompok']}");

            return response()->json($kelompokBesar, Response::HTTP_CREATED);
        } catch (\Exception $e) {
            Log::error('Error creating Kelompok Besar Antara: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            return response()->json([
                'message' => 'Gagal membuat kelompok besar. Silakan coba lagi.',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Update kelompok besar antara
     */
    public function update(Request $request, $mataKuliahKode = null, $id)
    {
        $kelompokBesar = KelompokBesarAntara::findOrFail($id);

        $data = $request->validate([
            'nama_kelompok' => 'required|string|max:255',
            'mahasiswa_ids' => 'required|array|min:1',
            'mahasiswa_ids.*' => 'exists:users,id',
        ]);

        // Check if mahasiswa already in another kelompok (excluding current)
        // Gunakan pendekatan yang lebih kompatibel dengan MySQL
        $existingKelompok = KelompokBesarAntara::where('id', '!=', $id)->get();
        $conflictingMahasiswa = [];

        foreach ($existingKelompok as $kelompok) {
            if (!empty($kelompok->mahasiswa_ids) && is_array($kelompok->mahasiswa_ids)) {
                $overlap = array_intersect($data['mahasiswa_ids'], $kelompok->mahasiswa_ids);
                if (!empty($overlap)) {
                    $conflictingMahasiswa = array_merge($conflictingMahasiswa, $overlap);
                }
            }
        }

        if (!empty($conflictingMahasiswa)) {
            $conflictingNames = User::whereIn('id', array_unique($conflictingMahasiswa))
                ->pluck('name')
                ->toArray();
            return response()->json([
                'message' => 'Beberapa mahasiswa sudah terdaftar di kelompok besar lain: ' . implode(', ', $conflictingNames)
            ], 422);
        }

        $kelompokBesar->update($data);

        // Log activity
        activity()
            ->performedOn($kelompokBesar)
            ->withProperties([
                'nama_kelompok' => $data['nama_kelompok'],
                'mahasiswa_count' => count($data['mahasiswa_ids']),
                'mata_kuliah_kode' => $mataKuliahKode
            ])
            ->log("Kelompok Besar Antara updated: {$data['nama_kelompok']}");

        return response()->json($kelompokBesar);
    }

    /**
     * Delete kelompok besar antara
     */
    public function destroy($id)
    {
        $kelompokBesar = KelompokBesarAntara::findOrFail($id);

        // CASCADE: Find and delete all kelompok kecil that depend on this kelompok besar
        $kelompokKecilToDelete = KelompokKecilAntara::where('kelompok_besar_antara_id', $kelompokBesar->id)->get();
        $deletedKelompokKecilCount = $kelompokKecilToDelete->count();
        
        // Log cascade deletion before deleting kelompok kecil
        foreach ($kelompokKecilToDelete as $kelompokKecil) {
            activity()
                ->performedOn($kelompokKecil)
                ->withProperties([
                    'nama_kelompok' => $kelompokKecil->nama_kelompok,
                    'cascade_from_kelompok_besar' => $kelompokBesar->nama_kelompok,
                    'mahasiswa_count' => count($kelompokKecil->mahasiswa_ids ?? []),
                ])
                ->log("CASCADE: Kelompok Kecil Antara deleted due to Kelompok Besar deletion: {$kelompokKecil->nama_kelompok}");
        }
        
        // Delete all dependent kelompok kecil
        KelompokKecilAntara::where('kelompok_besar_antara_id', $kelompokBesar->id)->delete();

        // Log activity before deletion of kelompok besar
        activity()
            ->performedOn($kelompokBesar)
            ->withProperties([
                'nama_kelompok' => $kelompokBesar->nama_kelompok,
                'mahasiswa_count' => count($kelompokBesar->mahasiswa_ids),
                'deleted_kelompok_kecil_count' => $deletedKelompokKecilCount,
            ])
            ->log("Kelompok Besar Antara deleted: {$kelompokBesar->nama_kelompok}");

        $kelompokBesar->delete();

        return response()->json([
            'message' => 'Kelompok besar berhasil dihapus',
            'cascade_effect' => [
                'deleted_kelompok_kecil_count' => $deletedKelompokKecilCount
            ]
        ], Response::HTTP_NO_CONTENT);
    }

    /**
     * Unassign mahasiswa from kelompok besar antara
     */
    public function unassignMahasiswa(Request $request, $id)
    {
        try {
            $data = $request->validate([
                'mahasiswa_ids' => 'required|array|min:1',
                'mahasiswa_ids.*' => 'exists:users,id',
            ]);

            $kelompokBesar = KelompokBesarAntara::findOrFail($id);
            
            // Remove mahasiswa from the kelompok
            $currentMahasiswaIds = $kelompokBesar->mahasiswa_ids ?? [];
            $remainingMahasiswaIds = array_values(array_diff($currentMahasiswaIds, $data['mahasiswa_ids']));
            
            $kelompokBesar->update(['mahasiswa_ids' => $remainingMahasiswaIds]);

            // CASCADE: Remove mahasiswa from kelompok kecil that depend on this kelompok besar
            $affectedKelompokKecil = [];
            $kelompokKecilList = KelompokKecilAntara::where('kelompok_besar_antara_id', $kelompokBesar->id)->get();
            
            foreach ($kelompokKecilList as $kelompokKecil) {
                $currentKecilMahasiswaIds = $kelompokKecil->mahasiswa_ids ?? [];
                $affectedMahasiswaIds = array_intersect($currentKecilMahasiswaIds, $data['mahasiswa_ids']);
                
                if (!empty($affectedMahasiswaIds)) {
                    // Remove the unassigned mahasiswa from kelompok kecil
                    $newKecilMahasiswaIds = array_values(array_diff($currentKecilMahasiswaIds, $data['mahasiswa_ids']));
                    $kelompokKecil->update(['mahasiswa_ids' => $newKecilMahasiswaIds]);
                    
                    $affectedKelompokKecil[] = [
                        'kelompok_kecil_id' => $kelompokKecil->id,
                        'nama_kelompok_kecil' => $kelompokKecil->nama_kelompok,
                        'affected_mahasiswa_count' => count($affectedMahasiswaIds)
                    ];
                    
                    // Log cascade effect for kelompok kecil
                    $affectedMahasiswaNames = User::whereIn('id', $affectedMahasiswaIds)->pluck('name')->toArray();
                    activity()
                        ->performedOn($kelompokKecil)
                        ->withProperties([
                            'nama_kelompok' => $kelompokKecil->nama_kelompok,
                            'cascade_from_kelompok_besar' => $kelompokBesar->nama_kelompok,
                            'unassigned_mahasiswa' => $affectedMahasiswaNames,
                            'remaining_count' => count($newKecilMahasiswaIds),
                        ])
                        ->log("CASCADE: Mahasiswa unassigned from Kelompok Kecil Antara due to Kelompok Besar changes: " . implode(', ', $affectedMahasiswaNames));
                }
            }

            // Get names of unassigned mahasiswa for logging
            $unassignedNames = User::whereIn('id', $data['mahasiswa_ids'])->pluck('name')->toArray();
            
            // Log activity
            activity()
                ->performedOn($kelompokBesar)
                ->withProperties([
                    'nama_kelompok' => $kelompokBesar->nama_kelompok,
                    'unassigned_mahasiswa' => $unassignedNames,
                    'remaining_count' => count($remainingMahasiswaIds),
                    'affected_kelompok_kecil' => $affectedKelompokKecil,
                ])
                ->log("Mahasiswa unassigned from Kelompok Besar Antara: " . implode(', ', $unassignedNames));

            return response()->json([
                'message' => count($data['mahasiswa_ids']) . ' mahasiswa berhasil di-unassign dari kelompok',
                'remaining_mahasiswa_ids' => $remainingMahasiswaIds,
                'remaining_count' => count($remainingMahasiswaIds),
                'cascade_effect' => [
                    'affected_kelompok_kecil_count' => count($affectedKelompokKecil),
                    'affected_kelompok_kecil' => $affectedKelompokKecil
                ]
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            Log::error('Error unassigning mahasiswa from Kelompok Besar Antara: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all(),
                'kelompok_id' => $id
            ]);
            return response()->json([
                'message' => 'Gagal meng-unassign mahasiswa. Silakan coba lagi.',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }
}
