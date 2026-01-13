<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use App\Models\User;
use App\Models\Notification;
use App\Services\WablasService;
use Laravel\Sanctum\PersonalAccessToken;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class AuthController extends Controller
{
    protected WablasService $wablasService;

    public function __construct(WablasService $wablasService)
    {
        $this->wablasService = $wablasService;
    }

    public function login(Request $request)
    {
        $request->validate([
            'login'    => 'required|string|max:255|regex:/^[a-zA-Z0-9@._-]+$/',
            'password' => 'required|string|min:6|max:255',
        ], [
            'login.regex' => 'Username hanya boleh berisi huruf, angka, dan karakter @._-',
            'password.min' => 'Password minimal 6 karakter',
        ]);

        // Optimize query: gunakan single query dengan COALESCE untuk menghindari multiple OR
        // Query ini lebih efisien karena bisa menggunakan index yang tepat
        $login = $request->login;
        $user = User::where(function($query) use ($login) {
            $query->where('username', $login)
                  ->orWhere('email', $login)
                  ->orWhere('nip', $login)
                  ->orWhere('nid', $login)
                  ->orWhere('nim', $login);
        })->select('id', 'username', 'email', 'nip', 'nid', 'nim', 'password', 'is_logged_in', 'current_token', 'name', 'role')
          ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            // Log failed login attempt - gunakan Log facade yang lebih ringan untuk high traffic
            // Activity logging bisa di-disable atau di-queue secara terpisah jika diperlukan
            try {
                if (config('activitylog.enabled', true)) {
                    activity()
                        ->withProperties([
                            'ip' => $request->ip(),
                            'user_agent' => $request->userAgent(),
                            'attempted_login' => $request->login
                        ])
                        ->log("Failed login attempt for: {$request->login}");
                }
            } catch (\Exception $e) {
                // Silent fail untuk tidak membebani response time
                Log::debug('Activity log failed', ['error' => $e->getMessage()]);
            }

            return response()->json([
                'message' => 'Username/NIP/NID/NIM atau password salah.',
            ], 401);
        }

        // Gunakan database transaction dengan lock untuk mencegah race condition
        // saat banyak user login bersamaan dengan username yang sama
        return DB::transaction(function () use ($user, $request) {
            // Lock row user untuk memastikan hanya satu request yang bisa update pada saat yang sama
            $lockedUser = User::where('id', $user->id)
                ->lockForUpdate() // Pessimistic locking untuk mencegah race condition
                ->first();

            // Tambahkan pengecekan single-device login setelah lock
            if ($lockedUser->is_logged_in) {
                return response()->json([
                    'message' => 'Akun ini sudah login di perangkat lain.',
                ], 403);
            }

            $token = $lockedUser->createToken('auth_token')->plainTextToken;

            // Update status login dan token
            // Lock sudah di-handle di atas, jadi update ini aman dari race condition
            $lockedUser->update([
                'is_logged_in' => 1,
                'current_token' => $token,
            ]);

            // Clear cache untuk user login status (akan di-refresh di middleware)
            Cache::forget('user_login_status_' . $lockedUser->id);

            // Refresh user model untuk mendapatkan data terbaru
            $lockedUser->refresh();

            // Log successful login - gunakan try-catch untuk tidak membebani response time
            try {
                if (config('activitylog.enabled', true)) {
                    activity()
                        ->causedBy($lockedUser)
                        ->event('login')
                        ->withProperties([
                            'ip' => $request->ip(),
                            'user_agent' => $request->userAgent()
                        ])
                        ->log("User {$lockedUser->name} berhasil login");
                }
            } catch (\Exception $e) {
                // Silent fail untuk tidak membebani response time
                Log::debug('Activity log failed', ['error' => $e->getMessage()]);
            }

            return response()->json([
                'access_token' => $token,
                'token_type'   => 'Bearer',
                'user'         => $lockedUser->only(['id', 'name', 'username', 'email', 'role']),
            ]);
        });
    }

    /**
     * Request OTP for password reset.
     * Accepts username / email / NIP / NID / NIM in "login" field.
     * Only works if the account has verified email.
     */
    public function requestPasswordResetOtp(Request $request)
    {
        $request->validate([
            'login' => 'required|string|max:255',
        ]);

        $login = $request->login;

        $user = User::where(function($query) use ($login) {
                $query->where('username', $login)
                      ->orWhere('email', $login)
                      ->orWhere('nip', $login)
                      ->orWhere('nid', $login)
                      ->orWhere('nim', $login);
            })
            ->select('id', 'name', 'username', 'email', 'role', 'email_verified')
            ->first();

        if (!$user) {
            return response()->json([
                'message' => 'Akun tidak ditemukan. Periksa kembali username atau email Anda.',
            ], 404);
        }

        // Pastikan user punya email yang valid dan sudah diverifikasi
        $hasValidEmail = $user->email && filter_var($user->email, FILTER_VALIDATE_EMAIL);
        if (!$hasValidEmail || !($user->email_verified ?? false)) {
            return response()->json([
                'message' => 'Anda belum memiliki email verifikasi. Silakan hubungi Admin atau Tim Akademik untuk mengganti password Anda.',
                'requires_admin' => true,
            ], 422);
        }

        // Generate 6-digit numeric OTP
        $otp = random_int(100000, 999999);
        $hashedOtp = Hash::make($otp);

        // Simpan ke tabel password_resets (standar Laravel) menggunakan email sebagai key
        DB::table('password_resets')->updateOrInsert(
            ['email' => $user->email],
            [
                'token' => $hashedOtp,
                'created_at' => Carbon::now(),
            ]
        );

        // Kirim email OTP dengan template HTML profesional
        try {
            $appName = config('app.name', 'ISME-FKK');
            $subject = '[' . $appName . '] Kode OTP Reset Password';

            Mail::send('emails.forgot-password-otp', [
                'name' => $user->name,
                'otp' => $otp,
            ], function ($message) use ($user, $subject) {
                $message->to($user->email, $user->name)
                        ->subject($subject);
            });
        } catch (\Exception $e) {
            Log::error('Gagal mengirim email OTP reset password', [
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Gagal mengirim email reset password. Silakan coba lagi beberapa saat lagi.',
            ], 500);
        }

        return response()->json([
            'message' => 'Kode OTP telah dikirim ke email terverifikasi Anda.',
            'masked_email' => $this->maskEmail($user->email),
        ]);
    }

    /**
     * Reset password menggunakan OTP yang dikirim ke email.
     */
    public function resetPasswordWithOtp(Request $request)
    {
        $request->validate([
            'login' => 'required|string|max:255',
            'otp' => 'required|string|min:4|max:10',
            'password' => 'required|string|min:6|confirmed',
        ], [
            'password.confirmed' => 'Konfirmasi password tidak sama.',
        ]);

        $login = $request->login;

        $user = User::where(function($query) use ($login) {
                $query->where('username', $login)
                      ->orWhere('email', $login)
                      ->orWhere('nip', $login)
                      ->orWhere('nid', $login)
                      ->orWhere('nim', $login);
            })
            ->first();

        if (!$user || !$user->email) {
            return response()->json([
                'message' => 'Akun tidak ditemukan.',
            ], 404);
        }

        $reset = DB::table('password_resets')
            ->where('email', $user->email)
            ->orderByDesc('created_at')
            ->first();

        if (!$reset) {
            return response()->json([
                'message' => 'Kode OTP tidak ditemukan. Silakan minta kode baru.',
            ], 404);
        }

        // Cek masa berlaku OTP (10 menit)
        $createdAt = Carbon::parse($reset->created_at);
        if ($createdAt->lt(Carbon::now()->subMinutes(10))) {
            DB::table('password_resets')->where('email', $user->email)->delete();

            return response()->json([
                'message' => 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.',
            ], 410);
        }

        // Validasi OTP
        if (!Hash::check($request->otp, $reset->token)) {
            return response()->json([
                'message' => 'Kode OTP yang Anda masukkan tidak valid.',
            ], 422);
        }

        // Update password user
        $user->password = Hash::make($request->password);
        $user->save();

        // Hapus semua entri reset untuk email ini
        DB::table('password_resets')->where('email', $user->email)->delete();

        // Pastikan semua token login invalid (force logout semua perangkat)
        $user->is_logged_in = 0;
        $user->current_token = null;
        $user->tokens()->delete();
        $user->save();

        return response()->json([
            'message' => 'Password berhasil direset. Silakan login dengan password baru Anda.',
        ]);
    }

    /**
     * Verifikasi OTP reset password tanpa mengubah password.
     * Dipakai untuk step awal sebelum user mengisi password baru.
     */
    public function verifyPasswordResetOtp(Request $request)
    {
        $request->validate([
            'login' => 'required|string|max:255',
            'otp' => 'required|string|min:4|max:10',
        ]);

        $login = $request->login;

        $user = User::where(function($query) use ($login) {
                $query->where('username', $login)
                      ->orWhere('email', $login)
                      ->orWhere('nip', $login)
                      ->orWhere('nid', $login)
                      ->orWhere('nim', $login);
            })
            ->first();

        if (!$user || !$user->email) {
            return response()->json([
                'message' => 'Akun tidak ditemukan.',
            ], 404);
        }

        $reset = DB::table('password_resets')
            ->where('email', $user->email)
            ->orderByDesc('created_at')
            ->first();

        if (!$reset) {
            return response()->json([
                'message' => 'Kode OTP tidak ditemukan. Silakan minta kode baru.',
            ], 404);
        }

        $createdAt = Carbon::parse($reset->created_at);
        if ($createdAt->lt(Carbon::now()->subMinutes(10))) {
            DB::table('password_resets')->where('email', $user->email)->delete();

            return response()->json([
                'message' => 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.',
            ], 410);
        }

        if (!Hash::check($request->otp, $reset->token)) {
            return response()->json([
                'message' => 'Kode OTP yang Anda masukkan tidak valid.',
            ], 422);
        }

        return response()->json([
            'message' => 'Kode OTP valid. Silakan lanjutkan untuk mengatur ulang password Anda.',
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        // Log manual aksi logout
        activity()
            ->causedBy($user)
            ->event('logout')
            ->withProperties([
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ])
            ->log("User {$user->name} berhasil logout");

        // Set status logout dan hapus token
        $user->is_logged_in = 0;
        $user->current_token = null;
        $user->save();
        
        // Clear cache untuk user login status
        Cache::forget('user_login_status_' . $user->id);

        // Hapus semua token user (termasuk yang mungkin ada di perangkat lain)
        $user->tokens()->delete();

        return response()->json([
            'message' => 'Logout berhasil.',
        ]);
    }

    public function forceLogout(Request $request)
    {
        // Ambil token dari header Authorization
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'message' => 'Token tidak ditemukan.',
            ], 400);
        }

        // Cari user berdasarkan token menggunakan Sanctum
        $tokenModel = \Laravel\Sanctum\PersonalAccessToken::findToken($token);

        if (!$tokenModel) {
            return response()->json([
                'message' => 'Token tidak valid.',
            ], 401);
        }

        $user = $tokenModel->tokenable;

        // Reset status login dan hapus semua token
        $user->is_logged_in = 0;
        $user->current_token = null;
        $user->save();
        $user->tokens()->delete();

        return response()->json([
            'message' => 'Force logout berhasil. Silakan login kembali.',
        ]);
    }

    public function forceLogoutByToken(Request $request)
    {
        try {
            // Ambil token dari body request
            $token = $request->input('token');

            if (!$token) {
                return response()->json([
                    'message' => 'Token tidak ditemukan.',
                ], 400);
            }

            // Cari user berdasarkan token menggunakan Sanctum
            $tokenModel = PersonalAccessToken::findToken($token);

            if (!$tokenModel) {
                return response()->json([
                    'message' => 'Token tidak valid.',
                ], 401);
            }

            $user = $tokenModel->tokenable;

            // Reset status login dan hapus semua token (sesuai logika Anda)
            $user->is_logged_in = 0;
            $user->current_token = null;
            $user->save();
            $user->tokens()->delete();

            return response()->json([
                'message' => 'Force logout berhasil. Silakan login kembali.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Force logout berhasil. Silakan login kembali.',
            ]);
        }
    }

    public function forceLogoutByUser(Request $request)
    {
        try {
            // Ambil user ID dari body request
            $userId = $request->input('user_id');

            if (!$userId) {
                return response()->json([
                    'message' => 'User ID tidak ditemukan.',
                ], 400);
            }

            // Cari user berdasarkan ID
            $user = User::find($userId);

            if (!$user) {
                return response()->json([
                    'message' => 'User tidak ditemukan.',
                ], 404);
            }

            // Reset status login dan hapus semua token (sesuai logika Anda)
            $user->is_logged_in = 0;
            $user->current_token = null;
            $user->save();
            $user->tokens()->delete();

            return response()->json([
                'message' => 'Force logout berhasil. Silakan login kembali.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Force logout berhasil. Silakan login kembali.',
            ]);
        }
    }

    public function forceLogoutByUsername(Request $request)
    {
        try {
            // Ambil username dari body request
            $username = $request->input('username');

            if (!$username) {
                return response()->json([
                    'message' => 'Username tidak ditemukan.',
                ], 400);
            }

            // Cari user berdasarkan username, nip, nid, atau nim
            $user = User::where('username', $username)
                       ->orWhere('nip', $username)
                       ->orWhere('nid', $username)
                       ->orWhere('nim', $username)
                       ->first();

            if (!$user) {
                return response()->json([
                    'message' => 'User tidak ditemukan.',
                ], 404);
            }

            // Reset status login dan hapus semua token (sesuai logika Anda)
            $user->is_logged_in = 0;
            $user->current_token = null;
            $user->save();
            $user->tokens()->delete();

            return response()->json([
                'message' => 'Force logout berhasil. Silakan login kembali.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Force logout berhasil. Silakan login kembali.',
            ]);
        }
    }



    public function me(Request $request)
    {
        return response()->json([
            'user' => $request->user()
        ]);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        // Validasi untuk dosen: WhatsApp fields sesuai API Wablas
        // Required: phone, name (name sudah ada di validasi umum)
        // Optional: email, address, birth_day
        $isDosen = $user->role === 'dosen';
        $whatsappRules = [];

        if ($isDosen) {
            $whatsappRules = [
                'whatsapp_phone' => [
                    'required',
                    'string',
                    'regex:/^62\d+$/',
                    'min:10',
                    'max:15',
                    Rule::unique('users', 'whatsapp_phone')->ignore($user->id),
                ],
                'whatsapp_email' => [
                    'nullable',
                    'email',
                    Rule::unique('users', 'email')->where(function ($query) use ($user) {
                        return $query->where('role', $user->role);
                    })->ignore($user->id),
                ],
                'whatsapp_address' => 'nullable|string|max:500', // Optional
                'whatsapp_birth_day' => 'nullable|date|date_format:Y-m-d|before:today', // Optional
            ];
        } else {
            $whatsappRules = [
                'whatsapp_phone' => 'nullable|string|regex:/^62\d+$/|min:10|max:15',
                'whatsapp_email' => 'nullable|email',
                'whatsapp_address' => 'nullable|string|max:500',
                'whatsapp_birth_day' => 'nullable|date|date_format:Y-m-d|before:today',
            ];
        }

        $validated = $request->validate(array_merge([
            'name' => 'required|string|max:255',
            'username' => 'required|string|unique:users,username,' . $user->id,
            'email' => 'nullable|email|unique:users,email,' . $user->id . ',id,role,' . $user->role,
            'telp' => 'nullable|string|max:50',
            'gender' => 'nullable|string|in:Laki-laki,Perempuan',
            'ket' => 'nullable|string|max:255',
            'current_password' => 'nullable|string',
            'password' => 'nullable|string|min:6',
            'confirm_password' => 'nullable|string|same:password',

            'signature_image' => 'nullable|string', // Base64 string dari gambar tanda tangan

        ], $whatsappRules), [
            'whatsapp_phone.required' => 'Nomor WhatsApp wajib diisi untuk dosen.',
            'whatsapp_phone.regex' => 'Nomor WhatsApp harus dimulai dengan 62 (contoh: 6281234567890).',
            'whatsapp_email.email' => 'Format email tidak valid.',
            'whatsapp_birth_day.date_format' => 'Format tanggal lahir harus YYYY-mm-dd (contoh: 1990-01-15).',
            'whatsapp_birth_day.before' => 'Tanggal lahir harus sebelum hari ini.',
        ]);

        try {
            // Jika ingin ubah password
        if (!empty($validated['password'])) {
            if (empty($validated['current_password']) || !Hash::check($validated['current_password'], $user->password)) {
                return response()->json(['message' => 'Password saat ini salah.'], 422);
            }
            $user->password = bcrypt($validated['password']);
        }

        // Update basic fields
        $user->name = $validated['name'];
        $user->username = $validated['username'];
        if (array_key_exists('email', $validated) && !empty($validated['email'])) {
            $user->email = $validated['email'];
            // Jika email berubah, update juga whatsapp_email
            if (in_array($user->role, ['dosen', 'mahasiswa'])) {
                $user->whatsapp_email = $validated['email'];
            }
        }
        if (array_key_exists('telp', $validated)) {
            $user->telp = $validated['telp'];
        }
        if (array_key_exists('gender', $validated)) {
            $user->gender = $validated['gender'];
        }
        if (array_key_exists('ket', $validated)) {
            $user->ket = $validated['ket'];
        }

        // Update tanda tangan jika ada
        if (array_key_exists('signature_image', $validated)) {
            $user->signature_image = $validated['signature_image'];
        }

        // Simpan data basic fields dulu (name, username, email, telp, ket, password, signature)
        // WhatsApp fields akan disimpan setelah sync berhasil
        $user->save();

        // Update WhatsApp fields
        $hasWhatsAppChanges = false;
        if (array_key_exists('whatsapp_phone', $validated)) {
            $user->whatsapp_phone = $validated['whatsapp_phone'];
            $user->telp = $validated['whatsapp_phone']; // Ensure telp is EXACTLY identical
            $hasWhatsAppChanges = true;
        }
        if (array_key_exists('whatsapp_email', $validated)) {
            $user->whatsapp_email = $validated['whatsapp_email'];
            $hasWhatsAppChanges = true;
        }
        if (array_key_exists('whatsapp_address', $validated)) {
            $user->whatsapp_address = $validated['whatsapp_address'];
            $hasWhatsAppChanges = true;
        }
        if (array_key_exists('whatsapp_birth_day', $validated)) {
            $user->whatsapp_birth_day = $validated['whatsapp_birth_day'];
            $hasWhatsAppChanges = true;
        }

        // Always save after all potential updates
        $user->save();

        // Refresh user to get the latest data from database (including generated fields or triggers)
        $user->refresh();

        // Sync contact data to Wablas automatically if whatsapp_phone is available
        // Allowed roles for sync: dosen and mahasiswa
        $wablasSynced = false;
        if (in_array($user->role, ['dosen', 'mahasiswa']) && $user->whatsapp_phone && $user->name) {
            try {
                $wablasService = new \App\Services\WablasService();
                
                // Construct contact data for Wablas
                $contactData = [
                    'name' => $user->name,
                    'phone' => $user->whatsapp_phone,
                    'email' => $user->whatsapp_email ?? $user->email,
                    'address' => $user->whatsapp_address,
                    'birth_day' => $user->whatsapp_birth_day ? $user->whatsapp_birth_day->format('Y-m-d') : null,
                ];

                // Check if already synced or use the service to handle it
                // Based on previous syncToWablas logic:
                $syncResult = $this->syncToWablas($user);
                
                if ($syncResult['success']) {
                    $user->wablas_synced_at = now();
                    $user->wablas_sync_status = 'success';
                    $user->save();
                    $wablasSynced = true;
                } else {
                    \Log::warning('Wablas sync failed for user', [
                        'user_id' => $user->id,
                        'error' => $syncResult['error'] ?? 'Unknown error'
                    ]);
                    $user->wablas_sync_status = 'failed';
                    $user->save();
                }
            } catch (\Exception $e) {
                \Log::error('Wablas sync exception in updateProfile', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage()
                ]);
                $user->wablas_sync_status = 'failed';
                $user->save();
            }
        }

        return response()->json([
            'message' => 'Profil berhasil diperbarui',
            'user' => $user,
            'wablas_synced' => $wablasSynced
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'message' => 'Terjadi kesalahan saat memperbarui profil.',
            'error' => $e->getMessage(),
        ], 500);
    }
}

    /**
     * Sync user contact ke Wablas
     * Menggunakan addContact jika belum pernah sync, atau updateContact jika sudah pernah sync
     */
    private function syncToWablas(User $user): array
    {
        if (!$this->wablasService->isEnabled()) {
            return [
                'success' => false,
                'error' => 'Wablas service tidak aktif',
            ];
        }

        $contactData = [
            'name' => $user->name,
            'phone' => $user->whatsapp_phone,
            'email' => $user->whatsapp_email ?? $user->email,
            'address' => $user->whatsapp_address,
            'birth_day' => $user->whatsapp_birth_day ? $user->whatsapp_birth_day->format('Y-m-d') : null,
        ];

        // Jika sudah pernah sync (ada wablas_synced_at), gunakan updateContact
        // Jika belum pernah sync, gunakan addContact
        if ($user->wablas_synced_at) {
            $result = $this->wablasService->updateContact([$contactData]);
        } else {
            $result = $this->wablasService->addContact([$contactData]);
        }

        return $result ?? [
            'success' => false,
            'error' => 'Wablas service tidak tersedia',
        ];
    }

    public function updateAvatar(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'avatar' => 'required|image|max:2048',
        ]);

        // Hapus avatar lama jika ada
        if ($user->avatar) {
            $oldPath = str_replace('/storage/', '', $user->avatar);
            if (Storage::disk('public')->exists($oldPath)) {
                Storage::disk('public')->delete($oldPath);
            }
        }

        $path = $request->file('avatar')->store('avatars', 'public');
        $user->avatar = '/storage/' . $path;
        $user->save();

        return response()->json([
            'message' => 'Avatar updated successfully.',
            'user' => $user,
        ]);
    }

    /**
     * Check if phone or email already exists (for realtime validation)
     * GET /api/profile/check-availability?phone=...&email=...
     */
    public function checkAvailability(Request $request)
    {
        $user = $request->user();
        $phone = $request->query('phone');
        $email = $request->query('email');

        $result = [
            'phone_available' => true,
            'email_available' => true,
            'phone_message' => null,
            'email_message' => null,
        ];

        // Check phone (whatsapp_phone)
        if ($phone) {
            $existingPhone = User::where('whatsapp_phone', $phone)
                ->where('id', '!=', $user->id)
                ->first();

            if ($existingPhone) {
                $result['phone_available'] = false;
                $result['phone_message'] = 'Nomor WhatsApp ini sudah digunakan oleh user lain.';
            }
        }

        // Check email
        if ($email) {
            $existingEmail = User::where('email', $email)
                ->where('id', '!=', $user->id)
                ->where('role', $user->role)
                ->first();

            if ($existingEmail) {
                $result['email_available'] = false;
                $result['email_message'] = 'Email ini sudah digunakan oleh user lain.';
            }
        }

        return response()->json($result);
    }

    /**
     * Masking email untuk ditampilkan ke user (beberapa karakter disensor dengan "*").
     */
    private function maskEmail(string $email): string
    {
        if (strpos($email, '@') === false) {
            return $email;
        }

        [$local, $domain] = explode('@', $email, 2);

        // Mask bagian local
        $localVisible = mb_substr($local, 0, min(2, mb_strlen($local)));
        $localMaskedLength = max(1, mb_strlen($local) - mb_strlen($localVisible));
        $localMasked = $localVisible . str_repeat('*', $localMaskedLength);

        // Mask bagian domain (hanya nama sebelum titik pertama)
        $domainParts = explode('.', $domain);
        $domainName = $domainParts[0] ?? '';
        $domainVisible = mb_substr($domainName, 0, 1);
        $domainMaskedLength = max(1, mb_strlen($domainName) - mb_strlen($domainVisible));
        $domainParts[0] = $domainVisible . str_repeat('*', $domainMaskedLength);

        $maskedDomain = implode('.', $domainParts);

        return $localMasked . '@' . $maskedDomain;
    }

}
