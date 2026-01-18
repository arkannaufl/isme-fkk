<?php

namespace App\Http\Controllers;

use App\Models\Semester;
use App\Models\TahunAjaran;
use App\Services\SemesterService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class TahunAjaranController extends Controller
{
    protected $semesterService;

    public function __construct(SemesterService $semesterService)
    {
        $this->semesterService = $semesterService;
    }

    public function index()
    {
        $tahunAjaran = TahunAjaran::with('semesters')->orderBy('tahun', 'asc')->get();
        return response()->json($tahunAjaran);
    }

    public function store(Request $request)
    {
        $request->validate([
            'tahun' => 'required|regex:/^\d{4}\/\d{4}$/|unique:tahun_ajaran,tahun',
        ]);

        $tahunAjaran = DB::transaction(function () use ($request) {
            $tahunAjaran = TahunAjaran::create([
                'tahun' => $request->tahun,
                'aktif' => false,
            ]);

            $tahunAjaran->semesters()->create([
                'jenis' => 'Ganjil',
                'aktif' => false,
            ]);

            $tahunAjaran->semesters()->create([
                'jenis' => 'Genap',
                'aktif' => false,
            ]);
            
            return $tahunAjaran;
        });

        return response()->json($tahunAjaran->load('semesters'), 201);
    }

    public function destroy(TahunAjaran $tahunAjaran)
    {
        // Prevent deletion of active academic year
        if ($tahunAjaran->aktif) {
            return response()->json([
                'message' => 'Tahun ajaran yang sedang aktif tidak dapat dihapus. Silakan aktifkan tahun ajaran lain terlebih dahulu.'
            ], 422);
        }
        
        $tahunAjaran->delete();
        
        return response()->json(null, 204);
    }

    public function activate(Request $request, TahunAjaran $tahunAjaran)
    {
        // Simpan semester lama untuk perbandingan
        $oldSemester = $this->semesterService->getActiveSemester();
        
        $result = DB::transaction(function () use ($request, $tahunAjaran, $oldSemester) {
            // Deactivate all other academic years
            TahunAjaran::where('id', '!=', $tahunAjaran->id)->update(['aktif' => false]);
            
            // Deactivate all semesters
            Semester::query()->update(['aktif' => false]);

            // Activate the selected academic year
            $tahunAjaran->update(['aktif' => true]);

            // Activate the first semester (preferably 'Ganjil') of this academic year
            $firstSemester = $tahunAjaran->semesters()->where('jenis', 'Ganjil')->first();
            if (!$firstSemester) {
                $firstSemester = $tahunAjaran->semesters()->orderBy('id')->first();
            }
            if ($firstSemester) {
                $firstSemester->update(['aktif' => true]);
            }
            
            // Update student semesters if requested
            if ($request->boolean('update_student_semester')) {
                $this->semesterService->updateAllStudentSemesters($oldSemester, $firstSemester);
            }
            
            return $tahunAjaran->load('semesters');
        });

        // PENTING: Data master mahasiswa TIDAK diubah saat pergantian tahun ajaran
        // KECUALI jika update_student_semester = true
        
        // Clear cache users saat pergantian tahun ajaran untuk refresh data
        Cache::flush();

        activity()
            ->causedBy(Auth::user())
            ->performedOn($tahunAjaran)
            ->withProperties(['update_student_semester' => $request->boolean('update_student_semester')])
            ->log("Mengaktifkan tahun ajaran {$tahunAjaran->tahun}");

        return response()->json($result);
    }
    
    public function activateSemester(Request $request, Semester $semester)
    {
        // A semester can only be activated if its parent tahun_ajaran is active
        if (!$semester->tahunAjaran->aktif) {
            return response()->json(['message' => 'Tahun ajaran induk harus diaktifkan terlebih dahulu.'], 400);
        }

        // Simpan semester lama untuk perbandingan
        $oldSemester = $this->semesterService->getActiveSemester();

        $result = DB::transaction(function () use ($request, $semester, $oldSemester) {
            // Deactivate all other semesters
            Semester::where('id', '!=', $semester->id)->update(['aktif' => false]);

            // Activate the selected semester
            $semester->update(['aktif' => true]);
            
            // Update student semesters if requested
            if ($request->boolean('update_student_semester')) {
                $this->semesterService->updateAllStudentSemesters($oldSemester, $semester);
            }
            
            return $semester->load('tahunAjaran.semesters');
        });
        
        // Clear cache users saat pergantian semester untuk refresh data
        Cache::flush();

        activity()
            ->causedBy(Auth::user())
            ->performedOn($semester->tahunAjaran)
            ->withProperties([
                'semester_id' => $semester->id, 
                'jenis' => $semester->jenis,
                'update_student_semester' => $request->boolean('update_student_semester')
            ])
            ->log("Mengaktifkan semester {$semester->jenis} pada tahun ajaran {$semester->tahunAjaran->tahun}");
        
        return response()->json($result);
    }

    public function active()
    {
        $tahunAjaran = TahunAjaran::with(['semesters' => function($q) {
            $q->where('aktif', true);
        }])->where('aktif', true)->first();
        return response()->json($tahunAjaran);
    }

    public function getAvailableSemesters()
    {
        $tahunAjaran = TahunAjaran::where('aktif', true)->first();
        
        if (!$tahunAjaran) {
            return response()->json(['message' => 'Tidak ada tahun ajaran aktif'], 404);
        }

        $semesters = $tahunAjaran->semesters()->get();
        
        // Group semesters by type and map to semester numbers
        $ganjil = $semesters->where('jenis', 'Ganjil')->pluck('id')->toArray();
        $genap = $semesters->where('jenis', 'Genap')->pluck('id')->toArray();
        
        return response()->json([
            'tahun_ajaran' => $tahunAjaran->tahun,
            'semesters' => [
                'ganjil' => $ganjil,
                'genap' => $genap
            ]
        ]);
    }
} 