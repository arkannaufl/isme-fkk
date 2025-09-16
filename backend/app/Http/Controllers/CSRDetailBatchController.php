<?php

namespace App\Http\Controllers;

use App\Models\CSR;
use App\Models\User;
use App\Models\PBL;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CSRDetailBatchController extends Controller
{
    /**
     * Get all data needed for CSRDetail.tsx in a single request
     */
    public function getBatchData(string $csrId): JsonResponse
    {
        try {
            // Get CSR details with mata kuliah relationship
            $csr = CSR::with(['mataKuliah'])->findOrFail($csrId);
            
            // Get all dosen with role 'dosen'
            $allDosen = User::where('role', 'dosen')
                ->select('id', 'name', 'nid', 'nidn', 'email', 'keahlian', 'role')
                ->get()
                ->map(function ($dosen) {
                    // Normalize keahlian to array
                    $keahlian = is_array($dosen->keahlian) 
                        ? $dosen->keahlian 
                        : (is_string($dosen->keahlian) 
                            ? json_decode($dosen->keahlian, true) ?? [] 
                            : []);
                    
                    return [
                        'id' => $dosen->id,
                        'name' => $dosen->name,
                        'nid' => $dosen->nid,
                        'nidn' => $dosen->nidn,
                        'email' => $dosen->email,
                        'keahlian' => $keahlian,
                        'role' => $dosen->role,
                    ];
                });

            // Separate regular and standby dosen
            $regularDosen = $allDosen->filter(function ($dosen) {
                return !collect($dosen['keahlian'])->contains(function ($k) {
                    return strtolower($k) === 'standby';
                });
            })->values();

            $standbyDosen = $allDosen->filter(function ($dosen) {
                return collect($dosen['keahlian'])->contains(function ($k) {
                    return strtolower($k) === 'standby';
                });
            })->values();

            // Get CSR mappings (assigned dosen per keahlian)
            $mappings = DB::table('csr_mappings')
                ->join('users', 'csr_mappings.dosen_id', '=', 'users.id')
                ->where('csr_mappings.csr_id', $csrId)
                ->select(
                    'csr_mappings.keahlian',
                    'users.id',
                    'users.name',
                    'users.nid',
                    'users.nidn',
                    'users.email',
                    'users.keahlian as user_keahlian',
                    'users.role'
                )
                ->get();

            $mappingData = [];
            foreach ($csr->keahlian_required as $keahlian) {
                $mappingData[$keahlian] = [];
            }

            foreach ($mappings as $mapping) {
                $keahlian = $mapping->keahlian;
                if (isset($mappingData[$keahlian])) {
                    $userKeahlian = is_array($mapping->user_keahlian) 
                        ? $mapping->user_keahlian 
                        : (is_string($mapping->user_keahlian) 
                            ? json_decode($mapping->user_keahlian, true) ?? [] 
                            : []);
                    
                    $mappingData[$keahlian][] = [
                        'id' => $mapping->id,
                        'name' => $mapping->name,
                        'nid' => $mapping->nid,
                        'nidn' => $mapping->nidn,
                        'email' => $mapping->email,
                        'keahlian' => $userKeahlian,
                        'role' => $mapping->role,
                    ];
                }
            }

            // Get PBL dosen by semester
            $pblData = PBL::with(['mataKuliah'])
                ->get();

            $semesterPblIds = [];
            foreach ($pblData as $pbl) {
                $semester = $pbl->mataKuliah->semester;
                if (!isset($semesterPblIds[$semester])) {
                    $semesterPblIds[$semester] = [];
                }
                $semesterPblIds[$semester][] = $pbl->id;
            }

            $dosenPBLBySemester = [];
            $allPblIds = collect($semesterPblIds)->flatten()->toArray();
            
            if (!empty($allPblIds)) {
                $assignedDosen = DB::table('pbl_mappings')
                    ->join('users', 'pbl_mappings.dosen_id', '=', 'users.id')
                    ->whereIn('pbl_mappings.pbl_id', $allPblIds)
                    ->select(
                        'pbl_mappings.pbl_id',
                        'users.id',
                        'users.name',
                        'users.nid',
                        'users.nidn',
                        'users.email',
                        'users.keahlian',
                        'users.role'
                    )
                    ->get()
                    ->groupBy('pbl_id');

                foreach ($semesterPblIds as $semester => $pblIds) {
                    $dosenSet = collect();
                    foreach ($pblIds as $pblId) {
                        if (isset($assignedDosen[$pblId])) {
                            foreach ($assignedDosen[$pblId] as $dosen) {
                                $keahlian = is_array($dosen->keahlian) 
                                    ? $dosen->keahlian 
                                    : (is_string($dosen->keahlian) 
                                        ? json_decode($dosen->keahlian, true) ?? [] 
                                        : []);
                                
                                $dosenSet->put($dosen->id, [
                                    'id' => $dosen->id,
                                    'name' => $dosen->name,
                                    'nid' => $dosen->nid,
                                    'nidn' => $dosen->nidn,
                                    'email' => $dosen->email,
                                    'keahlian' => $keahlian,
                                    'role' => $dosen->role,
                                ]);
                            }
                        }
                    }
                    $dosenPBLBySemester[$semester] = $dosenSet->values()->toArray();
                }
            }

            return response()->json([
                'csr' => $csr,
                'regular_dosen' => $regularDosen,
                'standby_dosen' => $standbyDosen,
                'mapping' => $mappingData,
                'dosen_pbl_by_semester' => $dosenPBLBySemester,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengambil data batch CSR Detail: ' . $e->getMessage()
            ], 500);
        }
    }
}
