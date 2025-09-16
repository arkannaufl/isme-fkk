<?php

namespace App\Http\Controllers;

use App\Models\CSR;
use App\Models\MataKuliah;
use App\Models\TahunAjaran;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CSRBatchController extends Controller
{
    /**
     * Get all data needed for CSR.tsx in a single request
     */
    public function getBatchData(): JsonResponse
    {
        try {
            // Get all CSR data with mata kuliah relationship
            $csrs = CSR::with(['mataKuliah'])
                ->orderBy('nomor_csr')
                ->get();

            // Get all mata kuliah for dropdown
            $mataKuliah = MataKuliah::select('kode', 'nama', 'jenis', 'tipe_non_block')
                ->where('jenis', 'Non Blok')
                ->where('tipe_non_block', 'CSR')
                ->orderBy('kode')
                ->get();

            // Get active semester
            $activeSemester = TahunAjaran::with(['semesters' => function ($query) {
                $query->where('aktif', true);
            }])
            ->where('aktif', true)
            ->first();

            $activeSemesterJenis = null;
            if ($activeSemester && $activeSemester->semesters->isNotEmpty()) {
                $activeSemesterJenis = $activeSemester->semesters->first()->jenis;
            }

            // Get CSR mappings for each CSR (dosen count per keahlian)
            $csrMappings = [];
            foreach ($csrs as $csr) {
                $mappings = DB::table('csr_mappings')
                    ->join('users', 'csr_mappings.dosen_id', '=', 'users.id')
                    ->where('csr_mappings.csr_id', $csr->id)
                    ->select('users.keahlian', DB::raw('count(*) as count'))
                    ->groupBy('users.keahlian')
                    ->get();

                $countPerKeahlian = [];
                foreach ($mappings as $mapping) {
                    $keahlian = is_array($mapping->keahlian) ? $mapping->keahlian : json_decode($mapping->keahlian, true);
                    if (is_array($keahlian)) {
                        foreach ($keahlian as $k) {
                            $countPerKeahlian[$k] = ($countPerKeahlian[$k] ?? 0) + $mapping->count;
                        }
                    }
                }
                $csrMappings[$csr->id] = $countPerKeahlian;
            }

            return response()->json([
                'csrs' => $csrs,
                'mata_kuliah' => $mataKuliah,
                'active_semester_jenis' => $activeSemesterJenis,
                'csr_mappings' => $csrMappings,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengambil data batch CSR: ' . $e->getMessage()
            ], 500);
        }
    }
}
