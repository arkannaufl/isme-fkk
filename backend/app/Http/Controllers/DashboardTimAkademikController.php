<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\User;
use App\Models\MataKuliah;
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
use App\Models\AbsensiDosenPraktikum;
use App\Models\PenilaianPBL;
use App\Models\PenilaianJurnal;
use App\Models\TahunAjaran;
use App\Models\Semester;
use Spatie\Activitylog\Models\Activity;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
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
            $totalMataKuliah = Cache::remember('stats_total_mata_kuliah_active', 300, function () {
                $activeTA = TahunAjaran::where('aktif', true)->first();
                if (!$activeTA) return 0;
                return $activeTA->mataKuliah()->count();
            });
            $totalRuangan = Cache::remember('stats_total_ruangan', 300, function () {
                return Ruangan::count();
            });
            $totalDosen = Cache::remember('stats_total_dosen', 300, function () {
                return User::where('role', 'dosen')->count();
            });
            $totalMahasiswa = Cache::remember('stats_total_mahasiswa', 300, function () {
                return User::where('role', 'mahasiswa')->count();
            });

            return response()->json([
                'totalMataKuliah' => $totalMataKuliah,
                'totalRuangan' => $totalRuangan,
                'totalDosen' => $totalDosen,
                'totalMahasiswa' => $totalMahasiswa,
                'totalJadwalAktif' => $this->getActiveSchedulesCount(),
                'attendanceStats' => $this->getAttendanceStats($attendanceSemester),
                'assessmentStats' => $this->getAssessmentStats($assessmentSemester),
                'todaySchedule' => $this->getTodaySchedule(),
                'recentActivities' => $this->getRecentAcademicActivities(),
                'academicNotifications' => $this->getAcademicNotifications(),
                'academicOverview' => $this->getAcademicOverview(),
                'scheduleStats' => $this->getScheduleStats($scheduleSemester),
                'lowAttendanceAlerts' => $this->getLowAttendanceAlerts(),
                'praktikumPendingAbsensi' => $this->getPraktikumPendingAbsensi(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch dashboard data',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    private function getActiveSchedulesCount(): int
    {
        return Cache::remember('stats_total_jadwal_aktif', 300, function () {
            $count = 0;
            try {
                $count += JadwalKuliahBesar::count();
                $count += JadwalPBL::count();
                $count += JadwalJurnalReading::count();
                $count += JadwalCSR::count();
                $count += JadwalNonBlokNonCSR::count();
                $count += JadwalPraktikum::count();
                $count += JadwalAgendaKhusus::count();
            } catch (\Exception $e) {}
            return $count;
        });
    }

    private function getAttendanceStats(string $semester = 'reguler'): array
    {
        try {
            $semesterIds = $this->getSemesterIdsForType($semester);
            
            $pblAttendance = AbsensiPBL::withoutGlobalScope('activeSemester')
                ->whereIn('semester_id', $semesterIds)
                ->selectRaw('COUNT(*) as total_sessions, SUM(CASE WHEN hadir = 1 THEN 1 ELSE 0 END) as attended_sessions, COUNT(DISTINCT mahasiswa_npm) as total_students')
                ->first();

            $journalAttendance = AbsensiJurnal::join('jadwal_jurnal_reading', 'absensi_jurnal.jadwal_jurnal_reading_id', '=', 'jadwal_jurnal_reading.id')
                ->whereIn('jadwal_jurnal_reading.semester_id', $semesterIds)
                ->selectRaw('COUNT(*) as total_sessions, SUM(CASE WHEN hadir = 1 THEN 1 ELSE 0 END) as attended_sessions, COUNT(DISTINCT mahasiswa_nim) as total_students')
                ->first();

            $csrAttendance = AbsensiCSR::join('jadwal_csr', 'absensi_csr.jadwal_csr_id', '=', 'jadwal_csr.id')
                ->whereIn('jadwal_csr.semester_id', $semesterIds)
                ->selectRaw('COUNT(*) as total_sessions, SUM(CASE WHEN hadir = 1 THEN 1 ELSE 0 END) as attended_sessions, COUNT(DISTINCT mahasiswa_npm) as total_students')
                ->first();

            $totalSessions = ($pblAttendance->total_sessions ?? 0) + ($journalAttendance->total_sessions ?? 0) + ($csrAttendance->total_sessions ?? 0);
            $totalAttended = ($pblAttendance->attended_sessions ?? 0) + ($journalAttendance->attended_sessions ?? 0) + ($csrAttendance->attended_sessions ?? 0);
            $overallRate = $totalSessions > 0 ? round(($totalAttended / $totalSessions) * 100, 1) : 0;

            return [
                'overall_rate' => $overallRate,
                'pbl_rate' => ($pblAttendance->total_sessions ?? 0) > 0 ? round(($pblAttendance->attended_sessions / $pblAttendance->total_sessions) * 100, 1) : 0,
                'journal_rate' => ($journalAttendance->total_sessions ?? 0) > 0 ? round(($journalAttendance->attended_sessions / $journalAttendance->total_sessions) * 100, 1) : 0,
                'csr_rate' => ($csrAttendance->total_sessions ?? 0) > 0 ? round(($csrAttendance->attended_sessions / $csrAttendance->total_sessions) * 100, 1) : 0,
                'total_students' => max($pblAttendance->total_students ?? 0, $journalAttendance->total_students ?? 0, $csrAttendance->total_students ?? 0),
                'total_sessions' => $totalSessions,
                'attended_sessions' => $totalAttended
            ];
        } catch (\Exception $e) {
            return ['overall_rate' => 0, 'pbl_rate' => 0, 'journal_rate' => 0, 'csr_rate' => 0, 'total_students' => 0, 'total_sessions' => 0, 'attended_sessions' => 0];
        }
    }

    private function getAssessmentStats(string $semester = 'reguler'): array
    {
        try {
            $semesterIds = $this->getSemesterIdsForType($semester);

            $pblStats = PenilaianPBL::join('jadwal_pbl', 'penilaian_pbl.jadwal_pbl_id', '=', 'jadwal_pbl.id')
                ->whereIn('jadwal_pbl.semester_id', $semesterIds)
                ->selectRaw('COUNT(*) as total_assessments, COUNT(CASE WHEN penilaian_pbl.tanggal_paraf IS NOT NULL THEN 1 END) as completed_assessments, AVG((penilaian_pbl.nilai_a + penilaian_pbl.nilai_b + penilaian_pbl.nilai_c + penilaian_pbl.nilai_d + penilaian_pbl.nilai_e + penilaian_pbl.nilai_f + penilaian_pbl.nilai_g) / 7) as average_score')
                ->first();

            $journalStats = PenilaianJurnal::join('jadwal_jurnal_reading', 'penilaian_jurnal.jurnal_reading_id', '=', 'jadwal_jurnal_reading.id')
                ->whereIn('jadwal_jurnal_reading.semester_id', $semesterIds)
                ->selectRaw('COUNT(*) as total_assessments, COUNT(CASE WHEN penilaian_jurnal.tanggal_paraf IS NOT NULL THEN 1 END) as completed_assessments, AVG((penilaian_jurnal.nilai_keaktifan + penilaian_jurnal.nilai_laporan) / 2) as average_score')
                ->first();

            $totalAssessments = ($pblStats->total_assessments ?? 0) + ($journalStats->total_assessments ?? 0);
            $completedAssessments = ($pblStats->completed_assessments ?? 0) + ($journalStats->completed_assessments ?? 0);
            $completionRate = $totalAssessments > 0 ? round(($completedAssessments / $totalAssessments) * 100, 1) : 0;

            return [
                'completion_rate' => $completionRate,
                'average_score' => round((($pblStats->average_score ?? 0) + ($journalStats->average_score ?? 0)) / 2, 1),
                'total_assessments' => $totalAssessments,
                'completed_assessments' => $completedAssessments
            ];
        } catch (\Exception $e) {
            return ['completion_rate' => 0, 'average_score' => 0, 'total_assessments' => 0, 'completed_assessments' => 0];
        }
    }

    private function getTodaySchedule(): array
    {
        try {
            $today = Carbon::today();
            $kuliahBesar = JadwalKuliahBesar::with(['mataKuliah', 'dosen', 'ruangan'])->whereDate('tanggal', $today)->get()->map(fn($item) => ['type' => 'Kuliah Besar', 'mata_kuliah' => $item->mataKuliah->nama ?? 'Unknown', 'dosen' => $item->dosen->name ?? 'Unknown', 'ruangan' => $item->ruangan->nama ?? 'Unknown', 'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai]);
            $pbl = JadwalPBL::with(['mataKuliah', 'dosen', 'ruangan'])->whereDate('tanggal', $today)->get()->map(fn($item) => ['type' => 'PBL', 'mata_kuliah' => $item->mataKuliah->nama ?? 'Unknown', 'dosen' => $item->dosen->name ?? 'Unknown', 'ruangan' => $item->ruangan->nama ?? 'Unknown', 'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai]);
            return $kuliahBesar->concat($pbl)->take(10)->values()->toArray();
        } catch (\Exception $e) { return []; }
    }

    private function getRecentAcademicActivities(): array
    {
        try {
            return Activity::with('causer')->latest()->limit(10)->get()->map(fn($activity) => [
                'user' => $activity->causer->name ?? 'System',
                'action' => $this->formatActivityDescription($activity->description),
                'target' => class_basename($activity->subject_type),
                'timestamp' => $activity->created_at ? $activity->created_at->diffForHumans() : '',
                'type' => $this->getActivityType($activity->description)
            ])->toArray();
        } catch (\Exception $e) { return []; }
    }

    private function getAcademicNotifications(): array
    {
        return [];
    }

    private function getAcademicOverview(): array
    {
        try {
            $currentTA = TahunAjaran::where('aktif', true)->first();
            $currentSem = Semester::where('aktif', true)->first();
            return [
                'current_semester' => $currentSem->jenis ?? 'N/A',
                'current_tahun_ajaran' => $currentTA->tahun ?? 'N/A',
                'semester_progress' => $this->calculateSemesterProgress(),
                'active_blocks' => $this->getActiveBlocks(),
                'upcoming_deadlines' => []
            ];
        } catch (\Exception $e) { return []; }
    }

    private function calculateSemesterProgress(): int
    {
        try {
            $sem = Semester::where('aktif', true)->first();
            if (!$sem || !$sem->tanggal_mulai || !$sem->tanggal_akhir) return 0;
            $start = Carbon::parse($sem->tanggal_mulai);
            $end = Carbon::parse($sem->tanggal_akhir);
            $today = Carbon::today();
            if ($today->lt($start)) return 0;
            if ($today->gt($end)) return 100;
            return (int) round(($start->diffInDays($today) / max(1, $start->diffInDays($end))) * 100);
        } catch (\Exception $e) { return 0; }
    }

    private function getActiveBlocks(): array
    {
        try { return MataKuliah::whereNotNull('blok')->distinct()->pluck('blok')->sort()->values()->toArray(); } catch (\Exception $e) { return []; }
    }

    private function getScheduleStats(string $semester = 'reguler'): array
    {
        try {
            $ids = $this->getSemesterIdsForType($semester);
            return [
                'kuliah_besar' => JadwalKuliahBesar::whereIn('semester_id', $ids)->count(),
                'pbl' => JadwalPBL::whereIn('semester_id', $ids)->count(),
                'jurnal_reading' => JadwalJurnalReading::whereIn('semester_id', $ids)->count(),
                'csr' => JadwalCSR::whereIn('semester_id', $ids)->count(),
                'praktikum' => JadwalPraktikum::whereIn('semester_id', $ids)->count(),
                'non_blok' => JadwalNonBlokNonCSR::whereIn('semester_id', $ids)->count(),
                'agenda_khusus' => JadwalAgendaKhusus::whereIn('semester_id', $ids)->count(),
            ];
        } catch (\Exception $e) { return []; }
    }

    private function getLowAttendanceAlerts(): array { return []; }
    private function getPraktikumPendingAbsensi(): array { return []; }

    private function getSemesterIdsForType(string $type): array
    {
        $ta = TahunAjaran::where('aktif', true)->first();
        if (!$ta) return [];
        $query = $ta->semesters();
        if ($type === 'reguler') $query->whereIn('jenis', ['Ganjil', 'Genap']);
        else if ($type === 'antara') $query->where('jenis', 'Antara');
        return $query->pluck('id')->toArray();
    }

    private function formatActivityDescription(string $desc): string
    {
        $map = ['created' => 'membuat', 'updated' => 'mengupdate', 'deleted' => 'menghapus', 'login' => 'login', 'logout' => 'logout'];
        return $map[$desc] ?? $desc;
    }

    private function getActivityType(string $desc): string
    {
        $map = ['created' => 'create', 'updated' => 'update', 'deleted' => 'delete', 'login' => 'login', 'logout' => 'login'];
        return $map[$desc] ?? 'other';
    }

    public function getAttendanceByMataKuliah(): JsonResponse
    {
        try {
            $ta = TahunAjaran::where('aktif', true)->first();
            if (!$ta) return response()->json([]);
            $ids = $ta->semesters()->pluck('id')->toArray();
            $data = MataKuliah::whereHas('semesters', fn($q) => $q->whereIn('id', $ids))->get()->map(function($mk) {
                $pbl = AbsensiPBL::withoutGlobalScope('activeSemester')->where('mata_kuliah_kode', $mk->kode)->selectRaw('COUNT(*) as total, SUM(CASE WHEN hadir = 1 THEN 1 ELSE 0 END) as attended')->first();
                return ['kode' => $mk->kode, 'nama' => $mk->nama, 'pbl_attendance_rate' => $pbl->total > 0 ? round(($pbl->attended / $pbl->total) * 100, 1) : 0];
            })->sortByDesc('pbl_attendance_rate')->values();
            return response()->json($data);
        } catch (\Exception $e) { return response()->json(['error' => $e->getMessage()], 500); }
    }

    public function getAssessmentProgress(): JsonResponse
    {
        try {
            $ta = TahunAjaran::where('aktif', true)->first();
            if (!$ta) return response()->json([]);
            $ids = $ta->semesters()->pluck('id')->toArray();
            $data = MataKuliah::whereHas('semesters', fn($q) => $q->whereIn('id', $ids))->get()->map(function($mk) {
                $pbl = PenilaianPBL::where('mata_kuliah_kode', $mk->kode)->selectRaw('COUNT(*) as total, COUNT(CASE WHEN tanggal_paraf IS NOT NULL THEN 1 END) as completed')->first();
                return ['kode' => $mk->kode, 'nama' => $mk->nama, 'pbl_completion_rate' => $pbl->total > 0 ? round(($pbl->completed / $pbl->total) * 100, 1) : 0, 'total_pbl_assessments' => $pbl->total];
            })->filter(fn($i) => $i['total_pbl_assessments'] > 0)->sortByDesc('pbl_completion_rate')->values();
            return response()->json($data);
        } catch (\Exception $e) { return response()->json(['error' => $e->getMessage()], 500); }
    }

    public function getAttendance(Request $request): JsonResponse
    {
        $semester = $request->get('semester', 'reguler');
        return response()->json([
            'attendanceStats' => $this->getAttendanceStats($semester)
        ]);
    }

    public function getAssessment(Request $request): JsonResponse
    {
        $semester = $request->get('semester', 'reguler');
        return response()->json([
            'assessmentStats' => $this->getAssessmentStats($semester)
        ]);
    }

    public function getSchedule(Request $request): JsonResponse
    {
        $semester = $request->get('semester', 'reguler');
        return response()->json([
            'scheduleStats' => $this->getScheduleStats($semester)
        ]);
    }
}
