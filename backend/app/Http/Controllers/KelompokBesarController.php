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

        // Cek apakah ini adalah request untuk menambah veteran atau replace semua data
        $isVeteranAddition = $request->has('is_veteran_addition') && $request->is_veteran_addition;

        DB::transaction(function() use ($semester, $mahasiswaIds, $isVeteranAddition) {
            if (!$isVeteranAddition) {
                // Jika bukan penambahan veteran, hapus semua data semester ini dulu (behavior lama)
                KelompokBesar::where('semester', $semester)->delete();
            }
            
            // Tambahkan mahasiswa yang belum ada di kelompok besar
            foreach ($mahasiswaIds as $id) {
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
        $action = $isVeteranAddition ? 'Menambah veteran ke' : 'Mengatur';
        activity()
            ->causedBy(Auth::user())
            ->log("{$action} kelompok besar untuk semester {$semester} dengan " . count($mahasiswaIds) . " mahasiswa");

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

    public function deleteByMahasiswaId(Request $request, $mahasiswaId)
    {
        $semester = $request->query('semester');
        
        if (!$semester) {
            return response()->json([
                'message' => 'Semester parameter is required'
            ], 400);
        }

        try {
            $deleted = KelompokBesar::where('mahasiswa_id', $mahasiswaId)
                ->where('semester', $semester)
                ->delete();

            if ($deleted > 0) {
                return response()->json([
                    'message' => 'Mahasiswa berhasil dihapus dari kelompok besar',
                    'deleted_count' => $deleted
                ]);
            } else {
                return response()->json([
                    'message' => 'Mahasiswa tidak ditemukan di kelompok besar semester ini'
                ], 404);
            }
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal menghapus mahasiswa dari kelompok besar',
                'error' => $e->getMessage()
            ], 500);
        }
    }
} 