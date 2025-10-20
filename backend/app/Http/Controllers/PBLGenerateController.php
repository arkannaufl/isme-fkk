<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Models\PBLMapping;
use App\Models\PBL;
use App\Models\User;
use App\Models\MataKuliah;
use App\Models\DosenPeran;

class PBLGenerateController extends Controller
{
    /**
     * Generate assignments untuk PBL berdasarkan data yang dikirim dari frontend
     */
    public function generateAssignments(Request $request)
    {
        try {
            // Validasi input
            $data = $request->validate([
                'assignments' => 'required|array',
                'assignments.*.pbl_id' => 'required|integer|exists:pbls,id',
                'assignments.*.dosen_id' => 'required|integer|exists:users,id',
                'assignments.*.role' => 'required|string|in:koordinator,tim_blok,dosen_mengajar',
            ]);

            $results = [];
            $successCount = 0;
            $errorCount = 0;

            // Proses setiap assignment
            foreach ($data['assignments'] as $assignment) {
                try {
                    // Cek apakah assignment sudah ada
                    $existing = PBLMapping::where('pbl_id', $assignment['pbl_id'])
                        ->where('dosen_id', $assignment['dosen_id'])
                        ->first();

                    if ($existing) {
                        $results[] = [
                            'pbl_id' => $assignment['pbl_id'],
                            'dosen_id' => $assignment['dosen_id'],
                            'status' => 'skipped',
                            'message' => 'Assignment sudah ada',
                        ];
                        continue;
                    }

                    // Buat assignment baru
                    PBLMapping::create([
                        'pbl_id' => $assignment['pbl_id'],
                        'dosen_id' => $assignment['dosen_id'],
                        'role' => $assignment['role'],
                    ]);

                    // Increment pbl_assignment_count di database
                    $user = User::find($assignment['dosen_id']);
                    if ($user) {
                        $user->increment('pbl_assignment_count');
                    }

                    // Buat DosenPeran record untuk Dosen Mengajar
                    if ($assignment['role'] === 'dosen_mengajar') {
                        $this->createDosenPeranRecord($assignment);
                    }

                    $results[] = [
                        'pbl_id' => $assignment['pbl_id'],
                        'dosen_id' => $assignment['dosen_id'],
                        'status' => 'success',
                        'message' => 'Assignment berhasil dibuat',
                    ];

                    $successCount++;
                } catch (\Exception $e) {
                    $results[] = [
                        'pbl_id' => $assignment['pbl_id'],
                        'dosen_id' => $assignment['dosen_id'],
                        'status' => 'error',
                        'message' => $e->getMessage(),
                    ];
                    $errorCount++;
                }
            }

            return response()->json([
                'success' => true,
                'message' => "Generate selesai. {$successCount} berhasil, {$errorCount} gagal.",
                'results' => $results,
                'summary' => [
                    'total' => count($data['assignments']),
                    'success' => $successCount,
                    'error' => $errorCount,
                    'skipped' => count($data['assignments']) - $successCount - $errorCount,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Terjadi error: ' . $e->getMessage(),
                'results' => []
            ], 500);
        }
    }

    /**
     * Buat DosenPeran record untuk Dosen Mengajar
     */
    private function createDosenPeranRecord($assignment)
    {
        try {
            // Ambil data PBL dan Mata Kuliah
            $pbl = PBL::with('mataKuliah')->find($assignment['pbl_id']);
            if (!$pbl || !$pbl->mataKuliah) {
                return;
            }

            $mataKuliah = $pbl->mataKuliah;

            // Cek apakah DosenPeran record sudah ada
            $existingDosenPeran = DosenPeran::where([
                'user_id' => $assignment['dosen_id'],
                'mata_kuliah_kode' => $mataKuliah->kode,
                'semester' => $mataKuliah->semester,
                'tipe_peran' => 'dosen_mengajar'
            ])->first();

            if (!$existingDosenPeran) {
                // Ambil peran kurikulum yang tersedia untuk mata kuliah ini
                $peranKurikulum = $mataKuliah->peran_dalam_kurikulum ?? [];
                $peranKurikulumArray = is_string($peranKurikulum)
                    ? json_decode($peranKurikulum, true)
                    : $peranKurikulum;

                // Pilih peran kurikulum pertama yang tersedia (biasanya "Dosen Mengajar")
                $selectedPeranKurikulum = is_array($peranKurikulumArray) && count($peranKurikulumArray) > 0
                    ? $peranKurikulumArray[0]
                    : 'Dosen Mengajar';

                // Buat DosenPeran record baru
                DosenPeran::create([
                    'user_id' => $assignment['dosen_id'],
                    'mata_kuliah_kode' => $mataKuliah->kode,
                    'blok' => $mataKuliah->blok ?? 0,
                    'semester' => $mataKuliah->semester,
                    'tipe_peran' => 'dosen_mengajar',
                    'peran_kurikulum' => $selectedPeranKurikulum,
                ]);
            }
        } catch (\Exception $e) {
            // Log error tapi jangan gagalkan assignment
            \Log::error("Failed to create DosenPeran record", [
                'assignment' => $assignment,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Reset semua assignments untuk PBL yang diberikan
     */
    public function resetAssignments(Request $request)
    {
        try {
            $data = $request->validate([
                'pbl_ids' => 'required|array',
                'pbl_ids.*' => 'required|integer|exists:pbls,id',
            ]);

            $deletedCount = 0;

            foreach ($data['pbl_ids'] as $pblId) {
                // Ambil data dosen yang akan dihapus sebelum menghapus mapping
                $mappings = PBLMapping::where('pbl_id', $pblId)->get();

                // Decrement pbl_assignment_count untuk setiap dosen
                foreach ($mappings as $mapping) {
                    $user = User::find($mapping->dosen_id);
                    if ($user && $user->pbl_assignment_count > 0) {
                        $user->decrement('pbl_assignment_count');
                    }
                }

                // Hapus semua mapping untuk PBL ini
                $deleted = PBLMapping::where('pbl_id', $pblId)->delete();
                $deletedCount += $deleted;

                // Hapus DosenPeran records untuk Dosen Mengajar
                $pbl = PBL::with('mataKuliah')->find($pblId);
                if ($pbl && $pbl->mataKuliah) {
                    DosenPeran::where([
                        'mata_kuliah_kode' => $pbl->mataKuliah->kode,
                        'semester' => $pbl->mataKuliah->semester,
                        'tipe_peran' => 'dosen_mengajar'
                    ])->delete();
                }
            }

            return response()->json([
                'success' => true,
                'message' => "Reset berhasil. {$deletedCount} assignments dihapus.",
                'deleted_count' => $deletedCount
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Terjadi error: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Ambil data assignments yang sudah ada
     */
    public function getAssignments(Request $request)
    {
        try {
            $data = $request->validate([
                'pbl_ids' => 'required|array',
                'pbl_ids.*' => 'integer',
            ]);

            $assignments = PBLMapping::with(['pbl.mataKuliah', 'dosen'])
                ->whereIn('pbl_id', $data['pbl_ids'])
                ->get()
                ->groupBy('pbl_id');

            // Ambil assignment count dari database untuk setiap dosen
            $dosenIds = $assignments->flatten()->pluck('dosen_id')->unique();
            $dosenAssignmentCounts = User::whereIn('id', $dosenIds)
                ->pluck('pbl_assignment_count', 'id')
                ->toArray();

            // Tambahkan assignment count ke setiap assignment
            $processedAssignments = [];
            foreach ($assignments as $pblId => $pblAssignments) {
                $processedAssignments[$pblId] = $pblAssignments->map(function ($assignment) use ($dosenAssignmentCounts) {
                    $assignment->pbl_assignment_count = $dosenAssignmentCounts[$assignment->dosen_id] ?? 0;
                    return $assignment;
                });
            }

            return response()->json([
                'success' => true,
                'data' => $processedAssignments
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Terjadi error: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Cek status generate per blok
     */
    public function checkGenerateStatus(Request $request)
    {
        try {
            $blok = $request->query('blok');

            if (!$blok) {
                return response()->json([
                    'success' => false,
                    'message' => 'Parameter blok diperlukan'
                ], 400);
            }

            // Cari semua mata kuliah dengan blok yang diminta
            $mataKuliahList = MataKuliah::where('blok', $blok)
                ->where('jenis', 'Blok')
                ->get();

            if ($mataKuliahList->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'blok' => $blok,
                        'is_generated' => false,
                        'message' => 'Blok tidak ditemukan'
                    ]
                ]);
            }

            // Cari PBL untuk semua mata kuliah di blok ini
            $mataKuliahKodes = $mataKuliahList->pluck('kode');
            $pbls = PBL::whereIn('mata_kuliah_kode', $mataKuliahKodes)->get();

            if ($pbls->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'blok' => $blok,
                        'is_generated' => false,
                        'message' => 'Tidak ada modul PBL untuk blok ini'
                    ]
                ]);
            }

            // Cek apakah ada assignment untuk PBL di blok ini
            $pblIds = $pbls->pluck('id');
            $assignments = PBLMapping::whereIn('pbl_id', $pblIds)->count();

            $isGenerated = $assignments > 0;

            return response()->json([
                'success' => true,
                'data' => [
                    'blok' => $blok,
                    'is_generated' => $isGenerated,
                    'assignment_count' => $assignments,
                    'pbl_count' => $pbls->count(),
                    'message' => $isGenerated ? 'Blok sudah di-generate' : 'Blok belum di-generate'
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Terjadi error: ' . $e->getMessage(),
            ], 500);
        }
    }
}
