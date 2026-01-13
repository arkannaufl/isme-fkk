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
use App\Models\TahunAjaran;
use App\Models\Semester;


use App\Models\Notification;
use Spatie\Activitylog\Models\Activity;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
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
            // Optimize: Cache statistics untuk mengurangi database load saat banyak user akses bersamaan
            // Get user statistics dengan caching (5 menit TTL)
            $totalUsers = Cache::remember('stats_total_users', 300, function () {
                return User::count();
            });
            $totalMahasiswa = Cache::remember('stats_total_mahasiswa', 300, function () {
                return User::where('role', 'mahasiswa')->count();
            });
            $totalDosen = Cache::remember('stats_total_dosen', 300, function () {
                return User::where('role', 'dosen')->count();
            });
            $totalTimAkademik = Cache::remember('stats_total_tim_akademik', 300, function () {
                return User::where('role', 'tim_akademik')->count();
            });
            $totalSuperAdmin = Cache::remember('stats_total_super_admin', 300, function () {
                return User::where('role', 'super_admin')->count();
            });

            // Get academic statistics dengan caching
            $totalMataKuliah = Cache::remember('stats_total_mata_kuliah_active', 300, function () {
                $activeTA = TahunAjaran::where('aktif', true)->first();
                if (!$activeTA) return 0;
                return $activeTA->mataKuliah()->count();
            });
            // Kelas feature removed - using kelompok kecil directly
            $totalRuangan = Cache::remember('stats_total_ruangan', 300, function () {
                return Ruangan::count();
            });

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

            // Get Super Admin list with caching
            $superAdmins = Cache::remember('super_admins_list', 600, function () {
                return User::where('role', 'super_admin')
                    ->select('id', 'name', 'email', 'username', 'created_at', 'is_logged_in')
                    ->orderBy('created_at', 'desc')
                    ->get();
            });

            return response()->json([
                'totalUsers' => $totalUsers,
                'totalMahasiswa' => $totalMahasiswa,
                'totalDosen' => $totalDosen,
                'totalTimAkademik' => $totalTimAkademik,
                'totalSuperAdmin' => $totalSuperAdmin,
                'superAdmins' => $superAdmins,
                'totalMataKuliah' => $totalMataKuliah,
                // 'totalKelas' removed - Kelas feature no longer exists
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
            // Cache recent activities for 1 minute to reduce database load
            $activities = Cache::remember('recent_activities', 60, function () {
                return Activity::with('causer:id,name,role')
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
            // Hapus logika ini karena menggunakan Kelas yang sudah dihapus
            // TODO: Implementasi ulang jika diperlukan menggunakan kelompok_kecil
            $studentsWithLowAttendance = 0;
            
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
            $cacheKey = 'today_schedule_' . $today->format('Y-m-d');
            
            // Cache today's schedule for 5 minutes
            return Cache::remember($cacheKey, 300, function () use ($today) {
                // Get today's schedules from different types with eager loading
                $kuliahBesar = JadwalKuliahBesar::with([
                    'mataKuliah:kode,nama',
                    'dosen:id,name',
                    'ruangan:id,nama'
                ])
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
                
                $pbl = JadwalPBL::with([
                    'mataKuliah:kode,nama',
                    'dosen:id,name',
                    'ruangan:id,nama'
                ])
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
                
                $journal = JadwalJurnalReading::with([
                    'mataKuliah:kode,nama',
                    'dosen:id,name',
                    'ruangan:id,nama'
                ])
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
            });
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
            
            $activeTA = TahunAjaran::where('aktif', true)->first();
            $currentMataKuliah = $activeTA ? $activeTA->mataKuliah()->count() : 0;
            
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

    /**
     * Get comprehensive system monitoring metrics
     * Includes: database connections, queue length, response time, memory, CPU
     * This is a more detailed version than getSystemMetrics()
     */
    public function getDetailedMonitoringMetrics(): JsonResponse
    {
        try {
            // Enable query logging for accurate query count
            DB::enableQueryLog();
            
            $metrics = [
                'timestamp' => now()->toISOString(),
                'database' => $this->getDatabaseMetrics(),
                'queue' => $this->getQueueMetrics(),
                'performance' => $this->getPerformanceMetrics(),
                'system' => $this->getSystemResourceMetrics(),
                'cache' => $this->getCacheMetrics(),
            ];

            return response()->json($metrics);
        } catch (\Exception $e) {
            \Log::error('Error fetching monitoring metrics: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to fetch monitoring metrics',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get database connection pool metrics
     */
    private function getDatabaseMetrics(): array
    {
        try {
            $connection = DB::connection();
            $pdo = $connection->getPdo();
            
            // Get MySQL connection status
            $status = DB::select("SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running', 'Max_used_connections', 'Max_connections')");
            $statusMap = [];
            foreach ($status as $row) {
                $statusMap[$row->Variable_name] = (int) $row->Value;
            }

            // Get current connections
            $currentConnections = $statusMap['Threads_connected'] ?? 0;
            $maxConnections = $statusMap['Max_connections'] ?? 500;
            $runningThreads = $statusMap['Threads_running'] ?? 0;
            $maxUsedConnections = $statusMap['Max_used_connections'] ?? 0;

            // Calculate connection pool usage percentage
            $connectionUsagePercent = $maxConnections > 0 
                ? round(($currentConnections / $maxConnections) * 100, 2) 
                : 0;

            // Get slow queries count (if slow query log is enabled)
            $slowQueries = DB::select("SHOW STATUS WHERE Variable_name = 'Slow_queries'");
            $slowQueriesCount = $slowQueries[0]->Value ?? 0;

            // Get table locks
            $tableLocks = DB::select("SHOW STATUS WHERE Variable_name IN ('Table_locks_waited', 'Table_locks_immediate')");
            $locksMap = [];
            foreach ($tableLocks as $row) {
                $locksMap[$row->Variable_name] = (int) $row->Value;
            }

            return [
                'current_connections' => $currentConnections,
                'max_connections' => $maxConnections,
                'connection_usage_percent' => $connectionUsagePercent,
                'running_threads' => $runningThreads,
                'max_used_connections' => $maxUsedConnections,
                'slow_queries' => (int) $slowQueriesCount,
                'table_locks_waited' => $locksMap['Table_locks_waited'] ?? 0,
                'table_locks_immediate' => $locksMap['Table_locks_immediate'] ?? 0,
                'status' => $connectionUsagePercent > 80 ? 'warning' : ($connectionUsagePercent > 90 ? 'critical' : 'healthy'),
            ];
        } catch (\Exception $e) {
            \Log::error('Error fetching database metrics: ' . $e->getMessage());
            return [
                'error' => 'Unable to fetch database metrics',
                'status' => 'error'
            ];
        }
    }

    /**
     * Get queue metrics
     */
    private function getQueueMetrics(): array
    {
        try {
            $queueConnection = config('queue.default');
            
            if ($queueConnection === 'redis') {
                $redis = \Illuminate\Support\Facades\Redis::connection();
                
                // Get queue length from Redis
                $defaultQueue = config('queue.connections.redis.queue', 'default');
                $queueLength = $redis->llen("queues:{$defaultQueue}");
                
                // Get failed jobs count
                $failedJobs = DB::table('failed_jobs')->count();
                
                // Get processing jobs (if using Laravel Horizon or similar)
                $processingJobs = 0;
                try {
                    $processingJobs = $redis->llen("queues:{$defaultQueue}:reserved");
                } catch (\Exception $e) {
                    // Horizon might not be installed
                }

                return [
                    'queue_length' => $queueLength,
                    'processing_jobs' => $processingJobs,
                    'failed_jobs' => $failedJobs,
                    'queue_connection' => $queueConnection,
                    'status' => $queueLength > 1000 ? 'warning' : ($queueLength > 5000 ? 'critical' : 'healthy'),
                ];
            } else {
                // Database queue
                $queueLength = DB::table('jobs')->count();
                $failedJobs = DB::table('failed_jobs')->count();
                
                return [
                    'queue_length' => $queueLength,
                    'processing_jobs' => 0,
                    'failed_jobs' => $failedJobs,
                    'queue_connection' => $queueConnection,
                    'status' => $queueLength > 1000 ? 'warning' : ($queueLength > 5000 ? 'critical' : 'healthy'),
                ];
            }
        } catch (\Exception $e) {
            \Log::error('Error fetching queue metrics: ' . $e->getMessage());
            return [
                'error' => 'Unable to fetch queue metrics',
                'status' => 'error'
            ];
        }
    }

    /**
     * Get performance metrics (response time, memory)
     */
    private function getPerformanceMetrics(): array
    {
        try {
            $memoryUsage = memory_get_usage(true);
            $memoryPeak = memory_get_peak_usage(true);
            $memoryLimit = ini_get('memory_limit');
            $memoryLimitBytes = $this->convertToBytes($memoryLimit);
            
            $memoryUsagePercent = $memoryLimitBytes > 0 
                ? round(($memoryUsage / $memoryLimitBytes) * 100, 2) 
                : 0;

            // Get execution time (if LARAVEL_START is defined)
            $executionTime = defined('LARAVEL_START') 
                ? round((microtime(true) - LARAVEL_START) * 1000, 2) // Convert to milliseconds
                : 0;

            // Get query count
            $queryCount = DB::getQueryLog() ? count(DB::getQueryLog()) : 0;

            return [
                'memory_usage_mb' => round($memoryUsage / 1024 / 1024, 2),
                'memory_peak_mb' => round($memoryPeak / 1024 / 1024, 2),
                'memory_limit' => $memoryLimit,
                'memory_usage_percent' => $memoryUsagePercent,
                'execution_time_ms' => $executionTime,
                'query_count' => $queryCount,
                'status' => $memoryUsagePercent > 80 ? 'warning' : ($memoryUsagePercent > 90 ? 'critical' : 'healthy'),
            ];
        } catch (\Exception $e) {
            \Log::error('Error fetching performance metrics: ' . $e->getMessage());
            return [
                'error' => 'Unable to fetch performance metrics',
                'status' => 'error'
            ];
        }
    }

    /**
     * Get system resource metrics (CPU, uptime)
     */
    private function getSystemResourceMetrics(): array
    {
        try {
            $uptime = $this->getSystemUptime();
            
            // Get CPU usage (Linux only)
            $cpuUsage = null;
            $cpuLoad = null;
            
            if (PHP_OS_FAMILY === 'Linux') {
                try {
                    // Get CPU load average
                    $loadAvg = sys_getloadavg();
                    if ($loadAvg !== false) {
                        $cpuLoad = [
                            '1min' => round($loadAvg[0], 2),
                            '5min' => round($loadAvg[1], 2),
                            '15min' => round($loadAvg[2], 2),
                        ];
                    }

                    // Try to get CPU usage percentage (requires /proc/stat)
                    if (file_exists('/proc/stat')) {
                        $stat1 = file_get_contents('/proc/stat');
                        usleep(100000); // Wait 100ms
                        $stat2 = file_get_contents('/proc/stat');
                        
                        preg_match('/cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/', $stat1, $matches1);
                        preg_match('/cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/', $stat2, $matches2);
                        
                        if (isset($matches1[1]) && isset($matches2[1])) {
                            $total1 = array_sum(array_slice($matches1, 1));
                            $total2 = array_sum(array_slice($matches2, 1));
                            $idle1 = $matches1[4];
                            $idle2 = $matches2[4];
                            
                            $totalDiff = $total2 - $total1;
                            $idleDiff = $idle2 - $idle1;
                            
                            if ($totalDiff > 0) {
                                $cpuUsage = round((1 - ($idleDiff / $totalDiff)) * 100, 2);
                            }
                        }
                    }
                } catch (\Exception $e) {
                    // CPU metrics not available
                }
            }

            return [
                'uptime' => $uptime,
                'cpu_usage_percent' => $cpuUsage,
                'cpu_load' => $cpuLoad,
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'os' => PHP_OS,
                'status' => ($cpuUsage !== null && $cpuUsage > 80) ? 'warning' : (($cpuUsage !== null && $cpuUsage > 90) ? 'critical' : 'healthy'),
            ];
        } catch (\Exception $e) {
            \Log::error('Error fetching system metrics: ' . $e->getMessage());
            return [
                'error' => 'Unable to fetch system metrics',
                'status' => 'error'
            ];
        }
    }

    /**
     * Get cache metrics
     */
    private function getCacheMetrics(): array
    {
        try {
            $cacheDriver = config('cache.default');
            $cacheStats = [];

            if ($cacheDriver === 'redis') {
                try {
                    $redis = \Illuminate\Support\Facades\Redis::connection();
                    $info = $redis->info('stats');
                    
                    $cacheStats = [
                        'driver' => $cacheDriver,
                        'hits' => $info['keyspace_hits'] ?? 0,
                        'misses' => $info['keyspace_misses'] ?? 0,
                        'hit_rate' => 0,
                    ];
                    
                    $total = ($cacheStats['hits'] + $cacheStats['misses']);
                    if ($total > 0) {
                        $cacheStats['hit_rate'] = round(($cacheStats['hits'] / $total) * 100, 2);
                    }
                } catch (\Exception $e) {
                    $cacheStats = [
                        'driver' => $cacheDriver,
                        'error' => 'Unable to fetch Redis cache stats',
                    ];
                }
            } else {
                $cacheStats = [
                    'driver' => $cacheDriver,
                    'note' => 'Cache stats not available for ' . $cacheDriver . ' driver',
                ];
            }

            return $cacheStats;
        } catch (\Exception $e) {
            \Log::error('Error fetching cache metrics: ' . $e->getMessage());
            return [
                'error' => 'Unable to fetch cache metrics',
                'status' => 'error'
            ];
        }
    }

    /**
     * Convert memory limit string to bytes
     */
    private function convertToBytes(string $memoryLimit): int
    {
        $memoryLimit = trim($memoryLimit);
        $last = strtolower($memoryLimit[strlen($memoryLimit) - 1]);
        $value = (int) $memoryLimit;

        switch ($last) {
            case 'g':
                $value *= 1024;
            case 'm':
                $value *= 1024;
            case 'k':
                $value *= 1024;
        }

        return $value;
    }
}
