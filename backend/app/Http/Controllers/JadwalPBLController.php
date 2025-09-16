<?php

namespace App\Http\Controllers;

use App\Models\JadwalPBL;
use App\Models\PBL;
use App\Models\KelompokKecil;
use App\Models\User;
use App\Models\Ruangan;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;

class JadwalPBLController extends Controller
{
    // List semua jadwal PBL untuk satu mata kuliah blok
    public function index($kode)
    {
        $jadwal = JadwalPBL::with(['modulPBL', 'kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan'])
            ->where('mata_kuliah_kode', $kode)
            ->orderBy('tanggal')
            ->orderBy('jam_mulai')
            ->get();
        
        // Tambahkan modul_pbl_id dan nama_kelompok untuk kompatibilitas dengan frontend
        $jadwal->transform(function ($item) {
            $item->modul_pbl_id = $item->pbl_id;
            
            // Tambahkan nama kelompok untuk kompatibilitas dengan frontend
            if ($item->kelompok_kecil_antara) {
                $item->nama_kelompok = $item->kelompok_kecil_antara->nama_kelompok;
            } elseif ($item->kelompok_kecil) {
                $item->nama_kelompok = $item->kelompok_kecil->nama_kelompok;
            }
            
            return $item;
        });
        
        return response()->json($jadwal);
    }

    // Tambah jadwal PBL baru
    public function store(Request $request, $kode)
    {
        $data = $request->validate([
            'modul_pbl_id' => 'required|exists:pbls,id',
            'kelompok_kecil_id' => 'nullable|exists:kelompok_kecil,id',
            'kelompok_kecil_antara_id' => 'nullable|exists:kelompok_kecil_antara,id',
            'dosen_id' => 'nullable|exists:users,id',
            'dosen_ids' => 'nullable|array',
            'dosen_ids.*' => 'exists:users,id',
            'ruangan_id' => 'required|exists:ruangan,id',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'nullable|integer|min:1|max:6',
            'pbl_tipe' => 'nullable|string',
        ]);

        // Validasi: harus ada salah satu dari kelompok_kecil_id atau kelompok_kecil_antara_id
        if ((!isset($data['kelompok_kecil_id']) || !$data['kelompok_kecil_id']) && 
            (!isset($data['kelompok_kecil_antara_id']) || !$data['kelompok_kecil_antara_id'])) {
            return response()->json([
                'message' => 'Kelompok kecil harus dipilih.',
                'errors' => [
                    'kelompok_kecil_id' => ['Kelompok kecil harus dipilih.']
                ]
            ], 422);
        }
        $data['mata_kuliah_kode'] = $kode;
        $data['pbl_id'] = $data['modul_pbl_id']; // Map modul_pbl_id ke pbl_id
        
        // Set jumlah_sesi berdasarkan pbl_tipe jika tidak disediakan
        if (!isset($data['jumlah_sesi'])) {
            $data['jumlah_sesi'] = $data['pbl_tipe'] === 'PBL 2' ? 3 : 2;
        }

        // Pastikan kelompok_kecil_id ada untuk semester reguler, atau null untuk semester antara
        if (!isset($data['kelompok_kecil_id'])) {
            $data['kelompok_kecil_id'] = null;
        }

        // Pastikan dosen_id diset ke null jika menggunakan dosen_ids
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
            $data['dosen_id'] = null;
        }

        // Validasi kapasitas ruangan
        $kapasitasMessage = $this->validateRuanganCapacity($data);
        if ($kapasitasMessage) {
            return response()->json(['message' => $kapasitasMessage], 422);
        }

        // Validasi bentrok
        $bentrokMessage = $this->checkBentrokWithDetail($data, null);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        $jadwal = JadwalPBL::create($data);
        
        // Load relasi dan tambahkan modul_pbl_id
        $jadwal->load(['modulPBL', 'kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan']);
        $jadwal->modul_pbl_id = $jadwal->pbl_id;
        
