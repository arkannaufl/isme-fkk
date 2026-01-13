<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\JadwalJurnalReading;
use App\Models\JadwalPBL;
use App\Models\JadwalCSR;
use App\Models\AbsensiJurnal;
use App\Models\AbsensiPBL;
use App\Models\AbsensiCSR;
use App\Models\JadwalPraktikum;
use App\Models\AbsensiPraktikum;
use App\Models\JadwalKuliahBesar;
use App\Models\AbsensiKuliahBesar;
use App\Models\JadwalSeminarPleno;
use App\Models\AbsensiSeminarPleno;
use App\Models\KelompokBesarAntara;
use App\Models\JadwalNonBlokNonCSR;
use App\Models\AbsensiNonBlokNonCSR;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MahasiswaKeabsenanController extends Controller
{
    /**
     * Get attendance data for a specific student
     */
    public function getKeabsenanMahasiswa($mahasiswaId)
    {
        try {
            // Get student data
            $mahasiswa = User::where('id', $mahasiswaId)
                ->where('role', 'mahasiswa')
                ->first();

            if (!$mahasiswa) {
                return response()->json(['message' => 'Mahasiswa tidak ditemukan'], 404);
            }

            // Get Jurnal Reading schedules for this student
            $jurnalSchedules = $this->getJurnalReadingSchedules($mahasiswa);

            // Get PBL schedules for this student
            $pblSchedules = $this->getPBLSchedules($mahasiswa);

            // Get CSR schedules for this student
            $csrSchedules = $this->getCSRSchedules($mahasiswa);

            // Get Praktikum schedules for this student
            $praktikumSchedules = $this->getPraktikumSchedules($mahasiswa);

            // Get Kuliah Besar schedules for this student
            $kuliahBesarSchedules = $this->getKuliahBesarSchedules($mahasiswa);

            // Get Seminar Pleno schedules for this student
            $seminarPlenoSchedules = $this->getSeminarPlenoSchedules($mahasiswa);

            // Get Non Blok Non CSR schedules for this student
            $nonBlokNonCSRSchedules = $this->getNonBlokNonCSRSchedules($mahasiswa);

            // Combine and process attendance data
            $attendanceData = $this->processAttendanceData($jurnalSchedules, $pblSchedules, $csrSchedules, $praktikumSchedules, $kuliahBesarSchedules, $seminarPlenoSchedules, $nonBlokNonCSRSchedules, $mahasiswa);

            // Calculate statistics
            $stats = $this->calculateAttendanceStats($attendanceData);

            // Get kelompok data
            $kelompokKecil = DB::table('kelompok_kecil')
                ->where('mahasiswa_id', $mahasiswa->id)
                ->first();

            $kelompokBesar = DB::table('kelompok_besar')
                ->where('mahasiswa_id', $mahasiswa->id)
                ->first();

            return response()->json([
                'mahasiswa' => [
                    'id' => $mahasiswa->id,
                    'nama' => $mahasiswa->name,
                    'nid' => $mahasiswa->nim,
                    'email' => $mahasiswa->email,
                    'telp' => $mahasiswa->telp,
                    'username' => $mahasiswa->username,
                    'semester' => $mahasiswa->semester ?? 1,
                    'status' => $mahasiswa->status ?? 'aktif',
                    'kelompok_kecil' => $kelompokKecil ? $kelompokKecil->nama_kelompok : null,
                    'kelompok_besar' => $kelompokBesar ? "Semester " . $kelompokBesar->semester : null,
                ],
                'statistik' => $stats,
                'detail_kehadiran' => $attendanceData
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal memuat data keabsenan: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get Jurnal Reading schedules for student
     */
    private function getJurnalReadingSchedules($mahasiswa)
    {
        // Get kelompok kecil for this mahasiswa
        $kelompokKecil = DB::table('kelompok_kecil')
            ->where('mahasiswa_id', $mahasiswa->id)
            ->first();

        if (!$kelompokKecil) {
            return [];
        }

        $schedules = JadwalJurnalReading::with(['mataKuliah', 'dosen', 'ruangan'])
            ->whereHas('kelompokKecil', function ($q) use ($kelompokKecil) {
                $q->where('nama_kelompok', $kelompokKecil->nama_kelompok)
                    ->where('semester', $kelompokKecil->semester);
            })
            ->get();

        $result = [];
        foreach ($schedules as $schedule) {
            // Check if attendance is marked
            $attendance = AbsensiJurnal::where('jadwal_jurnal_reading_id', $schedule->id)
                ->where('mahasiswa_nim', $mahasiswa->nim)
                ->first();

            $status = 'tidak_hadir'; // Default status
            $alasan = null;

            if ($attendance) {
                if ($attendance->hadir) {
                    $status = 'hadir';
                } else {
                    $status = 'tidak_hadir';
                }
                // If there's a catatan, use it as alasan (regardless of hadir status)
                if ($attendance->catatan) {
                    $alasan = $attendance->catatan;
                }
            }

            $result[] = [
                'id' => $schedule->id,
                'tanggal' => is_string($schedule->tanggal) ? $schedule->tanggal : $schedule->tanggal->format('Y-m-d'),
                'mata_kuliah' => $schedule->mataKuliah->nama ?? $schedule->mata_kuliah_kode,
                'jenis_jadwal' => 'jurnal_reading',
                'status' => $status,
                'alasan' => $alasan,
                'jam_mulai' => $schedule->jam_mulai,
                'jam_selesai' => $schedule->jam_selesai,
                'ruangan' => $schedule->ruangan->nama ?? 'Tidak ada',
                'dosen' => $schedule->dosen->name ?? 'Tidak ada',
                'topik' => $schedule->topik,
            ];
        }

        return $result;
    }

    /**
     * Get PBL schedules for student
     */
    private function getPBLSchedules($mahasiswa)
    {
        // Get kelompok kecil for this mahasiswa
        $kelompokKecil = DB::table('kelompok_kecil')
            ->where('mahasiswa_id', $mahasiswa->id)
            ->first();

        if (!$kelompokKecil) {
            return [];
        }

        // Match by nama_kelompok and semester, not exact ID
        $schedules = JadwalPBL::with(['mataKuliah', 'dosen', 'ruangan', 'kelompokKecil', 'modulPBL'])
            ->whereHas('kelompokKecil', function ($q) use ($kelompokKecil) {
                $q->where('nama_kelompok', $kelompokKecil->nama_kelompok)
                    ->where('semester', $kelompokKecil->semester);
            })
            ->get();

        $result = [];
        foreach ($schedules as $schedule) {
            // Check if attendance is marked
            $attendance = AbsensiPBL::where('mata_kuliah_kode', $schedule->mata_kuliah_kode)
                ->where('kelompok', $schedule->kelompokKecil->nama_kelompok ?? '')
                ->where('pertemuan', $schedule->pbl_tipe)
                ->where('mahasiswa_npm', $mahasiswa->nim)
                ->first();

            $status = 'tidak_hadir'; // Default status
            $alasan = null;

            if ($attendance) {
                if ($attendance->hadir) {
                    $status = 'hadir';
                } else {
                    $status = 'tidak_hadir';
                }
                // If there's a catatan, use it as alasan (regardless of hadir status)
                if ($attendance->catatan) {
                    $alasan = $attendance->catatan;
                }
            }

            $result[] = [
                'id' => $schedule->id,
                'tanggal' => is_string($schedule->tanggal) ? $schedule->tanggal : $schedule->tanggal->format('Y-m-d'),
                'mata_kuliah' => $schedule->mataKuliah->nama ?? $schedule->mata_kuliah_kode,
                'jenis_jadwal' => 'pbl',
                'jenis_detail' => $schedule->pbl_tipe,
                'status' => $status,
                'alasan' => $alasan,
                'jam_mulai' => $schedule->jam_mulai,
                'jam_selesai' => $schedule->jam_selesai,
                'ruangan' => $schedule->ruangan->nama ?? 'Tidak ada',
                'dosen' => $schedule->dosen->name ?? 'Tidak ada',
                'topik' => $schedule->modulPBL->nama_modul ?? 'N/A',
                'pbl_tipe' => $schedule->pbl_tipe,
            ];
        }

        return $result;
    }

    /**
     * Get Praktikum schedules for student
     */
    private function getPraktikumSchedules($mahasiswa)
    {
        // Get kelompok kecil names for this mahasiswa
        // We match by nama_kelompok because the specific ID might differ between student assignment and schedule link
        // depending on how the data is structured (e.g. if one row per student)
        $kelompokKecilNames = DB::table('kelompok_kecil')
            ->where('mahasiswa_id', $mahasiswa->id)
            ->pluck('nama_kelompok')
            ->toArray();

        // Also restrict by semester to avoid group name collisions between semesters
        $semester = $mahasiswa->semester;

        if (empty($kelompokKecilNames)) {
            return [];
        }

        // Get schedules that are assigned to any of these kelompok kecil names
        // AND match the student's semester via mata kuliah
        $schedules = JadwalPraktikum::with(['mataKuliah', 'dosen', 'ruangan', 'kelompokKecil'])
            ->whereHas('kelompokKecil', function ($q) use ($kelompokKecilNames) {
                $q->whereIn('nama_kelompok', $kelompokKecilNames);
            })
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                $q->where('semester', $semester);
            })
            ->get();

        $result = [];
        foreach ($schedules as $schedule) {
            // Check if attendance is marked
            $attendance = AbsensiPraktikum::where('jadwal_praktikum_id', $schedule->id)
                ->where('mahasiswa_nim', $mahasiswa->nim)
                ->first();

            // Binary status logic: Hadir OR Tidak Hadir
            // No waiting status for Praktikum
            $status = 'tidak_hadir'; // Default to tidak_hadir
            $alasan = null;

            if ($attendance) {
                if ($attendance->hadir) {
                    $status = 'hadir';
                } else {
                    $status = 'tidak_hadir';
                }
                
                if ($attendance->catatan) {
                    $alasan = $attendance->catatan;
                }
            }

            $result[] = [
                'id' => $schedule->id,
                'tanggal' => $schedule->tanggal,
                'mata_kuliah' => $schedule->mataKuliah->nama ?? $schedule->mata_kuliah_kode,
                'jenis_jadwal' => 'praktikum',
                'status' => $status,
                'alasan' => $alasan,
                'jam_mulai' => $schedule->jam_mulai,
                'jam_selesai' => $schedule->jam_selesai,
                'ruangan' => $schedule->ruangan->nama ?? 'Tidak ada',
                'dosen' => $schedule->dosen->isNotEmpty() ? $schedule->dosen->map(fn($d) => $d->name)->join(', ') : 'Tidak ada',
                'topik' => $schedule->topik,
                'materi' => $schedule->materi,
            ];
        }

        return $result;
    }

    /**
     * Get Kuliah Besar schedules for student
     */
    /**
     * Get Kuliah Besar schedules for student
     */
    private function getKuliahBesarSchedules($mahasiswa)
    {
        // Get semester from student data
        $semester = $mahasiswa->semester;

        // Get schedules for this student's semester
        $schedules = JadwalKuliahBesar::with(['mataKuliah', 'dosen', 'ruangan'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                $q->where('semester', $semester);
            })
            ->get();

        $result = [];
        foreach ($schedules as $schedule) {
            // Check if attendance is marked
            $attendance = AbsensiKuliahBesar::where('jadwal_kuliah_besar_id', $schedule->id)
                ->where('mahasiswa_nim', $mahasiswa->nim)
                ->first();

            // Binary status logic: Hadir OR Tidak Hadir
            $status = 'tidak_hadir'; // Default to tidak_hadir
            $alasan = null;

            if ($attendance) {
                if ($attendance->hadir) {
                    $status = 'hadir';
                } else {
                    $status = 'tidak_hadir';
                }
                
                if ($attendance->catatan) {
                    $alasan = $attendance->catatan;
                }
            }

            $result[] = [
                'id' => $schedule->id,
                'tanggal' => $schedule->tanggal,
                'mata_kuliah' => $schedule->mataKuliah->nama ?? $schedule->mata_kuliah_kode,
                'jenis_jadwal' => 'kuliah_besar',
                'jenis_detail' => '-',
                'status' => $status,
                'alasan' => $alasan,
                'jam_mulai' => $schedule->jam_mulai,
                'jam_selesai' => $schedule->jam_selesai,
                'ruangan' => $schedule->ruangan->nama ?? 'Tidak ada',
                'dosen' => $schedule->dosen->name ?? 'Tidak ada',
            ];
        }

        return $result;
    }

    /**
     * Get Seminar Pleno schedules for student
     */
    private function getSeminarPlenoSchedules($mahasiswa)
    {
        $semester = $mahasiswa->semester;
        
        // Get kelompok besar antara jika ada (Semester Antara)
        $kelompokBesarAntara = DB::table('kelompok_besar_antara')
            ->where(function ($q) use ($mahasiswa) {
                $q->whereJsonContains('mahasiswa_ids', (string)$mahasiswa->id)
                  ->orWhereRaw('JSON_SEARCH(mahasiswa_ids, "one", ?) IS NOT NULL', [(string)$mahasiswa->id])
                  ->orWhereRaw('CAST(mahasiswa_ids AS CHAR) LIKE ?', ['%"' . $mahasiswa->id . '"%'])
                  ->orWhereRaw('CAST(mahasiswa_ids AS CHAR) LIKE ?', ['%' . $mahasiswa->id . '%']);
            })->first();
        $kelompokBesarAntaraId = $kelompokBesarAntara ? $kelompokBesarAntara->id : null;

        // Get schedules
        $query = JadwalSeminarPleno::with(['mataKuliah', 'ruangan']);
        
        $query->where(function ($q) use ($semester, $kelompokBesarAntaraId) {
            $hasCondition = false;
            
            if ($semester) {
                // Match dengan kelompok_besar_id (yang menyimpan semester) atau via relasi (foreign key ID)
                $q->where(function ($sub) use ($semester) {
                    $sub->where('kelompok_besar_id', (int)$semester)
                        ->orWhereIn('kelompok_besar_id', function ($kbQ) use ($semester) {
                            $kbQ->select('id')->from('kelompok_besar')->where('semester', (int)$semester);
                        });
                })->orWhere(function ($fb) use ($semester) {
                    $fb->whereNull('kelompok_besar_id')
                        ->whereHas('mataKuliah', function ($mk) use ($semester) {
                            $mk->where('semester', (int)$semester);
                        });
                });
                $hasCondition = true;
            }
            
            if ($kelompokBesarAntaraId) {
                $q->orWhere('kelompok_besar_antara_id', $kelompokBesarAntaraId);
                $hasCondition = true;
            }

            // Jika tidak ada info semester/kelompok, jangan return apa-apa
            if (!$hasCondition) {
                $q->where('id', 0);
            }
        });

        $schedules = $query->get();

        $result = [];
        foreach ($schedules as $schedule) {
            // Check if attendance is marked
            // NOTE: In Seminar Pleno, student attendance is stored in dosen_id column
            $attendance = AbsensiSeminarPleno::where('jadwal_seminar_pleno_id', $schedule->id)
                ->where('dosen_id', $mahasiswa->id)
                ->first();

            $status = 'tidak_hadir';
            $alasan = null;

            if ($attendance) {
                $status = $attendance->hadir ? 'hadir' : 'tidak_hadir';
                $alasan = $attendance->catatan;
            }

            $result[] = [
                'id' => $schedule->id,
                'tanggal' => $schedule->tanggal,
                'mata_kuliah' => $schedule->mataKuliah->nama ?? $schedule->mata_kuliah_kode,
                'jenis_jadwal' => 'seminar_pleno',
                'status' => $status,
                'alasan' => $alasan,
                'jam_mulai' => $schedule->jam_mulai,
                'jam_selesai' => $schedule->jam_selesai,
                'ruangan' => $schedule->ruangan->nama ?? 'Tidak ada',
                'dosen' => $schedule->dosen_names,
                'topik' => $schedule->topik,
            ];
        }

        return $result;
    }

    /**
     * Get CSR schedules for student
     */
    private function getCSRSchedules($mahasiswa)
    {
        // Get kelompok kecil for this mahasiswa
        $kelompokKecil = DB::table('kelompok_kecil')
            ->where('mahasiswa_id', $mahasiswa->id)
            ->first();

        if (!$kelompokKecil) {
            return [];
        }

        $schedules = JadwalCSR::with(['mataKuliah', 'dosen', 'ruangan', 'kategori'])
            ->where('kelompok_kecil_id', $kelompokKecil->id)
            ->get();

        $result = [];
        foreach ($schedules as $schedule) {
            // Check if attendance is marked
            $attendance = AbsensiCSR::where('jadwal_csr_id', $schedule->id)
                ->where('mahasiswa_npm', $mahasiswa->nim)
                ->first();

            $status = 'tidak_hadir'; // Default status
            $alasan = null;

            if ($attendance) {
                if ($attendance->hadir) {
                    $status = 'hadir';
                } else {
                    $status = 'tidak_hadir';
                }
                // If there's a catatan, use it as alasan (regardless of hadir status)
                if ($attendance->catatan) {
                    $alasan = $attendance->catatan;
                }
            }

            $result[] = [
                'id' => $schedule->id,
                'tanggal' => $schedule->tanggal,
                'mata_kuliah' => $schedule->mataKuliah->nama ?? $schedule->mata_kuliah_kode,
                'jenis_jadwal' => 'csr',
                'jenis_detail' => $schedule->jenis_csr === 'reguler' ? 'CSR Reguler' : 'CSR Responsi',
                'status' => $status,
                'alasan' => $alasan,
                'jam_mulai' => $schedule->jam_mulai,
                'jam_selesai' => $schedule->jam_selesai,
                'ruangan' => $schedule->ruangan->nama ?? 'Tidak ada',
                'dosen' => $schedule->dosen->name ?? 'Tidak ada',
                'topik' => $schedule->topik,
                'kategori' => $schedule->kategori->nama ?? 'Tidak ada',
            ];
        }

        return $result;
    }

    /**
     * Get Non Blok Non CSR schedules for student
     */
    private function getNonBlokNonCSRSchedules($mahasiswa)
    {
        $result = [];
        
        // Get kelompok besar for this mahasiswa
        $kelompokBesar = DB::table('kelompok_besar')
            ->where('mahasiswa_id', $mahasiswa->id)
            ->first();
        
        if (!$kelompokBesar) {
            return $result;
        }
        
        // Get schedules assigned to kelompok besar (materi & agenda) OR specific student (seminar & sidang)
        $schedules = JadwalNonBlokNonCSR::with(['mataKuliah', 'dosen', 'ruangan'])
            ->where(function($q) use ($kelompokBesar, $mahasiswa) {
                // Schedules for kelompok besar
                $q->where('kelompok_besar_id', $kelompokBesar->semester)
                  // OR schedules specifically for this student (seminar/sidang)
                  ->orWhereRaw('JSON_CONTAINS(mahasiswa_nims, ?)', [json_encode($mahasiswa->nim)]);
            })
            ->get();
        
        foreach ($schedules as $schedule) {
            // Determine type label based on jenis_baris
            $tipe = match($schedule->jenis_baris) {
                'materi' => 'Jadwal Materi',
                'agenda' => 'Agenda Khusus',
                'seminar_proposal' => 'Seminar Proposal',
                'sidang_skripsi' => 'Sidang Skripsi',
                default => 'Non Blok Non CSR'
            };
            
            // Get attendance record
            $attendance = AbsensiNonBlokNonCSR::where('jadwal_non_blok_non_csr_id', $schedule->id)
                ->where('mahasiswa_nim', $mahasiswa->nim)
                ->first();
            
            $status = 'tidak_hadir'; // Default status
            $alasan = null;

            if ($attendance) {
                if ($attendance->hadir) {
                    $status = 'hadir';
                } else {
                    $status = 'tidak_hadir';
                }
                // If there's a catatan, use it as alasan
                if ($attendance->catatan) {
                    $alasan = $attendance->catatan;
                }
            }
            
            $result[] = [
                'id' => $schedule->id,
                'tanggal' => is_string($schedule->tanggal) ? $schedule->tanggal : $schedule->tanggal->format('Y-m-d'),
                'mata_kuliah' => $schedule->mataKuliah->nama ?? 'Unknown',
                'jenis_jadwal' => 'non_blok_non_csr', // Main category
                'jenis_detail' => $tipe, // Specific type (Jadwal Materi, Agenda Khusus, etc.)
                'status' => $status,
                'alasan' => $alasan,
                'jam_mulai' => $schedule->jam_mulai,
                'jam_selesai' => $schedule->jam_selesai,
                'waktu' => $schedule->jam_mulai . ' - ' . $schedule->jam_selesai, // Add time range for frontend
                'ruangan' => $schedule->use_ruangan ? ($schedule->ruangan->nama ?? '-') : 'Online',
                'dosen' => $schedule->dosen->name ?? '-',
                'materi_agenda' => $schedule->materi ?? $schedule->agenda ?? '-',
            ];
        }
        
        return $result;
    }

    /**
     * Process and combine attendance data
     */
    private function processAttendanceData($jurnalSchedules, $pblSchedules, $csrSchedules, $praktikumSchedules, $kuliahBesarSchedules, $seminarPlenoSchedules, $nonBlokNonCSRSchedules, $mahasiswa)
    {
        $allSchedules = array_merge($jurnalSchedules, $pblSchedules, $csrSchedules, $praktikumSchedules, $kuliahBesarSchedules, $seminarPlenoSchedules, $nonBlokNonCSRSchedules);

        // Sort by date
        usort($allSchedules, function ($a, $b) {
            return strtotime($a['tanggal']) - strtotime($b['tanggal']);
        });

        return $allSchedules;
    }

    /**
     * Calculate attendance statistics
     */
    private function calculateAttendanceStats($attendanceData)
    {
        $totalSchedules = count($attendanceData);
        $hadir = 0;
        $tidakHadir = 0;
        $waiting = 0;

        foreach ($attendanceData as $attendance) {
            switch ($attendance['status']) {
                case 'hadir':
                    $hadir++;
                    break;
                case 'tidak_hadir':
                    $tidakHadir++;
                    break;
                case 'waiting':
                    $waiting++;
                    break;
            }
        }

        $persentase = $totalSchedules > 0 ? ($hadir / $totalSchedules) * 100 : 0;

        // Determine status kehadiran
        $statusKehadiran = 'baik';
        if ($persentase < 70) {
            $statusKehadiran = 'buruk';
        } elseif ($persentase < 85) {
            $statusKehadiran = 'kurang';
        }

        return [
            'total_kehadiran' => $hadir,
            'total_absensi' => $tidakHadir,
            'total_waiting' => $waiting,
            'total_schedules' => $totalSchedules,
            'persentase_kehadiran' => round($persentase, 1),
            'status_kehadiran' => $statusKehadiran,
        ];
    }
}
