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
    public function destroy($mataKuliahKode = null, $id)
    {
        $kelompokBesar = KelompokBesarAntara::findOrFail($id);

        // Log activity before deletion
        activity()
            ->performedOn($kelompokBesar)
            ->withProperties([
                'nama_kelompok' => $kelompokBesar->nama_kelompok,
                'mahasiswa_count' => count($kelompokBesar->mahasiswa_ids),
                'mata_kuliah_kode' => $mataKuliahKode
            ])
            ->log("Kelompok Besar Antara deleted: {$kelompokBesar->nama_kelompok}");

        $kelompokBesar->delete();

        return response()->json(['message' => 'Kelompok besar berhasil dihapus'], Response::HTTP_NO_CONTENT);
    }
}
