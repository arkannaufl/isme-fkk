<?php

namespace App\Http\Controllers;

use App\Models\MataKuliah;
use App\Models\JadwalNonBlokNonCSR;
use App\Models\User;
use App\Models\Ruangan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DetailNonBlokNonCSRController extends Controller
{
    public function getBatchData($kode)
    {
        try {
            // Get mata kuliah data
            $mataKuliah = MataKuliah::where('kode', $kode)->first();
            if (!$mataKuliah) {
                return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
            }

            // Get jadwal Non-Blok Non-CSR with eager loading
            $jadwalNonBlokNonCSR = JadwalNonBlokNonCSR::with(['dosen', 'ruangan'])
                ->where('mata_kuliah_kode', $kode)
                ->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get()
                ->map(function ($item) {
                    // Add dosen_names attribute for frontend
                    $item->dosen_names = $item->dosen_names;
                    return $item;
                });

            // Get reference data
            $dosenList = User::where('role', 'dosen')
                ->select('id', 'name', 'nid')
                ->orderBy('name', 'asc')
                ->get();

            $ruanganList = Ruangan::select('id', 'nama', 'kapasitas', 'gedung')
                ->orderBy('nama', 'asc')
                ->get();

            // Get jam options (hardcoded for now, can be moved to config)
            $jamOptions = [
                '07.20', '08.10', '09.00', '09.50', '10.40', '11.30', '12.35', 
                '13.25', '14.15', '15.05', '15.35', '16.25', '17.15'
            ];

            return response()->json([
                'mata_kuliah' => $mataKuliah,
                'jadwal_non_blok_non_csr' => $jadwalNonBlokNonCSR,
                'dosen_list' => $dosenList,
                'ruangan_list' => $ruanganList,
                'jam_options' => $jamOptions,
            ]);

        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data batch'], 500);
        }
    }
}