        // Tambahkan nama dosen untuk response
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
            $jadwal->dosen_names = implode(', ', $dosenNames);
        }
        
        // Buat notifikasi untuk dosen yang di-assign
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            foreach ($jadwal->dosen_ids as $dosenId) {
                $dosen = User::find($dosenId);
                if ($dosen) {
                    \App\Models\Notification::create([
                        'user_id' => $dosenId,
                        'title' => 'Jadwal PBL Baru',
                        'message' => "Anda telah di-assign untuk mengajar PBL {$jadwal->modulPBL->mataKuliah->nama} - {$jadwal->modulPBL->nama_modul} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}. Silakan konfirmasi ketersediaan Anda.",
                        'type' => 'info',
                        'data' => [
                            'topik' => $jadwal->modulPBL->nama_modul,
                            'materi' => $jadwal->modulPBL->nama_modul,
                            'ruangan' => $jadwal->ruangan->nama,
                            'tanggal' => $jadwal->tanggal,
                            'jadwal_id' => $jadwal->id,
                            'jam_mulai' => $jadwal->jam_mulai,
                            'jadwal_type' => 'pbl',
                            'jam_selesai' => $jadwal->jam_selesai,
                            'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                            'mata_kuliah_nama' => $jadwal->modulPBL->mataKuliah->nama,
                            'modul_ke' => $jadwal->modulPBL->modul_ke,
                            'pbl_tipe' => $jadwal->pbl_tipe,
                            'dosen_id' => $dosen->id,
                            'dosen_name' => $dosen->name,
                            'dosen_role' => $dosen->role
                        ]
                    ]);

                }
            }
        } elseif ($jadwal->dosen_id) {
            \App\Models\Notification::create([
                'user_id' => $jadwal->dosen_id,
                'title' => 'Jadwal PBL Baru',
                'message' => "Anda telah di-assign untuk mengajar PBL {$jadwal->modulPBL->mataKuliah->nama} - {$jadwal->modulPBL->nama_modul} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}. Silakan konfirmasi ketersediaan Anda.",
                'type' => 'info',
                                        'data' => [
                            'topik' => $jadwal->modulPBL->nama_modul,
                            'materi' => $jadwal->modulPBL->nama_modul,
                            'ruangan' => $jadwal->ruangan->nama,
                            'tanggal' => $jadwal->tanggal,
                            'jadwal_id' => $jadwal->id,
                            'jam_mulai' => $jadwal->jam_mulai,
                            'jadwal_type' => 'pbl',
                            'jam_selesai' => $jadwal->jam_selesai,
                            'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                            'mata_kuliah_nama' => $jadwal->modulPBL->mataKuliah->nama,
                            'modul_ke' => $jadwal->modulPBL->modul_ke,
                            'pbl_tipe' => $jadwal->pbl_tipe,
                            'dosen_id' => $dosen->id,
                            'dosen_name' => $dosen->name,
                            'dosen_role' => $dosen->role
                        ]
            ]);
        }
        
        return response()->json($jadwal, Response::HTTP_CREATED);
    }

    // Update jadwal PBL
    public function update(Request $request, $kode, $id)
    {
        $jadwal = JadwalPBL::findOrFail($id);
        $data = $request->validate([
            'modul_pbl_id' => 'required|exists:pbls,id',
            'kelompok_kecil_id' => 'nullable|exists:kelompok_kecil,id',
            'kelompok_kecil_antara_id' => 'nullable|exists:kelompok_kecil_antara,id',
            'dosen_id' => 'nullable|exists:users,id',
            'dosen_ids' => 'nullable|array',
            'dosen_ids.*' => 'exists:users,id',
            'ruangan_id' => 'required|exists:ruangan,id',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'nullable|integer|min:1|max:6',
            'pbl_tipe' => 'nullable|string',
        ]);

        // Validasi: harus ada salah satu dari kelompok_kecil_id atau kelompok_kecil_antara_id
        if ((!isset($data['kelompok_kecil_id']) || !$data['kelompok_kecil_id']) && 
            (!isset($data['kelompok_kecil_antara_id']) || !$data['kelompok_kecil_antara_id'])) {
            return response()->json([
                'message' => 'Kelompok kecil harus dipilih.',
                'errors' => [
                    'kelompok_kecil_id' => ['Kelompok kecil harus dipilih.']
                ]
            ], 422);
        }
        $data['mata_kuliah_kode'] = $kode;
        $data['pbl_id'] = $data['modul_pbl_id']; // Map modul_pbl_id ke pbl_id
        
        // Set jumlah_sesi berdasarkan pbl_tipe jika tidak disediakan
        if (!isset($data['jumlah_sesi'])) {
            $data['jumlah_sesi'] = $data['pbl_tipe'] === 'PBL 2' ? 3 : 2;
        }

        // Pastikan kelompok_kecil_id ada untuk semester reguler, atau null untuk semester antara
        if (!isset($data['kelompok_kecil_id'])) {
            $data['kelompok_kecil_id'] = null;
        }

        // Pastikan dosen_id diset ke null jika menggunakan dosen_ids
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
            $data['dosen_id'] = null;
        }

        // Validasi kapasitas ruangan
        $kapasitasMessage = $this->validateRuanganCapacity($data);
        if ($kapasitasMessage) {
            return response()->json(['message' => $kapasitasMessage], 422);
        }

        // Validasi bentrok (kecuali dirinya sendiri)
        $bentrokMessage = $this->checkBentrokWithDetail($data, $id);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        $jadwal->update($data);
        
        // Load relasi dan tambahkan modul_pbl_id
        $jadwal->load(['modulPBL', 'kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan']);
        $jadwal->modul_pbl_id = $jadwal->pbl_id;
        
        // Tambahkan nama dosen untuk response
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
            $jadwal->dosen_names = implode(', ', $dosenNames);
        }
        
        return response()->json($jadwal);
    }

    // Hapus jadwal PBL
    public function destroy($kode, $id)
    {
        $jadwal = JadwalPBL::findOrFail($id);

        // Cascade delete: hapus penilaian PBL yang terkait
        $kelompokKecil = \App\Models\KelompokKecil::find($jadwal->kelompok_kecil_id);
        $namaKelompok = $kelompokKecil ? $kelompokKecil->nama_kelompok : $jadwal->kelompok_kecil_id;

        // Hapus penilaian PBL berdasarkan mata_kuliah_kode, kelompok, dan pbl_tipe
        \App\Models\PenilaianPBL::where('mata_kuliah_kode', $kode)
            ->where('kelompok', $namaKelompok)
            ->where('pertemuan', $jadwal->pbl_tipe)
            ->delete();

        $jadwal->delete();
        return response()->json(['message' => 'Jadwal dan penilaian PBL terkait berhasil dihapus']);
    }

    // Get jadwal PBL untuk dosen tertentu
    public function getJadwalForDosen($dosenId, Request $request)
    {
        try {
            // Check if user exists
            $user = User::find($dosenId);
            if (!$user) {
                return response()->json([
                    'message' => 'Dosen tidak ditemukan',
                    'data' => []
                ], 404);
            }

            $semesterType = $request->query('semester_type');

            $query = JadwalPBL::with([
                'modulPBL.mataKuliah',
                'kelompokKecil',
                'kelompokKecilAntara',
                'dosen',
                'ruangan'
            ])
            ->where(function($query) use ($dosenId) {
                $query->where('dosen_id', $dosenId)
                      ->orWhere('dosen_ids', 'like', '%"' . $dosenId . '"%');
            });

            // Filter berdasarkan semester type jika ada
            if ($semesterType && $semesterType !== 'all') {
                if ($semesterType === 'reguler') {
                    $query->whereNull('kelompok_kecil_antara_id');
                } elseif ($semesterType === 'antara') {
                    $query->whereNotNull('kelompok_kecil_antara_id');
                }
            }

            // Use raw query to get data
            $rawJadwal = \DB::table('jadwal_pbl')
                ->where(function($q) use ($dosenId) {
                    $q->where('dosen_id', $dosenId)
                      ->orWhere('dosen_ids', 'like', '%' . $dosenId . '%');
                })
                ->when($semesterType === 'antara', function($q) {
                    $q->whereNotNull('kelompok_kecil_antara_id');
                })
                ->when($semesterType === 'reguler', function($q) {
                    $q->whereNull('kelompok_kecil_antara_id');
                })
                ->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();
            
            \Log::info("Raw query found {$rawJadwal->count()} records");
            
            // Convert to Eloquent models for relationships
            $jadwal = JadwalPBL::with([
                'modulPBL.mataKuliah',
                'kelompokKecil',
                'kelompokKecilAntara',
                'dosen',
                'ruangan'
            ])->whereIn('id', $rawJadwal->pluck('id'))->get();
            
            // Load dosen for each jadwal based on dosen_ids
            $jadwal->each(function($item) {
                if ($item->dosen_ids && count($item->dosen_ids) > 0) {
                    $dosen = User::whereIn('id', $item->dosen_ids)->first();
                    if ($dosen) {
                        $item->dosen = $dosen;
                    }
                }
            });

            \Log::info("Found {$jadwal->count()} JadwalPBL records for dosen ID: {$dosenId}");
            
            $mappedJadwal = $jadwal->map(function ($jadwal) {
                // Determine semester type based on kelompok_kecil_antara_id
                $semesterType = $jadwal->kelompok_kecil_antara_id ? 'antara' : 'reguler';
                
                return [
                    'id' => $jadwal->id,
                    'mata_kuliah_kode' => $jadwal->modulPBL->mataKuliah->kode ?? $jadwal->mata_kuliah_kode,
                    'mata_kuliah_nama' => $jadwal->modulPBL->mataKuliah->nama ?? 'Unknown',
                    'modul' => $jadwal->modulPBL->nama_modul ?? 'Unknown',
                    'blok' => $jadwal->modulPBL->mataKuliah->blok ?? 1,
                    'pertemuan_ke' => $jadwal->modulPBL->modul_ke ?? 1,
                    'topik' => $jadwal->modulPBL->nama_modul ?? 'Unknown',
                    'tipe_pbl' => $jadwal->pbl_tipe ?? 'PBL 1',
                    'kelompok' => $jadwal->kelompokKecilAntara ? $jadwal->kelompokKecilAntara->nama_kelompok : ($jadwal->kelompokKecil ? $jadwal->kelompokKecil->nama_kelompok : 'Unknown'),
                    'x50' => $jadwal->jumlah_sesi ?? 2,
                    'tanggal' => $jadwal->tanggal,
                    'waktu_mulai' => $jadwal->jam_mulai,
                    'jam_mulai' => $jadwal->jam_mulai,
                    'jam_selesai' => $jadwal->jam_selesai,
                    'durasi' => $jadwal->jumlah_sesi ?? 2,
                    'pengampu' => $jadwal->dosen ? $jadwal->dosen->name : ($jadwal->dosen_ids && count($jadwal->dosen_ids) > 0 ? \App\Models\User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->join(', ') : 'Unknown'),
                    'ruangan' => $jadwal->ruangan->nama ?? 'Unknown',
                    'lokasi' => $jadwal->ruangan->nama ?? 'Unknown',
                    'status_konfirmasi' => $jadwal->status_konfirmasi ?? 'belum_konfirmasi',
                    'semester_type' => $semesterType,
                    'created_at' => $jadwal->created_at,
                ];
            });

            return response()->json([
                'message' => 'Data jadwal PBL berhasil diambil',
                'data' => $mappedJadwal,
                'count' => $mappedJadwal->count()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengambil data jadwal PBL',
                'error' => $e->getMessage(),
                'data' => []
            ], 500);
        }
    }

    // Konfirmasi jadwal PBL oleh dosen
    public function konfirmasiJadwal(Request $request, $jadwalId)
    {
        $request->validate([
            'status' => 'required|in:bisa,tidak_bisa',
            'dosen_id' => 'required|exists:users,id',
            'alasan' => 'nullable|string|max:1000'
        ]);

        $jadwal = JadwalPBL::with(['modulPBL.mataKuliah', 'dosen'])
            ->where('id', $jadwalId)
            ->where(function($query) use ($request) {
                $query->where('dosen_id', $request->dosen_id)
                      ->orWhereJsonContains('dosen_ids', $request->dosen_id);
            })
            ->firstOrFail();

        $jadwal->update([
            'status_konfirmasi' => $request->status,
            'alasan_konfirmasi' => $request->alasan
        ]);

        // Jika dosen tidak bisa, kirim notifikasi ke admin
        if ($request->status === 'tidak_bisa') {
            $this->sendReplacementNotification($jadwal);
        }

        return response()->json([
            'message' => 'Status konfirmasi berhasil diperbarui',
            'status' => $request->status
        ]);
    }

    // Kirim notifikasi ke admin untuk replace dosen
    private function sendReplacementNotification($jadwal)
    {
        // Ambil semua super admin
        $superAdmins = User::where('role', 'super_admin')->get();

        // Get dosen name - handle both single dosen and multiple dosen cases
        $dosenName = 'Unknown';
        if ($jadwal->dosen) {
            $dosenName = $jadwal->dosen->name;
        } elseif ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosen = User::whereIn('id', $jadwal->dosen_ids)->first();
            if ($dosen) {
                $dosenName = $dosen->name;
            }
        }

        foreach ($superAdmins as $admin) {
            \App\Models\Notification::create([
                'user_id' => $jadwal->dosen_id ?? $jadwal->dosen_ids[0] ?? $admin->id,
                'title' => 'Dosen Tidak Bisa Mengajar',
                'message' => "Dosen {$dosenName} tidak bisa mengajar pada jadwal PBL {$jadwal->modulPBL->mataKuliah->nama} - Modul {$jadwal->modulPBL->modul_ke}",
                'type' => 'warning',
                'is_read' => false,
                'data' => [
                    'jadwal_id' => $jadwal->id,
                    'jadwal_type' => 'pbl',
                    'dosen_id' => $jadwal->dosen_id,
                    'dosen_ids' => $jadwal->dosen_ids,
                    'mata_kuliah' => $jadwal->modulPBL->mataKuliah->nama,
                    'modul' => $jadwal->modulPBL->modul_ke,
                    'tanggal' => $jadwal->tanggal,
                    'waktu' => $jadwal->jam_mulai . ' - ' . $jadwal->jam_selesai
                ]
            ]);
        }
    }

    // Helper validasi bentrok antar jenis baris
    private function isBentrok($data, $ignoreId = null)
    {
        // Tentukan kelompok kecil ID berdasarkan jenis semester
        $kelompokKecilId = null;
        if (isset($data['kelompok_kecil_id']) && $data['kelompok_kecil_id']) {
            $kelompokKecilId = $data['kelompok_kecil_id'];
        } elseif (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
            $kelompokKecilId = $data['kelompok_kecil_antara_id'];
        }

        // Cek bentrok dengan jadwal PBL
        $pblQuery = JadwalPBL::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data, $kelompokKecilId) {
                $q->where('pbl_id', $data['pbl_id'])
                  ->orWhere('ruangan_id', $data['ruangan_id']);
                
                // Cek bentrok kelompok kecil
                if ($kelompokKecilId) {
                    $q->orWhere('kelompok_kecil_id', $kelompokKecilId)
                      ->orWhere('kelompok_kecil_antara_id', $kelompokKecilId);
                }
                
                // Cek bentrok dosen (single dosen_id)
                if (isset($data['dosen_id']) && $data['dosen_id']) {
                    $q->orWhere('dosen_id', $data['dosen_id']);
                }
                
                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->orWhereIn('dosen_id', $data['dosen_ids']);
                }
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                       ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        if ($ignoreId) {
            $pblQuery->where('id', '!=', $ignoreId);
        }
        
        // Cek bentrok dengan jadwal Kuliah Besar
        $kuliahBesarQuery = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('ruangan_id', $data['ruangan_id']);
                
                // Cek bentrok dosen (single dosen_id)
                if (isset($data['dosen_id']) && $data['dosen_id']) {
                    $q->orWhere('dosen_id', $data['dosen_id']);
                }
                
                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->orWhereIn('dosen_id', $data['dosen_ids']);
                }
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });
            
        // Cek bentrok dengan jadwal Agenda Khusus
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });
            
        // Cek bentrok dengan jadwal Praktikum
        $praktikumBentrok = \App\Models\JadwalPraktikum::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('ruangan_id', $data['ruangan_id']);
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });
            
        // Cek bentrok dengan jadwal Jurnal Reading
        $jurnalQuery = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data, $kelompokKecilId) {
                $q->where('ruangan_id', $data['ruangan_id']);
                
                // Cek bentrok kelompok kecil
                if ($kelompokKecilId) {
                    $q->orWhere('kelompok_kecil_id', $kelompokKecilId);
                }
                
                // Cek bentrok dosen (single dosen_id)
                if (isset($data['dosen_id']) && $data['dosen_id']) {
                    $q->orWhere('dosen_id', $data['dosen_id']);
                }
                
                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->orWhereIn('dosen_id', $data['dosen_ids']);
                }
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan kelompok besar (jika ada kelompok_besar_id di jadwal lain)
        $kelompokBesarBentrok = $this->checkKelompokBesarBentrok($data, $ignoreId);
            
        return $pblQuery->exists() || $kuliahBesarQuery->exists() || 
               $agendaKhususBentrok->exists() || $praktikumBentrok->exists() || 
               $jurnalQuery->exists() || $kelompokBesarBentrok;
    }

    private function checkBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Tentukan kelompok kecil ID berdasarkan jenis semester
        $kelompokKecilId = null;
        if (isset($data['kelompok_kecil_id']) && $data['kelompok_kecil_id']) {
            $kelompokKecilId = $data['kelompok_kecil_id'];
        } elseif (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
            $kelompokKecilId = $data['kelompok_kecil_antara_id'];
        }

        // Cek bentrok dengan jadwal PBL
        $pblQuery = JadwalPBL::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data, $kelompokKecilId) {
                $q->where('pbl_id', $data['pbl_id'])
                  ->orWhere('ruangan_id', $data['ruangan_id']);
                
                // Cek bentrok kelompok kecil
                if ($kelompokKecilId) {
                    $q->orWhere('kelompok_kecil_id', $kelompokKecilId)
                      ->orWhere('kelompok_kecil_antara_id', $kelompokKecilId);
                }
                
                // Cek bentrok dosen (single dosen_id)
                if (isset($data['dosen_id']) && $data['dosen_id']) {
                    $q->orWhere('dosen_id', $data['dosen_id']);
                }
                
                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->orWhereIn('dosen_id', $data['dosen_ids']);
                }
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                       ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        
        if ($ignoreId) {
            $pblQuery->where('id', '!=', $ignoreId);
        }
        
        $pblBentrok = $pblQuery;
        
        $jadwalBentrokPBL = $pblBentrok->first();
        if ($jadwalBentrokPBL) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokPBL->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokPBL->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $jadwalBentrokPBL);
            return "Jadwal bentrok dengan Jadwal PBL pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }
        
        // Cek bentrok dengan jadwal Kuliah Besar
        $kuliahBesarQuery = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('ruangan_id', $data['ruangan_id']);
                
                // Cek bentrok dosen (single dosen_id)
                if (isset($data['dosen_id']) && $data['dosen_id']) {
                    $q->orWhere('dosen_id', $data['dosen_id']);
                }
                
                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->orWhereIn('dosen_id', $data['dosen_ids']);
                }
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        
        $kuliahBesarBentrok = $kuliahBesarQuery->first();
            
        if ($kuliahBesarBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $kuliahBesarBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $kuliahBesarBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $kuliahBesarBentrok);
            return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }
        
        // Cek bentrok dengan jadwal Agenda Khusus
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();
            
        if ($agendaKhususBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $agendaKhususBentrok);
            return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }
        
        // Cek bentrok dengan jadwal Praktikum
        $praktikumBentrok = \App\Models\JadwalPraktikum::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();
            
        if ($praktikumBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $praktikumBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $praktikumBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $praktikumBentrok);
            return "Jadwal bentrok dengan Jadwal Praktikum pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }
        
        // Cek bentrok dengan jadwal Jurnal Reading
        $jurnalQuery = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data, $kelompokKecilId) {
                $q->where('ruangan_id', $data['ruangan_id']);
                
                // Cek bentrok kelompok kecil
                if ($kelompokKecilId) {
                    $q->orWhere('kelompok_kecil_id', $kelompokKecilId);
                }
                
                // Cek bentrok dosen (single dosen_id)
                if (isset($data['dosen_id']) && $data['dosen_id']) {
                    $q->orWhere('dosen_id', $data['dosen_id']);
                }
                
                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->orWhereIn('dosen_id', $data['dosen_ids']);
                }
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        
        $jurnalBentrok = $jurnalQuery->first();
            
        if ($jurnalBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $jurnalBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jurnalBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $jurnalBentrok);
            return "Jadwal bentrok dengan Jadwal Jurnal Reading pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan kelompok besar (jika ada kelompok_besar_id di jadwal lain)
        $kelompokBesarBentrokMessage = $this->checkKelompokBesarBentrokWithDetail($data, $ignoreId);
        if ($kelompokBesarBentrokMessage) {
            return $kelompokBesarBentrokMessage;
        }

        return null; // Tidak ada bentrok
    }

    /**
     * Mendapatkan alasan bentrok yang detail
     */
    private function getBentrokReason($data, $jadwalBentrok): string
    {
        $reasons = [];
        
        // Cek bentrok dosen (single dosen_id)
        if (isset($data['dosen_id']) && isset($jadwalBentrok->dosen_id) && $data['dosen_id'] == $jadwalBentrok->dosen_id) {
            $dosen = \App\Models\User::find($data['dosen_id']);
            $reasons[] = "Dosen: " . ($dosen ? $dosen->name : 'Tidak diketahui');
        }
        
        // Cek bentrok dosen (multiple dosen_ids)
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
            if (isset($jadwalBentrok->dosen_id) && in_array($jadwalBentrok->dosen_id, $data['dosen_ids'])) {
                $dosen = \App\Models\User::find($jadwalBentrok->dosen_id);
                $reasons[] = "Dosen: " . ($dosen ? $dosen->name : 'Tidak diketahui');
            }
            
            // Cek jika jadwal yang bentrok juga menggunakan multiple dosen
            if (isset($jadwalBentrok->dosen_ids) && is_array($jadwalBentrok->dosen_ids)) {
                $intersectingDosenIds = array_intersect($data['dosen_ids'], $jadwalBentrok->dosen_ids);
                if (!empty($intersectingDosenIds)) {
                    $dosenNames = \App\Models\User::whereIn('id', $intersectingDosenIds)->pluck('name')->toArray();
                    $reasons[] = "Dosen: " . implode(', ', $dosenNames);
                }
            }
        }
        
        // Cek bentrok ruangan
        if (isset($data['ruangan_id']) && isset($jadwalBentrok->ruangan_id) && $data['ruangan_id'] == $jadwalBentrok->ruangan_id) {
            $ruangan = \App\Models\Ruangan::find($data['ruangan_id']);
            $reasons[] = "Ruangan: " . ($ruangan ? $ruangan->nama : 'Tidak diketahui');
        }
        
        // Cek bentrok kelompok kecil
        if (isset($data['kelompok_kecil_id']) && isset($jadwalBentrok->kelompok_kecil_id) && $data['kelompok_kecil_id'] == $jadwalBentrok->kelompok_kecil_id) {
            $kelompokKecil = \App\Models\KelompokKecil::find($data['kelompok_kecil_id']);
            $reasons[] = "Kelompok Kecil: " . ($kelompokKecil ? $kelompokKecil->nama_kelompok : 'Tidak diketahui');
        }
        
        // Cek bentrok kelompok kecil antara
        if (isset($data['kelompok_kecil_antara_id']) && isset($jadwalBentrok->kelompok_kecil_antara_id) && $data['kelompok_kecil_antara_id'] == $jadwalBentrok->kelompok_kecil_antara_id) {
            $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($data['kelompok_kecil_antara_id']);
            $reasons[] = "Kelompok Kecil Antara: " . ($kelompokKecilAntara ? $kelompokKecilAntara->nama_kelompok : 'Tidak diketahui');
        }
        
        // Cek bentrok PBL ID
        if (isset($data['pbl_id']) && isset($jadwalBentrok->pbl_id) && $data['pbl_id'] == $jadwalBentrok->pbl_id) {
            $reasons[] = "PBL ID: " . $data['pbl_id'];
        }
        
        return implode(', ', $reasons);
    }

    /**
     * Cek bentrok dengan kelompok besar
     */
    private function checkKelompokBesarBentrok($data, $ignoreId = null): bool
    {
        // Ambil mahasiswa dalam kelompok kecil yang dipilih
        $mahasiswaIds = \App\Models\KelompokKecil::where('id', $data['kelompok_kecil_id'])
            ->pluck('mahasiswa_id')
            ->toArray();

        if (empty($mahasiswaIds)) {
            return false;
        }

        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan kelompok besar dari mahasiswa yang sama
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokBesar', function($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->exists();

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar dari mahasiswa yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokBesar', function($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->exists();

        return $kuliahBesarBentrok || $agendaKhususBentrok;
    }

    /**
     * Cek bentrok dengan kelompok besar dengan detail
     */
    private function checkKelompokBesarBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Ambil mahasiswa dalam kelompok kecil yang dipilih
        $mahasiswaIds = [];
        
        if (isset($data['kelompok_kecil_id']) && $data['kelompok_kecil_id']) {
            // Untuk semester reguler
            $mahasiswaIds = \App\Models\KelompokKecil::where('id', $data['kelompok_kecil_id'])
                ->pluck('mahasiswa_id')
                ->toArray();
        } elseif (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
            // Untuk semester antara
            $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($data['kelompok_kecil_antara_id']);
            if ($kelompokKecilAntara) {
                $mahasiswaIds = $kelompokKecilAntara->mahasiswa_ids ?? [];
            }
        }

        if (empty($mahasiswaIds)) {
            return null;
        }

        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan kelompok besar dari mahasiswa yang sama
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokBesar', function($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->first();

        if ($kuliahBesarBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $kuliahBesarBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $kuliahBesarBentrok->jam_selesai);
            
            // Tentukan nama kelompok berdasarkan jenis semester
            $namaKelompok = 'Tidak diketahui';
            if (isset($data['kelompok_kecil_id']) && $data['kelompok_kecil_id']) {
                $kelompokKecil = \App\Models\KelompokKecil::find($data['kelompok_kecil_id']);
                $namaKelompok = $kelompokKecil ? $kelompokKecil->nama_kelompok : 'Tidak diketahui';
            } elseif (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
                $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($data['kelompok_kecil_antara_id']);
                $namaKelompok = $kelompokKecilAntara ? $kelompokKecilAntara->nama_kelompok : 'Tidak diketahui';
            }
            
            $bentrokReason = "Kelompok Kecil vs Kelompok Besar: " . $namaKelompok;
            return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar dari mahasiswa yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokBesar', function($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->first();

        if ($agendaKhususBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_selesai);
            
            // Tentukan nama kelompok berdasarkan jenis semester
            $namaKelompok = 'Tidak diketahui';
            if (isset($data['kelompok_kecil_id']) && $data['kelompok_kecil_id']) {
                $kelompokKecil = \App\Models\KelompokKecil::find($data['kelompok_kecil_id']);
                $namaKelompok = $kelompokKecil ? $kelompokKecil->nama_kelompok : 'Tidak diketahui';
            } elseif (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
                $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($data['kelompok_kecil_antara_id']);
                $namaKelompok = $kelompokKecilAntara ? $kelompokKecilAntara->nama_kelompok : 'Tidak diketahui';
            }
            
            $bentrokReason = "Kelompok Kecil vs Kelompok Besar: " . $namaKelompok;
            return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        return null;
    }

    /**
     * Validasi kapasitas ruangan berdasarkan jumlah mahasiswa
     */
    private function validateRuanganCapacity($data)
    {
        // Ambil data ruangan
        $ruangan = Ruangan::find($data['ruangan_id']);
        if (!$ruangan) {
            return 'Ruangan tidak ditemukan';
        }

        // Tentukan kelompok kecil berdasarkan jenis semester
        $kelompokKecil = null;
        $jumlahMahasiswa = 0;

        if (isset($data['kelompok_kecil_id']) && $data['kelompok_kecil_id']) {
            // Untuk semester reguler
            $kelompokKecil = KelompokKecil::find($data['kelompok_kecil_id']);
            if (!$kelompokKecil) {
                return 'Kelompok kecil tidak ditemukan';
            }
            $jumlahMahasiswa = KelompokKecil::where('nama_kelompok', $kelompokKecil->nama_kelompok)
                                           ->where('semester', $kelompokKecil->semester)
                                           ->count();
        } elseif (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
            // Untuk semester antara
            $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($data['kelompok_kecil_antara_id']);
            if (!$kelompokKecilAntara) {
                return 'Kelompok kecil antara tidak ditemukan';
            }
            $jumlahMahasiswa = count($kelompokKecilAntara->mahasiswa_ids ?? []);
        } else {
            return 'Kelompok kecil tidak ditemukan';
        }

        // Hitung total (mahasiswa + 1 dosen)
        $totalMahasiswa = $jumlahMahasiswa + 1;

        // Cek apakah kapasitas ruangan mencukupi
        if ($totalMahasiswa > $ruangan->kapasitas) {
            return "Kapasitas ruangan tidak mencukupi. Ruangan {$ruangan->nama} hanya dapat menampung {$ruangan->kapasitas} orang, sedangkan diperlukan {$totalMahasiswa} orang (kelompok {$jumlahMahasiswa} mahasiswa + 1 dosen).";
        }

        return null; // Kapasitas mencukupi
    }

}
