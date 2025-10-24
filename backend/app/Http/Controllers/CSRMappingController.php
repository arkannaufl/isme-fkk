<?php

namespace App\Http\Controllers;

use App\Models\CSRMapping;
use App\Models\CSR;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class CSRMappingController extends Controller
{
    // List dosen yang sudah di-mapping ke CSR tertentu
    public function index($csrId)
    {
        $mappings = CSRMapping::with('dosen')
            ->where('csr_id', $csrId)
            ->get();
        // Return keahlian as well
        $data = $mappings->map(function ($m) {
            if ($m->dosen) {
                // Ensure csr_assignment_count is loaded
                $m->dosen->csr_assignment_count = $m->dosen->csr_assignment_count ?? 0;
            }
            return [
                'id' => $m->id,
                'csr_id' => $m->csr_id,
                'dosen' => $m->dosen,
                'keahlian' => $m->keahlian,
            ];
        });
        return response()->json(['data' => $data]);
    }

    // Mapping dosen ke CSR (anti duplikat)
    public function store(Request $request, $csrId)
    {
        $request->validate([
            'dosen_id' => 'required|exists:users,id',
            'keahlian' => 'required|string',
        ]);
        // Cek duplikat untuk keahlian yang sama
        $exists = CSRMapping::where('csr_id', $csrId)
            ->where('dosen_id', $request->dosen_id)
            ->where('keahlian', $request->keahlian)
            ->exists();
        if ($exists) {
            return response()->json(['message' => 'Dosen sudah di-mapping ke keahlian ini'], 422);
        }
        $mapping = CSRMapping::create([
            'csr_id' => $csrId,
            'dosen_id' => $request->dosen_id,
            'keahlian' => $request->keahlian,
        ]);


        // Log activity

        activity()

            ->log('CSR Mapping deleted');


        // Log activity

        activity()

            ->log('CSR Mapping updated');


        // Log activity

        activity()

            ->log('CSR Mapping created');
        // Increment count
        $user = \App\Models\User::find($request->dosen_id);
        if ($user) $user->increment('csr_assignment_count');
        return response()->json(['data' => $mapping], 201);
    }

    // Unmapping dosen dari CSR
    public function destroy($csrId, $dosenId, $keahlian)
    {
        $mapping = CSRMapping::where('csr_id', $csrId)
            ->where('dosen_id', $dosenId)
            ->where('keahlian', $keahlian)
            ->first();
        if (!$mapping) {
            return response()->json(['message' => 'Mapping tidak ditemukan'], 404);
        }
        $mapping->delete();
        // Decrement count
        $user = \App\Models\User::find($dosenId);
        if ($user && $user->csr_assignment_count > 0) $user->decrement('csr_assignment_count');
        return response()->json(['message' => 'Mapping dihapus']);
    }

    // Auto-delete CSR assignments saat dosen dihapus dari PBL berdasarkan semester dan blok
    public function deleteByDosenSemesterBlok(Request $request, $dosenId)
    {
        $semester = $request->query('semester');
        $blok = $request->query('blok');

        if (!$semester || !$blok) {
            return response()->json([
                'message' => 'Semester dan blok harus disertakan',
            ], 400);
        }

        try {
            // Cari semua CSR yang ada di semester dan blok yang sama
            // CSR menggunakan nomor_csr format "semester.blok" (contoh: "7.3")
            // Gunakan LIKE untuk filter berdasarkan semester, lalu filter blok di collection
            $allCSRs = CSR::where('nomor_csr', 'LIKE', "$semester.%")->get();

            // Filter berdasarkan blok menggunakan accessor
            $filteredCSRs = $allCSRs->filter(function ($csr) use ($blok) {
                return $csr->blok == $blok;
            });

            $csrIds = $filteredCSRs->pluck('id');

            if ($csrIds->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Tidak ada CSR ditemukan untuk semester dan blok tersebut',
                    'removed_count' => 0,
                ], 200);
            }

            // Hitung berapa banyak mapping dosen ini yang ada di CSR semester & blok tersebut
            $removedCount = CSRMapping::whereIn('csr_id', $csrIds)
                ->where('dosen_id', $dosenId)
                ->count();

            if ($removedCount > 0) {
                // Hapus hanya mapping dosen yang spesifik ini (dosen lain tidak terpengaruh)
                CSRMapping::whereIn('csr_id', $csrIds)
                    ->where('dosen_id', $dosenId)
                    ->delete();

                // Update counter di user
                $user = User::find($dosenId);
                if ($user) {
                    $newCount = max(0, $user->csr_assignment_count - $removedCount);
                    $user->csr_assignment_count = $newCount;
                    $user->save();
                }

                Log::info("Auto-deleted CSR assignments for dosen {$dosenId} in semester {$semester} blok {$blok}: {$removedCount} assignments removed");
            }

            return response()->json([
                'success' => true,
                'message' => $removedCount > 0
                    ? "Berhasil menghapus {$removedCount} assignment CSR untuk dosen di semester {$semester} blok {$blok}"
                    : 'Tidak ada assignment CSR yang dihapus',
                'removed_count' => $removedCount,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error deleting CSR assignments: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan saat menghapus assignment CSR',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
