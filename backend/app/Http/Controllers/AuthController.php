<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use App\Models\Notification;
use App\Services\WablasService;
use Laravel\Sanctum\PersonalAccessToken;
use Illuminate\Validation\Rule;

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

        // Prevent timing attacks with constant time comparison
        $user = User::where('username', $request->login)
            ->orWhere('nip', $request->login)
            ->orWhere('nid', $request->login)
            ->orWhere('nim', $request->login)
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            // Log failed login attempt
            activity()
                ->withProperties([
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'attempted_login' => $request->login
                ])
                ->log("Failed login attempt for: {$request->login}");

            return response()->json([
                'message' => 'Username/NIP/NID/NIM atau password salah.',
            ], 401);
        }

        // Tambahkan pengecekan single-device login
        if ($user->is_logged_in) {
            return response()->json([
                'message' => 'Akun ini sudah login di perangkat lain.',
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        // Update status login dan token
        $user->is_logged_in = 1;
        $user->current_token = $token;
        $user->save();

        // Log successful login
        activity()
            ->causedBy($user)
            ->event('login')
            ->withProperties([
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ])
            ->log("User {$user->name} berhasil login");

        // Login notification handled by frontend only

        return response()->json([
            'access_token' => $token,
            'token_type'   => 'Bearer',
            'user'         => $user,
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
            if ($isDosen) {
                $user->whatsapp_email = $validated['email'];
            }
        }
        if (array_key_exists('telp', $validated)) {
            $user->telp = $validated['telp'];
        }
        if (array_key_exists('ket', $validated)) {
            $user->ket = $validated['ket'];
        }

        // Update tanda tangan jika ada
        if (array_key_exists('signature_image', $validated)) {
            $user->signature_image = $validated['signature_image'];
        }


        // Update WhatsApp fields
        if (array_key_exists('whatsapp_phone', $validated)) {
            $user->whatsapp_phone = $validated['whatsapp_phone'];
        }
        if (array_key_exists('whatsapp_email', $validated)) {
            $user->whatsapp_email = $validated['whatsapp_email'];
        }
        if (array_key_exists('whatsapp_address', $validated)) {
            $user->whatsapp_address = $validated['whatsapp_address'];
        }
        if (array_key_exists('whatsapp_birth_day', $validated)) {
            $user->whatsapp_birth_day = $validated['whatsapp_birth_day'];
        }

        // Sinkronisasi telp dengan whatsapp_phone (sama seperti email)
        // Jika whatsapp_phone diupdate, update juga telp (convert 62 ke 0)
        if (array_key_exists('whatsapp_phone', $validated) && $validated['whatsapp_phone']) {
            // Jika nomor dimulai dengan 62, ganti dengan 0
            if (str_starts_with($validated['whatsapp_phone'], '62')) {
                $user->telp = '0' . substr($validated['whatsapp_phone'], 2);
            } else {
                $user->telp = $validated['whatsapp_phone'];
            }
        }

        // Simpan data ke database dulu (meskipun sync gagal, data tetap tersimpan)

        $user->save();

        // Sync ke Wablas untuk dosen (hanya butuh phone dan name sesuai API Wablas)
        // phone dan name adalah required, email, address, birth_day adalah optional
        if ($isDosen && $user->whatsapp_phone && $user->name) {
            try {
                $syncResult = $this->syncToWablas($user);

                if ($syncResult['success']) {
                    $user->wablas_sync_status = 'synced';
                    $user->wablas_synced_at = now();
                } else {
                    $user->wablas_sync_status = 'failed';
                    Log::warning('Wablas sync failed for user', [
                        'user_id' => $user->id,
                        'error' => $syncResult['error'] ?? 'Unknown error',
                    ]);
                }
                $user->save();
            } catch (\Exception $e) {
                // Jika sync gagal, tetap simpan data di database
                $user->wablas_sync_status = 'failed';
                $user->save();
                Log::error('Wablas sync exception', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $user->fresh(),
            'wablas_synced' => $isDosen && $user->wablas_sync_status === 'synced',
        ]);
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

}
