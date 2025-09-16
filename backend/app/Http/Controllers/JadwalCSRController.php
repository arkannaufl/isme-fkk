<?php

namespace App\Http\Controllers;

use App\Models\JadwalCSR;
use App\Models\MataKuliah;
use App\Models\User;
use App\Models\Ruangan;
use App\Models\KelompokKecil;
use App\Models\CSR;
use App\Models\AbsensiCSR;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class JadwalCSRController extends Controller
{
    public function index(string $kode): JsonResponse
    {
        try {
            $jadwalCSR = JadwalCSR::with(['dosen', 'ruangan', 'kelompokKecil', 'kategori'])
                ->where('mata_kuliah_kode', $kode)
                ->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();

            // Konversi format jam dari HH:MM ke HH.MM untuk frontend (tanpa detik)
            $jadwalCSR->transform(function ($item) {
                if ($item->jam_mulai) {
                    $jamMulai = str_replace(':', '.', $item->jam_mulai);
                    // Hapus detik jika ada (format HH.MM.SS -> HH.MM)
                    // Regex yang benar: mencari pattern dengan 3 bagian (HH.MM.SS) dan ambil 2 bagian pertama
                    if (preg_match('/^(\d{2}\.\d{2})\.\d{2}$/', $jamMulai, $matches)) {
                        $jamMulai = $matches[1]; // Ambil HH.MM saja
                    }
                    $item->jam_mulai = $jamMulai;
                }
                if ($item->jam_selesai) {
                    $jamSelesai = str_replace(':', '.', $item->jam_selesai);
                    // Hapus detik jika ada (format HH.MM.SS -> HH.MM)
                    // Regex yang benar: mencari pattern dengan 3 bagian (HH.MM.SS) dan ambil 2 bagian pertama
                    if (preg_match('/^(\d{2}\.\d{2})\.\d{2}$/', $jamSelesai, $matches)) {
                        $jamSelesai = $matches[1]; // Ambil HH.MM saja
                    }
                    $item->jam_selesai = $jamSelesai;
                }
                return $item;
            });

            return response()->json($jadwalCSR);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data jadwal CSR'], 500);
        }
    }

    public function store(Request $request, string $kode): JsonResponse
    {
        try {
            \Log::info('JadwalCSR store request received', $request->all());
            
            $request->validate([
                'tanggal' => 'required|date',
                'jam_mulai' => 'required|string',
                'jam_selesai' => 'required|string',
                'jumlah_sesi' => 'required|integer|in:2,3',
                'jenis_csr' => 'required|in:reguler,responsi',
                'dosen_id' => 'required|exists:users,id',
                'ruangan_id' => 'required|exists:ruangan,id',
                'kelompok_kecil_id' => 'required|exists:kelompok_kecil,id',
                'kategori_id' => 'required|exists:csrs,id',
                'topik' => 'required|string',
            ]);

            // Validasi kapasitas ruangan
            $kapasitasMessage = $this->validateRuanganCapacity($request);
            if ($kapasitasMessage) {
                return response()->json(['message' => $kapasitasMessage], 422);
            }

            // Validasi bentrok
            $bentrokMessage = $this->checkBentrokWithDetail($request, $kode);
            if ($bentrokMessage) {
                return response()->json(['message' => $bentrokMessage], 422);
            }

            // Konversi format jam dari "07.20" ke "07:20"
            $jamMulai = str_replace('.', ':', $request->jam_mulai);
            $jamSelesai = str_replace('.', ':', $request->jam_selesai);
            
            $jadwalCSR = JadwalCSR::create([
                'mata_kuliah_kode' => $kode,
                'tanggal' => $request->tanggal,
                'jam_mulai' => $jamMulai,
                'jam_selesai' => $jamSelesai,
                'jumlah_sesi' => $request->jumlah_sesi,
                'jenis_csr' => $request->jenis_csr,
                'dosen_id' => $request->dosen_id,
                'ruangan_id' => $request->ruangan_id,
                'kelompok_kecil_id' => $request->kelompok_kecil_id,
                'kategori_id' => $request->kategori_id,
                'topik' => $request->topik,
            ]);

            $jadwalCSR = $jadwalCSR->load(['dosen', 'ruangan', 'kelompokKecil', 'kategori']);
            
            // Konversi format jam dari HH:MM ke HH.MM untuk frontend (tanpa detik)
            if ($jadwalCSR->jam_mulai) {
                $jamMulai = str_replace(':', '.', $jadwalCSR->jam_mulai);
                // Hapus detik jika ada (format HH.MM.SS -> HH.MM)
                // Regex yang benar: mencari pattern dengan 3 bagian (HH.MM.SS) dan ambil 2 bagian pertama
                if (preg_match('/^(\d{2}\.\d{2})\.\d{2}$/', $jamMulai, $matches)) {
                    $jamMulai = $matches[1]; // Ambil HH.MM saja
                }
                $jadwalCSR->jam_mulai = $jamMulai;
            }
            if ($jadwalCSR->jam_selesai) {
                $jamSelesai = str_replace(':', '.', $jadwalCSR->jam_selesai);
                // Hapus detik jika ada (format HH.MM.SS -> HH.MM)
                // Regex yang benar: mencari pattern dengan 3 bagian (HH.MM.SS) dan ambil 2 bagian pertama
                if (preg_match('/^(\d{2}\.\d{2})\.\d{2}$/', $jamSelesai, $matches)) {
                    $jamSelesai = $matches[1]; // Ambil HH.MM saja
                }
                $jadwalCSR->jam_selesai = $jamSelesai;
            }
            
            return response()->json($jadwalCSR, 201);
        } catch (\Exception $e) {
            \Log::error('Error saving JadwalCSR: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json(['message' => 'Gagal menyimpan jadwal CSR: ' . $e->getMessage()], 500);
        }
    }

    public function update(Request $request, string $kode, int $id): JsonResponse
    {
        try {
            \Log::info('JadwalCSR update request received', $request->all());
            
            $request->validate([
                'tanggal' => 'required|date',
                'jam_mulai' => 'required|string',
                'jam_selesai' => 'required|string',
                'jumlah_sesi' => 'required|integer|in:2,3',
                'jenis_csr' => 'required|in:reguler,responsi',
                'dosen_id' => 'required|exists:users,id',
                'ruangan_id' => 'required|exists:ruangan,id',
                'kelompok_kecil_id' => 'required|exists:kelompok_kecil,id',
                'kategori_id' => 'required|exists:csrs,id',
                'topik' => 'required|string',
            ]);

            $jadwalCSR = JadwalCSR::where('mata_kuliah_kode', $kode)->findOrFail($id);

            // Validasi kapasitas ruangan
            $kapasitasMessage = $this->validateRuanganCapacity($request);
            if ($kapasitasMessage) {
                return response()->json(['message' => $kapasitasMessage], 422);
            }

            // Validasi bentrok (exclude current record)
            $bentrokMessage = $this->checkBentrokWithDetail($request, $kode, $id);
            if ($bentrokMessage) {
                return response()->json(['message' => $bentrokMessage], 422);
            }

            // Konversi format jam dari "07.20" ke "07:20"
            $jamMulai = str_replace('.', ':', $request->jam_mulai);
            $jamSelesai = str_replace('.', ':', $request->jam_selesai);
            
            $jadwalCSR->update([
                'tanggal' => $request->tanggal,
                'jam_mulai' => $jamMulai,
                'jam_selesai' => $jamSelesai,
                'jumlah_sesi' => $request->jumlah_sesi,
                'jenis_csr' => $request->jenis_csr,
                'dosen_id' => $request->dosen_id,
                'ruangan_id' => $request->ruangan_id,
                'kelompok_kecil_id' => $request->kelompok_kecil_id,
                'kategori_id' => $request->kategori_id,
                'topik' => $request->topik,
            ]);

            $jadwalCSR = $jadwalCSR->load(['dosen', 'ruangan', 'kelompokKecil', 'kategori']);
            
            // Konversi format jam dari HH:MM ke HH.MM untuk frontend (tanpa detik)
            if ($jadwalCSR->jam_mulai) {
                $jamMulai = str_replace(':', '.', $jadwalCSR->jam_mulai);
                // Hapus detik jika ada (format HH.MM.SS -> HH.MM)
                // Regex yang benar: mencari pattern dengan 3 bagian (HH.MM.SS) dan ambil 2 bagian pertama
                if (preg_match('/^(\d{2}\.\d{2})\.\d{2}$/', $jamMulai, $matches)) {
                    $jamMulai = $matches[1]; // Ambil HH.MM saja
                }
                $jadwalCSR->jam_mulai = $jamMulai;
            }
            if ($jadwalCSR->jam_selesai) {
                $jamSelesai = str_replace(':', '.', $jadwalCSR->jam_selesai);
                // Hapus detik jika ada (format HH.MM.SS -> HH.MM)
                // Regex yang benar: mencari pattern dengan 3 bagian (HH.MM.SS) dan ambil 2 bagian pertama
                if (preg_match('/^(\d{2}\.\d{2})\.\d{2}$/', $jamSelesai, $matches)) {
                    $jamSelesai = $matches[1]; // Ambil HH.MM saja
                }
                $jadwalCSR->jam_selesai = $jamSelesai;
            }
            
            return response()->json($jadwalCSR);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengupdate jadwal CSR'], 500);
        }
    }

    public function destroy(string $kode, int $id): JsonResponse
    {
        try {
            $jadwalCSR = JadwalCSR::where('mata_kuliah_kode', $kode)->findOrFail($id);
            $jadwalCSR->delete();

            return response()->json(['message' => 'Jadwal CSR berhasil dihapus']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal menghapus jadwal CSR'], 500);
        }
    }

    // Reference data endpoints
    public function getDosenOptions(): JsonResponse
    {
        try {
            $dosen = User::where('role', 'dosen')
                ->select('id', 'name', 'nid')
                ->orderBy('name')
                ->get();

            return response()->json($dosen);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data dosen'], 500);
        }
    }

    public function getRuanganOptions(): JsonResponse
    {
        try {
            $ruangan = Ruangan::select('id', 'nama')
                ->orderBy('nama')
                ->get();

            return response()->json($ruangan);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data ruangan'], 500);
        }
    }

    public function getKelompokOptions(): JsonResponse
    {
        try {
            $kelompok = KelompokKecil::select('id', 'nama_kelompok')
                ->orderBy('nama_kelompok')
                ->get();

            return response()->json($kelompok);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data kelompok'], 500);
        }
    }

    public function getKategoriOptions(Request $request): JsonResponse
    {
        try {
            $mataKuliahKode = $request->query('mata_kuliah_kode');
            
            if ($mataKuliahKode) {
                // Filter kategori berdasarkan mata kuliah
                $kategori = CSR::where('mata_kuliah_kode', $mataKuliahKode)
                    ->select('id', 'nama', 'keahlian_required', 'nomor_csr')
                    ->orderBy('nama')
                    ->get();
            } else {
                // Jika tidak ada filter, ambil semua
                $kategori = CSR::select('id', 'nama', 'keahlian_required', 'nomor_csr')
                    ->orderBy('nama')
                    ->get();
            }

            return response()->json($kategori);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data kategori'], 500);
        }
    }

    public function getJamOptions(): JsonResponse
    {
        try {
            $jamOptions = [
                '07.20', '08.10', '09.00', '09.50', '10.40', '11.30', '12.35', 
                '13.25', '14.15', '15.05', '15.35', '16.25', '17.15'
            ];

            return response()->json($jamOptions);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data jam'], 500);
        }
    }

    private function isBentrok(Request $request, string $kode, ?int $excludeId = null): bool
    {
        // Konversi format waktu dari frontend (dot) ke format database (colon)
        $jamMulai = str_replace('.', ':', $request->jam_mulai);
        $jamSelesai = str_replace('.', ':', $request->jam_selesai);
        
        \Log::info('Checking bentrok for CSR', [
            'tanggal' => $request->tanggal,
            'jam_mulai_request' => $request->jam_mulai,
            'jam_selesai_request' => $request->jam_selesai,
            'jam_mulai_converted' => $jamMulai,
            'jam_selesai_converted' => $jamSelesai,
            'dosen_id' => $request->dosen_id,
            'ruangan_id' => $request->ruangan_id,
            'kelompok_kecil_id' => $request->kelompok_kecil_id
        ]);

        // Cek bentrok dengan jadwal CSR lain
        $bentrokCSR = DB::table('jadwal_csr')
            ->where('mata_kuliah_kode', $kode)
            ->where('tanggal', $request->tanggal)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<=', $jamMulai)
                        ->where('jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<', $jamSelesai)
                        ->where('jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '>=', $jamMulai)
                        ->where('jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('dosen_id', $request->dosen_id)
                    ->orWhere('ruangan_id', $request->ruangan_id)
                    ->orWhere('kelompok_kecil_id', $request->kelompok_kecil_id);
            });

        if ($excludeId) {
            $bentrokCSR->where('id', '!=', $excludeId);
        }

        $bentrokCSRExists = $bentrokCSR->exists();
        \Log::info('CSR bentrok check result', ['bentrok' => $bentrokCSRExists]);

        // Cek bentrok dengan jadwal lain (PBL, Kuliah Besar, dll)
        $bentrokPBL = DB::table('jadwal_pbl')
            ->where('tanggal', $request->tanggal)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<=', $jamMulai)
                        ->where('jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<', $jamSelesai)
                        ->where('jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '>=', $jamMulai)
                        ->where('jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('dosen_id', $request->dosen_id)
                    ->orWhere('ruangan_id', $request->ruangan_id)
                    ->orWhere('kelompok_kecil_id', $request->kelompok_kecil_id);
            })
            ->exists();

        $bentrokKuliahBesar = DB::table('jadwal_kuliah_besar')
            ->where('tanggal', $request->tanggal)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<=', $jamMulai)
                        ->where('jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<', $jamSelesai)
                        ->where('jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '>=', $jamMulai)
                        ->where('jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('dosen_id', $request->dosen_id)
                    ->orWhere('ruangan_id', $request->ruangan_id);
            })
            ->exists();

        $bentrokAgendaKhusus = DB::table('jadwal_agenda_khusus')
            ->where('tanggal', $request->tanggal)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<=', $jamMulai)
                        ->where('jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<', $jamSelesai)
                        ->where('jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '>=', $jamMulai)
                        ->where('jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where('ruangan_id', $request->ruangan_id)
            ->exists();

        $bentrokPraktikum = DB::table('jadwal_praktikum')
            ->where('tanggal', $request->tanggal)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<=', $jamMulai)
                        ->where('jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<', $jamSelesai)
                        ->where('jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '>=', $jamMulai)
                        ->where('jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where('ruangan_id', $request->ruangan_id)
            ->exists();

        $bentrokJurnalReading = DB::table('jadwal_jurnal_reading')
            ->where('tanggal', $request->tanggal)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<=', $jamMulai)
                        ->where('jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<', $jamSelesai)
                        ->where('jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '>=', $jamMulai)
                        ->where('jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('dosen_id', $request->dosen_id)
                    ->orWhere('ruangan_id', $request->ruangan_id)
                    ->orWhere('kelompok_kecil_id', $request->kelompok_kecil_id);
            })
            ->exists();

        // Cek bentrok dengan kelompok besar (jika ada kelompok_besar_id di jadwal lain)
        $bentrokKelompokBesar = $this->checkKelompokBesarBentrok($request, $excludeId);

        $totalBentrok = $bentrokCSRExists || $bentrokPBL || $bentrokKuliahBesar || $bentrokAgendaKhusus || $bentrokPraktikum || $bentrokJurnalReading || $bentrokKelompokBesar;
        
        \Log::info('Total bentrok check result', [
            'csr_bentrok' => $bentrokCSRExists,
            'pbl_bentrok' => $bentrokPBL,
            'kuliah_besar_bentrok' => $bentrokKuliahBesar,
            'agenda_khusus_bentrok' => $bentrokAgendaKhusus,
            'praktikum_bentrok' => $bentrokPraktikum,
            'jurnal_reading_bentrok' => $bentrokJurnalReading,
            'total_bentrok' => $totalBentrok
        ]);

        return $totalBentrok;
    }

    private function checkBentrokWithDetail(Request $request, string $kode, ?int $excludeId = null): ?string
    {
        // Konversi format waktu dari frontend (dot) ke format database (colon)
        $jamMulai = str_replace('.', ':', $request->jam_mulai);
        $jamSelesai = str_replace('.', ':', $request->jam_selesai);

        // Cek bentrok dengan jadwal CSR
        $bentrokCSR = DB::table('jadwal_csr')
            ->where('tanggal', $request->tanggal)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<=', $jamMulai)
                        ->where('jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<', $jamSelesai)
                        ->where('jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '>=', $jamMulai)
                        ->where('jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('dosen_id', $request->dosen_id)
                    ->orWhere('ruangan_id', $request->ruangan_id)
                    ->orWhere('kelompok_kecil_id', $request->kelompok_kecil_id);
            });

        if ($excludeId) {
            $bentrokCSR->where('id', '!=', $excludeId);
        }

        $jadwalBentrokCSR = $bentrokCSR->first();
        if ($jadwalBentrokCSR) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokCSR->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokCSR->jam_selesai);
            $bentrokReason = $this->getBentrokReason($request, $jadwalBentrokCSR);
            return "Jadwal bentrok dengan Jadwal CSR pada tanggal " . 
                   date('d/m/Y', strtotime($request->tanggal)) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal PBL
        $bentrokPBL = DB::table('jadwal_pbl')
            ->where('tanggal', $request->tanggal)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<=', $jamMulai)
                        ->where('jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<', $jamSelesai)
                        ->where('jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '>=', $jamMulai)
                        ->where('jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('dosen_id', $request->dosen_id)
                    ->orWhere('ruangan_id', $request->ruangan_id)
                    ->orWhere('kelompok_kecil_id', $request->kelompok_kecil_id);
            })
            ->first();

        if ($bentrokPBL) {
            $jamMulaiFormatted = str_replace(':', '.', $bentrokPBL->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $bentrokPBL->jam_selesai);
            $bentrokReason = $this->getBentrokReason($request, $bentrokPBL);
            return "Jadwal bentrok dengan Jadwal PBL pada tanggal " . 
                   date('d/m/Y', strtotime($request->tanggal)) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Kuliah Besar
        $bentrokKuliahBesar = DB::table('jadwal_kuliah_besar')
            ->where('tanggal', $request->tanggal)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<=', $jamMulai)
                        ->where('jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<', $jamSelesai)
                        ->where('jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '>=', $jamMulai)
                        ->where('jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('dosen_id', $request->dosen_id)
                    ->orWhere('ruangan_id', $request->ruangan_id);
            })
            ->first();

        if ($bentrokKuliahBesar) {
            $jamMulaiFormatted = str_replace(':', '.', $bentrokKuliahBesar->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $bentrokKuliahBesar->jam_selesai);
            $bentrokReason = $this->getBentrokReason($request, $bentrokKuliahBesar);
            return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " . 
                   date('d/m/Y', strtotime($request->tanggal)) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Agenda Khusus
        $bentrokAgendaKhusus = DB::table('jadwal_agenda_khusus')
            ->where('tanggal', $request->tanggal)
            ->where('use_ruangan', true)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<=', $jamMulai)
                        ->where('jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<', $jamSelesai)
                        ->where('jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '>=', $jamMulai)
                        ->where('jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where('ruangan_id', $request->ruangan_id)
            ->first();

        if ($bentrokAgendaKhusus) {
            $jamMulaiFormatted = str_replace(':', '.', $bentrokAgendaKhusus->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $bentrokAgendaKhusus->jam_selesai);
            $bentrokReason = $this->getBentrokReason($request, $bentrokAgendaKhusus);
            return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " . 
                   date('d/m/Y', strtotime($request->tanggal)) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Praktikum
        $bentrokPraktikum = DB::table('jadwal_praktikum')
            ->where('tanggal', $request->tanggal)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<=', $jamMulai)
                        ->where('jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<', $jamSelesai)
                        ->where('jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '>=', $jamMulai)
                        ->where('jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where('ruangan_id', $request->ruangan_id)
            ->first();

        if ($bentrokPraktikum) {
            $jamMulaiFormatted = str_replace(':', '.', $bentrokPraktikum->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $bentrokPraktikum->jam_selesai);
            $bentrokReason = $this->getBentrokReason($request, $bentrokPraktikum);
            return "Jadwal bentrok dengan Jadwal Praktikum pada tanggal " . 
                   date('d/m/Y', strtotime($request->tanggal)) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Jurnal Reading
        $bentrokJurnalReading = DB::table('jadwal_jurnal_reading')
            ->where('tanggal', $request->tanggal)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<=', $jamMulai)
                        ->where('jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '<', $jamSelesai)
                        ->where('jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jam_mulai', '>=', $jamMulai)
                        ->where('jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('dosen_id', $request->dosen_id)
                    ->orWhere('ruangan_id', $request->ruangan_id)
                    ->orWhere('kelompok_kecil_id', $request->kelompok_kecil_id);
            })
            ->first();

        if ($bentrokJurnalReading) {
            $jamMulaiFormatted = str_replace(':', '.', $bentrokJurnalReading->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $bentrokJurnalReading->jam_selesai);
            $bentrokReason = $this->getBentrokReason($request, $bentrokJurnalReading);
            return "Jadwal bentrok dengan Jadwal Jurnal Reading pada tanggal " . 
                   date('d/m/Y', strtotime($request->tanggal)) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        return null; // Tidak ada bentrok
    }

    /**
     * Mendapatkan alasan bentrok yang detail
     */
    private function getBentrokReason($request, $jadwalBentrok): string
    {
        $reasons = [];
        
        // Cek bentrok dosen
        if (isset($request->dosen_id) && isset($jadwalBentrok->dosen_id) && $request->dosen_id == $jadwalBentrok->dosen_id) {
            $dosen = \App\Models\User::find($request->dosen_id);
            $reasons[] = "Dosen: " . ($dosen ? $dosen->name : 'Tidak diketahui');
        }
        
        // Cek bentrok ruangan
        if (isset($request->ruangan_id) && isset($jadwalBentrok->ruangan_id) && $request->ruangan_id == $jadwalBentrok->ruangan_id) {
            $ruangan = \App\Models\Ruangan::find($request->ruangan_id);
            $reasons[] = "Ruangan: " . ($ruangan ? $ruangan->nama : 'Tidak diketahui');
        }
        
        // Cek bentrok kelompok kecil
        if (isset($request->kelompok_kecil_id) && isset($jadwalBentrok->kelompok_kecil_id) && $request->kelompok_kecil_id == $jadwalBentrok->kelompok_kecil_id) {
            $kelompokKecil = \App\Models\KelompokKecil::find($request->kelompok_kecil_id);
            $reasons[] = "Kelompok Kecil: " . ($kelompokKecil ? $kelompokKecil->nama_kelompok : 'Tidak diketahui');
        }
        
        return implode(', ', $reasons);
    }

    /**
     * Validasi kapasitas ruangan berdasarkan jumlah mahasiswa
     */
    private function validateRuanganCapacity($request)
    {
        // Ambil data ruangan
        $ruangan = Ruangan::find($request->ruangan_id);
        if (!$ruangan) {
            return 'Ruangan tidak ditemukan';
        }

        // Ambil data kelompok kecil
        $kelompokKecil = KelompokKecil::find($request->kelompok_kecil_id);
        if (!$kelompokKecil) {
            return 'Kelompok kecil tidak ditemukan';
        }

        // Hitung jumlah mahasiswa dalam kelompok
        $jumlahMahasiswa = KelompokKecil::where('nama_kelompok', $kelompokKecil->nama_kelompok)
                                       ->where('semester', $kelompokKecil->semester)
                                       ->count();

        // Hitung total (mahasiswa + 1 dosen)
        $totalMahasiswa = $jumlahMahasiswa + 1;

        // Cek apakah kapasitas ruangan mencukupi
        if ($totalMahasiswa > $ruangan->kapasitas) {
            return "Kapasitas ruangan tidak mencukupi. Ruangan {$ruangan->nama} hanya dapat menampung {$ruangan->kapasitas} orang, sedangkan diperlukan {$totalMahasiswa} orang (kelompok {$jumlahMahasiswa} mahasiswa + 1 dosen).";
        }

        return null; // Kapasitas mencukupi
    }

    /**
     * Cek bentrok dengan kelompok besar
     */
    private function checkKelompokBesarBentrok($request, $excludeId = null): bool
    {
        // Ambil mahasiswa dalam kelompok kecil yang dipilih
        $mahasiswaIds = \App\Models\KelompokKecil::where('id', $request->kelompok_kecil_id)
            ->pluck('mahasiswa_id')
            ->toArray();

        if (empty($mahasiswaIds)) {
            return false;
        }

        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan kelompok besar dari mahasiswa yang sama
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $request->tanggal)
            ->where(function($q) use ($request) {
                $q->where('jam_mulai', '<', $request->jam_selesai)
                   ->where('jam_selesai', '>', $request->jam_mulai);
            })
            ->whereHas('kelompokBesar', function($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->exists();

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar dari mahasiswa yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $request->tanggal)
            ->where(function($q) use ($request) {
                $q->where('jam_mulai', '<', $request->jam_selesai)
                   ->where('jam_selesai', '>', $request->jam_mulai);
            })
            ->whereHas('kelompokBesar', function($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->exists();

        return $kuliahBesarBentrok || $agendaKhususBentrok;
    }

    /**
     * Get absensi untuk jadwal CSR tertentu
     */
    public function getAbsensi($kode, $jadwalId)
    {
        try {
            // Ambil data absensi yang sudah ada
            $absensi = AbsensiCSR::where('jadwal_csr_id', $jadwalId)
                ->get()
                ->keyBy('mahasiswa_npm');

            return response()->json([
                'absensi' => $absensi
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal memuat data absensi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Store absensi untuk jadwal CSR tertentu
     */
    public function storeAbsensi(Request $request, $kode, $jadwalId)
    {
        try {
            $request->validate([
                'absensi' => 'required|array',
                'absensi.*.mahasiswa_npm' => 'required|string',
                'absensi.*.hadir' => 'required|boolean',
            ]);

            // Hapus data absensi yang lama
            AbsensiCSR::where('jadwal_csr_id', $jadwalId)->delete();

            // Simpan data absensi baru
            foreach ($request->absensi as $absen) {
                AbsensiCSR::create([
                    'jadwal_csr_id' => $jadwalId,
                    'mahasiswa_npm' => $absen['mahasiswa_npm'],
                    'hadir' => $absen['hadir'],
                ]);
            }

            return response()->json(['message' => 'Absensi berhasil disimpan']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal menyimpan absensi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get jadwal CSR for specific dosen
     */
    public function getJadwalForDosen($dosenId, Request $request)
    {
        try {
            $semesterType = $request->query('semester_type', 'reguler'); // CSR hanya ada di semester reguler

            $query = JadwalCSR::with(['mataKuliah', 'ruangan', 'dosen', 'kelompokKecil', 'kategori'])
                ->where('dosen_id', $dosenId);

            // CSR hanya ada di semester reguler, tidak ada semester antara
            if ($semesterType === 'antara') {
                return response()->json([
                    'data' => [],
                    'message' => 'CSR tidak tersedia untuk semester antara'
                ]);
            }

            $jadwal = $query->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();

            // Map data untuk konsistensi dengan jadwal lain
            $mappedJadwal = $jadwal->map(function ($item) {
                return [
                    'id' => $item->id,
                    'tanggal' => date('d-m-Y', strtotime($item->tanggal)),
                    'jam_mulai' => substr(str_replace(':', '.', $item->jam_mulai), 0, 5), // Remove seconds
                    'jam_selesai' => substr(str_replace(':', '.', $item->jam_selesai), 0, 5), // Remove seconds
                    'materi' => $item->topik,
                    'topik' => $item->topik,
                    'status_konfirmasi' => $item->status_konfirmasi ?? 'belum_konfirmasi',
                    'alasan_konfirmasi' => $item->alasan_konfirmasi,
                    'mata_kuliah_kode' => $item->mata_kuliah_kode,
                    'mata_kuliah_nama' => $item->mataKuliah->nama ?? 'N/A',
                    'jenis_csr' => $item->jenis_csr,
                    'dosen' => [
                        'id' => $item->dosen->id,
                        'name' => $item->dosen->name
                    ],
                    'ruangan' => [
                        'id' => $item->ruangan->id ?? null,
                        'nama' => $item->ruangan->nama ?? 'N/A'
                    ],
                    'kelompok_kecil' => [
                        'id' => $item->kelompokKecil->id ?? null,
                        'nama' => $item->kelompokKecil->nama_kelompok ?? 'N/A'
                    ],
                    'kategori' => [
                        'id' => $item->kategori->id ?? null,
                        'nama' => $item->kategori->nama ?? 'N/A'
                    ],
                    'jumlah_sesi' => $item->jumlah_sesi,
                    'semester_type' => 'reguler', // CSR hanya semester reguler
                    'created_at' => $item->created_at
                ];
            });

            return response()->json([
                'data' => $mappedJadwal,
                'message' => 'Jadwal CSR berhasil diambil'
            ]);
        } catch (\Exception $e) {
            \Log::error("Error getting jadwal CSR for dosen {$dosenId}: " . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil jadwal CSR',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Konfirmasi ketersediaan dosen untuk jadwal CSR
     */
    public function konfirmasiJadwal(Request $request, $jadwalId)
    {
        $request->validate([
            'status' => 'required|in:bisa,tidak_bisa',
            'dosen_id' => 'required|exists:users,id',
            'alasan' => 'nullable|string|max:1000'
        ]);

        $jadwal = JadwalCSR::with(['mataKuliah', 'dosen', 'ruangan', 'kategori'])
            ->where('id', $jadwalId)
            ->where('dosen_id', $request->dosen_id)
            ->firstOrFail();

        $jadwal->update([
            'status_konfirmasi' => $request->status,
            'alasan_konfirmasi' => $request->alasan
        ]);

        // Kirim notifikasi ke super admin jika dosen tidak bisa
        if ($request->status === 'tidak_bisa') {
            $this->sendReplacementNotification($jadwal, $request->alasan);
        }

        return response()->json([
            'message' => 'Status konfirmasi berhasil diperbarui',
            'status' => $request->status
        ]);
    }

    /**
     * Kirim notifikasi replacement ke super admin
     */
    private function sendReplacementNotification($jadwal, $alasan = null)
    {
        try {
            $superAdmins = User::where('role', 'super_admin')->get();
            $alasanText = $alasan ? "\n\nAlasan: {$alasan}" : "";

            foreach ($superAdmins as $admin) {
                \App\Models\Notification::create([
                    'user_id' => $jadwal->dosen_id,
                    'title' => 'Dosen Tidak Bisa Mengajar - CSR',
                    'message' => "Dosen {$jadwal->dosen->name} tidak bisa mengajar pada jadwal CSR {$jadwal->mataKuliah->nama} ({$jadwal->kategori->nama}) pada tanggal " . 
                               date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " . 
                               str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) . 
                               " di ruangan {$jadwal->ruangan->nama}.{$alasanText}",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'csr',
                        'dosen_id' => $jadwal->dosen_id,
                        'mata_kuliah' => $jadwal->mataKuliah->nama,
                        'kategori' => $jadwal->kategori->nama,
                        'tanggal' => $jadwal->tanggal,
                        'waktu' => $jadwal->jam_mulai . ' - ' . $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama
                    ]
                ]);
            }
        } catch (\Exception $e) {
            \Log::error("Error sending replacement notification for CSR: " . $e->getMessage());
        }
    }
}
