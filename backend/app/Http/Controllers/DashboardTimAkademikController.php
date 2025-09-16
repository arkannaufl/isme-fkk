<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\User;
use App\Models\MataKuliah;
use App\Models\Kelas;
use App\Models\Ruangan;
use App\Models\JadwalKuliahBesar;
use App\Models\JadwalPBL;
use App\Models\JadwalJurnalReading;
use App\Models\JadwalCSR;
use App\Models\JadwalNonBlokNonCSR;
use App\Models\JadwalPraktikum;
use App\Models\JadwalAgendaKhusus;
use App\Models\AbsensiPBL;
use App\Models\AbsensiJurnal;
use App\Models\AbsensiCSR;
use App\Models\PenilaianPBL;
use App\Models\PenilaianJurnal;
use App\Models\TahunAjaran;
use App\Models\Semester;
use Spatie\Activitylog\Models\Activity;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardTimAkademikController extends Controller
{
    /**
     * Get dashboard statistics for Tim Akademik
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $attendanceSemester = $request->get('attendance_semester', 'reguler');
            $assessmentSemester = $request->get('assessment_semester', 'reguler');
            $scheduleSemester = $request->get('schedule_semester', 'reguler');
            // Get academic statistics
            $totalMataKuliah = MataKuliah::count();
            $totalKelas = Kelas::count();
            $totalRuangan = Ruangan::count();
            $totalDosen = User::where('role', 'dosen')->count();
            $totalMahasiswa = User::where('role', 'mahasiswa')->count();

            // Get active schedules count
            $totalJadwalAktif = $this->getActiveSchedulesCount();

            // Get attendance statistics
            $attendanceStats = $this->getAttendanceStats($attendanceSemester);

            // Get assessment statistics
            $assessmentStats = $this->getAssessmentStats($assessmentSemester);

            // Get today's schedule
            $todaySchedule = $this->getTodaySchedule();

            // Get recent academic activities
            $recentActivities = $this->getRecentAcademicActivities();

            // Get academic notifications
            $academicNotifications = $this->getAcademicNotifications();

            // Get current academic period info
            $academicOverview = $this->getAcademicOverview();

            // Get schedule statistics by type
            $scheduleStats = $this->getScheduleStats($scheduleSemester);

            // Get low attendance alerts
            $lowAttendanceAlerts = $this->getLowAttendanceAlerts();

            return response()->json([
                'totalMataKuliah' => $totalMataKuliah,
                'totalKelas' => $totalKelas,
                'totalRuangan' => $totalRuangan,
                'totalDosen' => $totalDosen,
                'totalMahasiswa' => $totalMahasiswa,
                'totalJadwalAktif' => $totalJadwalAktif,
                'attendanceStats' => $attendanceStats,
                'assessmentStats' => $assessmentStats,
                'todaySchedule' => $todaySchedule,
                'recentActivities' => $recentActivities,
                'academicNotifications' => $academicNotifications,
                'academicOverview' => $academicOverview,
                'scheduleStats' => $scheduleStats,
                'lowAttendanceAlerts' => $lowAttendanceAlerts,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch dashboard data',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get count of all active schedules
     */
    private function getActiveSchedulesCount(): int
    {
        $count = 0;
        
        try {
            $count += JadwalKuliahBesar::count();
            $count += JadwalPBL::count();
            $count += JadwalJurnalReading::count();
            $count += JadwalCSR::count();
            $count += JadwalNonBlokNonCSR::count();
            $count += JadwalPraktikum::count();
            $count += JadwalAgendaKhusus::count();
        } catch (\Exception $e) {
            \Log::warning('Error counting schedules: ' . $e->getMessage());
        }

        return $count;
    }

    /**
     * Get attendance statistics
     */
    private function getAttendanceStats(string $semester = 'reguler'): array
    {
        try {
            // PBL Attendance with semester filter
            $pblAttendance = AbsensiPBL::join('mata_kuliah', 'absensi_pbl.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                ->where('mata_kuliah.semester', $semester)
                ->selectRaw('
                    COUNT(*) as total_sessions,
                    SUM(CASE WHEN absensi_pbl.hadir = 1 THEN 1 ELSE 0 END) as attended_sessions,
                    COUNT(DISTINCT absensi_pbl.mahasiswa_npm) as total_students
                ')->first();

            $pblRate = $pblAttendance->total_sessions > 0 
                ? round(($pblAttendance->attended_sessions / $pblAttendance->total_sessions) * 100, 1)
                : 0;

            // Journal Attendance with semester filter
            $journalAttendance = AbsensiJurnal::join('jadwal_jurnal_reading', 'absensi_jurnal.jadwal_jurnal_reading_id', '=', 'jadwal_jurnal_reading.id')
                ->join('mata_kuliah', 'jadwal_jurnal_reading.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                ->where('mata_kuliah.semester', $semester)
                ->selectRaw('
                    COUNT(*) as total_sessions,
                    SUM(CASE WHEN absensi_jurnal.hadir = 1 THEN 1 ELSE 0 END) as attended_sessions,
                    COUNT(DISTINCT absensi_jurnal.mahasiswa_nim) as total_students
                ')->first();

            $journalRate = $journalAttendance->total_sessions > 0 
                ? round(($journalAttendance->attended_sessions / $journalAttendance->total_sessions) * 100, 1)
                : 0;

            // CSR Attendance with semester filter
            $csrAttendance = AbsensiCSR::join('jadwal_csr', 'absensi_csr.jadwal_csr_id', '=', 'jadwal_csr.id')
                ->join('mata_kuliah', 'jadwal_csr.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                ->where('mata_kuliah.semester', $semester)
                ->selectRaw('
                    COUNT(*) as total_sessions,
                    SUM(CASE WHEN absensi_csr.hadir = 1 THEN 1 ELSE 0 END) as attended_sessions,
                    COUNT(DISTINCT absensi_csr.mahasiswa_npm) as total_students
                ')->first();

            $csrRate = $csrAttendance->total_sessions > 0 
                ? round(($csrAttendance->attended_sessions / $csrAttendance->total_sessions) * 100, 1)
                : 0;

            // Overall attendance rate
            $totalSessions = $pblAttendance->total_sessions + $journalAttendance->total_sessions + $csrAttendance->total_sessions;
            $totalAttended = $pblAttendance->attended_sessions + $journalAttendance->attended_sessions + $csrAttendance->attended_sessions;
            $overallRate = $totalSessions > 0 ? round(($totalAttended / $totalSessions) * 100, 1) : 0;

            return [
                'overall_rate' => $overallRate,
                'pbl_rate' => $pblRate,
                'journal_rate' => $journalRate,
                'csr_rate' => $csrRate,
                'total_students' => max($pblAttendance->total_students, $journalAttendance->total_students, $csrAttendance->total_students),
                'total_sessions' => $totalSessions,
                'attended_sessions' => $totalAttended
            ];
        } catch (\Exception $e) {
            \Log::error('Error calculating attendance stats: ' . $e->getMessage());
            return [
                'overall_rate' => 0,
                'pbl_rate' => 0,
                'journal_rate' => 0,
                'csr_rate' => 0,
                'total_students' => 0,
                'total_sessions' => 0,
                'attended_sessions' => 0
            ];
        }
    }

    /**
     * Get assessment statistics
     */
    private function getAssessmentStats(string $semester = 'reguler'): array
    {
        try {
            // PBL Assessment stats with semester filter
            $pblStats = PenilaianPBL::join('jadwal_pbl', 'penilaian_pbl.jadwal_pbl_id', '=', 'jadwal_pbl.id')
                ->join('mata_kuliah', 'jadwal_pbl.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                ->where('mata_kuliah.semester', $semester)
                ->selectRaw('
                    COUNT(*) as total_assessments,
                    COUNT(CASE WHEN penilaian_pbl.tanggal_paraf IS NOT NULL THEN 1 END) as completed_assessments,
                    AVG((penilaian_pbl.nilai_a + penilaian_pbl.nilai_b + penilaian_pbl.nilai_c + penilaian_pbl.nilai_d + penilaian_pbl.nilai_e + penilaian_pbl.nilai_f + penilaian_pbl.nilai_g) / 7) as average_score
                ')->first();

            // Journal Assessment stats with semester filter
            $journalStats = PenilaianJurnal::join('jadwal_jurnal_reading', 'penilaian_jurnal.jurnal_reading_id', '=', 'jadwal_jurnal_reading.id')
                ->join('mata_kuliah', 'jadwal_jurnal_reading.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                ->where('mata_kuliah.semester', $semester)
                ->selectRaw('
                    COUNT(*) as total_assessments,
                    COUNT(CASE WHEN penilaian_jurnal.tanggal_paraf IS NOT NULL THEN 1 END) as completed_assessments,
                    AVG((penilaian_jurnal.nilai_keaktifan + penilaian_jurnal.nilai_laporan) / 2) as average_score
                ')->first();

            $totalAssessments = $pblStats->total_assessments + $journalStats->total_assessments;
            $completedAssessments = $pblStats->completed_assessments + $journalStats->completed_assessments;
            $completionRate = $totalAssessments > 0 ? round(($completedAssessments / $totalAssessments) * 100, 1) : 0;

            $averageScore = 0;
            if ($pblStats->average_score && $journalStats->average_score) {
                $averageScore = round(($pblStats->average_score + $journalStats->average_score) / 2, 1);
            } elseif ($pblStats->average_score) {
                $averageScore = round($pblStats->average_score, 1);
            } elseif ($journalStats->average_score) {
                $averageScore = round($journalStats->average_score, 1);
            }

            return [
                'total_pbl_assessments' => $pblStats->total_assessments,
                'total_journal_assessments' => $journalStats->total_assessments,
                'pending_pbl' => $pblStats->total_assessments - $pblStats->completed_assessments,
                'pending_journal' => $journalStats->total_assessments - $journalStats->completed_assessments,
                'completion_rate' => $completionRate,
                'average_score' => $averageScore,
                'total_assessments' => $totalAssessments,
                'completed_assessments' => $completedAssessments
            ];
        } catch (\Exception $e) {
            \Log::error('Error calculating assessment stats: ' . $e->getMessage());
            return [
                'total_pbl_assessments' => 0,
                'total_journal_assessments' => 0,
                'pending_pbl' => 0,
                'pending_journal' => 0,
                'completion_rate' => 0,
                'average_score' => 0,
                'total_assessments' => 0,
                'completed_assessments' => 0
            ];
        }
    }

    /**
     * Get today's schedule
     */
    private function getTodaySchedule(): array
    {
        try {
            $today = Carbon::today();
            $schedule = [];
            
            // Get today's schedules from different types
            $kuliahBesar = JadwalKuliahBesar::with(['mataKuliah', 'dosen', 'ruangan'])
                ->whereDate('tanggal', $today)
                ->get()
                ->map(function($item) {
                    return [
                        'type' => 'Kuliah Besar',
                        'mata_kuliah' => $item->mataKuliah->nama ?? 'Unknown',
                        'dosen' => $item->dosen->name ?? 'Unknown',
                        'ruangan' => $item->ruangan->nama ?? 'Unknown',
                        'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai,
                        'topik' => $item->topik ?? 'Tidak ada topik'
                    ];
                });
            
            $pbl = JadwalPBL::with(['mataKuliah', 'dosen', 'ruangan'])
                ->whereDate('tanggal', $today)
                ->get()
                ->map(function($item) {
                    return [
                        'type' => 'PBL',
                        'mata_kuliah' => $item->mataKuliah->nama ?? 'Unknown',
                        'dosen' => $item->dosen->name ?? 'Unknown',
                        'ruangan' => $item->ruangan->nama ?? 'Unknown',
                        'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai,
                        'topik' => $item->topik ?? 'Tidak ada topik'
                    ];
                });
            
            $journal = JadwalJurnalReading::with(['mataKuliah', 'dosen', 'ruangan'])
                ->whereDate('tanggal', $today)
                ->get()
                ->map(function($item) {
                    return [
                        'type' => 'Journal Reading',
                        'mata_kuliah' => $item->mataKuliah->nama ?? 'Unknown',
                        'dosen' => $item->dosenNames ?? 'Unknown',
                        'ruangan' => $item->ruangan->nama ?? 'Unknown',
                        'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai,
                        'topik' => $item->topik ?? 'Tidak ada topik'
                    ];
                });

            $csr = JadwalCSR::with(['mataKuliah', 'dosen', 'ruangan'])
                ->whereDate('tanggal', $today)
                ->get()
                ->map(function($item) {
                    return [
                        'type' => 'CSR',
                        'mata_kuliah' => $item->mataKuliah->nama ?? 'Unknown',
                        'dosen' => $item->dosen->name ?? 'Unknown',
                        'ruangan' => $item->ruangan->nama ?? 'Unknown',
                        'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai,
                        'topik' => $item->topik ?? 'Tidak ada topik'
                    ];
                });
            
            $schedule = $kuliahBesar->concat($pbl)->concat($journal)->concat($csr)->sortBy('waktu');
            
            return $schedule->take(10)->values()->toArray();
        } catch (\Exception $e) {
            \Log::error('Error fetching today schedule: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get recent academic activities
     */
    private function getRecentAcademicActivities(): array
    {
        try {
            $activities = Activity::with('causer')
                ->whereIn('subject_type', [
                    'App\\Models\\MataKuliah',
                    'App\\Models\\JadwalKuliahBesar',
                    'App\\Models\\JadwalPBL',
                    'App\\Models\\JadwalJurnalReading',
                    'App\\Models\\JadwalCSR',
                    'App\\Models\\PenilaianPBL',
                    'App\\Models\\PenilaianJurnal',
                    'App\\Models\\AbsensiPBL',
                    'App\\Models\\AbsensiJurnal',
                    'App\\Models\\AbsensiCSR'
                ])
                ->latest()
                ->limit(15)
                ->get()
                ->map(function ($activity) {
                    $user = $activity->causer ? $activity->causer->name : 'System';
                    $action = $this->formatActivityDescription($activity->description);
                    $target = $activity->subject_type ? class_basename($activity->subject_type) : 'Unknown';
                    
                    return [
                        'id' => $activity->id,
                        'user' => $user,
                        'action' => $action,
                        'target' => $target,
                        'timestamp' => $activity->created_at->diffForHumans(),
                        'type' => $this->getActivityType($activity->description)
                    ];
                });

            return $activities->toArray();
        } catch (\Exception $e) {
            \Log::warning('Error fetching activities: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Format activity description for display
     */
    private function formatActivityDescription(string $description): string
    {
        $descriptions = [
            'created' => 'membuat',
            'updated' => 'mengupdate',
            'deleted' => 'menghapus',
            'login' => 'login ke sistem',
            'logout' => 'logout dari sistem',
            'exported' => 'mengekspor data'
        ];

        return $descriptions[$description] ?? $description;
    }

    /**
     * Get activity type for icon display
     */
    private function getActivityType(string $description): string
    {
        $types = [
            'created' => 'create',
            'updated' => 'update',
            'deleted' => 'delete',
            'login' => 'login',
            'logout' => 'login',
            'exported' => 'export'
        ];

        return $types[$description] ?? 'other';
    }

    /**
     * Get academic notifications
     */
    private function getAcademicNotifications(): array
    {
        try {
            $notifications = [];
            
            // Check for low attendance
            $attendanceStats = $this->getAttendanceStats();
            if ($attendanceStats['overall_rate'] < 80) {
                $notifications[] = [
                    'type' => 'warning',
                    'title' => 'Tingkat Kehadiran Rendah',
                    'message' => "Tingkat kehadiran keseluruhan: {$attendanceStats['overall_rate']}%",
                    'action' => 'Lihat Detail'
                ];
            }

            // Check for pending assessments
            $assessmentStats = $this->getAssessmentStats();
            if ($assessmentStats['pending_pbl'] > 0 || $assessmentStats['pending_journal'] > 0) {
                $totalPending = $assessmentStats['pending_pbl'] + $assessmentStats['pending_journal'];
                $notifications[] = [
                    'type' => 'info',
                    'title' => 'Penilaian Tertunda',
                    'message' => "Ada {$totalPending} penilaian yang belum diselesaikan",
                    'action' => 'Lihat Penilaian'
                ];
            }

            // Check for schedule conflicts
            $conflicts = $this->getScheduleConflicts();
            if ($conflicts > 0) {
                $notifications[] = [
                    'type' => 'error',
                    'title' => 'Konflik Jadwal',
                    'message' => "Ditemukan {$conflicts} konflik jadwal",
                    'action' => 'Perbaiki Jadwal'
                ];
            }

            // Check for upcoming deadlines
            $upcomingDeadlines = $this->getUpcomingDeadlines();
            if (count($upcomingDeadlines) > 0) {
                $notifications[] = [
                    'type' => 'info',
                    'title' => 'Deadline Mendekat',
                    'message' => "Ada " . count($upcomingDeadlines) . " deadline yang akan datang",
                    'action' => 'Lihat Deadline'
                ];
            }
            
            return $notifications;
        } catch (\Exception $e) {
            \Log::error('Error getting academic notifications: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get academic overview
     */
    private function getAcademicOverview(): array
    {
        try {
            $currentTahunAjaran = TahunAjaran::where('aktif', true)->first();
            $currentSemester = Semester::where('aktif', true)->first();
            
            return [
                'current_semester' => $currentSemester ? $currentSemester->nama : 'Tidak ada semester aktif',
                'current_tahun_ajaran' => $currentTahunAjaran ? $currentTahunAjaran->tahun : 'Tidak ada tahun ajaran aktif',
                'semester_progress' => $this->calculateSemesterProgress(),
                'active_blocks' => $this->getActiveBlocks(),
                'upcoming_deadlines' => $this->getUpcomingDeadlines()
            ];
        } catch (\Exception $e) {
            \Log::error('Error getting academic overview: ' . $e->getMessage());
            return [
                'current_semester' => 'Unknown',
                'current_tahun_ajaran' => 'Unknown',
                'semester_progress' => 0,
                'active_blocks' => [],
                'upcoming_deadlines' => []
            ];
        }
    }

    /**
     * Calculate semester progress
     */
    private function calculateSemesterProgress(): int
    {
        try {
            $currentSemester = Semester::where('aktif', true)->first();
            if (!$currentSemester) return 0;

            $startDate = Carbon::parse($currentSemester->tanggal_mulai);
            $endDate = Carbon::parse($currentSemester->tanggal_akhir);
            $today = Carbon::today();

            if ($today->lt($startDate)) return 0;
            if ($today->gt($endDate)) return 100;

            $totalDays = $startDate->diffInDays($endDate);
            $passedDays = $startDate->diffInDays($today);

            return round(($passedDays / $totalDays) * 100);
        } catch (\Exception $e) {
            return 0;
        }
    }

    /**
     * Get active blocks
     */
    private function getActiveBlocks(): array
    {
        try {
            return MataKuliah::select('blok')
                ->whereNotNull('blok')
                ->distinct()
                ->pluck('blok')
                ->sort()
                ->values()
                ->toArray();
        } catch (\Exception $e) {
            return [];
        }
    }

    /**
     * Get upcoming deadlines
     */
    private function getUpcomingDeadlines(): array
    {
        try {
            $deadlines = [];
            $nextWeek = Carbon::today()->addWeek();

            // Get upcoming CSR deadlines
            $upcomingCSR = JadwalCSR::whereBetween('tanggal', [Carbon::today(), $nextWeek])
                ->with('mataKuliah')
                ->get()
                ->map(function($csr) {
                    return [
                        'title' => "CSR: " . ($csr->mataKuliah->nama ?? 'Unknown'),
                        'date' => $csr->tanggal->format('Y-m-d')
                    ];
                });

            // Get upcoming PBL deadlines
            $upcomingPBL = JadwalPBL::whereBetween('tanggal', [Carbon::today(), $nextWeek])
                ->with('mataKuliah')
                ->get()
                ->map(function($pbl) {
                    return [
                        'title' => "PBL: " . ($pbl->mataKuliah->nama ?? 'Unknown'),
                        'date' => $pbl->tanggal->format('Y-m-d')
                    ];
                });

            $deadlines = $upcomingCSR->concat($upcomingPBL)->sortBy('date')->take(5);

            return $deadlines->values()->toArray();
        } catch (\Exception $e) {
            return [];
        }
    }

    /**
     * Get schedule statistics by type
     */
    private function getScheduleStats(string $semester = 'reguler'): array
    {
        try {
            return [
                'kuliah_besar' => JadwalKuliahBesar::join('mata_kuliah', 'jadwal_kuliah_besar.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                    ->where('mata_kuliah.semester', $semester)
                    ->count(),
                'pbl' => JadwalPBL::join('mata_kuliah', 'jadwal_pbl.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                    ->where('mata_kuliah.semester', $semester)
                    ->count(),
                'jurnal_reading' => JadwalJurnalReading::join('mata_kuliah', 'jadwal_jurnal_reading.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                    ->where('mata_kuliah.semester', $semester)
                    ->count(),
                'csr' => JadwalCSR::join('mata_kuliah', 'jadwal_csr.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                    ->where('mata_kuliah.semester', $semester)
                    ->count(),
                'non_blok_non_csr' => JadwalNonBlokNonCSR::join('mata_kuliah', 'jadwal_non_blok_non_csr.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                    ->where('mata_kuliah.semester', $semester)
                    ->count(),
                'praktikum' => JadwalPraktikum::join('mata_kuliah', 'jadwal_praktikum.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                    ->where('mata_kuliah.semester', $semester)
                    ->count(),
                'agenda_khusus' => JadwalAgendaKhusus::join('mata_kuliah', 'jadwal_agenda_khusus.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                    ->where('mata_kuliah.semester', $semester)
                    ->count(),
            ];
        } catch (\Exception $e) {
            \Log::error('Error getting schedule stats: ' . $e->getMessage());
            return [
                'kuliah_besar' => 0,
                'pbl' => 0,
                'jurnal_reading' => 0,
                'csr' => 0,
                'non_blok_non_csr' => 0,
                'praktikum' => 0,
                'agenda_khusus' => 0,
            ];
        }
    }

    /**
     * Get low attendance alerts
     */
    private function getLowAttendanceAlerts(): array
    {
        try {
            $alerts = [];
            $threshold = 75; // 75% threshold

            // Get students with low PBL attendance
            $lowPBLAttendance = AbsensiPBL::selectRaw('
                mahasiswa_npm,
                COUNT(*) as total_sessions,
                SUM(CASE WHEN hadir = 1 THEN 1 ELSE 0 END) as attended_sessions
            ')
            ->groupBy('mahasiswa_npm')
            ->havingRaw('(SUM(CASE WHEN hadir = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100 < ?', [$threshold])
            ->with('mahasiswa')
            ->get()
            ->map(function($record) {
                $attendanceRate = round(($record->attended_sessions / $record->total_sessions) * 100, 1);
                return [
                    'student_nim' => $record->mahasiswa_npm,
                    'student_name' => $record->mahasiswa->name ?? 'Unknown',
                    'attendance_rate' => $attendanceRate,
                    'type' => 'PBL'
                ];
            });

            // Get students with low Journal attendance
            $lowJournalAttendance = AbsensiJurnal::selectRaw('
                mahasiswa_nim,
                COUNT(*) as total_sessions,
                SUM(CASE WHEN hadir = 1 THEN 1 ELSE 0 END) as attended_sessions
            ')
            ->groupBy('mahasiswa_nim')
            ->havingRaw('(SUM(CASE WHEN hadir = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100 < ?', [$threshold])
            ->with('mahasiswa')
            ->get()
            ->map(function($record) {
                $attendanceRate = round(($record->attended_sessions / $record->total_sessions) * 100, 1);
                return [
                    'student_nim' => $record->mahasiswa_nim,
                    'student_name' => $record->mahasiswa->name ?? 'Unknown',
                    'attendance_rate' => $attendanceRate,
                    'type' => 'Journal'
                ];
            });

            $alerts = $lowPBLAttendance->concat($lowJournalAttendance)->take(10);

            return $alerts->values()->toArray();
        } catch (\Exception $e) {
            \Log::error('Error getting low attendance alerts: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get schedule conflicts count
     */
    private function getScheduleConflicts(): int
    {
        try {
            // This is a simplified conflict detection
            // In real implementation, you'd check for overlapping schedules
            return 0; // Conflict detection not implemented yet
        } catch (\Exception $e) {
            return 0;
        }
    }

    /**
     * Get attendance statistics by mata kuliah
     */
    public function getAttendanceByMataKuliah(): JsonResponse
    {
        try {
            $attendanceByMataKuliah = MataKuliah::with(['pbls', 'csrs'])
                ->get()
                ->map(function($mataKuliah) {
                    // Calculate PBL attendance for this mata kuliah
                    $pblAttendance = AbsensiPBL::where('mata_kuliah_kode', $mataKuliah->kode)
                        ->selectRaw('
                            COUNT(*) as total_sessions,
                            SUM(CASE WHEN hadir = 1 THEN 1 ELSE 0 END) as attended_sessions
                        ')
                        ->first();

                    $pblRate = $pblAttendance->total_sessions > 0 
                        ? round(($pblAttendance->attended_sessions / $pblAttendance->total_sessions) * 100, 1)
                        : 0;

                    return [
                        'kode' => $mataKuliah->kode,
                        'nama' => $mataKuliah->nama,
                        'semester' => $mataKuliah->semester,
                        'pbl_attendance_rate' => $pblRate,
                        'total_pbl_sessions' => $pblAttendance->total_sessions,
                        'attended_pbl_sessions' => $pblAttendance->attended_sessions
                    ];
                })
                ->sortByDesc('pbl_attendance_rate')
                ->values();

            return response()->json($attendanceByMataKuliah);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch attendance by mata kuliah',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get assessment progress by mata kuliah
     */
    public function getAssessmentProgress(): JsonResponse
    {
        try {
            $assessmentProgress = MataKuliah::get()
                ->map(function($mataKuliah) {
                    // PBL Assessment progress
                    $pblStats = PenilaianPBL::where('mata_kuliah_kode', $mataKuliah->kode)
                        ->selectRaw('
                            COUNT(*) as total_assessments,
                            COUNT(CASE WHEN tanggal_paraf IS NOT NULL THEN 1 END) as completed_assessments
                        ')
                        ->first();

                    $pblCompletionRate = $pblStats->total_assessments > 0 
                        ? round(($pblStats->completed_assessments / $pblStats->total_assessments) * 100, 1)
                        : 0;

                    // Journal Assessment progress
                    $journalStats = PenilaianJurnal::where('mata_kuliah_kode', $mataKuliah->kode)
                        ->selectRaw('
                            COUNT(*) as total_assessments,
                            COUNT(CASE WHEN tanggal_paraf IS NOT NULL THEN 1 END) as completed_assessments
                        ')
                        ->first();

                    $journalCompletionRate = $journalStats->total_assessments > 0 
                        ? round(($journalStats->completed_assessments / $journalStats->total_assessments) * 100, 1)
                        : 0;

                    return [
                        'kode' => $mataKuliah->kode,
                        'nama' => $mataKuliah->nama,
                        'semester' => $mataKuliah->semester,
                        'pbl_completion_rate' => $pblCompletionRate,
                        'journal_completion_rate' => $journalCompletionRate,
                        'total_pbl_assessments' => $pblStats->total_assessments,
                        'completed_pbl_assessments' => $pblStats->completed_assessments,
                        'total_journal_assessments' => $journalStats->total_assessments,
                        'completed_journal_assessments' => $journalStats->completed_assessments
                    ];
                })
                ->filter(function($item) {
                    return $item['total_pbl_assessments'] > 0 || $item['total_journal_assessments'] > 0;
                })
                ->sortByDesc('pbl_completion_rate')
                ->values();

            return response()->json($assessmentProgress);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch assessment progress',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
