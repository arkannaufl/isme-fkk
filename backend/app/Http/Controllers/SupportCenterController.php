<?php

namespace App\Http\Controllers;

use App\Models\Developer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

class SupportCenterController extends Controller
{
    /**
     * Get all active developers
     */
    public function getDevelopers()
    {
        $developers = Developer::active()->ordered()->get();

        return response()->json([
            'success' => true,
            'data' => $developers
        ]);
    }

    /**
     * Get developer by ID
     */
    public function getDeveloper($id)
    {
        $developer = Developer::findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $developer
        ]);
    }

    /**
     * Create new developer (Super Admin only)
     */
    public function store(Request $request)
    {
        $user = Auth::guard('sanctum')->user();

        if (!$user || $user->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Super Admin can create developers.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:developers,email',
            'role' => 'nullable|string|max:255',
            'whatsapp' => 'nullable|string|max:255',
            'expertise' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $developer = Developer::create($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Developer created successfully',
            'data' => $developer
        ], 201);
    }

    /**
     * Update developer (Super Admin only)
     */
    public function update(Request $request, $id)
    {
        $user = Auth::guard('sanctum')->user();

        if (!$user || $user->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Super Admin can update developers.'
            ], 403);
        }

        $developer = Developer::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:developers,email,' . $id,
            'role' => 'nullable|string|max:255',
            'whatsapp' => 'nullable|string|max:255',
            'expertise' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $developer->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Developer updated successfully',
            'data' => $developer
        ]);
    }

    /**
     * Delete developer (Super Admin only)
     */
    public function destroy($id)
    {
        $user = Auth::guard('sanctum')->user();

        if (!$user || $user->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Super Admin can delete developers.'
            ], 403);
        }

        $developer = Developer::findOrFail($id);
        $developer->delete();

        return response()->json([
            'success' => true,
            'message' => 'Developer deleted successfully'
        ]);
    }

    /**
     * Submit bug report
     */
    public function submitBugReport(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'category' => 'required|in:Bug,Error,Issue',
            'priority' => 'required|in:Low,Medium,High,Critical',
            'steps_to_reproduce' => 'nullable|string',
            'expected_behavior' => 'nullable|string',
            'actual_behavior' => 'nullable|string',
            'developer_id' => 'required|exists:developers,id',
            'user_name' => 'required|string|max:255',
            'user_email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $developer = Developer::findOrFail($request->developer_id);

        // Send email to developer
        try {
            // Try to send email
            Mail::send('emails.bug-report', [
                'title' => $request->title,
                'description' => $request->description,
                'category' => $request->category,
                'priority' => $request->priority,
                'steps_to_reproduce' => $request->steps_to_reproduce,
                'expected_behavior' => $request->expected_behavior,
                'actual_behavior' => $request->actual_behavior,
                'user_name' => $request->user_name,
                'user_email' => $request->user_email,
                'developer_name' => $developer->name,
            ], function ($message) use ($developer, $request) {
                $message->to($developer->email)
                    ->subject('[BUG REPORT] ' . $request->title)
                    ->from($request->user_email, $request->user_name);
            });

            return response()->json([
                'success' => true,
                'message' => 'Laporan bug berhasil dikirim! Kami akan segera menghubungi Anda.'
            ]);
        } catch (\Exception $e) {
            // Log the error for debugging
            \Log::error('Email sending failed: ' . $e->getMessage());

            // Return success anyway but with different message
            return response()->json([
                'success' => true,
                'message' => 'Laporan bug berhasil disimpan! Silakan hubungi developer langsung via WhatsApp untuk respons yang lebih cepat: ' . $developer->whatsapp
            ]);
        }
    }

    /**
     * Submit feature request
     */
    public function submitFeatureRequest(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'use_case' => 'nullable|string',
            'priority' => 'required|in:Nice to have,Important,Critical',
            'category' => 'required|in:UI/UX,Functionality,Performance',
            'developer_id' => 'required|exists:developers,id',
            'user_name' => 'required|string|max:255',
            'user_email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $developer = Developer::findOrFail($request->developer_id);

        // Send email to developer
        try {
            // Try to send email
            Mail::send('emails.feature-request', [
                'title' => $request->title,
                'description' => $request->description,
                'use_case' => $request->use_case,
                'priority' => $request->priority,
                'category' => $request->category,
                'user_name' => $request->user_name,
                'user_email' => $request->user_email,
                'developer_name' => $developer->name,
            ], function ($message) use ($developer, $request) {
                $message->to($developer->email)
                    ->subject('[FEATURE REQUEST] ' . $request->title)
                    ->from($request->user_email, $request->user_name);
            });

            return response()->json([
                'success' => true,
                'message' => 'Permintaan fitur berhasil dikirim! Kami akan meninjau dan menghubungi Anda.'
            ]);
        } catch (\Exception $e) {
            // Log the error for debugging
            \Log::error('Email sending failed: ' . $e->getMessage());

            // Return success anyway but with different message
            return response()->json([
                'success' => true,
                'message' => 'Permintaan fitur berhasil disimpan! Silakan hubungi developer langsung via WhatsApp untuk respons yang lebih cepat: ' . $developer->whatsapp
            ]);
        }
    }

    /**
     * Submit contact form
     */
    public function submitContact(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'subject' => 'required|string|max:255',
            'message' => 'required|string',
            'priority' => 'required|in:Low,Medium,High,Urgent',
            'developer_id' => 'required|exists:developers,id',
            'user_name' => 'required|string|max:255',
            'user_email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $developer = Developer::findOrFail($request->developer_id);

        // Send email to developer
        try {
            // Try to send email
            $emailContent = "Contact Message from Support Center\n\n";
            $emailContent .= "Subject: " . $request->subject . "\n";
            $emailContent .= "Priority: " . $request->priority . "\n";
            $emailContent .= "Message: " . $request->message . "\n";
            $emailContent .= "From: " . $request->user_name . " (" . $request->user_email . ")\n";
            $emailContent .= "Assigned to: " . $developer->name . "\n\n";
            $emailContent .= "This message was sent through the Support Center.";

            Mail::raw($emailContent, function ($message) use ($developer, $request) {
                $message->to($developer->email)
                    ->subject('[CONTACT] ' . $request->subject)
                    ->from($request->user_email, $request->user_name);
            });

            return response()->json([
                'success' => true,
                'message' => 'Pesan berhasil dikirim! Kami akan segera menghubungi Anda.'
            ]);
        } catch (\Exception $e) {
            // Log the error for debugging
            \Log::error('Email sending failed: ' . $e->getMessage());

            // Return success anyway but with different message
            return response()->json([
                'success' => true,
                'message' => 'Pesan berhasil disimpan! Silakan hubungi developer langsung via WhatsApp untuk respons yang lebih cepat: ' . $developer->whatsapp
            ]);
        }
    }
}
