<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use App\Models\Developer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MetricsController extends Controller
{
    /**
     * Get SLA metrics
     */
    public function index()
    {
        $totalTickets = Ticket::count();
        $openTickets = Ticket::where('status', 'Open')->count();
        $resolvedTickets = Ticket::where('status', 'Resolved')->count();
        
        // Calculate average response time (in minutes)
        $averageResponseTime = Ticket::whereNotNull('response_time')
            ->avg('response_time') ?? 0;
        
        // Calculate average resolution time (in hours)
        $averageResolutionTime = Ticket::whereNotNull('resolution_time')
            ->avg('resolution_time') ?? 0;
        
        // Calculate satisfaction score (percentage)
        $satisfactionScore = Ticket::whereNotNull('satisfaction_rating')
            ->avg('satisfaction_rating') ?? 0;
        $satisfactionPercentage = ($satisfactionScore / 5) * 100;

        return response()->json([
            'success' => true,
            'data' => [
                'total_tickets' => $totalTickets,
                'open_tickets' => $openTickets,
                'resolved_tickets' => $resolvedTickets,
                'average_response_time' => round($averageResponseTime, 1),
                'average_resolution_time' => round($averageResolutionTime, 1),
                'satisfaction_score' => round($satisfactionPercentage, 1),
            ]
        ]);
    }

    /**
     * Get ticket statistics by status
     */
    public function ticketStats()
    {
        $stats = Ticket::select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status');

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }

    /**
     * Get ticket statistics by priority
     */
    public function priorityStats()
    {
        $stats = Ticket::select('priority', DB::raw('count(*) as count'))
            ->groupBy('priority')
            ->get()
            ->pluck('count', 'priority');

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }

    /**
     * Get developer workload
     */
    public function developerWorkload()
    {
        $workload = Developer::withCount(['tickets' => function ($query) {
            $query->whereIn('status', ['Open', 'In Progress']);
        }])
        ->get()
        ->map(function ($developer) {
            return [
                'developer_id' => $developer->id,
                'developer_name' => $developer->name,
                'active_tickets' => $developer->tickets_count,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $workload
        ]);
    }

    /**
     * Get monthly ticket trends
     */
    public function monthlyTrends()
    {
        $trends = Ticket::select(
            DB::raw('DATE_FORMAT(created_at, "%Y-%m") as month'),
            DB::raw('count(*) as count')
        )
        ->where('created_at', '>=', now()->subMonths(12))
        ->groupBy('month')
        ->orderBy('month')
        ->get();

        return response()->json([
            'success' => true,
            'data' => $trends
        ]);
    }
}
