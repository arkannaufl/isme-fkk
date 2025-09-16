<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\User;
use App\Models\AbsensiJurnal;
use App\Models\AbsensiPBL;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Export attendance report
     */
    public function exportAttendance(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'format' => 'required|in:excel,pdf,json',
                'semester' => 'nullable|string'
            ]);

            $format = $request->format;
            $semester = $request->semester;

            // Get attendance data from users table (students only)
            $query = DB::table('users as u')
                ->leftJoin('absensi_jurnal as aj', 'u.nim', '=', 'aj.mahasiswa_nim')
                ->leftJoin('absensi_pbl as ap', 'u.nim', '=', 'ap.mahasiswa_npm')
                ->select([
                    'u.nim',
                    'u.name as nama',
                    'u.angkatan',
                    'u.semester',
                    DB::raw('COALESCE(SUM(CASE WHEN aj.hadir = 1 THEN 1 ELSE 0 END), 0) as total_hadir'),
                    DB::raw('COALESCE(COUNT(DISTINCT aj.jadwal_jurnal_reading_id), 0) as total_pertemuan')
                ])
                ->where('u.role', 'mahasiswa')
                ->groupBy('u.nim', 'u.name', 'u.angkatan', 'u.semester');

            // Note: Semester filtering temporarily disabled as semester field structure needs to be aligned
            // if ($semester) {
            //     $query->where('u.semester', $semester);
            // }

            $data = $query->get();

            // Transform data
            $exportData = $data->map(function($item) {
                $persentase = $item->total_pertemuan > 0 
                    ? round(($item->total_hadir / $item->total_pertemuan) * 100, 1)
                    : 0;

                return [
                    'nim' => $item->nim,
                    'nama' => $item->nama,
                    'angkatan' => $item->angkatan,
                    'semester' => $item->semester,
                    'total_hadir' => $item->total_hadir,
                    'total_pertemuan' => $item->total_pertemuan,
                    'persentase' => $persentase . '%'
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $exportData,
                'format' => $format,
                'message' => 'Attendance report data generated successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to export attendance report: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export assessment report
     */
    public function exportAssessment(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'format' => 'required|in:excel,pdf,json',
                'semester' => 'nullable|string'
            ]);

            $format = $request->format;
            $semester = $request->semester;

            // Get assessment data from users table (students only)
            $query = User::select([
                'nim',
                'name as nama',
                'angkatan',
                'semester',
                'ipk'
            ])
            ->where('role', 'mahasiswa');

            // Note: Semester filtering temporarily disabled as semester field structure needs to be aligned
            // if ($semester) {
            //     $query->where('semester', $semester);
            // }

            $data = $query->get();

            // Transform data
            $exportData = $data->map(function($item) {
                return [
                    'nim' => $item->nim,
                    'nama' => $item->nama,
                    'angkatan' => $item->angkatan,
                    'semester' => $item->semester,
                    'ipk' => $item->ipk
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $exportData,
                'format' => $format,
                'message' => 'Assessment report data generated successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to export assessment report: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export academic report
     */
    public function exportAcademic(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'format' => 'required|in:excel,pdf,json',
                'angkatan' => 'nullable|string'
            ]);

            $format = $request->format;
            $angkatan = $request->angkatan;

            // Get academic data from users table (students only)
            $query = User::select([
                'nim',
                'name as nama',
                'angkatan',
                'semester',
                'ipk',
                'status',
                'semester_masuk',
                'tahun_ajaran_masuk_id'
            ])
            ->where('role', 'mahasiswa');

            if ($angkatan) {
                $query->where('angkatan', $angkatan);
            }

            $data = $query->get();

            // Transform data
            $exportData = $data->map(function($item) {
                return [
                    'nim' => $item->nim,
                    'nama' => $item->nama,
                    'angkatan' => $item->angkatan,
                    'semester' => $item->semester,
                    'ipk' => $item->ipk,
                    'status' => $item->status,
                    'semester_masuk' => $item->semester_masuk,
                    'tahun_ajaran_masuk_id' => $item->tahun_ajaran_masuk_id
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $exportData,
                'format' => $format,
                'message' => 'Academic report data generated successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to export academic report: ' . $e->getMessage()
            ], 500);
        }
    }
}
