<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use App\Models\Developer;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class TicketController extends Controller
{
    /**
     * Get all tickets for the authenticated user
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        
        \Log::info('TicketController::index - User:', ['user_id' => $user->id, 'email' => $user->email]);
        
        $perPage = $request->get('per_page', 10);
        $tickets = Ticket::where('user_email', $user->email)
            ->with('developer')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        \Log::info('TicketController::index - Found tickets:', ['count' => $tickets->count(), 'total' => $tickets->total()]);

        return response()->json([
            'success' => true,
            'data' => $tickets
        ]);
    }

    /**
     * Get all tickets (Super Admin only)
     */
    public function allTickets(Request $request)
    {
        $user = Auth::user();
        
        // Check if user is super admin
        if ($user->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access'
            ], 403);
        }
        
        \Log::info('TicketController::allTickets - Super Admin:', ['user_id' => $user->id, 'email' => $user->email]);
        
        $perPage = $request->get('per_page', 10);
        $tickets = Ticket::with('developer')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        \Log::info('TicketController::allTickets - Found tickets:', ['count' => $tickets->count(), 'total' => $tickets->total()]);

        return response()->json([
            'success' => true,
            'data' => $tickets
        ]);
    }

    /**
     * Get ticket by ID
     */
    public function show($id)
    {
        $user = Auth::user();
        
        $ticket = Ticket::where('id', $id)
            ->where('user_email', $user->email)
            ->with('developer')
            ->first();

        if (!$ticket) {
            return response()->json([
                'success' => false,
                'message' => 'Ticket not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $ticket
        ]);
    }

    /**
     * Create new ticket
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'category' => 'required|string',
            'priority' => 'required|in:Low,Medium,High,Critical',
            'assigned_to' => 'required|exists:developers,id',
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

        $ticket = Ticket::create([
            'ticket_number' => 'TK-' . strtoupper(Str::random(8)),
            'title' => $request->title,
            'description' => $request->description,
            'category' => $request->category,
            'priority' => $request->priority,
            'status' => 'Open',
            'assigned_to' => $request->assigned_to,
            'user_name' => $request->user_name,
            'user_email' => $request->user_email,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Load developer relationship
        $ticket->load('developer');

        return response()->json([
            'success' => true,
            'message' => 'Ticket created successfully',
            'data' => $ticket
        ], 201);
    }

    /**
     * Update ticket status (for developers/admins)
     */
    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:Open,In Progress,Resolved,Closed',
            'response_time' => 'nullable|integer',
            'resolution_time' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $ticket = Ticket::findOrFail($id);
        
        // Store old status for notification
        $oldStatus = $ticket->status;
        
        $ticket->update([
            'status' => $request->status,
            'response_time' => $request->response_time,
            'resolution_time' => $request->resolution_time,
            'updated_at' => now(),
        ]);

        // Create notification for status update
        $this->createStatusUpdateNotification($ticket, $oldStatus, $request->status);

        return response()->json([
            'success' => true,
            'message' => 'Ticket status updated successfully',
            'data' => $ticket
        ]);
    }

    /**
     * Rate ticket satisfaction
     */
    public function rate(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'satisfaction_rating' => 'required|integer|min:1|max:5',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        
        $ticket = Ticket::where('id', $id)
            ->where('user_email', $user->email)
            ->first();

        if (!$ticket) {
            return response()->json([
                'success' => false,
                'message' => 'Ticket not found'
            ], 404);
        }

        $ticket->update([
            'satisfaction_rating' => $request->satisfaction_rating,
            'updated_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Ticket rated successfully',
            'data' => $ticket
        ]);
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
