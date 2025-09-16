<?php

namespace App\Http\Controllers;

use App\Models\KelompokBesarAntara;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

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
     * Create new kelompok besar antara
     */
    public function store(Request $request, $mataKuliahKode = null)
    {
        $data = $request->validate([
            'nama_kelompok' => 'required|string|max:255',
            'mahasiswa_ids' => 'required|array|min:1',
            'mahasiswa_ids.*' => 'exists:users,id',
        ]);

        // Check if mahasiswa already in another kelompok
        $existingMahasiswa = KelompokBesarAntara::whereJsonOverlaps('mahasiswa_ids', $data['mahasiswa_ids'])
            ->exists();

        if ($existingMahasiswa) {
            return response()->json([
                'message' => 'Beberapa mahasiswa sudah terdaftar di kelompok besar lain'
            ], 422);
        }

        $kelompokBesar = KelompokBesarAntara::create($data);

        return response()->json($kelompokBesar, Response::HTTP_CREATED);
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
        $existingMahasiswa = KelompokBesarAntara::where('id', '!=', $id)
            ->whereJsonOverlaps('mahasiswa_ids', $data['mahasiswa_ids'])
            ->exists();

        if ($existingMahasiswa) {
            return response()->json([
                'message' => 'Beberapa mahasiswa sudah terdaftar di kelompok besar lain'
            ], 422);
        }

        $kelompokBesar->update($data);

        return response()->json($kelompokBesar);
    }

    /**
     * Delete kelompok besar antara
     */
    public function destroy($mataKuliahKode = null, $id)
    {
        $kelompokBesar = KelompokBesarAntara::findOrFail($id);

        $kelompokBesar->delete();

        return response()->json(['message' => 'Kelompok besar berhasil dihapus'], Response::HTTP_NO_CONTENT);
    }
}
