<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class AdminController extends Controller
{
    /**
     * Create a new Super Admin account
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function createSuperAdmin(Request $request)
    {
        try {
            // Check if user is Super Admin
            if (Auth::user()->role !== 'super_admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Only Super Admin can create Super Admin accounts.'
                ], 401);
            }

            // Validate request
            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'username' => 'required|string|alpha_dash|unique:users,username',
                'email' => 'required|email|unique:users,email',
                'password' => 'required|string|min:8',
                'phone' => 'required|string|max:20',
                'position' => 'required|string|max:255',
                'role' => 'required|string|in:super_admin'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Use provided username and ensure uniqueness among super_admins
            $username = $request->username;
            if (User::where('username', $username)->where('role', 'super_admin')->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Username sudah digunakan',
                    'errors' => ['username' => ['Username sudah digunakan']]
                ], 422);
            }
            
            // Create Super Admin user
            $user = User::create([
                'name' => $request->name,
                'username' => $username,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'telp' => $request->phone,
                'ket' => $request->position,
                'role' => 'super_admin',
                'email_verified_at' => now(),
                'is_logged_in' => 0,
                'current_token' => null
            ]);

            // Log activity
            activity()
                ->causedBy(Auth::user())
                ->performedOn($user)
                ->log("Created new Super Admin account: {$user->name} ({$user->email})");

            return response()->json([
                'success' => true,
                'message' => 'Akun Super Admin berhasil dibuat',
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'email' => $user->email,
                    'phone' => $user->telp,
                    'position' => $user->ket,
                    'role' => $user->role,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error creating Super Admin: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Internal server error',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get list of Super Admin accounts
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSuperAdmins(Request $request)
    {
        try {
            // Check if user is Super Admin
            if (Auth::user()->role !== 'super_admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Only Super Admin can view Super Admin accounts.'
                ], 401);
            }

            $superAdmins = User::where('role', 'super_admin')
                ->select(['id', 'name', 'username', 'email', 'telp', 'ket', 'created_at', 'updated_at'])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $superAdmins
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error fetching Super Admins: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Internal server error',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update Super Admin account
     * 
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateSuperAdmin(Request $request, $id)
    {
        try {
            // Check if user is Super Admin
            if (Auth::user()->role !== 'super_admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Only Super Admin can update Super Admin accounts.'
                ], 401);
            }

            $user = User::where('role', 'super_admin')->findOrFail($id);

            // Validate request
            $validator = Validator::make($request->all(), [
                'name' => 'sometimes|required|string|max:255',
                'email' => 'sometimes|required|email|unique:users,email,' . $user->id,
                'password' => 'sometimes|nullable|string|min:8',
                'phone' => 'sometimes|required|string|max:20',
                'position' => 'sometimes|required|string|max:255'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Update user data
            $updateData = $request->only(['name', 'email', 'phone', 'position']);
            
            if ($request->has('password') && !empty($request->password)) {
                $updateData['password'] = Hash::make($request->password);
            }

            // Map phone to telp and position to ket
            if (isset($updateData['phone'])) {
                $updateData['telp'] = $updateData['phone'];
                unset($updateData['phone']);
            }
            
            if (isset($updateData['position'])) {
                $updateData['ket'] = $updateData['position'];
                unset($updateData['position']);
            }

            $user->update($updateData);

            // Log activity
            activity()
                ->causedBy(Auth::user())
                ->performedOn($user)
                ->log("Updated Super Admin account: {$user->name} ({$user->email})");

            return response()->json([
                'success' => true,
                'message' => 'Akun Super Admin berhasil diperbarui',
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'email' => $user->email,
                    'phone' => $user->telp,
                    'position' => $user->ket,
                    'role' => $user->role,
                    'updated_at' => $user->updated_at
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error updating Super Admin: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Internal server error',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete Super Admin account
     * 
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteSuperAdmin($id)
    {
        try {
            // Check if user is Super Admin
            if (Auth::user()->role !== 'super_admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Only Super Admin can delete Super Admin accounts.'
                ], 401);
            }

            // Prevent deleting own account
            if (Auth::id() == $id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tidak dapat menghapus akun sendiri'
                ], 422);
            }

            $user = User::where('role', 'super_admin')->findOrFail($id);

            // Log activity before deletion
            activity()
                ->causedBy(Auth::user())
                ->log("Deleted Super Admin account: {$user->name} ({$user->email})");

            // Reset login status and delete all tokens
            $user->is_logged_in = 0;
            $user->current_token = null;
            $user->save();
            $user->tokens()->delete();
            $user->delete();

            return response()->json([
                'success' => true,
                'message' => 'Akun Super Admin berhasil dihapus'
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error deleting Super Admin: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Internal server error',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
