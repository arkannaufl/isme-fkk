<?php

namespace App\Http\Controllers;

use App\Models\JadwalCSR;
use App\Models\MataKuliah;
use App\Models\User;
use App\Models\Ruangan;
use App\Models\KelompokKecil;
use App\Models\CSR;
use App\Models\AbsensiCSR;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class JadwalCSRController extends Controller
{
    public function index(string $kode): JsonResponse
    {
        try {
            $jadwalCSR = JadwalCSR::WithoutSemesterFilter()
                ->with(['dosen', 'ruangan', 'kelompokKecil', 'kategori'])
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
                'status_konfirmasi' => 'belum_konfirmasi',
                // SIAKAD fields
                'siakad_kurikulum' => 'nullable|string',
                'siakad_kode_mk' => 'nullable|string',
                'siakad_nama_kelas' => 'nullable|string',
                'siakad_jenis_pertemuan' => 'nullable|string',
                'siakad_metode' => 'nullable|string',
                'siakad_dosen_pengganti' => 'nullable|string',
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
                'created_by' => auth()->id(),
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
                // SIAKAD fields
                'siakad_kurikulum' => $request->siakad_kurikulum,
                'siakad_kode_mk' => $request->siakad_kode_mk,
                'siakad_nama_kelas' => $request->siakad_nama_kelas,
                'siakad_jenis_pertemuan' => $request->siakad_jenis_pertemuan,
                'siakad_metode' => $request->siakad_metode,
                'siakad_dosen_pengganti' => $request->siakad_dosen_pengganti,
            ]);



            // Log activity


            activity()


                ->log('Jadwal CSR deleted');



            // Log activity


            activity()


                ->log('Jadwal CSR updated');



            // Log activity


            activity()


                ->log('Jadwal CSR created');

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

            // Send notification to dosen
            $this->sendAssignmentNotification($jadwalCSR, $request->dosen_id);

            // Send notification to mahasiswa
            $this->sendNotificationToMahasiswa($jadwalCSR);

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
                // SIAKAD fields
                'siakad_kurikulum' => 'nullable|string',
                'siakad_kode_mk' => 'nullable|string',
                'siakad_nama_kelas' => 'nullable|string',
                'siakad_jenis_pertemuan' => 'nullable|string',
                'siakad_metode' => 'nullable|string',
                'siakad_dosen_pengganti' => 'nullable|string',
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

            $updateData = [
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
                // SIAKAD fields
                'siakad_kurikulum' => $request->siakad_kurikulum,
                'siakad_kode_mk' => $request->siakad_kode_mk,
                'siakad_nama_kelas' => $request->siakad_nama_kelas,
                'siakad_jenis_pertemuan' => $request->siakad_jenis_pertemuan,
                'siakad_metode' => $request->siakad_metode,
                'siakad_dosen_pengganti' => $request->siakad_dosen_pengganti,
            ];

            $jadwalCSR->update($updateData);

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
            
            // Decrement csr_assignment_count untuk dosen yang terpengaruh
            $dosen = User::find($jadwalCSR->dosen_id);
            if ($dosen && $dosen->csr_assignment_count > 0) {
                $dosen->decrement('csr_assignment_count');
            }
            
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
                '07.20',
                '08.10',
                '09.00',
                '09.50',
                '10.40',
                '11.30',
                '12.35',
                '13.25',
                '14.15',
                '15.05',
                '15.35',
                '16.25',
                '17.15'
            ];

            return response()->json($jamOptions);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data jam'], 500);
        }
    }

    private function isBentrok(Request $request, string $kode, ?int $excludeId = null): bool
    {
        // Ambil data mata kuliah untuk mendapatkan semester
        $mataKuliah = \App\Models\MataKuliah::where('kode', $kode)->first();
        $semester = $mataKuliah ? $mataKuliah->semester : null;

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
            'kelompok_kecil_id' => $request->kelompok_kecil_id,
            'semester' => $semester
        ]);

        // Cek bentrok dengan jadwal CSR lain (dengan filter semester)
        $bentrokCSR = DB::table('jadwal_csr')
            ->join('mata_kuliah', 'jadwal_csr.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_csr.mata_kuliah_kode', $kode)
            ->where('jadwal_csr.tanggal', $request->tanggal);
        
        if ($semester) {
            $bentrokCSR->where('mata_kuliah.semester', $semester);
        }
        
        $bentrokCSR->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_csr.jam_mulai', '<=', $jamMulai)
                        ->where('jadwal_csr.jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_csr.jam_mulai', '<', $jamSelesai)
                        ->where('jadwal_csr.jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_csr.jam_mulai', '>=', $jamMulai)
                        ->where('jadwal_csr.jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('jadwal_csr.dosen_id', $request->dosen_id)
                    ->orWhere('jadwal_csr.ruangan_id', $request->ruangan_id)
                    ->orWhere('jadwal_csr.kelompok_kecil_id', $request->kelompok_kecil_id);
            });

        if ($excludeId) {
            $bentrokCSR->where('jadwal_csr.id', '!=', $excludeId);
        }

        $bentrokCSRExists = $bentrokCSR->exists();
        \Log::info('CSR bentrok check result', ['bentrok' => $bentrokCSRExists]);

        // Cek bentrok dengan jadwal lain (PBL, Kuliah Besar, dll) - dengan filter semester
        $bentrokPBL = DB::table('jadwal_pbl')
            ->join('mata_kuliah', 'jadwal_pbl.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_pbl.tanggal', $request->tanggal);
        
        if ($semester) {
            $bentrokPBL->where('mata_kuliah.semester', $semester);
        }
        
        $bentrokPBL->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_pbl.jam_mulai', '<=', $jamMulai)
                        ->where('jadwal_pbl.jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_pbl.jam_mulai', '<', $jamSelesai)
                        ->where('jadwal_pbl.jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_pbl.jam_mulai', '>=', $jamMulai)
                        ->where('jadwal_pbl.jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('jadwal_pbl.dosen_id', $request->dosen_id)
                    ->orWhere('jadwal_pbl.ruangan_id', $request->ruangan_id)
                    ->orWhere('jadwal_pbl.kelompok_kecil_id', $request->kelompok_kecil_id);
            });

        $bentrokPBLExists = $bentrokPBL->exists();

        $bentrokKuliahBesar = DB::table('jadwal_kuliah_besar')
            ->join('mata_kuliah', 'jadwal_kuliah_besar.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_kuliah_besar.tanggal', $request->tanggal);
        
        if ($semester) {
            $bentrokKuliahBesar->where('mata_kuliah.semester', $semester);
        }
        
        $bentrokKuliahBesar->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_kuliah_besar.jam_mulai', '<=', $jamMulai)
                        ->where('jadwal_kuliah_besar.jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_kuliah_besar.jam_mulai', '<', $jamSelesai)
                        ->where('jadwal_kuliah_besar.jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_kuliah_besar.jam_mulai', '>=', $jamMulai)
                        ->where('jadwal_kuliah_besar.jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('jadwal_kuliah_besar.dosen_id', $request->dosen_id)
                    ->orWhere('jadwal_kuliah_besar.ruangan_id', $request->ruangan_id);
            });

        $bentrokKuliahBesarExists = $bentrokKuliahBesar->exists();

        $bentrokAgendaKhusus = DB::table('jadwal_agenda_khusus')
            ->join('mata_kuliah', 'jadwal_agenda_khusus.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_agenda_khusus.tanggal', $request->tanggal);
        
        if ($semester) {
            $bentrokAgendaKhusus->where('mata_kuliah.semester', $semester);
        }
        
        $bentrokAgendaKhusus->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_agenda_khusus.jam_mulai', '<=', $jamMulai)
                        ->where('jadwal_agenda_khusus.jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_agenda_khusus.jam_mulai', '<', $jamSelesai)
                        ->where('jadwal_agenda_khusus.jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_agenda_khusus.jam_mulai', '>=', $jamMulai)
                        ->where('jadwal_agenda_khusus.jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where('jadwal_agenda_khusus.ruangan_id', $request->ruangan_id);

        $bentrokAgendaKhususExists = $bentrokAgendaKhusus->exists();

        $bentrokPraktikum = DB::table('jadwal_praktikum')
            ->join('mata_kuliah', 'jadwal_praktikum.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_praktikum.tanggal', $request->tanggal);
        
        if ($semester) {
            $bentrokPraktikum->where('mata_kuliah.semester', $semester);
        }
        
        $bentrokPraktikum->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_praktikum.jam_mulai', '<=', $jamMulai)
                        ->where('jadwal_praktikum.jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_praktikum.jam_mulai', '<', $jamSelesai)
                        ->where('jadwal_praktikum.jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_praktikum.jam_mulai', '>=', $jamMulai)
                        ->where('jadwal_praktikum.jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where('jadwal_praktikum.ruangan_id', $request->ruangan_id);

        $bentrokPraktikumExists = $bentrokPraktikum->exists();

        $bentrokJurnalReading = DB::table('jadwal_jurnal_reading')
            ->join('mata_kuliah', 'jadwal_jurnal_reading.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_jurnal_reading.tanggal', $request->tanggal);
        
        if ($semester) {
            $bentrokJurnalReading->where('mata_kuliah.semester', $semester);
        }
        
        $bentrokJurnalReading->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_jurnal_reading.jam_mulai', '<=', $jamMulai)
                        ->where('jadwal_jurnal_reading.jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_jurnal_reading.jam_mulai', '<', $jamSelesai)
                        ->where('jadwal_jurnal_reading.jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_jurnal_reading.jam_mulai', '>=', $jamMulai)
                        ->where('jadwal_jurnal_reading.jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('jadwal_jurnal_reading.dosen_id', $request->dosen_id)
                    ->orWhere('jadwal_jurnal_reading.ruangan_id', $request->ruangan_id)
                    ->orWhere('jadwal_jurnal_reading.kelompok_kecil_id', $request->kelompok_kecil_id);
            });

        $bentrokJurnalReadingExists = $bentrokJurnalReading->exists();

        // Cek bentrok dengan kelompok besar (jika ada kelompok_besar_id di jadwal lain)
        $bentrokKelompokBesar = $this->checkKelompokBesarBentrok($request, $excludeId);

        $totalBentrok = $bentrokCSRExists || $bentrokPBLExists || $bentrokKuliahBesarExists || $bentrokAgendaKhususExists || $bentrokPraktikumExists || $bentrokJurnalReadingExists || $bentrokKelompokBesar;

        \Log::info('Total bentrok check result', [
            'csr_bentrok' => $bentrokCSRExists,
            'pbl_bentrok' => $bentrokPBLExists,
            'kuliah_besar_bentrok' => $bentrokKuliahBesarExists,
            'agenda_khusus_bentrok' => $bentrokAgendaKhususExists,
            'praktikum_bentrok' => $bentrokPraktikumExists,
            'jurnal_reading_bentrok' => $bentrokJurnalReadingExists,
            'total_bentrok' => $totalBentrok
        ]);

        return $totalBentrok;
    }

    private function checkBentrokWithDetail(Request $request, string $kode, ?int $excludeId = null): ?string
    {
        // Ambil data mata kuliah untuk mendapatkan semester
        $mataKuliah = \App\Models\MataKuliah::where('kode', $kode)->first();
        $semester = $mataKuliah ? $mataKuliah->semester : null;

        // Konversi format waktu dari frontend (dot) ke format database (colon)
        $jamMulai = str_replace('.', ':', $request->jam_mulai);
        $jamSelesai = str_replace('.', ':', $request->jam_selesai);

        // Cek bentrok dengan jadwal CSR (dengan filter semester)
        $bentrokCSR = DB::table('jadwal_csr')
            ->join('mata_kuliah', 'jadwal_csr.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_csr.tanggal', $request->tanggal);
        
        if ($semester) {
            $bentrokCSR->where('mata_kuliah.semester', $semester);
        }
        
        $bentrokCSR->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_csr.jam_mulai', '<=', $jamMulai)
                        ->where('jadwal_csr.jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_csr.jam_mulai', '<', $jamSelesai)
                        ->where('jadwal_csr.jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_csr.jam_mulai', '>=', $jamMulai)
                        ->where('jadwal_csr.jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('jadwal_csr.dosen_id', $request->dosen_id)
                    ->orWhere('jadwal_csr.ruangan_id', $request->ruangan_id)
                    ->orWhere('jadwal_csr.kelompok_kecil_id', $request->kelompok_kecil_id);
            });

        if ($excludeId) {
            $bentrokCSR->where('jadwal_csr.id', '!=', $excludeId);
        }

        $jadwalBentrokCSR = $bentrokCSR->select('jadwal_csr.*')->first();
        if ($jadwalBentrokCSR) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokCSR->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokCSR->jam_selesai);
            $bentrokReason = $this->getBentrokReason($request, $jadwalBentrokCSR);
            return "Jadwal bentrok dengan Jadwal CSR pada tanggal " .
                date('d/m/Y', strtotime($request->tanggal)) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal PBL (dengan filter semester)
        $bentrokPBL = DB::table('jadwal_pbl')
            ->join('mata_kuliah', 'jadwal_pbl.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_pbl.tanggal', $request->tanggal);
        
        if ($semester) {
            $bentrokPBL->where('mata_kuliah.semester', $semester);
        }
        
        $bentrokPBL->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_pbl.jam_mulai', '<=', $jamMulai)
                        ->where('jadwal_pbl.jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_pbl.jam_mulai', '<', $jamSelesai)
                        ->where('jadwal_pbl.jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_pbl.jam_mulai', '>=', $jamMulai)
                        ->where('jadwal_pbl.jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('jadwal_pbl.dosen_id', $request->dosen_id)
                    ->orWhere('jadwal_pbl.ruangan_id', $request->ruangan_id)
                    ->orWhere('jadwal_pbl.kelompok_kecil_id', $request->kelompok_kecil_id);
            });

        $jadwalBentrokPBL = $bentrokPBL->select('jadwal_pbl.*')->first();
        if ($jadwalBentrokPBL) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokPBL->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokPBL->jam_selesai);
            $bentrokReason = $this->getBentrokReason($request, $jadwalBentrokPBL);
            return "Jadwal bentrok dengan Jadwal PBL pada tanggal " .
                date('d/m/Y', strtotime($request->tanggal)) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Kuliah Besar (dengan filter semester)
        $bentrokKuliahBesar = DB::table('jadwal_kuliah_besar')
            ->join('mata_kuliah', 'jadwal_kuliah_besar.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_kuliah_besar.tanggal', $request->tanggal);
        
        if ($semester) {
            $bentrokKuliahBesar->where('mata_kuliah.semester', $semester);
        }
        
        $bentrokKuliahBesar->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_kuliah_besar.jam_mulai', '<=', $jamMulai)
                        ->where('jadwal_kuliah_besar.jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_kuliah_besar.jam_mulai', '<', $jamSelesai)
                        ->where('jadwal_kuliah_besar.jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_kuliah_besar.jam_mulai', '>=', $jamMulai)
                        ->where('jadwal_kuliah_besar.jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where(function ($q) use ($request) {
                $q->where('jadwal_kuliah_besar.dosen_id', $request->dosen_id)
                    ->orWhere('jadwal_kuliah_besar.ruangan_id', $request->ruangan_id);
            });

        $jadwalBentrokKuliahBesar = $bentrokKuliahBesar->select('jadwal_kuliah_besar.*')->first();
        if ($jadwalBentrokKuliahBesar) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokKuliahBesar->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokKuliahBesar->jam_selesai);
            $bentrokReason = $this->getBentrokReason($request, $jadwalBentrokKuliahBesar);
            return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " .
                date('d/m/Y', strtotime($request->tanggal)) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Agenda Khusus (dengan filter semester)
        $bentrokAgendaKhusus = DB::table('jadwal_agenda_khusus')
            ->join('mata_kuliah', 'jadwal_agenda_khusus.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_agenda_khusus.tanggal', $request->tanggal)
            ->where('jadwal_agenda_khusus.use_ruangan', true);
        
        if ($semester) {
            $bentrokAgendaKhusus->where('mata_kuliah.semester', $semester);
        }
        
        $bentrokAgendaKhusus->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_agenda_khusus.jam_mulai', '<=', $jamMulai)
                        ->where('jadwal_agenda_khusus.jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_agenda_khusus.jam_mulai', '<', $jamSelesai)
                        ->where('jadwal_agenda_khusus.jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_agenda_khusus.jam_mulai', '>=', $jamMulai)
                        ->where('jadwal_agenda_khusus.jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where('jadwal_agenda_khusus.ruangan_id', $request->ruangan_id);

        $jadwalBentrokAgendaKhusus = $bentrokAgendaKhusus->select('jadwal_agenda_khusus.*')->first();
        if ($jadwalBentrokAgendaKhusus) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokAgendaKhusus->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokAgendaKhusus->jam_selesai);
            $bentrokReason = $this->getBentrokReason($request, $jadwalBentrokAgendaKhusus);
            return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " .
                date('d/m/Y', strtotime($request->tanggal)) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Praktikum (dengan filter semester)
        $bentrokPraktikum = DB::table('jadwal_praktikum')
            ->join('mata_kuliah', 'jadwal_praktikum.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_praktikum.tanggal', $request->tanggal);
        
        if ($semester) {
            $bentrokPraktikum->where('mata_kuliah.semester', $semester);
        }
        
        $bentrokPraktikum->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->where(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_praktikum.jam_mulai', '<=', $jamMulai)
                        ->where('jadwal_praktikum.jam_selesai', '>', $jamMulai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_praktikum.jam_mulai', '<', $jamSelesai)
                        ->where('jadwal_praktikum.jam_selesai', '>=', $jamSelesai);
                })->orWhere(function ($subQ) use ($jamMulai, $jamSelesai) {
                    $subQ->where('jadwal_praktikum.jam_mulai', '>=', $jamMulai)
                        ->where('jadwal_praktikum.jam_selesai', '<=', $jamSelesai);
                });
            })
            ->where('jadwal_praktikum.ruangan_id', $request->ruangan_id);

        $jadwalBentrokPraktikum = $bentrokPraktikum->select('jadwal_praktikum.*')->first();

        if ($jadwalBentrokPraktikum) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokPraktikum->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokPraktikum->jam_selesai);
            $bentrokReason = $this->getBentrokReason($request, $jadwalBentrokPraktikum);
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
     * Send notification to mahasiswa in the kelompok
     */
    private function sendNotificationToMahasiswa($jadwal)
    {
        try {
            // Get mahasiswa in the kelompok
            $mahasiswaList = [];

            if ($jadwal->kelompok_kecil_id) {
                $kelompokKecil = \App\Models\KelompokKecil::find($jadwal->kelompok_kecil_id);
                if ($kelompokKecil) {
                    // Get all mahasiswa in this kelompok by nama_kelompok and semester
                    // First get all kelompok with same nama_kelompok and semester
                    $allKelompok = \App\Models\KelompokKecil::where('nama_kelompok', $kelompokKecil->nama_kelompok)
                        ->where('semester', $kelompokKecil->semester)
                        ->get();

                    // Get all mahasiswa IDs from these kelompok
                    $mahasiswaIds = $allKelompok->pluck('mahasiswa_id')->filter()->toArray();

                    // Get mahasiswa users
                    $mahasiswaList = \App\Models\User::whereIn('id', $mahasiswaIds)->get();
                }
            }

            if ($jadwal->kelompok_kecil_antara_id) {
                $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($jadwal->kelompok_kecil_antara_id);
                if ($kelompokKecilAntara) {
                    // Get all mahasiswa in this kelompok antara by nama_kelompok and semester
                    $mahasiswaList = \App\Models\User::where('role', 'mahasiswa')
                        ->whereHas('kelompokKecilAntara', function ($query) use ($kelompokKecilAntara) {
                            $query->where('nama_kelompok', $kelompokKecilAntara->nama_kelompok)
                                ->where('semester', $kelompokKecilAntara->semester);
                        })
                        ->get();
                }
            }

            // Send notification to each mahasiswa
            foreach ($mahasiswaList as $mahasiswa) {
                \App\Models\Notification::create([
                    'user_id' => $mahasiswa->id,
                    'title' => 'Jadwal CSR Baru',
                    'message' => "Jadwal CSR baru telah ditambahkan: {$jadwal->mataKuliah->nama} - {$jadwal->topik} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}.",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'csr',
                        'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                        'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                        'topik' => $jadwal->topik,
                        'jenis_csr' => $jadwal->jenis_csr,
                        'tanggal' => $jadwal->tanggal,
                        'jam_mulai' => $jadwal->jam_mulai,
                        'jam_selesai' => $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'dosen' => $jadwal->dosen ? $jadwal->dosen->name : 'N/A',
                        'created_by' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->name ?? 'Admin' : 'Admin',
                        'created_by_role' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->role ?? 'admin' : 'admin',
                        'sender_name' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->name ?? 'Admin' : 'Admin',
                        'sender_role' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->role ?? 'admin' : 'admin'
                    ]
                ]);
            }

            \Log::info("CSR notifications sent to " . count($mahasiswaList) . " mahasiswa for jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Error sending CSR notifications to mahasiswa: " . $e->getMessage());
        }
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
            ->where(function ($q) use ($request) {
                $q->where('jam_mulai', '<', $request->jam_selesai)
                    ->where('jam_selesai', '>', $request->jam_mulai);
            })
            ->whereHas('kelompokBesar', function ($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->exists();

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar dari mahasiswa yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $request->tanggal)
            ->where(function ($q) use ($request) {
                $q->where('jam_mulai', '<', $request->jam_selesai)
                    ->where('jam_selesai', '>', $request->jam_mulai);
            })
            ->whereHas('kelompokBesar', function ($q) use ($mahasiswaIds) {
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
                'absensi.*.catatan' => 'nullable|string',
                'penilaian_submitted' => 'nullable|boolean',
            ]);

            // Update jadwal CSR dengan status penilaian_submitted (mengikuti pola PBL/Jurnal)
            if ($request->has('penilaian_submitted')) {
                JadwalCSR::where('id', $jadwalId)->update([
                    'penilaian_submitted' => $request->penilaian_submitted
                ]);
            }

            // Hapus data absensi yang lama
            AbsensiCSR::where('jadwal_csr_id', $jadwalId)->delete();

            // Simpan data absensi baru
            foreach ($request->absensi as $absen) {
                AbsensiCSR::create([
                    'jadwal_csr_id' => $jadwalId,
                    'mahasiswa_npm' => $absen['mahasiswa_npm'],
                    'hadir' => $absen['hadir'],
                    'catatan' => $absen['catatan'] ?? '',
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

            // CSR hanya ada di semester reguler, tidak ada semester antara
            // CSR hanya memiliki satu dosen (dosen_id), tidak ada dosen_ids
            if ($semesterType === 'antara') {
                return response()->json([
                    'data' => [],
                    'message' => 'CSR tidak tersedia untuk semester antara'
                ]);
            }

            $query = JadwalCSR::with(['mataKuliah', 'ruangan', 'dosen', 'kelompokKecil', 'kategori'])
                ->where('dosen_id', $dosenId);

            $jadwal = $query->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();

            // Map data untuk konsistensi dengan jadwal lain
            $mappedJadwal = $jadwal->map(function ($item) use ($dosenId) {
                // CSR hanya memiliki satu dosen, tidak ada dosen_ids
                $statusKonfirmasi = $item->status_konfirmasi ?? 'belum_konfirmasi';

                return [
                    'id' => $item->id,
                    'tanggal' => date('d-m-Y', strtotime($item->tanggal)),
                    'jam_mulai' => substr(str_replace(':', '.', $item->jam_mulai), 0, 5), // Remove seconds
                    'jam_selesai' => substr(str_replace(':', '.', $item->jam_selesai), 0, 5), // Remove seconds
                    'materi' => $item->topik,
                    'topik' => $item->topik,
                    'status_konfirmasi' => $statusKonfirmasi, // Status berdasarkan apakah dosen aktif atau history
                    'alasan_konfirmasi' => $item->alasan_konfirmasi,
                    'status_reschedule' => $item->status_reschedule ?? null,
                    'reschedule_reason' => $item->reschedule_reason ?? null,
                    'mata_kuliah_kode' => $item->mata_kuliah_kode,
                    'mata_kuliah_nama' => $item->mataKuliah->nama ?? 'N/A',
                    'jenis_csr' => $item->jenis_csr,
                    'nomor_csr' => $item->kategori->nomor_csr ?? '',
                    'dosen' => [
                        'id' => $item->dosen->id,
                        'name' => $item->dosen->name
                    ],
                    'dosen_id' => $item->dosen_id,
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
                    'is_active_dosen' => true, // Flag: apakah dosen ini adalah dosen aktif
                    'is_in_history' => false, // Flag: apakah dosen ini hanya ada di history
                    'penilaian_submitted' => $item->penilaian_submitted ?? false,
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

    // Ajukan reschedule jadwal CSR
    public function reschedule(Request $request, $jadwalId)
    {
        $request->validate([
            'reschedule_reason' => 'required|string|max:1000',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $jadwal = JadwalCSR::with(['mataKuliah', 'dosen', 'ruangan', 'kategori'])
            ->where('id', $jadwalId)
            ->where('dosen_id', $request->dosen_id)
            ->firstOrFail();

        $jadwal->update([
            'status_konfirmasi' => 'waiting_reschedule',
            'reschedule_reason' => $request->reschedule_reason,
            'status_reschedule' => 'waiting'
        ]);

        // Kirim notifikasi ke admin
        $this->sendRescheduleNotification($jadwal, $request->reschedule_reason);;

        return response()->json([
            'message' => 'Permintaan reschedule berhasil diajukan',
            'status' => 'waiting_reschedule'
        ]);
    }

    // Get jadwal CSR for mahasiswa
    public function getJadwalForMahasiswa($mahasiswaId, Request $request)
    {
        try {
            $mahasiswa = User::where('id', $mahasiswaId)->where('role', 'mahasiswa')->first();
            if (!$mahasiswa) {
                return response()->json(['message' => 'Mahasiswa tidak ditemukan', 'data' => []], 404);
            }

            $kelompokKecil = KelompokKecil::where('mahasiswa_id', $mahasiswaId)->first();
            if (!$kelompokKecil) {
                return response()->json(['message' => 'Mahasiswa belum memiliki kelompok', 'data' => []]);
            }

            // Get jadwal CSR based on nama_kelompok and semester (like Jurnal Reading)
            $jadwal = JadwalCSR::with(['kategori', 'kelompokKecil', 'dosen', 'ruangan'])
                ->whereHas('kelompokKecil', function ($query) use ($kelompokKecil) {
                    $query->where('nama_kelompok', $kelompokKecil->nama_kelompok)
                        ->where('semester', $kelompokKecil->semester);
                })
                ->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();

            $mappedJadwal = $jadwal->map(function ($item) {
                $sessionCount = $item->jenis_csr === 'reguler' ? 3 : 2;
                $tipeText = $item->jenis_csr === 'reguler' ? 'CSR Reguler' : 'CSR Responsi';

                return [
                    'id' => $item->id,
                    'tanggal' => date('d-m-Y', strtotime($item->tanggal)),
                    'jam_mulai' => str_replace(':', '.', substr($item->jam_mulai, 0, 5)),
                    'jam_selesai' => str_replace(':', '.', substr($item->jam_selesai, 0, 5)),
                    'topik' => $item->topik ?? 'N/A',
                    'tipe' => $tipeText,
                    'kategori' => $item->kategori ? ['id' => $item->kategori->id, 'nama' => $item->kategori->nama] : null,
                    'jenis_csr' => $item->jenis_csr,
                    'pengampu' => $item->dosen->name ?? 'N/A',
                    'ruangan' => $item->ruangan ? ['id' => $item->ruangan->id, 'nama' => $item->ruangan->nama] : null,
                    'jumlah_sesi' => $sessionCount,
                    'status_konfirmasi' => $item->status_konfirmasi ?? 'belum_konfirmasi',
                    'status_reschedule' => $item->status_reschedule ?? null,
                    'semester_type' => 'reguler',
                ];
            });

            return response()->json([
                'message' => 'Data jadwal CSR berhasil diambil',
                'data' => $mappedJadwal,
                'count' => $mappedJadwal->count()
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching jadwal CSR for mahasiswa: ' . $e->getMessage());
            return response()->json(['message' => 'Terjadi kesalahan', 'error' => $e->getMessage(), 'data' => []], 500);
        }
    }





    /**
     * Kirim notifikasi reschedule ke admin
     */
    private function sendRescheduleNotification($jadwal, $reason)
    {
        try {
            $dosen = User::find($jadwal->dosen_id);

            // Buat hanya 1 notifikasi yang bisa dilihat oleh semua admin
            $firstAdmin = User::where('role', 'super_admin')->first() ?? User::where('role', 'tim_akademik')->first();

            if ($firstAdmin) {
                Notification::create([
                    'user_id' => $firstAdmin->id,
                    'title' => 'Permintaan Reschedule Jadwal',
                    'message' => "Dosen {$dosen->name} mengajukan reschedule untuk jadwal CSR. Alasan: {$reason}",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'csr',
                        'jenis_csr' => $jadwal->jenis_csr,
                        'dosen_name' => $dosen->name,
                        'dosen_id' => $dosen->id,
                        'reschedule_reason' => $reason,
                        'notification_type' => 'reschedule_request'
                    ]
                ]);
            }

            \Log::info("Reschedule notification sent for CSR jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Error sending reschedule notification for CSR jadwal ID: {$jadwal->id}: " . $e->getMessage());
        }
    }

    public function importExcel(Request $request, string $kode): JsonResponse
    {
        try {
            $request->validate([
                'data' => 'required|array',
                'data.*.jenis_csr' => 'required|in:reguler,responsi',
                'data.*.tanggal' => 'required|date',
                'data.*.jam_mulai' => 'required|string',
                'data.*.jam_selesai' => 'required|string',
                'data.*.jumlah_sesi' => 'required|integer|min:1|max:6',
                'data.*.kelompok_kecil_id' => 'required|integer|exists:kelompok_kecil,id',
                'data.*.topik' => 'required|string',
                'data.*.kategori_id' => 'required|integer|exists:csrs,id',
                'data.*.dosen_id' => 'required|integer|exists:users,id',
                'data.*.ruangan_id' => 'required|integer|exists:ruangan,id',
                // SIAKAD fields
                'data.*.siakad_kurikulum' => 'nullable|string',
                'data.*.siakad_kode_mk' => 'nullable|string',
                'data.*.siakad_nama_kelas' => 'nullable|string',
                'data.*.siakad_jenis_pertemuan' => 'nullable|string',
                'data.*.siakad_metode' => 'nullable|string',
                'data.*.siakad_dosen_pengganti' => 'nullable|string',
            ]);

            $data = $request->input('data');
            $mataKuliah = MataKuliah::where('kode', $kode)->first();

            if (!$mataKuliah) {
                return response()->json([
                    'success' => 0,
                    'message' => 'Mata kuliah tidak ditemukan'
                ], 404);
            }

            $errors = [];

            // Validasi semua data terlebih dahulu (all-or-nothing approach)
            foreach ($data as $index => $row) {
                // Validasi rentang tanggal mata kuliah
                $tanggalJadwal = new \DateTime($row['tanggal']);
                $tanggalMulai = new \DateTime($mataKuliah->tanggal_mulai);
                $tanggalAkhir = new \DateTime($mataKuliah->tanggal_akhir);

                if ($tanggalJadwal < $tanggalMulai || $tanggalJadwal > $tanggalAkhir) {
                    $errors[] = "Baris " . ($index + 1) . ": Tanggal di luar rentang mata kuliah";
                }

                // Validasi sesi sesuai jenis CSR
                if ($row['jenis_csr'] === 'reguler' && $row['jumlah_sesi'] !== 3) {
                    $errors[] = "Baris " . ($index + 1) . ": CSR Reguler harus 3 sesi";
                }

                if ($row['jenis_csr'] === 'responsi' && $row['jumlah_sesi'] !== 2) {
                    $errors[] = "Baris " . ($index + 1) . ": CSR Responsi harus 2 sesi";
                }

                // Validasi bentrok dengan semua jadwal (mempertimbangkan semester)
                // Buat request object untuk checkBentrokWithDetail
                $rowRequest = new \Illuminate\Http\Request();
                $rowRequest->merge($row);
                $bentrokMessage = $this->checkBentrokWithDetail($rowRequest, $kode, null);
                if ($bentrokMessage) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $bentrokMessage;
                }

                // Cek kapasitas ruangan
                $ruangan = Ruangan::find($row['ruangan_id']);
                $kelompokKecil = KelompokKecil::find($row['kelompok_kecil_id']);

                if ($ruangan && $kelompokKecil && $ruangan->kapasitas && $kelompokKecil->jumlah_anggota > $ruangan->kapasitas) {
                    $errors[] = "Baris " . ($index + 1) . ": Kapasitas ruangan tidak mencukupi (Kelompok: {$kelompokKecil->jumlah_anggota}, Kapasitas: {$ruangan->kapasitas})";
                }

                // Validasi bentrok dengan data dalam batch import yang sama
                for ($j = 0; $j < $index; $j++) {
                    $previousData = $data[$j];
                    if ($this->isDataBentrok($row, $previousData)) {
                        $errors[] = "Baris " . ($index + 1) . ": Jadwal bentrok dengan data pada baris " . ($j + 1) . " (Dosen: " . (\App\Models\User::find($row['dosen_id'])->name ?? 'N/A') . ", Ruangan: " . (\App\Models\Ruangan::find($row['ruangan_id'])->nama ?? 'N/A') . ")";
                        break;
                    }
                }
            }

            // Jika ada error validasi, return error tanpa import apapun (all-or-nothing)
            if (count($errors) > 0) {
                return response()->json([
                    'success' => 0,
                    'total' => count($data),
                    'errors' => $errors,
                    'message' => "Gagal mengimport data. Semua data harus valid untuk dapat diimport."
                ], 422);
            }

            // Jika tidak ada error, import semua data menggunakan database transaction
            DB::beginTransaction();
            try {
                $insertedData = [];
                foreach ($data as $row) {
                    // Konversi format jam dari "07.20" ke "07:20" (sama seperti di store method)
                    $jamMulai = str_replace('.', ':', $row['jam_mulai']);
                    $jamSelesai = str_replace('.', ':', $row['jam_selesai']);

                    $jadwalCSR = JadwalCSR::create([
                        'mata_kuliah_kode' => $kode,
                        'created_by' => auth()->id(),
                        'jenis_csr' => $row['jenis_csr'],
                        'tanggal' => $row['tanggal'],
                        'jam_mulai' => $jamMulai,
                        'jam_selesai' => $jamSelesai,
                        'jumlah_sesi' => $row['jumlah_sesi'],
                        'kelompok_kecil_id' => $row['kelompok_kecil_id'],
                        'topik' => $row['topik'],
                        'kategori_id' => $row['kategori_id'],
                        'dosen_id' => $row['dosen_id'],
                        'ruangan_id' => $row['ruangan_id'],
                        // SIAKAD fields
                        'siakad_kurikulum' => $row['siakad_kurikulum'] ?? null,
                        'siakad_kode_mk' => $row['siakad_kode_mk'] ?? null,
                        'siakad_nama_kelas' => $row['siakad_nama_kelas'] ?? null,
                        'siakad_jenis_pertemuan' => $row['siakad_jenis_pertemuan'] ?? null,
                        'siakad_metode' => $row['siakad_metode'] ?? null,
                        'siakad_dosen_pengganti' => $row['siakad_dosen_pengganti'] ?? null,
                    ]);

                    // Kirim notifikasi ke dosen yang di-assign
                    $this->sendAssignmentNotification($jadwalCSR, $row['dosen_id']);

                    $insertedData[] = $jadwalCSR;
                }

                DB::commit();

                return response()->json([
                    'success' => count($insertedData),
                    'total' => count($data),
                    'errors' => [],
                    'message' => "Berhasil mengimport " . count($insertedData) . " dari " . count($data) . " jadwal CSR"
                ]);
            } catch (\Exception $e) {
                DB::rollback();
                return response()->json([
                    'success' => 0,
                    'total' => count($data),
                    'errors' => ["Terjadi kesalahan saat menyimpan data: " . $e->getMessage()],
                    'message' => "Gagal mengimport data. Terjadi kesalahan saat menyimpan."
                ], 422);
            }
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => 0,
                'total' => count($request->input('data', [])),
                'errors' => $e->validator->errors()->all(),
                'message' => 'Terjadi kesalahan validasi data'
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => 0,
                'total' => count($request->input('data', [])),
                'errors' => ['Terjadi kesalahan saat mengimport data: ' . $e->getMessage()],
                'message' => 'Terjadi kesalahan saat mengimport data'
            ], 500);
        }
    }

    /**
     * Helper function untuk mengecek bentrok antar data dalam batch import
     */
    private function isDataBentrok($data1, $data2): bool
    {
        // Cek apakah tanggal sama
        if ($data1['tanggal'] !== $data2['tanggal']) {
            return false;
        }

        // Cek apakah jam bentrok
        $jamMulai1 = $data1['jam_mulai'];
        $jamSelesai1 = $data1['jam_selesai'];
        $jamMulai2 = $data2['jam_mulai'];
        $jamSelesai2 = $data2['jam_selesai'];

        // Konversi jam ke format yang bisa dibandingkan
        $jamMulai1Formatted = str_replace('.', ':', $jamMulai1);
        $jamSelesai1Formatted = str_replace('.', ':', $jamSelesai1);
        $jamMulai2Formatted = str_replace('.', ':', $jamMulai2);
        $jamSelesai2Formatted = str_replace('.', ':', $jamSelesai2);

        // Cek apakah jam bentrok
        $jamBentrok = ($jamMulai1Formatted < $jamSelesai2Formatted && $jamSelesai1Formatted > $jamMulai2Formatted);

        if (!$jamBentrok) {
            return false;
        }

        // Cek bentrok dosen
        $dosenBentrok = false;
        if (isset($data1['dosen_id']) && isset($data2['dosen_id']) && $data1['dosen_id'] == $data2['dosen_id']) {
            $dosenBentrok = true;
        }

        // Cek bentrok ruangan
        $ruanganBentrok = false;
        if (isset($data1['ruangan_id']) && isset($data2['ruangan_id']) && $data1['ruangan_id'] == $data2['ruangan_id']) {
            $ruanganBentrok = true;
        }

        return $dosenBentrok || $ruanganBentrok;
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
                    'user_id' => $admin->id,
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
                        'dosen_name' => $jadwal->dosen->name, // Simpan nama dosen untuk ditampilkan di frontend
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

    /**
     * Send assignment notification to dosen
     */
    private function sendAssignmentNotification($jadwal, $dosenId)
    {
        try {
            $dosen = \App\Models\User::find($dosenId);
            if (!$dosen) {
                \Log::warning("Dosen dengan ID {$dosenId} tidak ditemukan untuk notifikasi jadwal CSR");
                return;
            }

            $mataKuliah = $jadwal->mataKuliah;
            $ruangan = $jadwal->ruangan;
            $kelompokKecil = $jadwal->kelompokKecil;
            $kategori = $jadwal->kategori;

            \App\Models\Notification::create([
                'user_id' => $dosenId,
                'title' => 'Jadwal CSR Baru',
                'message' => "Anda telah di-assign untuk mengajar CSR {$mataKuliah->nama} ({$kategori->nama}) pada tanggal " .
                    date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                    str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                    " di ruangan {$ruangan->nama} untuk kelompok {$kelompokKecil->nama_kelompok}. Silakan konfirmasi ketersediaan Anda.",
                'type' => 'info',
                'is_read' => false,
                'data' => [
                    'jadwal_id' => $jadwal->id,
                    'jadwal_type' => 'csr',
                    'mata_kuliah_kode' => $mataKuliah->kode,
                    'mata_kuliah_nama' => $mataKuliah->nama,
                    'tanggal' => $jadwal->tanggal,
                    'jam_mulai' => $jadwal->jam_mulai,
                    'jam_selesai' => $jadwal->jam_selesai,
                    'ruangan' => $ruangan->nama,
                    'kelompok_kecil' => $kelompokKecil->nama_kelompok,
                    'kategori' => $kategori->nama,
                    'topik' => $jadwal->topik,
                    'jenis_csr' => $jadwal->jenis_csr,
                    'jumlah_sesi' => $jadwal->jumlah_sesi,
                    'dosen_id' => $dosen->id,
                    'dosen_name' => $dosen->name,
                    'dosen_role' => $dosen->role,
                    'created_by' => auth()->user()->name ?? 'Admin',
                    'created_by_role' => auth()->user()->role ?? 'admin',
                    'sender_name' => auth()->user()->name ?? 'Admin',
                    'sender_role' => auth()->user()->role ?? 'admin'
                ]
            ]);

            \Log::info("Notifikasi jadwal CSR berhasil dikirim ke dosen {$dosen->name} (ID: {$dosenId})");
        } catch (\Exception $e) {
            \Log::error("Gagal mengirim notifikasi jadwal CSR ke dosen {$dosenId}: " . $e->getMessage());
        }
    }

    // Cek apakah keahlian digunakan di jadwal CSR
    public function checkKeahlianUsage($csrId, $keahlian): JsonResponse
    {
        try {
            // Decode URL encoded keahlian
            $decodedKeahlian = urldecode($keahlian);
            
            // Ambil CSR untuk mendapatkan mata_kuliah_kode
            $csr = \App\Models\CSR::find($csrId);
            if (!$csr) {
                return response()->json([
                    'jadwalList' => [],
                    'count' => 0
                ]);
            }
            
            // Query langsung ke database untuk mencari jadwal CSR yang menggunakan keahlian ini
            // Cari jadwal yang topiknya sesuai dengan keahlian
            $jadwalList = \DB::table('jadwal_csr as j')
                ->join('csrs as c', 'j.kategori_id', '=', 'c.id')
                ->where('j.kategori_id', $csrId)
                ->where('j.topik', $decodedKeahlian) // Cek topik jadwal sesuai keahlian
                ->select('j.*')
                ->get();
            
            // Load relations manual
            $jadwalList->each(function ($jadwal) {
                $jadwal->dosen = \App\Models\User::find($jadwal->dosen_id);
                $jadwal->ruangan = \App\Models\Ruangan::find($jadwal->ruangan_id);
                $kelompokKecil = \App\Models\KelompokKecil::find($jadwal->kelompok_kecil_id);
                $jadwal->kelompok_kecil = $kelompokKecil; // Set dengan nama yang sama seperti di frontend
                $jadwal->kategori = \App\Models\CSR::find($jadwal->kategori_id);
            });

            return response()->json([
                'jadwalList' => $jadwalList,
                'count' => $jadwalList->count()
            ]);
        } catch (\Exception $e) {
            \Log::error('Error checking keahlian usage: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengecek penggunaan keahlian',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Cek apakah dosen digunakan di jadwal CSR
    public function checkDosenUsage($csrId, $dosenId, $keahlian): JsonResponse
    {
        try {
            // Decode URL encoded keahlian
            $decodedKeahlian = urldecode($keahlian);
            
            // Ambil CSR untuk mendapatkan mata_kuliah_kode
            $csr = \App\Models\CSR::find($csrId);
            if (!$csr) {
                return response()->json([
                    'jadwalList' => [],
                    'count' => 0
                ]);
            }
            
            // Query langsung ke database untuk mencari jadwal CSR yang menggunakan dosen ini pada keahlian tertentu
            // Cari jadwal yang menggunakan dosen ini dan topiknya sesuai dengan keahlian
            $jadwalList = \DB::table('jadwal_csr as j')
                ->join('csrs as c', 'j.kategori_id', '=', 'c.id')
                ->where('j.kategori_id', $csrId)
                ->where('j.dosen_id', $dosenId)
                ->where('j.topik', $decodedKeahlian) // Cek topik jadwal sesuai keahlian
                ->select('j.*')
                ->get();
            
            // Load relations manual
            $jadwalList->each(function ($jadwal) {
                $jadwal->dosen = \App\Models\User::find($jadwal->dosen_id);
                $jadwal->ruangan = \App\Models\Ruangan::find($jadwal->ruangan_id);
                $kelompokKecil = \App\Models\KelompokKecil::find($jadwal->kelompok_kecil_id);
                $jadwal->kelompok_kecil = $kelompokKecil; // Set dengan nama yang sama seperti di frontend
                $jadwal->kategori = \App\Models\CSR::find($jadwal->kategori_id);
            });

            return response()->json([
                'jadwalList' => $jadwalList,
                'count' => $jadwalList->count()
            ]);
        } catch (\Exception $e) {
            \Log::error('Error checking dosen usage: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengecek penggunaan dosen',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
