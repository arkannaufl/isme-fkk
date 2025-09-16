<?php

namespace App\Http\Controllers;

use App\Models\KelompokKecilAntara;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

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
        $data = $request->validate([
            'nama_kelompok' => 'required|string|max:255',
            'mahasiswa_ids' => 'required|array|min:1',
            'mahasiswa_ids.*' => 'exists:users,id',
        ]);

        // Check if mahasiswa already in another kelompok kecil
        $existingMahasiswa = KelompokKecilAntara::whereJsonOverlaps('mahasiswa_ids', $data['mahasiswa_ids'])
            ->exists();

        if ($existingMahasiswa) {
            return response()->json([
                'message' => 'Beberapa mahasiswa sudah terdaftar di kelompok kecil lain'
            ], 422);
        }

        $kelompokKecil = KelompokKecilAntara::create($data);

        return response()->json($kelompokKecil, Response::HTTP_CREATED);
    }

    /**
     * Update kelompok kecil antara
     */
    public function update(Request $request, $mataKuliahKode = null, $id)
    {
        $kelompokKecil = KelompokKecilAntara::findOrFail($id);

        $data = $request->validate([
            'nama_kelompok' => 'required|string|max:255',
            'mahasiswa_ids' => 'required|array|min:1',
            'mahasiswa_ids.*' => 'exists:users,id',
        ]);

        // Check if mahasiswa already in another kelompok kecil (excluding current)
        $existingMahasiswa = KelompokKecilAntara::where('id', '!=', $id)
            ->whereJsonOverlaps('mahasiswa_ids', $data['mahasiswa_ids'])
            ->exists();

        if ($existingMahasiswa) {
            return response()->json([
                'message' => 'Beberapa mahasiswa sudah terdaftar di kelompok kecil lain'
            ], 422);
        }

        $kelompokKecil->update($data);

        return response()->json($kelompokKecil);
    }

    /**
     * Delete kelompok kecil antara
     */
    public function destroy($mataKuliahKode = null, $id)
    {
        $kelompokKecil = KelompokKecilAntara::findOrFail($id);

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
