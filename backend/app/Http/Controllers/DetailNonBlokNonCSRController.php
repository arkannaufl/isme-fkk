<?php

namespace App\Http\Controllers;

use App\Models\MataKuliah;
use App\Models\JadwalNonBlokNonCSR;
use App\Models\User;
use App\Models\Ruangan;
use App\Models\KelompokBesar;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class DetailNonBlokNonCSRController extends Controller
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

            // Get jadwal Non-Blok Non-CSR with eager loading
            // Filter berdasarkan jenis_baris untuk memisahkan jadwal
            $jadwalNonBlokNonCSR = JadwalNonBlokNonCSR::with(['dosen', 'pembimbing', 'ruangan', 'kelompokBesar'])
                ->where('mata_kuliah_kode', $kode)
                ->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();
            
            // Optimized: Batch load all komentator and penguji IDs to avoid N+1 queries
            $allKomentatorIds = [];
            $allPengujiIds = [];
            foreach ($jadwalNonBlokNonCSR as $item) {
                if ($item->komentator_ids && is_array($item->komentator_ids)) {
                    $allKomentatorIds = array_merge($allKomentatorIds, $item->komentator_ids);
                }
                if ($item->penguji_ids && is_array($item->penguji_ids)) {
                    $allPengujiIds = array_merge($allPengujiIds, $item->penguji_ids);
                }
            }
            $allKomentatorIds = array_unique($allKomentatorIds);
            $allPengujiIds = array_unique($allPengujiIds);
            
            // Batch load all komentator and penguji users
            $komentatorUsersMap = !empty($allKomentatorIds) 
                ? User::whereIn('id', $allKomentatorIds)->get()->keyBy('id') 
                : collect();
            $pengujiUsersMap = !empty($allPengujiIds) 
                ? User::whereIn('id', $allPengujiIds)->get()->keyBy('id') 
                : collect();
            
            // Batch load all mahasiswa NIMs to avoid N+1 queries
            $allMahasiswaNims = [];
            foreach ($jadwalNonBlokNonCSR as $item) {
                if ($item->mahasiswa_nims && is_array($item->mahasiswa_nims)) {
                    $allMahasiswaNims = array_merge($allMahasiswaNims, $item->mahasiswa_nims);
                }
            }
            $allMahasiswaNims = array_unique($allMahasiswaNims);
            $mahasiswaUsersMap = !empty($allMahasiswaNims)
                ? User::where('role', 'mahasiswa')->whereIn('nim', $allMahasiswaNims)->get()->keyBy('nim')
                : collect();
            
            $jadwalNonBlokNonCSR = $jadwalNonBlokNonCSR->map(function ($item) use ($komentatorUsersMap, $pengujiUsersMap, $mahasiswaUsersMap) {
                    // Add dosen_names attribute for frontend
                    $item->dosen_names = $item->dosen_names;
                    
                    // Ensure dosen_id is included
                    if (!$item->dosen_id && $item->dosen) {
                        $item->dosen_id = $item->dosen->id;
                    }
                    // Ensure ruangan_id is included
                    if (!$item->ruangan_id && $item->ruangan) {
                        $item->ruangan_id = $item->ruangan->id;
                    }
                    // Ensure kelompok_besar_id is included from relationship
                    if (!$item->kelompok_besar_id && $item->kelompokBesar) {
                        $item->kelompok_besar_id = $item->kelompokBesar->id;
                    }
                    // Ensure materi is included
                    if (empty($item->materi)) {
                        $originalMateri = $item->getOriginal('materi');
                        if ($originalMateri) {
                            $item->materi = $originalMateri;
                        }
                    }
                    // Ensure agenda is included
                    if (empty($item->agenda) && $item->jenis_baris === 'agenda') {
                        $originalAgenda = $item->getOriginal('agenda');
                        if ($originalAgenda) {
                            $item->agenda = $originalAgenda;
                        }
                    }
                    // Ensure jenis_baris is included
                    if (empty($item->jenis_baris)) {
                        $originalJenisBaris = $item->getOriginal('jenis_baris');
                        if ($originalJenisBaris) {
                            $item->jenis_baris = $originalJenisBaris;
                        }
                    }
                    // Ensure use_ruangan is included
                    if ($item->use_ruangan === null) {
                        $originalUseRuangan = $item->getOriginal('use_ruangan');
                        if ($originalUseRuangan !== null) {
                            $item->use_ruangan = $originalUseRuangan;
                        } else {
                            $item->use_ruangan = true; // Default value
                        }
                    }
                    // Ensure jumlah_sesi is included
                    if (!$item->jumlah_sesi) {
                        $originalJumlahSesi = $item->getOriginal('jumlah_sesi');
                        if ($originalJumlahSesi) {
                            $item->jumlah_sesi = $originalJumlahSesi;
                        }
                    }
                    // Ensure pembimbing_id is included
                    if (!$item->pembimbing_id && $item->pembimbing) {
                        $item->pembimbing_id = $item->pembimbing->id;
                    }
                    // Ensure komentator_ids is included (from JSON)
                    if (!$item->komentator_ids) {
                        $originalKomentatorIds = $item->getOriginal('komentator_ids');
                        if ($originalKomentatorIds) {
                            $item->komentator_ids = $originalKomentatorIds;
                        }
                    }
                    // Load komentator names if komentator_ids exists - optimized with batch loading
                    if ($item->komentator_ids && is_array($item->komentator_ids) && count($item->komentator_ids) > 0) {
                        $item->komentator = collect($item->komentator_ids)
                            ->map(function ($id) use ($komentatorUsersMap) {
                                $user = $komentatorUsersMap->get($id);
                                return $user ? [
                                    'id' => $user->id,
                                    'name' => $user->name,
                                    'nid' => $user->nid
                                ] : null;
                            })
                            ->filter()
                            ->values()
                            ->toArray();
                    }
                    // Ensure penguji_ids is included (from JSON)
                    if (!$item->penguji_ids) {
                        $originalPengujiIds = $item->getOriginal('penguji_ids');
                        if ($originalPengujiIds) {
                            $item->penguji_ids = $originalPengujiIds;
                        }
                    }
                    // Load penguji names if penguji_ids exists - optimized with batch loading
                    if ($item->penguji_ids && is_array($item->penguji_ids) && count($item->penguji_ids) > 0) {
                        $item->penguji = collect($item->penguji_ids)
                            ->map(function ($id) use ($pengujiUsersMap) {
                                $user = $pengujiUsersMap->get($id);
                                return $user ? [
                                    'id' => $user->id,
                                    'name' => $user->name,
                                    'nid' => $user->nid
                                ] : null;
                            })
                            ->filter()
                            ->values()
                            ->toArray();
                    }
                    // Ensure mahasiswa_nims is included (from JSON)
                    if (!$item->mahasiswa_nims) {
                        $originalMahasiswaNims = $item->getOriginal('mahasiswa_nims');
                        if ($originalMahasiswaNims) {
                            $item->mahasiswa_nims = $originalMahasiswaNims;
                        }
                    }
                    return $item;
                });

            // Get reference data - optimized with cache
            $dosenList = Cache::remember('dosen_list_all', 1800, function () {
                return User::where('role', 'dosen')
                    ->select('id', 'name', 'nid')
                    ->orderBy('name', 'asc')
                    ->get();
            });

            $ruanganList = Cache::remember('ruangan_list_all', 1800, function () {
                return Ruangan::select('id', 'nama', 'kapasitas', 'gedung')
                    ->orderBy('nama', 'asc')
                    ->get();
            });

            // Get jam options (hardcoded for now, can be moved to config)
            $jamOptions = [
                '07.20', '08.10', '09.00', '09.50', '10.40', '11.30', '12.35',
                '13.25', '14.15', '15.05', '15.35', '16.25', '17.15'
            ];

            // Get mahasiswa options untuk Seminar Proposal (semua mahasiswa, tidak peduli kelompok) - optimized with cache
            $mahasiswaList = Cache::remember('mahasiswa_list_all', 1800, function () {
                return User::where('role', 'mahasiswa')
                    ->whereNotNull('nim')
                    ->select('id', 'name', 'nim')
                    ->orderBy('name', 'asc')
                    ->get()
                    ->map(function ($mahasiswa) {
                        return [
                            'id' => $mahasiswa->id,
                            'nim' => $mahasiswa->nim,
                            'name' => $mahasiswa->name,
                            'label' => "{$mahasiswa->name} ({$mahasiswa->nim})"
                        ];
                    });
            });

            // Get kelompok besar options untuk agenda dan materi - filter berdasarkan semester mata kuliah
            // Catatan: kelompok_besar_id menyimpan semester, bukan ID unik per mahasiswa
            // Hanya kirim kelompok besar yang semester nya sama dengan mata kuliah
            $kelompokBesarAgendaOptions = [];
            $kelompokBesarMateriOptions = [];
            
            // Filter berdasarkan semester mata kuliah
            $semesterMataKuliah = $mataKuliah->semester;
            
            if ($semesterMataKuliah) {
                $jumlahMahasiswa = KelompokBesar::where('semester', $semesterMataKuliah)->count();
                
                if ($jumlahMahasiswa > 0) {
                    // Gunakan semester sebagai ID (sesuai dengan bagaimana validateRuanganCapacity bekerja)
                    $kelompokBesarAgendaOptions[] = [
                        'id' => $semesterMataKuliah,
                        'label' => "Kelompok Besar Semester {$semesterMataKuliah} ({$jumlahMahasiswa} mahasiswa)",
                        'jumlah_mahasiswa' => $jumlahMahasiswa
                    ];
                    
                    $kelompokBesarMateriOptions[] = [
                        'id' => $semesterMataKuliah,
                        'label' => "Kelompok Besar Semester {$semesterMataKuliah} ({$jumlahMahasiswa} mahasiswa)",
                        'jumlah_mahasiswa' => $jumlahMahasiswa
                    ];
                }
            }
            
            // Untuk import excel, kita tetap perlu semua semester untuk menampilkan jumlah mahasiswa
            // meskipun tidak valid (untuk error handling). Tapi untuk modal input manual,
            // kita hanya kirim yang sesuai semester mata kuliah.
            // Note: Frontend akan menggunakan allKelompokBesarOptions untuk import excel
            // yang diambil dari endpoint terpisah atau dihitung di frontend

            return response()->json([
                'mata_kuliah' => $mataKuliah,
                'jadwal_non_blok_non_csr' => $jadwalNonBlokNonCSR,
                'dosen_list' => $dosenList,
                'ruangan_list' => $ruanganList,
                'jam_options' => $jamOptions,
                'kelompok_besar_agenda_options' => $kelompokBesarAgendaOptions,
                'kelompok_besar_materi_options' => $kelompokBesarMateriOptions,
                'mahasiswa_list' => $mahasiswaList,
            ]);

        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data batch'], 500);
        }
    }
}
