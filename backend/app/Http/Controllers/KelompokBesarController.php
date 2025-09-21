<?php

namespace App\Http\Controllers;

use App\Models\KelompokBesar;
use App\Models\User;
use App\Models\KelompokKecil;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class KelompokBesarController extends Controller
{
    // List mahasiswa kelompok besar per semester
    public function index(Request $request)
    {
        $semester = $request->query('semester');
        $query = KelompokBesar::with('mahasiswa')->orderBy('id', 'asc');
        if ($semester) {
            $query->where('semester', $semester);
        }
        return response()->json($query->get());
    }

    // Tambah mahasiswa ke kelompok besar
    public function store(Request $request)
    {
        $request->validate([
            'semester' => 'required|string',
            'mahasiswa_ids' => 'required|array',
            'mahasiswa_ids.*' => 'required|exists:users,id',
        ]);

        $semester = $request->semester;
        $mahasiswaIds = $request->mahasiswa_ids;

        // Simpan (tambah saja, jangan hapus yang sudah ada)
        DB::transaction(function() use ($semester, $mahasiswaIds) {
            foreach ($mahasiswaIds as $id) {
                // Cek apakah sudah ada, jika belum ada baru insert
                $existing = KelompokBesar::where('semester', $semester)
                    ->where('mahasiswa_id', $id)
                    ->first();

                if (!$existing) {
                    KelompokBesar::create([
                        'semester' => $semester,
                        'mahasiswa_id' => $id
                    ]);
                }
            }
        });

        // Log aktivitas batch kelompok besar
        activity()
            ->causedBy(Auth::user())
            ->log("Mengatur kelompok besar untuk semester {$semester} dengan " . count($mahasiswaIds) . " mahasiswa");

        return response()->json(['message' => 'Data kelompok besar berhasil disimpan']);
    }

    // Hapus mahasiswa dari kelompok besar
    public function destroy($id)
    {
        $row = KelompokBesar::findOrFail($id);
        // Hapus juga dari kelompok kecil di semester yang sama
        KelompokKecil::where('semester', $row->semester)
            ->where('mahasiswa_id', $row->mahasiswa_id)
            ->delete();
        $row->delete();
        return response()->json(['message' => 'Data berhasil dihapus']);
    }

    // Get kelompok besar by semester ID
    public function getBySemesterId($semesterId)
    {
        // Get semester info
        $semester = \App\Models\Semester::find($semesterId);
        if (!$semester) {
            return response()->json(['message' => 'Semester tidak ditemukan'], 404);
        }

        // Get kelompok besar data for this semester
        $kelompokBesar = KelompokBesar::with('mahasiswa')
            ->where('semester', $semesterId)
            ->orderBy('id', 'asc')
            ->get();

        return response()->json([
            'semester' => $semester,
            'data' => $kelompokBesar
        ]);
    }

    public function batchBySemester(Request $request)
    {
        $semesters = $request->input('semesters', []);
        $result = [];
        foreach ($semesters as $sem) {
            $result[$sem] = KelompokBesar::with('mahasiswa')->where('semester', $sem)->get();
        }
        return response()->json($result);
    }

    // Delete kelompok besar by mahasiswa ID and semester
    public function deleteByMahasiswaId($mahasiswaId, $semester)
    {
        try {
            $kelompokBesar = KelompokBesar::where('mahasiswa_id', $mahasiswaId)
                ->where('semester', $semester)
                ->first();

            if (!$kelompokBesar) {
                return response()->json([
                    'message' => 'Mahasiswa tidak ditemukan di kelompok besar semester ini'
                ], 404);
            }

            $kelompokBesar->delete();

            return response()->json([
                'message' => 'Mahasiswa berhasil dihapus dari kelompok besar'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal menghapus mahasiswa dari kelompok besar',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
