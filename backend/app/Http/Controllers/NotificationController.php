<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Notification;
use App\Models\User;
use App\Models\WhatsAppConversation;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use App\Services\WablasService;

class NotificationController extends Controller
{
    protected $wablasService;

    public function __construct(WablasService $wablasService)
    {
        $this->wablasService = $wablasService;
    }
    /**
     * Get notifications for a specific user (dosen)
     */
    public function getUserNotifications($userId)
    {
        $user = Auth::user();

        // Users can only access their own notifications
        if (!$user || ($user->id != $userId && $user->role !== 'super_admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Get both personal notifications and public notifications
        $notifications = Notification::where(function ($query) use ($userId) {
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
        $notifications = Notification::where(function ($query) use ($userId) {
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
        $count = Notification::where(function ($query) use ($userId) {
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

        // Apply user type filter
        if ($userType === 'dosen') {
            // Filter notifications sent to dosen
            $query->whereHas('user', function ($q) {
                $q->whereIn('role', ['dosen', 'koordinator', 'tim_blok', 'dosen_mengajar']);
            });
        } elseif ($userType === 'mahasiswa') {
            // Filter notifications sent to mahasiswa
            $query->whereHas('user', function ($q) {
                $q->where('role', 'mahasiswa');
            });
        } elseif ($userType === 'my_notifications') {
            // Filter notifications for current admin user only
            $currentUser = Auth::user();

            if ($currentUser->role === 'super_admin') {
                // Super Admin can see all admin notifications
                $adminIds = User::whereIn('role', ['admin', 'super_admin', 'tim_akademik'])->pluck('id')->toArray();
                $query->where(function ($q) use ($currentUser, $adminIds) {
                    $q->where('user_id', $currentUser->id) // Current admin's notifications
                        ->orWhereIn('user_id', $adminIds); // Any admin notifications (including reschedule)
                });
            } else {
                // Tim Akademik can only see their own notifications
                $query->where('user_id', $currentUser->id);
            }
        } else {
            // Default: show notifications based on user role
            $currentUser = Auth::user();

            if ($currentUser->role === 'super_admin') {
                // Super Admin can see all admin notifications
                $adminIds = User::whereIn('role', ['admin', 'super_admin', 'tim_akademik'])->pluck('id')->toArray();
                $query->where(function ($q) use ($adminIds) {
                    $q->whereIn('user_id', $adminIds)
                        ->orWhere('user_id', null); // Include public notifications
                });
            } else {
                // Tim Akademik can only see their own notifications and public notifications
                $query->where(function ($q) use ($currentUser) {
                    $q->where('user_id', $currentUser->id) // Their own notifications
                        ->orWhere('user_id', null); // Public notifications only
                });
            }
        }

        // Apply search filter
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search) {
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

                // Show the actual recipient (notification user), not the sender
                $displayName = $notification->user->name ?? 'Sistem';

                // Determine user type based on the actual recipient (notification user)
                $isDosen = in_array($userRole, ['dosen', 'koordinator', 'tim_blok', 'dosen_mengajar']);
                $isAdmin = in_array($userRole, ['super_admin', 'admin', 'tim_akademik']);
                $userTypeLabel = $isAdmin ? 'Admin' : ($isDosen ? 'Dosen' : 'Mahasiswa');

                return [
                    'id' => $notification->id,
                    'user_name' => $displayName,
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
            $baseQuery->whereHas('user', function ($q) {
                $q->whereIn('role', ['dosen', 'koordinator', 'tim_blok', 'dosen_mengajar']);
            });
        } elseif ($userType === 'mahasiswa') {
            $baseQuery->whereHas('user', function ($q) {
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
        $dosenNotifications = Notification::whereHas('user', function ($q) {
            $q->whereIn('role', ['dosen', 'koordinator', 'tim_blok', 'dosen_mengajar']);
        })->count();

        $mahasiswaNotifications = Notification::whereHas('user', function ($q) {
            $q->where('role', 'mahasiswa');
        })->count();

        // Get confirmation breakdown - for notifications about dosen confirmations
        // These notifications are sent to admin/super_admin about dosen responses
        $bisaMengajar = 0;
        $tidakBisaMengajar = 0;

        // Apply user type filter to confirmation breakdown
        if ($userType === 'dosen' || $userType === 'my_notifications' || $userType === 'all') {
            // Count "Bisa Mengajar" - must contain "Bisa Mengajar" but NOT "Tidak Bisa Mengajar"
            $bisaMengajar = Notification::where('title', 'like', '%Bisa Mengajar%')
                ->where('title', 'not like', '%Tidak Bisa Mengajar%')
                ->count();

            // Count "Tidak Bisa Mengajar" - must contain "Tidak Bisa Mengajar"
            $tidakBisaMengajar = Notification::where('title', 'like', '%Tidak Bisa Mengajar%')->count();
        }
        // For mahasiswa, both counts remain 0
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
     * Reset notifications for admin based on scope (all, dosen, mahasiswa)
     */
    public function resetNotificationsForAdmin(Request $request)
    {
        // Check if user is admin or tim akademik
        if (!Auth::user() || !in_array(Auth::user()->role, ['admin', 'super_admin', 'tim_akademik'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $scope = $request->get('scope', 'all'); // all, dosen, mahasiswa

        $query = Notification::query();

        // Apply scope filter (same logic as getAllNotificationsForAdmin)
        if ($scope === 'dosen') {
            // Filter notifications sent to dosen
            $query->whereHas('user', function ($q) {
                $q->whereIn('role', ['dosen', 'koordinator', 'tim_blok', 'dosen_mengajar']);
            });
        } elseif ($scope === 'mahasiswa') {
            // Filter notifications sent to mahasiswa
            $query->whereHas('user', function ($q) {
                $q->where('role', 'mahasiswa');
            });
        } elseif ($scope === 'my_notifications') {
            // Filter notifications for current admin user only
            $currentUser = Auth::user();

            if ($currentUser->role === 'super_admin') {
                // Super Admin can see all admin notifications
                $adminIds = User::whereIn('role', ['admin', 'super_admin', 'tim_akademik'])->pluck('id')->toArray();
                $query->where(function ($q) use ($currentUser, $adminIds) {
                    $q->where('user_id', $currentUser->id)
                        ->orWhereIn('user_id', $adminIds);
                });
            } else {
                // Tim Akademik can only see their own notifications
                $query->where('user_id', $currentUser->id);
            }
        }
        // If scope is 'all', delete all notifications (no filter)

        $deletedCount = $query->count();
        $query->delete();

        // Log activity
        activity()
            ->log("Reset notifications for admin - Scope: {$scope}, Deleted: {$deletedCount}");

        return response()->json([
            'message' => 'Notifications reset successfully',
            'deleted_count' => $deletedCount,
            'scope' => $scope
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
                        // Untuk reassignment, kita tidak perlu cek akses karena superadmin yang meminta
                        // Langsung reset status dan tambahkan dosen ke dosen_ids

                        // Log current state before reset
                        \Log::info("Before reset PBL jadwal ID: {$jadwalId}, user ID: {$userId}", [
                            'current_status' => $jadwal->status_konfirmasi,
                            'current_dosen_ids' => $jadwal->dosen_ids,
                            'current_dosen_id' => $jadwal->dosen_id
                        ]);

                        // Reset status konfirmasi
                        $jadwal->update([
                            'status_konfirmasi' => 'belum_konfirmasi',
                            'alasan_konfirmasi' => null
                        ]);

                        // Pastikan dosen ada di dosen_ids untuk memungkinkan konfirmasi ulang
                        $currentDosenIds = $jadwal->dosen_ids ? (is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true)) : [];

                        // Jika dosen tidak ada di dosen_ids, tambahkan kembali
                        if (!in_array($userId, $currentDosenIds)) {
                            $currentDosenIds[] = $userId;
                            $jadwal->update(['dosen_ids' => $currentDosenIds]);
                            \Log::info("Re-added dosen {$userId} to dosen_ids for PBL jadwal ID: {$jadwalId}");
                        }

                        // Log final state after reset
                        $jadwal->refresh(); // Reload from database
                        \Log::info("After reset PBL jadwal ID: {$jadwalId}, user ID: {$userId}", [
                            'new_status' => $jadwal->status_konfirmasi,
                            'new_dosen_ids' => $jadwal->dosen_ids,
                            'new_dosen_id' => $jadwal->dosen_id
                        ]);
                    } else {
                        \Log::warning("PBL jadwal ID: {$jadwalId} not found");
                    }
                    break;

                case 'kuliah_besar':
                    $jadwal = \App\Models\JadwalKuliahBesar::where('id', $jadwalId)
                        ->where(function ($query) use ($userId) {
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
                    $jadwal = \App\Models\JadwalJurnalReading::find($jadwalId);

                    if ($jadwal) {
                        // Untuk reassignment, kita tidak perlu cek akses karena superadmin yang meminta
                        // Langsung reset status dan tambahkan dosen ke dosen_ids

                        // Reset status konfirmasi
                        $jadwal->update([
                            'status_konfirmasi' => 'belum_konfirmasi',
                            'alasan_konfirmasi' => null
                        ]);

                        // Pastikan dosen ada di dosen_ids untuk memungkinkan konfirmasi ulang
                        $currentDosenIds = $jadwal->dosen_ids ? (is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true)) : [];

                        // Jika dosen tidak ada di dosen_ids, tambahkan kembali
                        if (!in_array($userId, $currentDosenIds)) {
                            $currentDosenIds[] = $userId;
                            $jadwal->update(['dosen_ids' => $currentDosenIds]);
                            \Log::info("Re-added dosen {$userId} to dosen_ids for Jurnal Reading jadwal ID: {$jadwalId}");
                        }

                        \Log::info("Reset Jurnal Reading confirmation status for jadwal ID: {$jadwalId}, user ID: {$userId}");
                    } else {
                        \Log::warning("Jurnal Reading jadwal ID: {$jadwalId} not found");
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

            // PENTING: Jika dosen pengganti sudah pernah punya notifikasi "Tidak Bisa Mengajar" untuk jadwal ini,
            // hapus atau mark as read notifikasi lama tersebut agar tidak muncul lagi
            // Ini memastikan dosen pengganti mendapat notifikasi assignment baru "Menunggu Konfirmasi", bukan notifikasi lama "Tidak Bisa Mengajar"
            $notificationData = is_string($notification->data) ? json_decode($notification->data, true) : ($notification->data ?? []);
            $jadwalId = $request->jadwal_id;
            $jadwalType = $request->jadwal_type;
            $newDosenId = $request->new_dosen_id;

            // PENTING: Cari notifikasi lama "Tidak Bisa Mengajar" untuk dosen pengganti pada jadwal yang sama
            // TIDAK PEDULI sudah dibaca atau belum, langsung timpa dengan notifikasi assignment baru
            // Cari semua notifikasi yang terkait dengan "tidak bisa mengajar" (baik dari dosen sendiri atau dari admin)
            $allOldNotifications = Notification::where('user_id', $newDosenId)
                ->where(function ($query) {
                    $query->where('title', 'LIKE', '%Dosen Tidak Bisa Mengajar%')
                        ->orWhere('title', 'LIKE', '%Tidak Bisa Mengajar%')
                        ->orWhere('title', 'LIKE', '%Status Konfirmasi Diubah%'); // Juga cari notifikasi status change
                })
                ->get(); // Ambil semua, tidak peduli sudah dibaca atau belum

            // Filter notifikasi yang sesuai dengan jadwal_id dan jadwal_type
            // Juga filter yang statusnya "tidak_bisa" untuk notifikasi "Status Konfirmasi Diubah"
            $oldNotifications = $allOldNotifications->filter(function ($notif) use ($jadwalId, $jadwalType) {
                $notifData = is_string($notif->data) ? json_decode($notif->data, true) : ($notif->data ?? []);

                // Cek apakah jadwal_id dan jadwal_type cocok
                $isMatchingJadwal = isset($notifData['jadwal_id']) &&
                    isset($notifData['jadwal_type']) &&
                    $notifData['jadwal_id'] == $jadwalId &&
                    $notifData['jadwal_type'] == $jadwalType;

                if (!$isMatchingJadwal) {
                    return false;
                }

                // Jika ini notifikasi "Status Konfirmasi Diubah", cek apakah statusnya "tidak_bisa"
                if (strpos($notif->title, 'Status Konfirmasi Diubah') !== false) {
                    return isset($notifData['status_konfirmasi']) && $notifData['status_konfirmasi'] === 'tidak_bisa';
                }

                // Untuk notifikasi "Tidak Bisa Mengajar", langsung return true
                return true;
            });

            // Update notifikasi lama menjadi notifikasi assignment baru (langsung timpa)
            $newNotification = null;
            if ($oldNotifications->count() > 0) {
                // Gunakan notifikasi pertama yang ditemukan untuk diupdate
                $oldNotif = $oldNotifications->first();
                $oldNotif->update([
                    'title' => 'Penugasan Jadwal Baru',
                    'message' => "Anda ditugaskan sebagai dosen pengganti untuk jadwal yang sebelumnya ditolak oleh dosen lain. Silakan konfirmasi ketersediaan Anda.",
                    'type' => 'info',
                    'is_read' => false, // Reset menjadi belum dibaca
                    'read_at' => null, // Reset read_at
                    'data' => array_merge($notificationData, [
                        'jadwal_id' => $jadwalId,
                        'jadwal_type' => $jadwalType,
                        'replacement' => true,
                        'original_dosen' => $notificationData['dosen_name'] ?? $notificationData['sender_name'] ?? 'Unknown',
                        'admin_action' => 'replaced'
                    ])
                ]);
                $newNotification = $oldNotif;
                \Log::info("Updated old 'Tidak Bisa Mengajar' notification to 'Penugasan Jadwal Baru' for dosen {$newDosenId} on jadwal {$jadwalType} ID {$jadwalId}");

                // Hapus notifikasi lama lainnya jika ada lebih dari satu
                if ($oldNotifications->count() > 1) {
                    $oldNotifications->skip(1)->each(function ($notif) {
                        $notif->delete();
                        \Log::info("Deleted duplicate old notification ID: {$notif->id}");
                    });
                }
            } else {
                // Jika tidak ada notifikasi lama, buat notifikasi baru
                $newNotification = Notification::create([
                    'user_id' => $newDosenId,
                    'title' => 'Penugasan Jadwal Baru',
                    'message' => "Anda ditugaskan sebagai dosen pengganti untuk jadwal yang sebelumnya ditolak oleh dosen lain. Silakan konfirmasi ketersediaan Anda.",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => array_merge($notificationData, [
                        'jadwal_id' => $jadwalId,
                        'jadwal_type' => $jadwalType,
                        'replacement' => true,
                        'original_dosen' => $notificationData['dosen_name'] ?? $notificationData['sender_name'] ?? 'Unknown',
                        'admin_action' => 'replaced'
                    ])
                ]);
                \Log::info("Created new 'Penugasan Jadwal Baru' notification for dosen {$newDosenId} on jadwal {$jadwalType} ID {$jadwalId}");
            }

            // Log activity

            activity()

                ->log('Notification deleted');


            // Log activity

            activity()

                ->log('Notification updated');


            // Log activity

            activity()

                ->log('Notification created');

            // Create success notification for admin
            $adminNotification = Notification::create([
                'user_id' => auth()->id(),
                'title' => 'Penggantian Dosen Berhasil',
                'message' => "Dosen berhasil diganti dari " . ($notificationData['dosen_name'] ?? 'Dosen Lama') . " ke {$newDosen->name} untuk jadwal " . ($notificationData['mata_kuliah'] ?? 'Jadwal') . ".",
                'type' => 'success',
                'is_read' => false,
                'data' => [
                    'jadwal_id' => $request->jadwal_id,
                    'jadwal_type' => $request->jadwal_type,
                    'original_dosen' => $notificationData['dosen_name'] ?? 'Dosen Lama',
                    'new_dosen' => $newDosen->name,
                    'mata_kuliah' => $notificationData['mata_kuliah'] ?? 'Jadwal',
                    'admin_action' => 'replacement_success'
                ]
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
                'notification' => $newNotification,
                'admin_notification' => $adminNotification
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
                    $oldDosenId = $jadwal->dosen_id;
                    $jadwal->resetPenilaianSubmitted();

                    // Update dosen_ids to include old dosen for history (TIDAK membuat row baru)
                    $currentDosenIds = $jadwal->dosen_ids ? (is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true)) : [];

                    // Pastikan oldDosenId ada di dosen_ids[0] (sebagai dosen pengampu awal)
                    if (empty($currentDosenIds)) {
                        // Jika dosen_ids kosong, set oldDosenId sebagai elemen pertama
                        $currentDosenIds = [$oldDosenId];
                    } else {
                        // Pastikan oldDosenId ada di dosen_ids
                        if (!in_array($oldDosenId, $currentDosenIds)) {
                            // Jika oldDosenId belum ada, tambahkan di awal (sebagai dosen pengampu awal)
                            array_unshift($currentDosenIds, $oldDosenId);
                        }
                    }

                    // Tambahkan newDosenId jika belum ada
                    if (!in_array($newDosenId, $currentDosenIds)) {
                        $currentDosenIds[] = $newDosenId;
                    }

                    // Reset status to 'belum_konfirmasi' when replacing dosen
                    // Update dosen_id menjadi newDosenId, tapi dosen_ids tetap menyimpan history
                    $jadwal->update([
                        'dosen_id' => $newDosenId,
                        'dosen_ids' => $currentDosenIds,
                        'status_konfirmasi' => 'belum_konfirmasi',
                        'status_reschedule' => null,
                        'alasan_konfirmasi' => null,
                        'reschedule_reason' => null
                    ]);

                    // Update penilaian data jika PBL type berubah
                    if ($oldPBLType !== $jadwal->pbl_tipe) {
                        $jadwal->updatePenilaianForPBLTypeChange($oldPBLType, $jadwal->pbl_tipe);
                    }
                }
                break;
            case 'kuliah_besar':
                // Update Kuliah Besar schedule and reset status
                $jadwal = \DB::table('jadwal_kuliah_besar')->where('id', $jadwalId)->first();
                if ($jadwal) {
                    $oldDosenId = $jadwal->dosen_id;

                    // Update dosen_ids to include old dosen for history (TIDAK membuat row baru)
                    $currentDosenIds = $jadwal->dosen_ids ? (is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true)) : [];

                    // Pastikan oldDosenId ada di dosen_ids[0] (sebagai dosen pengampu awal)
                    if (empty($currentDosenIds)) {
                        // Jika dosen_ids kosong, set oldDosenId sebagai elemen pertama
                        $currentDosenIds = [$oldDosenId];
                    } else {
                        // Pastikan oldDosenId ada di dosen_ids
                        if (!in_array($oldDosenId, $currentDosenIds)) {
                            // Jika oldDosenId belum ada, tambahkan di awal (sebagai dosen pengampu awal)
                            array_unshift($currentDosenIds, $oldDosenId);
                        }
                    }

                    // Tambahkan newDosenId jika belum ada
                    if (!in_array($newDosenId, $currentDosenIds)) {
                        $currentDosenIds[] = $newDosenId;
                    }

                    \DB::table('jadwal_kuliah_besar')->where('id', $jadwalId)->update([
                        'dosen_id' => $newDosenId,
                        'dosen_ids' => json_encode($currentDosenIds),
                        'status_konfirmasi' => 'belum_konfirmasi',
                        'status_reschedule' => null,
                        'alasan_konfirmasi' => null,
                        'reschedule_reason' => null
                    ]);
                }
                break;
            case 'praktikum':
                // Update Praktikum schedule (pivot table) and reset status
                $jadwal = \App\Models\JadwalPraktikum::find($jadwalId);
                if ($jadwal) {
                    $oldDosenId = $jadwal->dosen->first()?->id;

                    // If there was an old dosen and it's different from new dosen
                    if ($oldDosenId && $oldDosenId != $newDosenId) {
                        // Update existing pivot record to mark old dosen as "tidak_bisa"
                        \DB::table('jadwal_praktikum_dosen')
                            ->where('jadwal_praktikum_id', $jadwalId)
                            ->where('dosen_id', $oldDosenId)
                            ->update([
                                'status_konfirmasi' => 'tidak_bisa',
                                'status_reschedule' => null,
                                'alasan_konfirmasi' => null, // Keep original reason
                                'reschedule_reason' => null,
                                'updated_at' => now()
                            ]);
                    }

                    // Check if new dosen already exists in pivot table for original jadwal
                    $existingPivot = \DB::table('jadwal_praktikum_dosen')
                        ->where('jadwal_praktikum_id', $jadwalId)
                        ->where('dosen_id', $newDosenId)
                        ->first();

                    if ($existingPivot) {
                        // Update existing pivot record for new dosen
                        \DB::table('jadwal_praktikum_dosen')
                            ->where('jadwal_praktikum_id', $jadwalId)
                            ->where('dosen_id', $newDosenId)
                            ->update([
                                'status_konfirmasi' => 'belum_konfirmasi',
                                'status_reschedule' => null,
                                'alasan_konfirmasi' => null,
                                'reschedule_reason' => null,
                                'updated_at' => now()
                            ]);
                    } else {
                        // Create new pivot record for new dosen
                        \DB::table('jadwal_praktikum_dosen')->insert([
                            'jadwal_praktikum_id' => $jadwalId,
                            'dosen_id' => $newDosenId,
                            'status_konfirmasi' => 'belum_konfirmasi',
                            'status_reschedule' => null,
                            'alasan_konfirmasi' => null,
                            'reschedule_reason' => null,
                            'created_at' => now(),
                            'updated_at' => now()
                        ]);
                    }
                }
                break;
            case 'jurnal':
            case 'jurnal_reading':
                // Update Jurnal Reading schedule and reset penilaian submitted
                $jadwal = \App\Models\JadwalJurnalReading::find($jadwalId);
                if ($jadwal) {
                    $oldDosenId = $jadwal->dosen_id;
                    $jadwal->resetPenilaianSubmitted();

                    // Update dosen_ids to include old dosen for history (TIDAK membuat row baru)
                    $currentDosenIds = $jadwal->dosen_ids ? (is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true)) : [];

                    // Pastikan oldDosenId ada di dosen_ids[0] (sebagai dosen pengampu awal)
                    if (empty($currentDosenIds)) {
                        // Jika dosen_ids kosong, set oldDosenId sebagai elemen pertama
                        $currentDosenIds = [$oldDosenId];
                    } else {
                        // Pastikan oldDosenId ada di dosen_ids
                        if (!in_array($oldDosenId, $currentDosenIds)) {
                            // Jika oldDosenId belum ada, tambahkan di awal (sebagai dosen pengampu awal)
                            array_unshift($currentDosenIds, $oldDosenId);
                        }
                    }

                    // Tambahkan newDosenId jika belum ada
                    if (!in_array($newDosenId, $currentDosenIds)) {
                        $currentDosenIds[] = $newDosenId;
                    }

                    // Reset status to 'belum_konfirmasi' when replacing dosen
                    // Update dosen_id menjadi newDosenId, tapi dosen_ids tetap menyimpan history
                    $jadwal->update([
                        'dosen_id' => $newDosenId,
                        'dosen_ids' => $currentDosenIds,
                        'status_konfirmasi' => 'belum_konfirmasi',
                        'status_reschedule' => null,
                        'alasan_konfirmasi' => null,
                        'reschedule_reason' => null
                    ]);
                }
                break;
            case 'csr':
                // Update CSR schedule and reset status
                $jadwal = \DB::table('jadwal_csr')->where('id', $jadwalId)->first();
                if ($jadwal) {
                    $oldDosenId = $jadwal->dosen_id;

                    // Update dosen_ids to include old dosen for history (TIDAK membuat row baru)
                    $currentDosenIds = $jadwal->dosen_ids ? (is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true)) : [];

                    // Pastikan oldDosenId ada di dosen_ids[0] (sebagai dosen pengampu awal)
                    if (empty($currentDosenIds)) {
                        // Jika dosen_ids kosong, set oldDosenId sebagai elemen pertama
                        $currentDosenIds = [$oldDosenId];
                    } else {
                        // Pastikan oldDosenId ada di dosen_ids
                        if (!in_array($oldDosenId, $currentDosenIds)) {
                            // Jika oldDosenId belum ada, tambahkan di awal (sebagai dosen pengampu awal)
                            array_unshift($currentDosenIds, $oldDosenId);
                        }
                    }

                    // Tambahkan newDosenId jika belum ada
                    if (!in_array($newDosenId, $currentDosenIds)) {
                        $currentDosenIds[] = $newDosenId;
                    }

                    \DB::table('jadwal_csr')->where('id', $jadwalId)->update([
                        'dosen_id' => $newDosenId,
                        'dosen_ids' => json_encode($currentDosenIds),
                        'status_konfirmasi' => 'belum_konfirmasi',
                        'status_reschedule' => null,
                        'alasan_konfirmasi' => null,
                        'reschedule_reason' => null
                    ]);
                }
                break;
            case 'non_blok_non_csr':
                // Update Non Blok Non CSR schedule and reset status
                $jadwal = \DB::table('jadwal_non_blok_non_csr')->where('id', $jadwalId)->first();
                if ($jadwal) {
                    $oldDosenId = $jadwal->dosen_id;

                    // Update dosen_ids to include old dosen for history (TIDAK membuat row baru)
                    $currentDosenIds = $jadwal->dosen_ids ? (is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true)) : [];

                    // Pastikan oldDosenId ada di dosen_ids[0] (sebagai dosen pengampu awal)
                    if (empty($currentDosenIds)) {
                        // Jika dosen_ids kosong, set oldDosenId sebagai elemen pertama
                        $currentDosenIds = [$oldDosenId];
                    } else {
                        // Pastikan oldDosenId ada di dosen_ids
                        if (!in_array($oldDosenId, $currentDosenIds)) {
                            // Jika oldDosenId belum ada, tambahkan di awal (sebagai dosen pengampu awal)
                            array_unshift($currentDosenIds, $oldDosenId);
                        }
                    }

                    // Tambahkan newDosenId jika belum ada
                    if (!in_array($newDosenId, $currentDosenIds)) {
                        $currentDosenIds[] = $newDosenId;
                    }

                    \DB::table('jadwal_non_blok_non_csr')->where('id', $jadwalId)->update([
                        'dosen_id' => $newDosenId,
                        'dosen_ids' => json_encode($currentDosenIds),
                        'status_konfirmasi' => 'belum_konfirmasi',
                        'status_reschedule' => null,
                        'alasan_konfirmasi' => null,
                        'reschedule_reason' => null
                    ]);
                }
                break;
        }
    }

    /**
     * Approve reschedule request
     */
    public function approveReschedule(Request $request)
    {
        $request->validate([
            'notification_id' => 'required|exists:notifications,id',
            'jadwal_id' => 'required|integer',
            'jadwal_type' => 'required|string',
            'new_tanggal' => 'required|date',
            'new_jam_mulai' => 'required|string',
            'new_jam_selesai' => 'required|string',
            'new_ruangan_id' => 'nullable|exists:ruangan,id',
            'new_jumlah_sesi' => 'nullable|integer|min:1|max:6'
        ]);

        try {
            $notification = Notification::findOrFail($request->notification_id);
            $jadwalId = $request->jadwal_id;
            $jadwalType = $request->jadwal_type;

            // Update jadwal dengan data baru
            $this->updateScheduleWithNewTime($jadwalType, $jadwalId, $request);

            // Update status konfirmasi menjadi 'belum_konfirmasi' (dosen harus konfirmasi ulang untuk jadwal baru)
            $this->updateScheduleStatus($jadwalType, $jadwalId, 'belum_konfirmasi', 'approved');

            // Update notifikasi admin menjadi "Disetujui"
            $adminName = auth()->user()->name ?? 'Admin';
            $notification->update([
                'title' => 'Reschedule Disetujui',
                'message' => "Permintaan reschedule dari {$notification->data['dosen_name']} telah disetujui oleh {$adminName} dan jadwal telah diubah.",
                'type' => 'success',
                'data' => array_merge($notification->data, [
                    'notification_type' => 'reschedule_approved',
                    'approved_by' => $adminName,
                    'approved_by_id' => auth()->id(),
                    'new_tanggal' => $request->new_tanggal,
                    'new_jam_mulai' => $request->new_jam_mulai,
                    'new_jam_selesai' => $request->new_jam_selesai
                ])
            ]);

            // Kirim notifikasi ke dosen bahwa reschedule disetujui dan perlu konfirmasi ulang
            $dosenId = $notification->data['dosen_id'] ?? null;
            if ($dosenId) {
                Notification::create([
                    'user_id' => $dosenId,
                    'title' => 'Reschedule Disetujui',
                    'message' => "Permintaan reschedule Anda telah disetujui oleh {$adminName}. Jadwal telah diubah dan Anda perlu mengkonfirmasi ketersediaan kembali untuk jadwal yang baru.",
                    'type' => 'success',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwalId,
                        'jadwal_type' => $jadwalType,
                        'notification_type' => 'reschedule_approved',
                        'approved_by' => $adminName,
                        'approved_by_id' => auth()->id(),
                        'new_tanggal' => $request->new_tanggal,
                        'new_jam_mulai' => $request->new_jam_mulai,
                        'new_jam_selesai' => $request->new_jam_selesai,
                        'created_by' => $adminName,
                        'created_by_role' => auth()->user()->role ?? 'admin',
                        'sender_name' => $adminName,
                        'sender_role' => auth()->user()->role ?? 'admin'
                    ]
                ]);
            }

            return response()->json([
                'message' => 'Reschedule berhasil disetujui dan jadwal telah diubah'
            ]);
        } catch (\Exception $e) {
            \Log::error('Error approving reschedule: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal menyetujui reschedule',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reject reschedule request
     */
    public function rejectReschedule(Request $request)
    {
        $request->validate([
            'notification_id' => 'required|exists:notifications,id',
            'jadwal_id' => 'required|integer',
            'jadwal_type' => 'required|string'
        ]);

        try {
            $notification = Notification::findOrFail($request->notification_id);
            $jadwalId = $request->jadwal_id;
            $jadwalType = $request->jadwal_type;

            // Update status konfirmasi menjadi 'belum_konfirmasi' (kembali ke awal)
            $this->updateScheduleStatus($jadwalType, $jadwalId, 'belum_konfirmasi', 'rejected');

            // Update notifikasi admin menjadi "Ditolak"
            $adminName = auth()->user()->name ?? 'Admin';
            $notification->update([
                'title' => 'Reschedule Ditolak',
                'message' => "Permintaan reschedule dari {$notification->data['dosen_name']} telah ditolak oleh {$adminName}.",
                'type' => 'warning',
                'data' => array_merge($notification->data, [
                    'notification_type' => 'reschedule_rejected',
                    'rejected_by' => $adminName,
                    'rejected_by_id' => auth()->id()
                ])
            ]);

            // Kirim notifikasi ke dosen bahwa reschedule ditolak
            $dosenId = $notification->data['dosen_id'] ?? null;
            if ($dosenId) {
                Notification::create([
                    'user_id' => $dosenId,
                    'title' => 'Reschedule Ditolak',
                    'message' => "Permintaan reschedule Anda ditolak oleh {$adminName}. Silakan konfirmasi ketersediaan untuk jadwal yang ada.",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwalId,
                        'jadwal_type' => $jadwalType,
                        'notification_type' => 'reschedule_rejected',
                        'rejected_by' => $adminName,
                        'rejected_by_id' => auth()->id(),
                        'created_by' => $adminName,
                        'created_by_role' => auth()->user()->role ?? 'admin',
                        'sender_name' => $adminName,
                        'sender_role' => auth()->user()->role ?? 'admin'
                    ]
                ]);
            }

            return response()->json([
                'message' => 'Reschedule ditolak dan status dikembalikan ke awal'
            ]);
        } catch (\Exception $e) {
            \Log::error('Error rejecting reschedule: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal menolak reschedule',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update schedule with new time and date
     */
    private function updateScheduleWithNewTime($jadwalType, $jadwalId, $request)
    {
        $updateData = [
            'tanggal' => $request->new_tanggal,
            'jam_mulai' => $request->new_jam_mulai,
            'jam_selesai' => $request->new_jam_selesai
        ];

        if ($request->new_ruangan_id) {
            $updateData['ruangan_id'] = $request->new_ruangan_id;
        }

        // Update jumlah_sesi jika ada
        if ($request->new_jumlah_sesi) {
            $updateData['jumlah_sesi'] = $request->new_jumlah_sesi;
        }

        switch ($jadwalType) {
            case 'pbl':
                \DB::table('jadwal_pbl')->where('id', $jadwalId)->update($updateData);
                break;
            case 'kuliah_besar':
                \DB::table('jadwal_kuliah_besar')->where('id', $jadwalId)->update($updateData);
                break;
            case 'praktikum':
                \DB::table('jadwal_praktikum')->where('id', $jadwalId)->update($updateData);
                break;
            case 'jurnal_reading':
                \DB::table('jadwal_jurnal_reading')->where('id', $jadwalId)->update($updateData);
                break;
            case 'csr':
                \DB::table('jadwal_csr')->where('id', $jadwalId)->update($updateData);
                break;
            case 'non_blok_non_csr':
                \DB::table('jadwal_non_blok_non_csr')->where('id', $jadwalId)->update($updateData);
                break;
        }
    }

    /**
     * Update schedule status
     */
    private function updateScheduleStatus($jadwalType, $jadwalId, $status, $statusReschedule = null)
    {
        $updateData = [
            'status_konfirmasi' => $status,
            'status_reschedule' => $statusReschedule,
            'reschedule_reason' => null
        ];

        switch ($jadwalType) {
            case 'pbl':
                \DB::table('jadwal_pbl')->where('id', $jadwalId)->update($updateData);
                break;
            case 'kuliah_besar':
                \DB::table('jadwal_kuliah_besar')->where('id', $jadwalId)->update($updateData);
                break;
            case 'praktikum':
                // For praktikum, update pivot table
                \DB::table('jadwal_praktikum_dosen')->where('jadwal_praktikum_id', $jadwalId)->update([
                    'status_konfirmasi' => $status,
                    'status_reschedule' => $statusReschedule,
                    'reschedule_reason' => null
                ]);
                break;
            case 'jurnal_reading':
                \DB::table('jadwal_jurnal_reading')->where('id', $jadwalId)->update($updateData);
                break;
            case 'csr':
                \DB::table('jadwal_csr')->where('id', $jadwalId)->update($updateData);
                break;
            case 'non_blok_non_csr':
                \DB::table('jadwal_non_blok_non_csr')->where('id', $jadwalId)->update($updateData);
                break;
        }
    }

    /**
     * Send reminder notifications to dosen who haven't confirmed yet
     */
    public function sendReminderNotifications(Request $request)
    {
        // Check if user is admin or tim akademik
        if (!Auth::user() || !in_array(Auth::user()->role, ['admin', 'super_admin', 'tim_akademik'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $reminderCount = 0;
            $whatsappMessages = []; // Collect WhatsApp messages for bulk sending
            $jadwalTypes = ['pbl', 'kuliah_besar', 'praktikum', 'jurnal_reading', 'csr', 'non_blok_non_csr', 'persamaan_persepsi'];

            // Get filter parameters
            $reminderType = $request->get('reminder_type', 'all');
            $semester = $request->get('semester');
            $blok = $request->get('blok');
            
            // Check if dosen_ids is provided (selected dosen mode)
            $dosenIds = $request->get('dosen_ids');
            $jadwalDosenPairs = $request->get('jadwal_dosen_pairs'); // Format: "jadwal_id1:dosen_id1,jadwal_id2:dosen_id2"

            // If dosen_ids is provided, send reminders only to selected dosen
            if ($dosenIds) {
                $dosenIdArray = is_array($dosenIds) ? $dosenIds : explode(',', $dosenIds);
                
                // If jadwal_dosen_pairs is provided, use it to send reminders for specific jadwal-dosen pairs
                if ($jadwalDosenPairs) {
                    $pairs = is_array($jadwalDosenPairs) ? $jadwalDosenPairs : explode(',', $jadwalDosenPairs);
                    
                    foreach ($pairs as $pair) {
                        $parts = explode(':', $pair);
                        if (count($parts) === 2) {
                            $jadwalId = trim($parts[0]);
                            $dosenId = (int) trim($parts[1]); // Convert to integer
                            
                            // Find jadwal type by checking all jadwal types
                            $foundJadwalType = null;
                            $foundJadwal = null;
                            
                            // Check Persamaan Persepsi first (since it's the issue)
                            $jadwalPP = \App\Models\JadwalPersamaanPersepsi::find($jadwalId);
                            if ($jadwalPP) {
                                $foundJadwalType = 'persamaan_persepsi';
                                $foundJadwal = $jadwalPP;
                            } else {
                                // Check other jadwal types
                                $jadwalPBL = \App\Models\JadwalPBL::find($jadwalId);
                                if ($jadwalPBL) {
                                    $foundJadwalType = 'pbl';
                                    $foundJadwal = $jadwalPBL;
                                } else {
                                    $jadwalKB = \App\Models\JadwalKuliahBesar::find($jadwalId);
                                    if ($jadwalKB) {
                                        $foundJadwalType = 'kuliah_besar';
                                        $foundJadwal = $jadwalKB;
                                    } else {
                                        $jadwalPraktikum = \App\Models\JadwalPraktikum::find($jadwalId);
                                        if ($jadwalPraktikum) {
                                            $foundJadwalType = 'praktikum';
                                            $foundJadwal = $jadwalPraktikum;
                                        } else {
                                            $jadwalJR = \App\Models\JadwalJurnalReading::find($jadwalId);
                                            if ($jadwalJR) {
                                                $foundJadwalType = 'jurnal_reading';
                                                $foundJadwal = $jadwalJR;
                                            } else {
                                                $jadwalCSR = \App\Models\JadwalCSR::find($jadwalId);
                                                if ($jadwalCSR) {
                                                    $foundJadwalType = 'csr';
                                                    $foundJadwal = $jadwalCSR;
                                                } else {
                                                    $jadwalNBNC = \App\Models\JadwalNonBlokNonCSR::find($jadwalId);
                                                    if ($jadwalNBNC) {
                                                        $foundJadwalType = 'non_blok_non_csr';
                                                        $foundJadwal = $jadwalNBNC;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            
                            // Send reminder for this specific jadwal-dosen pair
                            if ($foundJadwalType && $foundJadwal) {
                                // For persamaan_persepsi, always send "upcoming" reminder
                                $reminderTypeForJadwal = ($foundJadwalType === 'persamaan_persepsi') ? 'upcoming' : $reminderType;
                                
                                // Kirim reminder hanya ke dosen yang dipilih (dari jadwal_dosen_pairs)
                                if ($foundJadwalType === 'persamaan_persepsi') {
                                    // Persamaan Persepsi bisa punya banyak dosen (koordinator + pengampu)
                                    // Jadi kirim hanya ke dosen yang dipilih
                                    $result = $this->sendPersamaanPersepsiReminderToSpecificDosen($foundJadwal, $dosenId, $reminderTypeForJadwal);
                                } else {
                                    // Untuk jadwal lain, gunakan fungsi yang sudah ada
                                    // Fungsi sendReminderForJadwalType akan mengirim ke semua dosen di jadwal
                                    // Tapi karena kita sudah filter di frontend (hanya jadwal-dosen pair yang dipilih),
                                    // dan untuk jadwal lain biasanya hanya 1 dosen per jadwal, ini seharusnya sudah benar
                                    // Untuk praktikum yang bisa punya banyak dosen, kita perlu filter khusus
                                    if ($foundJadwalType === 'praktikum') {
                                        // Praktikum bisa punya banyak dosen, cek di pivot table
                                        $dosenJadwal = \DB::table('jadwal_praktikum_dosen')
                                            ->where('jadwal_praktikum_id', $foundJadwal->id)
                                            ->where('dosen_id', $dosenId)
                                            ->first();
                                        if (!$dosenJadwal) {
                                            // Jika dosen tidak ada di jadwal praktikum ini, skip
                                            $result = ['count' => 0, 'whatsapp_messages' => []];
                                        } else {
                                            // Gunakan fungsi yang sudah ada, tapi akan mengirim ke semua dosen di jadwal
                                            // Untuk praktikum, kita perlu filter manual di fungsi sendPraktikumReminders
                                            // Tapi untuk sekarang, kita gunakan fungsi yang sudah ada
                                            $result = $this->sendReminderForJadwalType($foundJadwalType, $reminderTypeForJadwal, $semester, $blok);
                                        }
                                    } else {
                                        // Untuk jadwal lain (PBL, Kuliah Besar, dll), biasanya hanya 1 dosen per jadwal
                                        // Verifikasi bahwa dosen_id match dengan jadwal
                                        $dosenMatch = false;
                                        if ($foundJadwalType === 'pbl' && $foundJadwal->dosen_id == $dosenId) {
                                            $dosenMatch = true;
                                        } elseif ($foundJadwalType === 'kuliah_besar' && ($foundJadwal->dosen_id == $dosenId || (is_array($foundJadwal->dosen_ids) && in_array($dosenId, $foundJadwal->dosen_ids)))) {
                                            $dosenMatch = true;
                                        } elseif ($foundJadwalType === 'jurnal_reading' && $foundJadwal->dosen_id == $dosenId) {
                                            $dosenMatch = true;
                                        } elseif ($foundJadwalType === 'csr' && $foundJadwal->dosen_id == $dosenId) {
                                            $dosenMatch = true;
                                        } elseif ($foundJadwalType === 'non_blok_non_csr' && $foundJadwal->dosen_id == $dosenId) {
                                            $dosenMatch = true;
                                        }
                                        
                                        if ($dosenMatch) {
                                            // Gunakan fungsi yang sudah ada
                                            $result = $this->sendReminderForJadwalType($foundJadwalType, $reminderTypeForJadwal, $semester, $blok);
                                        } else {
                                            // Jika dosen tidak match dengan jadwal, skip
                                            $result = ['count' => 0, 'whatsapp_messages' => []];
                                        }
                                    }
                                }
                                
                                $reminderCount += $result['count'];
                                $whatsappMessages = array_merge($whatsappMessages, $result['whatsapp_messages']);
                            }
                        }
                    }
                } else {
                    // If no jadwal_dosen_pairs, send reminders for all jadwal types for selected dosen
                    foreach ($jadwalTypes as $jadwalType) {
                        // Send unconfirmed reminders
                        if ($reminderType === 'all' || $reminderType === 'unconfirmed') {
                            $result = $this->sendReminderForJadwalType($jadwalType, 'unconfirmed', $semester, $blok);
                            $reminderCount += $result['count'];
                            $whatsappMessages = array_merge($whatsappMessages, $result['whatsapp_messages']);
                        }

                        // Send upcoming reminders
                        if ($reminderType === 'all' || $reminderType === 'upcoming') {
                            $result = $this->sendReminderForJadwalType($jadwalType, 'upcoming', $semester, $blok);
                            $reminderCount += $result['count'];
                            $whatsappMessages = array_merge($whatsappMessages, $result['whatsapp_messages']);
                        }
                    }
                }
            } else {
                // Filter-based mode: send reminders for all jadwal types
                foreach ($jadwalTypes as $jadwalType) {
                    // Send unconfirmed reminders
                    if ($reminderType === 'all' || $reminderType === 'unconfirmed') {
                        $result = $this->sendReminderForJadwalType($jadwalType, 'unconfirmed', $semester, $blok);
                        $reminderCount += $result['count'];
                        $whatsappMessages = array_merge($whatsappMessages, $result['whatsapp_messages']);
                    }

                    // Send upcoming reminders
                    if ($reminderType === 'all' || $reminderType === 'upcoming') {
                        $result = $this->sendReminderForJadwalType($jadwalType, 'upcoming', $semester, $blok);
                        $reminderCount += $result['count'];
                        $whatsappMessages = array_merge($whatsappMessages, $result['whatsapp_messages']);
                    }
                }
            }

            // Send WhatsApp messages in bulk (batch of 100)
            $whatsappSent = 0;
            $whatsappErrors = [];
            if (!empty($whatsappMessages)) {
                $batches = array_chunk($whatsappMessages, 100);
                foreach ($batches as $batchIndex => $batch) {
                    try {
                        $result = $this->wablasService->sendBulkMessage($batch);
                        if ($result && $result['success']) {
                            $whatsappSent += count($batch);
                        } else {
                            // Log error but continue processing
                            $whatsappErrors[] = "Batch " . ($batchIndex + 1) . ": " . ($result['error'] ?? 'Unknown error');
                            \Log::warning('WhatsApp bulk send failed for batch', [
                                'batch_index' => $batchIndex + 1,
                                'batch_size' => count($batch),
                                'result' => $result,
                            ]);
                        }
                    } catch (\Exception $e) {
                        // Log error but continue processing other batches
                        $whatsappErrors[] = "Batch " . ($batchIndex + 1) . ": " . $e->getMessage();
                        \Log::error('Error sending WhatsApp batch', [
                            'batch_index' => $batchIndex + 1,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            }

            // Return success even if some WhatsApp messages failed (notifications were created)
            $responseMessage = "Notifikasi pengingat berhasil dikirim ke {$reminderCount} dosen";
            if ($whatsappSent > 0) {
                $responseMessage .= " ({$whatsappSent} via WhatsApp)";
            }
            if (!empty($whatsappErrors)) {
                $responseMessage .= ". Beberapa pesan WhatsApp gagal dikirim.";
            }

            return response()->json([
                'message' => $responseMessage,
                'reminder_count' => $reminderCount,
                'whatsapp_sent' => $whatsappSent,
                'whatsapp_errors' => $whatsappErrors
            ], 200);
        } catch (\Exception $e) {
            \Log::error('Error sending reminder notifications: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Gagal mengirim notifikasi pengingat',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Send reminder notifications for specific jadwal type
     */
    private function sendReminderForJadwalType($jadwalType, $reminderType = 'unconfirmed', $semester = null, $blok = null)
    {
        $reminderCount = 0;
        $whatsappMessages = [];

        switch ($jadwalType) {
            case 'pbl':
                $result = $this->sendPBLReminders($reminderType, $semester, $blok);
                $reminderCount += $result['count'];
                $whatsappMessages = array_merge($whatsappMessages, $result['whatsapp_messages']);
                break;
            case 'kuliah_besar':
                $result = $this->sendKuliahBesarReminders($reminderType, $semester, $blok);
                $reminderCount += $result['count'];
                $whatsappMessages = array_merge($whatsappMessages, $result['whatsapp_messages']);
                break;
            case 'praktikum':
                $result = $this->sendPraktikumReminders($reminderType, $semester, $blok);
                $reminderCount += $result['count'];
                $whatsappMessages = array_merge($whatsappMessages, $result['whatsapp_messages']);
                break;
            case 'jurnal_reading':
                $result = $this->sendJurnalReadingReminders($reminderType, $semester, $blok);
                $reminderCount += $result['count'];
                $whatsappMessages = array_merge($whatsappMessages, $result['whatsapp_messages']);
                break;
            case 'csr':
                $result = $this->sendCSRReminders($reminderType, $semester, $blok);
                $reminderCount += $result['count'];
                $whatsappMessages = array_merge($whatsappMessages, $result['whatsapp_messages']);
                break;
            case 'non_blok_non_csr':
                $result = $this->sendNonBlokNonCSRReminders($reminderType, $semester, $blok);
                $reminderCount += $result['count'];
                $whatsappMessages = array_merge($whatsappMessages, $result['whatsapp_messages']);
                break;
            case 'persamaan_persepsi':
                // Persamaan Persepsi langsung "bisa", jadi hanya kirim "upcoming" reminder
                if ($reminderType === 'all' || $reminderType === 'upcoming') {
                    $result = $this->sendPersamaanPersepsiReminders('upcoming', $semester, $blok);
                    $reminderCount += $result['count'];
                    $whatsappMessages = array_merge($whatsappMessages, $result['whatsapp_messages']);
                }
                break;
        }

        return [
            'count' => $reminderCount,
            'whatsapp_messages' => $whatsappMessages
        ];
    }

    /**
     * Send PBL reminder notifications
     */
    private function sendPBLReminders($reminderType = 'unconfirmed', $semester = null, $blok = null)
    {
        $reminderCount = 0;
        $whatsappMessages = [];

        // Get PBL schedules based on reminder type
        $query = \App\Models\JadwalPBL::with(['mataKuliah', 'ruangan', 'dosen']);

        if ($reminderType === 'unconfirmed') {
            $query->where('status_konfirmasi', 'belum_konfirmasi');
        } elseif ($reminderType === 'upcoming') {
            $now = now();
            $query->where('status_konfirmasi', 'bisa')
                ->where('tanggal', '>=', $now->toDateString())
                ->where(function ($q) use ($now) {
                    $q->where('tanggal', '>', $now->toDateString())
                        ->orWhere(function ($q2) use ($now) {
                            $q2->where('tanggal', '=', $now->toDateString())
                                ->where('jam_mulai', '>', $now->format('H:i:s'));
                        });
                });
        }

        // Apply semester filter if provided
        if ($semester) {
            $query->whereHas('mataKuliah', function ($q) use ($semester) {
                $q->where('semester', $semester);
            });
        }

        // Apply blok filter if provided
        if ($blok) {
            $query->whereHas('mataKuliah', function ($q) use ($blok) {
                $q->where('blok', $blok);
            });
        }

        $jadwalPBL = $query->get();

        foreach ($jadwalPBL as $jadwal) {
            if ($jadwal->dosen_id) {
                $dosen = $jadwal->dosen;
                if ($dosen) {
                    // Check if dosen has valid email
                    $hasValidEmail = !empty($dosen->email) && filter_var($dosen->email, FILTER_VALIDATE_EMAIL);

                    // Check if dosen has valid WhatsApp phone (verification)
                    $hasValidWhatsApp = !empty($dosen->whatsapp_phone) && preg_match('/^62\d+$/', $dosen->whatsapp_phone);

                    // Create reminder notification based on type
                    if ($reminderType === 'unconfirmed') {
                        $title = 'Pengingat: Konfirmasi Ketersediaan PBL';
                        $message = "Pengingat: Silakan konfirmasi ketersediaan Anda untuk jadwal PBL {$jadwal->mataKuliah->nama} pada tanggal " .
                            date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                            str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                            " di ruangan {$jadwal->ruangan->nama}.";
                    } else { // upcoming
                        $title = 'Pengingat: Persiapan Mengajar PBL';
                        $message = "Pengingat: Anda memiliki jadwal PBL {$jadwal->mataKuliah->nama} pada tanggal " .
                            date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                            str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                            " di ruangan {$jadwal->ruangan->nama}. Silakan persiapkan diri untuk mengajar.";
                    }

                    Notification::create([
                        'user_id' => $dosen->id,
                        'title' => $title,
                        'message' => $message,
                        'type' => 'warning',
                        'is_read' => false,
                        'data' => [
                            'jadwal_id' => $jadwal->id,
                            'jadwal_type' => 'pbl',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'reminder' => true,
                            'reminder_type' => $reminderType
                        ]
                    ]);

                    // Send email reminder if dosen has valid email
                    if ($hasValidEmail) {
                        // Use the same email logic for both types
                        $this->sendEmailReminderConsistent($dosen, 'PBL', $jadwal, $reminderType);
                    }

                    // Prepare WhatsApp message if dosen has valid WhatsApp phone
                    if ($hasValidWhatsApp) {
                        // Send text message (both unconfirmed and upcoming use same approach)
                        $whatsappMessage = $this->buildWhatsAppMessageContent($dosen, 'PBL', $jadwal, $reminderType);
                        $whatsappMessages[] = [
                            'phone' => $dosen->whatsapp_phone,
                            'message' => $whatsappMessage,
                            'isGroup' => 'false',
                            'ref_id' => "reminder_pbl_{$jadwal->id}_{$dosen->id}_{$reminderType}"
                        ];
                    }

                    $reminderCount++;
                }
            }
        }

        return [
            'count' => $reminderCount,
            'whatsapp_messages' => $whatsappMessages
        ];
    }

    /**
     * Send Kuliah Besar reminder notifications
     */
    private function sendKuliahBesarReminders($reminderType = 'unconfirmed', $semester = null, $blok = null)
    {
        $reminderCount = 0;
        $whatsappMessages = [];

        // Get Kuliah Besar schedules based on reminder type
        $query = \App\Models\JadwalKuliahBesar::with(['mataKuliah', 'ruangan', 'dosen']);

        if ($reminderType === 'unconfirmed') {
            $query->where('status_konfirmasi', 'belum_konfirmasi');
        } elseif ($reminderType === 'upcoming') {
            $now = now();
            $query->where('status_konfirmasi', 'bisa')
                ->where('tanggal', '>=', $now->toDateString())
                ->where(function ($q) use ($now) {
                    $q->where('tanggal', '>', $now->toDateString())
                        ->orWhere(function ($q2) use ($now) {
                            $q2->where('tanggal', '=', $now->toDateString())
                                ->where('jam_mulai', '>', $now->format('H:i:s'));
                        });
                });
        }

        // Apply semester filter if provided
        if ($semester) {
            $query->whereHas('mataKuliah', function ($q) use ($semester) {
                $q->where('semester', $semester);
            });
        }

        // Apply blok filter if provided
        if ($blok) {
            $query->whereHas('mataKuliah', function ($q) use ($blok) {
                $q->where('blok', $blok);
            });
        }

        $jadwalKuliahBesar = $query->get();

        foreach ($jadwalKuliahBesar as $jadwal) {
            if ($jadwal->dosen_id) {
                $dosen = $jadwal->dosen;
                if ($dosen) {
                    // Check if dosen has valid email
                    $hasValidEmail = !empty($dosen->email) && filter_var($dosen->email, FILTER_VALIDATE_EMAIL);

                    // Check if dosen has valid WhatsApp phone (verification)
                    $hasValidWhatsApp = !empty($dosen->whatsapp_phone) && preg_match('/^62\d+$/', $dosen->whatsapp_phone);

                    // Create reminder notification based on type
                    if ($reminderType === 'unconfirmed') {
                        $title = 'Pengingat: Konfirmasi Ketersediaan Kuliah Besar';
                        $message = "Pengingat: Silakan konfirmasi ketersediaan Anda untuk jadwal Kuliah Besar {$jadwal->mataKuliah->nama} pada tanggal " .
                            date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                            str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                            " di ruangan {$jadwal->ruangan->nama}.";
                    } else { // upcoming
                        $title = 'Pengingat: Persiapan Mengajar Kuliah Besar';
                        $message = "Pengingat: Anda memiliki jadwal Kuliah Besar {$jadwal->mataKuliah->nama} pada tanggal " .
                            date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                            str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                            " di ruangan {$jadwal->ruangan->nama}. Silakan persiapkan diri untuk mengajar.";
                    }

                    Notification::create([
                        'user_id' => $dosen->id,
                        'title' => $title,
                        'message' => $message,
                        'type' => 'warning',
                        'is_read' => false,
                        'data' => [
                            'jadwal_id' => $jadwal->id,
                            'jadwal_type' => 'kuliah_besar',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'reminder' => true,
                            'reminder_type' => $reminderType
                        ]
                    ]);

                    // Send email reminder if dosen has valid email
                    if ($hasValidEmail) {
                        $this->sendEmailReminderConsistent($dosen, 'Kuliah Besar', $jadwal, $reminderType);
                    }

                    // Prepare WhatsApp message if dosen has valid WhatsApp phone
                    if ($hasValidWhatsApp) {
                        // Send text message (both unconfirmed and upcoming use same approach)
                        $whatsappMessage = $this->buildWhatsAppMessageContent($dosen, 'Kuliah Besar', $jadwal, $reminderType);
                        $whatsappMessages[] = [
                            'phone' => $dosen->whatsapp_phone,
                            'message' => $whatsappMessage,
                            'isGroup' => 'false',
                            'ref_id' => "reminder_kuliah_besar_{$jadwal->id}_{$dosen->id}_{$reminderType}"
                        ];
                    }

                    $reminderCount++;
                }
            }
        }

        return [
            'count' => $reminderCount,
            'whatsapp_messages' => $whatsappMessages
        ];
    }

    /**
     * Send Praktikum reminder notifications
     */
    private function sendPraktikumReminders($reminderType = 'unconfirmed', $semester = null, $blok = null)
    {
        $reminderCount = 0;
        $whatsappMessages = [];

        // Get Praktikum schedules based on reminder type
        $query = \App\Models\JadwalPraktikum::with(['mataKuliah', 'ruangan', 'dosen']);

        if ($reminderType === 'unconfirmed') {
            $query->whereHas('dosen', function ($q) {
                $q->where('status_konfirmasi', 'belum_konfirmasi');
            });
        } elseif ($reminderType === 'upcoming') {
            $now = now();
            $query->where('tanggal', '>=', $now->toDateString())
                ->where(function ($q) use ($now) {
                    $q->where('tanggal', '>', $now->toDateString())
                        ->orWhere(function ($q2) use ($now) {
                            $q2->where('tanggal', '=', $now->toDateString())
                                ->where('jam_mulai', '>', $now->format('H:i:s'));
                        });
                })
                ->whereHas('dosen', function ($q) {
                    $q->where('status_konfirmasi', 'bisa');
                });
        }

        // Apply semester filter if provided
        if ($semester) {
            $query->whereHas('mataKuliah', function ($q) use ($semester) {
                $q->where('semester', $semester);
            });
        }

        // Apply blok filter if provided
        if ($blok) {
            $query->whereHas('mataKuliah', function ($q) use ($blok) {
                $q->where('blok', $blok);
            });
        }

        $jadwalPraktikum = $query->get();

        foreach ($jadwalPraktikum as $jadwal) {
            if ($reminderType === 'unconfirmed') {
                $dosenList = $jadwal->dosen()->wherePivot('status_konfirmasi', 'belum_konfirmasi')->get();
            } else { // upcoming
                $dosenList = $jadwal->dosen()->wherePivot('status_konfirmasi', 'bisa')->get();
            }

            foreach ($dosenList as $dosen) {
                // Check if dosen has valid email
                $hasValidEmail = !empty($dosen->email) && filter_var($dosen->email, FILTER_VALIDATE_EMAIL);

                // Check if dosen has valid WhatsApp phone (verification)
                $hasValidWhatsApp = !empty($dosen->whatsapp_phone) && preg_match('/^62\d+$/', $dosen->whatsapp_phone);

                // Create reminder notification based on type
                if ($reminderType === 'unconfirmed') {
                    $title = 'Pengingat: Konfirmasi Ketersediaan Praktikum';
                    $message = "Pengingat: Silakan konfirmasi ketersediaan Anda untuk jadwal Praktikum {$jadwal->mataKuliah->nama} pada tanggal " .
                        date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                        str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                        " di ruangan {$jadwal->ruangan->nama}.";
                } else { // upcoming
                    $title = 'Pengingat: Persiapan Mengajar Praktikum';
                    $message = "Pengingat: Anda memiliki jadwal Praktikum {$jadwal->mataKuliah->nama} pada tanggal " .
                        date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                        str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                        " di ruangan {$jadwal->ruangan->nama}. Silakan persiapkan diri untuk mengajar.";
                }

                Notification::create([
                    'user_id' => $dosen->id,
                    'title' => $title,
                    'message' => $message,
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'praktikum',
                        'mata_kuliah' => $jadwal->mataKuliah->nama,
                        'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                        'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                        'ruangan' => $jadwal->ruangan->nama,
                        'reminder' => true,
                        'reminder_type' => $reminderType
                    ]
                ]);

                // Send email reminder if dosen has valid email
                if ($hasValidEmail) {
                    $this->sendEmailReminderConsistent($dosen, 'Praktikum', $jadwal, $reminderType);
                }

                // Prepare WhatsApp message if dosen has valid WhatsApp phone
                if ($hasValidWhatsApp) {
                    // Send text message (both unconfirmed and upcoming use same approach)
                    $whatsappMessage = $this->buildWhatsAppMessageContent($dosen, 'Praktikum', $jadwal, $reminderType);
                    $whatsappMessages[] = [
                        'phone' => $dosen->whatsapp_phone,
                        'message' => $whatsappMessage,
                        'isGroup' => 'false',
                        'ref_id' => "reminder_praktikum_{$jadwal->id}_{$dosen->id}_{$reminderType}"
                    ];
                }

                $reminderCount++;
            }
        }

        return [
            'count' => $reminderCount,
            'whatsapp_messages' => $whatsappMessages
        ];
    }

    /**
     * Send Jurnal Reading reminder notifications
     */
    private function sendJurnalReadingReminders($reminderType = 'unconfirmed', $semester = null, $blok = null)
    {
        $reminderCount = 0;
        $whatsappMessages = [];

        // Get Jurnal Reading schedules based on reminder type
        $query = \App\Models\JadwalJurnalReading::with(['mataKuliah', 'ruangan', 'dosen']);

        if ($reminderType === 'unconfirmed') {
            $query->where('status_konfirmasi', 'belum_konfirmasi');
        } elseif ($reminderType === 'upcoming') {
            $now = now();
            $query->where('status_konfirmasi', 'bisa')
                ->where('tanggal', '>=', $now->toDateString())
                ->where(function ($q) use ($now) {
                    $q->where('tanggal', '>', $now->toDateString())
                        ->orWhere(function ($q2) use ($now) {
                            $q2->where('tanggal', '=', $now->toDateString())
                                ->where('jam_mulai', '>', $now->format('H:i:s'));
                        });
                });
        }

        // Apply semester filter if provided
        if ($semester) {
            $query->whereHas('mataKuliah', function ($q) use ($semester) {
                $q->where('semester', $semester);
            });
        }

        // Apply blok filter if provided
        if ($blok) {
            $query->whereHas('mataKuliah', function ($q) use ($blok) {
                $q->where('blok', $blok);
            });
        }

        $jadwalJurnalReading = $query->get();

        foreach ($jadwalJurnalReading as $jadwal) {
            if ($jadwal->dosen_id) {
                $dosen = $jadwal->dosen;
                if ($dosen) {
                    // Check if dosen has valid email
                    $hasValidEmail = !empty($dosen->email) && filter_var($dosen->email, FILTER_VALIDATE_EMAIL);

                    // Check if dosen has valid WhatsApp phone (verification)
                    $hasValidWhatsApp = !empty($dosen->whatsapp_phone) && preg_match('/^62\d+$/', $dosen->whatsapp_phone);

                    // Create reminder notification based on type
                    if ($reminderType === 'unconfirmed') {
                        $title = 'Pengingat: Konfirmasi Ketersediaan Jurnal Reading';
                        $message = "Pengingat: Silakan konfirmasi ketersediaan Anda untuk jadwal Jurnal Reading {$jadwal->mataKuliah->nama} pada tanggal " .
                            date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                            str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                            " di ruangan {$jadwal->ruangan->nama}.";
                    } else { // upcoming
                        $title = 'Pengingat: Persiapan Mengajar Jurnal Reading';
                        $message = "Pengingat: Anda memiliki jadwal Jurnal Reading {$jadwal->mataKuliah->nama} pada tanggal " .
                            date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                            str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                            " di ruangan {$jadwal->ruangan->nama}. Silakan persiapkan diri untuk mengajar.";
                    }

                    Notification::create([
                        'user_id' => $dosen->id,
                        'title' => $title,
                        'message' => $message,
                        'type' => 'warning',
                        'is_read' => false,
                        'data' => [
                            'jadwal_id' => $jadwal->id,
                            'jadwal_type' => 'jurnal_reading',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'reminder' => true,
                            'reminder_type' => $reminderType
                        ]
                    ]);

                    // Send email reminder if dosen has valid email
                    if ($hasValidEmail) {
                        $this->sendEmailReminderConsistent($dosen, 'Jurnal Reading', $jadwal, $reminderType);
                    }

                    // Prepare WhatsApp message if dosen has valid WhatsApp phone
                    if ($hasValidWhatsApp) {
                        // Send text message (both unconfirmed and upcoming use same approach)
                        $whatsappMessage = $this->buildWhatsAppMessageContent($dosen, 'Jurnal Reading', $jadwal, $reminderType);
                        $whatsappMessages[] = [
                            'phone' => $dosen->whatsapp_phone,
                            'message' => $whatsappMessage,
                            'isGroup' => 'false',
                            'ref_id' => "reminder_jurnal_reading_{$jadwal->id}_{$dosen->id}_{$reminderType}"
                        ];
                    }

                    $reminderCount++;
                }
            }
        }

        return [
            'count' => $reminderCount,
            'whatsapp_messages' => $whatsappMessages
        ];
    }

    /**
     * Send CSR reminder notifications
     */
    private function sendCSRReminders($reminderType = 'unconfirmed', $semester = null, $blok = null)
    {
        $reminderCount = 0;
        $whatsappMessages = [];

        // Get CSR schedules based on reminder type
        $query = \App\Models\JadwalCSR::with(['kategori', 'ruangan', 'dosen']);

        if ($reminderType === 'unconfirmed') {
            $query->where('status_konfirmasi', 'belum_konfirmasi');
        } elseif ($reminderType === 'upcoming') {
            $now = now();
            $query->where('status_konfirmasi', 'bisa')
                ->where('tanggal', '>=', $now->toDateString())
                ->where(function ($q) use ($now) {
                    $q->where('tanggal', '>', $now->toDateString())
                        ->orWhere(function ($q2) use ($now) {
                            $q2->where('tanggal', '=', $now->toDateString())
                                ->where('jam_mulai', '>', $now->format('H:i:s'));
                        });
                });
        }

        // Apply semester filter if provided
        if ($semester) {
            $query->whereHas('kategori', function ($q) use ($semester) {
                $q->where('semester', $semester);
            });
        }

        // Apply blok filter if provided
        if ($blok) {
            $query->whereHas('kategori', function ($q) use ($blok) {
                $q->where('blok', $blok);
            });
        }

        $jadwalCSR = $query->get();

        foreach ($jadwalCSR as $jadwal) {
            if ($jadwal->dosen_id) {
                $dosen = $jadwal->dosen;
                if ($dosen) {
                    // Check if dosen has valid email
                    $hasValidEmail = !empty($dosen->email) && filter_var($dosen->email, FILTER_VALIDATE_EMAIL);

                    // Check if dosen has valid WhatsApp phone (verification)
                    $hasValidWhatsApp = !empty($dosen->whatsapp_phone) && preg_match('/^62\d+$/', $dosen->whatsapp_phone);

                    // Create reminder notification based on type
                    if ($reminderType === 'unconfirmed') {
                        $title = 'Pengingat: Konfirmasi Ketersediaan CSR';
                        $message = "Pengingat: Silakan konfirmasi ketersediaan Anda untuk jadwal CSR {$jadwal->kategori->nama} pada tanggal " .
                            date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                            str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                            " di ruangan {$jadwal->ruangan->nama}.";
                    } else { // upcoming
                        $title = 'Pengingat: Persiapan Mengajar CSR';
                        $message = "Pengingat: Anda memiliki jadwal CSR {$jadwal->kategori->nama} pada tanggal " .
                            date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                            str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                            " di ruangan {$jadwal->ruangan->nama}. Silakan persiapkan diri untuk mengajar.";
                    }

                    Notification::create([
                        'user_id' => $dosen->id,
                        'title' => $title,
                        'message' => $message,
                        'type' => 'warning',
                        'is_read' => false,
                        'data' => [
                            'jadwal_id' => $jadwal->id,
                            'jadwal_type' => 'csr',
                            'mata_kuliah' => $jadwal->kategori->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'reminder' => true,
                            'reminder_type' => $reminderType
                        ]
                    ]);

                    // Send email reminder if dosen has valid email
                    if ($hasValidEmail) {
                        $this->sendEmailReminderConsistent($dosen, 'CSR', $jadwal, $reminderType);
                    }

                    // Prepare WhatsApp message if dosen has valid WhatsApp phone
                    if ($hasValidWhatsApp) {
                        // Send text message (both unconfirmed and upcoming use same approach)
                        $whatsappMessage = $this->buildWhatsAppMessageContent($dosen, 'CSR', $jadwal, $reminderType);
                        $whatsappMessages[] = [
                            'phone' => $dosen->whatsapp_phone,
                            'message' => $whatsappMessage,
                            'isGroup' => 'false',
                            'ref_id' => "reminder_csr_{$jadwal->id}_{$dosen->id}_{$reminderType}"
                        ];
                    }

                    $reminderCount++;
                }
            }
        }

        return [
            'count' => $reminderCount,
            'whatsapp_messages' => $whatsappMessages
        ];
    }

    /**
     * Send Non Blok Non CSR reminder notifications
     */
    private function sendNonBlokNonCSRReminders($reminderType = 'unconfirmed', $semester = null, $blok = null)
    {
        $reminderCount = 0;
        $whatsappMessages = [];

        // Get Non Blok Non CSR schedules based on reminder type
        $query = \App\Models\JadwalNonBlokNonCSR::with(['mataKuliah', 'ruangan', 'dosen']);

        if ($reminderType === 'unconfirmed') {
            $query->where('status_konfirmasi', 'belum_konfirmasi');
        } elseif ($reminderType === 'upcoming') {
            $now = now();
            $query->where('status_konfirmasi', 'bisa')
                ->where('tanggal', '>=', $now->toDateString())
                ->where(function ($q) use ($now) {
                    $q->where('tanggal', '>', $now->toDateString())
                        ->orWhere(function ($q2) use ($now) {
                            $q2->where('tanggal', '=', $now->toDateString())
                                ->where('jam_mulai', '>', $now->format('H:i:s'));
                        });
                });
        }

        // Apply semester filter if provided
        if ($semester) {
            $query->whereHas('mataKuliah', function ($q) use ($semester) {
                $q->where('semester', $semester);
            });
        }

        // Apply blok filter if provided
        if ($blok) {
            $query->whereHas('mataKuliah', function ($q) use ($blok) {
                $q->where('blok', $blok);
            });
        }

        $jadwalNonBlokNonCSR = $query->get();

        foreach ($jadwalNonBlokNonCSR as $jadwal) {
            if ($jadwal->dosen_id) {
                $dosen = $jadwal->dosen;
                if ($dosen) {
                    // Check if dosen has valid email
                    $hasValidEmail = !empty($dosen->email) && filter_var($dosen->email, FILTER_VALIDATE_EMAIL);

                    // Check if dosen has valid WhatsApp phone (verification)
                    $hasValidWhatsApp = !empty($dosen->whatsapp_phone) && preg_match('/^62\d+$/', $dosen->whatsapp_phone);

                    // Create reminder notification based on type
                    if ($reminderType === 'unconfirmed') {
                        $title = 'Pengingat: Konfirmasi Ketersediaan Non Blok Non CSR';
                        $message = "Pengingat: Silakan konfirmasi ketersediaan Anda untuk jadwal Non Blok Non CSR {$jadwal->mataKuliah->nama} pada tanggal " .
                            date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                            str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                            " di ruangan {$jadwal->ruangan->nama}.";
                    } else { // upcoming
                        $title = 'Pengingat: Persiapan Mengajar Non Blok Non CSR';
                        $message = "Pengingat: Anda memiliki jadwal Non Blok Non CSR {$jadwal->mataKuliah->nama} pada tanggal " .
                            date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                            str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                            " di ruangan {$jadwal->ruangan->nama}. Silakan persiapkan diri untuk mengajar.";
                    }

                    Notification::create([
                        'user_id' => $dosen->id,
                        'title' => $title,
                        'message' => $message,
                        'type' => 'warning',
                        'is_read' => false,
                        'data' => [
                            'jadwal_id' => $jadwal->id,
                            'jadwal_type' => 'non_blok_non_csr',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'reminder' => true,
                            'reminder_type' => $reminderType
                        ]
                    ]);

                    // Send email reminder if dosen has valid email
                    if ($hasValidEmail) {
                        $this->sendEmailReminderConsistent($dosen, 'Non Blok Non CSR', $jadwal, $reminderType);
                    }

                    // Prepare WhatsApp message if dosen has valid WhatsApp phone
                    if ($hasValidWhatsApp) {
                        // Send text message (both unconfirmed and upcoming use same approach)
                        $whatsappMessage = $this->buildWhatsAppMessageContent($dosen, 'Non Blok Non CSR', $jadwal, $reminderType);
                        $whatsappMessages[] = [
                            'phone' => $dosen->whatsapp_phone,
                            'message' => $whatsappMessage,
                            'isGroup' => 'false',
                            'ref_id' => "reminder_non_blok_non_csr_{$jadwal->id}_{$dosen->id}_{$reminderType}"
                        ];
                    }

                    $reminderCount++;
                }
            }
        }

        return [
            'count' => $reminderCount,
            'whatsapp_messages' => $whatsappMessages
        ];
    }

    /**
     * Send Persamaan Persepsi reminder notifications
     * Note: Persamaan Persepsi langsung "bisa" (tidak perlu konfirmasi), jadi hanya kirim "upcoming" reminder
     */
    private function sendPersamaanPersepsiReminders($reminderType = 'upcoming', $semester = null, $blok = null)
    {
        $reminderCount = 0;
        $whatsappMessages = [];

        // Get Persamaan Persepsi schedules - hanya upcoming (karena langsung "bisa")
        $now = now();
        $query = \App\Models\JadwalPersamaanPersepsi::with(['mataKuliah', 'ruangan'])
            ->where('status_konfirmasi', 'bisa')
            ->where('tanggal', '>=', $now->toDateString())
            ->where(function ($q) use ($now) {
                $q->where('tanggal', '>', $now->toDateString())
                    ->orWhere(function ($q2) use ($now) {
                        $q2->where('tanggal', '=', $now->toDateString())
                            ->where('jam_mulai', '>', $now->format('H:i:s'));
                    });
            });

        // Apply semester filter if provided
        if ($semester) {
            $query->whereHas('mataKuliah', function ($q) use ($semester) {
                $q->where('semester', $semester);
            });
        }

        // Apply blok filter if provided
        if ($blok) {
            $query->whereHas('mataKuliah', function ($q) use ($blok) {
                $q->where('blok', $blok);
            });
        }

        $jadwalPersamaanPersepsi = $query->get();

        foreach ($jadwalPersamaanPersepsi as $jadwal) {
            // Get all dosen (koordinator + pengampu)
            $allDosenIds = array_unique(array_merge(
                $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : [],
                $jadwal->dosen_ids && is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : []
            ));

            foreach ($allDosenIds as $dosenId) {
                $dosen = \App\Models\User::find($dosenId);
                if (!$dosen) {
                    continue;
                }

                // Check if dosen has valid email
                $hasValidEmail = !empty($dosen->email) && filter_var($dosen->email, FILTER_VALIDATE_EMAIL);

                // Check if dosen has valid WhatsApp phone (verification)
                $hasValidWhatsApp = !empty($dosen->whatsapp_phone) && preg_match('/^62\d+$/', $dosen->whatsapp_phone);

                // Persamaan Persepsi langsung "bisa", jadi hanya kirim reminder persiapan mengajar
                $ruanganNama = $jadwal->ruangan ? $jadwal->ruangan->nama : 'Online';
                $ruanganInfo = $jadwal->use_ruangan && $jadwal->ruangan
                    ? "di ruangan {$ruanganNama}"
                    : "secara online";

                // Cek apakah dosen adalah koordinator atau pengampu
                $isKoordinator = $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) && in_array($dosenId, $jadwal->koordinator_ids);

                // Ambil daftar pengampu untuk koordinator
                $pengampuList = [];
                if ($isKoordinator && $jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
                    $pengampuIds = array_diff($jadwal->dosen_ids, $jadwal->koordinator_ids ?? []);
                    if (!empty($pengampuIds)) {
                        $pengampuList = \App\Models\User::whereIn('id', $pengampuIds)
                            ->pluck('name')
                            ->toArray();
                    }
                }

                // Ambil daftar koordinator untuk pengampu
                $koordinatorList = [];
                if (!$isKoordinator && $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) && !empty($jadwal->koordinator_ids)) {
                    $koordinatorList = \App\Models\User::whereIn('id', $jadwal->koordinator_ids)
                        ->pluck('name')
                        ->toArray();
                }

                // Buat pesan berbeda untuk koordinator dan pengampu
                if ($isKoordinator) {
                    $title = 'Pengingat: Persiapan Mengajar Persamaan Persepsi - Koordinator';
                    $message = "Pengingat: Anda sebagai koordinator dosen memiliki jadwal Persamaan Persepsi {$jadwal->mataKuliah->nama} pada tanggal " .
                        date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                        str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                        " {$ruanganInfo}.";
                    if (!empty($pengampuList)) {
                        $message .= " Dosen pengampu: " . implode(', ', $pengampuList) . ".";
                    }
                    $message .= " Silakan persiapkan diri untuk mengajar.";
                } else {
                    $title = 'Pengingat: Persiapan Mengajar Persamaan Persepsi';
                    $message = "Pengingat: Anda memiliki jadwal Persamaan Persepsi {$jadwal->mataKuliah->nama} pada tanggal " .
                        date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                        str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                        " {$ruanganInfo}.";
                    if (!empty($koordinatorList)) {
                        $message .= " Koordinator dosen: " . implode(', ', $koordinatorList) . ".";
                    }
                    $message .= " Silakan persiapkan diri untuk mengajar.";
                }

                Notification::create([
                    'user_id' => $dosen->id,
                    'title' => $title,
                    'message' => $message,
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'persamaan_persepsi',
                        'mata_kuliah' => $jadwal->mataKuliah->nama,
                        'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                        'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                        'ruangan' => $ruanganNama,
                        'ruangan_info' => $ruanganInfo,
                        'reminder' => true,
                        'reminder_type' => 'upcoming'
                    ]
                ]);

                // Send email reminder if dosen has valid email
                if ($hasValidEmail) {
                    // Custom email untuk Persamaan Persepsi dengan pembedaan koordinator
                    try {
                        $subject = $isKoordinator
                            ? "Pengingat: Persiapan Mengajar Persamaan Persepsi - Koordinator"
                            : "Pengingat: Persiapan Mengajar Persamaan Persepsi";

                        // Ambil daftar pengampu untuk koordinator
                        $pengampuList = [];
                        if ($isKoordinator && $jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
                            $pengampuIds = array_diff($jadwal->dosen_ids, $jadwal->koordinator_ids ?? []);
                            if (!empty($pengampuIds)) {
                                $pengampuList = \App\Models\User::whereIn('id', $pengampuIds)
                                    ->pluck('name')
                                    ->toArray();
                            }
                        }

                        // Ambil daftar koordinator untuk pengampu
                        $koordinatorList = [];
                        if (!$isKoordinator && $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) && !empty($jadwal->koordinator_ids)) {
                            $koordinatorList = \App\Models\User::whereIn('id', $jadwal->koordinator_ids)
                                ->pluck('name')
                                ->toArray();
                        }

                        Mail::send('emails.reminder-notification', [
                            'dosen' => $dosen,
                            'jadwal' => $jadwal,
                            'jadwalType' => 'Persamaan Persepsi',
                            'reminderType' => 'upcoming',
                            'isKoordinator' => $isKoordinator,
                            'pengampuList' => $pengampuList,
                            'koordinatorList' => $koordinatorList
                        ], function ($message) use ($dosen, $subject) {
                            $message->to($dosen->email, $dosen->name)
                                ->subject($subject)
                                ->from(env('MAIL_FROM_ADDRESS'), 'Pengingat Dari ISME (Integrated System Medical Education Fakultas Kedokteran dan Kesehatan Universitas Muhammadiyah Jakarta)');
                        });

                        \Log::info("Email reminder sent to {$dosen->name} ({$dosen->email}) for Persamaan Persepsi - Type: upcoming" . ($isKoordinator ? " (Koordinator)" : ""));
                    } catch (\Exception $e) {
                        \Log::error("Failed to send email reminder to {$dosen->name}: " . $e->getMessage());
                    }
                }

                // Prepare WhatsApp message if dosen has valid WhatsApp phone
                if ($hasValidWhatsApp) {
                    // Custom WhatsApp message untuk Persamaan Persepsi dengan pembedaan koordinator
                    $greeting = "Halo {$dosen->name},";
                    $intro = $isKoordinator
                        ? "Ini adalah pengingat untuk persiapan mengajar jadwal Anda sebagai koordinator dosen yang akan datang."
                        : "Ini adalah pengingat untuk persiapan mengajar jadwal Anda yang akan datang.";

                    $details = "📋 *Detail Jadwal Persamaan Persepsi*\n\n";
                    $details .= "• *Jadwal:* {$jadwal->mataKuliah->nama}\n";
                    $details .= "• *Tanggal:* " . date('d/m/Y', strtotime($jadwal->tanggal)) . "\n";
                    $details .= "• *Waktu:* " . str_replace(':', '.', $jadwal->jam_mulai) . " - " . str_replace(':', '.', $jadwal->jam_selesai) . "\n";

                    if (isset($jadwal->mataKuliah) && $jadwal->mataKuliah) {
                        $details .= "• *Semester & Blok:* Semester {$jadwal->mataKuliah->semester}";
                        if ($jadwal->mataKuliah->blok) {
                            $details .= " - Blok {$jadwal->mataKuliah->blok}";
                        }
                        $details .= "\n";
                    }

                    // Tambahkan daftar koordinator untuk pengampu
                    if (!$isKoordinator && $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) && !empty($jadwal->koordinator_ids)) {
                        $koordinatorList = \App\Models\User::whereIn('id', $jadwal->koordinator_ids)
                            ->pluck('name')
                            ->toArray();
                        if (!empty($koordinatorList)) {
                            $details .= "• *Koordinator Dosen:* " . implode(', ', $koordinatorList) . "\n";
                        }
                    }

                    // Tampilkan ruangan dengan tipe (online/offline)
                    if ($jadwal->use_ruangan && $jadwal->ruangan) {
                        $details .= "• *Ruangan:* {$ruanganNama} (Offline)\n";
                    } else {
                        $details .= "• *Ruangan:* Online\n";
                    }

                    if (isset($jadwal->topik) && $jadwal->topik) {
                        $details .= "• *Topik:* {$jadwal->topik}\n";
                    }

                    // Tambahkan daftar pengampu untuk koordinator
                    if ($isKoordinator && $jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
                        $pengampuIds = array_diff($jadwal->dosen_ids, $jadwal->koordinator_ids ?? []);
                        if (!empty($pengampuIds)) {
                            $pengampuList = \App\Models\User::whereIn('id', $pengampuIds)
                                ->pluck('name')
                                ->toArray();
                            if (!empty($pengampuList)) {
                                $details .= "\n👥 *Dosen Pengampu:*\n";
                                foreach ($pengampuList as $index => $pengampuName) {
                                    $details .= "   " . ($index + 1) . ". {$pengampuName}\n";
                                }
                            }
                        }
                    }

                    $footer = "\nSilakan persiapkan diri untuk mengajar.\n\n";
                    $footer .= "Terima kasih,\n";
                    $footer .= "Tim Akademik FKK UMJ";

                    $whatsappMessage = "{$greeting}\n\n{$intro}\n\n{$details}\n{$footer}";

                    $whatsappMessages[] = [
                        'phone' => $dosen->whatsapp_phone,
                        'message' => $whatsappMessage,
                        'isGroup' => 'false',
                        'ref_id' => "reminder_persamaan_persepsi_{$jadwal->id}_{$dosen->id}_upcoming"
                    ];
                }

                $reminderCount++;
            }
        }

        return [
            'count' => $reminderCount,
            'whatsapp_messages' => $whatsappMessages
        ];
    }

    /**
     * Send Persamaan Persepsi reminder to specific dosen only
     * Used when sending reminder based on jadwal_dosen_pairs (selected dosen)
     */
    private function sendPersamaanPersepsiReminderToSpecificDosen($jadwal, $dosenId, $reminderType = 'upcoming')
    {
        $reminderCount = 0;
        $whatsappMessages = [];

        $dosen = \App\Models\User::find($dosenId);
        if (!$dosen) {
            return [
                'count' => 0,
                'whatsapp_messages' => []
            ];
        }

        // Check if dosen has valid email
        $hasValidEmail = !empty($dosen->email) && filter_var($dosen->email, FILTER_VALIDATE_EMAIL);

        // Check if dosen has valid WhatsApp phone (verification)
        $hasValidWhatsApp = !empty($dosen->whatsapp_phone) && preg_match('/^62\d+$/', $dosen->whatsapp_phone);

        // Persamaan Persepsi langsung "bisa", jadi hanya kirim reminder persiapan mengajar
        $ruanganNama = $jadwal->ruangan ? $jadwal->ruangan->nama : 'Online';
        $ruanganInfo = $jadwal->use_ruangan && $jadwal->ruangan
            ? "di ruangan {$ruanganNama}"
            : "secara online";

        // Cek apakah dosen adalah koordinator atau pengampu
        $isKoordinator = $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) && in_array($dosenId, $jadwal->koordinator_ids);

        // Ambil daftar pengampu untuk koordinator
        $pengampuList = [];
        if ($isKoordinator && $jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $pengampuIds = array_diff($jadwal->dosen_ids, $jadwal->koordinator_ids ?? []);
            if (!empty($pengampuIds)) {
                $pengampuList = \App\Models\User::whereIn('id', $pengampuIds)
                    ->pluck('name')
                    ->toArray();
            }
        }

        // Ambil daftar koordinator untuk pengampu
        $koordinatorList = [];
        if (!$isKoordinator && $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) && !empty($jadwal->koordinator_ids)) {
            $koordinatorList = \App\Models\User::whereIn('id', $jadwal->koordinator_ids)
                ->pluck('name')
                ->toArray();
        }

        // Buat pesan berbeda untuk koordinator dan pengampu
        if ($isKoordinator) {
            $title = 'Pengingat: Persiapan Mengajar Persamaan Persepsi - Koordinator';
            $message = "Pengingat: Anda sebagai koordinator dosen memiliki jadwal Persamaan Persepsi {$jadwal->mataKuliah->nama} pada tanggal " .
                date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                " {$ruanganInfo}.";
            if (!empty($pengampuList)) {
                $message .= " Dosen pengampu: " . implode(', ', $pengampuList) . ".";
            }
            $message .= " Silakan persiapkan diri untuk mengajar.";
        } else {
            $title = 'Pengingat: Persiapan Mengajar Persamaan Persepsi';
            $message = "Pengingat: Anda memiliki jadwal Persamaan Persepsi {$jadwal->mataKuliah->nama} pada tanggal " .
                date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                " {$ruanganInfo}.";
            if (!empty($koordinatorList)) {
                $message .= " Koordinator dosen: " . implode(', ', $koordinatorList) . ".";
            }
            $message .= " Silakan persiapkan diri untuk mengajar.";
        }

        Notification::create([
            'user_id' => $dosen->id,
            'title' => $title,
            'message' => $message,
            'type' => 'info',
            'is_read' => false,
            'data' => [
                'jadwal_id' => $jadwal->id,
                'jadwal_type' => 'persamaan_persepsi',
                'mata_kuliah' => $jadwal->mataKuliah->nama,
                'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                'ruangan' => $ruanganNama,
                'ruangan_info' => $ruanganInfo,
                'reminder' => true,
                'reminder_type' => 'upcoming'
            ]
        ]);

        // Send email reminder if dosen has valid email
        if ($hasValidEmail) {
            try {
                $subject = $isKoordinator
                    ? "Pengingat: Persiapan Mengajar Persamaan Persepsi - Koordinator"
                    : "Pengingat: Persiapan Mengajar Persamaan Persepsi";

                Mail::send('emails.reminder-notification', [
                    'dosen' => $dosen,
                    'jadwal' => $jadwal,
                    'jadwalType' => 'Persamaan Persepsi',
                    'reminderType' => 'upcoming',
                    'isKoordinator' => $isKoordinator,
                    'pengampuList' => $pengampuList,
                    'koordinatorList' => $koordinatorList
                ], function ($message) use ($dosen, $subject) {
                    $message->to($dosen->email, $dosen->name)
                        ->subject($subject)
                        ->from(env('MAIL_FROM_ADDRESS'), 'Pengingat Dari ISME (Integrated System Medical Education Fakultas Kedokteran dan Kesehatan Universitas Muhammadiyah Jakarta)');
                });

                \Log::info("Email reminder sent to {$dosen->name} ({$dosen->email}) for Persamaan Persepsi - Type: upcoming" . ($isKoordinator ? " (Koordinator)" : ""));
            } catch (\Exception $e) {
                \Log::error("Failed to send email reminder to {$dosen->name}: " . $e->getMessage());
            }
        }

        // Prepare WhatsApp message if dosen has valid WhatsApp phone
        if ($hasValidWhatsApp) {
            $greeting = "Halo {$dosen->name},";
            $intro = $isKoordinator
                ? "Ini adalah pengingat untuk persiapan mengajar jadwal Anda sebagai koordinator dosen yang akan datang."
                : "Ini adalah pengingat untuk persiapan mengajar jadwal Anda yang akan datang.";

            $details = "📋 *Detail Jadwal Persamaan Persepsi*\n\n";
            $details .= "• *Jadwal:* {$jadwal->mataKuliah->nama}\n";
            $details .= "• *Tanggal:* " . date('d/m/Y', strtotime($jadwal->tanggal)) . "\n";
            $details .= "• *Waktu:* " . str_replace(':', '.', $jadwal->jam_mulai) . " - " . str_replace(':', '.', $jadwal->jam_selesai) . "\n";

            if (isset($jadwal->mataKuliah) && $jadwal->mataKuliah) {
                $details .= "• *Semester & Blok:* Semester {$jadwal->mataKuliah->semester}";
                if ($jadwal->mataKuliah->blok) {
                    $details .= " - Blok {$jadwal->mataKuliah->blok}";
                }
                $details .= "\n";
            }

            // Tambahkan daftar koordinator untuk pengampu
            if (!$isKoordinator && !empty($koordinatorList)) {
                $details .= "• *Koordinator Dosen:* " . implode(', ', $koordinatorList) . "\n";
            }

            // Tampilkan ruangan dengan tipe (online/offline)
            if ($jadwal->use_ruangan && $jadwal->ruangan) {
                $details .= "• *Ruangan:* {$ruanganNama} (Offline)\n";
            } else {
                $details .= "• *Ruangan:* Online\n";
            }

            if (isset($jadwal->topik) && $jadwal->topik) {
                $details .= "• *Topik:* {$jadwal->topik}\n";
            }

            // Tambahkan daftar pengampu untuk koordinator
            if ($isKoordinator && !empty($pengampuList)) {
                $details .= "\n👥 *Dosen Pengampu:*\n";
                foreach ($pengampuList as $index => $pengampuName) {
                    $details .= "   " . ($index + 1) . ". {$pengampuName}\n";
                }
            }

            $footer = "\nSilakan persiapkan diri untuk mengajar.\n\n";
            $footer .= "Terima kasih,\n";
            $footer .= "Tim Akademik FKK UMJ";

            $whatsappMessage = "{$greeting}\n\n{$intro}\n\n{$details}\n{$footer}";

            $whatsappMessages[] = [
                'phone' => $dosen->whatsapp_phone,
                'message' => $whatsappMessage,
                'isGroup' => 'false',
                'ref_id' => "reminder_persamaan_persepsi_{$jadwal->id}_{$dosen->id}_upcoming"
            ];
        }

        $reminderCount++;

        return [
            'count' => $reminderCount,
            'whatsapp_messages' => $whatsappMessages
        ];
    }

    /**
     * Get list of dosen with belum_konfirmasi status and email verified
     */
    public function getPendingDosen(Request $request)
    {
        // Check if user is admin or tim akademik
        if (!Auth::user() || !in_array(Auth::user()->role, ['admin', 'super_admin', 'tim_akademik'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $pendingDosen = [];
            $jadwalTypes = ['pbl', 'kuliah_besar', 'praktikum', 'jurnal_reading', 'csr', 'non_blok_non_csr', 'persamaan_persepsi'];

            // Get filter parameters
            $semester = $request->get('semester');
            $blok = $request->get('blok');
            $page = $request->get('page', 1);
            $pageSize = $request->get('page_size', 5);
            $reminderType = $request->get('reminder_type', 'all'); // 'unconfirmed', 'upcoming', 'all'

            foreach ($jadwalTypes as $jadwalType) {
                // Get unconfirmed dosen
                if ($reminderType === 'all' || $reminderType === 'unconfirmed') {
                    $typeDosen = $this->getPendingDosenForJadwalType($jadwalType, $semester, $blok, 'unconfirmed');
                    $pendingDosen = array_merge($pendingDosen, $typeDosen);
                }

                // Get upcoming confirmed dosen
                if ($reminderType === 'all' || $reminderType === 'upcoming') {
                    $typeDosen = $this->getPendingDosenForJadwalType($jadwalType, $semester, $blok, 'upcoming');
                    $pendingDosen = array_merge($pendingDosen, $typeDosen);
                }
            }

            // Tidak perlu filter email_verified, tampilkan semua dosen yang belum konfirmasi
            // Filter email_verified hanya untuk pengiriman email, bukan untuk menampilkan list

            // Remove duplicates based on dosen_id + jadwal_type + jadwal_id
            // This allows the same dosen to appear multiple times if they have different jadwal types
            $uniqueDosen = [];
            $seenKeys = [];
            foreach ($pendingDosen as $dosen) {
                $key = $dosen['dosen_id'] . '_' . $dosen['jadwal_type'] . '_' . $dosen['jadwal_id'];
                if (!in_array($key, $seenKeys)) {
                    $uniqueDosen[] = $dosen;
                    $seenKeys[] = $key;
                }
            }

            // Apply pagination
            $total = count($uniqueDosen);
            $offset = ($page - 1) * $pageSize;
            $paginatedDosen = array_slice($uniqueDosen, $offset, $pageSize);

            return response()->json([
                'pending_dosen' => $paginatedDosen,
                'total' => $total,
                'current_page' => $page,
                'per_page' => $pageSize,
                'last_page' => ceil($total / $pageSize)
            ]);
        } catch (\Exception $e) {
            \Log::error('Error getting pending dosen: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil daftar dosen',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get pending dosen for specific jadwal type
     */
    private function getPendingDosenForJadwalType($jadwalType, $semester = null, $blok = null, $reminderType = 'unconfirmed')
    {
        $pendingDosen = [];

        if ($reminderType === 'unconfirmed') {
            $pendingDosen = $this->getUnconfirmedDosenForJadwalType($jadwalType, $semester, $blok);
        } elseif ($reminderType === 'upcoming') {
            $pendingDosen = $this->getUpcomingDosenForJadwalType($jadwalType, $semester, $blok);
        }

        return $pendingDosen;
    }

    /**
     * Get unconfirmed dosen for specific jadwal type
     */
    private function getUnconfirmedDosenForJadwalType($jadwalType, $semester = null, $blok = null)
    {
        $pendingDosen = [];

        switch ($jadwalType) {
            case 'pbl':
                $query = \App\Models\JadwalPBL::with(['mataKuliah', 'ruangan', 'dosen'])
                    ->where('status_konfirmasi', 'belum_konfirmasi');

                // Apply semester filter if provided
                if ($semester) {
                    $query->whereHas('mataKuliah', function ($q) use ($semester) {
                        $q->where('semester', $semester);
                    });
                }

                // Apply blok filter if provided (blok ada di tabel mata_kuliah)
                if ($blok) {
                    $query->whereHas('mataKuliah', function ($q) use ($blok) {
                        $q->where('blok', $blok);
                    });
                }

                $jadwalPBL = $query->get();

                foreach ($jadwalPBL as $jadwal) {
                    if ($jadwal->dosen_id && $jadwal->dosen) {
                        $pendingDosen[] = [
                            'dosen_id' => $jadwal->dosen_id,
                            'name' => $jadwal->dosen->name,
                            'email' => $jadwal->dosen->email,
                            'email_verified' => $jadwal->dosen->email_verified ?? false,
                            'whatsapp_phone' => $jadwal->dosen->whatsapp_phone ?? null,
                            'jadwal_type' => 'PBL',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'jadwal_id' => $jadwal->id,
                            'reminder_type' => 'unconfirmed'
                        ];
                    }
                }
                break;

            case 'kuliah_besar':
                $query = \App\Models\JadwalKuliahBesar::with(['mataKuliah', 'ruangan', 'dosen'])
                    ->where('status_konfirmasi', 'belum_konfirmasi');

                // Apply semester filter if provided
                if ($semester) {
                    $query->whereHas('mataKuliah', function ($q) use ($semester) {
                        $q->where('semester', $semester);
                    });
                }

                // Apply blok filter if provided (blok ada di tabel mata_kuliah)
                if ($blok) {
                    $query->whereHas('mataKuliah', function ($q) use ($blok) {
                        $q->where('blok', $blok);
                    });
                }

                $jadwalKuliahBesar = $query->get();

                foreach ($jadwalKuliahBesar as $jadwal) {
                    if ($jadwal->dosen_id && $jadwal->dosen) {
                        $pendingDosen[] = [
                            'dosen_id' => $jadwal->dosen_id,
                            'name' => $jadwal->dosen->name,
                            'email' => $jadwal->dosen->email,
                            'email_verified' => $jadwal->dosen->email_verified ?? false,
                            'jadwal_type' => 'Kuliah Besar',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'jadwal_id' => $jadwal->id,
                            'reminder_type' => 'unconfirmed'
                        ];
                    }
                }
                break;

            case 'praktikum':
                $query = \App\Models\JadwalPraktikum::with(['mataKuliah', 'ruangan', 'dosen'])
                    ->whereHas('dosen', function ($query) {
                        $query->where('status_konfirmasi', 'belum_konfirmasi');
                    });

                // Apply semester filter if provided
                if ($semester) {
                    $query->whereHas('mataKuliah', function ($q) use ($semester) {
                        $q->where('semester', $semester);
                    });
                }

                // Apply blok filter if provided (blok ada di tabel mata_kuliah)
                if ($blok) {
                    $query->whereHas('mataKuliah', function ($q) use ($blok) {
                        $q->where('blok', $blok);
                    });
                }

                $jadwalPraktikum = $query->get();

                foreach ($jadwalPraktikum as $jadwal) {
                    $dosenList = $jadwal->dosen()->wherePivot('status_konfirmasi', 'belum_konfirmasi')->get();

                    foreach ($dosenList as $dosen) {
                        $pendingDosen[] = [
                            'dosen_id' => $dosen->id,
                            'name' => $dosen->name,
                            'email' => $dosen->email,
                            'email_verified' => $dosen->email_verified ?? false,
                            'whatsapp_phone' => $dosen->whatsapp_phone ?? null,
                            'jadwal_type' => 'Praktikum',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'jadwal_id' => $jadwal->id,
                            'reminder_type' => 'unconfirmed'
                        ];
                    }
                }
                break;

            case 'jurnal_reading':
                $query = \App\Models\JadwalJurnalReading::with(['mataKuliah', 'ruangan', 'dosen'])
                    ->where('status_konfirmasi', 'belum_konfirmasi');

                // Apply semester filter if provided
                if ($semester) {
                    $query->whereHas('mataKuliah', function ($q) use ($semester) {
                        $q->where('semester', $semester);
                    });
                }

                // Apply blok filter if provided (blok ada di tabel mata_kuliah)
                if ($blok) {
                    $query->whereHas('mataKuliah', function ($q) use ($blok) {
                        $q->where('blok', $blok);
                    });
                }

                $jadwalJurnalReading = $query->get();

                foreach ($jadwalJurnalReading as $jadwal) {
                    if ($jadwal->dosen_id && $jadwal->dosen) {
                        $pendingDosen[] = [
                            'dosen_id' => $jadwal->dosen_id,
                            'name' => $jadwal->dosen->name,
                            'email' => $jadwal->dosen->email,
                            'email_verified' => $jadwal->dosen->email_verified ?? false,
                            'jadwal_type' => 'Jurnal Reading',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'jadwal_id' => $jadwal->id,
                            'reminder_type' => 'unconfirmed'
                        ];
                    }
                }
                break;

            case 'csr':
                $query = \App\Models\JadwalCSR::with(['kategori', 'ruangan', 'dosen'])
                    ->where('status_konfirmasi', 'belum_konfirmasi');

                // CSR tidak memiliki semester/blok filter karena tidak terkait dengan mata kuliah

                $jadwalCSR = $query->get();

                foreach ($jadwalCSR as $jadwal) {
                    if ($jadwal->dosen_id && $jadwal->dosen) {
                        $pendingDosen[] = [
                            'dosen_id' => $jadwal->dosen_id,
                            'name' => $jadwal->dosen->name,
                            'email' => $jadwal->dosen->email,
                            'email_verified' => $jadwal->dosen->email_verified ?? false,
                            'jadwal_type' => 'CSR',
                            'mata_kuliah' => $jadwal->kategori->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'jadwal_id' => $jadwal->id,
                            'reminder_type' => 'unconfirmed'
                        ];
                    }
                }
                break;

            case 'non_blok_non_csr':
                $query = \App\Models\JadwalNonBlokNonCSR::with(['mataKuliah', 'ruangan', 'dosen'])
                    ->where('status_konfirmasi', 'belum_konfirmasi');

                // Apply semester filter if provided
                if ($semester) {
                    $query->whereHas('mataKuliah', function ($q) use ($semester) {
                        $q->where('semester', $semester);
                    });
                }

                // Apply blok filter if provided (blok ada di tabel mata_kuliah)
                if ($blok) {
                    $query->whereHas('mataKuliah', function ($q) use ($blok) {
                        $q->where('blok', $blok);
                    });
                }

                $jadwalNonBlokNonCSR = $query->get();

                foreach ($jadwalNonBlokNonCSR as $jadwal) {
                    if ($jadwal->dosen_id && $jadwal->dosen) {
                        $pendingDosen[] = [
                            'dosen_id' => $jadwal->dosen_id,
                            'name' => $jadwal->dosen->name,
                            'email' => $jadwal->dosen->email,
                            'email_verified' => $jadwal->dosen->email_verified ?? false,
                            'jadwal_type' => 'Non Blok Non CSR',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'jadwal_id' => $jadwal->id,
                            'reminder_type' => 'unconfirmed'
                        ];
                    }
                }
                break;

            case 'persamaan_persepsi':
                // Persamaan Persepsi langsung "bisa", tidak ada unconfirmed
                // Jadi return empty array
                break;
        }

        return $pendingDosen;
    }

    /**
     * Get upcoming confirmed dosen for specific jadwal type
     */
    private function getUpcomingDosenForJadwalType($jadwalType, $semester = null, $blok = null)
    {
        $pendingDosen = [];
        $now = now();

        switch ($jadwalType) {
            case 'pbl':
                $query = \App\Models\JadwalPBL::with(['mataKuliah', 'ruangan', 'dosen'])
                    ->where('status_konfirmasi', 'bisa')
                    ->where('tanggal', '>=', $now->toDateString())
                    ->where(function ($q) use ($now) {
                        $q->where('tanggal', '>', $now->toDateString())
                            ->orWhere(function ($q2) use ($now) {
                                $q2->where('tanggal', '=', $now->toDateString())
                                    ->where('jam_mulai', '>', $now->format('H:i:s'));
                            });
                    });

                // Apply semester filter if provided
                if ($semester) {
                    $query->whereHas('mataKuliah', function ($q) use ($semester) {
                        $q->where('semester', $semester);
                    });
                }

                // Apply blok filter if provided
                if ($blok) {
                    $query->whereHas('mataKuliah', function ($q) use ($blok) {
                        $q->where('blok', $blok);
                    });
                }

                $jadwalPBL = $query->get();

                foreach ($jadwalPBL as $jadwal) {
                    if ($jadwal->dosen_id && $jadwal->dosen) {
                        $pendingDosen[] = [
                            'dosen_id' => $jadwal->dosen_id,
                            'name' => $jadwal->dosen->name,
                            'email' => $jadwal->dosen->email,
                            'email_verified' => $jadwal->dosen->email_verified ?? false,
                            'whatsapp_phone' => $jadwal->dosen->whatsapp_phone ?? null,
                            'jadwal_type' => 'PBL',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'jadwal_id' => $jadwal->id,
                            'reminder_type' => 'upcoming'
                        ];
                    }
                }
                break;

            case 'kuliah_besar':
                $query = \App\Models\JadwalKuliahBesar::with(['mataKuliah', 'ruangan', 'dosen'])
                    ->where('status_konfirmasi', 'bisa')
                    ->where('tanggal', '>=', $now->toDateString())
                    ->where(function ($q) use ($now) {
                        $q->where('tanggal', '>', $now->toDateString())
                            ->orWhere(function ($q2) use ($now) {
                                $q2->where('tanggal', '=', $now->toDateString())
                                    ->where('jam_mulai', '>', $now->format('H:i:s'));
                            });
                    });

                // Apply semester filter if provided
                if ($semester) {
                    $query->whereHas('mataKuliah', function ($q) use ($semester) {
                        $q->where('semester', $semester);
                    });
                }

                // Apply blok filter if provided
                if ($blok) {
                    $query->whereHas('mataKuliah', function ($q) use ($blok) {
                        $q->where('blok', $blok);
                    });
                }

                $jadwalKuliahBesar = $query->get();

                foreach ($jadwalKuliahBesar as $jadwal) {
                    if ($jadwal->dosen_id && $jadwal->dosen) {
                        $pendingDosen[] = [
                            'dosen_id' => $jadwal->dosen_id,
                            'name' => $jadwal->dosen->name,
                            'email' => $jadwal->dosen->email,
                            'email_verified' => $jadwal->dosen->email_verified ?? false,
                            'jadwal_type' => 'Kuliah Besar',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'jadwal_id' => $jadwal->id,
                            'reminder_type' => 'upcoming'
                        ];
                    }
                }
                break;

            case 'praktikum':
                $query = \App\Models\JadwalPraktikum::with(['mataKuliah', 'ruangan'])
                    ->where('tanggal', '>=', $now->toDateString())
                    ->where(function ($q) use ($now) {
                        $q->where('tanggal', '>', $now->toDateString())
                            ->orWhere(function ($q2) use ($now) {
                                $q2->where('tanggal', '=', $now->toDateString())
                                    ->where('jam_mulai', '>', $now->format('H:i:s'));
                            });
                    });

                // Apply semester filter if provided
                if ($semester) {
                    $query->whereHas('mataKuliah', function ($q) use ($semester) {
                        $q->where('semester', $semester);
                    });
                }

                // Apply blok filter if provided
                if ($blok) {
                    $query->whereHas('mataKuliah', function ($q) use ($blok) {
                        $q->where('blok', $blok);
                    });
                }

                $jadwalPraktikum = $query->get();

                foreach ($jadwalPraktikum as $jadwal) {
                    // Get dosen from jadwal_praktikum_dosen table
                    $dosenJadwal = \DB::table('jadwal_praktikum_dosen')
                        ->join('users', 'jadwal_praktikum_dosen.dosen_id', '=', 'users.id')
                        ->where('jadwal_praktikum_dosen.jadwal_praktikum_id', $jadwal->id)
                        ->where('jadwal_praktikum_dosen.status_konfirmasi', 'bisa')
                        ->select('users.*', 'jadwal_praktikum_dosen.status_konfirmasi')
                        ->get();

                    foreach ($dosenJadwal as $dosen) {
                        $pendingDosen[] = [
                            'dosen_id' => $dosen->id,
                            'name' => $dosen->name,
                            'email' => $dosen->email,
                            'email_verified' => $dosen->email_verified ?? false,
                            'whatsapp_phone' => $dosen->whatsapp_phone ?? null,
                            'jadwal_type' => 'Praktikum',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'jadwal_id' => $jadwal->id,
                            'reminder_type' => 'upcoming'
                        ];
                    }
                }
                break;

            case 'jurnal_reading':
                $query = \App\Models\JadwalJurnalReading::with(['mataKuliah', 'ruangan', 'dosen'])
                    ->where('status_konfirmasi', 'bisa')
                    ->where('tanggal', '>=', $now->toDateString())
                    ->where(function ($q) use ($now) {
                        $q->where('tanggal', '>', $now->toDateString())
                            ->orWhere(function ($q2) use ($now) {
                                $q2->where('tanggal', '=', $now->toDateString())
                                    ->where('jam_mulai', '>', $now->format('H:i:s'));
                            });
                    });

                // Apply semester filter if provided
                if ($semester) {
                    $query->whereHas('mataKuliah', function ($q) use ($semester) {
                        $q->where('semester', $semester);
                    });
                }

                // Apply blok filter if provided
                if ($blok) {
                    $query->whereHas('mataKuliah', function ($q) use ($blok) {
                        $q->where('blok', $blok);
                    });
                }

                $jadwalJurnalReading = $query->get();

                foreach ($jadwalJurnalReading as $jadwal) {
                    if ($jadwal->dosen_id && $jadwal->dosen) {
                        $pendingDosen[] = [
                            'dosen_id' => $jadwal->dosen_id,
                            'name' => $jadwal->dosen->name,
                            'email' => $jadwal->dosen->email,
                            'email_verified' => $jadwal->dosen->email_verified ?? false,
                            'jadwal_type' => 'Jurnal Reading',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'jadwal_id' => $jadwal->id,
                            'reminder_type' => 'upcoming'
                        ];
                    }
                }
                break;

            case 'csr':
                $query = \App\Models\JadwalCSR::with(['kategori', 'ruangan', 'dosen'])
                    ->where('status_konfirmasi', 'bisa')
                    ->where('tanggal', '>=', $now->toDateString())
                    ->where(function ($q) use ($now) {
                        $q->where('tanggal', '>', $now->toDateString())
                            ->orWhere(function ($q2) use ($now) {
                                $q2->where('tanggal', '=', $now->toDateString())
                                    ->where('jam_mulai', '>', $now->format('H:i:s'));
                            });
                    });

                $jadwalCSR = $query->get();

                foreach ($jadwalCSR as $jadwal) {
                    if ($jadwal->dosen_id && $jadwal->dosen) {
                        $pendingDosen[] = [
                            'dosen_id' => $jadwal->dosen_id,
                            'name' => $jadwal->dosen->name,
                            'email' => $jadwal->dosen->email,
                            'email_verified' => $jadwal->dosen->email_verified ?? false,
                            'jadwal_type' => 'CSR',
                            'mata_kuliah' => $jadwal->kategori->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'jadwal_id' => $jadwal->id,
                            'reminder_type' => 'upcoming'
                        ];
                    }
                }
                break;

            case 'non_blok_non_csr':
                $query = \App\Models\JadwalNonBlokNonCSR::with(['mataKuliah', 'ruangan', 'dosen'])
                    ->where('status_konfirmasi', 'bisa')
                    ->where('tanggal', '>=', $now->toDateString())
                    ->where(function ($q) use ($now) {
                        $q->where('tanggal', '>', $now->toDateString())
                            ->orWhere(function ($q2) use ($now) {
                                $q2->where('tanggal', '=', $now->toDateString())
                                    ->where('jam_mulai', '>', $now->format('H:i:s'));
                            });
                    });

                // Apply semester filter if provided
                if ($semester) {
                    $query->whereHas('mataKuliah', function ($q) use ($semester) {
                        $q->where('semester', $semester);
                    });
                }

                // Apply blok filter if provided
                if ($blok) {
                    $query->whereHas('mataKuliah', function ($q) use ($blok) {
                        $q->where('blok', $blok);
                    });
                }

                $jadwalNonBlokNonCSR = $query->get();

                foreach ($jadwalNonBlokNonCSR as $jadwal) {
                    if ($jadwal->dosen_id && $jadwal->dosen) {
                        $pendingDosen[] = [
                            'dosen_id' => $jadwal->dosen_id,
                            'name' => $jadwal->dosen->name,
                            'email' => $jadwal->dosen->email,
                            'email_verified' => $jadwal->dosen->email_verified ?? false,
                            'jadwal_type' => 'Non Blok Non CSR',
                            'mata_kuliah' => $jadwal->mataKuliah->nama,
                            'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                            'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'ruangan' => $jadwal->ruangan->nama,
                            'jadwal_id' => $jadwal->id,
                            'reminder_type' => 'upcoming'
                        ];
                    }
                }
                break;

            case 'persamaan_persepsi':
                // Persamaan Persepsi langsung "bisa", jadi hanya tampilkan upcoming
                $query = \App\Models\JadwalPersamaanPersepsi::with(['mataKuliah', 'ruangan'])
                    ->where('status_konfirmasi', 'bisa')
                    ->where('tanggal', '>=', $now->toDateString())
                    ->where(function ($q) use ($now) {
                        $q->where('tanggal', '>', $now->toDateString())
                            ->orWhere(function ($q2) use ($now) {
                                $q2->where('tanggal', '=', $now->toDateString())
                                    ->where('jam_mulai', '>', $now->format('H:i:s'));
                            });
                    });

                // Apply semester filter if provided
                if ($semester) {
                    $query->whereHas('mataKuliah', function ($q) use ($semester) {
                        $q->where('semester', $semester);
                    });
                }

                // Apply blok filter if provided
                if ($blok) {
                    $query->whereHas('mataKuliah', function ($q) use ($blok) {
                        $q->where('blok', $blok);
                    });
                }

                $jadwalPersamaanPersepsi = $query->get();

                foreach ($jadwalPersamaanPersepsi as $jadwal) {
                    // Get all dosen (koordinator + pengampu)
                    $allDosenIds = array_unique(array_merge(
                        $jadwal->koordinator_ids && is_array($jadwal->koordinator_ids) ? $jadwal->koordinator_ids : [],
                        $jadwal->dosen_ids && is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : []
                    ));

                    foreach ($allDosenIds as $dosenId) {
                        $dosen = \App\Models\User::find($dosenId);
                        if ($dosen) {
                            $ruanganNama = $jadwal->ruangan ? $jadwal->ruangan->nama : 'Online';
                            $pendingDosen[] = [
                                'dosen_id' => $dosen->id,
                                'name' => $dosen->name,
                                'email' => $dosen->email,
                                'email_verified' => $dosen->email_verified ?? false,
                                'whatsapp_phone' => $dosen->whatsapp_phone ?? null,
                                'jadwal_type' => 'Persamaan Persepsi',
                                'mata_kuliah' => $jadwal->mataKuliah->nama,
                                'tanggal' => date('d/m/Y', strtotime($jadwal->tanggal)),
                                'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                                'ruangan' => $ruanganNama,
                                'jadwal_id' => $jadwal->id,
                                'reminder_type' => 'upcoming'
                            ];
                        }
                    }
                }
                break;
        }

        return $pendingDosen;
    }

    /**
     * Send email reminder to dosen
     */
    private function sendEmailReminder($dosen, $jadwalType, $jadwal, $reminderType = 'unconfirmed')
    {
        try {
            if ($reminderType === 'unconfirmed') {
                $subject = "Pengingat: Konfirmasi Ketersediaan {$jadwalType}";
            } else { // upcoming
                $subject = "Pengingat: Persiapan Mengajar {$jadwalType}";
            }

            // Send email using HTML template
            Mail::send('emails.reminder-notification', [
                'dosen' => $dosen,
                'jadwal' => $jadwal,
                'jadwalType' => $jadwalType,
                'reminderType' => $reminderType
            ], function ($message) use ($dosen, $subject) {
                $message->to($dosen->email, $dosen->name)
                    ->subject($subject)
                    ->from(env('MAIL_FROM_ADDRESS'), 'Pengingat Dari ISME (Integrated System Medical Education Fakultas Kedokteran dan Kesehatan Universitas Muhammadiyah Jakarta)');
            });

            \Log::info("Email reminder sent to {$dosen->name} ({$dosen->email}) for {$jadwalType}");
        } catch (\Exception $e) {
            \Log::error("Failed to send email reminder to {$dosen->name}: " . $e->getMessage());
        }
    }

    /**
     * Send email reminder with consistent logic for both types
     */
    private function sendEmailReminderConsistent($dosen, $jadwalType, $jadwal, $reminderType = 'unconfirmed')
    {
        try {
            // Use the exact same logic for both reminder types
            $subject = $reminderType === 'unconfirmed'
                ? "Pengingat: Konfirmasi Ketersediaan {$jadwalType}"
                : "Pengingat: Persiapan Mengajar {$jadwalType}";

            // Send email using HTML template with identical logic
            Mail::send('emails.reminder-notification', [
                'dosen' => $dosen,
                'jadwal' => $jadwal,
                'jadwalType' => $jadwalType,
                'reminderType' => $reminderType
            ], function ($message) use ($dosen, $subject) {
                $message->to($dosen->email, $dosen->name)
                    ->subject($subject)
                    ->from(env('MAIL_FROM_ADDRESS'), 'Pengingat Dari ISME (Integrated System Medical Education Fakultas Kedokteran dan Kesehatan Universitas Muhammadiyah Jakarta)');
            });

            \Log::info("Email reminder sent to {$dosen->name} ({$dosen->email}) for {$jadwalType} - Type: {$reminderType}");
        } catch (\Exception $e) {
            \Log::error("Failed to send email reminder to {$dosen->name}: " . $e->getMessage());
        }
    }

    /**
     * Send schedule list notification via WhatsApp
     * This sends a list message with "Konfirmasi" and "Reschedule" options
     * Note: Detail jadwal sudah dikirim di pesan sebelumnya
     */
    private function sendScheduleButtonNotification($dosen, $jadwalTypeDisplay, $jadwal, $jadwalTypeCode)
    {
        try {
            if (!$this->wablasService->isEnabled()) {
                Log::warning('Wablas service tidak aktif, skip pengiriman list notification');
                return;
            }

            // Build list message
            $title = "Konfirmasi Kesediaan Jadwal";
            $description = "Silakan pilih salah satu opsi untuk konfirmasi kesediaan jadwal mengajar Anda:";
            $buttonText = "Pilih Opsi";

            // Build lists
            $lists = [
                [
                    'title' => 'Konfirmasi',
                    'description' => 'Konfirmasi kesediaan jadwal mengajar',
                ],
                [
                    'title' => 'Reschedule',
                    'description' => 'Ajukan perubahan jadwal mengajar',
                ],
            ];

            $footer = "Sistem ISME FKK - Fakultas Kedokteran dan Kesehatan Universitas Muhammadiyah Jakarta";

            // Handle different jadwal types (CSR uses kategori, others use mataKuliah)
            $mataKuliahNama = $jadwal->mataKuliah->nama ?? $jadwal->kategori->nama ?? 'N/A';

            // Send list message
            $result = $this->wablasService->sendListMessage(
                $dosen->whatsapp_phone,
                $title,
                $description,
                $buttonText,
                $lists,
                $footer,
                [
                    'ref_id' => "list_{$jadwalTypeCode}_{$jadwal->id}_{$dosen->id}"
                ]
            );

            if ($result && $result['success']) {
                // Create conversation record to track list interaction
                WhatsAppConversation::create([
                    'user_id' => $dosen->id,
                    'phone' => $dosen->whatsapp_phone,
                    'jadwal_id' => $jadwal->id,
                    'jadwal_type' => $jadwalTypeCode,
                    'state' => 'waiting_button',
                    'last_message' => $description,
                    'metadata' => [
                        'jadwal_info' => "{$jadwalTypeDisplay}: {$mataKuliahNama} - " . date('d/m/Y', strtotime($jadwal->tanggal)) . " " . str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                        'message_id' => $result['message_id'] ?? null,
                    ],
                    'expires_at' => now()->addHours(24), // Conversation expires in 24 hours
                ]);

                Log::info("List notification sent successfully", [
                    'dosen_id' => $dosen->id,
                    'jadwal_id' => $jadwal->id,
                    'jadwal_type' => $jadwalTypeCode,
                    'message_id' => $result['message_id'] ?? null,
                ]);
            } else {
                // Fallback: jika list message gagal, kirim text message dengan instruksi
                Log::warning("List message failed, sending fallback text message", [
                    'dosen_id' => $dosen->id,
                    'jadwal_id' => $jadwal->id,
                    'jadwal_type' => $jadwalTypeCode,
                    'result' => $result,
                ]);

                // Kirim text message sebagai fallback
                $fallbackMessage = "{$title}\n\n{$description}\n\n";
                $fallbackMessage .= "Silakan balas dengan:\n";
                $fallbackMessage .= "• Ketik 'KONFIRMASI' untuk konfirmasi kesediaan\n";
                $fallbackMessage .= "• Ketik 'RESCHEDULE' untuk ajukan perubahan jadwal\n\n";
                $fallbackMessage .= $footer;

                $fallbackResult = $this->wablasService->sendMessage($dosen->whatsapp_phone, $fallbackMessage);

                if ($fallbackResult && $fallbackResult['success']) {
                    // Create conversation record untuk text fallback
                    WhatsAppConversation::create([
                        'user_id' => $dosen->id,
                        'phone' => $dosen->whatsapp_phone,
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => $jadwalTypeCode,
                        'state' => 'waiting_button',
                        'last_message' => $fallbackMessage,
                        'metadata' => [
                            'jadwal_info' => "{$jadwalTypeDisplay}: {$mataKuliahNama} - " . date('d/m/Y', strtotime($jadwal->tanggal)) . " " . str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai),
                            'message_id' => $fallbackResult['message_id'] ?? null,
                            'is_fallback' => true,
                        ],
                        'expires_at' => now()->addHours(24),
                    ]);

                    Log::info("Fallback text message sent successfully", [
                        'dosen_id' => $dosen->id,
                        'jadwal_id' => $jadwal->id,
                    ]);
                }
            }
        } catch (\Exception $e) {
            Log::error('Error sending schedule list notification', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'dosen_id' => $dosen->id ?? null,
                'jadwal_id' => $jadwal->id ?? null,
                'jadwal_type' => $jadwalTypeCode,
            ]);
        }
    }

    /**
     * Build WhatsApp message content for reminder (mirip dengan email template)
     */
    private function buildWhatsAppMessageContent($dosen, $jadwalType, $jadwal, $reminderType = 'unconfirmed')
    {
        $greeting = "Halo {$dosen->name},";

        if ($reminderType === 'unconfirmed') {
            $intro = "Ini adalah pengingat untuk konfirmasi kesediaan jadwal mengajar Anda.";
        } else { // upcoming
            $intro = "Ini adalah pengingat untuk persiapan mengajar jadwal Anda yang akan datang.";
        }

        // Build detail jadwal
        $details = "📋 *Detail Jadwal {$jadwalType}*\n\n";

        // Handle different jadwal types (CSR uses kategori, others use mataKuliah)
        $mataKuliahNama = $jadwal->mataKuliah->nama ?? $jadwal->kategori->nama ?? 'N/A';
        $details .= "• *Jadwal:* {$mataKuliahNama}\n";
        $details .= "• *Tanggal:* " . date('d/m/Y', strtotime($jadwal->tanggal)) . "\n";
        $details .= "• *Waktu:* " . str_replace(':', '.', $jadwal->jam_mulai) . " - " . str_replace(':', '.', $jadwal->jam_selesai) . "\n";

        // Semester & Blok - handle both mataKuliah and kategori
        if (isset($jadwal->mataKuliah) && $jadwal->mataKuliah) {
            $details .= "• *Semester & Blok:* Semester {$jadwal->mataKuliah->semester}";
            if ($jadwal->mataKuliah->blok) {
                $details .= " - Blok {$jadwal->mataKuliah->blok}";
            }
            $details .= "\n";
        } elseif (isset($jadwal->kategori) && $jadwal->kategori) {
            $details .= "• *Semester & Blok:* Semester {$jadwal->kategori->semester}";
            if ($jadwal->kategori->blok) {
                $details .= " - Blok {$jadwal->kategori->blok}";
            }
            $details .= "\n";
        }

        $details .= "• *Ruangan:* " . ($jadwal->ruangan->nama ?? 'TBD') . "\n";

        // Additional fields based on jadwal type
        if (isset($jadwal->topik) && $jadwal->topik) {
            $details .= "• *Topik:* {$jadwal->topik}\n";
        }
        if (isset($jadwal->materi) && $jadwal->materi) {
            $details .= "• *Materi:* {$jadwal->materi}\n";
        }
        if (isset($jadwal->agenda) && $jadwal->agenda) {
            $details .= "• *Agenda:* {$jadwal->agenda}\n";
        }
        if (isset($jadwal->modul) && $jadwal->modul) {
            $details .= "• *Modul:* {$jadwal->modul}\n";
        }
        if (isset($jadwal->tipe_pbl) && $jadwal->tipe_pbl) {
            $details .= "• *Tipe PBL:* {$jadwal->tipe_pbl}\n";
        }

        $details .= "\n• *Status:* " . ($reminderType === 'unconfirmed' ? 'Belum Konfirmasi' : 'Persiapan Mengajar') . "\n";

        // Action text
        if ($reminderType === 'unconfirmed') {
            $action = "Silakan login ke sistem untuk konfirmasi kesediaan Anda:\nhttps://isme.fkkumj.ac.id/";
        } else {
            $action = "Silakan persiapkan diri untuk mengajar sesuai jadwal di atas.\n\nAkses sistem: https://isme.fkkumj.ac.id/";
        }

        // Footer
        $footer = "\n\nTerima kasih.\nSistem ISME FKK\nFakultas Kedokteran dan Kesehatan\nUniversitas Muhammadiyah Jakarta";

        // Combine all parts
        $message = "{$greeting}\n\n{$intro}\n\n{$details}\n{$action}{$footer}";

        return $message;
    }

    /**
     * Build email content for reminder
     */
    private function buildEmailContent($dosen, $jadwalType, $jadwal, $reminderType = 'unconfirmed')
    {
        $content = "Halo {$dosen->name},\n\n";

        if ($reminderType === 'unconfirmed') {
            $content .= "Ini adalah pengingat untuk konfirmasi ketersediaan jadwal {$jadwalType} Anda.\n\n";
        } else { // upcoming
            $content .= "Ini adalah pengingat untuk persiapan mengajar jadwal {$jadwalType} Anda.\n\n";
        }

        // Add jadwal details based on type
        switch ($jadwalType) {
            case 'PBL':
                $content .= "Jadwal: {$jadwal->mataKuliah->nama}\n";
                $content .= "Tanggal: " . date('d/m/Y', strtotime($jadwal->tanggal)) . "\n";
                $content .= "Waktu: " . str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) . "\n";
                $content .= "Ruangan: {$jadwal->ruangan->nama}\n";
                if ($jadwal->modul) {
                    $content .= "Modul: {$jadwal->modul}\n";
                }
                if ($jadwal->tipe_pbl) {
                    $content .= "Tipe PBL: {$jadwal->tipe_pbl}\n";
                }
                break;

            case 'Kuliah Besar':
                $content .= "Jadwal: {$jadwal->mataKuliah->nama}\n";
                $content .= "Tanggal: " . date('d/m/Y', strtotime($jadwal->tanggal)) . "\n";
                $content .= "Waktu: " . str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) . "\n";
                $content .= "Ruangan: {$jadwal->ruangan->nama}\n";
                if ($jadwal->materi) {
                    $content .= "Materi: {$jadwal->materi}\n";
                }
                break;

            case 'Praktikum':
                $content .= "Jadwal: {$jadwal->mataKuliah->nama}\n";
                $content .= "Tanggal: " . date('d/m/Y', strtotime($jadwal->tanggal)) . "\n";
                $content .= "Waktu: " . str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) . "\n";
                $content .= "Ruangan: {$jadwal->ruangan->nama}\n";
                if ($jadwal->topik) {
                    $content .= "Topik: {$jadwal->topik}\n";
                }
                if ($jadwal->kelas_praktikum) {
                    $content .= "Kelas: {$jadwal->kelas_praktikum}\n";
                }
                break;

            case 'Jurnal Reading':
                $content .= "Jadwal: {$jadwal->mataKuliah->nama}\n";
                $content .= "Tanggal: " . date('d/m/Y', strtotime($jadwal->tanggal)) . "\n";
                $content .= "Waktu: " . str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) . "\n";
                $content .= "Ruangan: {$jadwal->ruangan->nama}\n";
                if ($jadwal->topik) {
                    $content .= "Topik: {$jadwal->topik}\n";
                }
                break;

            case 'CSR':
                $content .= "Jadwal: {$jadwal->mataKuliah->nama}\n";
                $content .= "Tanggal: " . date('d/m/Y', strtotime($jadwal->tanggal)) . "\n";
                $content .= "Waktu: " . str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) . "\n";
                $content .= "Ruangan: {$jadwal->ruangan->nama}\n";
                if ($jadwal->topik) {
                    $content .= "Topik: {$jadwal->topik}\n";
                }
                if ($jadwal->jenis_csr) {
                    $content .= "Jenis CSR: {$jadwal->jenis_csr}\n";
                }
                break;

            case 'Non Blok Non CSR':
                $content .= "Jadwal: {$jadwal->mataKuliah->nama}\n";
                $content .= "Tanggal: " . date('d/m/Y', strtotime($jadwal->tanggal)) . "\n";
                $content .= "Waktu: " . str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) . "\n";
                if ($jadwal->ruangan) {
                    $content .= "Ruangan: {$jadwal->ruangan->nama}\n";
                }
                if ($jadwal->materi) {
                    $content .= "Materi: {$jadwal->materi}\n";
                }
                if ($jadwal->agenda) {
                    $content .= "Agenda: {$jadwal->agenda}\n";
                }
                break;
        }

        if ($reminderType === 'unconfirmed') {
            $content .= "\nSilakan login ke sistem untuk konfirmasi ketersediaan Anda.\n\n";
        } else { // upcoming
            $content .= "\nSilakan persiapkan diri untuk mengajar sesuai jadwal di atas.\n\n";
        }

        $content .= "Terima kasih.\n";
        $content .= "Sistem ISME FKK";

        return $content;
    }

    /**
     * Send notification to dosen after admin changes their confirmation status
     */
    public function sendStatusChangeNotification(Request $request)
    {
        // Check if user is admin or tim akademik
        if (!Auth::user() || !in_array(Auth::user()->role, ['admin', 'super_admin', 'tim_akademik'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'jadwal_id' => 'required|integer',
            'jadwal_type' => 'required|string|in:pbl,kuliah_besar,praktikum,jurnal_reading,csr,non_blok_non_csr',
            'dosen_id' => 'required|integer|exists:users,id',
            'status' => 'required|string|in:bisa,tidak_bisa',
        ]);

        try {
            $jadwalId = $request->jadwal_id;
            $jadwalType = $request->jadwal_type;
            $dosenId = $request->dosen_id;
            $status = $request->status;
            $adminName = Auth::user()->name ?? 'Admin';
            $adminRole = Auth::user()->role ?? 'admin';

            // Load dosen
            $dosen = User::find($dosenId);
            if (!$dosen) {
                return response()->json(['message' => 'Dosen tidak ditemukan'], 404);
            }

            // Load jadwal based on type
            $jadwal = $this->loadJadwalByType($jadwalType, $jadwalId);
            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Get jadwal type display name
            $jadwalTypeDisplay = $this->getJadwalTypeDisplayName($jadwalType);

            // Send notification to website
            $this->sendWebsiteNotification($dosen, $jadwal, $jadwalType, $jadwalTypeDisplay, $status, $adminName);

            // Send email notification
            $this->sendEmailStatusChangeNotification($dosen, $jadwal, $jadwalType, $jadwalTypeDisplay, $status, $adminName, $adminRole);

            // Send WhatsApp notification
            $this->sendWhatsAppStatusChangeNotification($dosen, $jadwal, $jadwalType, $jadwalTypeDisplay, $status, $adminName);

            return response()->json([
                'message' => 'Notifikasi berhasil dikirim',
                'dosen_id' => $dosenId,
                'status' => $status
            ]);
        } catch (\Exception $e) {
            Log::error('Error sending status change notification: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengirim notifikasi',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Load jadwal by type and id
     */
    private function loadJadwalByType($jadwalType, $jadwalId)
    {
        switch ($jadwalType) {
            case 'pbl':
                return \App\Models\JadwalPBL::with(['modulPBL.mataKuliah', 'ruangan', 'dosen'])->find($jadwalId);
            case 'kuliah_besar':
                return \App\Models\JadwalKuliahBesar::with(['mataKuliah', 'ruangan', 'dosen'])->find($jadwalId);
            case 'praktikum':
                return \App\Models\JadwalPraktikum::with(['mataKuliah', 'ruangan'])->find($jadwalId);
            case 'jurnal_reading':
                return \App\Models\JadwalJurnalReading::with(['mataKuliah', 'ruangan', 'dosen'])->find($jadwalId);
            case 'csr':
                return \App\Models\JadwalCSR::with(['kategori', 'ruangan', 'dosen'])->find($jadwalId);
            case 'non_blok_non_csr':
                return \App\Models\JadwalNonBlokNonCSR::with(['mataKuliah', 'ruangan', 'dosen'])->find($jadwalId);
            default:
                return null;
        }
    }

    /**
     * Get jadwal type display name
     */
    private function getJadwalTypeDisplayName($jadwalType)
    {
        $displayNames = [
            'pbl' => 'PBL',
            'kuliah_besar' => 'Kuliah Besar',
            'praktikum' => 'Praktikum',
            'jurnal_reading' => 'Jurnal Reading',
            'csr' => 'CSR',
            'non_blok_non_csr' => 'Non Blok Non CSR'
        ];
        return $displayNames[$jadwalType] ?? $jadwalType;
    }

    /**
     * Send website notification
     */
    private function sendWebsiteNotification($dosen, $jadwal, $jadwalType, $jadwalTypeDisplay, $status, $adminName)
    {
        $statusText = $status === 'bisa' ? 'Bisa Mengajar' : 'Tidak Bisa Mengajar';
        $type = $status === 'bisa' ? 'success' : 'warning';

        // Get mata kuliah name
        $mataKuliahNama = $jadwal->mataKuliah->nama ?? $jadwal->kategori->nama ?? $jadwal->modulPBL->mataKuliah->nama ?? 'N/A';

        Notification::create([
            'user_id' => $dosen->id,
            'title' => "Status Konfirmasi Diubah - {$statusText}",
            'message' => "Status konfirmasi jadwal {$jadwalTypeDisplay} Anda telah diubah menjadi '{$statusText}' oleh {$adminName} (Tim Akademik/Admin).",
            'type' => $type,
            'is_read' => false,
            'data' => [
                'jadwal_id' => $jadwal->id,
                'jadwal_type' => $jadwalType,
                'mata_kuliah' => $mataKuliahNama,
                'tanggal' => $jadwal->tanggal,
                'waktu' => str_replace(':', '.', $jadwal->jam_mulai) . ' - ' . str_replace(':', '.', $jadwal->jam_selesai),
                'ruangan' => $jadwal->ruangan->nama ?? 'TBD',
                'status_konfirmasi' => $status,
                'changed_by' => $adminName,
                'changed_by_role' => 'admin',
                'dosen_name' => $dosen->name, // Simpan nama dosen untuk ditampilkan di frontend
                'dosen_id' => $dosen->id
            ]
        ]);
    }

    /**
     * Send email notification for status change
     */
    private function sendEmailStatusChangeNotification($dosen, $jadwal, $jadwalType, $jadwalTypeDisplay, $status, $adminName, $adminRole)
    {
        try {
            if (!$dosen->email || !filter_var($dosen->email, FILTER_VALIDATE_EMAIL)) {
                Log::info("Skipping email notification for dosen {$dosen->id}: invalid email");
                return;
            }

            $statusText = $status === 'bisa' ? 'Bisa Mengajar' : 'Tidak Bisa Mengajar';
            $subject = "Status Konfirmasi Diubah - {$statusText}";

            // Send email using HTML template
            Mail::send('emails.status-change-notification', [
                'dosen' => $dosen,
                'jadwal' => $jadwal,
                'jadwalType' => $jadwalTypeDisplay,
                'status' => $status,
                'statusText' => $statusText,
                'adminName' => $adminName,
                'adminRole' => $adminRole
            ], function ($message) use ($dosen, $subject) {
                $message->to($dosen->email, $dosen->name)
                    ->subject($subject)
                    ->from(env('MAIL_FROM_ADDRESS'), 'Notifikasi Dari ISME (Integrated System Medical Education Fakultas Kedokteran dan Kesehatan Universitas Muhammadiyah Jakarta)');
            });

            Log::info("Email status change notification sent to {$dosen->name} ({$dosen->email})");
        } catch (\Exception $e) {
            Log::error("Failed to send email status change notification to {$dosen->name}: " . $e->getMessage());
        }
    }

    /**
     * Send WhatsApp notification for status change
     */
    private function sendWhatsAppStatusChangeNotification($dosen, $jadwal, $jadwalType, $jadwalTypeDisplay, $status, $adminName)
    {
        try {
            if (!$this->wablasService->isEnabled()) {
                Log::info("WhatsApp service is disabled, skipping notification");
                return;
            }

            if (!$dosen->whatsapp_phone || empty(trim($dosen->whatsapp_phone))) {
                Log::info("Skipping WhatsApp notification for dosen {$dosen->id}: no WhatsApp phone");
                return;
            }

            $whatsappMessage = $this->buildWhatsAppStatusChangeMessage($dosen, $jadwal, $jadwalType, $jadwalTypeDisplay, $status, $adminName);

            $result = $this->wablasService->sendMessage($dosen->whatsapp_phone, $whatsappMessage);

            if ($result && $result['success']) {
                Log::info("WhatsApp status change notification sent to {$dosen->name} ({$dosen->whatsapp_phone})");
            } else {
                Log::warning("Failed to send WhatsApp status change notification", [
                    'dosen_id' => $dosen->id,
                    'result' => $result
                ]);
            }
        } catch (\Exception $e) {
            Log::error("Failed to send WhatsApp status change notification to {$dosen->name}: " . $e->getMessage());
        }
    }

    /**
     * Build WhatsApp message for status change
     */
    private function buildWhatsAppStatusChangeMessage($dosen, $jadwal, $jadwalType, $jadwalTypeDisplay, $status, $adminName)
    {
        $greeting = "Halo {$dosen->name},";

        $statusText = $status === 'bisa' ? 'Bisa Mengajar' : 'Tidak Bisa Mengajar';
        $intro = "Status konfirmasi jadwal {$jadwalTypeDisplay} Anda telah diubah menjadi '{$statusText}' oleh {$adminName} (Tim Akademik/Admin).";

        // Build detail jadwal
        $details = "📋 *Detail Jadwal {$jadwalTypeDisplay}*\n\n";

        // Handle different jadwal types (CSR uses kategori, others use mataKuliah)
        $mataKuliahNama = $jadwal->mataKuliah->nama ?? $jadwal->kategori->nama ?? $jadwal->modulPBL->mataKuliah->nama ?? 'N/A';
        $details .= "• *Jadwal:* {$mataKuliahNama}\n";
        $details .= "• *Tanggal:* " . date('d/m/Y', strtotime($jadwal->tanggal)) . "\n";
        $details .= "• *Waktu:* " . str_replace(':', '.', $jadwal->jam_mulai) . " - " . str_replace(':', '.', $jadwal->jam_selesai) . "\n";

        // Semester & Blok
        if (isset($jadwal->mataKuliah) && $jadwal->mataKuliah) {
            $details .= "• *Semester & Blok:* Semester {$jadwal->mataKuliah->semester}";
            if ($jadwal->mataKuliah->blok) {
                $details .= " - Blok {$jadwal->mataKuliah->blok}";
            }
            $details .= "\n";
        } elseif (isset($jadwal->kategori) && $jadwal->kategori) {
            $details .= "• *Semester & Blok:* Semester {$jadwal->kategori->semester}";
            if ($jadwal->kategori->blok) {
                $details .= " - Blok {$jadwal->kategori->blok}";
            }
            $details .= "\n";
        } elseif (isset($jadwal->modulPBL) && $jadwal->modulPBL && $jadwal->modulPBL->mataKuliah) {
            $details .= "• *Semester & Blok:* Semester {$jadwal->modulPBL->mataKuliah->semester}";
            if ($jadwal->modulPBL->mataKuliah->blok) {
                $details .= " - Blok {$jadwal->modulPBL->mataKuliah->blok}";
            }
            $details .= "\n";
        }

        $details .= "• *Ruangan:* " . ($jadwal->ruangan->nama ?? 'TBD') . "\n";
        $details .= "\n• *Status:* {$statusText}\n";

        // Action text
        $action = "Silakan login ke sistem untuk melihat detail jadwal:\nhttps://isme.fkkumj.ac.id/";

        // Footer
        $footer = "\n\nTerima kasih.\nSistem ISME FKK\nFakultas Kedokteran dan Kesehatan\nUniversitas Muhammadiyah Jakarta";

        // Combine all parts
        $message = "{$greeting}\n\n{$intro}\n\n{$details}\n{$action}{$footer}";

        return $message;
    }
}
