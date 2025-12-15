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
use Illuminate\Support\Facades\Cache;

class DetailNonBlokCSRController extends Controller
{
    public function getBatchData($kode)
    {
        try {
            // Get mata kuliah data - optimized with cache
            $cacheKey = 'mata_kuliah_' . $kode;
            $mataKuliah = Cache::remember($cacheKey, 3600, function () use ($kode) {
                return MataKuliah::where('kode', $kode)->first();
            });
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
                // Ensure dosen_id is included
                if (!$item->dosen_id && $item->dosen) {
                    $item->dosen_id = $item->dosen->id;
                }
                // Ensure ruangan_id is included
                if (!$item->ruangan_id && $item->ruangan) {
                    $item->ruangan_id = $item->ruangan->id;
                }
                // Ensure kelompok_kecil_id is included
                if (!$item->kelompok_kecil_id && $item->kelompokKecil) {
                    $item->kelompok_kecil_id = $item->kelompokKecil->id;
                }
                // Ensure kategori_id is included
                if (!$item->kategori_id && $item->kategori) {
                    $item->kategori_id = $item->kategori->id;
                }
                // Ensure topik is included
                if (empty($item->topik)) {
                    $originalTopik = $item->getOriginal('topik');
                    if ($originalTopik) {
                        $item->topik = $originalTopik;
                    }
                }
                // Ensure jenis_csr is included
                if (empty($item->jenis_csr)) {
                    $originalJenisCSR = $item->getOriginal('jenis_csr');
                    if ($originalJenisCSR) {
                        $item->jenis_csr = $originalJenisCSR;
                    }
                }
                // Ensure jumlah_sesi is included
                if (!$item->jumlah_sesi) {
                    $originalJumlahSesi = $item->getOriginal('jumlah_sesi');
                    if ($originalJumlahSesi) {
                        $item->jumlah_sesi = $originalJumlahSesi;
                    }
                }
                return $item;
            });

            // Get kategori CSR untuk mata kuliah ini - optimized with cache
            $cacheKeyKategori = 'csr_kategori_' . $kode;
            $kategoriList = Cache::remember($cacheKeyKategori, 1800, function () use ($kode) {
                return CSR::where('mata_kuliah_kode', $kode)
                    ->select('id', 'nama', 'nomor_csr', 'keahlian_required')
                    ->orderBy('nomor_csr', 'asc')
                    ->get();
            });

            // Get dosen yang sudah di-mapping untuk CSR kategori ini - optimized with batch loading
            $dosenList = collect();
            if ($kategoriList->isNotEmpty()) {
                // Batch load all CSR mappings to avoid N+1 queries
                $kategoriIds = $kategoriList->pluck('id')->toArray();
                $mappings = CSRMapping::with('dosen')
                    ->whereIn('csr_id', $kategoriIds)
                    ->get()
                    ->keyBy('id');
                
                // Create kategori map for quick lookup
                $kategoriMap = $kategoriList->keyBy('id');
                
                foreach ($mappings as $mapping) {
                    if ($mapping->dosen && $kategoriMap->has($mapping->csr_id)) {
                        $kategori = $kategoriMap->get($mapping->csr_id);
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
                        
                        // Allow multiple entries for same dosen if they have different keahlian
                        // Check if this exact combination (dosen + keahlian + csr) already exists
                        $exists = $dosenList->contains(function ($item) use ($dosenData) {
                            return $item['id'] === $dosenData['id'] && 
                                   $item['keahlian'] === $dosenData['keahlian'] && 
                                   $item['csr_id'] === $dosenData['csr_id'];
                        });
                        
                        if (!$exists) {
                            $dosenList->push($dosenData);
                        }
                    }
                }
            }

            // Sort dosen by name
            $dosenList = $dosenList->sortBy('name')->values();

            // Get ruangan list - optimized with cache
            $ruanganList = Cache::remember('ruangan_list_all', 1800, function () {
                return Ruangan::select('id', 'nama', 'kapasitas', 'gedung')
                    ->orderBy('nama', 'asc')
                    ->get();
            });

            // Get kelompok kecil berdasarkan semester mata kuliah - optimized with cache
            $cacheKeyKelompok = 'kelompok_kecil_semester_' . $mataKuliah->semester;
            $kelompokKecilList = Cache::remember($cacheKeyKelompok, 1800, function () use ($mataKuliah) {
                // Ambil semua kelompok kecil untuk semester ini, lalu ambil unik berdasarkan nama_kelompok
                // Ambil id pertama untuk setiap nama_kelompok
                return KelompokKecil::where('semester', $mataKuliah->semester)
                    ->select('id', 'nama_kelompok')
                    ->orderBy('nama_kelompok', 'asc')
                    ->get()
                    ->unique('nama_kelompok')
                    ->values()
                    ->map(function ($item) {
                        return [
                            'id' => $item->id,
                            'nama_kelompok' => $item->nama_kelompok
                        ];
                    });
            });

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
