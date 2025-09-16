<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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

        // Check if user is marked as logged in
        if (!$user->is_logged_in) {
            Auth::logout();
            return response()->json([
                'message' => 'Sesi Anda telah berakhir. Silakan login kembali.',
                'code' => 'SESSION_EXPIRED'
            ], 401);
        }

        // Check if current token matches the stored token
        if ($user->current_token !== $currentToken) {
            // Token tidak valid, kemungkinan login di perangkat lain
            // Jangan langsung update database untuk menghindari race condition
            Auth::logout();
            return response()->json([
                'message' => 'Akun ini sedang digunakan di perangkat lain.',
                'code' => 'DEVICE_CONFLICT'
            ], 401);
        }

        return $next($request);
    }
}
