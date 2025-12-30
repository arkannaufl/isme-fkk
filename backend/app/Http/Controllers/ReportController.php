<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\User;
use App\Models\AbsensiJurnal;
use App\Models\AbsensiPBL;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Export Excel data untuk Non Blok (CSR Reguler, CSR Responsi, Materi)
     */
    public function exportExcelNonBlok(Request $request): JsonResponse
    {
        try {
            \Log::info('=== EXPORT EXCEL NON BLOK ===');
            
            // Ambil semua mata kuliah yang jenisnya "Non Blok"
            $mataKuliahNonBlok = DB::table('mata_kuliah')
                ->where('jenis', 'Non Blok')
                ->whereNotNull('semester')
                ->get();
            
            \Log::info('Total mata kuliah non blok: ' . $mataKuliahNonBlok->count());
            
            $result = [];
            
            foreach($mataKuliahNonBlok as $mk) {
                $semester = $mk->semester;
                
                // Ambil data jadwal untuk mata kuliah Non Blok ini
                $jadwalData = [
                    'blok' => null, // Non blok
                    'semester' => $semester,
                    'mata_kuliah_kode' => $mk->kode,
                    'mata_kuliah_nama' => $mk->nama,
                    'csr_reguler' => [],
                    'csr_responsi' => [],
                    'materi' => []
                ];
                
                // Jadwal CSR Reguler - gunakan data dari csrs yang sudah ada
                $csrReguler = DB::table('csrs')
                    ->where('mata_kuliah_kode', $mk->kode)
                    ->where('status', 'available')
                    ->count();
                
                if ($csrReguler > 0) {
                    // Untuk Non Blok, gunakan data dari tabel users yang memiliki role dosen
                    $dosenCSR = DB::table('users')
                        ->where('role', 'dosen')
                        ->first();
                    
                    if ($dosenCSR) {
                        $jadwalData['csr_reguler'][] = [
                            'dosen_name' => $dosenCSR->name,
                            'jumlah_sesi' => $csrReguler
                        ];
                    }
                }
                
                // Jadwal CSR Responsi - gunakan data dari csrs yang sudah assigned
                $csrResponsi = DB::table('csrs')
                    ->where('mata_kuliah_kode', $mk->kode)
                    ->where('status', 'assigned')
                    ->count();
                
                if ($csrResponsi > 0) {
                    // Untuk Non Blok, gunakan data dari tabel users yang memiliki role dosen
                    $dosenCSR = DB::table('users')
                        ->where('role', 'dosen')
                        ->first();
                    
                    if ($dosenCSR) {
                        $jadwalData['csr_responsi'][] = [
                            'dosen_name' => $dosenCSR->name,
                            'jumlah_sesi' => $csrResponsi
                        ];
                    }
                }
                
                // Jadwal Materi - gunakan data dari csrs sebagai proxy untuk materi
                $jumlahMateri = DB::table('csrs')
                    ->where('mata_kuliah_kode', $mk->kode)
                    ->count();
                
                if ($jumlahMateri > 0) {
                    // Untuk Non Blok, gunakan data dari tabel users yang memiliki role dosen
                    $dosenMateri = DB::table('users')
                        ->where('role', 'dosen')
                        ->first();
                    
                    if ($dosenMateri) {
                        $jadwalData['materi'][] = [
                            'dosen_name' => $dosenMateri->name,
                            'jumlah_sesi' => $jumlahMateri
                        ];
                    }
                }
                
                $result[] = $jadwalData;
            }
            
            \Log::info('Total non blok data processed: ' . count($result));
            
            return response()->json([
                'success' => true,
                'data' => $result,
                'total' => count($result),
                'message' => 'Non Blok data for Excel export retrieved successfully'
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to export Excel Non Blok: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export Excel Non Blok: ' . $e->getMessage()
            ], 500);
        }
    }
}