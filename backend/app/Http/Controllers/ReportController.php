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
                'semester' => 'nullable|string',
                'mata_kuliah_kode' => 'nullable|string'
            ]);

            $format = $request->format;
            $semester = $request->semester;
            $mataKuliahKode = $request->mata_kuliah_kode;

            // Get attendance data from users table (students only)
            $query = DB::table('users as u')
                ->leftJoin('absensi_jurnal as aj', 'u.nim', '=', 'aj.mahasiswa_nim')
                ->leftJoin('absensi_pbl as ap', 'u.nim', '=', 'ap.mahasiswa_npm')
                ->leftJoin('absensi_csr as ac', 'u.nim', '=', 'ac.mahasiswa_npm')
                ->leftJoin('jadwal_jurnal_reading as jjr', 'aj.jadwal_jurnal_reading_id', '=', 'jjr.id')
                ->leftJoin('jadwal_csr as jc', 'ac.jadwal_csr_id', '=', 'jc.id')
                ->select([
                    'u.nim',
                    'u.name as nama',
                    'u.angkatan',
                    'u.semester',
                    DB::raw('COALESCE(SUM(CASE WHEN aj.hadir = 1 THEN 1 ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN ap.hadir = 1 THEN 1 ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN ac.hadir = 1 THEN 1 ELSE 0 END), 0) as total_hadir'),
                    DB::raw('COALESCE(COUNT(DISTINCT aj.jadwal_jurnal_reading_id), 0) + COALESCE(COUNT(DISTINCT CONCAT(ap.mata_kuliah_kode, \'-\', ap.pertemuan)), 0) + COALESCE(COUNT(DISTINCT ac.jadwal_csr_id), 0) as total_pertemuan')
                ])
                ->where('u.role', 'mahasiswa')
                ->groupBy('u.nim', 'u.name', 'u.angkatan', 'u.semester');

            // Filter by mata kuliah jika dipilih
            if ($mataKuliahKode) {
                $query->where(function ($q) use ($mataKuliahKode) {
                    $q->where('jjr.mata_kuliah_kode', $mataKuliahKode)
                        ->orWhere('ap.mata_kuliah_kode', $mataKuliahKode)
                        ->orWhere('jc.mata_kuliah_kode', $mataKuliahKode);
                });
            }

            // Note: Semester filtering temporarily disabled as semester field structure needs to be aligned
            // if ($semester) {
            //     $query->where('u.semester', $semester);
            // }

            $data = $query->get();

            // Transform data
            $exportData = $data->map(function ($item) {
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
                'mata_kuliah_kode' => $mataKuliahKode,
                'message' => $mataKuliahKode
                    ? "Attendance report data for mata kuliah {$mataKuliahKode} generated successfully"
                    : 'Attendance report data generated successfully'
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
                'semester' => 'nullable|string',
                'mata_kuliah_kode' => 'nullable|string'
            ]);

            $format = $request->format;
            $semester = $request->semester;
            $mataKuliahKode = $request->mata_kuliah_kode;

            // Get assessment data - jika ada filter mata kuliah, ambil dari tabel penilaian
            if ($mataKuliahKode) {
                // Ambil data penilaian dari jurnal dan PBL untuk mata kuliah tertentu
                $query = DB::table('users as u')
                    ->leftJoin('penilaian_jurnal as pj', function ($join) use ($mataKuliahKode) {
                        $join->on('u.nim', '=', 'pj.mahasiswa_nim')
                            ->where('pj.mata_kuliah_kode', '=', $mataKuliahKode);
                    })
                    ->leftJoin('penilaian_pbl as pp', function ($join) use ($mataKuliahKode) {
                        $join->on('u.nim', '=', 'pp.mahasiswa_npm')
                            ->where('pp.mata_kuliah_kode', '=', $mataKuliahKode);
                    })
                    ->select([
                        'u.nim',
                        'u.name as nama',
                        'u.angkatan',
                        'u.semester',
                        'u.ipk',
                        DB::raw('COALESCE(pj.nilai_keaktifan, 0) as nilai_jurnal_keaktifan'),
                        DB::raw('COALESCE(pj.nilai_laporan, 0) as nilai_jurnal_laporan'),
                        DB::raw('COALESCE(pp.nilai_a, 0) as nilai_pbl_a'),
                        DB::raw('COALESCE(pp.nilai_b, 0) as nilai_pbl_b'),
                        DB::raw('COALESCE(pp.nilai_c, 0) as nilai_pbl_c'),
                        DB::raw('COALESCE(pp.nilai_d, 0) as nilai_pbl_d'),
                        DB::raw('COALESCE(pp.nilai_e, 0) as nilai_pbl_e'),
                        DB::raw('COALESCE(pp.nilai_f, 0) as nilai_pbl_f'),
                        DB::raw('COALESCE(pp.nilai_g, 0) as nilai_pbl_g')
                    ])
                    ->where('u.role', 'mahasiswa')
                    ->where(function ($q) {
                        $q->whereNotNull('pj.id')
                            ->orWhereNotNull('pp.id');
                    });
            } else {
                // Jika tidak ada filter mata kuliah, ambil data umum dari users
                $query = User::select([
                    'nim',
                    'name as nama',
                    'angkatan',
                    'semester',
                    'ipk'
                ])
                    ->where('role', 'mahasiswa');
            }

            // Note: Semester filtering temporarily disabled as semester field structure needs to be aligned
            // if ($semester) {
            //     $query->where('semester', $semester);
            // }

            $data = $query->get();

            // Transform data
            $exportData = $data->map(function ($item) use ($mataKuliahKode) {
                $baseData = [
                    'nim' => $item->nim,
                    'nama' => $item->nama,
                    'angkatan' => $item->angkatan,
                    'semester' => $item->semester,
                    'ipk' => $item->ipk
                ];

                // Jika ada filter mata kuliah, tambahkan data penilaian
                if ($mataKuliahKode) {
                    $baseData = array_merge($baseData, [
                        'nilai_jurnal_keaktifan' => $item->nilai_jurnal_keaktifan ?? 0,
                        'nilai_jurnal_laporan' => $item->nilai_jurnal_laporan ?? 0,
                        'nilai_pbl_a' => $item->nilai_pbl_a ?? 0,
                        'nilai_pbl_b' => $item->nilai_pbl_b ?? 0,
                        'nilai_pbl_c' => $item->nilai_pbl_c ?? 0,
                        'nilai_pbl_d' => $item->nilai_pbl_d ?? 0,
                        'nilai_pbl_e' => $item->nilai_pbl_e ?? 0,
                        'nilai_pbl_f' => $item->nilai_pbl_f ?? 0,
                        'nilai_pbl_g' => $item->nilai_pbl_g ?? 0
                    ]);
                }

                return $baseData;
            });

            return response()->json([
                'success' => true,
                'data' => $exportData,
                'format' => $format,
                'mata_kuliah_kode' => $mataKuliahKode,
                'message' => $mataKuliahKode
                    ? "Assessment report data for mata kuliah {$mataKuliahKode} generated successfully"
                    : 'Assessment report data generated successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to export assessment report: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get mata kuliah yang memiliki data absensi
     */
    public function getMataKuliahWithAbsensi(): JsonResponse
    {
        try {
            // Ambil mata kuliah yang memiliki data absensi dari jadwal jurnal (mata kuliah blok)
            $mataKuliahJurnal = DB::table('jadwal_jurnal_reading as jjr')
                ->join('absensi_jurnal as aj', 'jjr.id', '=', 'aj.jadwal_jurnal_reading_id')
                ->join('mata_kuliah as mk', 'jjr.mata_kuliah_kode', '=', 'mk.kode')
                ->select('mk.kode', 'mk.nama', 'mk.jenis', 'mk.semester', 'mk.periode', 'mk.tipe_non_block')
                ->distinct()
                ->get();

            // Ambil mata kuliah yang memiliki data absensi dari jadwal PBL (mata kuliah blok)
            $mataKuliahPBL = DB::table('absensi_pbl as ap')
                ->join('mata_kuliah as mk', 'ap.mata_kuliah_kode', '=', 'mk.kode')
                ->select('mk.kode', 'mk.nama', 'mk.jenis', 'mk.semester', 'mk.periode', 'mk.tipe_non_block')
                ->distinct()
                ->get();

            // Ambil mata kuliah yang memiliki data absensi dari jadwal CSR (hanya untuk semester reguler)
            $mataKuliahCSR = DB::table('jadwal_csr as jc')
                ->join('absensi_csr as ac', 'jc.id', '=', 'ac.jadwal_csr_id')
                ->join('mata_kuliah as mk', 'jc.mata_kuliah_kode', '=', 'mk.kode')
                ->select('mk.kode', 'mk.nama', 'mk.jenis', 'mk.semester', 'mk.periode', 'mk.tipe_non_block')
                ->distinct()
                ->get();

            // Gabungkan semua mata kuliah
            $allMataKuliah = $mataKuliahJurnal->concat($mataKuliahPBL)->concat($mataKuliahCSR);

            // Hapus duplikat berdasarkan kode mata kuliah
            $uniqueMataKuliah = $allMataKuliah->unique('kode')->values();

            return response()->json([
                'success' => true,
                'data' => $uniqueMataKuliah,
                'message' => 'Mata kuliah dengan data absensi retrieved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get mata kuliah with absensi: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get mata kuliah yang memiliki data penilaian
     */
    public function getMataKuliahWithPenilaian(): JsonResponse
    {
        try {
            // Ambil mata kuliah yang memiliki data penilaian dari jurnal
            $mataKuliahJurnal = DB::table('penilaian_jurnal as pj')
                ->join('mata_kuliah as mk', 'pj.mata_kuliah_kode', '=', 'mk.kode')
                ->select('mk.kode', 'mk.nama', 'mk.jenis', 'mk.semester', 'mk.periode', 'mk.tipe_non_block')
                ->distinct()
                ->get();

            // Ambil mata kuliah yang memiliki data penilaian dari PBL
            $mataKuliahPBL = DB::table('penilaian_pbl as pp')
                ->join('mata_kuliah as mk', 'pp.mata_kuliah_kode', '=', 'mk.kode')
                ->select('mk.kode', 'mk.nama', 'mk.jenis', 'mk.semester', 'mk.periode', 'mk.tipe_non_block')
                ->distinct()
                ->get();

            // Gabungkan semua mata kuliah
            $allMataKuliah = $mataKuliahJurnal->concat($mataKuliahPBL);

            // Hapus duplikat berdasarkan kode mata kuliah
            $uniqueMataKuliah = $allMataKuliah->unique('kode')->values();

            return response()->json([
                'success' => true,
                'data' => $uniqueMataKuliah,
                'message' => 'Mata kuliah dengan data penilaian retrieved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get mata kuliah with penilaian: ' . $e->getMessage()
            ], 500);
        }
    }
}