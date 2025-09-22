<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    /**
     * Get notifications for a specific user (dosen)
     */
    public function getUserNotifications($userId)
    {
        $user = Auth::user();
        
        // Users can only access their own notifications
        if ($user->id != $userId && $user->role !== 'super_admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Get both personal notifications and public notifications
        $notifications = Notification::where(function($query) use ($userId) {
            $query->where('user_id', $userId)
                  ->orWhere('user_id', null); // Public notifications
        })
        ->orderBy('created_at', 'desc')
        ->get();

        return response()->json($notifications);
    }

    /**
     * Get notifications for admin (super_admin)
     */
    public function getAdminNotifications($userId)
    {
        $user = User::findOrFail($userId);
        
        // Only super_admin can access admin notifications
        if ($user->role !== 'super_admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Get both personal notifications and public notifications
        $notifications = Notification::where(function($query) use ($userId) {
            $query->where('user_id', $userId)
                  ->orWhere('user_id', null); // Public notifications
        })
        ->orderBy('created_at', 'desc')
        ->get();

        return response()->json($notifications);
    }

    /**
     * Mark notification as read
     */
    public function markAsRead($notificationId)
    {
        $notification = Notification::findOrFail($notificationId);
        $user = Auth::user();
        
        // Super admin can mark any notification as read
        if ($user->role === 'super_admin') {
            $notification->update([
                'is_read' => true,
                'read_at' => now()
            ]);

            // Log activity
            activity()
                ->performedOn($notification)
                ->withProperties([
                    'notification_id' => $notification->id,
                    'title' => $notification->title,
                    'type' => $notification->type
                ])
                ->log('Notification marked as read: ' . $notification->title);
                
            return response()->json(['message' => 'Notification marked as read']);
        }
        
        // All authenticated users can mark any notification as read
        // This allows all roles (dosen, mahasiswa, tim_akademik, admin) to mark notifications as read
        $notification->update([
            'is_read' => true,
            'read_at' => now()
        ]);

        // Log activity
        activity()
            ->performedOn($notification)
            ->withProperties([
                'notification_id' => $notification->id,
                'title' => $notification->title,
                'type' => $notification->type
            ])
            ->log('Notification marked as read: ' . $notification->title);

        return response()->json(['message' => 'Notification marked as read']);
    }

    /**
     * Mark all notifications as read for a user
     */
    public function markAllAsRead($userId)
    {
        $user = Auth::user();
        
        // Super admin can mark all notifications as read
        if ($user->role === 'super_admin') {
            Notification::where('is_read', false)
                ->update([
                    'is_read' => true,
                    'read_at' => now()
                ]);
            return response()->json(['message' => 'All notifications marked as read']);
        }
        
        // Regular users can only mark their own notifications as read
        if ($userId != $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        Notification::where('user_id', $userId)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now()
            ]);

        return response()->json(['message' => 'All notifications marked as read']);
    }

    /**
     * Create notification for PBL assignment
     */
    public function createPBLAssignmentNotification($userId, $pblData)
    {
        $user = User::findOrFail($userId);
        
        $notification = Notification::create([
            'user_id' => $userId,
            'title' => 'Jadwal PBL Baru',
            'message' => "Anda telah di-assign untuk mengajar PBL {$pblData['mata_kuliah_nama']} - Modul {$pblData['modul_ke']}. Silakan konfirmasi ketersediaan Anda.",
            'type' => 'info',
            'data' => [
                'pbl_id' => $pblData['pbl_id'],
                'mata_kuliah_kode' => $pblData['mata_kuliah_kode'],
                'mata_kuliah_nama' => $pblData['mata_kuliah_nama'],
                'modul_ke' => $pblData['modul_ke'],
                'nama_modul' => $pblData['nama_modul'],
            ],
        ]);



        return $notification;
    }

    /**
     * Create consolidated notification for PBL block assignment
     */
    public function createPBLBlockAssignmentNotification($userId, $blockData)
    {
        $user = User::findOrFail($userId);
        
        // Format message yang lebih informatif
        // Semester disimpan sebagai integer: 1 = Ganjil, 2 = Genap
        $semesterText = '';
        if (is_numeric($blockData['semester'])) {
            $semesterText = $blockData['semester'] == 1 ? 'Semester Ganjil' : 'Semester Genap';
        } else {
            // Fallback untuk string (jika ada yang masih menggunakan format lama)
            $semesterText = $blockData['semester'] === 'ganjil' ? 'Semester Ganjil' : 'Semester Genap';
        }
        
        // Log untuk debugging
        \Log::info("Notification semester mapping", [
            'raw_semester' => $blockData['semester'],
            'semester_type' => gettype($blockData['semester']),
            'semester_text' => $semesterText,
            'is_numeric' => is_numeric($blockData['semester'])
        ]);
        
        $modulCount = count($blockData['moduls']);
        $kelompokCount = $blockData['total_kelompok'] ?? 0;
        
        $notification = Notification::create([
            'user_id' => $userId,
            'title' => "🎯 Assignment PBL Baru - Blok {$blockData['blok']} {$semesterText}",
            'message' => "Assignment PBL untuk Blok {$blockData['blok']} {$semesterText}", // Message disederhanakan
            'type' => 'info',
            'data' => [
                'blok' => $blockData['blok'],
                'tipe_peran' => $blockData['tipe_peran'],
                'mata_kuliah_kode' => $blockData['mata_kuliah_kode'],
                'mata_kuliah_nama' => $blockData['mata_kuliah_nama'],
                'moduls' => $blockData['moduls'],
                'total_kelompok' => $kelompokCount,
                // Field semester dihapus untuk menghindari inkonsistensi
            ],
        ]);



        return $notification;
    }

    /**
     * Get unread notifications count
     */
    public function getUnreadCount($userId)
    {
        $count = Notification::where(function($query) use ($userId) {
            $query->where('user_id', $userId)
                  ->orWhere('user_id', null); // Include public notifications
        })
        ->where('is_read', false)
        ->count();

        return response()->json(['count' => $count]);
    }

    /**
     * Get all notifications with read status for admin
     */
    public function getAllNotificationsForAdmin(Request $request)
    {
        // Check if user is admin or tim akademik
        if (!Auth::user() || !in_array(Auth::user()->role, ['admin', 'super_admin', 'tim_akademik'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Get search query
        $search = $request->get('search', '');
        $userType = $request->get('user_type', 'all'); // all, dosen, mahasiswa
        
        // Build query with search and user type filter
        $query = Notification::with('user');
        
        // Filter by user type - include public notifications for all types
        if ($userType === 'dosen') {
            $query->where(function($q) {
                $q->whereHas('user', function($userQuery) {
                    $userQuery->whereIn('role', ['dosen', 'koordinator', 'tim_blok', 'dosen_mengajar']);
                })->orWhere('user_id', null); // Include public notifications
            });
        } elseif ($userType === 'mahasiswa') {
            $query->where(function($q) {
                $q->whereHas('user', function($userQuery) {
                    $userQuery->where('role', 'mahasiswa');
                })->orWhere('user_id', null); // Include public notifications
            });
        }
        
        // Apply search filter
        if ($search) {
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('message', 'like', "%{$search}%")
                  ->orWhereHas('user', function($userQuery) use ($search) {
                      $userQuery->where('name', 'like', "%{$search}%");
                  });
            });
        }
        
        $notifications = $query->orderBy('created_at', 'desc')->get()
            ->map(function ($notification) {
                // Handle public notifications (user_id = null)
                if ($notification->user_id === null) {
                    return [
                        'id' => $notification->id,
                        'user_name' => 'Publik',
                        'user_id' => null,
                        'user_role' => 'public',
                        'user_type' => 'Publik',
                        'title' => $notification->title,
                        'message' => $notification->message,
                        'type' => $notification->type,
                        'is_read' => $notification->is_read,
                        'read_at' => $notification->read_at,
                        'created_at' => $notification->created_at,
                        'read_status' => $notification->is_read ? 'Sudah Dibaca' : 'Belum Dibaca',
                        'read_time' => $notification->read_at ? $notification->read_at->setTimezone('Asia/Jakarta')->format('d M Y, H:i') : '-',
                        'time_since_read' => $notification->read_at ? $notification->read_at->diffForHumans() : '-',
                        'created_time' => $notification->created_at->setTimezone('Asia/Jakarta')->format('d M Y, H:i'),
                        'created_time_ago' => $notification->created_at->diffForHumans(),
                        'data' => $notification->data
                    ];
                }
                
                // Handle regular notifications
                $userRole = $notification->user->role ?? 'unknown';
                $isDosen = in_array($userRole, ['dosen', 'koordinator', 'tim_blok', 'dosen_mengajar']);
                $userTypeLabel = $isDosen ? 'Dosen' : 'Mahasiswa';
                
                return [
                    'id' => $notification->id,
                    'user_name' => $notification->user->name ?? 'Unknown User',
                    'user_id' => $notification->user_id,
                    'user_role' => $userRole,
                    'user_type' => $userTypeLabel,
                    'title' => $notification->title,
                    'message' => $notification->message,
                    'type' => $notification->type,
                    'is_read' => $notification->is_read,
                    'read_at' => $notification->read_at,
                    'created_at' => $notification->created_at,
                    'read_status' => $notification->is_read ? 'Sudah Dibaca' : 'Belum Dibaca',
                    'read_time' => $notification->read_at ? $notification->read_at->setTimezone('Asia/Jakarta')->format('d M Y, H:i') : '-',
                    'time_since_read' => $notification->read_at ? $notification->read_at->diffForHumans() : '-',
                    'created_time' => $notification->created_at->setTimezone('Asia/Jakarta')->format('d M Y, H:i'),
                    'created_time_ago' => $notification->created_at->diffForHumans(),
                    'data' => $notification->data
                ];
            });

        return response()->json($notifications);
    }

    /**
     * Get notification statistics for admin dashboard
     */
    public function getNotificationStats(Request $request)
    {
        // Check if user is admin or tim akademik
        if (!Auth::user() || !in_array(Auth::user()->role, ['admin', 'super_admin', 'tim_akademik'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Get user type filter
        $userType = $request->get('user_type', 'all');
        
        // Build base query
        $baseQuery = Notification::query();
        
        // Apply user type filter
        if ($userType === 'dosen') {
            $baseQuery->whereHas('user', function($q) {
                $q->whereIn('role', ['dosen', 'koordinator', 'tim_blok', 'dosen_mengajar']);
            });
        } elseif ($userType === 'mahasiswa') {
            $baseQuery->whereHas('user', function($q) {
                $q->where('role', 'mahasiswa');
            });
        }
        
        // Clone queries for different counts
        $totalQuery = clone $baseQuery;
        $readQuery = clone $baseQuery;
        $unreadQuery = clone $baseQuery;
        $recentQuery = clone $baseQuery;
        $recentReadsQuery = clone $baseQuery;
        
        $totalNotifications = $totalQuery->count();
        $readNotifications = $readQuery->where('is_read', true)->count();
        $unreadNotifications = $unreadQuery->where('is_read', false)->count();
        
        // Get read rate percentage
        $readRate = $totalNotifications > 0 ? round(($readNotifications / $totalNotifications) * 100, 1) : 0;
        
        // Get recent activity (last 7 days)
        $recentNotifications = $recentQuery->where('created_at', '>=', now()->subDays(7))->count();
        $recentReads = $recentReadsQuery->where('read_at', '>=', now()->subDays(7))->count();
        
        // Get breakdown by user type
        $dosenNotifications = Notification::whereHas('user', function($q) {
            $q->whereIn('role', ['dosen', 'koordinator', 'tim_blok', 'dosen_mengajar']);
        })->count();
        
        $mahasiswaNotifications = Notification::whereHas('user', function($q) {
            $q->where('role', 'mahasiswa');
        })->count();

        // Get confirmation breakdown
        $bisaMengajar = Notification::where('title', 'like', '%Bisa Mengajar%')->count();
        $tidakBisaMengajar = Notification::where('title', 'like', '%Tidak Bisa Mengajar%')->count();
        $totalConfirmations = $bisaMengajar + $tidakBisaMengajar;

        return response()->json([
            'total_notifications' => $totalNotifications,
            'read_notifications' => $readNotifications,
            'unread_notifications' => $unreadNotifications,
            'read_rate_percentage' => $readRate,
            'recent_notifications' => $recentNotifications,
            'recent_reads' => $recentReads,
            'user_type_breakdown' => [
                'dosen' => $dosenNotifications,
                'mahasiswa' => $mahasiswaNotifications
            ],
            'confirmation_breakdown' => [
                'bisa_mengajar' => $bisaMengajar,
                'tidak_bisa_mengajar' => $tidakBisaMengajar,
                'total_confirmations' => $totalConfirmations
            ],
            'last_7_days' => [
                'notifications_sent' => $recentNotifications,
                'notifications_read' => $recentReads
            ]
        ]);
    }

    /**
     * Delete all notifications for a user
     */
    public function clearAllNotifications($userId)
    {
        // Check if user is clearing their own notifications
        if ($userId != Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $deleted = Notification::where('user_id', $userId)->delete();


        // Log activity

        activity()

            ->log('Notification deleted');


        // Log activity

        activity()

            ->log('Notification updated');


        // Log activity

        activity()

            ->log('Notification created');

        return response()->json([
            'message' => 'All notifications cleared',
            'deleted_count' => $deleted
        ]);
    }

    /**
     * Delete a specific notification
     */
    public function deleteNotification($notificationId)
    {
        $notification = Notification::findOrFail($notificationId);
        
        // Check if user owns this notification
        if ($notification->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $notification->delete();


        // Log activity

        activity()

            ->log('Notification deleted');


        // Log activity

        activity()

            ->log('Notification updated');


        // Log activity

        activity()

            ->log('Notification created');

        return response()->json(['message' => 'Notification deleted']);
    }

    /**
     * Ask dosen to teach again (minta dosen yang sama mengajar lagi)
     */
    public function askDosenAgain(Request $request)
    {
        $request->validate([
            'notification_id' => 'required|exists:notifications,id',
            'jadwal_id' => 'required|integer',
            'jadwal_type' => 'nullable|string'
        ]);

        try {
            $notification = Notification::findOrFail($request->notification_id);
            
            // Update notification status to pending
            $notification->update([
                'is_read' => false,
                'read_at' => null
            ]);


        // Log activity

        activity()

            ->log('Notification deleted');


        // Log activity

        activity()

            ->log('Notification updated');


        // Log activity

        activity()

            ->log('Notification created');

            // Determine jadwal_type from notification data or request
            $jadwalType = $request->jadwal_type;
            if (!$jadwalType && isset($notification->data['jadwal_type'])) {
                $jadwalType = $notification->data['jadwal_type'];
            }
            
            // If still no jadwal_type, try to determine from notification title/message
            if (!$jadwalType) {
                $title = strtolower($notification->title);
                if (strpos($title, 'pbl') !== false) {
                    $jadwalType = 'pbl';
                } elseif (strpos($title, 'kuliah besar') !== false) {
                    $jadwalType = 'kuliah_besar';
                } elseif (strpos($title, 'praktikum') !== false) {
                    $jadwalType = 'praktikum';
                } elseif (strpos($title, 'jurnal') !== false) {
                    $jadwalType = 'jurnal_reading';
                } elseif (strpos($title, 'csr') !== false) {
                    $jadwalType = 'csr';
                } elseif (strpos($title, 'non blok non csr') !== false) {
                    $jadwalType = 'non_blok_non_csr';
                }
            }
            
            if (!$jadwalType) {
                return response()->json([
                    'message' => 'Jenis jadwal tidak dapat ditentukan',
                    'error' => 'Field jadwal_type diperlukan untuk reset konfirmasi'
                ], 400);
            }

            // Reset confirmation status in the original schedule
            $this->resetScheduleConfirmationStatus($request->jadwal_id, $jadwalType, $notification->user_id);

            // Create new notification for the same dosen
            $newNotification = Notification::create([
                'user_id' => $notification->user_id,
                'title' => 'Konfirmasi Ulang Ketersediaan',
                'message' => 'Admin meminta Anda untuk mengkonfirmasi ulang ketersediaan mengajar pada jadwal yang sama.',
                'type' => 'info',
                'is_read' => false,
                'data' => $notification->data
            ]);


            // Log activity

            activity()

                ->log('Notification deleted');


            // Log activity

            activity()

                ->log('Notification updated');


            // Log activity

            activity()

                ->log('Notification created');

            return response()->json([
                'message' => 'Dosen diminta untuk konfirmasi ulang',
                'notification' => $newNotification
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal meminta dosen konfirmasi ulang',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reset confirmation status in the original schedule
     */
    private function resetScheduleConfirmationStatus($jadwalId, $jadwalType, $userId)
    {
        try {
            switch ($jadwalType) {
                case 'pbl':
                    $jadwal = \App\Models\JadwalPBL::find($jadwalId);
                    
                    if ($jadwal) {
                        // Cek apakah dosen memiliki akses
                        $hasAccess = false;
                        if ($jadwal->dosen_id == $userId) {
                            $hasAccess = true;
                        } elseif ($jadwal->dosen_ids && is_array($jadwal->dosen_ids) && !empty($jadwal->dosen_ids)) {
                            $hasAccess = in_array($userId, $jadwal->dosen_ids);
                        }
                        
                        if ($hasAccess) {
                            $jadwal->update([
                                'status_konfirmasi' => 'belum_konfirmasi',
                                'alasan_konfirmasi' => null
                            ]);
                            \Log::info("Reset PBL confirmation status for jadwal ID: {$jadwalId}, user ID: {$userId}");
                        } else {
                            \Log::warning("User {$userId} does not have access to PBL jadwal ID: {$jadwalId}");
                        }
                    } else {
                        \Log::warning("PBL jadwal ID: {$jadwalId} not found");
                    }
                    break;
                    
                case 'kuliah_besar':
                    $jadwal = \App\Models\JadwalKuliahBesar::where('id', $jadwalId)
                        ->where(function($query) use ($userId) {
                            $query->where('dosen_id', $userId)
                                  ->orWhereJsonContains('dosen_ids', $userId);
                        })
                        ->first();
                    
                    if ($jadwal) {
                        $jadwal->update([
                            'status_konfirmasi' => 'belum_konfirmasi',
                            'alasan_konfirmasi' => null
                        ]);
                    }
                    break;
                    
                case 'non_blok_non_csr':
                    $jadwal = \App\Models\JadwalNonBlokNonCSR::find($jadwalId);
                    
                    if ($jadwal) {
                        // Cek apakah dosen memiliki akses
                        $hasAccess = false;
                        if ($jadwal->dosen_id == $userId) {
                            $hasAccess = true;
                        } elseif ($jadwal->dosen_ids && is_array($jadwal->dosen_ids) && !empty($jadwal->dosen_ids)) {
                            $hasAccess = in_array($userId, $jadwal->dosen_ids);
                        }
                        
                        if ($hasAccess) {
                            $jadwal->update([
                                'status_konfirmasi' => 'belum_konfirmasi',
                                'alasan_konfirmasi' => null
                            ]);
                            \Log::info("Reset Non Blok Non CSR confirmation status for jadwal ID: {$jadwalId}, user ID: {$userId}");
                        } else {
                            \Log::warning("User {$userId} does not have access to Non Blok Non CSR jadwal ID: {$jadwalId}");
                        }
                    } else {
                        \Log::warning("Non Blok Non CSR jadwal ID: {$jadwalId} not found");
                    }
                    break;
                    
                case 'csr':
                    $jadwal = \App\Models\JadwalCSR::where('id', $jadwalId)
                        ->where('dosen_id', $userId)
                        ->first();
                    
                    if ($jadwal) {
                        $jadwal->update([
                            'status_konfirmasi' => 'belum_konfirmasi',
                            'alasan_konfirmasi' => null
                        ]);
                    }
                    break;
                    
                case 'praktikum':
                    $jadwal = \App\Models\JadwalPraktikum::where('id', $jadwalId)
                        ->where('dosen_id', $userId)
                        ->first();
                    
                    if ($jadwal) {
                        $jadwal->update([
                            'status_konfirmasi' => 'belum_konfirmasi',
                            'alasan_konfirmasi' => null
                        ]);
                    }
                    break;
                    
                case 'jurnal_reading':
                    $jadwal = \App\Models\JadwalJurnalReading::where('id', $jadwalId)
                        ->where('dosen_id', $userId)
                        ->first();
                    
                    if ($jadwal) {
                        $jadwal->update([
                            'status_konfirmasi' => 'belum_konfirmasi',
                            'alasan_konfirmasi' => null
                        ]);
                    }
                    break;
            }
        } catch (\Exception $e) {
            \Log::error('Failed to reset schedule confirmation status: ' . $e->getMessage());
        }
    }

    /**
     * Replace dosen with another dosen
     */
    public function replaceDosen(Request $request)
    {
        $request->validate([
            'notification_id' => 'required|exists:notifications,id',
            'jadwal_id' => 'required|integer',
            'jadwal_type' => 'required|string',
            'new_dosen_id' => 'required|exists:users,id'
        ]);

        try {
            $notification = Notification::findOrFail($request->notification_id);
            $newDosen = User::findOrFail($request->new_dosen_id);
            
            // Check if new dosen is available (no conflict)
            $isAvailable = $this->checkDosenAvailabilityPrivate($request->jadwal_id, $request->jadwal_type, $request->new_dosen_id);
            
            if (!$isAvailable) {
                return response()->json([
                    'message' => 'Dosen pengganti tidak tersedia pada waktu tersebut',
                    'error' => 'Dosen memiliki jadwal yang bentrok'
                ], 400);
            }

            // Update the schedule with new dosen
            $this->updateScheduleWithNewDosen($request->jadwal_id, $request->jadwal_type, $request->new_dosen_id);

            // Update original notification status
            $notification->update([
                'is_read' => true,
                'read_at' => now()
            ]);


            // Log activity

            activity()

                ->log('Notification deleted');


            // Log activity

            activity()

                ->log('Notification updated');


            // Log activity

            activity()

                ->log('Notification created');

            // Create notification for new dosen
            $newNotification = Notification::create([
                'user_id' => $request->new_dosen_id,
                'title' => 'Penugasan Jadwal Baru',
                'message' => "Anda ditugaskan sebagai dosen pengganti untuk jadwal yang sebelumnya ditolak oleh dosen lain. Silakan konfirmasi ketersediaan Anda.",
                'type' => 'info',
                'is_read' => false,
                'data' => array_merge($notification->data ?? [], [
                    'replacement' => true,
                    'original_dosen' => $notification->data['dosen_name'] ?? $notification->data['sender_name'] ?? 'Unknown',
                    'admin_action' => 'replaced'
                ])
            ]);


            // Log activity

            activity()

                ->log('Notification deleted');


            // Log activity

            activity()

                ->log('Notification updated');


            // Log activity

            activity()

                ->log('Notification created');

            return response()->json([
                'message' => 'Dosen berhasil diganti',
                'new_dosen' => $newDosen,
                'notification' => $newNotification
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengganti dosen',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check if dosen is available at specific time
     */
    public function checkDosenAvailability(Request $request)
    {
        $request->validate([
            'jadwal_id' => 'required|integer',
            'jadwal_type' => 'required|string',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $isAvailable = $this->checkDosenAvailabilityPrivate(
            $request->jadwal_id, 
            $request->jadwal_type, 
            $request->dosen_id
        );

        return response()->json([
            'available' => $isAvailable,
            'dosen_id' => $request->dosen_id
        ]);
    }

    /**
     * Private method to check dosen availability
     */
    private function checkDosenAvailabilityPrivate($jadwalId, $jadwalType, $dosenId)
    {
        // This is a simplified check - in real implementation, you would check against actual schedules
        // For now, we'll assume all dosen are available (you can implement proper conflict checking)
        
        // TODO: Implement proper schedule conflict checking
        // Check if dosen has any conflicting schedules at the same time
        
        return true; // Placeholder - always return true for now
    }

    /**
     * Private method to update schedule with new dosen
     */
    private function updateScheduleWithNewDosen($jadwalId, $jadwalType, $newDosenId)
    {
        // Update the schedule based on jadwal_type
        switch ($jadwalType) {
            case 'pbl':
                // Update PBL schedule and reset penilaian submitted
                $jadwal = \App\Models\JadwalPBL::find($jadwalId);
                if ($jadwal) {
                    $oldPBLType = $jadwal->pbl_tipe;
                    $jadwal->resetPenilaianSubmitted();
                    $jadwal->update(['dosen_id' => $newDosenId]);
                    
                    // Update penilaian data jika PBL type berubah
                    if ($oldPBLType !== $jadwal->pbl_tipe) {
                        $jadwal->updatePenilaianForPBLTypeChange($oldPBLType, $jadwal->pbl_tipe);
                    }
                }
                break;
            case 'kuliah_besar':
                // Update Kuliah Besar schedule
                \DB::table('jadwal_kuliah_besar')->where('id', $jadwalId)->update(['dosen_id' => $newDosenId]);
                break;
            case 'praktikum':
                // Update Praktikum schedule (pivot table)
                \DB::table('jadwal_praktikum_dosen')->where('jadwal_praktikum_id', $jadwalId)->update(['dosen_id' => $newDosenId]);
                break;
            case 'jurnal':
                // Update Jurnal Reading schedule and reset penilaian submitted
                $jadwal = \App\Models\JadwalJurnalReading::find($jadwalId);
                if ($jadwal) {
                    $jadwal->resetPenilaianSubmitted();
                    $jadwal->update(['dosen_id' => $newDosenId]);
                }
                break;
            case 'csr':
                // Update CSR schedule
                \DB::table('jadwal_csr')->where('id', $jadwalId)->update(['dosen_id' => $newDosenId]);
                break;
            case 'non_blok_non_csr':
                // Update Non Blok Non CSR schedule
                \DB::table('jadwal_non_blok_non_csr')->where('id', $jadwalId)->update(['dosen_id' => $newDosenId]);
                break;
        }
    }
}
