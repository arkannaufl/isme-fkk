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
                ->where(function ($q) use ($dosenId, $semesterType) {
                    // Kondisi 1: Dosen aktif (dosen_id = $dosenId)
                    $q->where('dosen_id', $dosenId);
                    
                    // Filter semester_type untuk kondisi 1
                    if ($semesterType === 'reguler') {
                        $q->whereNull('kelompok_besar_antara_id');
                    } elseif ($semesterType === 'antara') {
                        $q->whereNotNull('kelompok_besar_antara_id');
                    }
                })
                ->orWhere(function ($q) use ($dosenId, $semesterType) {
                    // Kondisi 2: Dosen lama/history ($dosenId ada di dosen_ids)
                    $q->whereNotNull('dosen_ids')
                        ->where(function ($subQ) use ($dosenId) {
                            // Coba beberapa metode untuk kompatibilitas
                            $subQ->whereRaw('JSON_CONTAINS(dosen_ids, ?)', [json_encode($dosenId)])
                                ->orWhereRaw('JSON_SEARCH(dosen_ids, "one", ?) IS NOT NULL', [$dosenId])
                                ->orWhereRaw('CAST(dosen_ids AS CHAR) LIKE ?', ['%"' . $dosenId . '"%'])
                                ->orWhereRaw('CAST(dosen_ids AS CHAR) LIKE ?', ['%' . $dosenId . '%']);
                        });
                    
                    // Filter semester_type untuk kondisi 2
                    if ($semesterType === 'reguler') {
                        $q->whereNull('kelompok_besar_antara_id');
                    } elseif ($semesterType === 'antara') {
                        $q->whereNotNull('kelompok_besar_antara_id');
                    }
                });

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
                if (!empty($item->dosen_ids)) {
                    $dosenIds = is_array($item->dosen_ids) ? $item->dosen_ids : json_decode($item->dosen_ids, true);
                    if (is_array($dosenIds) && in_array($dosenId, $dosenIds)) {
                        return true;
                    }
                }
                return false;
            });



            $formattedData = $jadwalData->map(function ($jadwal) use ($semesterType, $dosenId) {
                // Parse dosen_ids jika ada
                $dosenIds = [];
                if ($jadwal->dosen_ids) {
                    $dosenIds = is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true);
                    if (!is_array($dosenIds)) {
                        $dosenIds = [];
                    }
                }

                // PENTING: Tentukan apakah dosen ini adalah dosen aktif (dosen_id) atau hanya ada di history (dosen_ids)
                $isActiveDosen = ($jadwal->dosen_id == $dosenId);
                $isInHistory = false;
                if (!$isActiveDosen && !empty($dosenIds)) {
                    $isInHistory = in_array($dosenId, $dosenIds);
                }

                // Jika dosen hanya ada di history (sudah diganti), status harus "tidak_bisa" dan tidak bisa diubah
                $statusKonfirmasi = $jadwal->status_konfirmasi ?? 'belum_konfirmasi';
                if ($isInHistory && !$isActiveDosen) {
                    // Dosen lama yang sudah diganti: status tetap "tidak_bisa"
                    $statusKonfirmasi = 'tidak_bisa';
                }

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
                    'dosen_id' => $jadwal->dosen_id,
                    'dosen_ids' => $dosenIds,
                    'is_active_dosen' => $isActiveDosen, // Flag: apakah dosen ini adalah dosen aktif
                    'is_in_history' => $isInHistory, // Flag: apakah dosen ini hanya ada di history
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
                    'status_konfirmasi' => $statusKonfirmasi, // Status berdasarkan apakah dosen aktif atau history
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
            if (!$dosen) {
                return;
            }
            $dosenName = $dosen->name;

            $superAdmins = User::where('role', 'super_admin')->get();

            foreach ($superAdmins as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
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
        } catch (\Exception $e) {
            // Silently fail
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
                'jenis_baris' => 'required|in:materi,agenda,seminar_proposal,sidang_skripsi',
                'agenda' => 'nullable|string',
                'materi' => 'nullable|string',
                'dosen_id' => 'nullable|exists:users,id',
                'dosen_ids' => 'nullable|array',
                'pembimbing_id' => 'nullable|exists:users,id',
                'komentator_ids' => 'nullable|array|max:2',
                'komentator_ids.*' => 'exists:users,id',
                'penguji_ids' => 'nullable|array|max:2',
                'penguji_ids.*' => 'exists:users,id',
                'mahasiswa_nims' => 'nullable|array',
                'mahasiswa_nims.*' => 'string',
                'ruangan_id' => 'nullable|exists:ruangan,id',
                'kelompok_besar_id' => 'nullable|integer',
                'kelompok_besar_antara_id' => 'nullable|exists:kelompok_besar_antara,id',
                'use_ruangan' => 'boolean'
            ]);

            // Validasi: Cek apakah ada dosen yang sama di pembimbing dan komentator (untuk Seminar Proposal)
            if ($request->jenis_baris === 'seminar_proposal') {
                if ($request->pembimbing_id && !empty($request->komentator_ids)) {
                    $duplicateIds = array_intersect([$request->pembimbing_id], $request->komentator_ids);
                    if (!empty($duplicateIds)) {
                        $duplicateNames = \App\Models\User::whereIn('id', $duplicateIds)->pluck('name')->toArray();
                        return response()->json([
                            'message' => 'Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Komentator: ' . implode(', ', $duplicateNames)
                        ], 422);
                    }
                }
            }

            // Validasi: Cek apakah ada dosen yang sama di pembimbing dan penguji (untuk Sidang Skripsi)
            if ($request->jenis_baris === 'sidang_skripsi') {
                if ($request->pembimbing_id && !empty($request->penguji_ids)) {
                    $duplicateIds = array_intersect([$request->pembimbing_id], $request->penguji_ids);
                    if (!empty($duplicateIds)) {
                        $duplicateNames = \App\Models\User::whereIn('id', $duplicateIds)->pluck('name')->toArray();
                        return response()->json([
                            'message' => 'Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Penguji: ' . implode(', ', $duplicateNames)
                        ], 422);
                    }
                }
            }

            // Validasi kapasitas ruangan untuk jenis materi dan agenda (jika menggunakan ruangan)
            if ($request->ruangan_id && ($request->use_ruangan ?? true)) {
                if ($request->jenis_baris === 'seminar_proposal') {
                    // Untuk seminar proposal: hitung pembimbing (1) + komentator + mahasiswa
                    $jumlahPembimbing = $request->pembimbing_id ? 1 : 0;
                    $jumlahKomentator = count($request->komentator_ids ?? []);
                    $jumlahMahasiswa = count($request->mahasiswa_nims ?? []);
                    $totalPeserta = $jumlahPembimbing + $jumlahKomentator + $jumlahMahasiswa;
                    
                    if ($totalPeserta > 0) {
                        // Optimized: Use cache for ruangan lookup
                        $cacheKey = 'ruangan_' . $request->ruangan_id;
                        $ruangan = Cache::remember($cacheKey, 3600, function () use ($request) {
                            return \App\Models\Ruangan::find($request->ruangan_id, ['id', 'nama', 'kapasitas']);
                        });
                        if ($ruangan && $totalPeserta > $ruangan->kapasitas) {
                            $detailPeserta = [];
                            if ($jumlahPembimbing > 0) $detailPeserta[] = "{$jumlahPembimbing} pembimbing";
                            if ($jumlahKomentator > 0) $detailPeserta[] = "{$jumlahKomentator} komentator";
                            if ($jumlahMahasiswa > 0) $detailPeserta[] = "{$jumlahMahasiswa} mahasiswa";
                            $detailPesertaStr = implode(" + ", $detailPeserta);
                            
                            return response()->json([
                                'message' => "Kapasitas ruangan {$ruangan->nama} ({$ruangan->kapasitas}) tidak cukup untuk {$totalPeserta} orang ({$detailPesertaStr})."
                            ], 422);
                        }
                    }
                } elseif ($request->jenis_baris === 'sidang_skripsi') {
                    // Untuk sidang skripsi: hitung pembimbing (1) + penguji + mahasiswa
                    $jumlahPembimbing = $request->pembimbing_id ? 1 : 0;
                    $jumlahPenguji = count($request->penguji_ids ?? []);
                    $jumlahMahasiswa = count($request->mahasiswa_nims ?? []);
                    $totalPeserta = $jumlahPembimbing + $jumlahPenguji + $jumlahMahasiswa;
                    
                    if ($totalPeserta > 0) {
                        // Optimized: Use cache for ruangan lookup
                        $cacheKey = 'ruangan_' . $request->ruangan_id;
                        $ruangan = Cache::remember($cacheKey, 3600, function () use ($request) {
                            return \App\Models\Ruangan::find($request->ruangan_id, ['id', 'nama', 'kapasitas']);
                        });
                        if ($ruangan && $totalPeserta > $ruangan->kapasitas) {
                            $detailPeserta = [];
                            if ($jumlahPembimbing > 0) $detailPeserta[] = "{$jumlahPembimbing} pembimbing";
                            if ($jumlahPenguji > 0) $detailPeserta[] = "{$jumlahPenguji} penguji";
                            if ($jumlahMahasiswa > 0) $detailPeserta[] = "{$jumlahMahasiswa} mahasiswa";
                            $detailPesertaStr = implode(" + ", $detailPeserta);
                            
                            return response()->json([
                                'message' => "Kapasitas ruangan {$ruangan->nama} ({$ruangan->kapasitas}) tidak cukup untuk {$totalPeserta} orang ({$detailPesertaStr})."
                            ], 422);
                        }
                    }
                } elseif ($request->kelompok_besar_id) {
                    // Untuk materi: hitung mahasiswa + 1 dosen
                    // Untuk agenda: hitung mahasiswa saja (tidak ada dosen)
                    $includeDosen = $request->jenis_baris === 'materi';
                    $capacityError = $this->validateRuanganCapacity($request->ruangan_id, $request->kelompok_besar_id, $includeDosen);
                    if ($capacityError) {
                        return response()->json([
                            'message' => $capacityError
                        ], 422);
                    }
                }
            }

            // Validasi bentrok dengan jadwal lain
            $dataForBentrokCheck = [
                'mata_kuliah_kode' => $kode,
                'tanggal' => $request->tanggal,
                'jam_mulai' => $request->jam_mulai,
                'jam_selesai' => $request->jam_selesai,
                'dosen_id' => $request->dosen_id,
                'pembimbing_id' => $request->pembimbing_id,
                'komentator_ids' => $request->komentator_ids,
                'penguji_ids' => $request->penguji_ids,
                'ruangan_id' => $request->ruangan_id,
                'kelompok_besar_id' => $request->kelompok_besar_id,
                'mahasiswa_nims' => $request->mahasiswa_nims,
                'jenis_baris' => $request->jenis_baris,
            ];
            $bentrokMessage = $this->checkBentrokWithDetail($dataForBentrokCheck, null);
            if ($bentrokMessage) {
                return response()->json([
                    'message' => $bentrokMessage
                ], 422);
            }

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
                'pembimbing_id' => $request->pembimbing_id,
                'komentator_ids' => $request->komentator_ids,
                'penguji_ids' => $request->penguji_ids,
                'mahasiswa_nims' => $request->mahasiswa_nims,
                'ruangan_id' => $request->ruangan_id,
                'kelompok_besar_id' => $request->kelompok_besar_id,
                'kelompok_besar_antara_id' => $request->kelompok_besar_antara_id,
                'use_ruangan' => $request->use_ruangan ?? true,
                'status_konfirmasi' => 'belum_konfirmasi'
            ]);

            // Load relationships for notifications
            $jadwal->load(['mataKuliah', 'dosen', 'ruangan', 'createdBy']);

            activity()
                ->log('Jadwal Non Blok Non CSR created');

            $this->sendJadwalNotifications($jadwal);
            $this->sendNotificationToMahasiswa($jadwal);

            return response()->json([
                'message' => 'Jadwal Non Blok Non CSR berhasil ditambahkan',
                'data' => $jadwal
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            // Tangani validation errors
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            // Tangani error lainnya
            $errorMessage = $e->getMessage();
            // Jika error message sudah jelas, gunakan langsung
            if (str_contains($errorMessage, 'The selected jenis baris is invalid')) {
                return response()->json([
                    'message' => 'Jenis jadwal tidak valid. Pastikan jenis jadwal yang dipilih sesuai.',
                    'error' => $errorMessage
                ], 422);
            }
            
            return response()->json([
                'message' => 'Gagal menambahkan jadwal Non Blok Non CSR',
                'error' => $errorMessage
            ], 500);
        }
    }

    private function sendJadwalNotifications($jadwal)
    {
        try {
            // Ensure relationships are loaded
            if (!$jadwal->relationLoaded('mataKuliah')) {
                $jadwal->load('mataKuliah');
            }
            if (!$jadwal->relationLoaded('ruangan')) {
                $jadwal->load('ruangan');
            }
            if (!$jadwal->relationLoaded('createdBy')) {
                $jadwal->load('createdBy');
            }

            $dosenIds = [];

            if ($jadwal->dosen_id) {
                $dosenIds[] = $jadwal->dosen_id;
            }

            if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
                $dosenIds = array_merge($dosenIds, $jadwal->dosen_ids);
            }

            $dosenIds = array_unique($dosenIds);

            if (empty($dosenIds)) {
                return;
            }

            // Load all dosen in one query
            $dosenList = User::whereIn('id', $dosenIds)->get()->keyBy('id');
            $createdBy = $jadwal->createdBy;
                $mataKuliah = $jadwal->mataKuliah;
                $ruangan = $jadwal->ruangan;

            $baseMessage = "Anda telah di-assign untuk mengajar Non Blok Non CSR {$mataKuliah->nama} pada tanggal {$jadwal->tanggal->format('d/m/Y')} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai}";
                if ($ruangan && $jadwal->use_ruangan) {
                $baseMessage .= " di ruangan {$ruangan->nama}";
            }
            $baseMessage .= ". Silakan konfirmasi ketersediaan Anda.";

            $baseData = [
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
                'created_by' => $createdBy ? $createdBy->name : 'Admin',
                'created_by_role' => $createdBy ? $createdBy->role : 'admin',
                'sender_name' => $createdBy ? $createdBy->name : 'Admin',
                'sender_role' => $createdBy ? $createdBy->role : 'admin'
            ];

            foreach ($dosenIds as $dosenId) {
                $dosen = $dosenList->get($dosenId);
                if (!$dosen) continue;

                Notification::create([
                    'user_id' => $dosenId,
                    'title' => 'Jadwal Non Blok Non CSR Baru',
                    'message' => $baseMessage,
                    'type' => 'info',
                    'data' => array_merge($baseData, [
                        'dosen_id' => $dosen->id,
                        'dosen_name' => $dosen->name,
                        'dosen_role' => $dosen->role
                    ])
                ]);
            }
        } catch (\Exception $e) {
            // Silently fail
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
                'jenis_baris' => 'required|in:materi,agenda,seminar_proposal,sidang_skripsi',
                'agenda' => 'nullable|string',
                'materi' => 'nullable|string',
                'dosen_id' => 'nullable|exists:users,id',
                'dosen_ids' => 'nullable|array',
                'pembimbing_id' => 'nullable|exists:users,id',
                'komentator_ids' => 'nullable|array|max:2',
                'komentator_ids.*' => 'exists:users,id',
                'penguji_ids' => 'nullable|array|max:2',
                'penguji_ids.*' => 'exists:users,id',
                'mahasiswa_nims' => 'nullable|array',
                'mahasiswa_nims.*' => 'string',
                'ruangan_id' => 'nullable|exists:ruangan,id',
                'kelompok_besar_id' => 'nullable|integer',
                'kelompok_besar_antara_id' => 'nullable|exists:kelompok_besar_antara,id',
                'use_ruangan' => 'boolean'
            ]);

            $jadwal = JadwalNonBlokNonCSR::where('id', $id)
                ->where('mata_kuliah_kode', $kode)
                ->firstOrFail();

            // Validasi: Cek apakah ada dosen yang sama di pembimbing dan komentator (untuk Seminar Proposal)
            if ($request->jenis_baris === 'seminar_proposal') {
                if ($request->pembimbing_id && !empty($request->komentator_ids)) {
                    $duplicateIds = array_intersect([$request->pembimbing_id], $request->komentator_ids);
                    if (!empty($duplicateIds)) {
                        $duplicateNames = \App\Models\User::whereIn('id', $duplicateIds)->pluck('name')->toArray();
                        return response()->json([
                            'message' => 'Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Komentator: ' . implode(', ', $duplicateNames)
                        ], 422);
                    }
                }
            }

            // Validasi: Cek apakah ada dosen yang sama di pembimbing dan penguji (untuk Sidang Skripsi)
            if ($request->jenis_baris === 'sidang_skripsi') {
                if ($request->pembimbing_id && !empty($request->penguji_ids)) {
                    $duplicateIds = array_intersect([$request->pembimbing_id], $request->penguji_ids);
                    if (!empty($duplicateIds)) {
                        $duplicateNames = \App\Models\User::whereIn('id', $duplicateIds)->pluck('name')->toArray();
                        return response()->json([
                            'message' => 'Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Penguji: ' . implode(', ', $duplicateNames)
                        ], 422);
                    }
                }
            }

            // Validasi kapasitas ruangan untuk jenis materi dan agenda (jika menggunakan ruangan)
            if ($request->ruangan_id && ($request->use_ruangan ?? true)) {
                if ($request->jenis_baris === 'seminar_proposal' || $request->jenis_baris === 'sidang_skripsi') {
                    // Untuk seminar proposal: hitung pembimbing (1) + komentator + mahasiswa
                    // Untuk sidang skripsi: hitung pembimbing (1) + penguji + mahasiswa
                    $jumlahPembimbing = $request->pembimbing_id ? 1 : 0;
                    $jumlahKomentator = count($request->komentator_ids ?? []);
                    $jumlahPenguji = count($request->penguji_ids ?? []);
                    $jumlahMahasiswa = count($request->mahasiswa_nims ?? []);
                    $totalPeserta = $jumlahPembimbing + ($request->jenis_baris === 'seminar_proposal' ? $jumlahKomentator : $jumlahPenguji) + $jumlahMahasiswa;
                    
                    if ($totalPeserta > 0) {
                        // Optimized: Use cache for ruangan lookup
                        $cacheKey = 'ruangan_' . $request->ruangan_id;
                        $ruangan = Cache::remember($cacheKey, 3600, function () use ($request) {
                            return \App\Models\Ruangan::find($request->ruangan_id, ['id', 'nama', 'kapasitas']);
                        });
                        if ($ruangan && $totalPeserta > $ruangan->kapasitas) {
                            $detailPeserta = [];
                            if ($jumlahPembimbing > 0) $detailPeserta[] = "{$jumlahPembimbing} pembimbing";
                            if ($request->jenis_baris === 'seminar_proposal' && $jumlahKomentator > 0) {
                                $detailPeserta[] = "{$jumlahKomentator} komentator";
                            } elseif ($request->jenis_baris === 'sidang_skripsi' && $jumlahPenguji > 0) {
                                $detailPeserta[] = "{$jumlahPenguji} penguji";
                            }
                            if ($jumlahMahasiswa > 0) $detailPeserta[] = "{$jumlahMahasiswa} mahasiswa";
                            $detailPesertaStr = implode(" + ", $detailPeserta);
                            
                            return response()->json([
                                'message' => "Kapasitas ruangan {$ruangan->nama} ({$ruangan->kapasitas}) tidak cukup untuk {$totalPeserta} orang ({$detailPesertaStr})."
                            ], 422);
                        }
                    }
                } elseif ($request->kelompok_besar_id) {
                    // Untuk materi: hitung mahasiswa + 1 dosen
                    // Untuk agenda: hitung mahasiswa saja (tidak ada dosen)
                    $includeDosen = $request->jenis_baris === 'materi';
                    $capacityError = $this->validateRuanganCapacity($request->ruangan_id, $request->kelompok_besar_id, $includeDosen);
                    if ($capacityError) {
                        return response()->json([
                            'message' => $capacityError
                        ], 422);
                    }
                }
            }

            // Validasi bentrok dengan jadwal lain (exclude jadwal yang sedang di-update)
            $dataForBentrokCheck = [
                'mata_kuliah_kode' => $kode,
                'tanggal' => $request->tanggal,
                'jam_mulai' => $request->jam_mulai,
                'jam_selesai' => $request->jam_selesai,
                'dosen_id' => $request->dosen_id,
                'pembimbing_id' => $request->pembimbing_id,
                'komentator_ids' => $request->komentator_ids,
                'penguji_ids' => $request->penguji_ids,
                'ruangan_id' => $request->ruangan_id,
                'kelompok_besar_id' => $request->kelompok_besar_id,
                'mahasiswa_nims' => $request->mahasiswa_nims,
                'jenis_baris' => $request->jenis_baris,
            ];
            $bentrokMessage = $this->checkBentrokWithDetail($dataForBentrokCheck, $id);
            if ($bentrokMessage) {
                return response()->json([
                    'message' => $bentrokMessage
                ], 422);
            }

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
                'pembimbing_id' => $request->pembimbing_id,
                'komentator_ids' => $request->komentator_ids,
                'penguji_ids' => $request->penguji_ids,
                'mahasiswa_nims' => $request->mahasiswa_nims,
                'ruangan_id' => $request->ruangan_id,
                'kelompok_besar_id' => $request->kelompok_besar_id,
                'kelompok_besar_antara_id' => $request->kelompok_besar_antara_id,
                'use_ruangan' => $request->use_ruangan ?? true,
            ]);

            return response()->json([
                'message' => 'Jadwal Non Blok Non CSR berhasil diperbarui',
                'data' => $jadwal
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            // Tangani validation errors
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            // Tangani error lainnya
            $errorMessage = $e->getMessage();
            // Jika error message sudah jelas, gunakan langsung
            if (str_contains($errorMessage, 'The selected jenis baris is invalid')) {
                return response()->json([
                    'message' => 'Jenis jadwal tidak valid. Pastikan jenis jadwal yang dipilih sesuai.',
                    'error' => $errorMessage
                ], 422);
            }
            
            return response()->json([
                'message' => 'Gagal memperbarui jadwal Non Blok Non CSR',
                'error' => $errorMessage
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
            if (!$jadwal->relationLoaded('dosen')) {
                $jadwal->load('dosen');
            }
            $dosen = $jadwal->dosen;

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
                'data.*.jenis_baris' => 'required|in:materi,agenda,seminar_proposal,sidang_skripsi',
                'data.*.penguji_ids' => 'nullable|array|max:2',
                'data.*.penguji_ids.*' => 'exists:users,id',
                'data.*.jumlah_sesi' => 'required|integer|min:1|max:6',
                'data.*.kelompok_besar_id' => 'nullable|integer',
                'data.*.dosen_id' => 'nullable|exists:users,id',
                'data.*.pembimbing_id' => 'nullable|exists:users,id',
                'data.*.komentator_ids' => 'nullable|array|max:2',
                'data.*.komentator_ids.*' => 'exists:users,id',
                'data.*.mahasiswa_nims' => 'nullable|array',
                'data.*.mahasiswa_nims.*' => 'string',
                'data.*.materi' => 'nullable|string',
                'data.*.ruangan_id' => 'nullable|exists:ruangan,id',
                'data.*.agenda' => 'nullable|string',
                'data.*.use_ruangan' => 'boolean'
            ]);

            // Optimized: Use cache for frequently accessed mata kuliah data
            $cacheKey = 'mata_kuliah_' . $kode;
            $mataKuliah = Cache::remember($cacheKey, 3600, function () use ($kode) {
                return \App\Models\MataKuliah::where('kode', $kode)->first();
            });
            if (!$mataKuliah) {
                return response()->json([
                    'message' => 'Mata kuliah tidak ditemukan'
                ], 404);
            }


            $errors = [];
            $excelData = $request->data;

            // Pre-load semua dosen dan ruangan yang diperlukan untuk optimisasi performa
            $dosenIds = array_filter(array_column($excelData, 'dosen_id'));
            $ruanganIds = array_filter(array_column($excelData, 'ruangan_id'));
            $dosenList = !empty($dosenIds) ? \App\Models\User::whereIn('id', $dosenIds)->get()->keyBy('id') : collect();
            $ruanganList = !empty($ruanganIds) ? \App\Models\Ruangan::whereIn('id', $ruanganIds)->get()->keyBy('id') : collect();

            // Validasi semua data terlebih dahulu (all-or-nothing approach)
            foreach ($excelData as $index => $row) {
                try {
                    // Validasi tanggal dalam rentang mata kuliah
                    $tanggal = Carbon::parse($row['tanggal']);
                    if ($tanggal < Carbon::parse($mataKuliah->tanggal_mulai) || $tanggal > Carbon::parse($mataKuliah->tanggal_akhir)) {
                        $errors[] = "Baris " . ($index + 1) . ": Tanggal di luar rentang mata kuliah";
                        continue;
                    }

                    // Validasi khusus untuk jenis materi
                    if ($row['jenis_baris'] === 'materi') {
                        if (!$row['dosen_id']) {
                            $errors[] = "Baris " . ($index + 1) . ": Dosen wajib diisi untuk jenis materi";
                            continue;
                        }
                        if (!$row['materi']) {
                            $errors[] = "Baris " . ($index + 1) . ": Materi wajib diisi untuk jenis materi";
                            continue;
                        }
                        if (!$row['ruangan_id']) {
                            $errors[] = "Baris " . ($index + 1) . ": Ruangan wajib diisi untuk jenis materi";
                            continue;
                        }
                    }

                    // Validasi khusus untuk jenis agenda
                    if ($row['jenis_baris'] === 'agenda') {
                        if (!$row['agenda']) {
                            $errors[] = "Baris " . ($index + 1) . ": Agenda wajib diisi untuk jenis agenda";
                            continue;
                        }
                    }

                    // Validasi khusus untuk jenis seminar_proposal
                    if ($row['jenis_baris'] === 'seminar_proposal') {
                        if (!$row['pembimbing_id']) {
                            $errors[] = "Baris " . ($index + 1) . ": Pembimbing wajib diisi untuk Seminar Proposal";
                            continue;
                        }
                        if (empty($row['komentator_ids']) || count($row['komentator_ids']) === 0) {
                            $errors[] = "Baris " . ($index + 1) . ": Komentator wajib diisi (minimal 1) untuk Seminar Proposal";
                            continue;
                        }
                        if (count($row['komentator_ids']) > 2) {
                            $errors[] = "Baris " . ($index + 1) . ": Komentator maksimal 2 untuk Seminar Proposal";
                            continue;
                        }
                        // Validasi: Cek apakah ada dosen yang sama di pembimbing dan komentator
                        if ($row['pembimbing_id'] && !empty($row['komentator_ids'])) {
                            $duplicateIds = array_intersect([$row['pembimbing_id']], $row['komentator_ids']);
                            if (!empty($duplicateIds)) {
                                $duplicateNames = \App\Models\User::whereIn('id', $duplicateIds)->pluck('name')->toArray();
                                $errors[] = "Baris " . ($index + 1) . ": Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Komentator: " . implode(', ', $duplicateNames);
                                continue;
                            }
                        }
                        if (empty($row['mahasiswa_nims']) || count($row['mahasiswa_nims']) === 0) {
                            $errors[] = "Baris " . ($index + 1) . ": Mahasiswa wajib diisi (minimal 1) untuk Seminar Proposal";
                            continue;
                        }
                    }

                    // Validasi khusus untuk jenis sidang_skripsi
                    if ($row['jenis_baris'] === 'sidang_skripsi') {
                        if (!$row['pembimbing_id']) {
                            $errors[] = "Baris " . ($index + 1) . ": Pembimbing wajib diisi untuk Sidang Skripsi";
                            continue;
                        }
                        if (empty($row['penguji_ids']) || count($row['penguji_ids']) === 0) {
                            $errors[] = "Baris " . ($index + 1) . ": Penguji wajib diisi (minimal 1) untuk Sidang Skripsi";
                            continue;
                        }
                        if (count($row['penguji_ids']) > 2) {
                            $errors[] = "Baris " . ($index + 1) . ": Penguji maksimal 2 untuk Sidang Skripsi";
                            continue;
                        }
                        // Validasi: Cek apakah ada dosen yang sama di pembimbing dan penguji
                        if ($row['pembimbing_id'] && !empty($row['penguji_ids'])) {
                            $duplicateIds = array_intersect([$row['pembimbing_id']], $row['penguji_ids']);
                            if (!empty($duplicateIds)) {
                                $duplicateNames = \App\Models\User::whereIn('id', $duplicateIds)->pluck('name')->toArray();
                                $errors[] = "Baris " . ($index + 1) . ": Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Penguji: " . implode(', ', $duplicateNames);
                                continue;
                            }
                        }
                        if (empty($row['mahasiswa_nims']) || count($row['mahasiswa_nims']) === 0) {
                            $errors[] = "Baris " . ($index + 1) . ": Mahasiswa wajib diisi (minimal 1) untuk Sidang Skripsi";
                            continue;
                        }
                    }

                    // Validasi kelompok besar sesuai semester (hanya untuk materi dan agenda, bukan seminar_proposal atau sidang_skripsi)
                    if ($row['jenis_baris'] !== 'seminar_proposal' && $row['jenis_baris'] !== 'sidang_skripsi' && isset($row['kelompok_besar_id']) && $row['kelompok_besar_id']) {
                        // kelompok_besar_id yang dikirim dari frontend adalah semester
                        $semesterKelompokBesar = $row['kelompok_besar_id'];

                        // Cek apakah ada kelompok besar untuk semester tersebut
                        $kelompokBesarExists = KelompokBesar::where('semester', $semesterKelompokBesar)->exists();
                        if (!$kelompokBesarExists) {
                            $errors[] = "Baris " . ($index + 1) . ": Kelompok besar semester {$semesterKelompokBesar} tidak ditemukan";
                            continue;
                        }

                        // Cek apakah semester kelompok besar sesuai dengan semester mata kuliah
                        if ($semesterKelompokBesar != $mataKuliah->semester) {
                            $errors[] = "Baris " . ($index + 1) . ": Kelompok besar semester {$semesterKelompokBesar} tidak sesuai dengan semester mata kuliah ({$mataKuliah->semester}). Hanya boleh menggunakan kelompok besar semester {$mataKuliah->semester}.";
                            continue;
                        }
                    }

                    // Validasi bentrok dengan semua jadwal (mempertimbangkan semester)
                    $row['mata_kuliah_kode'] = $kode;
                    $rowForBentrok = [
                        'mata_kuliah_kode' => $kode,
                        'tanggal' => $row['tanggal'],
                        'jam_mulai' => $row['jam_mulai'],
                        'jam_selesai' => $row['jam_selesai'],
                        'dosen_id' => $row['dosen_id'] ?? null,
                        'pembimbing_id' => $row['pembimbing_id'] ?? null,
                        'komentator_ids' => $row['komentator_ids'] ?? null,
                        'penguji_ids' => $row['penguji_ids'] ?? null,
                        'ruangan_id' => $row['ruangan_id'] ?? null,
                        'kelompok_besar_id' => $row['kelompok_besar_id'] ?? null,
                        'mahasiswa_nims' => $row['mahasiswa_nims'] ?? null,
                        'jenis_baris' => $row['jenis_baris'],
                    ];
                    $bentrokMessage = $this->checkBentrokWithDetail($rowForBentrok, null);
                    if ($bentrokMessage) {
                        $errors[] = "Baris " . ($index + 1) . ": " . $bentrokMessage;
                        continue;
                    }

                    // Validasi kapasitas ruangan (untuk materi, agenda, seminar_proposal, dan sidang_skripsi jika menggunakan ruangan)
                    if ($row['ruangan_id'] && ($row['use_ruangan'] ?? true)) {
                        if ($row['jenis_baris'] === 'seminar_proposal' || $row['jenis_baris'] === 'sidang_skripsi') {
                            // Untuk seminar proposal: hitung pembimbing (1) + komentator + mahasiswa
                            // Untuk sidang skripsi: hitung pembimbing (1) + penguji + mahasiswa
                            $jumlahPembimbing = isset($row['pembimbing_id']) && $row['pembimbing_id'] ? 1 : 0;
                            $jumlahKomentator = count($row['komentator_ids'] ?? []);
                            $jumlahPenguji = count($row['penguji_ids'] ?? []);
                            $jumlahMahasiswa = count($row['mahasiswa_nims'] ?? []);
                            $totalPeserta = $jumlahPembimbing + ($row['jenis_baris'] === 'seminar_proposal' ? $jumlahKomentator : $jumlahPenguji) + $jumlahMahasiswa;
                            
                            if ($totalPeserta > 0) {
                                // Optimized: Use pre-loaded ruanganList instead of individual query
                                $ruangan = $ruanganList->get($row['ruangan_id']);
                                if ($ruangan && $totalPeserta > $ruangan->kapasitas) {
                                    $detailPeserta = [];
                                    if ($jumlahPembimbing > 0) $detailPeserta[] = "{$jumlahPembimbing} pembimbing";
                                    if ($row['jenis_baris'] === 'seminar_proposal' && $jumlahKomentator > 0) {
                                        $detailPeserta[] = "{$jumlahKomentator} komentator";
                                    } elseif ($row['jenis_baris'] === 'sidang_skripsi' && $jumlahPenguji > 0) {
                                        $detailPeserta[] = "{$jumlahPenguji} penguji";
                                    }
                                    if ($jumlahMahasiswa > 0) $detailPeserta[] = "{$jumlahMahasiswa} mahasiswa";
                                    $detailPesertaStr = implode(" + ", $detailPeserta);
                                    
                                    $errors[] = "Baris " . ($index + 1) . ": Kapasitas ruangan {$ruangan->nama} ({$ruangan->kapasitas}) tidak cukup untuk {$totalPeserta} orang ({$detailPesertaStr}).";
                                    continue;
                                }
                            }
                        } elseif ($row['jenis_baris'] !== 'seminar_proposal' && $row['jenis_baris'] !== 'sidang_skripsi' && isset($row['kelompok_besar_id']) && $row['kelompok_besar_id']) {
                        // kelompok_besar_id yang dikirim dari frontend adalah semester
                        $semesterKelompokBesar = $row['kelompok_besar_id'];
                        
                            // Untuk materi: hitung mahasiswa + 1 dosen
                            // Untuk agenda: hitung mahasiswa saja (tidak ada dosen)
                            $includeDosen = ($row['jenis_baris'] ?? 'materi') === 'materi';
                            
                            // Validasi kapasitas ruangan (method validateRuanganCapacity mengharapkan semester, bukan ID)
                            $capacityError = $this->validateRuanganCapacity($row['ruangan_id'], $semesterKelompokBesar, $includeDosen);
                            if ($capacityError) {
                                $errors[] = "Baris " . ($index + 1) . ": " . $capacityError;
                                continue;
                            }
                        }
                    }

                    // Validasi bentrok antar data yang sedang di-import
                    for ($j = 0; $j < $index; $j++) {
                        $previousData = $excelData[$j];
                        $bentrokInfo = $this->isDataBentrok($row, $previousData);
                        if ($bentrokInfo) {
                            // Tentukan jenis bentrok dan detail
                            $bentrokTypes = [];
                            $conflictDetails = [];
                            
                            if ($bentrokInfo['dosen']) {
                                $bentrokTypes[] = 'dosen';
                                $dosenName = $row['dosen_id'] && $dosenList->has($row['dosen_id']) 
                                    ? $dosenList->get($row['dosen_id'])->name 
                                    : 'N/A';
                                $conflictDetails[] = 'Dosen: ' . $dosenName;
                            }
                            
                            if ($bentrokInfo['pembimbing_komentator']) {
                                $bentrokTypes[] = 'pembimbing/komentator';
                                $pembimbingKomentatorNames = [];
                                if (isset($row['pembimbing_id']) && $row['pembimbing_id'] && $dosenList->has($row['pembimbing_id'])) {
                                    $pembimbingKomentatorNames[] = $dosenList->get($row['pembimbing_id'])->name . ' (Pembimbing)';
                                }
                                if (isset($row['komentator_ids']) && is_array($row['komentator_ids'])) {
                                    foreach ($row['komentator_ids'] as $komentatorId) {
                                        if ($dosenList->has($komentatorId)) {
                                            $pembimbingKomentatorNames[] = $dosenList->get($komentatorId)->name . ' (Komentator)';
                                        }
                                    }
                                }
                                if (!empty($pembimbingKomentatorNames)) {
                                    $conflictDetails[] = 'Pembimbing/Komentator: ' . implode(', ', $pembimbingKomentatorNames);
                                }
                            }
                            
                            if ($bentrokInfo['pembimbing_penguji']) {
                                $bentrokTypes[] = 'pembimbing/penguji';
                                $pembimbingPengujiNames = [];
                                if (isset($row['pembimbing_id']) && $row['pembimbing_id'] && $dosenList->has($row['pembimbing_id'])) {
                                    $pembimbingPengujiNames[] = $dosenList->get($row['pembimbing_id'])->name . ' (Pembimbing)';
                                }
                                if (isset($row['penguji_ids']) && is_array($row['penguji_ids'])) {
                                    foreach ($row['penguji_ids'] as $pengujiId) {
                                        if ($dosenList->has($pengujiId)) {
                                            $pembimbingPengujiNames[] = $dosenList->get($pengujiId)->name . ' (Penguji)';
                                        }
                                    }
                                }
                                if (!empty($pembimbingPengujiNames)) {
                                    $conflictDetails[] = 'Pembimbing/Penguji: ' . implode(', ', $pembimbingPengujiNames);
                                }
                            }
                            
                            if ($bentrokInfo['mahasiswa']) {
                                $bentrokTypes[] = 'mahasiswa';
                                // Ambil nama mahasiswa yang bentrok (bukan NIM)
                                $mahasiswaNames = [];
                                if (isset($row['mahasiswa_nims']) && is_array($row['mahasiswa_nims']) && !empty($row['mahasiswa_nims'])) {
                                    // Query nama mahasiswa dari database berdasarkan NIM
                                    $mahasiswaList = \App\Models\User::where('role', 'mahasiswa')
                                        ->whereIn('nim', $row['mahasiswa_nims'])
                                        ->pluck('name', 'nim')
                                        ->toArray();
                                    
                                    // Ambil nama mahasiswa yang bentrok (dari intersection dengan previousData)
                                    $previousMahasiswaNims = isset($previousData['mahasiswa_nims']) && is_array($previousData['mahasiswa_nims']) ? $previousData['mahasiswa_nims'] : [];
                                    $intersectionNims = array_intersect($row['mahasiswa_nims'], $previousMahasiswaNims);
                                    
                                    foreach ($intersectionNims as $nim) {
                                        if (isset($mahasiswaList[$nim])) {
                                            $mahasiswaNames[] = $mahasiswaList[$nim];
                                        } else {
                                            $mahasiswaNames[] = $nim; // Fallback jika nama tidak ditemukan
                                        }
                                    }
                                    
                                    // Tampilkan semua nama mahasiswa tanpa truncate
                                }
                                if (!empty($mahasiswaNames)) {
                                    $conflictDetails[] = 'Mahasiswa: ' . implode(', ', $mahasiswaNames);
                                }
                            }
                            
                            if ($bentrokInfo['ruangan']) {
                                $bentrokTypes[] = 'ruangan';
                                $ruanganName = $row['ruangan_id'] && $ruanganList->has($row['ruangan_id']) 
                                    ? $ruanganList->get($row['ruangan_id'])->nama 
                                    : 'N/A';
                                $conflictDetails[] = 'Ruangan: ' . $ruanganName;
                            }
                            
                            if ($bentrokInfo['kelompok_besar']) {
                                $bentrokTypes[] = 'kelompok besar';
                            }
                            
                            $bentrokTypeStr = implode(', ', $bentrokTypes);
                            $conflictDetailsStr = !empty($conflictDetails) ? ' (' . implode(', ', $conflictDetails) . ')' : '';
                            
                            $errors[] = "Baris " . ($index + 1) . ": Jadwal bentrok dengan data pada baris " . ($j + 1) . ". Konflik pada: {$bentrokTypeStr}{$conflictDetailsStr}";
                            break;
                        }
                    }

                    // Jika semua validasi berhasil, data akan diimport setelah loop selesai
                } catch (\Exception $e) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $e->getMessage();
                }
            }

            // Jika ada error validasi, return status 422 dan tidak import data sama sekali (all-or-nothing)
            if (count($errors) > 0) {
                return response()->json([
                    'success' => false,
                    'total' => count($excelData),
                    'errors' => $errors,
                    'message' => "Gagal mengimport data. Semua data harus valid untuk dapat diimport."
                ], 422);
            }

            // Jika tidak ada error, import semua data menggunakan database transaction
            DB::beginTransaction();
            try {
                $importedCount = 0;
                foreach ($excelData as $index => $row) {
                    // Create jadwal
                    $jadwal = JadwalNonBlokNonCSR::create([
                        'mata_kuliah_kode' => $kode,
                        'created_by' => Auth::id(),
                        'tanggal' => $row['tanggal'],
                        'jam_mulai' => $row['jam_mulai'],
                        'jam_selesai' => $row['jam_selesai'],
                        'jumlah_sesi' => $row['jumlah_sesi'],
                        'jenis_baris' => $row['jenis_baris'],
                        'agenda' => $row['agenda'] ?? null,
                        'materi' => $row['materi'] ?? null,
                        'dosen_id' => $row['dosen_id'] ?? null,
                        'dosen_ids' => $row['dosen_ids'] ?? null,
                        'pembimbing_id' => $row['pembimbing_id'] ?? null,
                        'komentator_ids' => $row['komentator_ids'] ?? null,
                        'penguji_ids' => $row['penguji_ids'] ?? null,
                        'mahasiswa_nims' => $row['mahasiswa_nims'] ?? null,
                        'ruangan_id' => $row['ruangan_id'] ?? null,
                        'kelompok_besar_id' => $row['kelompok_besar_id'] ?? null,
                        'kelompok_besar_antara_id' => $row['kelompok_besar_antara_id'] ?? null,
                        'use_ruangan' => $row['use_ruangan'] ?? true,
                        'status_konfirmasi' => 'belum_konfirmasi'
                    ]);

                    // Load relationships for notifications
                    $jadwal->load(['mataKuliah', 'dosen', 'ruangan', 'createdBy']);

                    $this->sendJadwalNotifications($jadwal);
                    $importedCount++;
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
        } catch (\Exception $e) {
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            Log::error('Error importing jadwal Non Blok Non CSR: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan saat mengimport data: ' . $e->getMessage()
            ], 500);
        }
    }


    private function checkBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Ambil data mata kuliah untuk mendapatkan semester - optimized with cache
        $cacheKey = 'mata_kuliah_' . $data['mata_kuliah_kode'];
        $mataKuliah = Cache::remember($cacheKey, 3600, function () use ($data) {
            return \App\Models\MataKuliah::where('kode', $data['mata_kuliah_kode'])->first(['kode', 'semester']);
        });
        $semester = $mataKuliah ? $mataKuliah->semester : null;

        // Cek bentrok dengan jadwal Non Blok Non CSR (dengan filter semester)
        // Validasi realistis: bentrok jika tanggal sama, jam overlap, DAN minimal salah satu dari:
        // - dosen sama, ATAU
        // - ruangan sama, ATAU  
        // - kelompok besar sama
        $nonBlokNonCSRBentrok = JadwalNonBlokNonCSR::with(['mataKuliah', 'dosen', 'ruangan'])
            ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->where(function ($q) use ($data) {
                // Minimal salah satu dari: dosen sama, ruangan sama, atau kelompok besar sama
                // Gunakan nested where untuk OR logic
                $q->where(function ($subQ) use ($data) {
                    $hasAnyCondition = false;
                    
                    // Cek dosen sama (jika dosen_id ada)
                    if (isset($data['dosen_id']) && $data['dosen_id']) {
                        $subQ->where('dosen_id', $data['dosen_id']);
                        $hasAnyCondition = true;
                    }
                    
                    // Cek pembimbing sama dengan dosen di jadwal lain (untuk Seminar Proposal)
                    // Jika pembimbing_id ada, cek apakah ada jadwal lain yang memiliki dosen_id yang sama
                    if (isset($data['pembimbing_id']) && $data['pembimbing_id']) {
                        if ($hasAnyCondition) {
                            $subQ->orWhere('dosen_id', $data['pembimbing_id'])
                                 ->orWhere('pembimbing_id', $data['pembimbing_id']);
                        } else {
                            $subQ->where(function ($pembimbingQ) use ($data) {
                                $pembimbingQ->where('dosen_id', $data['pembimbing_id'])
                                           ->orWhere('pembimbing_id', $data['pembimbing_id']);
                            });
                            $hasAnyCondition = true;
                        }
                    }
                    
                    // Cek komentator sama dengan dosen di jadwal lain (untuk Seminar Proposal)
                    // Jika komentator_ids ada, cek apakah ada jadwal lain yang memiliki dosen_id yang sama dengan salah satu komentator
                    if (isset($data['komentator_ids']) && !empty($data['komentator_ids'])) {
                        foreach ($data['komentator_ids'] as $komentatorId) {
                            if ($hasAnyCondition) {
                                $subQ->orWhere('dosen_id', $komentatorId)
                                     ->orWhere('pembimbing_id', $komentatorId)
                                     ->orWhereJsonContains('komentator_ids', $komentatorId);
                            } else {
                                $subQ->where(function ($komentatorQ) use ($komentatorId) {
                                    $komentatorQ->where('dosen_id', $komentatorId)
                                                ->orWhere('pembimbing_id', $komentatorId)
                                                ->orWhereJsonContains('komentator_ids', $komentatorId);
                                });
                                $hasAnyCondition = true;
                            }
                        }
                    }
                    
                    // Cek penguji sama dengan dosen di jadwal lain (untuk Sidang Skripsi)
                    // Jika penguji_ids ada, cek apakah ada jadwal lain yang memiliki dosen_id yang sama dengan salah satu penguji
                    if (isset($data['penguji_ids']) && !empty($data['penguji_ids'])) {
                        foreach ($data['penguji_ids'] as $pengujiId) {
                            if ($hasAnyCondition) {
                                $subQ->orWhere('dosen_id', $pengujiId)
                                     ->orWhere('pembimbing_id', $pengujiId)
                                     ->orWhereJsonContains('komentator_ids', $pengujiId)
                                     ->orWhereJsonContains('penguji_ids', $pengujiId);
                            } else {
                                $subQ->where(function ($pengujiQ) use ($pengujiId) {
                                    $pengujiQ->where('dosen_id', $pengujiId)
                                             ->orWhere('pembimbing_id', $pengujiId)
                                             ->orWhereJsonContains('komentator_ids', $pengujiId)
                                             ->orWhereJsonContains('penguji_ids', $pengujiId);
                                });
                                $hasAnyCondition = true;
                            }
                        }
                    }
                    
                    // Cek ruangan sama (jika ruangan_id ada)
                    if (isset($data['ruangan_id']) && $data['ruangan_id']) {
                        if ($hasAnyCondition) {
                            $subQ->orWhere('ruangan_id', $data['ruangan_id']);
                        } else {
                            $subQ->where('ruangan_id', $data['ruangan_id']);
                            $hasAnyCondition = true;
                        }
                    }
                    
                    // Cek kelompok besar sama (jika kelompok_besar_id ada)
                    if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
                        if ($hasAnyCondition) {
                            $subQ->orWhere('kelompok_besar_id', $data['kelompok_besar_id']);
                        } else {
                            $subQ->where('kelompok_besar_id', $data['kelompok_besar_id']);
                            $hasAnyCondition = true;
                        }
                    }
                    
                    // Cek mahasiswa sama (untuk Seminar Proposal dan Sidang Skripsi)
                    // Cek overlap NIM dengan menggunakan whereJsonContains untuk setiap NIM
                    if (isset($data['mahasiswa_nims']) && !empty($data['mahasiswa_nims']) && isset($data['jenis_baris']) && ($data['jenis_baris'] === 'seminar_proposal' || $data['jenis_baris'] === 'sidang_skripsi')) {
                        foreach ($data['mahasiswa_nims'] as $nim) {
                            if ($hasAnyCondition) {
                                $subQ->orWhereJsonContains('mahasiswa_nims', $nim);
                            } else {
                                $subQ->whereJsonContains('mahasiswa_nims', $nim);
                                $hasAnyCondition = true;
                            }
                        }
                    }
                    
                    // Jika tidak ada kondisi sama sekali, tidak ada yang bisa bentrok
                    if (!$hasAnyCondition) {
                        $subQ->whereRaw('1 = 0'); // Always false
                    }
                });
            });
        
        if ($ignoreId) {
            $nonBlokNonCSRBentrok->where('id', '!=', $ignoreId);
        }
        
        // Ambil semua jadwal yang bentrok untuk mendapatkan yang paling relevan
        $conflicts = $nonBlokNonCSRBentrok->get();
        
        // Pastikan semua relasi ter-load
        if ($conflicts->count() > 0) {
            $conflicts->load(['mataKuliah', 'dosen', 'ruangan', 'pembimbing']);
        }
        
        // Cari jadwal yang benar-benar bentrok (prioritaskan yang memiliki lebih banyak kondisi yang sama)
        $conflict = null;
        $maxMatches = 0;
        
        foreach ($conflicts as $c) {
            $matches = 0;
            // Cek dosen sama
            if (isset($data['dosen_id']) && $data['dosen_id'] && $c->dosen_id == $data['dosen_id']) {
                $matches++;
            }
            // Cek pembimbing sama dengan dosen di jadwal lain (untuk Seminar Proposal)
            if (isset($data['pembimbing_id']) && $data['pembimbing_id']) {
                if ($c->dosen_id == $data['pembimbing_id'] || $c->pembimbing_id == $data['pembimbing_id']) {
                    $matches++;
                }
            }
            // Cek komentator sama dengan dosen di jadwal lain (untuk Seminar Proposal)
            if (isset($data['komentator_ids']) && !empty($data['komentator_ids'])) {
                foreach ($data['komentator_ids'] as $komentatorId) {
                    if ($c->dosen_id == $komentatorId || 
                        $c->pembimbing_id == $komentatorId || 
                        ($c->komentator_ids && in_array($komentatorId, $c->komentator_ids)) ||
                        ($c->penguji_ids && in_array($komentatorId, $c->penguji_ids))) {
                        $matches++;
                        break; // Hanya hitung sekali per komentator
                    }
                }
            }
            // Cek penguji sama dengan dosen di jadwal lain (untuk Sidang Skripsi)
            if (isset($data['penguji_ids']) && !empty($data['penguji_ids'])) {
                foreach ($data['penguji_ids'] as $pengujiId) {
                    if ($c->dosen_id == $pengujiId || 
                        $c->pembimbing_id == $pengujiId || 
                        ($c->komentator_ids && in_array($pengujiId, $c->komentator_ids)) ||
                        ($c->penguji_ids && in_array($pengujiId, $c->penguji_ids))) {
                        $matches++;
                        break; // Hanya hitung sekali per penguji
                    }
                }
            }
            if (isset($data['ruangan_id']) && $data['ruangan_id'] && $c->ruangan_id == $data['ruangan_id']) {
                $matches++;
            }
            if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id'] && $c->kelompok_besar_id == $data['kelompok_besar_id']) {
                $matches++;
            }
            // Cek overlap mahasiswa (untuk Seminar Proposal dan Sidang Skripsi)
            if (isset($data['mahasiswa_nims']) && !empty($data['mahasiswa_nims']) && isset($data['jenis_baris']) && ($data['jenis_baris'] === 'seminar_proposal' || $data['jenis_baris'] === 'sidang_skripsi') && $c->mahasiswa_nims) {
                $overlapNims = array_intersect($data['mahasiswa_nims'], $c->mahasiswa_nims);
                if (!empty($overlapNims)) {
                    $matches++;
                }
            }
            
            if ($matches > $maxMatches) {
                $maxMatches = $matches;
                $conflict = $c;
            }
        }
        
        // Jika tidak ada yang match lebih dari 0, ambil yang pertama (fallback)
        if (!$conflict && $conflicts->count() > 0) {
            $conflict = $conflicts->first();
        }
        
        if ($conflict) {
            // Pastikan relasi ter-load
            if (!$conflict->relationLoaded('mataKuliah')) {
                $conflict->load('mataKuliah');
            }
            if (!$conflict->relationLoaded('dosen')) {
                $conflict->load('dosen');
            }
            if (!$conflict->relationLoaded('ruangan')) {
                $conflict->load('ruangan');
            }
            if (!$conflict->relationLoaded('pembimbing')) {
                $conflict->load('pembimbing');
            }
            
            // Pastikan data JSON ter-decode dengan benar
            if ($conflict->komentator_ids && is_string($conflict->komentator_ids)) {
                $conflict->komentator_ids = json_decode($conflict->komentator_ids, true);
            }
            if ($conflict->penguji_ids && is_string($conflict->penguji_ids)) {
                $conflict->penguji_ids = json_decode($conflict->penguji_ids, true);
            }
            if ($conflict->mahasiswa_nims && is_string($conflict->mahasiswa_nims)) {
                $conflict->mahasiswa_nims = json_decode($conflict->mahasiswa_nims, true);
            }
            
            // Pastikan mataKuliah tidak null
            if (!$conflict->mataKuliah) {
                // Jika relasi tidak ter-load, ambil langsung dari database
                // Optimized: Use cache for mata kuliah lookup
                $cacheKey = 'mata_kuliah_' . $conflict->mata_kuliah_kode;
                $mataKuliah = Cache::remember($cacheKey, 3600, function () use ($conflict) {
                    return \App\Models\MataKuliah::where('kode', $conflict->mata_kuliah_kode)->first(['kode', 'nama']);
                });
                $mataKuliahBentrok = $mataKuliah ? $mataKuliah->nama : 'N/A';
            } else {
                $mataKuliahBentrok = $conflict->mataKuliah->nama;
            }
            
            // Tentukan jenis jadwal yang bentrok
            $jenisJadwalBentrok = $conflict->jenis_baris === 'materi' ? 'Materi Kuliah' : ($conflict->jenis_baris === 'agenda' ? 'Agenda Khusus' : ($conflict->jenis_baris === 'seminar_proposal' ? 'Seminar Proposal' : 'Sidang Skripsi'));
            $tanggalBentrok = $conflict->tanggal ? \Carbon\Carbon::parse($conflict->tanggal)->format('d/m/Y') : 'N/A';
            $jamBentrok = $conflict->jam_mulai && $conflict->jam_selesai ? "{$conflict->jam_mulai} - {$conflict->jam_selesai}" : 'N/A';
            
            // Tentukan jenis bentrok berdasarkan kondisi yang sebenarnya menyebabkan bentrok
            $bentrokTypes = [];
            $conflictDetails = [];
            
            // Cek apakah bentrok karena dosen sama
            if (isset($data['dosen_id']) && $data['dosen_id'] && $conflict->dosen_id == $data['dosen_id']) {
                $bentrokTypes[] = 'dosen';
                $conflictDetails[] = 'Dosen: ' . ($conflict->dosen ? $conflict->dosen->name : 'N/A');
            }
            
            // Cek apakah bentrok karena pembimbing sama dengan dosen/pembimbing/komentator/penguji di jadwal lain (untuk Seminar Proposal dan Sidang Skripsi)
            if (isset($data['pembimbing_id']) && $data['pembimbing_id']) {
                if ($conflict->dosen_id == $data['pembimbing_id']) {
                    $bentrokTypes[] = 'pembimbing';
                    $pembimbing = User::find($data['pembimbing_id']);
                    $conflictDetails[] = 'Pembimbing: ' . ($pembimbing ? $pembimbing->name : 'N/A') . ' (bentrok dengan dosen di jadwal lain)';
                } elseif ($conflict->pembimbing_id == $data['pembimbing_id']) {
                    $bentrokTypes[] = 'pembimbing';
                    $pembimbing = User::find($data['pembimbing_id']);
                    $conflictDetails[] = 'Pembimbing: ' . ($pembimbing ? $pembimbing->name : 'N/A');
                } elseif ($conflict->komentator_ids && in_array($data['pembimbing_id'], $conflict->komentator_ids)) {
                    $bentrokTypes[] = 'pembimbing';
                    $pembimbing = User::find($data['pembimbing_id']);
                    $conflictDetails[] = 'Pembimbing: ' . ($pembimbing ? $pembimbing->name : 'N/A') . ' (bentrok dengan komentator di jadwal lain)';
                } elseif ($conflict->penguji_ids && in_array($data['pembimbing_id'], $conflict->penguji_ids)) {
                    $bentrokTypes[] = 'pembimbing';
                    $pembimbing = User::find($data['pembimbing_id']);
                    $conflictDetails[] = 'Pembimbing: ' . ($pembimbing ? $pembimbing->name : 'N/A') . ' (bentrok dengan penguji di jadwal lain)';
                }
            }
            
            // Cek apakah bentrok karena komentator sama dengan dosen/pembimbing/komentator di jadwal lain (untuk Seminar Proposal)
            if (isset($data['komentator_ids']) && !empty($data['komentator_ids'])) {
                $overlapKomentator = [];
                foreach ($data['komentator_ids'] as $komentatorId) {
                    if ($conflict->dosen_id == $komentatorId) {
                        $overlapKomentator[] = $komentatorId;
                    } elseif ($conflict->pembimbing_id == $komentatorId) {
                        $overlapKomentator[] = $komentatorId;
                    } elseif ($conflict->komentator_ids && in_array($komentatorId, $conflict->komentator_ids)) {
                        $overlapKomentator[] = $komentatorId;
                    } elseif ($conflict->penguji_ids && in_array($komentatorId, $conflict->penguji_ids)) {
                        $overlapKomentator[] = $komentatorId;
                    }
                }
                if (!empty($overlapKomentator)) {
                    $bentrokTypes[] = 'komentator';
                    $komentatorNames = User::whereIn('id', $overlapKomentator)->pluck('name')->toArray();
                    $conflictDetails[] = 'Komentator: ' . implode(', ', $komentatorNames);
                }
            }
            
            // Cek apakah bentrok karena penguji sama dengan dosen/pembimbing/komentator/penguji di jadwal lain (untuk Sidang Skripsi)
            if (isset($data['penguji_ids']) && !empty($data['penguji_ids'])) {
                $overlapPenguji = [];
                foreach ($data['penguji_ids'] as $pengujiId) {
                    if ($conflict->dosen_id == $pengujiId) {
                        $overlapPenguji[] = $pengujiId;
                    } elseif ($conflict->pembimbing_id == $pengujiId) {
                        $overlapPenguji[] = $pengujiId;
                    } elseif ($conflict->komentator_ids && in_array($pengujiId, $conflict->komentator_ids)) {
                        $overlapPenguji[] = $pengujiId;
                    } elseif ($conflict->penguji_ids && in_array($pengujiId, $conflict->penguji_ids)) {
                        $overlapPenguji[] = $pengujiId;
                    }
                }
                if (!empty($overlapPenguji)) {
                    $bentrokTypes[] = 'penguji';
                    $pengujiNames = User::whereIn('id', $overlapPenguji)->pluck('name')->toArray();
                    $conflictDetails[] = 'Penguji: ' . implode(', ', $pengujiNames);
                }
            }
            
            // Cek apakah bentrok karena ruangan sama
            if (isset($data['ruangan_id']) && $data['ruangan_id'] && $conflict->ruangan_id == $data['ruangan_id']) {
                $bentrokTypes[] = 'ruangan';
                $conflictDetails[] = 'Ruangan: ' . ($conflict->ruangan ? $conflict->ruangan->nama : 'N/A');
            }
            
            // Cek apakah bentrok karena kelompok besar sama
            if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id'] && $conflict->kelompok_besar_id == $data['kelompok_besar_id']) {
                $bentrokTypes[] = 'kelompok besar';
                // Untuk kelompok besar, tambahkan detail semester
                $conflictDetails[] = 'Kelompok Besar: Semester ' . $conflict->kelompok_besar_id;
            }
            
            // Cek apakah bentrok karena mahasiswa sama (untuk Seminar Proposal dan Sidang Skripsi)
            if (isset($data['mahasiswa_nims']) && !empty($data['mahasiswa_nims']) && isset($data['jenis_baris']) && ($data['jenis_baris'] === 'seminar_proposal' || $data['jenis_baris'] === 'sidang_skripsi') && $conflict->mahasiswa_nims) {
                $overlapNims = array_intersect($data['mahasiswa_nims'], $conflict->mahasiswa_nims);
                if (!empty($overlapNims)) {
                    $bentrokTypes[] = 'mahasiswa';
                    // Ambil nama mahasiswa dari database berdasarkan NIM (bukan menampilkan NIM)
                    $mahasiswaNames = \App\Models\User::where('role', 'mahasiswa')
                        ->whereIn('nim', $overlapNims)
                        ->pluck('name', 'nim')
                        ->toArray();
                    
                    // Buat array nama mahasiswa (jika nama tidak ditemukan, gunakan NIM sebagai fallback)
                    $mahasiswaNamesList = [];
                    foreach ($overlapNims as $nim) {
                        if (isset($mahasiswaNames[$nim])) {
                            $mahasiswaNamesList[] = $mahasiswaNames[$nim];
                        } else {
                            $mahasiswaNamesList[] = $nim; // Fallback jika nama tidak ditemukan
                        }
                    }
                    
                    $conflictDetails[] = 'Mahasiswa: ' . implode(', ', $mahasiswaNamesList);
                }
            }
            
            $bentrokTypeStr = implode(', ', $bentrokTypes);
            $conflictDetailsStr = !empty($conflictDetails) ? ' (' . implode(', ', $conflictDetails) . ')' : '';
            
            // Buat pesan error yang lebih informatif
            // Untuk Agenda Khusus, prioritaskan menampilkan agenda daripada nama mata kuliah
            // Untuk Materi Kuliah, prioritaskan menampilkan materi daripada nama mata kuliah
            // Untuk Seminar Proposal, tampilkan sebagai Seminar Proposal
            if ($conflict->jenis_baris === 'agenda' && $conflict->agenda) {
                // Jika agenda ada, tampilkan agenda sebagai identitas utama
                return "Jadwal bentrok dengan jadwal Agenda Khusus \"{$conflict->agenda}\" (Mata Kuliah: {$mataKuliahBentrok}) pada {$tanggalBentrok} jam {$jamBentrok}. Konflik pada: {$bentrokTypeStr}{$conflictDetailsStr}";
            } elseif ($conflict->jenis_baris === 'materi' && $conflict->materi) {
                // Jika materi ada, tampilkan materi sebagai identitas utama
                return "Jadwal bentrok dengan jadwal Materi Kuliah \"{$conflict->materi}\" (Mata Kuliah: {$mataKuliahBentrok}) pada {$tanggalBentrok} jam {$jamBentrok}. Konflik pada: {$bentrokTypeStr}{$conflictDetailsStr}";
            } elseif ($conflict->jenis_baris === 'seminar_proposal') {
                // Untuk Seminar Proposal, tampilkan sebagai Seminar Proposal
                return "Jadwal bentrok dengan jadwal Seminar Proposal (Mata Kuliah: {$mataKuliahBentrok}) pada {$tanggalBentrok} jam {$jamBentrok}. Konflik pada: {$bentrokTypeStr}{$conflictDetailsStr}";
            } elseif ($conflict->jenis_baris === 'sidang_skripsi') {
                // Untuk Sidang Skripsi, tampilkan sebagai Sidang Skripsi
                return "Jadwal bentrok dengan jadwal Sidang Skripsi (Mata Kuliah: {$mataKuliahBentrok}) pada {$tanggalBentrok} jam {$jamBentrok}. Konflik pada: {$bentrokTypeStr}{$conflictDetailsStr}";
            } else {
                // Fallback: tampilkan nama mata kuliah
                $agendaInfo = $conflict->jenis_baris === 'agenda' && $conflict->agenda ? " - {$conflict->agenda}" : '';
                $materiInfo = $conflict->jenis_baris === 'materi' && $conflict->materi ? " - {$conflict->materi}" : '';
                return "Jadwal bentrok dengan jadwal {$jenisJadwalBentrok} \"{$mataKuliahBentrok}\"{$agendaInfo}{$materiInfo} pada {$tanggalBentrok} jam {$jamBentrok}. Konflik pada: {$bentrokTypeStr}{$conflictDetailsStr}";
            }
        }

        // Cek bentrok kelompok besar vs kelompok besar (dari JadwalKuliahBesar, JadwalAgendaKhusus di DetailBlok)
        if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
            $kelompokBesarVsKelompokBesarBentrok = $this->checkKelompokBesarVsKelompokBesarBentrokWithDetail($data, $semester);
            if ($kelompokBesarVsKelompokBesarBentrok) {
                return $kelompokBesarVsKelompokBesarBentrok;
            }
        }

        // Cek bentrok kelompok besar vs kelompok kecil (dari JadwalPBL, JadwalJurnalReading)
        if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
            $kelompokBesarVsKelompokKecilBentrok = $this->checkKelompokBesarVsKelompokKecilBentrokWithDetail($data, $semester);
            if ($kelompokBesarVsKelompokKecilBentrok) {
                return $kelompokBesarVsKelompokKecilBentrok;
            }
        }

        // Cek bentrok dosen dengan jadwal dari DetailBlok (selain hanya ruangan)
        if (isset($data['dosen_id']) && $data['dosen_id']) {
            $dosenBentrok = $this->checkDosenBentrokWithDetailBlok($data, $semester);
            if ($dosenBentrok) {
                return $dosenBentrok;
            }
        }

        // Cek bentrok kelompok besar vs kelompok kecil (dari JadwalCSR di DetailNonBlokCSR)
        if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
            $kelompokBesarVsKelompokKecilCSRBentrok = $this->checkKelompokBesarVsKelompokKecilCSRBentrokWithDetail($data, $semester);
            if ($kelompokBesarVsKelompokKecilCSRBentrok) {
                return $kelompokBesarVsKelompokKecilCSRBentrok;
            }
        }

        // Cek bentrok mahasiswa vs kelompok besar/kecil untuk Seminar Proposal dan Sidang Skripsi
        if (isset($data['jenis_baris']) && ($data['jenis_baris'] === 'seminar_proposal' || $data['jenis_baris'] === 'sidang_skripsi') && isset($data['mahasiswa_nims']) && !empty($data['mahasiswa_nims'])) {
            $mahasiswaBentrok = $this->checkMahasiswaBentrokWithKelompok($data, $semester);
            if ($mahasiswaBentrok) {
                return $mahasiswaBentrok;
            }
        }

        // Cek bentrok pembimbing dan komentator untuk Seminar Proposal
        if (isset($data['jenis_baris']) && $data['jenis_baris'] === 'seminar_proposal') {
            if (isset($data['pembimbing_id']) && $data['pembimbing_id']) {
                $pembimbingBentrok = $this->checkDosenBentrokWithDetailBlok(['dosen_id' => $data['pembimbing_id'], 'tanggal' => $data['tanggal'], 'jam_mulai' => $data['jam_mulai'], 'jam_selesai' => $data['jam_selesai']], $semester);
                if ($pembimbingBentrok) {
                    return "Pembimbing: " . $pembimbingBentrok;
                }
            }
            if (isset($data['komentator_ids']) && !empty($data['komentator_ids'])) {
                foreach ($data['komentator_ids'] as $komentatorId) {
                    $komentatorBentrok = $this->checkDosenBentrokWithDetailBlok(['dosen_id' => $komentatorId, 'tanggal' => $data['tanggal'], 'jam_mulai' => $data['jam_mulai'], 'jam_selesai' => $data['jam_selesai']], $semester);
                    if ($komentatorBentrok) {
                        return "Komentator: " . $komentatorBentrok;
                    }
                }
            }
        }

        // Cek bentrok pembimbing dan penguji untuk Sidang Skripsi
        if (isset($data['jenis_baris']) && $data['jenis_baris'] === 'sidang_skripsi') {
            if (isset($data['pembimbing_id']) && $data['pembimbing_id']) {
                $pembimbingBentrok = $this->checkDosenBentrokWithDetailBlok(['dosen_id' => $data['pembimbing_id'], 'tanggal' => $data['tanggal'], 'jam_mulai' => $data['jam_mulai'], 'jam_selesai' => $data['jam_selesai']], $semester);
                if ($pembimbingBentrok) {
                    return "Pembimbing: " . $pembimbingBentrok;
                }
            }
            if (isset($data['penguji_ids']) && !empty($data['penguji_ids'])) {
                foreach ($data['penguji_ids'] as $pengujiId) {
                    $pengujiBentrok = $this->checkDosenBentrokWithDetailBlok(['dosen_id' => $pengujiId, 'tanggal' => $data['tanggal'], 'jam_mulai' => $data['jam_mulai'], 'jam_selesai' => $data['jam_selesai']], $semester);
                    if ($pengujiBentrok) {
                        return "Penguji: " . $pengujiBentrok;
                    }
                }
            }
        }

        // Cek bentrok dengan jadwal PBL (dengan filter semester) - cek ruangan dan dosen
        $pblBentrok = null;
        if (isset($data['ruangan_id']) && $data['ruangan_id']) {
            $pblBentrok = \App\Models\JadwalPBL::with(['mataKuliah', 'ruangan', 'dosen'])
                ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();
        }

        // Cek bentrok dengan jadwal Kuliah Besar (dengan filter semester) - cek ruangan dan dosen
        $kuliahBesarBentrok = null;
        if (isset($data['ruangan_id']) && $data['ruangan_id']) {
            $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::with(['mataKuliah', 'ruangan', 'dosen'])
                ->where('tanggal', $data['tanggal'])
                ->whereHas('mataKuliah', function ($q) use ($semester) {
                    if ($semester) {
                        $q->where('semester', $semester);
                    }
                })
                ->where('ruangan_id', $data['ruangan_id'])
                ->where(function ($q) use ($data) {
                    $q->where('jam_mulai', '<', $data['jam_selesai'])
                        ->where('jam_selesai', '>', $data['jam_mulai']);
                })
                ->first();
        }

        // Cek bentrok dengan jadwal Agenda Khusus (dengan filter semester) - cek ruangan
        $agendaKhususBentrok = null;
        if (isset($data['ruangan_id']) && $data['ruangan_id']) {
            $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::with(['mataKuliah', 'ruangan'])
                ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
                })
                ->first();
        }

        // Cek bentrok dengan jadwal Praktikum (dengan filter semester) - cek ruangan dan dosen
        $praktikumBentrok = null;
        if (isset($data['ruangan_id']) && $data['ruangan_id']) {
            $praktikumBentrok = \App\Models\JadwalPraktikum::with(['mataKuliah', 'ruangan', 'dosen'])
                ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
                })
                ->first();
        }

        // Cek bentrok dengan jadwal Jurnal Reading (dengan filter semester) - cek ruangan dan dosen
        $jurnalBentrok = null;
        if (isset($data['ruangan_id']) && $data['ruangan_id']) {
            $jurnalBentrok = \App\Models\JadwalJurnalReading::with(['mataKuliah', 'ruangan', 'dosen'])
                ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
                })
                ->first();
        }

        // Cek bentrok dengan jadwal CSR (dengan filter semester) - cek ruangan dan dosen
        $csrBentrok = null;
        if (isset($data['ruangan_id']) && $data['ruangan_id']) {
            $csrBentrok = \App\Models\JadwalCSR::with(['mataKuliah', 'ruangan', 'dosen'])
                ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
                })
                ->first();
        }

        // Kembalikan pesan error yang jelas untuk setiap jenis bentrok
        if ($pblBentrok) {
            $mataKuliahName = $pblBentrok->mataKuliah ? $pblBentrok->mataKuliah->nama : 'N/A';
            $ruanganName = $pblBentrok->ruangan ? $pblBentrok->ruangan->nama : 'N/A';
            $tanggalFormatted = $pblBentrok->tanggal ? \Carbon\Carbon::parse($pblBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $pblBentrok->jam_mulai && $pblBentrok->jam_selesai ? "{$pblBentrok->jam_mulai} - {$pblBentrok->jam_selesai}" : 'N/A';
            return "Jadwal bentrok dengan jadwal PBL \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted} (Ruangan: {$ruanganName})";
        }
        
        if ($kuliahBesarBentrok) {
            $mataKuliahName = $kuliahBesarBentrok->mataKuliah ? $kuliahBesarBentrok->mataKuliah->nama : 'N/A';
            $ruanganName = $kuliahBesarBentrok->ruangan ? $kuliahBesarBentrok->ruangan->nama : 'N/A';
            $tanggalFormatted = $kuliahBesarBentrok->tanggal ? \Carbon\Carbon::parse($kuliahBesarBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $kuliahBesarBentrok->jam_mulai && $kuliahBesarBentrok->jam_selesai ? "{$kuliahBesarBentrok->jam_mulai} - {$kuliahBesarBentrok->jam_selesai}" : 'N/A';
            return "Jadwal bentrok dengan jadwal Kuliah Besar \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted} (Ruangan: {$ruanganName})";
        }
        
        if ($agendaKhususBentrok) {
            $mataKuliahName = $agendaKhususBentrok->mataKuliah ? $agendaKhususBentrok->mataKuliah->nama : 'N/A';
            $ruanganName = $agendaKhususBentrok->ruangan ? $agendaKhususBentrok->ruangan->nama : 'N/A';
            $tanggalFormatted = $agendaKhususBentrok->tanggal ? \Carbon\Carbon::parse($agendaKhususBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $agendaKhususBentrok->jam_mulai && $agendaKhususBentrok->jam_selesai ? "{$agendaKhususBentrok->jam_mulai} - {$agendaKhususBentrok->jam_selesai}" : 'N/A';
            return "Jadwal bentrok dengan jadwal Agenda Khusus \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted} (Ruangan: {$ruanganName})";
        }
        
        if ($praktikumBentrok) {
            $mataKuliahName = $praktikumBentrok->mataKuliah ? $praktikumBentrok->mataKuliah->nama : 'N/A';
            $ruanganName = $praktikumBentrok->ruangan ? $praktikumBentrok->ruangan->nama : 'N/A';
            $tanggalFormatted = $praktikumBentrok->tanggal ? \Carbon\Carbon::parse($praktikumBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $praktikumBentrok->jam_mulai && $praktikumBentrok->jam_selesai ? "{$praktikumBentrok->jam_mulai} - {$praktikumBentrok->jam_selesai}" : 'N/A';
            return "Jadwal bentrok dengan jadwal Praktikum \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted} (Ruangan: {$ruanganName})";
        }
        
        if ($jurnalBentrok) {
            $mataKuliahName = $jurnalBentrok->mataKuliah ? $jurnalBentrok->mataKuliah->nama : 'N/A';
            $ruanganName = $jurnalBentrok->ruangan ? $jurnalBentrok->ruangan->nama : 'N/A';
            $tanggalFormatted = $jurnalBentrok->tanggal ? \Carbon\Carbon::parse($jurnalBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $jurnalBentrok->jam_mulai && $jurnalBentrok->jam_selesai ? "{$jurnalBentrok->jam_mulai} - {$jurnalBentrok->jam_selesai}" : 'N/A';
            return "Jadwal bentrok dengan jadwal Jurnal Reading \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted} (Ruangan: {$ruanganName})";
        }
        
        if ($csrBentrok) {
            $mataKuliahName = $csrBentrok->mataKuliah ? $csrBentrok->mataKuliah->nama : 'N/A';
            $ruanganName = $csrBentrok->ruangan ? $csrBentrok->ruangan->nama : 'N/A';
            $tanggalFormatted = $csrBentrok->tanggal ? \Carbon\Carbon::parse($csrBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $csrBentrok->jam_mulai && $csrBentrok->jam_selesai ? "{$csrBentrok->jam_mulai} - {$csrBentrok->jam_selesai}" : 'N/A';
            return "Jadwal bentrok dengan jadwal CSR \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted} (Ruangan: {$ruanganName})";
        }

        return null;
    }

    /**
     * Cek bentrok kelompok besar vs kelompok besar (dari JadwalKuliahBesar, JadwalAgendaKhusus di DetailBlok)
     */
    private function checkKelompokBesarVsKelompokBesarBentrokWithDetail($data, $semester): ?string
    {
        if (!isset($data['kelompok_besar_id']) || !$data['kelompok_besar_id']) {
            return null;
        }

        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan kelompok besar yang sama
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::with(['mataKuliah'])
            ->where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_id', $data['kelompok_besar_id'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($kuliahBesarBentrok) {
            $mataKuliahName = $kuliahBesarBentrok->mataKuliah ? $kuliahBesarBentrok->mataKuliah->nama : 'N/A';
            $tanggalFormatted = $kuliahBesarBentrok->tanggal ? \Carbon\Carbon::parse($kuliahBesarBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $kuliahBesarBentrok->jam_mulai && $kuliahBesarBentrok->jam_selesai ? "{$kuliahBesarBentrok->jam_mulai} - {$kuliahBesarBentrok->jam_selesai}" : 'N/A';
            return "Jadwal bentrok dengan jadwal Kuliah Besar \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: kelompok besar (Kelompok Besar: Semester {$data['kelompok_besar_id']})";
        }

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::with(['mataKuliah'])
            ->where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_id', $data['kelompok_besar_id'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($agendaKhususBentrok) {
            // Pastikan relasi mataKuliah ter-load
            if (!$agendaKhususBentrok->relationLoaded('mataKuliah')) {
                $agendaKhususBentrok->load('mataKuliah');
            }
            
            // Pastikan mataKuliah tidak null
            if (!$agendaKhususBentrok->mataKuliah) {
                // Jika relasi tidak ter-load, ambil langsung dari database
                // Optimized: Use cache for mata kuliah lookup
                $cacheKey = 'mata_kuliah_' . $agendaKhususBentrok->mata_kuliah_kode;
                $mataKuliah = Cache::remember($cacheKey, 3600, function () use ($agendaKhususBentrok) {
                    return \App\Models\MataKuliah::where('kode', $agendaKhususBentrok->mata_kuliah_kode)->first(['kode', 'nama']);
                });
                $mataKuliahName = $mataKuliah ? $mataKuliah->nama : 'N/A';
            } else {
                $mataKuliahName = $agendaKhususBentrok->mataKuliah->nama;
            }
            
            $tanggalFormatted = $agendaKhususBentrok->tanggal ? \Carbon\Carbon::parse($agendaKhususBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $agendaKhususBentrok->jam_mulai && $agendaKhususBentrok->jam_selesai ? "{$agendaKhususBentrok->jam_mulai} - {$agendaKhususBentrok->jam_selesai}" : 'N/A';
            $agendaInfo = $agendaKhususBentrok->agenda ? " - {$agendaKhususBentrok->agenda}" : '';
            
            return "Jadwal bentrok dengan jadwal Agenda Khusus \"{$mataKuliahName}\"{$agendaInfo} pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: kelompok besar (Kelompok Besar: Semester {$data['kelompok_besar_id']})";
        }

        return null;
    }

    /**
     * Cek bentrok kelompok besar vs kelompok kecil (dari JadwalPBL, JadwalJurnalReading di DetailBlok)
     */
    private function checkKelompokBesarVsKelompokKecilBentrokWithDetail($data, $semester): ?string
    {
        if (!isset($data['kelompok_besar_id']) || !$data['kelompok_besar_id']) {
            return null;
        }

        // Ambil mahasiswa dalam kelompok besar yang dipilih
        $mahasiswaIds = \App\Models\KelompokBesar::where('semester', $data['kelompok_besar_id'])
            ->pluck('mahasiswa_id')
            ->toArray();

        if (empty($mahasiswaIds)) {
            return null;
        }

        // Cek bentrok dengan jadwal PBL yang menggunakan kelompok kecil dari mahasiswa yang sama
        $pblBentrok = \App\Models\JadwalPBL::with(['mataKuliah', 'kelompokKecil'])
            ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecil', function ($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->first();

        if ($pblBentrok) {
            $mataKuliahName = $pblBentrok->mataKuliah ? $pblBentrok->mataKuliah->nama : 'N/A';
            $tanggalFormatted = $pblBentrok->tanggal ? \Carbon\Carbon::parse($pblBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $pblBentrok->jam_mulai && $pblBentrok->jam_selesai ? "{$pblBentrok->jam_mulai} - {$pblBentrok->jam_selesai}" : 'N/A';
            $kelompokKecil = $pblBentrok->kelompokKecil ? $pblBentrok->kelompokKecil->first() : null;
            $kelompokKecilName = $kelompokKecil ? $kelompokKecil->nama_kelompok : 'N/A';
            return "Jadwal bentrok dengan jadwal PBL \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: kelompok besar vs kelompok kecil (Kelompok Besar: Semester {$data['kelompok_besar_id']}, Kelompok Kecil: {$kelompokKecilName})";
        }

        // Cek bentrok dengan jadwal Jurnal Reading yang menggunakan kelompok kecil dari mahasiswa yang sama
        $jurnalBentrok = \App\Models\JadwalJurnalReading::with(['mataKuliah', 'kelompokKecil'])
            ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecil', function ($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->first();

        if ($jurnalBentrok) {
            $mataKuliahName = $jurnalBentrok->mataKuliah ? $jurnalBentrok->mataKuliah->nama : 'N/A';
            $tanggalFormatted = $jurnalBentrok->tanggal ? \Carbon\Carbon::parse($jurnalBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $jurnalBentrok->jam_mulai && $jurnalBentrok->jam_selesai ? "{$jurnalBentrok->jam_mulai} - {$jurnalBentrok->jam_selesai}" : 'N/A';
            $kelompokKecil = $jurnalBentrok->kelompokKecil ? $jurnalBentrok->kelompokKecil->first() : null;
            $kelompokKecilName = $kelompokKecil ? $kelompokKecil->nama_kelompok : 'N/A';
            return "Jadwal bentrok dengan jadwal Jurnal Reading \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: kelompok besar vs kelompok kecil (Kelompok Besar: Semester {$data['kelompok_besar_id']}, Kelompok Kecil: {$kelompokKecilName})";
        }

        return null;
    }

    /**
     * Cek bentrok dosen dengan jadwal dari DetailBlok (selain hanya ruangan)
     */
    private function checkDosenBentrokWithDetailBlok($data, $semester): ?string
    {
        if (!isset($data['dosen_id']) || !$data['dosen_id']) {
            return null;
        }

        // Cek bentrok dengan jadwal PBL yang menggunakan dosen yang sama
        $pblBentrok = \App\Models\JadwalPBL::with(['mataKuliah', 'dosen'])
            ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('dosen_id', $data['dosen_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($pblBentrok) {
            $mataKuliahName = $pblBentrok->mataKuliah ? $pblBentrok->mataKuliah->nama : 'N/A';
            $dosenName = $pblBentrok->dosen ? $pblBentrok->dosen->name : 'N/A';
            $tanggalFormatted = $pblBentrok->tanggal ? \Carbon\Carbon::parse($pblBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $pblBentrok->jam_mulai && $pblBentrok->jam_selesai ? "{$pblBentrok->jam_mulai} - {$pblBentrok->jam_selesai}" : 'N/A';
            return "Jadwal bentrok dengan jadwal PBL \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: dosen (Dosen: {$dosenName})";
        }

        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan dosen yang sama
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::with(['mataKuliah', 'dosen'])
            ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('dosen_id', $data['dosen_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($kuliahBesarBentrok) {
            $mataKuliahName = $kuliahBesarBentrok->mataKuliah ? $kuliahBesarBentrok->mataKuliah->nama : 'N/A';
            $dosenName = $kuliahBesarBentrok->dosen ? $kuliahBesarBentrok->dosen->name : 'N/A';
            $tanggalFormatted = $kuliahBesarBentrok->tanggal ? \Carbon\Carbon::parse($kuliahBesarBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $kuliahBesarBentrok->jam_mulai && $kuliahBesarBentrok->jam_selesai ? "{$kuliahBesarBentrok->jam_mulai} - {$kuliahBesarBentrok->jam_selesai}" : 'N/A';
            return "Jadwal bentrok dengan jadwal Kuliah Besar \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: dosen (Dosen: {$dosenName})";
        }

        // Cek bentrok dengan jadwal Praktikum yang menggunakan dosen yang sama
        // Catatan: JadwalPraktikum menggunakan relasi many-to-many dengan dosen
        $praktikumBentrok = \App\Models\JadwalPraktikum::with(['mataKuliah', 'dosen'])
            ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->whereHas('dosen', function ($q) use ($data) {
                $q->where('users.id', $data['dosen_id']);
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($praktikumBentrok) {
            $mataKuliahName = $praktikumBentrok->mataKuliah ? $praktikumBentrok->mataKuliah->nama : 'N/A';
            // Karena relasi dosen adalah many-to-many, ambil dosen pertama yang terlibat
            $dosenName = $praktikumBentrok->dosen && $praktikumBentrok->dosen->isNotEmpty() 
                ? $praktikumBentrok->dosen->first()->name 
                : 'N/A';
            $tanggalFormatted = $praktikumBentrok->tanggal ? \Carbon\Carbon::parse($praktikumBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $praktikumBentrok->jam_mulai && $praktikumBentrok->jam_selesai ? "{$praktikumBentrok->jam_mulai} - {$praktikumBentrok->jam_selesai}" : 'N/A';
            return "Jadwal bentrok dengan jadwal Praktikum \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: dosen (Dosen: {$dosenName})";
        }

        // Cek bentrok dengan jadwal Jurnal Reading yang menggunakan dosen yang sama
        $jurnalBentrok = \App\Models\JadwalJurnalReading::with(['mataKuliah', 'dosen'])
            ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('dosen_id', $data['dosen_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($jurnalBentrok) {
            $mataKuliahName = $jurnalBentrok->mataKuliah ? $jurnalBentrok->mataKuliah->nama : 'N/A';
            $dosenName = $jurnalBentrok->dosen ? $jurnalBentrok->dosen->name : 'N/A';
            $tanggalFormatted = $jurnalBentrok->tanggal ? \Carbon\Carbon::parse($jurnalBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $jurnalBentrok->jam_mulai && $jurnalBentrok->jam_selesai ? "{$jurnalBentrok->jam_mulai} - {$jurnalBentrok->jam_selesai}" : 'N/A';
            return "Jadwal bentrok dengan jadwal Jurnal Reading \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: dosen (Dosen: {$dosenName})";
        }

        // Cek bentrok dengan jadwal CSR yang menggunakan dosen yang sama
        $csrBentrok = \App\Models\JadwalCSR::with(['mataKuliah', 'dosen'])
            ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where('dosen_id', $data['dosen_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($csrBentrok) {
            $mataKuliahName = $csrBentrok->mataKuliah ? $csrBentrok->mataKuliah->nama : 'N/A';
            $dosenName = $csrBentrok->dosen ? $csrBentrok->dosen->name : 'N/A';
            $tanggalFormatted = $csrBentrok->tanggal ? \Carbon\Carbon::parse($csrBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $csrBentrok->jam_mulai && $csrBentrok->jam_selesai ? "{$csrBentrok->jam_mulai} - {$csrBentrok->jam_selesai}" : 'N/A';
            return "Jadwal bentrok dengan jadwal CSR \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: dosen (Dosen: {$dosenName})";
        }

        return null;
    }

    /**
     * Cek bentrok kelompok besar vs kelompok kecil (dari JadwalCSR di DetailNonBlokCSR)
     */
    private function checkKelompokBesarVsKelompokKecilCSRBentrokWithDetail($data, $semester): ?string
    {
        if (!isset($data['kelompok_besar_id']) || !$data['kelompok_besar_id']) {
            return null;
        }

        // Ambil mahasiswa dalam kelompok besar yang dipilih
        $mahasiswaIds = \App\Models\KelompokBesar::where('semester', $data['kelompok_besar_id'])
            ->pluck('mahasiswa_id')
            ->toArray();

        if (empty($mahasiswaIds)) {
            return null;
        }

        // Cek bentrok dengan jadwal CSR yang menggunakan kelompok kecil dari mahasiswa yang sama
        $csrBentrok = \App\Models\JadwalCSR::with(['mataKuliah', 'kelompokKecil'])
            ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecil', function ($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->first();

        if ($csrBentrok) {
            $mataKuliahName = $csrBentrok->mataKuliah ? $csrBentrok->mataKuliah->nama : 'N/A';
            $tanggalFormatted = $csrBentrok->tanggal ? \Carbon\Carbon::parse($csrBentrok->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $csrBentrok->jam_mulai && $csrBentrok->jam_selesai ? "{$csrBentrok->jam_mulai} - {$csrBentrok->jam_selesai}" : 'N/A';
            $kelompokKecil = $csrBentrok->kelompokKecil;
            $kelompokKecilName = $kelompokKecil ? $kelompokKecil->nama_kelompok : 'N/A';
            return "Jadwal bentrok dengan jadwal CSR \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: kelompok besar vs kelompok kecil (Kelompok Besar: Semester {$data['kelompok_besar_id']}, Kelompok Kecil: {$kelompokKecilName})";
        }

        return null;
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

    private function validateRuanganCapacity($ruanganId, $kelompokBesarId, $includeDosen = true)
    {
        // Optimized: Use cache for frequently accessed ruangan data
        $cacheKey = 'ruangan_' . $ruanganId;
        $ruangan = Cache::remember($cacheKey, 3600, function () use ($ruanganId) {
            return \App\Models\Ruangan::find($ruanganId, ['id', 'nama', 'kapasitas']);
        });
        
        if (!$ruangan) {
            return "Data ruangan tidak ditemukan";
        }

        // kelompok_besar_id menyimpan semester, bukan ID kelompok besar
        // Hitung jumlah mahasiswa di semester tersebut - optimized with cache
        $cacheKeyMahasiswa = 'kelompok_besar_count_' . $kelompokBesarId;
        $jumlahMahasiswa = Cache::remember($cacheKeyMahasiswa, 1800, function () use ($kelompokBesarId) {
            return KelompokBesar::where('semester', $kelompokBesarId)->count();
        });
        
        // Total peserta = jumlah mahasiswa + (1 dosen jika includeDosen = true)
        $totalPeserta = $jumlahMahasiswa + ($includeDosen ? 1 : 0);

        // Validasi kapasitas
        if ($totalPeserta > $ruangan->kapasitas) {
            if ($includeDosen) {
                return "Kapasitas ruangan tidak mencukupi. Ruangan {$ruangan->nama} hanya dapat menampung {$ruangan->kapasitas} orang, sedangkan diperlukan {$totalPeserta} orang ({$jumlahMahasiswa} mahasiswa + 1 dosen).";
            } else {
                return "Kapasitas ruangan tidak mencukupi. Ruangan {$ruangan->nama} hanya dapat menampung {$ruangan->kapasitas} orang, sedangkan diperlukan {$totalPeserta} orang ({$jumlahMahasiswa} mahasiswa).";
            }
        }

        return null;
    }

    /**
     * Cek apakah dua data bentrok (untuk validasi import)
     * Konsisten dengan checkBentrokWithDetail: bentrok jika tanggal sama, jam overlap, DAN minimal salah satu dari:
     * - dosen sama, ATAU
     * - ruangan sama, ATAU
     * - kelompok besar sama
     * 
     * @return array|null Array dengan informasi bentrok [dosen, ruangan, kelompok_besar] atau null jika tidak bentrok
     */
    private function isDataBentrok($data1, $data2): ?array
    {
        // Cek apakah tanggal sama
        if ($data1['tanggal'] !== $data2['tanggal']) {
            return null;
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
            return null;
        }

        // Cek bentrok dosen (untuk materi/agenda)
        $dosenBentrok = false;
        if (isset($data1['dosen_id']) && isset($data2['dosen_id']) && $data1['dosen_id'] && $data2['dosen_id'] && $data1['dosen_id'] == $data2['dosen_id']) {
            $dosenBentrok = true;
        }

        // Cek bentrok pembimbing dan komentator (untuk Seminar Proposal)
        $pembimbingKomentatorBentrok = false;
        
        // Cek pembimbing data1 dengan pembimbing/komentator/dosen data2
        if (isset($data1['pembimbing_id']) && $data1['pembimbing_id']) {
            if (isset($data2['pembimbing_id']) && $data2['pembimbing_id'] && $data1['pembimbing_id'] == $data2['pembimbing_id']) {
                $pembimbingKomentatorBentrok = true;
            }
            if (isset($data2['komentator_ids']) && is_array($data2['komentator_ids']) && in_array($data1['pembimbing_id'], $data2['komentator_ids'])) {
                $pembimbingKomentatorBentrok = true;
            }
            if (isset($data2['penguji_ids']) && is_array($data2['penguji_ids']) && in_array($data1['pembimbing_id'], $data2['penguji_ids'])) {
                $pembimbingKomentatorBentrok = true;
            }
            if (isset($data2['dosen_id']) && $data2['dosen_id'] && $data1['pembimbing_id'] == $data2['dosen_id']) {
                $pembimbingKomentatorBentrok = true;
            }
        }
        
        // Cek komentator data1 dengan pembimbing/komentator/dosen data2
        if (isset($data1['komentator_ids']) && is_array($data1['komentator_ids']) && !empty($data1['komentator_ids'])) {
            foreach ($data1['komentator_ids'] as $komentatorId1) {
                if (isset($data2['pembimbing_id']) && $data2['pembimbing_id'] && $komentatorId1 == $data2['pembimbing_id']) {
                    $pembimbingKomentatorBentrok = true;
                    break;
                }
                if (isset($data2['komentator_ids']) && is_array($data2['komentator_ids']) && in_array($komentatorId1, $data2['komentator_ids'])) {
                    $pembimbingKomentatorBentrok = true;
                    break;
                }
                if (isset($data2['penguji_ids']) && is_array($data2['penguji_ids']) && in_array($komentatorId1, $data2['penguji_ids'])) {
                    $pembimbingKomentatorBentrok = true;
                    break;
                }
                if (isset($data2['dosen_id']) && $data2['dosen_id'] && $komentatorId1 == $data2['dosen_id']) {
                    $pembimbingKomentatorBentrok = true;
                    break;
                }
            }
        }
        
        // Cek bentrok pembimbing dan penguji (untuk Sidang Skripsi)
        $pembimbingPengujiBentrok = false;
        
        // Cek pembimbing data1 dengan pembimbing/penguji/dosen data2
        if (isset($data1['pembimbing_id']) && $data1['pembimbing_id']) {
            if (isset($data2['pembimbing_id']) && $data2['pembimbing_id'] && $data1['pembimbing_id'] == $data2['pembimbing_id']) {
                $pembimbingPengujiBentrok = true;
            }
            if (isset($data2['penguji_ids']) && is_array($data2['penguji_ids']) && in_array($data1['pembimbing_id'], $data2['penguji_ids'])) {
                $pembimbingPengujiBentrok = true;
            }
            if (isset($data2['komentator_ids']) && is_array($data2['komentator_ids']) && in_array($data1['pembimbing_id'], $data2['komentator_ids'])) {
                $pembimbingPengujiBentrok = true;
            }
            if (isset($data2['dosen_id']) && $data2['dosen_id'] && $data1['pembimbing_id'] == $data2['dosen_id']) {
                $pembimbingPengujiBentrok = true;
            }
        }
        
        // Cek penguji data1 dengan pembimbing/penguji/dosen data2
        if (isset($data1['penguji_ids']) && is_array($data1['penguji_ids']) && !empty($data1['penguji_ids'])) {
            foreach ($data1['penguji_ids'] as $pengujiId1) {
                if (isset($data2['pembimbing_id']) && $data2['pembimbing_id'] && $pengujiId1 == $data2['pembimbing_id']) {
                    $pembimbingPengujiBentrok = true;
                    break;
                }
                if (isset($data2['penguji_ids']) && is_array($data2['penguji_ids']) && in_array($pengujiId1, $data2['penguji_ids'])) {
                    $pembimbingPengujiBentrok = true;
                    break;
                }
                if (isset($data2['komentator_ids']) && is_array($data2['komentator_ids']) && in_array($pengujiId1, $data2['komentator_ids'])) {
                    $pembimbingPengujiBentrok = true;
                    break;
                }
                if (isset($data2['dosen_id']) && $data2['dosen_id'] && $pengujiId1 == $data2['dosen_id']) {
                    $pembimbingPengujiBentrok = true;
                    break;
                }
            }
        }
        
        // Cek pembimbing data2 dengan komentator/dosen data1 (untuk kasus sebaliknya)
        if (isset($data2['pembimbing_id']) && $data2['pembimbing_id']) {
            if (isset($data1['komentator_ids']) && is_array($data1['komentator_ids']) && in_array($data2['pembimbing_id'], $data1['komentator_ids'])) {
                $pembimbingKomentatorBentrok = true;
            }
            if (isset($data1['dosen_id']) && $data1['dosen_id'] && $data2['pembimbing_id'] == $data1['dosen_id']) {
                $pembimbingKomentatorBentrok = true;
            }
        }

        // Cek bentrok mahasiswa (untuk Seminar Proposal dan Sidang Skripsi)
        $mahasiswaBentrok = false;
        if (isset($data1['mahasiswa_nims']) && isset($data2['mahasiswa_nims']) && 
            is_array($data1['mahasiswa_nims']) && is_array($data2['mahasiswa_nims']) &&
            !empty($data1['mahasiswa_nims']) && !empty($data2['mahasiswa_nims'])) {
            // Cek apakah ada mahasiswa yang sama di kedua data
            $intersection = array_intersect($data1['mahasiswa_nims'], $data2['mahasiswa_nims']);
            if (!empty($intersection)) {
                $mahasiswaBentrok = true;
            }
        }

        // Cek bentrok ruangan
        $ruanganBentrok = false;
        if (isset($data1['ruangan_id']) && isset($data2['ruangan_id']) && $data1['ruangan_id'] && $data2['ruangan_id'] && $data1['ruangan_id'] == $data2['ruangan_id']) {
            $ruanganBentrok = true;
        }

        // Cek bentrok kelompok besar (konsisten dengan checkBentrokWithDetail)
        $kelompokBesarBentrok = false;
        if (isset($data1['kelompok_besar_id']) && isset($data2['kelompok_besar_id']) && $data1['kelompok_besar_id'] && $data2['kelompok_besar_id'] && $data1['kelompok_besar_id'] == $data2['kelompok_besar_id']) {
            $kelompokBesarBentrok = true;
        }

        // Return null jika tidak ada yang bentrok
        if (!$dosenBentrok && !$pembimbingKomentatorBentrok && !$pembimbingPengujiBentrok && !$mahasiswaBentrok && !$ruanganBentrok && !$kelompokBesarBentrok) {
            return null;
        }

        // Return array dengan informasi bentrok
        return [
            'dosen' => $dosenBentrok,
            'pembimbing_komentator' => $pembimbingKomentatorBentrok,
            'pembimbing_penguji' => $pembimbingPengujiBentrok,
            'mahasiswa' => $mahasiswaBentrok,
            'ruangan' => $ruanganBentrok,
            'kelompok_besar' => $kelompokBesarBentrok
        ];
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
                    'tipe' => $tipe,
                    'use_ruangan' => $item->use_ruangan ?? false,
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
            return response()->json(['message' => 'Terjadi kesalahan', 'error' => $e->getMessage(), 'data' => []], 500);
        }
    }

    /**
     * Send notification to mahasiswa in the semester
     */
    private function sendNotificationToMahasiswa($jadwal)
    {
        try {
            // Ensure relationships are loaded
            if (!$jadwal->relationLoaded('mataKuliah')) {
                $jadwal->load('mataKuliah');
            }
            if (!$jadwal->relationLoaded('ruangan')) {
                $jadwal->load('ruangan');
            }
            if (!$jadwal->relationLoaded('dosen')) {
                $jadwal->load('dosen');
            }
            if (!$jadwal->relationLoaded('createdBy')) {
                $jadwal->load('createdBy');
            }

            $semester = $jadwal->mataKuliah->semester;

            $mahasiswaList = \App\Models\User::where('role', 'mahasiswa')
                ->where('semester', $semester)
                ->get();

            // Hapus notifikasi lama untuk mahasiswa saja (bukan dosen)
            \App\Models\Notification::where('title', 'Jadwal Non Blok Non CSR Baru')
                ->where('data->jadwal_id', $jadwal->id)
                ->whereHas('user', function ($query) {
                    $query->where('role', 'mahasiswa');
                })
                ->delete();

            // Prepare notification data once
            $createdBy = $jadwal->createdBy;
            $notificationData = [
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
                'created_by' => $createdBy ? $createdBy->name : 'Admin',
                'created_by_role' => $createdBy ? $createdBy->role : 'admin',
                'sender_name' => $createdBy ? $createdBy->name : 'Admin',
                'sender_role' => $createdBy ? $createdBy->role : 'admin'
            ];

            // Send notification to each mahasiswa
            foreach ($mahasiswaList as $mahasiswa) {
                \App\Models\Notification::create([
                    'user_id' => $mahasiswa->id,
                    'title' => 'Jadwal Non Blok Non CSR Baru',
                    'message' => "Jadwal Non Blok Non CSR baru telah ditambahkan: {$jadwal->mataKuliah->nama} - " . ($jadwal->agenda ?: $jadwal->materi) . " pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}.",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => $notificationData
                ]);
            }

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

        } catch (\Exception $e) {
            // Silently fail

        }
    }

    /**
     * Cek bentrok mahasiswa (dari Seminar Proposal) vs kelompok besar/kecil di jadwal lain
     */
    private function checkMahasiswaBentrokWithKelompok($data, $semester): ?string
    {
        if (!isset($data['mahasiswa_nims']) || empty($data['mahasiswa_nims'])) {
            return null;
        }

        $mahasiswaNims = $data['mahasiswa_nims'];
        
        // Ambil mahasiswa_id dari NIM
        $mahasiswaIds = User::whereIn('nim', $mahasiswaNims)
            ->where('role', 'mahasiswa')
            ->pluck('id')
            ->toArray();

        if (empty($mahasiswaIds)) {
            return null;
        }

        // Cek bentrok dengan jadwal yang menggunakan kelompok besar
        // (JadwalKuliahBesar, JadwalAgendaKhusus dari DetailBlok, JadwalNonBlokNonCSR dari DetailNonBlokNonCSR)
        $kelompokBesarSemesters = KelompokBesar::whereIn('mahasiswa_id', $mahasiswaIds)
            ->where('semester', $semester)
            ->pluck('semester')
            ->unique()
            ->toArray();

        if (!empty($kelompokBesarSemesters)) {
            foreach ($kelompokBesarSemesters as $semesterConflict) {
                // Cek apakah ada jadwal Kuliah Besar yang menggunakan kelompok besar ini pada waktu yang sama
                $jadwalKuliahBesar = \App\Models\JadwalKuliahBesar::with(['mataKuliah'])
                    ->where('tanggal', $data['tanggal'])
                    ->where('kelompok_besar_id', $semesterConflict)
                    ->whereHas('mataKuliah', function ($q) use ($semester) {
                        if ($semester) {
                            $q->where('semester', $semester);
                        }
                    })
                    ->where(function ($q) use ($data) {
                        $q->where('jam_mulai', '<', $data['jam_selesai'])
                            ->where('jam_selesai', '>', $data['jam_mulai']);
                    })
                    ->first();

                if ($jadwalKuliahBesar) {
                    // Ambil mahasiswa yang bentrok (yang ada di kelompok besar dan juga di mahasiswa_nims)
                    $mahasiswaBentrok = KelompokBesar::where('semester', $semesterConflict)
                        ->whereIn('mahasiswa_id', $mahasiswaIds)
                        ->with('mahasiswa')
                        ->get()
                        ->map(function ($kb) {
                            return $kb->mahasiswa ? $kb->mahasiswa->name : 'N/A';
                        })
                        ->toArray();
                    
                    $mataKuliahName = $jadwalKuliahBesar->mataKuliah ? $jadwalKuliahBesar->mataKuliah->nama : 'N/A';
                    $tanggalFormatted = $jadwalKuliahBesar->tanggal ? \Carbon\Carbon::parse($jadwalKuliahBesar->tanggal)->format('d/m/Y') : 'N/A';
                    $jamFormatted = $jadwalKuliahBesar->jam_mulai && $jadwalKuliahBesar->jam_selesai ? "{$jadwalKuliahBesar->jam_mulai} - {$jadwalKuliahBesar->jam_selesai}" : 'N/A';
                    $mahasiswaList = !empty($mahasiswaBentrok) ? implode(', ', $mahasiswaBentrok) : 'N/A';
                    return "Jadwal bentrok dengan jadwal Kuliah Besar \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: mahasiswa (Mahasiswa: {$mahasiswaList} terdaftar di Kelompok Besar Semester {$semesterConflict})";
                }

                // Cek apakah ada jadwal Agenda Khusus yang menggunakan kelompok besar ini pada waktu yang sama
                $jadwalAgendaKhusus = \App\Models\JadwalAgendaKhusus::with(['mataKuliah'])
                    ->where('tanggal', $data['tanggal'])
                    ->where('kelompok_besar_id', $semesterConflict)
                    ->whereHas('mataKuliah', function ($q) use ($semester) {
                        if ($semester) {
                            $q->where('semester', $semester);
                        }
                    })
                    ->where(function ($q) use ($data) {
                        $q->where('jam_mulai', '<', $data['jam_selesai'])
                            ->where('jam_selesai', '>', $data['jam_mulai']);
                    })
                    ->first();

                if ($jadwalAgendaKhusus) {
                    // Ambil mahasiswa yang bentrok (yang ada di kelompok besar dan juga di mahasiswa_nims)
                    $mahasiswaBentrok = KelompokBesar::where('semester', $semesterConflict)
                        ->whereIn('mahasiswa_id', $mahasiswaIds)
                        ->with('mahasiswa')
                        ->get()
                        ->map(function ($kb) {
                            return $kb->mahasiswa ? $kb->mahasiswa->name : 'N/A';
                        })
                        ->toArray();
                    
                    $mataKuliahName = $jadwalAgendaKhusus->mataKuliah ? $jadwalAgendaKhusus->mataKuliah->nama : 'N/A';
                    $agendaName = $jadwalAgendaKhusus->agenda ? $jadwalAgendaKhusus->agenda : 'N/A';
                    $tanggalFormatted = $jadwalAgendaKhusus->tanggal ? \Carbon\Carbon::parse($jadwalAgendaKhusus->tanggal)->format('d/m/Y') : 'N/A';
                    $jamFormatted = $jadwalAgendaKhusus->jam_mulai && $jadwalAgendaKhusus->jam_selesai ? "{$jadwalAgendaKhusus->jam_mulai} - {$jadwalAgendaKhusus->jam_selesai}" : 'N/A';
                    $mahasiswaList = !empty($mahasiswaBentrok) ? implode(', ', $mahasiswaBentrok) : 'N/A';
                    return "Jadwal bentrok dengan jadwal Agenda Khusus \"{$agendaName}\" (Mata Kuliah: {$mataKuliahName}) pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: mahasiswa (Mahasiswa: {$mahasiswaList} terdaftar di Kelompok Besar Semester {$semesterConflict})";
                }

                // Cek apakah ada jadwal Non Blok Non CSR (Materi Kuliah atau Agenda Khusus) yang menggunakan kelompok besar ini pada waktu yang sama
                $jadwalNonBlokNonCSR = JadwalNonBlokNonCSR::with(['mataKuliah'])
                    ->where('tanggal', $data['tanggal'])
                    ->where('kelompok_besar_id', $semesterConflict)
                    ->whereIn('jenis_baris', ['materi', 'agenda'])
                    ->whereHas('mataKuliah', function ($q) use ($semester) {
                        if ($semester) {
                            $q->where('semester', $semester);
                        }
                    })
                    ->where(function ($q) use ($data) {
                        $q->where('jam_mulai', '<', $data['jam_selesai'])
                            ->where('jam_selesai', '>', $data['jam_mulai']);
                    })
                    ->first();

                if ($jadwalNonBlokNonCSR) {
                    // Ambil mahasiswa yang bentrok (yang ada di kelompok besar dan juga di mahasiswa_nims)
                    $mahasiswaBentrok = KelompokBesar::where('semester', $semesterConflict)
                        ->whereIn('mahasiswa_id', $mahasiswaIds)
                        ->with('mahasiswa')
                        ->get()
                        ->map(function ($kb) {
                            return $kb->mahasiswa ? $kb->mahasiswa->name : 'N/A';
                        })
                        ->toArray();
                    
                    $mataKuliahName = $jadwalNonBlokNonCSR->mataKuliah ? $jadwalNonBlokNonCSR->mataKuliah->nama : 'N/A';
                    $jenisJadwal = $jadwalNonBlokNonCSR->jenis_baris === 'materi' ? 'Materi Kuliah' : 'Agenda Khusus';
                    $materiOrAgenda = $jadwalNonBlokNonCSR->jenis_baris === 'materi' ? ($jadwalNonBlokNonCSR->materi ?: 'N/A') : ($jadwalNonBlokNonCSR->agenda ?: 'N/A');
                    $tanggalFormatted = $jadwalNonBlokNonCSR->tanggal ? \Carbon\Carbon::parse($jadwalNonBlokNonCSR->tanggal)->format('d/m/Y') : 'N/A';
                    $jamFormatted = $jadwalNonBlokNonCSR->jam_mulai && $jadwalNonBlokNonCSR->jam_selesai ? "{$jadwalNonBlokNonCSR->jam_mulai} - {$jadwalNonBlokNonCSR->jam_selesai}" : 'N/A';
                    $mahasiswaList = !empty($mahasiswaBentrok) ? implode(', ', $mahasiswaBentrok) : 'N/A';
                    return "Jadwal bentrok dengan jadwal {$jenisJadwal} \"{$materiOrAgenda}\" (Mata Kuliah: {$mataKuliahName}) pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: mahasiswa (Mahasiswa: {$mahasiswaList} terdaftar di Kelompok Besar Semester {$semesterConflict})";
                }
            }
        }

        // Cek bentrok dengan jadwal yang menggunakan kelompok kecil
        // (JadwalPBL, JadwalJurnalReading dari DetailBlok)
        $kelompokKecilIds = \App\Models\KelompokKecil::whereHas('mahasiswa', function ($q) use ($mahasiswaIds) {
            $q->whereIn('id', $mahasiswaIds);
        })->pluck('id')->toArray();

        if (!empty($kelompokKecilIds)) {
            $jadwalPBL = \App\Models\JadwalPBL::with(['mataKuliah'])
                ->where('tanggal', $data['tanggal'])
                ->whereIn('kelompok_kecil_id', $kelompokKecilIds)
                ->whereHas('mataKuliah', function ($q) use ($semester) {
                    if ($semester) {
                        $q->where('semester', $semester);
                    }
                })
                ->where(function ($q) use ($data) {
                    $q->where('jam_mulai', '<', $data['jam_selesai'])
                        ->where('jam_selesai', '>', $data['jam_mulai']);
                })
                ->first();

            if ($jadwalPBL) {
                // Ambil mahasiswa yang bentrok (yang ada di kelompok kecil dan juga di mahasiswa_nims)
                $mahasiswaBentrok = \App\Models\KelompokKecil::whereIn('id', $kelompokKecilIds)
                    ->whereIn('mahasiswa_id', $mahasiswaIds)
                    ->with('mahasiswa')
                    ->get()
                    ->map(function ($kk) {
                        return $kk->mahasiswa ? $kk->mahasiswa->name : 'N/A';
                    })
                    ->unique()
                    ->toArray();
                
                $mataKuliahName = $jadwalPBL->mataKuliah ? $jadwalPBL->mataKuliah->nama : 'N/A';
                $tanggalFormatted = $jadwalPBL->tanggal ? \Carbon\Carbon::parse($jadwalPBL->tanggal)->format('d/m/Y') : 'N/A';
                $jamFormatted = $jadwalPBL->jam_mulai && $jadwalPBL->jam_selesai ? "{$jadwalPBL->jam_mulai} - {$jadwalPBL->jam_selesai}" : 'N/A';
                $mahasiswaList = !empty($mahasiswaBentrok) ? implode(', ', $mahasiswaBentrok) : 'N/A';
                $kelompokKecilInfo = $jadwalPBL->kelompokKecil ? "Kelompok Kecil ID: {$jadwalPBL->kelompok_kecil_id}" : 'Kelompok Kecil';
                return "Jadwal bentrok dengan jadwal PBL \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: mahasiswa (Mahasiswa: {$mahasiswaList} terdaftar di {$kelompokKecilInfo})";
            }

            $jadwalJurnal = \App\Models\JadwalJurnalReading::with(['mataKuliah'])
                ->where('tanggal', $data['tanggal'])
                ->whereIn('kelompok_kecil_id', $kelompokKecilIds)
                ->whereHas('mataKuliah', function ($q) use ($semester) {
                    if ($semester) {
                        $q->where('semester', $semester);
                    }
                })
                ->where(function ($q) use ($data) {
                    $q->where('jam_mulai', '<', $data['jam_selesai'])
                        ->where('jam_selesai', '>', $data['jam_mulai']);
                })
                ->first();

            if ($jadwalJurnal) {
                // Ambil mahasiswa yang bentrok (yang ada di kelompok kecil dan juga di mahasiswa_nims)
                $mahasiswaBentrok = \App\Models\KelompokKecil::whereIn('id', $kelompokKecilIds)
                    ->whereIn('mahasiswa_id', $mahasiswaIds)
                    ->with('mahasiswa')
                    ->get()
                    ->map(function ($kk) {
                        return $kk->mahasiswa ? $kk->mahasiswa->name : 'N/A';
                    })
                    ->unique()
                    ->toArray();
                
                $mataKuliahName = $jadwalJurnal->mataKuliah ? $jadwalJurnal->mataKuliah->nama : 'N/A';
                $tanggalFormatted = $jadwalJurnal->tanggal ? \Carbon\Carbon::parse($jadwalJurnal->tanggal)->format('d/m/Y') : 'N/A';
                $jamFormatted = $jadwalJurnal->jam_mulai && $jadwalJurnal->jam_selesai ? "{$jadwalJurnal->jam_mulai} - {$jadwalJurnal->jam_selesai}" : 'N/A';
                $mahasiswaList = !empty($mahasiswaBentrok) ? implode(', ', $mahasiswaBentrok) : 'N/A';
                $kelompokKecilInfo = $jadwalJurnal->kelompokKecil ? "Kelompok Kecil ID: {$jadwalJurnal->kelompok_kecil_id}" : 'Kelompok Kecil';
                return "Jadwal bentrok dengan jadwal Jurnal Reading \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: mahasiswa (Mahasiswa: {$mahasiswaList} terdaftar di {$kelompokKecilInfo})";
            }
        }

        // Cek bentrok dengan jadwal CSR (dari DetailNonBlokCSR)
        $jadwalCSR = \App\Models\JadwalCSR::with(['mataKuliah'])
            ->where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->whereHas('kelompokKecil', function ($q) use ($mahasiswaIds) {
                $q->whereHas('mahasiswa', function ($subQ) use ($mahasiswaIds) {
                    $subQ->whereIn('id', $mahasiswaIds);
                });
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($jadwalCSR) {
            // Ambil mahasiswa yang bentrok (yang ada di kelompok kecil dan juga di mahasiswa_nims)
            $kelompokKecilCSR = $jadwalCSR->kelompokKecil;
            $mahasiswaBentrok = [];
            // Karena CSR menggunakan relasi many-to-many, kita perlu ambil semua mahasiswa dari kelompok kecil yang terkait
            if ($kelompokKecilCSR) {
                $kelompokKecilCSR->load('mahasiswa');
                foreach ($kelompokKecilCSR->mahasiswa as $mahasiswa) {
                    if (in_array($mahasiswa->id, $mahasiswaIds)) {
                        $mahasiswaBentrok[] = $mahasiswa->name;
                    }
                }
            }
            
            $mataKuliahName = $jadwalCSR->mataKuliah ? $jadwalCSR->mataKuliah->nama : 'N/A';
            $tanggalFormatted = $jadwalCSR->tanggal ? \Carbon\Carbon::parse($jadwalCSR->tanggal)->format('d/m/Y') : 'N/A';
            $jamFormatted = $jadwalCSR->jam_mulai && $jadwalCSR->jam_selesai ? "{$jadwalCSR->jam_mulai} - {$jadwalCSR->jam_selesai}" : 'N/A';
            $mahasiswaList = !empty($mahasiswaBentrok) ? implode(', ', $mahasiswaBentrok) : 'N/A';
            $kelompokKecilInfo = $kelompokKecilCSR ? "Kelompok Kecil ID: {$jadwalCSR->kelompok_kecil_id}" : 'Kelompok Kecil';
            return "Jadwal bentrok dengan jadwal CSR \"{$mataKuliahName}\" pada {$tanggalFormatted} jam {$jamFormatted}. Konflik pada: mahasiswa (Mahasiswa: {$mahasiswaList} terdaftar di {$kelompokKecilInfo})";
        }

        return null;
    }
}
