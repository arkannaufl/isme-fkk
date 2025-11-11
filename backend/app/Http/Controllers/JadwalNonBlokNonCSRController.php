<?php

namespace App\Http\Controllers;

use App\Models\JadwalNonBlokNonCSR;
use App\Models\User;
use App\Models\Notification;
use App\Models\KelompokBesar;
use App\Models\AbsensiNonBlokNonCSR;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class JadwalNonBlokNonCSRController extends Controller
{
    public function show($id)
    {
        try {
            $jadwal = JadwalNonBlokNonCSR::with([
                'mataKuliah:kode,nama,semester,tanggal_mulai,tanggal_akhir',
                'dosen:id,name,nid,nidn,nuptk,signature_image',
                'ruangan:id,nama,gedung',
                'kelompokBesar:id,semester',
                'kelompokBesarAntara:id,nama_kelompok'
            ])->find($id);

            if (!$jadwal) {
                return response()->json([
                    'message' => 'Jadwal tidak ditemukan',
                    'error' => 'Jadwal dengan ID ' . $id . ' tidak ditemukan'
                ], 404);
            }

            return response()->json([
                'message' => 'Data jadwal berhasil diambil',
                'data' => $jadwal
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching jadwal Non Blok Non CSR: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil data jadwal',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getJadwalForDosen($dosenId, Request $request)
    {
        try {
            $semesterType = $request->query('semester_type', 'reguler');

            Log::info("Fetching jadwal Non Blok Non CSR for dosen: {$dosenId}, semester_type: {$semesterType}");

            $query = JadwalNonBlokNonCSR::with([
                'mataKuliah:kode,nama,semester',
                'dosen:id,name,nid,nidn,nuptk,signature_image',
                'ruangan:id,nama,gedung',
                'kelompokBesar:id,semester',
                'kelompokBesarAntara:id,nama_kelompok'
            ])
                ->select([
                    'id',
                    'mata_kuliah_kode',
                    'tanggal',
                    'jam_mulai',
                    'jam_selesai',
                    'materi',
                    'agenda',
                    'jenis_baris',
                    'dosen_id',
                    'dosen_ids',
                    'ruangan_id',
                    'kelompok_besar_id',
                    'kelompok_besar_antara_id',
                    'jumlah_sesi',
                    'use_ruangan',
                    'status_konfirmasi',
                    'alasan_konfirmasi',
                    'status_reschedule',
                    'reschedule_reason',
                    'created_at'
                ])
                ->where(function ($q) use ($dosenId) {
                    // Cek single dosen_id atau dosen_ids (array) yang mengandung dosenId
                    $q->where('dosen_id', $dosenId)
                      ->orWhereNotNull('dosen_ids');
                });

            if ($semesterType === 'reguler') {
                $query->whereNull('kelompok_besar_antara_id');
            } elseif ($semesterType === 'antara') {
                $query->whereNotNull('kelompok_besar_antara_id');
            }

            $jadwalData = $query->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();

            // Filter jadwal yang benar-benar memiliki dosenId (untuk dosen_ids array)
            $jadwalData = $jadwalData->filter(function ($item) use ($dosenId) {
                // Jika single dosen_id, langsung return true jika match
                if ($item->dosen_id == $dosenId) {
                    return true;
                }
                // Jika dosen_ids (array), cek apakah dosenId ada di dalam array
                if (!empty($item->dosen_ids) && is_array($item->dosen_ids) && in_array($dosenId, $item->dosen_ids)) {
                    return true;
                }
                return false;
            });

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
                    'jenis_jadwal' => 'non_blok_non_csr',
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
                    'status_reschedule' => $jadwal->status_reschedule ?? null,
                    'reschedule_reason' => $jadwal->reschedule_reason ?? null,
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
                'alasan' => 'nullable|string|max:500',
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
                    'user_id' => $admin->id, // Perbaiki: gunakan admin ID, bukan dosen ID
                    'title' => 'Dosen Tidak Dapat Mengajar - Non Blok Non CSR',
                    'message' => "Dosen {$dosenName} tidak dapat mengajar {$jadwal->mataKuliah->nama} pada tanggal {$jadwal->tanggal->format('d/m/Y')} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai}. Alasan: {$alasan}. Perlu mencari pengganti.",
                    'type' => 'warning',
                    'is_read' => false,
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
                'created_by' => $request->input('created_by', Auth::id()),
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

            // Send notification to mahasiswa
            $this->sendNotificationToMahasiswa($jadwal);

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
                        'dosen_role' => $dosen->role,
                        'created_by' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->name ?? 'Admin' : 'Admin',
                        'created_by_role' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->role ?? 'admin' : 'admin',
                        'sender_name' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->name ?? 'Admin' : 'Admin',
                        'sender_role' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->role ?? 'admin' : 'admin'
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
            $jadwal = JadwalNonBlokNonCSR::with(['mataKuliah', 'dosen:id,name,nid,nidn,nuptk,signature_image', 'ruangan', 'kelompokBesar', 'kelompokBesarAntara'])
                ->where('mata_kuliah_kode', $kode)
                ->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();

            // Untuk jadwal dengan dosen_ids (array), tambahkan data dosen pertama
            $jadwal->each(function ($item) {
                if ($item->dosen_ids && is_array($item->dosen_ids) && count($item->dosen_ids) > 0 && !$item->dosen) {
                    // Fetch dosen pertama dari dosen_ids
                    $dosen = User::where('id', $item->dosen_ids[0])
                        ->select('id', 'name', 'nid', 'nidn', 'nuptk', 'signature_image')
                        ->first();
                    if ($dosen) {
                        $item->dosen = $dosen;
                    }
                }
            });

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

    // Ajukan reschedule jadwal Non Blok Non CSR
    public function reschedule(Request $request, $id)
    {
        $request->validate([
            'reschedule_reason' => 'required|string|max:1000',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $jadwal = JadwalNonBlokNonCSR::with(['mataKuliah', 'ruangan'])
            ->where('id', $id)
            ->where('dosen_id', $request->dosen_id)
            ->firstOrFail();

        $jadwal->update([
            'status_konfirmasi' => 'waiting_reschedule',
            'reschedule_reason' => $request->reschedule_reason,
            'status_reschedule' => 'waiting'
        ]);

        // Kirim notifikasi ke admin
        $this->sendRescheduleNotification($jadwal, $request->reschedule_reason);

        return response()->json([
            'message' => 'Permintaan reschedule berhasil diajukan',
            'status' => 'waiting_reschedule'
        ]);
    }

    /**
     * Kirim notifikasi reschedule ke admin
     */
    private function sendRescheduleNotification($jadwal, $reason)
    {
        try {
            $dosen = \App\Models\User::find($jadwal->dosen_id);

            // Buat hanya 1 notifikasi yang bisa dilihat oleh semua admin
            $firstAdmin = \App\Models\User::where('role', 'super_admin')->first() ?? \App\Models\User::where('role', 'tim_akademik')->first();

            if ($firstAdmin) {
                \App\Models\Notification::create([
                    'user_id' => $firstAdmin->id,
                    'title' => 'Permintaan Reschedule Jadwal',
                    'message' => "Dosen {$dosen->name} mengajukan reschedule untuk jadwal Non Blok Non CSR. Alasan: {$reason}",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'non_blok_non_csr',
                        'dosen_name' => $dosen->name,
                        'dosen_id' => $dosen->id,
                        'reschedule_reason' => $reason,
                        'notification_type' => 'reschedule_request'
                    ]
                ]);
            }

            Log::info("Reschedule notification sent for Non Blok Non CSR jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            Log::error("Error sending reschedule notification for Non Blok Non CSR jadwal ID: {$jadwal->id}: " . $e->getMessage());
        }
    }

    public function importExcel(Request $request, $kode)
    {
        try {
            $request->validate([
                'data' => 'required|array',
                'data.*.tanggal' => 'required|date',
                'data.*.jam_mulai' => 'required|string',
                'data.*.jam_selesai' => 'required|string',
                'data.*.jenis_baris' => 'required|in:materi,agenda',
                'data.*.jumlah_sesi' => 'required|integer|min:1|max:6',
                'data.*.kelompok_besar_id' => 'nullable|integer',
                'data.*.dosen_id' => 'nullable|exists:users,id',
                'data.*.materi' => 'nullable|string',
                'data.*.ruangan_id' => 'nullable|exists:ruangan,id',
                'data.*.agenda' => 'nullable|string',
                'data.*.use_ruangan' => 'boolean'
            ]);

            $mataKuliah = \App\Models\MataKuliah::where('kode', $kode)->first();
            if (!$mataKuliah) {
                return response()->json([
                    'message' => 'Mata kuliah tidak ditemukan'
                ], 404);
            }

            // Debug: Log mata kuliah info
            Log::info("Import Excel - Mata Kuliah: {$kode}, Semester: {$mataKuliah->semester}");

            $importedCount = 0;
            $errors = [];

            DB::beginTransaction();

            foreach ($request->data as $index => $row) {
                try {
                    // Validasi tanggal dalam rentang mata kuliah
                    $tanggal = Carbon::parse($row['tanggal']);
                    if ($tanggal < Carbon::parse($mataKuliah->tanggal_mulai) || $tanggal > Carbon::parse($mataKuliah->tanggal_akhir)) {
                        throw new \Exception("Tanggal di luar rentang mata kuliah (Baris " . ($index + 1) . ")");
                    }

                    // Validasi khusus untuk jenis materi
                    if ($row['jenis_baris'] === 'materi') {
                        if (!$row['dosen_id']) {
                            throw new \Exception("Dosen wajib diisi untuk jenis materi (Baris " . ($index + 1) . ")");
                        }
                        if (!$row['materi']) {
                            throw new \Exception("Materi wajib diisi untuk jenis materi (Baris " . ($index + 1) . ")");
                        }
                        if (!$row['ruangan_id']) {
                            throw new \Exception("Ruangan wajib diisi untuk jenis materi (Baris " . ($index + 1) . ")");
                        }
                    }

                    // Validasi khusus untuk jenis agenda
                    if ($row['jenis_baris'] === 'agenda') {
                        if (!$row['agenda']) {
                            throw new \Exception("Keterangan agenda wajib diisi untuk jenis agenda (Baris " . ($index + 1) . ")");
                        }
                    }

                    // Validasi kelompok besar sesuai semester
                    if ($row['kelompok_besar_id']) {
                        // kelompok_besar_id yang dikirim dari frontend adalah semester
                        $semesterKelompokBesar = $row['kelompok_besar_id'];

                        // Cek apakah ada kelompok besar untuk semester tersebut
                        $kelompokBesarExists = KelompokBesar::where('semester', $semesterKelompokBesar)->exists();
                        if (!$kelompokBesarExists) {
                            throw new \Exception("Kelompok besar semester {$semesterKelompokBesar} tidak ditemukan (Baris " . ($index + 1) . ")");
                        }

                        // Cek apakah semester kelompok besar sesuai dengan semester mata kuliah
                        if ($semesterKelompokBesar != $mataKuliah->semester) {
                            // Debug: Log detail validasi
                            Log::info("Import Excel - Validasi Kelompok Besar: Row " . ($index + 1) . ", Kelompok Besar Semester: {$semesterKelompokBesar}, Mata Kuliah Semester: {$mataKuliah->semester}");
                            throw new \Exception("Kelompok besar semester {$semesterKelompokBesar} tidak sesuai dengan semester mata kuliah ({$mataKuliah->semester}) (Baris " . ($index + 1) . ")");
                        }
                    }

                    // Validasi bentrok dengan semua jadwal (mempertimbangkan semester)
                    $row['mata_kuliah_kode'] = $kode;
                    $bentrokMessage = $this->checkBentrokWithDetail($row, null);
                    if ($bentrokMessage) {
                        throw new \Exception($bentrokMessage . " (Baris " . ($index + 1) . ")");
                    }

                    // Validasi kapasitas ruangan
                    if ($row['ruangan_id'] && $row['kelompok_besar_id']) {
                        $capacityError = $this->validateRuanganCapacity($row['ruangan_id'], $row['kelompok_besar_id']);
                        if ($capacityError) {
                            throw new \Exception($capacityError . " (Baris " . ($index + 1) . ")");
                        }
                    }

                    // Create jadwal
                    $jadwal = JadwalNonBlokNonCSR::create([
                        'mata_kuliah_kode' => $kode,
                        'tanggal' => $row['tanggal'],
                        'jam_mulai' => $row['jam_mulai'],
                        'jam_selesai' => $row['jam_selesai'],
                        'jumlah_sesi' => $row['jumlah_sesi'],
                        'jenis_baris' => $row['jenis_baris'],
                        'agenda' => $row['agenda'] ?? null,
                        'materi' => $row['materi'] ?? null,
                        'dosen_id' => $row['dosen_id'] ?? null,
                        'ruangan_id' => $row['ruangan_id'] ?? null,
                        'kelompok_besar_id' => $row['kelompok_besar_id'] ?? null,
                        'use_ruangan' => $row['use_ruangan'] ?? true,
                        'status_konfirmasi' => 'belum_konfirmasi'
                    ]);

                    $this->sendJadwalNotifications($jadwal);
                    $importedCount++;
                } catch (\Exception $e) {
                    $errors[] = $e->getMessage();
                }
            }

            if (!empty($errors)) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Terjadi kesalahan saat mengimport data: ' . implode(', ', $errors)
                ], 422);
            }

            DB::commit();

            // Log activity
            activity()
                ->log("Imported {$importedCount} jadwal Non Blok Non CSR for mata kuliah {$kode}");

            return response()->json([
                'success' => true,
                'message' => "Berhasil mengimport {$importedCount} jadwal Non Blok Non CSR",
                'imported_count' => $importedCount
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error importing jadwal Non Blok Non CSR: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan saat mengimport data: ' . $e->getMessage()
            ], 500);
        }
    }

    private function checkConflict($row, $kode)
    {
        $tanggal = $row['tanggal'];
        $jamMulai = $row['jam_mulai'];
        $jamSelesai = $row['jam_selesai'];

        // Check conflict dengan jadwal Non Blok Non CSR lain
        $conflict = JadwalNonBlokNonCSR::where('mata_kuliah_kode', $kode)
            ->where('tanggal', $tanggal)
            ->where(function ($q) use ($jamMulai, $jamSelesai) {
                $q->whereBetween('jam_mulai', [$jamMulai, $jamSelesai])
                    ->orWhereBetween('jam_selesai', [$jamMulai, $jamSelesai])
                    ->orWhere(function ($q2) use ($jamMulai, $jamSelesai) {
                        $q2->where('jam_mulai', '<=', $jamMulai)
                            ->where('jam_selesai', '>=', $jamSelesai);
                    });
            })
            ->first();

        if ($conflict) {
            return "Bentrok dengan jadwal Non Blok Non CSR lain";
        }

        // Check conflict dengan dosen
        if ($row['dosen_id']) {
            $dosenConflict = JadwalNonBlokNonCSR::where('dosen_id', $row['dosen_id'])
                ->where('tanggal', $tanggal)
                ->where(function ($q) use ($jamMulai, $jamSelesai) {
                    $q->whereBetween('jam_mulai', [$jamMulai, $jamSelesai])
                        ->orWhereBetween('jam_selesai', [$jamMulai, $jamSelesai])
                        ->orWhere(function ($q2) use ($jamMulai, $jamSelesai) {
                            $q2->where('jam_mulai', '<=', $jamMulai)
                                ->where('jam_selesai', '>=', $jamSelesai);
                        });
                })
                ->first();

            if ($dosenConflict) {
                return "Dosen sudah memiliki jadwal pada waktu tersebut";
            }
        }

        // Check conflict dengan ruangan
        if ($row['ruangan_id']) {
            $ruanganConflict = JadwalNonBlokNonCSR::where('ruangan_id', $row['ruangan_id'])
                ->where('tanggal', $tanggal)
                ->where(function ($q) use ($jamMulai, $jamSelesai) {
                    $q->whereBetween('jam_mulai', [$jamMulai, $jamSelesai])
                        ->orWhereBetween('jam_selesai', [$jamMulai, $jamSelesai])
                        ->orWhere(function ($q2) use ($jamMulai, $jamSelesai) {
                            $q2->where('jam_mulai', '<=', $jamMulai)
                                ->where('jam_selesai', '>=', $jamSelesai);
                        });
                })
                ->first();

            if ($ruanganConflict) {
                return "Ruangan sudah digunakan pada waktu tersebut";
            }
        }

        return null;
    }

    private function checkBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Ambil data mata kuliah untuk mendapatkan semester
        $mataKuliah = \App\Models\MataKuliah::where('kode', $data['mata_kuliah_kode'])->first();
        $semester = $mataKuliah ? $mataKuliah->semester : null;

        // Cek bentrok dengan jadwal Non Blok Non CSR (dengan filter semester)
        $nonBlokNonCSRBentrok = JadwalNonBlokNonCSR::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('ruangan_id', $data['ruangan_id']);

                // Cek bentrok dosen jika ada
                if (isset($data['dosen_id']) && $data['dosen_id']) {
                    $q->orWhere('dosen_id', $data['dosen_id']);
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        if ($ignoreId) {
            $nonBlokNonCSRBentrok->where('id', '!=', $ignoreId);
        }

        // Cek bentrok dengan jadwal PBL (dengan filter semester)
        $pblBentrok = \App\Models\JadwalPBL::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan jadwal Kuliah Besar (dengan filter semester)
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan jadwal Agenda Khusus (dengan filter semester)
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan jadwal Praktikum (dengan filter semester)
        $praktikumBentrok = \App\Models\JadwalPraktikum::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan jadwal Jurnal Reading (dengan filter semester)
        $jurnalBentrok = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan jadwal CSR (dengan filter semester)
        $csrBentrok = \App\Models\JadwalCSR::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan kelompok besar (jika ada kelompok_besar_id di jadwal lain)
        $kelompokBesarBentrok = $this->checkKelompokBesarBentrok($data, $ignoreId);

        return $nonBlokNonCSRBentrok->exists() || $pblBentrok->exists() ||
            $kuliahBesarBentrok->exists() || $agendaKhususBentrok->exists() ||
            $praktikumBentrok->exists() || $jurnalBentrok->exists() ||
            $csrBentrok->exists() || $kelompokBesarBentrok;
    }

    private function checkKelompokBesarBentrok($data, $ignoreId = null)
    {
        if (!isset($data['kelompok_besar_id']) || !$data['kelompok_besar_id']) {
            return false;
        }

        // Cek bentrok dengan jadwal yang menggunakan kelompok besar yang sama
        $bentrok = JadwalNonBlokNonCSR::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_id', $data['kelompok_besar_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $bentrok->where('id', '!=', $ignoreId);
        }

        return $bentrok->exists();
    }

    private function validateRuanganCapacity($ruanganId, $kelompokBesarId)
    {
        $ruangan = \App\Models\Ruangan::find($ruanganId);
        $kelompokBesar = KelompokBesar::find($kelompokBesarId);

        if (!$ruangan || !$kelompokBesar) {
            return "Data ruangan atau kelompok besar tidak ditemukan";
        }

        if ($ruangan->kapasitas < $kelompokBesar->jumlah_anggota) {
            return "Kapasitas ruangan ({$ruangan->kapasitas}) tidak mencukupi untuk kelompok besar ({$kelompokBesar->jumlah_anggota} mahasiswa)";
        }

        return null;
    }

    // Get jadwal Non Blok Non CSR for mahasiswa
    public function getJadwalForMahasiswa($mahasiswaId, Request $request)
    {
        try {
            $mahasiswa = User::where('id', $mahasiswaId)->where('role', 'mahasiswa')->first();
            if (!$mahasiswa) {
                return response()->json(['message' => 'Mahasiswa tidak ditemukan', 'data' => []], 404);
            }

            // Get jadwal berdasarkan semester mahasiswa dan semester mata kuliah
            $jadwal = JadwalNonBlokNonCSR::with(['mataKuliah', 'dosen', 'ruangan', 'kelompokBesar'])
                ->whereHas('mataKuliah', function ($query) use ($mahasiswa) {
                    $query->where('semester', $mahasiswa->semester);
                })
                ->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();

            Log::info("Non Blok Non CSR - Mahasiswa ID: {$mahasiswaId}, Semester: {$mahasiswa->semester}");
            Log::info("Non Blok Non CSR - Found {$jadwal->count()} jadwal for semester: {$mahasiswa->semester}");

            $mappedJadwal = $jadwal->map(function ($item) {
                // Determine jenis_baris
                $jenisBaris = $item->agenda ? 'agenda' : 'materi';

                // Determine tipe text
                $tipe = $jenisBaris === 'agenda' ? 'Agenda Khusus' : 'Jadwal Materi';

                // Determine pengampu - show "-" if no dosen for agenda or if jenis_baris is agenda
                $pengampu = ($jenisBaris === 'agenda' || !$item->dosen) ? '-' : $item->dosen->name;

                // Determine ruangan - show "-" if not using ruangan or if jenis_baris is agenda without ruangan
                $ruangan = null;
                if ($jenisBaris === 'materi' && $item->use_ruangan && $item->ruangan) {
                    $ruangan = ['id' => $item->ruangan->id, 'nama' => $item->ruangan->nama];
                } elseif ($jenisBaris === 'agenda' && $item->use_ruangan && $item->ruangan) {
                    $ruangan = ['id' => $item->ruangan->id, 'nama' => $item->ruangan->nama];
                } else {
                    $ruangan = null;
                }

                // Determine status - show "-" if no dosen (agenda or no assigned dosen)
                $status = ($jenisBaris === 'agenda' || !$item->dosen) ? '-' : ($item->status_konfirmasi ?? 'belum_konfirmasi');

                return [
                    'id' => $item->id,
                    'tanggal' => date('d/m/Y', strtotime($item->tanggal)), // Format dd/mm/yyyy
                    'jam_mulai' => substr($item->jam_mulai, 0, 5),
                    'jam_selesai' => substr($item->jam_selesai, 0, 5),
                    'agenda' => $item->agenda ?? null,
                    'materi' => $item->materi ?? null,
                    'jenis_baris' => $jenisBaris,
                    'tipe' => $tipe, // Added tipe column
                    'use_ruangan' => $item->use_ruangan ?? false, // Added use_ruangan
                    'pengampu' => $pengampu,
                    'ruangan' => $ruangan,
                    'jumlah_sesi' => $item->jumlah_sesi ?? 1,
                    'status_konfirmasi' => $status,
                    'alasan_konfirmasi' => $item->alasan_konfirmasi ?? null,
                    'status_reschedule' => $item->status_reschedule ?? null,
                    'reschedule_reason' => $item->reschedule_reason ?? null,
                    'semester_type' => 'reguler',
                    'jenis_jadwal' => 'non_blok_non_csr',
                ];
            });

            return response()->json(['message' => 'Data jadwal berhasil diambil', 'data' => $mappedJadwal]);
        } catch (\Exception $e) {
            Log::error('Error fetching jadwal Non Blok Non CSR for mahasiswa: ' . $e->getMessage());
            return response()->json(['message' => 'Terjadi kesalahan', 'error' => $e->getMessage(), 'data' => []], 500);
        }
    }

    /**
     * Send notification to mahasiswa in the semester
     */
    private function sendNotificationToMahasiswa($jadwal)
    {
        try {
            // Get semua mahasiswa di semester yang sama dengan mata kuliah
            $semester = $jadwal->mataKuliah->semester;

            $mahasiswaList = \App\Models\User::where('role', 'mahasiswa')
                ->where('semester', $semester)
                ->get();

            Log::info("Non Blok Non CSR - Found {$mahasiswaList->count()} mahasiswa in semester: {$semester}");

            // Hapus notifikasi lama untuk mahasiswa saja (bukan dosen)
            \App\Models\Notification::where('title', 'Jadwal Non Blok Non CSR Baru')
                ->where('data->jadwal_id', $jadwal->id)
                ->whereHas('user', function ($query) {
                    $query->where('role', 'mahasiswa');
                })
                ->delete();

            // Send notification to each mahasiswa
            foreach ($mahasiswaList as $mahasiswa) {
                \App\Models\Notification::create([
                    'user_id' => $mahasiswa->id,
                    'title' => 'Jadwal Non Blok Non CSR Baru',
                    'message' => "Jadwal Non Blok Non CSR baru telah ditambahkan: {$jadwal->mataKuliah->nama} - " . ($jadwal->agenda ?: $jadwal->materi) . " pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}.",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'non_blok_non_csr',
                        'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                        'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                        'agenda' => $jadwal->agenda,
                        'materi' => $jadwal->materi,
                        'jenis_baris' => $jadwal->agenda ? 'agenda' : 'materi',
                        'tanggal' => $jadwal->tanggal,
                        'jam_mulai' => $jadwal->jam_mulai,
                        'jam_selesai' => $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'dosen' => $jadwal->dosen ? $jadwal->dosen->name : 'N/A',
                        'kelompok_besar_id' => $jadwal->kelompok_besar_id,
                        'kelompok_besar_semester' => $semester,
                        'created_by' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->name ?? 'Admin' : 'Admin',
                        'created_by_role' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->role ?? 'admin' : 'admin',
                        'sender_name' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->name ?? 'Admin' : 'Admin',
                        'sender_role' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->role ?? 'admin' : 'admin'
                    ]
                ]);
            }

            Log::info("Non Blok Non CSR notifications sent to " . count($mahasiswaList) . " mahasiswa for jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            Log::error("Error sending Non Blok Non CSR notifications to mahasiswa: " . $e->getMessage());
        }
    }

    /**
     * Toggle QR code enabled/disabled untuk jadwal non-blok non-CSR
     */
    public function toggleQr($kode, $jadwalId)
    {
        try {
            $jadwal = JadwalNonBlokNonCSR::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Cek apakah user adalah dosen yang mengajar di jadwal ini
            $userId = Auth::id();
            $isDosenJadwal = false;

            if ($jadwal->dosen_id && $jadwal->dosen_id == $userId) {
                $isDosenJadwal = true;
            } elseif ($jadwal->dosen_ids && is_array($jadwal->dosen_ids) && in_array($userId, $jadwal->dosen_ids)) {
                $isDosenJadwal = true;
            }

            // Hanya dosen yang mengajar atau super_admin/tim_akademik yang bisa toggle
            $user = Auth::user();
            if (!$isDosenJadwal && !in_array($user->role, ['super_admin', 'tim_akademik'])) {
                return response()->json(['message' => 'Anda tidak memiliki akses untuk mengubah status QR code'], 403);
            }

            // Toggle qr_enabled
            $jadwal->qr_enabled = !$jadwal->qr_enabled;
            $jadwal->save();

            Log::info('QR code toggled for Non Blok Non CSR', [
                'jadwal_id' => $jadwalId,
                'qr_enabled' => $jadwal->qr_enabled,
                'user_id' => $userId
            ]);

            return response()->json([
                'message' => $jadwal->qr_enabled ? 'QR code diaktifkan' : 'QR code dinonaktifkan',
                'qr_enabled' => $jadwal->qr_enabled
            ]);
        } catch (\Exception $e) {
            Log::error("Error toggling QR for Non Blok Non CSR: " . $e->getMessage());
            return response()->json(['message' => 'Gagal mengubah status QR code: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Generate QR token untuk absensi (expired setiap 20 detik)
     */
    public function generateQrToken($kode, $jadwalId)
    {
        try {
            $jadwal = JadwalNonBlokNonCSR::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Validasi: Hanya bisa generate token jika QR enabled
            if (!$jadwal->qr_enabled) {
                return response()->json([
                    'message' => 'QR code belum diaktifkan',
                    'qr_enabled' => false
                ], 403);
            }

            // Cek apakah user adalah dosen yang mengajar di jadwal ini
            $userId = Auth::id();
            $isDosenJadwal = false;

            if ($jadwal->dosen_id && $jadwal->dosen_id == $userId) {
                $isDosenJadwal = true;
            } elseif ($jadwal->dosen_ids && is_array($jadwal->dosen_ids) && in_array($userId, $jadwal->dosen_ids)) {
                $isDosenJadwal = true;
            }

            // Hanya dosen yang mengajar atau super_admin/tim_akademik yang bisa generate token
            $user = Auth::user();
            if (!$isDosenJadwal && !in_array($user->role, ['super_admin', 'tim_akademik'])) {
                return response()->json(['message' => 'Anda tidak memiliki akses untuk generate QR token'], 403);
            }

            // Generate random token
            $token = Str::random(32);
            $cacheKey = "qr_token_non_blok_non_csr_{$kode}_{$jadwalId}";

            // Simpan token di cache dengan expiry 20 detik
            Cache::put($cacheKey, $token, now()->addSeconds(20));

            // Calculate expires timestamp (unix timestamp in milliseconds untuk frontend)
            $expiresAt = now()->addSeconds(20);
            $expiresAtTimestamp = $expiresAt->timestamp * 1000; // Convert to milliseconds

            Log::info('QR token generated for Non Blok Non CSR', [
                'kode' => $kode,
                'jadwal_id' => $jadwalId,
                'token' => substr($token, 0, 8) . '...', // Log hanya sebagian untuk security
                'expires_at' => $expiresAt->toDateTimeString(),
                'expires_at_timestamp' => $expiresAtTimestamp
            ]);

            return response()->json([
                'token' => $token,
                'expires_in' => 20, // detik
                'expires_at' => $expiresAt->toDateTimeString(), // Untuk display
                'expires_at_timestamp' => $expiresAtTimestamp // Unix timestamp in milliseconds (untuk frontend)
            ]);
        } catch (\Exception $e) {
            Log::error("Error generating QR token for Non Blok Non CSR: " . $e->getMessage());
            return response()->json(['message' => 'Gagal generate QR token: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get absensi untuk jadwal non-blok non-CSR tertentu
     */
    public function getAbsensi($kode, $jadwalId)
    {
        try {
            $jadwal = JadwalNonBlokNonCSR::where('mata_kuliah_kode', $kode)
                ->where('id', $jadwalId)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Get semua absensi untuk jadwal ini
            $absensiRecords = AbsensiNonBlokNonCSR::where('jadwal_non_blok_non_csr_id', $jadwalId)
                ->get();

            $absensi = $absensiRecords
                ->keyBy('mahasiswa_nim')
                ->map(function ($item) {
                    return [
                        'hadir' => $item->hadir,
                        'catatan' => $item->catatan
                    ];
                })
                ->toArray();

            return response()->json([
                'absensi' => $absensi
            ]);
        } catch (\Exception $e) {
            Log::error("Error getting absensi for Non Blok Non CSR: " . $e->getMessage());
            return response()->json(['message' => 'Gagal mengambil data absensi'], 500);
        }
    }

    /**
     * Save absensi untuk jadwal non-blok non-CSR tertentu
     */
    public function saveAbsensi(Request $request, $kode, $jadwalId)
    {
        try {
            $jadwal = JadwalNonBlokNonCSR::where('mata_kuliah_kode', $kode)
                ->where('id', $jadwalId)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // VALIDASI: Pastikan QR code sudah diaktifkan oleh dosen (hanya untuk mahasiswa)
            // Dosen bisa input manual tanpa perlu QR code aktif
            $user = Auth::user();
            $isDosen = $user && in_array($user->role, ['dosen', 'super_admin', 'tim_akademik']);

            if (!$isDosen && !$jadwal->qr_enabled) {
                Log::warning('Absensi ditolak: QR code belum diaktifkan', [
                    'jadwal_id' => $jadwalId,
                    'qr_enabled' => $jadwal->qr_enabled,
                    'user_role' => $user->role ?? 'unknown'
                ]);
                return response()->json([
                    'message' => 'QR code belum diaktifkan oleh dosen. Silakan tunggu hingga dosen mengaktifkan QR code untuk absensi ini.',
                    'qr_enabled' => false
                ], 403);
            }

            // VALIDASI: Cek token QR code untuk mahasiswa (jika submit via QR)
            if (!$isDosen && $jadwal->qr_enabled) {
                $token = $request->input('qr_token');
                $cacheKey = "qr_token_non_blok_non_csr_{$kode}_{$jadwalId}";

                if (!$token) {
                    Log::warning('Absensi ditolak: QR token tidak ditemukan', [
                        'jadwal_id' => $jadwalId,
                        'user_nim' => $user->nim ?? 'unknown'
                    ]);
                    return response()->json([
                        'message' => 'Token QR code tidak valid atau sudah expired. Silakan scan QR code yang baru.',
                        'code' => 'QR_TOKEN_INVALID'
                    ], 403);
                }

                $validToken = Cache::get($cacheKey);

                if (!$validToken || $validToken !== $token) {
                    Log::warning('Absensi ditolak: QR token tidak valid atau expired', [
                        'jadwal_id' => $jadwalId,
                        'user_nim' => $user->nim ?? 'unknown',
                        'token_provided' => substr($token, 0, 8) . '...'
                    ]);
                    return response()->json([
                        'message' => 'Token QR code tidak valid atau sudah expired. Silakan scan QR code yang baru.',
                        'code' => 'QR_TOKEN_EXPIRED'
                    ], 403);
                }

                // Token valid, hapus dari cache untuk mencegah penggunaan ulang
                Cache::forget($cacheKey);

                Log::info('QR token validated successfully for Non Blok Non CSR', [
                    'jadwal_id' => $jadwalId,
                    'user_nim' => $user->nim ?? 'unknown'
                ]);
            }

            $request->validate([
                'absensi' => 'required|array',
                'absensi.*.mahasiswa_nim' => 'required|string',
                'absensi.*.hadir' => 'required|boolean',
                'absensi.*.catatan' => 'nullable|string'
            ]);

            $absensiData = $request->input('absensi', []);

            // Get mahasiswa yang terdaftar di kelompok besar jadwal ini
            $mahasiswaTerdaftar = [];

            // Cek kelompok_besar_antara_id dulu (prioritas untuk semester antara)
            if ($jadwal->kelompok_besar_antara_id) {
                try {
                    $kelompokResponse = \App\Models\KelompokBesarAntara::find($jadwal->kelompok_besar_antara_id);
                    if ($kelompokResponse && $kelompokResponse->mahasiswa_ids) {
                        $mahasiswaIds = $kelompokResponse->mahasiswa_ids;
                        $mahasiswaList = User::whereIn('id', $mahasiswaIds)
                            ->where('role', 'mahasiswa')
                            ->get();
                        $mahasiswaTerdaftar = $mahasiswaList->pluck('nim')->toArray();
                    }
                } catch (\Exception $e) {
                    Log::error('Error fetching kelompok_besar_antara: ' . $e->getMessage());
                }
            } elseif ($jadwal->kelompok_besar_id) {
                // Get mahasiswa berdasarkan semester
                try {
                    $semester = $jadwal->kelompok_besar_id; // kelompok_besar_id menyimpan semester
                    $kelompokBesar = KelompokBesar::where('semester', $semester)->get();
                    $mahasiswaTerdaftar = $kelompokBesar->pluck('mahasiswa.nim')
                        ->filter()
                        ->unique()
                        ->values()
                        ->toArray();
                } catch (\Exception $e) {
                    Log::error('Error fetching kelompok_besar: ' . $e->getMessage());
                }
            }

            // Validasi NIM yang di-submit harus terdaftar di jadwal ini
            // Normalisasi NIM untuk perbandingan yang lebih robust
            $invalidNims = [];
            foreach ($absensiData as $absen) {
                $submittedNim = trim((string)($absen['mahasiswa_nim'] ?? ''));

                // Cek dengan perbandingan yang case-insensitive dan trimmed
                $isValid = false;
                foreach ($mahasiswaTerdaftar as $registeredNim) {
                    if (strtolower($registeredNim) === strtolower($submittedNim)) {
                        $isValid = true;
                        break;
                    }
                }

                if (!$isValid && !empty($submittedNim)) {
                    $invalidNims[] = $submittedNim;
                }
            }

            if (!empty($invalidNims)) {
                Log::warning('Absensi ditolak: mahasiswa tidak terdaftar', [
                    'invalid_nims' => $invalidNims,
                    'mahasiswa_terdaftar' => $mahasiswaTerdaftar
                ]);

                return response()->json([
                    'message' => 'Beberapa mahasiswa tidak terdaftar di jadwal ini: ' . implode(', ', $invalidNims),
                    'invalid_nims' => $invalidNims
                ], 422);
            }

            // Upsert absensi (update jika ada, insert jika belum ada)
            foreach ($absensiData as $absen) {
                AbsensiNonBlokNonCSR::updateOrCreate(
                    [
                        'jadwal_non_blok_non_csr_id' => $jadwalId,
                        'mahasiswa_nim' => $absen['mahasiswa_nim']
                    ],
                    [
                        'hadir' => $absen['hadir'] ?? false,
                        'catatan' => $absen['catatan'] ?? ''
                    ]
                );
            }

            // Get kembali semua absensi untuk response
            $absensi = AbsensiNonBlokNonCSR::where('jadwal_non_blok_non_csr_id', $jadwalId)
                ->get()
                ->keyBy('mahasiswa_nim')
                ->map(function ($item) {
                    return [
                        'hadir' => $item->hadir,
                        'catatan' => $item->catatan
                    ];
                })
                ->toArray();

            return response()->json([
                'message' => 'Absensi berhasil disimpan',
                'absensi' => $absensi
            ]);
        } catch (\Exception $e) {
            Log::error("Error saving absensi for Non Blok Non CSR: " . $e->getMessage());
            return response()->json(['message' => 'Gagal menyimpan absensi: ' . $e->getMessage()], 500);
        }
    }
}
