<?php

namespace App\Http\Controllers;

use App\Models\KelompokKecilAntara;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class KelompokKecilAntaraController extends Controller
{
    /**
     * Get all kelompok kecil antara (global for Antara semester)
     */
    public function index($mataKuliahKode = null)
    {
        $kelompokKecil = KelompokKecilAntara::all()
            ->map(function($kelompok) {
                return [
                    'id' => $kelompok->id,
                    'nama_kelompok' => $kelompok->nama_kelompok,
                    'jumlah_anggota' => count($kelompok->mahasiswa_ids ?? []),
                    'mahasiswa_ids' => $kelompok->mahasiswa_ids ?? []
                ];
            });

        return response()->json($kelompokKecil);
    }

    /**
     * Create new kelompok kecil antara
     */
    public function store(Request $request, $mataKuliahKode = null)
    {
        try {
            $data = $request->validate([
                'nama_kelompok' => 'required|string|max:255',
                'mahasiswa_ids' => 'required|array|min:1',
                'mahasiswa_ids.*' => 'exists:users,id',
            ]);

            // Check if mahasiswa already in another kelompok kecil
            // Gunakan pendekatan yang lebih kompatibel dengan MySQL
            $existingKelompok = KelompokKecilAntara::all();
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
                    'message' => 'Beberapa mahasiswa sudah terdaftar di kelompok kecil lain: ' . implode(', ', $conflictingNames)
                ], 422);
            }

            $kelompokKecil = KelompokKecilAntara::create($data);

            // Log activity
            activity()
                ->performedOn($kelompokKecil)
                ->withProperties([
                    'nama_kelompok' => $data['nama_kelompok'],
                    'mahasiswa_count' => count($data['mahasiswa_ids']),
                    'mata_kuliah_kode' => $mataKuliahKode
                ])
                ->log("Kelompok Kecil Antara created: {$data['nama_kelompok']}");

            return response()->json($kelompokKecil, Response::HTTP_CREATED);
        } catch (\Exception $e) {
            Log::error('Error creating Kelompok Kecil Antara: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            return response()->json([
                'message' => 'Gagal membuat kelompok kecil. Silakan coba lagi.',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Update kelompok kecil antara
     */
    public function update(Request $request, $mataKuliahKode = null, $id)
    {
        try {
            $kelompokKecil = KelompokKecilAntara::findOrFail($id);

            $data = $request->validate([
                'nama_kelompok' => 'required|string|max:255',
                'mahasiswa_ids' => 'required|array|min:1',
                'mahasiswa_ids.*' => 'exists:users,id',
            ]);

            // Check if mahasiswa already in another kelompok kecil (excluding current)
            // Gunakan pendekatan yang lebih kompatibel dengan MySQL
            $existingKelompok = KelompokKecilAntara::where('id', '!=', $id)->get();
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
                    'message' => 'Beberapa mahasiswa sudah terdaftar di kelompok kecil lain: ' . implode(', ', $conflictingNames)
                ], 422);
            }

            $kelompokKecil->update($data);

            // Log activity
            activity()
                ->performedOn($kelompokKecil)
                ->withProperties([
                    'nama_kelompok' => $data['nama_kelompok'],
                    'mahasiswa_count' => count($data['mahasiswa_ids']),
                    'mata_kuliah_kode' => $mataKuliahKode
                ])
                ->log("Kelompok Kecil Antara updated: {$data['nama_kelompok']}");

            return response()->json($kelompokKecil);
        } catch (\Exception $e) {
            Log::error('Error updating Kelompok Kecil Antara: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all(),
                'id' => $id
            ]);
            return response()->json([
                'message' => 'Gagal mengupdate kelompok kecil. Silakan coba lagi.',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Delete kelompok kecil antara
     */
    public function destroy($mataKuliahKode = null, $id)
    {
        $kelompokKecil = KelompokKecilAntara::findOrFail($id);

        // Log activity before deletion
        activity()
            ->performedOn($kelompokKecil)
            ->withProperties([
                'nama_kelompok' => $kelompokKecil->nama_kelompok,
                'mahasiswa_count' => count($kelompokKecil->mahasiswa_ids),
                'mata_kuliah_kode' => $mataKuliahKode
            ])
            ->log("Kelompok Kecil Antara deleted: {$kelompokKecil->nama_kelompok}");

        $kelompokKecil->delete();

        return response()->json(['message' => 'Kelompok kecil berhasil dihapus'], Response::HTTP_NO_CONTENT);
    }

    /**
     * Get kelompok kecil antara by nama kelompok
     */
    public function getByNama(Request $request)
    {
        $namaKelompok = $request->query('nama_kelompok');

        if (!$namaKelompok) {
            return response()->json(['message' => 'Nama kelompok diperlukan'], 400);
        }

        $kelompok = KelompokKecilAntara::where('nama_kelompok', $namaKelompok)->first();

        if (!$kelompok) {
            return response()->json(['message' => 'Kelompok tidak ditemukan'], 404);
        }

        // Ambil data mahasiswa berdasarkan mahasiswa_ids
        $mahasiswa = User::whereIn('id', $kelompok->mahasiswa_ids ?? [])
            ->get()
            ->map(function($user) {
                return [
                    'id' => $user->id,
                    'nim' => $user->nim,
                    'name' => $user->name,
                    'email' => $user->email
                ];
            });

        return response()->json([
            'id' => $kelompok->id,
            'nama_kelompok' => $kelompok->nama_kelompok,
            'mahasiswa' => $mahasiswa
        ]);
    }


}
