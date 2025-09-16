<?php

namespace App\Http\Controllers;

use App\Models\MataKuliah;
use App\Models\JadwalCSR;
use App\Models\User;
use App\Models\Ruangan;
use App\Models\KelompokKecil;
use App\Models\CSR;
use App\Models\CSRMapping;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DetailNonBlokCSRController extends Controller
{
    public function getBatchData($kode)
    {
        try {
            // Get mata kuliah data
            $mataKuliah = MataKuliah::where('kode', $kode)->first();
            if (!$mataKuliah) {
                return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
            }

            // Get jadwal CSR with eager loading
            $jadwalCSR = JadwalCSR::with(['dosen', 'ruangan', 'kelompokKecil', 'kategori'])
                ->where('mata_kuliah_kode', $kode)
                ->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();

            // Konversi format jam dari HH:MM ke HH.MM untuk frontend (tanpa detik)
            $jadwalCSR->transform(function ($item) {
                if ($item->jam_mulai) {
                    $jamMulai = str_replace(':', '.', $item->jam_mulai);
                    // Hapus detik jika ada (format HH.MM.SS -> HH.MM)
                    if (preg_match('/^(\d{2}\.\d{2})\.\d{2}$/', $jamMulai, $matches)) {
                        $jamMulai = $matches[1]; // Ambil HH.MM saja
                    }
                    $item->jam_mulai = $jamMulai;
                }
                if ($item->jam_selesai) {
                    $jamSelesai = str_replace(':', '.', $item->jam_selesai);
                    // Hapus detik jika ada (format HH.MM.SS -> HH.MM)
                    if (preg_match('/^(\d{2}\.\d{2})\.\d{2}$/', $jamSelesai, $matches)) {
                        $jamSelesai = $matches[1]; // Ambil HH.MM saja
                    }
                    $item->jam_selesai = $jamSelesai;
                }
                return $item;
            });

            // Get kategori CSR untuk mata kuliah ini
            $kategoriList = CSR::where('mata_kuliah_kode', $kode)
                ->select('id', 'nama', 'nomor_csr', 'keahlian_required')
                ->orderBy('nomor_csr', 'asc')
                ->get();

            // Get dosen yang sudah di-mapping untuk CSR kategori ini
            $dosenList = collect();
            foreach ($kategoriList as $kategori) {
                $mappings = CSRMapping::with('dosen')
                    ->where('csr_id', $kategori->id)
                    ->get();
                
                foreach ($mappings as $mapping) {
                    if ($mapping->dosen) {
                        // Add keahlian info to dosen data
                        $dosenData = [
                            'id' => $mapping->dosen->id,
                            'name' => $mapping->dosen->name,
                            'nid' => $mapping->dosen->nid,
                            'keahlian' => $mapping->keahlian,
                            'csr_id' => $kategori->id,
                            'csr_nama' => $kategori->nama,
                            'nomor_csr' => $kategori->nomor_csr
                        ];
                        
                        // Avoid duplicates by checking if dosen already exists
                        if (!$dosenList->contains('id', $mapping->dosen->id)) {
                            $dosenList->push($dosenData);
                        }
                    }
                }
            }

            // Sort dosen by name
            $dosenList = $dosenList->sortBy('name')->values();

            $ruanganList = Ruangan::select('id', 'nama', 'kapasitas', 'gedung')
                ->orderBy('nama', 'asc')
                ->get();

            // Get kelompok kecil berdasarkan semester mata kuliah
            $kelompokKecilList = KelompokKecil::where('semester', $mataKuliah->semester)
                ->select('id', 'nama_kelompok')
                ->distinct()
                ->orderBy('nama_kelompok', 'asc')
                ->get();

            // Get jam options (hardcoded for now, can be moved to config)
            $jamOptions = [
                '07.20', '08.10', '09.00', '09.50', '10.40', '11.30', '12.35', 
                '13.25', '14.15', '15.05', '15.35', '16.25', '17.15'
            ];

            return response()->json([
                'mata_kuliah' => $mataKuliah,
                'jadwal_csr' => $jadwalCSR,
                'dosen_list' => $dosenList,
                'ruangan_list' => $ruanganList,
                'kelompok_kecil' => $kelompokKecilList,
                'kategori_list' => $kategoriList,
                'jam_options' => $jamOptions,
            ]);

        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data batch'], 500);
        }
    }
}
