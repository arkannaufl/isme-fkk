<?php

namespace App\Http\Controllers;

use App\Models\Developer;
use App\Models\Ticket;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

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

        // Log activity
        activity()
            ->performedOn($developer)
            ->withProperties([
                'name' => $developer->name,
                'email' => $developer->email,
                'role' => $developer->role,
                'expertise' => $developer->expertise
            ])
            ->log('Developer created: ' . $developer->name);

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

        // Log activity
        activity()
            ->performedOn($developer)
            ->withProperties([
                'name' => $developer->name,
                'email' => $developer->email,
                'role' => $developer->role,
                'expertise' => $developer->expertise,
                'is_active' => $developer->is_active
            ])
            ->log('Developer updated: ' . $developer->name);

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
        
        // Log activity before deletion
        activity()
            ->performedOn($developer)
            ->withProperties([
                'name' => $developer->name,
                'email' => $developer->email,
                'role' => $developer->role,
                'expertise' => $developer->expertise
            ])
            ->log('Developer deleted: ' . $developer->name);
            
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
            'images.*' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:5120', // Max 5MB per image
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $developer = Developer::findOrFail($request->developer_id);

        // Create ticket
        $ticket = Ticket::create([
            'ticket_number' => 'TK-' . strtoupper(Str::random(8)),
            'title' => $request->title,
            'description' => $request->description,
            'category' => $request->category,
            'priority' => $request->priority,
            'status' => 'Open',
            'assigned_to' => $request->developer_id,
            'user_name' => $request->user_name,
            'user_email' => $request->user_email,
        ]);

        // Handle image uploads
        $uploadedImages = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $index => $image) {
                if ($image->isValid()) {
                    $filename = 'bug_' . $ticket->id . '_' . $index . '_' . time() . '.' . $image->getClientOriginalExtension();
                    $image->move(public_path('uploads/ticket-images'), $filename);
                    $uploadedImages[] = 'uploads/ticket-images/' . $filename;
                }
            }
        }

        // Update ticket with images
        if (!empty($uploadedImages)) {
            $ticket->update(['images' => $uploadedImages]);
        }

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
                'ticket_number' => $ticket->ticket_number,
            ], function ($message) use ($developer, $request) {
                $message->to($developer->email)
                    ->subject('[BUG REPORT] ' . $request->title)
                    ->from($request->user_email, $request->user_name);
            });

            \Log::info('Bug report submitted successfully:', [
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'user_email' => $ticket->user_email,
                'user_name' => $ticket->user_name
            ]);

            // Create notification for Super Admin
            $this->createNewTicketNotification($ticket);

            return response()->json([
                'success' => true,
                'message' => 'Laporan bug berhasil dikirim! Tiket #' . $ticket->ticket_number . ' telah dibuat. Kami akan segera menghubungi Anda.'
            ]);
        } catch (\Exception $e) {
            // Log the error for debugging
            \Log::error('Email sending failed: ' . $e->getMessage());

            \Log::info('Bug report saved (email failed):', [
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'user_email' => $ticket->user_email,
                'user_name' => $ticket->user_name
            ]);

            // Create notification for Super Admin even if email fails
            $this->createNewTicketNotification($ticket);

            // Return success anyway but with different message
            return response()->json([
                'success' => true,
                'message' => 'Laporan bug berhasil disimpan! Tiket #' . $ticket->ticket_number . ' telah dibuat. Silakan hubungi developer langsung via WhatsApp untuk respons yang lebih cepat: ' . $developer->whatsapp
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
            'images.*' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:5120', // Max 5MB per image
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $developer = Developer::findOrFail($request->developer_id);

        // Create ticket
        $ticket = Ticket::create([
            'ticket_number' => 'TK-' . strtoupper(Str::random(8)),
            'title' => $request->title,
            'description' => $request->description,
            'category' => $request->category,
            'priority' => $request->priority,
            'status' => 'Open',
            'assigned_to' => $request->developer_id,
            'user_name' => $request->user_name,
            'user_email' => $request->user_email,
        ]);

        // Handle image uploads
        $uploadedImages = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $index => $image) {
                if ($image->isValid()) {
                    $filename = 'feature_' . $ticket->id . '_' . $index . '_' . time() . '.' . $image->getClientOriginalExtension();
                    $image->move(public_path('uploads/ticket-images'), $filename);
                    $uploadedImages[] = 'uploads/ticket-images/' . $filename;
                }
            }
        }

        // Update ticket with images
        if (!empty($uploadedImages)) {
            $ticket->update(['images' => $uploadedImages]);
        }

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
                'ticket_number' => $ticket->ticket_number,
            ], function ($message) use ($developer, $request) {
                $message->to($developer->email)
                    ->subject('[FEATURE REQUEST] ' . $request->title)
                    ->from($request->user_email, $request->user_name);
            });

            // Create notification for Super Admin
            $this->createNewTicketNotification($ticket);

            return response()->json([
                'success' => true,
                'message' => 'Permintaan fitur berhasil dikirim! Tiket #' . $ticket->ticket_number . ' telah dibuat. Kami akan meninjau dan menghubungi Anda.'
            ]);
        } catch (\Exception $e) {
            // Log the error for debugging
            \Log::error('Email sending failed: ' . $e->getMessage());

            // Create notification for Super Admin even if email fails
            $this->createNewTicketNotification($ticket);

            // Return success anyway but with different message
            return response()->json([
                'success' => true,
                'message' => 'Permintaan fitur berhasil disimpan! Tiket #' . $ticket->ticket_number . ' telah dibuat. Silakan hubungi developer langsung via WhatsApp untuk respons yang lebih cepat: ' . $developer->whatsapp
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
            'images.*' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:5120', // Max 5MB per image
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $developer = Developer::findOrFail($request->developer_id);

        // Create ticket
        $ticket = Ticket::create([
            'ticket_number' => 'TK-' . strtoupper(Str::random(8)),
            'title' => $request->subject,
            'description' => $request->message,
            'category' => 'Contact',
            'priority' => $request->priority,
            'status' => 'Open',
            'assigned_to' => $request->developer_id,
            'user_name' => $request->user_name,
            'user_email' => $request->user_email,
        ]);

        // Handle image uploads
        $uploadedImages = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $index => $image) {
                if ($image->isValid()) {
                    $filename = 'contact_' . $ticket->id . '_' . $index . '_' . time() . '.' . $image->getClientOriginalExtension();
                    $image->move(public_path('uploads/ticket-images'), $filename);
                    $uploadedImages[] = 'uploads/ticket-images/' . $filename;
                }
            }
        }

        // Update ticket with images
        if (!empty($uploadedImages)) {
            $ticket->update(['images' => $uploadedImages]);
        }

        // Send email to developer
        try {
            // Try to send email
            Mail::send('emails.contact', [
                'subject' => $request->subject,
                'message' => $request->message,
                'priority' => $request->priority,
                'user_name' => $request->user_name,
                'user_email' => $request->user_email,
                'developer_name' => $developer->name,
                'ticket_number' => $ticket->ticket_number,
            ], function ($message) use ($developer, $request) {
                $message->to($developer->email)
                    ->subject('[CONTACT] ' . $request->subject)
                    ->from($request->user_email, $request->user_name);
            });

            // Create notification for Super Admin
            $this->createNewTicketNotification($ticket);

            return response()->json([
                'success' => true,
                'message' => 'Pesan berhasil dikirim! Tiket #' . $ticket->ticket_number . ' telah dibuat. Kami akan segera menghubungi Anda.'
            ]);
        } catch (\Exception $e) {
            // Log the error for debugging
            \Log::error('Email sending failed: ' . $e->getMessage());

            // Create notification for Super Admin even if email fails
            $this->createNewTicketNotification($ticket);

            // Return success anyway but with different message
            return response()->json([
                'success' => true,
                'message' => 'Pesan berhasil disimpan! Tiket #' . $ticket->ticket_number . ' telah dibuat. Silakan hubungi developer langsung via WhatsApp untuk respons yang lebih cepat: ' . $developer->whatsapp
            ]);
        }
    }

    /**
     * Create notification for new ticket to Super Admin
     */
    private function createNewTicketNotification($ticket)
    {
        // Get all Super Admins
        $superAdmins = User::where('role', 'super_admin')->get();

        foreach ($superAdmins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'title' => 'Tiket Baru - ' . $ticket->category,
                'message' => "Tiket baru #{$ticket->ticket_number} dari {$ticket->user_name} ({$ticket->category}) - {$ticket->title}",
                'type' => 'info',
                'data' => [
                    'ticket_id' => $ticket->id,
                    'ticket_number' => $ticket->ticket_number,
                    'category' => $ticket->category,
                    'priority' => $ticket->priority,
                    'user_name' => $ticket->user_name,
                    'user_email' => $ticket->user_email,
                    'title' => $ticket->title,
                    'created_at' => $ticket->created_at,
                ],
            ]);
        }
    }

    /**
     * Create notification for ticket status update to ticket creator
     */
    private function createStatusUpdateNotification($ticket, $oldStatus, $newStatus)
    {
        // Find the user who created the ticket
        $user = User::where('email', $ticket->user_email)->first();
        
        if ($user) {
            $statusMessages = [
                'Open' => 'Tiket Anda telah dibuka dan sedang dalam antrian penanganan.',
                'In Progress' => 'Tiket Anda sedang dalam proses penanganan oleh tim developer.',
                'Resolved' => 'Tiket Anda telah diselesaikan. Silakan konfirmasi apakah masalah sudah teratasi.',
                'Closed' => 'Tiket Anda telah ditutup. Terima kasih telah menggunakan layanan support kami.',
            ];

            Notification::create([
                'user_id' => $user->id,
                'title' => 'Update Status Tiket #' . $ticket->ticket_number,
                'message' => "Status tiket Anda telah diubah dari '{$oldStatus}' menjadi '{$newStatus}'. " . ($statusMessages[$newStatus] ?? ''),
                'type' => $newStatus === 'Closed' ? 'success' : 'info',
                'data' => [
                    'ticket_id' => $ticket->id,
                    'ticket_number' => $ticket->ticket_number,
                    'old_status' => $oldStatus,
                    'new_status' => $newStatus,
                    'category' => $ticket->category,
                    'title' => $ticket->title,
                    'updated_at' => now(),
                ],
            ]);
        }
    }
}
