<?php

namespace App\Http\Controllers;

use App\Models\JadwalNonBlokNonCSR;
use App\Models\User;
use App\Models\Notification;
use App\Models\KelompokBesar;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class JadwalNonBlokNonCSRController extends Controller
{
    public function getJadwalForDosen($dosenId, Request $request)
    {
        try {
            $semesterType = $request->query('semester_type', 'reguler');

            Log::info("Fetching jadwal Non Blok Non CSR for dosen: {$dosenId}, semester_type: {$semesterType}");

            $query = JadwalNonBlokNonCSR::with([
                'mataKuliah:kode,nama,semester',
                'dosen:id,name',
                'ruangan:id,nama,gedung',
                'kelompokBesar:id,semester',
                'kelompokBesarAntara:id,nama_kelompok'
            ])
            ->select([
                'id', 'mata_kuliah_kode', 'tanggal', 'jam_mulai', 'jam_selesai',
                'materi', 'agenda', 'jenis_baris', 'dosen_id', 'dosen_ids',
                'ruangan_id', 'kelompok_besar_id', 'kelompok_besar_antara_id',
                'jumlah_sesi', 'use_ruangan', 'status_konfirmasi', 'alasan_konfirmasi', 'created_at'
            ])
            ->where(function ($q) use ($dosenId) {
                $q->where('dosen_id', $dosenId)
                  ->orWhere('dosen_ids', 'like', '%' . $dosenId . '%');
            });

            if ($semesterType === 'reguler') {
                $query->whereNull('kelompok_besar_antara_id');
            } elseif ($semesterType === 'antara') {
                $query->whereNotNull('kelompok_besar_antara_id');
            }

            $jadwalData = $query->orderBy('tanggal', 'asc')
                              ->orderBy('jam_mulai', 'asc')
                              ->get();

            Log::info("Found " . $jadwalData->count() . " jadwal Non Blok Non CSR records");

            $formattedData = $jadwalData->map(function ($jadwal) use ($semesterType) {
                // Handle empty or invalid time format
                $jamMulai = '';
                $jamSelesai = '';
                
                if (!empty($jadwal->jam_mulai)) {
                    try {
                        $jamMulai = Carbon::createFromFormat('H:i:s', $jadwal->jam_mulai)->format('H.i');
                    } catch (\Exception $e) {
                        // If H:i:s format fails, try H:i format
                        try {
                            $jamMulai = Carbon::createFromFormat('H:i', $jadwal->jam_mulai)->format('H.i');
                        } catch (\Exception $e2) {
                            $jamMulai = $jadwal->jam_mulai; // Use as is if both formats fail
                        }
                    }
                }
                
                if (!empty($jadwal->jam_selesai)) {
                    try {
                        $jamSelesai = Carbon::createFromFormat('H:i:s', $jadwal->jam_selesai)->format('H.i');
                    } catch (\Exception $e) {
                        // If H:i:s format fails, try H:i format
                        try {
                            $jamSelesai = Carbon::createFromFormat('H:i', $jadwal->jam_selesai)->format('H.i');
                        } catch (\Exception $e2) {
                            $jamSelesai = $jadwal->jam_selesai; // Use as is if both formats fail
                        }
                    }
                }

                $pengampu = '';
                if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
                    $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
                    $pengampu = implode(', ', $dosenNames);
                } elseif ($jadwal->dosen) {
                    $pengampu = $jadwal->dosen->name;
                }

                return [
                    'id' => $jadwal->id,
                    'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                    'mata_kuliah_nama' => $jadwal->mataKuliah ? $jadwal->mataKuliah->nama : 'N/A',
                    'tanggal' => $jadwal->tanggal->format('d-m-Y'),
                    'jam_mulai' => $jamMulai,
                    'jam_selesai' => $jamSelesai,
                    'materi' => $jadwal->materi,
                    'agenda' => $jadwal->agenda,
                    'jenis_baris' => $jadwal->jenis_baris,
                    'pengampu' => $pengampu,
                    'dosen' => $jadwal->dosen,
                    'ruangan' => $jadwal->ruangan,
                    'kelompok_besar' => $jadwal->kelompokBesar ? [
                        'id' => $jadwal->kelompokBesar->id,
                        'semester' => $jadwal->kelompokBesar->semester
                    ] : null,
                    'kelompok_besar_antara' => $jadwal->kelompokBesarAntara ? [
                        'id' => $jadwal->kelompokBesarAntara->id,
                        'nama_kelompok' => $jadwal->kelompokBesarAntara->nama_kelompok
                    ] : null,
                    'jumlah_sesi' => $jadwal->jumlah_sesi,
                    'use_ruangan' => $jadwal->use_ruangan,
                    'semester_type' => $semesterType,
                    'status_konfirmasi' => $jadwal->status_konfirmasi ?? 'belum_konfirmasi',
                    'alasan_konfirmasi' => $jadwal->alasan_konfirmasi,
                    'created_at' => $jadwal->created_at,
                ];
            });

            return response()->json([
                'message' => 'Data jadwal Non Blok Non CSR berhasil diambil',
                'data' => $formattedData,
                'count' => $formattedData->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching jadwal Non Blok Non CSR for dosen: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil data jadwal Non Blok Non CSR',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function konfirmasiJadwal($id, Request $request)
    {
        try {
            $request->validate([
                'status' => 'required|in:bisa,tidak_bisa',
                'alasan' => 'required_if:status,tidak_bisa|string|max:500',
                'dosen_id' => 'required|exists:users,id'
            ]);

            // Log untuk debugging
            Log::info('Konfirmasi Jadwal Non Blok Non CSR', [
                'jadwal_id' => $id,
                'dosen_id' => $request->dosen_id,
                'status' => $request->status
            ]);

            // Cek apakah jadwal ada
            $jadwal = JadwalNonBlokNonCSR::find($id);
            if (!$jadwal) {
                return response()->json([
                    'message' => 'Jadwal tidak ditemukan',
                    'error' => 'Jadwal dengan ID ' . $id . ' tidak ditemukan'
                ], 404);
            }

            // Cek apakah dosen memiliki akses ke jadwal ini
            $hasAccess = false;
            if ($jadwal->dosen_id == $request->dosen_id) {
                $hasAccess = true;
            } elseif ($jadwal->dosen_ids && is_array($jadwal->dosen_ids) && !empty($jadwal->dosen_ids)) {
                $hasAccess = in_array($request->dosen_id, $jadwal->dosen_ids);
            }

            if (!$hasAccess) {
                return response()->json([
                    'message' => 'Anda tidak memiliki akses untuk mengkonfirmasi jadwal ini',
                    'error' => 'Dosen ID ' . $request->dosen_id . ' tidak memiliki akses ke jadwal ID ' . $id
                ], 403);
            }

            $jadwal->update([
                'status_konfirmasi' => $request->status,
                'alasan_konfirmasi' => $request->alasan
            ]);

            if ($request->status === 'tidak_bisa') {
                $this->sendReplacementNotification($jadwal, $request->alasan, $request->dosen_id);
            }

            return response()->json([
                'message' => 'Konfirmasi jadwal berhasil disimpan',
                'data' => $jadwal
            ]);

        } catch (\Exception $e) {
            Log::error('Error confirming jadwal Non Blok Non CSR: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal menyimpan konfirmasi jadwal',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    private function sendReplacementNotification($jadwal, $alasan, $dosenId)
    {
        try {
            $dosen = User::find($dosenId);
            $dosenName = $dosen ? $dosen->name : 'Dosen';

            $superAdmins = User::where('role', 'super_admin')->get();

            foreach ($superAdmins as $admin) {
                Notification::create([
                    'user_id' => $dosenId,
                    'title' => 'Dosen Tidak Dapat Mengajar - Non Blok Non CSR',
                    'message' => "Dosen {$dosenName} tidak dapat mengajar {$jadwal->mataKuliah->nama} pada tanggal {$jadwal->tanggal->format('d/m/Y')} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai}. Alasan: {$alasan}. Perlu mencari pengganti.",
                    'type' => 'warning',
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'non_blok_non_csr',
                        'dosen_id' => $dosenId,
                        'dosen_name' => $dosenName,
                        'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                        'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal->format('Y-m-d'),
                        'jam_mulai' => $jadwal->jam_mulai,
                        'jam_selesai' => $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan ? $jadwal->ruangan->nama : 'N/A',
                        'alasan' => $alasan
                    ]
                ]);
            }

            Log::info("Replacement notification sent for jadwal Non Blok Non CSR ID: {$jadwal->id}");

        } catch (\Exception $e) {
            Log::error('Error sending replacement notification: ' . $e->getMessage());
        }
    }

    public function store(Request $request, $kode)
    {
        try {
            $request->validate([
                'tanggal' => 'required|date',
                'jam_mulai' => 'required',
                'jam_selesai' => 'required',
                'jumlah_sesi' => 'required|integer',
                'jenis_baris' => 'required|in:materi,agenda',
                'agenda' => 'nullable|string',
                'materi' => 'nullable|string',
                'dosen_id' => 'nullable|exists:users,id',
                'dosen_ids' => 'nullable|array',
                'ruangan_id' => 'nullable|exists:ruangan,id',
                'kelompok_besar_id' => 'nullable|integer',
                'kelompok_besar_antara_id' => 'nullable|exists:kelompok_besar_antara,id',
                'use_ruangan' => 'boolean'
            ]);

            $jadwal = JadwalNonBlokNonCSR::create([
                'mata_kuliah_kode' => $kode,
                'tanggal' => $request->tanggal,
                'jam_mulai' => $request->jam_mulai,
                'jam_selesai' => $request->jam_selesai,
                'jumlah_sesi' => $request->jumlah_sesi,
                'jenis_baris' => $request->jenis_baris,
                'agenda' => $request->agenda,
                'materi' => $request->materi,
                'dosen_id' => $request->dosen_id,
                'dosen_ids' => $request->dosen_ids,
                'ruangan_id' => $request->ruangan_id,
                'kelompok_besar_id' => $request->kelompok_besar_id,
                'kelompok_besar_antara_id' => $request->kelompok_besar_antara_id,
                'use_ruangan' => $request->use_ruangan ?? true,
                'status_konfirmasi' => 'belum_konfirmasi'
            ]);



            // Log activity


            activity()


                ->log('Jadwal Non Blok Non CSR deleted');



            // Log activity


            activity()


                ->log('Jadwal Non Blok Non CSR updated');



            // Log activity


            activity()


                ->log('Jadwal Non Blok Non CSR created');

            $this->sendJadwalNotifications($jadwal);

            return response()->json([
                'message' => 'Jadwal Non Blok Non CSR berhasil ditambahkan',
                'data' => $jadwal
            ], 201);

        } catch (\Exception $e) {
            Log::error('Error creating jadwal Non Blok Non CSR: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal menambahkan jadwal Non Blok Non CSR',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    private function sendJadwalNotifications($jadwal)
    {
        try {
            $dosenIds = [];

            if ($jadwal->dosen_id) {
                $dosenIds[] = $jadwal->dosen_id;
            }

            if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
                $dosenIds = array_merge($dosenIds, $jadwal->dosen_ids);
            }

            $dosenIds = array_unique($dosenIds);

            foreach ($dosenIds as $dosenId) {
                $dosen = User::find($dosenId);
                if (!$dosen) continue;

                $mataKuliah = $jadwal->mataKuliah;
                $ruangan = $jadwal->ruangan;

                $message = "Anda telah di-assign untuk mengajar Non Blok Non CSR {$mataKuliah->nama} pada tanggal {$jadwal->tanggal->format('d/m/Y')} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai}";

                if ($ruangan && $jadwal->use_ruangan) {
                    $message .= " di ruangan {$ruangan->nama}";
                }

                $message .= ". Silakan konfirmasi ketersediaan Anda.";

                Notification::create([
                    'user_id' => $dosenId,
                    'title' => 'Jadwal Non Blok Non CSR Baru',
                    'message' => $message,
                    'type' => 'info',
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'non_blok_non_csr',
                        'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                        'mata_kuliah_nama' => $mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal->format('Y-m-d'),
                        'jam_mulai' => $jadwal->jam_mulai,
                        'jam_selesai' => $jadwal->jam_selesai,
                        'materi' => $jadwal->materi,
                        'agenda' => $jadwal->agenda,
                        'jenis_baris' => $jadwal->jenis_baris,
                        'ruangan' => $ruangan ? $ruangan->nama : null,
                        'use_ruangan' => $jadwal->use_ruangan,
                        'dosen_id' => $dosen->id,
                        'dosen_name' => $dosen->name,
                        'dosen_role' => $dosen->role
                    ]
                ]);

            }

            Log::info("Notifications sent for new jadwal Non Blok Non CSR ID: {$jadwal->id}");

        } catch (\Exception $e) {
            Log::error('Error sending jadwal notifications: ' . $e->getMessage());
        }
    }

    public function index($kode)
    {
        try {
            $jadwal = JadwalNonBlokNonCSR::with(['mataKuliah', 'dosen', 'ruangan', 'kelompokBesar'])
                ->where('mata_kuliah_kode', $kode)
                ->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();
            
            return response()->json($jadwal);
        } catch (\Exception $e) {
            Log::error('Error fetching jadwal Non Blok Non CSR: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil data jadwal',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, $kode, $id)
    {
        try {
            $request->validate([
                'tanggal' => 'required|date',
                'jam_mulai' => 'required',
                'jam_selesai' => 'required',
                'jumlah_sesi' => 'required|integer',
                'jenis_baris' => 'required|in:materi,agenda',
                'agenda' => 'nullable|string',
                'materi' => 'nullable|string',
                'dosen_id' => 'nullable|exists:users,id',
                'dosen_ids' => 'nullable|array',
                'ruangan_id' => 'nullable|exists:ruangan,id',
                'kelompok_besar_id' => 'nullable|integer',
                'kelompok_besar_antara_id' => 'nullable|exists:kelompok_besar_antara,id',
                'use_ruangan' => 'boolean'
            ]);

            $jadwal = JadwalNonBlokNonCSR::where('id', $id)
                ->where('mata_kuliah_kode', $kode)
                ->firstOrFail();

            $jadwal->update([
                'tanggal' => $request->tanggal,
                'jam_mulai' => $request->jam_mulai,
                'jam_selesai' => $request->jam_selesai,
                'jumlah_sesi' => $request->jumlah_sesi,
                'jenis_baris' => $request->jenis_baris,
                'agenda' => $request->agenda,
                'materi' => $request->materi,
                'dosen_id' => $request->dosen_id,
                'dosen_ids' => $request->dosen_ids,
                'ruangan_id' => $request->ruangan_id,
                'kelompok_besar_id' => $request->kelompok_besar_id,
                'kelompok_besar_antara_id' => $request->kelompok_besar_antara_id,
                'use_ruangan' => $request->use_ruangan ?? true,
            ]);

            return response()->json([
                'message' => 'Jadwal Non Blok Non CSR berhasil diperbarui',
                'data' => $jadwal
            ]);

        } catch (\Exception $e) {
            Log::error('Error updating jadwal Non Blok Non CSR: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal memperbarui jadwal Non Blok Non CSR',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function destroy($kode, $id)
    {
        try {
            $jadwal = JadwalNonBlokNonCSR::where('id', $id)
                ->where('mata_kuliah_kode', $kode)
                ->firstOrFail();

            $jadwal->delete();

            return response()->json([
                'message' => 'Jadwal Non Blok Non CSR berhasil dihapus'
            ]);

        } catch (\Exception $e) {
            Log::error('Error deleting jadwal Non Blok Non CSR: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal menghapus jadwal Non Blok Non CSR',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function kelompokBesar(Request $request)
    {
        $semester = $request->query('semester');

        if (!$semester) {
            return response()->json(['message' => 'Parameter semester diperlukan'], 400);
        }

        // Jika semester adalah "Antara", return kelompok besar antara
        if ($semester === "Antara") {
            return response()->json([]); // Akan dihandle di frontend
        }

        // Ambil jumlah mahasiswa di semester tersebut
        $jumlahMahasiswa = KelompokBesar::where('semester', $semester)->count();
        
        // Jika ada mahasiswa di semester tersebut, buat satu kelompok besar
        if ($jumlahMahasiswa > 0) {
            return response()->json([
                [
                    'id' => $semester, // Gunakan semester sebagai ID
                    'label' => "Kelompok Besar Semester {$semester} ({$jumlahMahasiswa} mahasiswa)",
                    'jumlah_mahasiswa' => $jumlahMahasiswa
                ]
            ]);
        }

        return response()->json([]);
    }

}
