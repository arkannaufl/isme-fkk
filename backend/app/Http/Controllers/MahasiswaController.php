<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\KelompokKecil;
use App\Models\KelompokBesar;
use App\Models\PenilaianPBL;
use App\Models\PenilaianJurnal;
use App\Models\PenilaianSeminarProposal;
use App\Models\PenilaianSidangSkripsi;
use App\Models\AbsensiPBL;
use App\Models\AbsensiJurnal;
use App\Models\AbsensiCSR;
use App\Models\AbsensiPraktikum;
use App\Models\MataKuliah;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class MahasiswaController extends Controller
{
    /**
     * Get profil akademik mahasiswa
     */
    public function getProfilAkademik($id)
    {
        try {
            $mahasiswa = User::where('id', $id)
                ->where('role', 'mahasiswa')
                ->first();

            if (!$mahasiswa) {
                return response()->json([
                    'message' => 'Mahasiswa tidak ditemukan'
                ], 404);
            }

            // Get kelompok kecil from kelompok_kecil table where mahasiswa_id = $id
            $kelompokKecil = KelompokKecil::where('mahasiswa_id', $id)->first();

            // Get kelompok besar based on semester
            $kelompokBesar = KelompokBesar::where('semester', $mahasiswa->semester)->first();

            return response()->json([
                'message' => 'Profil akademik berhasil diambil',
                'data' => [
                    'id' => $mahasiswa->id,
                    'nim' => $mahasiswa->nim,
                    'name' => $mahasiswa->name,
                    'email' => $mahasiswa->email,
                    'semester' => (string)$mahasiswa->semester,
                    'semester_aktif' => (string)$mahasiswa->semester,
                    'angkatan' => $mahasiswa->angkatan,
                    'ipk' => $mahasiswa->ipk,
                    'status' => $mahasiswa->status,
                    'kelompok_kecil' => $kelompokKecil ? [
                        'id' => $kelompokKecil->id,
                        'nama' => $kelompokKecil->nama_kelompok,
                        'semester' => $kelompokKecil->semester,
                    ] : null,
                    'kelompok_besar' => $kelompokBesar ? [
                        'id' => $kelompokBesar->id,
                        'semester' => $kelompokBesar->semester,
                    ] : null,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching profil akademik: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil profil akademik',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get jadwal hari ini untuk mahasiswa
     */
    public function getJadwalHariIni($id)
    {
        try {
            // This is placeholder - will implement later
            return response()->json([
                'message' => 'Jadwal hari ini berhasil diambil',
                'data' => []
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching jadwal hari ini: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil jadwal hari ini',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get jadwal mendatang untuk mahasiswa
     */
    public function getJadwalMendatang($id)
    {
        try {
            // This is placeholder - will implement later
            return response()->json([
                'message' => 'Jadwal mendatang berhasil diambil',
                'data' => []
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching jadwal mendatang: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil jadwal mendatang',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get attendance summary per mata kuliah
     */
    public function getAttendanceSummary($id)
    {
        try {
            $mahasiswa = User::where('id', $id)
                ->where('role', 'mahasiswa')
                ->first();

            if (!$mahasiswa) {
                return response()->json([
                    'message' => 'Mahasiswa tidak ditemukan'
                ], 404);
            }

            // Get kelompok kecil
            $kelompokKecil = KelompokKecil::where('mahasiswa_id', $id)->first();
            
            if (!$kelompokKecil) {
                return response()->json([
                    'message' => 'Ringkasan kehadiran berhasil diambil',
                    'data' => []
                ]);
            }

            $attendanceByMatkul = [];

            // Get PBL attendance
            $pblAttendance = AbsensiPBL::where('mahasiswa_npm', $mahasiswa->nim)
                ->get()
                ->groupBy('mata_kuliah_kode');

            foreach ($pblAttendance as $kode => $absensi) {
                if (!isset($attendanceByMatkul[$kode])) {
                    $attendanceByMatkul[$kode] = [
                        'mata_kuliah_kode' => $kode,
                        'total_pertemuan' => 0,
                        'hadir' => 0,
                        'tidak_hadir' => 0,
                        'persentase' => 0
                    ];
                }
                $attendanceByMatkul[$kode]['total_pertemuan'] += $absensi->count();
                $attendanceByMatkul[$kode]['hadir'] += $absensi->where('hadir', true)->count();
                $attendanceByMatkul[$kode]['tidak_hadir'] += $absensi->where('hadir', false)->count();
            }

            // Get Jurnal attendance
            $jurnalAttendance = AbsensiJurnal::where('mahasiswa_nim', $mahasiswa->nim)
                ->with('jadwalJurnalReading')
                ->get()
                ->groupBy(function($item) {
                    return $item->jadwalJurnalReading->mata_kuliah_kode ?? 'unknown';
                });

            foreach ($jurnalAttendance as $kode => $absensi) {
                if ($kode === 'unknown') continue;
                
                if (!isset($attendanceByMatkul[$kode])) {
                    $attendanceByMatkul[$kode] = [
                        'mata_kuliah_kode' => $kode,
                        'total_pertemuan' => 0,
                        'hadir' => 0,
                        'tidak_hadir' => 0,
                        'persentase' => 0
                    ];
                }
                $attendanceByMatkul[$kode]['total_pertemuan'] += $absensi->count();
                $attendanceByMatkul[$kode]['hadir'] += $absensi->where('hadir', true)->count();
                $attendanceByMatkul[$kode]['tidak_hadir'] += $absensi->where('hadir', false)->count();
            }

            // Get CSR attendance
            $csrAttendance = AbsensiCSR::where('mahasiswa_npm', $mahasiswa->nim)
                ->with('jadwalCSR')
                ->get()
                ->groupBy(function($item) {
                    return $item->jadwalCSR->mata_kuliah_kode ?? 'unknown';
                });

            foreach ($csrAttendance as $kode => $absensi) {
                if ($kode === 'unknown') continue;
                
                if (!isset($attendanceByMatkul[$kode])) {
                    $attendanceByMatkul[$kode] = [
                        'mata_kuliah_kode' => $kode,
                        'total_pertemuan' => 0,
                        'hadir' => 0,
                        'tidak_hadir' => 0,
                        'persentase' => 0
                    ];
                }
                $attendanceByMatkul[$kode]['total_pertemuan'] += $absensi->count();
                $attendanceByMatkul[$kode]['hadir'] += $absensi->where('hadir', true)->count();
                $attendanceByMatkul[$kode]['tidak_hadir'] += $absensi->where('hadir', false)->count();
            }

            // Get Praktikum attendance
            $praktikumAttendance = AbsensiPraktikum::where('mahasiswa_nim', $mahasiswa->nim)
                ->with('jadwalPraktikum')
                ->get()
                ->groupBy(function($item) {
                    return $item->jadwalPraktikum->mata_kuliah_kode ?? 'unknown';
                });

            foreach ($praktikumAttendance as $kode => $absensi) {
                if ($kode === 'unknown') continue;
                
                if (!isset($attendanceByMatkul[$kode])) {
                    $attendanceByMatkul[$kode] = [
                        'mata_kuliah_kode' => $kode,
                        'total_pertemuan' => 0,
                        'hadir' => 0,
                        'tidak_hadir' => 0,
                        'persentase' => 0
                    ];
                }
                $attendanceByMatkul[$kode]['total_pertemuan'] += $absensi->count();
                $attendanceByMatkul[$kode]['hadir'] += $absensi->where('hadir', true)->count();
                $attendanceByMatkul[$kode]['tidak_hadir'] += $absensi->where('hadir', false)->count();
            }

            // Calculate percentage for each mata kuliah
            foreach ($attendanceByMatkul as $kode => &$data) {
                if ($data['total_pertemuan'] > 0) {
                    $data['persentase'] = round(($data['hadir'] / $data['total_pertemuan']) * 100, 1);
                }
            }

            return response()->json([
                'message' => 'Ringkasan kehadiran berhasil diambil',
                'data' => array_values($attendanceByMatkul)
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching attendance summary: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil ringkasan kehadiran',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get score summary with all grades per mata kuliah
     */
    public function getScoreSummary($id)
    {
        try {
            $mahasiswa = User::where('id', $id)
                ->where('role', 'mahasiswa')
                ->first();

            if (!$mahasiswa) {
                return response()->json([
                    'message' => 'Mahasiswa tidak ditemukan'
                ], 404);
            }

            $nilaiByMatkul = [];
            $totalSKS = 0;
            $totalBobotNilai = 0;
            $totalBobotSKS = 0;

            // Get PBL scores
            // Get PBL scores - Try matching by NIM or Username
            $pblScores = PenilaianPBL::with(['jadwalPBL.modulPBL'])
                ->where(function($q) use ($mahasiswa) {
                    $q->where('mahasiswa_npm', $mahasiswa->nim)
                      ->orWhere('mahasiswa_npm', $mahasiswa->username);
                })
                ->get()
                ->groupBy('mata_kuliah_kode');

            foreach ($pblScores as $kode => $scores) {
                // Try to find mata kuliah, but don't skip if not found
                $mataKuliah = MataKuliah::where('kode', $kode)->first();
                
                if (!isset($nilaiByMatkul[$kode])) {
                    $nilaiByMatkul[$kode] = [
                        'mata_kuliah_kode' => $kode,
                        'mata_kuliah_nama' => $mataKuliah ? $mataKuliah->nama : $kode,
                        'sks' => $mataKuliah ? $mataKuliah->sks : 0,
                        'semester' => $mataKuliah ? $mataKuliah->semester : 0,
                        'jenis' => $mataKuliah ? $mataKuliah->jenis : 'PBL',
                        'nilai_detail' => [],
                        'nilai_akhir' => null,
                        'nilai_huruf' => null,
                        'status' => 'belum_dinilai'
                    ];
                }

                // Add each PBL score individually
                $totalNilaiPBL = 0;
                $countPBL = 0;

                foreach ($scores as $index => $score) {
                    $total = $score->nilai_a + $score->nilai_b + $score->nilai_c + 
                             $score->nilai_d + $score->nilai_e + $score->nilai_f + 
                             $score->nilai_g;
                    
                    // Score calculation: (Total / Max Score) * 100
                    // Max score is 7 criteria * 5 max point = 35
                    // Peta Konsep is excluded from this specific grade component to match "Total Nilai" in form
                    $maxScore = 35;
                    $nilaiItem = ($total / $maxScore) * 100;
                    
                    $totalNilaiPBL += $nilaiItem;
                    $countPBL++;

                    $nilaiByMatkul[$kode]['nilai_detail'][] = [
                        'jenis' => 'PBL ' . ($score->pertemuan ?? ($index + 1)) . ' (' . ($score->kelompok ?? '-') . ')',
                        'nilai' => round($nilaiItem, 2),
                        'tanggal' => $score->created_at,
                        'topik' => $score->jadwalPBL->modulPBL->nama_modul ?? '-'
                    ];
                }

                // Calculate average if needed for intermediate calculation, 
                // but usually PBL is just one component. 
                // If there are multiple PBLs, they might contribute to a "Total PBL" score.
                // For now, let's keep the logic that it contributes to the course grade 
                // (assuming other components exist or this is the only one).
            }

            // Get Jurnal scores
            $jurnalScores = PenilaianJurnal::where('mahasiswa_nim', $mahasiswa->nim)
                ->with('jurnalReading') // Eager load for topic
                ->get()
                ->groupBy('mata_kuliah_kode');

            foreach ($jurnalScores as $kode => $scores) {
                $mataKuliah = MataKuliah::where('kode', $kode)->first();
                if (!$mataKuliah) continue;

                if (!isset($nilaiByMatkul[$kode])) {
                    $nilaiByMatkul[$kode] = [
                        'mata_kuliah_kode' => $kode,
                        'mata_kuliah_nama' => $mataKuliah->nama,
                        'sks' => $mataKuliah->sks,
                        'semester' => $mataKuliah->semester,
                        'jenis' => $mataKuliah->jenis,
                        'nilai_detail' => [],
                        'nilai_akhir' => null,
                        'nilai_huruf' => null,
                        'status' => 'belum_dinilai'
                    ];
                }

                foreach ($scores as $index => $score) {
                    // Calculate item score
                    $nilaiItem = ($score->nilai_keaktifan + $score->nilai_laporan) / 2;
                    
                    $topik = $score->jurnalReading->topik ?? 'Jurnal Reading ' . ($index + 1);

                    $nilaiByMatkul[$kode]['nilai_detail'][] = [
                        'jenis' => 'Jurnal Reading',
                        'nilai' => round($nilaiItem, 2),
                        'tanggal' => $score->created_at,
                        'topik' => $topik
                    ];
                }
            }

            // Get Seminar Proposal scores
            $seminarScores = PenilaianSeminarProposal::where('mahasiswa_id', $id)
                ->with('jadwal')
                ->get()
                ->groupBy(function($item) {
                    return $item->jadwal->mata_kuliah_kode ?? 'unknown';
                });

            foreach ($seminarScores as $kode => $scores) {
                if ($kode === 'unknown') continue;
                
                $mataKuliah = MataKuliah::where('kode', $kode)->first();
                if (!$mataKuliah) continue;

                if (!isset($nilaiByMatkul[$kode])) {
                    $nilaiByMatkul[$kode] = [
                        'mata_kuliah_kode' => $kode,
                        'mata_kuliah_nama' => $mataKuliah->nama,
                        'sks' => $mataKuliah->sks,
                        'semester' => $mataKuliah->semester,
                        'jenis' => $mataKuliah->jenis,
                        'nilai_detail' => [],
                        'nilai_akhir' => null,
                        'nilai_huruf' => null,
                        'status' => 'belum_dinilai'
                    ];
                }

                // Calculate average Seminar score
                $nilaiSeminar = $scores->avg('nilai_akhir');

                $nilaiByMatkul[$kode]['nilai_detail'][] = [
                    'jenis' => 'Seminar Proposal',
                    'nilai' => round($nilaiSeminar, 2),
                    'tanggal' => $scores->first()->created_at
                ];
            }

            // Get Sidang Skripsi scores
            $sidangScores = PenilaianSidangSkripsi::where('mahasiswa_id', $id)
                ->with('jadwal')
                ->get()
                ->groupBy(function($item) {
                    return $item->jadwal->mata_kuliah_kode ?? 'unknown';
                });

            foreach ($sidangScores as $kode => $scores) {
                if ($kode === 'unknown') continue;
                
                $mataKuliah = MataKuliah::where('kode', $kode)->first();
                if (!$mataKuliah) continue;

                if (!isset($nilaiByMatkul[$kode])) {
                    $nilaiByMatkul[$kode] = [
                        'mata_kuliah_kode' => $kode,
                        'mata_kuliah_nama' => $mataKuliah->nama,
                        'sks' => $mataKuliah->sks,
                        'semester' => $mataKuliah->semester,
                        'jenis' => $mataKuliah->jenis,
                        'nilai_detail' => [],
                        'nilai_akhir' => null,
                        'nilai_huruf' => null,
                        'status' => 'belum_dinilai'
                    ];
                }

                // Calculate average Sidang score
                $nilaiSidang = $scores->avg('nilai_akhir');

                $nilaiByMatkul[$kode]['nilai_detail'][] = [
                    'jenis' => 'Sidang Skripsi',
                    'nilai' => round($nilaiSidang, 2),
                    'tanggal' => $scores->first()->created_at
                ];
            }

            // Calculate final score for each mata kuliah
            $matkulLulus = 0;
            $matkulTidakLulus = 0;

            foreach ($nilaiByMatkul as $kode => &$data) {
                if (count($data['nilai_detail']) > 0) {
                    // Calculate average of all scores
                    $nilaiAkhir = collect($data['nilai_detail'])->avg('nilai');
                    $data['nilai_akhir'] = round($nilaiAkhir, 2);
                    
                    // Convert to letter grade
                    $data['nilai_huruf'] = $this->konversiNilaiHuruf($nilaiAkhir);
                    
                    // Determine status
                    if ($nilaiAkhir >= 55) {
                        $data['status'] = 'lulus';
                        $matkulLulus++;
                    } else {
                        $data['status'] = 'tidak_lulus';
                        $matkulTidakLulus++;
                    }

                    // Calculate IPK
                    $totalSKS += $data['sks'];
                    $totalBobotNilai += ($nilaiAkhir / 25) * $data['sks']; // Convert to 4.0 scale
                    $totalBobotSKS += $data['sks'];
                }
            }

            // Calculate IPK
            $ipk = $totalBobotSKS > 0 ? ($totalBobotNilai / $totalBobotSKS) : 0;

            return response()->json([
                'message' => 'Ringkasan nilai berhasil diambil',
                'data' => [
                    'ipk' => round($ipk, 2),
                    'total_sks' => $totalSKS,
                    'matkul_lulus' => $matkulLulus,
                    'matkul_tidak_lulus' => $matkulTidakLulus,
                    'total_matkul' => count($nilaiByMatkul),
                    'nilai_per_matkul' => array_values($nilaiByMatkul)
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching score summary: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil ringkasan nilai',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Convert numeric score to letter grade
     */
    private function konversiNilaiHuruf($nilai)
    {
        if ($nilai >= 85) return 'A';
        if ($nilai >= 80) return 'A-';
        if ($nilai >= 75) return 'B+';
        if ($nilai >= 70) return 'B';
        if ($nilai >= 65) return 'B-';
        if ($nilai >= 60) return 'C+';
        if ($nilai >= 55) return 'C';
        if ($nilai >= 50) return 'C-';
        if ($nilai >= 45) return 'D';
        return 'E';
    }
}
