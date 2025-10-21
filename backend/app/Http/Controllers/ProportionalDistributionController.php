<?php

namespace App\Http\Controllers;

use App\Models\ProportionalDistribution;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class ProportionalDistributionController extends Controller
{
    /**
     * Save proportional distribution data
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'blok_id' => 'required|integer|min:1|max:4',
            'active_semester' => 'required|string',
            'semester_needs' => 'required|array',
            'semester_percentages' => 'required|array',
            'semester_distribution' => 'required|array',
            'total_dosen_available' => 'required|integer|min:0',
            'total_needs' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Delete existing distribution for this blok and semester
            ProportionalDistribution::where('blok_id', $request->blok_id)
                ->where('active_semester', $request->active_semester)
                ->delete();

            // Create new distribution
            $distribution = ProportionalDistribution::create([
                'blok_id' => $request->blok_id,
                'active_semester' => $request->active_semester,
                'semester_needs' => $request->semester_needs,
                'semester_percentages' => $request->semester_percentages,
                'semester_distribution' => $request->semester_distribution,
                'total_dosen_available' => $request->total_dosen_available,
                'total_needs' => $request->total_needs,
                'generated_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Proportional distribution saved successfully',
                'data' => $distribution
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to save proportional distribution',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get proportional distribution data
     */
    public function show(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'blok_id' => 'required|integer|min:1|max:4',
            'active_semester' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $distribution = ProportionalDistribution::where('blok_id', $request->blok_id)
                ->where('active_semester', $request->active_semester)
                ->orderBy('generated_at', 'desc')
                ->first();

            if (!$distribution) {
                return response()->json([
                    'success' => false,
                    'message' => 'No proportional distribution found',
                    'data' => null
                ], 404);
            }

            return response()->json([
                'success' => true,
                'message' => 'Proportional distribution retrieved successfully',
                'data' => [
                    'semesterNeeds' => $distribution->semester_needs,
                    'semesterPercentages' => $distribution->semester_percentages,
                    'semesterDistribution' => $distribution->semester_distribution,
                    'totalDosenAvailable' => $distribution->total_dosen_available,
                    'totalNeeds' => $distribution->total_needs,
                    'generatedAt' => $distribution->generated_at,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve proportional distribution',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete proportional distribution data
     */
    public function destroy(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'blok_id' => 'required|integer|min:1|max:4',
            'active_semester' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $deleted = ProportionalDistribution::where('blok_id', $request->blok_id)
                ->where('active_semester', $request->active_semester)
                ->delete();

            return response()->json([
                'success' => true,
                'message' => 'Proportional distribution deleted successfully',
                'deleted_count' => $deleted
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete proportional distribution',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
