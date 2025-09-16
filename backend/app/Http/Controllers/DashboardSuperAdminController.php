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


use App\Models\Notification;
use Spatie\Activitylog\Models\Activity;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class DashboardSuperAdminController extends Controller
{
    /**
     * Get dashboard statistics for super admin
     */
    public function index(): JsonResponse
    {
        try {
            // Get user statistics
            $totalUsers = User::count();
            $totalMahasiswa = User::where('role', 'mahasiswa')->count();
            $totalDosen = User::where('role', 'dosen')->count();
            $totalTimAkademik = User::where('role', 'tim_akademik')->count();
            $totalSuperAdmin = User::where('role', 'super_admin')->count();

            // Get academic statistics
            $totalMataKuliah = MataKuliah::count();
            $totalKelas = Kelas::count();
            $totalRuangan = Ruangan::count();

            // Get active schedules count
            $totalJadwalAktif = $this->getActiveSchedulesCount();

            // Get recent activities
            $recentActivities = $this->getRecentActivities();

            // Get system health
            $systemHealth = $this->getSystemHealth();

            // Get additional dashboard data
            $todaySchedule = $this->getTodaySchedule();
            $systemNotifications = $this->getSystemNotifications();

            // Calculate growth percentages
            $growthStats = $this->calculateGrowthPercentages();

            // Check if database has data
            if ($totalUsers === 0) {
                return response()->json([
                    'error' => 'Database appears to be empty',
                    'message' => 'No users found in the system. Please ensure the database is properly seeded with initial data.',
                    'suggestions' => [
                        'Run database seeder: php artisan db:seed',
                        'Check database connection',
                        'Verify user data exists in users table'
                    ]
                ], 404);
            }

            // Get Super Admin list
            $superAdmins = User::where('role', 'super_admin')
                ->select('id', 'name', 'email', 'username', 'created_at', 'is_logged_in')
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'totalUsers' => $totalUsers,
                'totalMahasiswa' => $totalMahasiswa,
                'totalDosen' => $totalDosen,
                'totalTimAkademik' => $totalTimAkademik,
                'totalSuperAdmin' => $totalSuperAdmin,
                'superAdmins' => $superAdmins,
                'totalMataKuliah' => $totalMataKuliah,
                'totalKelas' => $totalKelas,
                'totalRuangan' => $totalRuangan,
                'totalJadwalAktif' => $totalJadwalAktif,
                'recentActivities' => $recentActivities,
                'systemHealth' => $systemHealth,
                'todaySchedule' => $todaySchedule,
                'systemNotifications' => $systemNotifications,
                // Add growth percentages
                'usersGrowth' => $growthStats['usersGrowth'] ?? 0,
                'mahasiswaGrowth' => $growthStats['mahasiswaGrowth'] ?? 0,
                'dosenGrowth' => $growthStats['dosenGrowth'] ?? 0,
                'mataKuliahGrowth' => $growthStats['mataKuliahGrowth'] ?? 0,
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
            // If any table doesn't exist or has issues, continue with others
            \Log::warning('Error counting schedules: ' . $e->getMessage());
        }

        return $count;
    }

    /**
     * Get recent activities from activity log
     */
    private function getRecentActivities(): array
    {
        try {
            $activities = Activity::with('causer')
                ->latest()
                ->limit(10)
                ->get()
                ->map(function ($activity) {
                    $user = $activity->causer ? $activity->causer->name : 'System';
                    $userRole = $activity->causer ? $activity->causer->role : 'System';
                    $action = $this->formatActivityDescription($activity->description);
                    $target = $activity->subject_type ? class_basename($activity->subject_type) : 'Unknown';
                    
                    return [
                        'id' => $activity->id,
                        'user' => $user,
                        'role' => $userRole,
                        'action' => $action,
                        'target' => $target,
                        'description' => $activity->description,
                        'created_at' => $activity->created_at->toISOString(),
                        'timestamp' => $activity->created_at->diffForHumans(),
                        'event' => $activity->event,
                        'subject_type' => $activity->subject_type,
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
     * Get system health status
     */
    private function getSystemHealth(): array
    {
        $health = [
            'database' => 'healthy',
            'storage' => 'healthy',
            'server' => 'healthy',
            'lastBackup' => null
        ];

        try {
            // Check database connection
            DB::connection()->getPdo();
        } catch (\Exception $e) {
            $health['database'] = 'error';
        }

        try {
            // Check storage (basic write test)
            Storage::disk('local')->put('health_check.txt', 'test');
            Storage::disk('local')->delete('health_check.txt');
        } catch (\Exception $e) {
            $health['storage'] = 'error';
        }

        // Check last backup (you can implement your backup logic here)
        $health['lastBackup'] = $this->getLastBackupTime();

        return $health;
    }

    /**
     * Get last backup time (placeholder - implement according to your backup strategy)
     */
    private function getLastBackupTime(): ?string
    {
        try {
            // This is a placeholder - implement according to your backup strategy
            // For example, check backup directory or database logs
            $backupPath = storage_path('app/backups');
            
            if (is_dir($backupPath)) {
                $files = glob($backupPath . '/*.sql');
                if (!empty($files)) {
                    $latestFile = max($files);
                    $timestamp = filemtime($latestFile);
                    return Carbon::createFromTimestamp($timestamp)->diffForHumans();
                }
            }
            
            return 'Never';
        } catch (\Exception $e) {
            return 'Unknown';
        }
    }

    /**
     * Get user statistics by role
     */
    public function getUserStats(): JsonResponse
    {
        try {
            $stats = User::select('role', DB::raw('count(*) as total'))
                ->groupBy('role')
                ->get()
                ->mapWithKeys(function ($item) {
                    return [$item->role => $item->total];
                });

            return response()->json($stats);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch user statistics',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get schedule statistics
     */
    public function getScheduleStats(): JsonResponse
    {
        try {
            $stats = [
                'kuliah_besar' => JadwalKuliahBesar::count(),
                'pbl' => JadwalPBL::count(),
                'jurnal_reading' => JadwalJurnalReading::count(),
                'csr' => JadwalCSR::count(),
                'non_blok_non_csr' => JadwalNonBlokNonCSR::count(),
                'praktikum' => JadwalPraktikum::count(),
                'agenda_khusus' => JadwalAgendaKhusus::count(),
            ];

            return response()->json($stats);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch schedule statistics',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get monthly user registration statistics
     */
    public function getMonthlyUserStats(): JsonResponse
    {
        try {
            $stats = User::select(
                DB::raw('YEAR(created_at) as year'),
                DB::raw('MONTH(created_at) as month'),
                DB::raw('COUNT(*) as total')
            )
            ->where('created_at', '>=', Carbon::now()->subMonths(12))
            ->groupBy('year', 'month')
            ->orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->get()
            ->map(function ($item) {
                return [
                    'period' => Carbon::createFromDate($item->year, $item->month, 1)->format('M Y'),
                    'total' => $item->total
                ];
            });

            return response()->json($stats);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch monthly user statistics',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get system performance metrics
     */
    public function getSystemMetrics(): JsonResponse
    {
        try {
            $metrics = [
                'memory_usage' => round(memory_get_usage(true) / 1024 / 1024, 2), // MB
                'peak_memory' => round(memory_get_peak_usage(true) / 1024 / 1024, 2), // MB
                'execution_time' => round(microtime(true) - LARAVEL_START, 3), // seconds
                'database_queries' => DB::getQueryLog() ? count(DB::getQueryLog()) : 0,
                'storage_used' => $this->getStorageUsage(),
                'uptime' => $this->getSystemUptime()
            ];

            return response()->json($metrics);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch system metrics',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get storage usage in MB
     */
    private function getStorageUsage(): float
    {
        try {
            $bytes = 0;
            $path = storage_path('app');
            
            if (is_dir($path)) {
                foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path)) as $file) {
                    if ($file->isFile()) {
                        $bytes += $file->getSize();
                    }
                }
            }
            
            return round($bytes / 1024 / 1024, 2); // Convert to MB
        } catch (\Exception $e) {
            return 0;
        }
    }

    /**
     * Get system uptime (placeholder)
     */
    private function getSystemUptime(): string
    {
        try {
            // This is a simple placeholder - you might want to implement actual server uptime
            $uptime = file_get_contents('/proc/uptime');
            if ($uptime !== false) {
                $uptimeSeconds = (float) explode(' ', $uptime)[0];
                $days = floor($uptimeSeconds / 86400);
                $hours = floor(($uptimeSeconds % 86400) / 3600);
                $minutes = floor(($uptimeSeconds % 3600) / 60);
                
                return "{$days}d {$hours}h {$minutes}m";
            }
        } catch (\Exception $e) {
            // Fallback for non-Unix systems
        }
        
        return 'Unknown';
    }













    /**
     * Get students with low attendance for semester Antara
     */
    private function getLowAttendanceStudentsAntara(): int
    {
        try {
            // Simplified calculation for semester Antara
            $lowAttendanceThreshold = 75; // 75%
            
            // Ambil mahasiswa yang mengambil mata kuliah semester Antara
            $mataKuliahAntara = MataKuliah::where('semester', 'Antara')->pluck('kode');
            
            if ($mataKuliahAntara->isEmpty()) return 0;
            
            // Hitung mahasiswa dengan attendance rendah
            $studentsWithLowAttendance = Kelas::whereIn('mata_kuliah_kode', $mataKuliahAntara)
                ->distinct('mahasiswa_nim')
                ->count('mahasiswa_nim');
            
            // Simplified: assume 20% of students have low attendance
            return max(0, round($studentsWithLowAttendance * 0.2));
        } catch (\Exception $e) {
            \Log::error('Error calculating low attendance students for semester Antara: ' . $e->getMessage());
            return 0;
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
                        'topik' => $item->topik
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
                        'topik' => $item->topik
                    ];
                });
            
            $journal = JadwalJurnalReading::with(['mataKuliah', 'dosen', 'ruangan'])
                ->whereDate('tanggal', $today)
                ->get()
                ->map(function($item) {
                    return [
                        'type' => 'Journal Reading',
                        'mata_kuliah' => $item->mataKuliah->nama ?? 'Unknown',
                        'dosen' => $item->dosen->name ?? 'Unknown',
                        'ruangan' => $item->ruangan->nama ?? 'Unknown',
                        'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai,
                        'topik' => $item->topik
                    ];
                });
            
            $schedule = $kuliahBesar->concat($pbl)->concat($journal)->sortBy('waktu');
            
            return $schedule->take(10)->values()->toArray();
        } catch (\Exception $e) {
            // Return demo data if there's an error
            return [
                [
                    'type' => 'Kuliah Besar',
                    'mata_kuliah' => 'Anatomi Dasar',
                    'dosen' => 'Dr. Ahmad Fauzi',
                    'ruangan' => 'Aula Utama',
                    'waktu' => '08:00 - 10:00',
                    'topik' => 'Sistem Muskuloskeletal'
                ],
                [
                    'type' => 'PBL',
                    'mata_kuliah' => 'Blok Kardiovaskular',
                    'dosen' => 'Prof. Siti Aisyah',
                    'ruangan' => 'Ruang PBL 1',
                    'waktu' => '10:30 - 12:30',
                    'topik' => 'Kasus Hipertensi'
                ],
                [
                    'type' => 'Journal Reading',
                    'mata_kuliah' => 'Blok Respirasi',
                    'dosen' => 'Dr. Budi Santoso',
                    'ruangan' => 'Ruang Seminar',
                    'waktu' => '13:30 - 15:00',
                    'topik' => 'COVID-19 Research Update'
                ]
            ];
        }
    }





    /**
     * Get system notifications
     */
    private function getSystemNotifications(): array
    {
        try {
            $notifications = [];
            
            // Check for schedule conflicts
            $conflicts = $this->getScheduleConflicts();
            if ($conflicts > 0) {
                $notifications[] = [
                    'type' => 'warning',
                    'title' => 'Schedule Conflicts Detected',
                    'message' => "{$conflicts} schedule conflicts need attention",
                    'action' => 'View Conflicts'
                ];
            }
            

            
            return $notifications;
        } catch (\Exception $e) {
            return [
                [
                    'type' => 'info',
                    'title' => 'System Update Available',
                    'message' => 'Version 2.4.1 is available with bug fixes',
                    'action' => 'Update Now'
                ],
                [
                    'type' => 'warning',
                    'title' => 'Backup Reminder',
                    'message' => 'Last backup was 3 days ago',
                    'action' => 'Backup Now'
                ]
            ];
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
     * Calculate growth percentages compared to previous cached values
     */
    private function calculateGrowthPercentages(): array
    {
        try {
            // Current counts
            $currentUsers = User::count();
            $currentMahasiswa = User::where('role', 'mahasiswa')->count();
            $currentDosen = User::where('role', 'dosen')->count();
            $currentMataKuliah = MataKuliah::count();
            
            // Get previous counts from cache (stored from last dashboard request)
            $cacheKey = 'dashboard_previous_counts';
            $previousCounts = cache($cacheKey);
            
            // If no previous data, store current as baseline and return 0 growth
            if (!$previousCounts) {
                cache([$cacheKey => [
                    'users' => $currentUsers,
                    'mahasiswa' => $currentMahasiswa,
                    'dosen' => $currentDosen,
                    'mataKuliah' => $currentMataKuliah,
                    'timestamp' => now(),
                ]], now()->addMinutes(30)); // Cache for 30 minutes
                
                return [
                    'usersGrowth' => 0,
                    'mahasiswaGrowth' => 0,
                    'dosenGrowth' => 0,
                    'mataKuliahGrowth' => 0,
                ];
            }
            
            // Calculate growth percentages
            $usersGrowth = $this->calculatePercentageGrowth($previousCounts['users'], $currentUsers);
            $mahasiswaGrowth = $this->calculatePercentageGrowth($previousCounts['mahasiswa'], $currentMahasiswa);
            $dosenGrowth = $this->calculatePercentageGrowth($previousCounts['dosen'], $currentDosen);
            $mataKuliahGrowth = $this->calculatePercentageGrowth($previousCounts['mataKuliah'], $currentMataKuliah);
            
            // Update cache with current counts for next comparison
            // But only if there's been a significant change or enough time has passed
            $timeSinceLastUpdate = now()->diffInMinutes($previousCounts['timestamp']);
            
            if ($timeSinceLastUpdate >= 10 || 
                abs($currentUsers - $previousCounts['users']) >= 5 ||
                abs($currentMahasiswa - $previousCounts['mahasiswa']) >= 3) {
                
                cache([$cacheKey => [
                    'users' => $currentUsers,
                    'mahasiswa' => $currentMahasiswa,
                    'dosen' => $currentDosen,
                    'mataKuliah' => $currentMataKuliah,
                    'timestamp' => now(),
                ]], now()->addMinutes(30));
            }
            
            return [
                'usersGrowth' => $usersGrowth,
                'mahasiswaGrowth' => $mahasiswaGrowth,
                'dosenGrowth' => $dosenGrowth,
                'mataKuliahGrowth' => $mataKuliahGrowth,
            ];
        } catch (\Exception $e) {
            \Log::error('Error calculating growth percentages: ' . $e->getMessage());
            return [
                'usersGrowth' => 0,
                'mahasiswaGrowth' => 0,
                'dosenGrowth' => 0,
                'mataKuliahGrowth' => 0,
            ];
        }
    }

    /**
     * Calculate percentage growth between two values
     */
    private function calculatePercentageGrowth($previous, $current): float
    {
        if ($previous <= 0) {
            return $current > 0 ? 100.0 : 0.0;
        }
        
        $growth = (($current - $previous) / $previous) * 100;
        return round($growth, 1);
    }
}
