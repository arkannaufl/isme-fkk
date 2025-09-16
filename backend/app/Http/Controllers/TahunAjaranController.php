<?php

namespace App\Http\Controllers;

use App\Models\Semester;
use App\Models\TahunAjaran;
use App\Services\SemesterService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

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
        $tahunAjaran->delete();
        
        return response()->json(null, 204);
    }

    public function activate(TahunAjaran $tahunAjaran)
    {
        // Simpan semester lama untuk perbandingan
        $oldSemester = $this->semesterService->getActiveSemester();
        
        DB::transaction(function () use ($tahunAjaran) {
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
        });

        // Update semester semua mahasiswa
        $newSemester = $this->semesterService->getActiveSemester();
        $this->semesterService->updateAllStudentSemesters($oldSemester, $newSemester);

        activity()
            ->causedBy(Auth::user())
            ->performedOn($tahunAjaran)
            ->log("Mengaktifkan tahun ajaran {$tahunAjaran->tahun}");

        return response()->json($tahunAjaran->load('semesters'));
    }
    
    public function activateSemester(Semester $semester)
    {
        // A semester can only be activated if its parent tahun_ajaran is active
        if (!$semester->tahunAjaran->aktif) {
            return response()->json(['message' => 'Tahun ajaran induk harus diaktifkan terlebih dahulu.'], 400);
        }

        // Simpan semester lama untuk perbandingan
        $oldSemester = $this->semesterService->getActiveSemester();

        DB::transaction(function () use ($semester) {
            // Deactivate all other semesters
            Semester::where('id', '!=', $semester->id)->update(['aktif' => false]);

            // Activate the selected semester
            $semester->update(['aktif' => true]);
        });

        // Update semester semua mahasiswa
        $this->semesterService->updateAllStudentSemesters($oldSemester, $semester);

        activity()
            ->causedBy(Auth::user())
            ->performedOn($semester->tahunAjaran)
            ->withProperties(['semester_id' => $semester->id, 'jenis' => $semester->jenis])
            ->log("Mengaktifkan semester {$semester->jenis} pada tahun ajaran {$semester->tahunAjaran->tahun}");
        
        return response()->json($semester->load('tahunAjaran.semesters'));
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