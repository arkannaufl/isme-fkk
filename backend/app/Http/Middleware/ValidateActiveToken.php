<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class ValidateActiveToken
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Skip validation for force-logout routes
        if ($request->is('api/force-logout') || $request->is('api/force-logout-by-token')) {
            return $next($request);
        }

        // Check if user is authenticated
        if (!Auth::check()) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $user = Auth::user();
        $currentToken = $request->bearerToken();

        // Optimize: Cache user login status untuk mengurangi database queries
        // Cache key: user_login_status_{user_id}
        $cacheKey = 'user_login_status_' . $user->id;
        $cachedStatus = Cache::get($cacheKey);
        
        // Jika cache miss, ambil dari database dan cache
        if ($cachedStatus === null) {
            // Refresh user untuk mendapatkan data terbaru
            $user->refresh(['is_logged_in', 'current_token']);
            $cachedStatus = [
                'is_logged_in' => $user->is_logged_in,
                'current_token' => $user->current_token,
            ];
            // Cache selama 5 menit (sesuai dengan session lifetime)
            Cache::put($cacheKey, $cachedStatus, 300);
        }

        // Check if user is marked as logged in
        if (!$cachedStatus['is_logged_in']) {
            // Clear cache dan logout
            Cache::forget($cacheKey);
            Auth::logout();
            return response()->json([
                'message' => 'Sesi Anda telah berakhir. Silakan login kembali.',
                'code' => 'SESSION_EXPIRED'
            ], 401);
        }

        // Check if current token matches the stored token
        if ($cachedStatus['current_token'] !== $currentToken) {
            // Token tidak valid, kemungkinan login di perangkat lain
            // Clear cache dan logout
            Cache::forget($cacheKey);
            Auth::logout();
            return response()->json([
                'message' => 'Akun ini sedang digunakan di perangkat lain.',
                'code' => 'DEVICE_CONFLICT'
            ], 401);
        }

        return $next($request);
    }
}
