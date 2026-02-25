<?php

namespace App\Http\Controllers;

use App\Models\JadwalNonBlokNonCSR;
use App\Models\User;
use App\Models\Notification;
use App\Models\KelompokBesar;
use App\Models\AbsensiNonBlokNonCSR;
use App\Models\MataKuliah;
use App\Services\JadwalValidationService;
use App\Traits\SendsWhatsAppNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Illuminate\Validation\Rule;

class JadwalNonBlokNonCSRController extends Controller
{
    use SendsWhatsAppNotification;

    private JadwalValidationService $validationService;

    public function __construct(JadwalValidationService $validationService)
    {
        $this->validationService = $validationService;
    }

    private function resolveScheduleType(string $jenisBaris): string
    {
        return match ($jenisBaris) {
            'materi' => 'jadwal_non_blok_non_csr',
            'agenda' => 'agenda_khusus',
            'seminar_proposal' => 'seminar_proposal',
            'sidang_skripsi' => 'sidang_skripsi',
            default => 'jadwal_non_blok_non_csr',
        };
    }

    private function getAllowedJenisBaris(bool $isSemesterAntara): array
    {
        return $isSemesterAntara
            ? ['materi', 'agenda']
            : ['materi', 'agenda', 'seminar_proposal', 'sidang_skripsi'];
    }

    public function show($id)
    {
        try {
            $jadwal = JadwalNonBlokNonCSR::with([
                'mataKuliah:kode,nama,semester,tanggal_mulai,tanggal_akhir',
                'dosen:id,name,nid,nidn,nuptk,signature_image',
                'pembimbing:id,name,nid,nidn,nuptk',
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

            // Format tanggal
            $tanggalFormatted = $jadwal->tanggal ? $jadwal->tanggal->format('d-m-Y') : null;

            // Get komentator list
            $komentatorIds = $jadwal->komentator_ids ?? [];
            if (!is_array($komentatorIds)) {
                $komentatorIds = json_decode($komentatorIds, true) ?? [];
            }
            $komentatorList = [];
            if (!empty($komentatorIds)) {
                $komentatorList = User::whereIn('id', $komentatorIds)
                    ->select('id', 'name', 'nid')
                    ->get()
                    ->toArray();
            }

            // Get penguji list
            $pengujiIds = $jadwal->penguji_ids ?? [];
            if (!is_array($pengujiIds)) {
                $pengujiIds = json_decode($pengujiIds, true) ?? [];
            }
            $pengujiList = [];
            if (!empty($pengujiIds)) {
                $pengujiList = User::whereIn('id', $pengujiIds)
                    ->select('id', 'name', 'nid')
                    ->get()
                    ->toArray();
            }

            // Get mahasiswa list
            $mahasiswaNims = $jadwal->mahasiswa_nims ?? [];
            if (!is_array($mahasiswaNims)) {
                $mahasiswaNims = json_decode($mahasiswaNims, true) ?? [];
            }
            $mahasiswaList = [];
            if (!empty($mahasiswaNims)) {
                $mahasiswaList = User::whereIn('nim', $mahasiswaNims)
                    ->where('role', 'mahasiswa')
                    ->select('id', 'nim', 'name')
                    ->get()
                    ->toArray();
            }

            // Determine dosen_role for current user
            $currentUserId = Auth::id();
            $dosenRole = null;

            if ($currentUserId) {
                // Check if pembimbing/moderator
                if ($jadwal->pembimbing_id == $currentUserId) {
                    $dosenRole = 'Pembimbing / Moderator';
                }
                // Check if komentator
                elseif (in_array($currentUserId, $komentatorIds)) {
                    $komentatorIndex = array_search($currentUserId, $komentatorIds);
                    if ($komentatorIndex === 0) {
                        $dosenRole = 'Komentator 1 (Materi)';
                    } else {
                        $dosenRole = 'Komentator 2 (Metlit)';
                    }
                }
                // Check if penguji
                elseif (in_array($currentUserId, $pengujiIds)) {
                    $pengujiIndex = array_search($currentUserId, $pengujiIds);
                    $dosenRole = 'Penguji ' . ($pengujiIndex + 1);
                }
                // Check if dosen
                elseif ($jadwal->dosen_id == $currentUserId) {
                    $dosenRole = 'Dosen';
                }
            }

            // Get pembimbing data
            $pembimbing = null;
            if ($jadwal->pembimbing_id) {
                if ($jadwal->relationLoaded('pembimbing') && $jadwal->pembimbing) {
                    // Gunakan relasi yang sudah di-load
                    $pembimbing = [
                        'id' => $jadwal->pembimbing->id,
                        'name' => $jadwal->pembimbing->name,
                        'nid' => $jadwal->pembimbing->nid,
                        'nidn' => $jadwal->pembimbing->nidn,
                        'nuptk' => $jadwal->pembimbing->nuptk,
                    ];
                } else {
                    // Fallback: query manual jika relasi belum di-load
                    $pembimbingData = User::find($jadwal->pembimbing_id);
                    if ($pembimbingData) {
                        $pembimbing = [
                            'id' => $pembimbingData->id,
                            'name' => $pembimbingData->name,
                            'nid' => $pembimbingData->nid,
                            'nidn' => $pembimbingData->nidn,
                            'nuptk' => $pembimbingData->nuptk,
                        ];
                    }
                }
            }

            // Build response
            $responseData = $jadwal->toArray();
            $responseData['tanggal'] = $tanggalFormatted;
            $responseData['pembimbing'] = $pembimbing;
            $responseData['komentator_list'] = $komentatorList;
            $responseData['penguji_list'] = $pengujiList;
            $responseData['mahasiswa_list'] = $mahasiswaList;
            $responseData['dosen_role'] = $dosenRole;

            return response()->json([
                'message' => 'Data jadwal berhasil diambil',
                'data' => $responseData
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
                'pembimbing:id,name,nid,nidn,nuptk',
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
                    'pembimbing_id',
                    'komentator_ids',
                    'penguji_ids',
                    'mahasiswa_nims',
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
                })
                ->orWhere(function ($q) use ($dosenId) {
                    // Kondisi 3: Untuk seminar_proposal dan sidang_skripsi, cek pembimbing_id, komentator_ids, dan penguji_ids
                    // TIDAK filter berdasarkan semester_type karena seminar proposal dan sidang skripsi tidak menggunakan semester_type
                    $q->whereIn('jenis_baris', ['seminar_proposal', 'sidang_skripsi'])
                        ->where(function ($subQ) use ($dosenId) {
                            // Cek pembimbing_id
                            $subQ->where('pembimbing_id', $dosenId)
                                // Cek komentator_ids (untuk seminar_proposal)
                                ->orWhere(function ($komentatorQ) use ($dosenId) {
                                    $komentatorQ->whereNotNull('komentator_ids')
                                        ->where(function ($kSubQ) use ($dosenId) {
                                            $kSubQ->whereRaw('JSON_CONTAINS(komentator_ids, ?)', [json_encode($dosenId)])
                                                ->orWhereRaw('JSON_SEARCH(komentator_ids, "one", ?) IS NOT NULL', [$dosenId])
                                                ->orWhereRaw('CAST(komentator_ids AS CHAR) LIKE ?', ['%"' . $dosenId . '"%'])
                                                ->orWhereRaw('CAST(komentator_ids AS CHAR) LIKE ?', ['%' . $dosenId . '%']);
                                        });
                                })
                                // Cek penguji_ids (untuk sidang_skripsi)
                                ->orWhere(function ($pengujiQ) use ($dosenId) {
                                    $pengujiQ->whereNotNull('penguji_ids')
                                        ->where(function ($pSubQ) use ($dosenId) {
                                            $pSubQ->whereRaw('JSON_CONTAINS(penguji_ids, ?)', [json_encode($dosenId)])
                                                ->orWhereRaw('JSON_SEARCH(penguji_ids, "one", ?) IS NOT NULL', [$dosenId])
                                                ->orWhereRaw('CAST(penguji_ids AS CHAR) LIKE ?', ['%"' . $dosenId . '"%'])
                                                ->orWhereRaw('CAST(penguji_ids AS CHAR) LIKE ?', ['%' . $dosenId . '%']);
                                        });
                                });
                        });
                });

            $jadwalData = $query->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();


            // Filter jadwal yang benar-benar memiliki dosenId (untuk dosen_ids array, pembimbing_id, komentator_ids, penguji_ids)
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
                // Untuk seminar_proposal dan sidang_skripsi, cek pembimbing_id, komentator_ids, dan penguji_ids
                if (in_array($item->jenis_baris, ['seminar_proposal', 'sidang_skripsi'])) {
                    // Cek pembimbing_id
                    if ($item->pembimbing_id == $dosenId) {
                        return true;
                    }
                    // Cek komentator_ids (untuk seminar_proposal)
                    if (!empty($item->komentator_ids)) {
                        $komentatorIds = is_array($item->komentator_ids) ? $item->komentator_ids : json_decode($item->komentator_ids, true);
                        if (is_array($komentatorIds) && in_array($dosenId, $komentatorIds)) {
                            return true;
                        }
                    }
                    // Cek penguji_ids (untuk sidang_skripsi)
                    if (!empty($item->penguji_ids)) {
                        $pengujiIds = is_array($item->penguji_ids) ? $item->penguji_ids : json_decode($item->penguji_ids, true);
                        if (is_array($pengujiIds) && in_array($dosenId, $pengujiIds)) {
                            return true;
                        }
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

                // Untuk seminar_proposal dan sidang_skripsi, tambahkan informasi pembimbing, komentator, dan penguji
                $isPembimbing = false;
                $komentatorList = [];
                $pengujiList = [];
                $komentatorIds = [];
                $pengujiIds = [];
                $pembimbing = null;

                if (in_array($jadwal->jenis_baris, ['seminar_proposal', 'sidang_skripsi'])) {
                    // Cek apakah dosen ini adalah pembimbing
                    $isPembimbing = ($jadwal->pembimbing_id == $dosenId);

                    // Ambil data pembimbing - gunakan relasi eager-loaded jika ada, jika tidak query manual
                    if (!empty($jadwal->pembimbing_id)) {
                        if ($jadwal->relationLoaded('pembimbing') && $jadwal->pembimbing) {
                            // Gunakan relasi yang sudah di-load
                            $pembimbing = [
                                'id' => $jadwal->pembimbing->id,
                                'name' => $jadwal->pembimbing->name,
                                'nid' => $jadwal->pembimbing->nid,
                                'nidn' => $jadwal->pembimbing->nidn,
                                'nuptk' => $jadwal->pembimbing->nuptk,
                            ];
                        } else {
                            // Fallback: query manual jika relasi belum di-load
                            $pembimbingData = User::find($jadwal->pembimbing_id);
                            if ($pembimbingData) {
                                $pembimbing = [
                                    'id' => $pembimbingData->id,
                                    'name' => $pembimbingData->name,
                                    'nid' => $pembimbingData->nid,
                                    'nidn' => $pembimbingData->nidn,
                                    'nuptk' => $pembimbingData->nuptk,
                                ];
                            }
                        }
                    }

                    // Parse komentator_ids dan penguji_ids
                    if (!empty($jadwal->komentator_ids)) {
                        $komentatorIds = is_array($jadwal->komentator_ids) ? $jadwal->komentator_ids : json_decode($jadwal->komentator_ids, true);
                        if (is_array($komentatorIds)) {
                            $komentatorList = User::whereIn('id', $komentatorIds)
                                ->select('id', 'name', 'nid', 'nidn', 'nuptk')
                                ->get()
                                ->map(function ($dosen) {
                                    return [
                                        'id' => $dosen->id,
                                        'name' => $dosen->name,
                                        'nid' => $dosen->nid,
                                        'nidn' => $dosen->nidn,
                                        'nuptk' => $dosen->nuptk,
                                    ];
                                })
                                ->toArray();
                        }
                    }

                    if (!empty($jadwal->penguji_ids)) {
                        $pengujiIds = is_array($jadwal->penguji_ids) ? $jadwal->penguji_ids : json_decode($jadwal->penguji_ids, true);
                        if (is_array($pengujiIds)) {
                            $pengujiList = User::whereIn('id', $pengujiIds)
                                ->select('id', 'name', 'nid', 'nidn', 'nuptk')
                                ->get()
                                ->map(function ($dosen) {
                                    return [
                                        'id' => $dosen->id,
                                        'name' => $dosen->name,
                                        'nid' => $dosen->nid,
                                        'nidn' => $dosen->nidn,
                                        'nuptk' => $dosen->nuptk,
                                    ];
                                })
                                ->toArray();
                        }
                    }

                    // Update is_active_dosen untuk seminar proposal dan sidang skripsi
                    // Dosen aktif jika dia pembimbing, komentator, atau penguji
                    if (!$isActiveDosen) {
                        $isActiveDosen = $isPembimbing ||
                                        (is_array($komentatorIds) && in_array($dosenId, $komentatorIds)) ||
                                        (is_array($pengujiIds) && in_array($dosenId, $pengujiIds));
                    }
                }

                // Ambil mahasiswa_nims dan mahasiswa_list
                $mahasiswaNims = $jadwal->mahasiswa_nims ?? [];
                if (!is_array($mahasiswaNims)) {
                    $mahasiswaNims = json_decode($mahasiswaNims, true) ?? [];
                }
                $mahasiswaList = [];
                if (!empty($mahasiswaNims)) {
                    $mahasiswaList = User::whereIn('nim', $mahasiswaNims)
                        ->where('role', 'mahasiswa')
                        ->select('id', 'nim', 'name')
                        ->get()
                        ->toArray();
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
                    'tipe' => match($jadwal->jenis_baris) {
                        'seminar_proposal' => 'Seminar Proposal',
                        'sidang_skripsi' => 'Sidang Skripsi',
                        'agenda' => 'Agenda Khusus',
                        default => 'Jadwal Materi'
                    },
                    'jenis_jadwal' => 'non_blok_non_csr',
                    'pengampu' => $pengampu,
                    'dosen' => $jadwal->dosen,
                    'dosen_id' => $jadwal->dosen_id,
                    'dosen_ids' => $dosenIds,
                    'is_active_dosen' => $isActiveDosen, // Flag: apakah dosen ini adalah dosen aktif
                    'is_in_history' => $isInHistory, // Flag: apakah dosen ini hanya ada di history
                    'is_pembimbing' => $isPembimbing, // Flag: apakah dosen ini adalah pembimbing (untuk seminar proposal dan sidang skripsi)
                    'pembimbing_id' => $jadwal->pembimbing_id ?? null,
                    'pembimbing' => $pembimbing, // Object pembimbing dengan id, name, nid, nidn, nuptk
                    'komentator_ids' => $komentatorIds,
                    'komentator_list' => $komentatorList,
                    'penguji_ids' => $pengujiIds,
                    'penguji_list' => $pengujiList,
                    'mahasiswa_nims' => $mahasiswaNims,
                    'mahasiswa_list' => $mahasiswaList,
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

            // Untuk seminar_proposal dan sidang_skripsi, hanya pembimbing yang bisa konfirmasi
            if (in_array($jadwal->jenis_baris, ['seminar_proposal', 'sidang_skripsi'])) {
                if ($jadwal->pembimbing_id == $request->dosen_id) {
                    $hasAccess = true;
                }
            } else {
                // Untuk jadwal biasa, cek dosen_id atau dosen_ids
            if ($jadwal->dosen_id == $request->dosen_id) {
                $hasAccess = true;
            } elseif ($jadwal->dosen_ids && is_array($jadwal->dosen_ids) && !empty($jadwal->dosen_ids)) {
                $hasAccess = in_array($request->dosen_id, $jadwal->dosen_ids);
                }
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
            $mataKuliah = MataKuliah::where('kode', $kode)->first();
            if (!$mataKuliah) {
                return response()->json([
                    'message' => 'Mata kuliah tidak ditemukan'
                ], 404);
            }

            $isSemesterAntara = $mataKuliah->semester === 'Antara';

            $request->validate([
                'tanggal' => 'required|date',
                'jam_mulai' => 'required',
                'jam_selesai' => 'required',
                'jumlah_sesi' => 'required|integer',
                'jenis_baris' => ['required', Rule::in($this->getAllowedJenisBaris($isSemesterAntara))],
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

            if ($isSemesterAntara && in_array($request->jenis_baris, ['seminar_proposal', 'sidang_skripsi'], true)) {
                return response()->json([
                    'message' => 'Jenis jadwal tidak tersedia untuk Semester Antara.'
                ], 422);
            }

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

            $scheduleType = $this->resolveScheduleType($request->jenis_baris);

            $dataForValidation = [
                'mata_kuliah_kode' => $kode,
                'tanggal' => $request->tanggal,
                'jam_mulai' => $request->jam_mulai,
                'jam_selesai' => $request->jam_selesai,
                'dosen_id' => $request->dosen_id,
                'dosen_ids' => $request->dosen_ids,
                'pembimbing_id' => $request->pembimbing_id,
                'komentator_ids' => $request->komentator_ids,
                'penguji_ids' => $request->penguji_ids,
                'ruangan_id' => ($request->use_ruangan ?? true) ? $request->ruangan_id : null,
                'kelompok_besar_id' => $request->kelompok_besar_id,
                'kelompok_besar_antara_id' => $request->kelompok_besar_antara_id,
                'mahasiswa_nims' => $request->mahasiswa_nims,
                'jenis_baris' => $request->jenis_baris,
            ];

            $tanggalMessage = $this->validationService->validateTanggalMataKuliah($dataForValidation, $mataKuliah);
            if ($tanggalMessage) {
                return response()->json(['message' => $tanggalMessage], 422);
            }

            $kapasitasMessage = $this->validationService->validateRoomCapacity($dataForValidation, $scheduleType, $isSemesterAntara);
            if ($kapasitasMessage) {
                return response()->json(['message' => $kapasitasMessage], 422);
            }

            $bentrokMessage = $this->validationService->validateConflict($dataForValidation, $scheduleType, null, $isSemesterAntara);
            if ($bentrokMessage) {
                return response()->json(['message' => $bentrokMessage], 422);
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

            // Clear cache untuk mata kuliah terkait
            Cache::forget('mata_kuliah_' . $kode);

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

            // Untuk semua jenis jadwal: dosen_id dan dosen_ids
            if ($jadwal->dosen_id) {
                $dosenIds[] = $jadwal->dosen_id;
            }

            if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
                $dosenIds = array_merge($dosenIds, $jadwal->dosen_ids);
            }

            // Untuk seminar_proposal dan sidang_skripsi: tambahkan pembimbing, komentator, penguji
            if ($jadwal->jenis_baris === 'seminar_proposal' || $jadwal->jenis_baris === 'sidang_skripsi') {
                // Tambahkan pembimbing
                if ($jadwal->pembimbing_id) {
                    $dosenIds[] = $jadwal->pembimbing_id;
                }

                // Untuk seminar_proposal: tambahkan komentator
                if ($jadwal->jenis_baris === 'seminar_proposal' && $jadwal->komentator_ids && is_array($jadwal->komentator_ids)) {
                    $dosenIds = array_merge($dosenIds, $jadwal->komentator_ids);
                }

                // Untuk sidang_skripsi: tambahkan penguji
                if ($jadwal->jenis_baris === 'sidang_skripsi' && $jadwal->penguji_ids && is_array($jadwal->penguji_ids)) {
                    $dosenIds = array_merge($dosenIds, $jadwal->penguji_ids);
                }
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
                    'is_read' => false,
                    'data' => array_merge($baseData, [
                        'dosen_id' => $dosen->id,
                        'dosen_name' => $dosen->name,
                        'dosen_role' => $dosen->role
                    ])
                ]);

                // Kirim WhatsApp notification
                try {
                    $whatsappMessage = $this->formatScheduleMessage('non_blok_non_csr', [
                        'mata_kuliah_nama' => $mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal->format('Y-m-d'),
                        'jam_mulai' => $jadwal->jam_mulai,
                        'jam_selesai' => $jadwal->jam_selesai,
                        'ruangan' => $ruangan && $jadwal->use_ruangan ? $ruangan->nama : null,
                        'materi' => $jadwal->materi,
                        'agenda' => $jadwal->agenda,
                        'jenis_baris' => $jadwal->jenis_baris,
                    ]);

                    $this->sendWhatsAppNotification($dosen, $whatsappMessage, [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'non_blok_non_csr',
                        'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                        'mata_kuliah_nama' => $mataKuliah->nama,
                    ]);

                    Log::info("Notifikasi WhatsApp jadwal non_blok_non_csr berhasil dikirim ke dosen {$dosen->name} (ID: {$dosenId})");
                } catch (\Exception $whatsappError) {
                    Log::error("Gagal mengirim WhatsApp notification ke dosen {$dosenId}: " . $whatsappError->getMessage());
                    // Continue dengan dosen berikutnya, jangan stop proses
                }
            }
        } catch (\Exception $e) {
            Log::error("Gagal mengirim notifikasi jadwal non_blok_non_csr: " . $e->getMessage());
        }
    }

    public function index($kode)
    {
        try {
            $jadwal = JadwalNonBlokNonCSR::WithoutSemesterFilter()
                ->with(['mataKuliah', 'dosen:id,name,nid,nidn,nuptk,signature_image', 'ruangan', 'kelompokBesar', 'kelompokBesarAntara'])
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
            $mataKuliah = MataKuliah::where('kode', $kode)->first();
            if (!$mataKuliah) {
                return response()->json([
                    'message' => 'Mata kuliah tidak ditemukan'
                ], 404);
            }
            $isSemesterAntara = $mataKuliah->semester === 'Antara';

            $request->validate([
                'tanggal' => 'required|date',
                'jam_mulai' => 'required',
                'jam_selesai' => 'required',
                'jumlah_sesi' => 'required|integer',
                'jenis_baris' => ['required', Rule::in($this->getAllowedJenisBaris($isSemesterAntara))],
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

            $scheduleType = $this->resolveScheduleType($request->jenis_baris);

            $dataForValidation = [
                'mata_kuliah_kode' => $kode,
                'tanggal' => $request->tanggal,
                'jam_mulai' => $request->jam_mulai,
                'jam_selesai' => $request->jam_selesai,
                'dosen_id' => $request->dosen_id,
                'dosen_ids' => $request->dosen_ids,
                'pembimbing_id' => $request->pembimbing_id,
                'komentator_ids' => $request->komentator_ids,
                'penguji_ids' => $request->penguji_ids,
                'ruangan_id' => ($request->use_ruangan ?? true) ? $request->ruangan_id : null,
                'kelompok_besar_id' => $request->kelompok_besar_id,
                'kelompok_besar_antara_id' => $request->kelompok_besar_antara_id,
                'mahasiswa_nims' => $request->mahasiswa_nims,
                'jenis_baris' => $request->jenis_baris,
            ];

            $tanggalMessage = $this->validationService->validateTanggalMataKuliah($dataForValidation, $mataKuliah);
            if ($tanggalMessage) {
                return response()->json(['message' => $tanggalMessage], 422);
            }

            $kapasitasMessage = $this->validationService->validateRoomCapacity($dataForValidation, $scheduleType, $isSemesterAntara);
            if ($kapasitasMessage) {
                return response()->json(['message' => $kapasitasMessage], 422);
            }

            $bentrokMessage = $this->validationService->validateConflict($dataForValidation, $scheduleType, $id, $isSemesterAntara);
            if ($bentrokMessage) {
                return response()->json(['message' => $bentrokMessage], 422);
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

            // Clear cache untuk mata kuliah terkait
            Cache::forget('mata_kuliah_' . $kode);

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

            // Clear cache untuk mata kuliah terkait
            Cache::forget('mata_kuliah_' . $kode);

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
                'data.*.kelompok_besar_antara_id' => 'nullable|exists:kelompok_besar_antara,id',
                'data.*.dosen_id' => 'nullable|exists:users,id',
                'data.*.dosen_ids' => 'nullable|array',
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

            $cacheKey = 'mata_kuliah_' . $kode;
            $mataKuliah = Cache::remember($cacheKey, 3600, function () use ($kode) {
                return MataKuliah::where('kode', $kode)->first();
            });
            if (!$mataKuliah) {
                return response()->json([
                    'message' => 'Mata kuliah tidak ditemukan'
                ], 404);
            }

            $isSemesterAntara = $mataKuliah->semester === 'Antara';
            $allowedJenisBaris = $this->getAllowedJenisBaris($isSemesterAntara);

            $errors = [];
            $excelData = $request->data;

            foreach ($excelData as $index => $row) {
                if (!isset($row['jenis_baris']) || !in_array($row['jenis_baris'], $allowedJenisBaris, true)) {
                    $errors[] = "Baris " . ($index + 1) . ": Jenis jadwal tidak tersedia untuk semester ini.";
                }
            }

            if (count($errors) > 0) {
                return response()->json([
                    'success' => false,
                    'total' => count($excelData),
                    'errors' => $errors,
                    'message' => "Gagal mengimport data. Semua data harus valid untuk dapat diimport."
                ], 422);
            }

            // Validasi bentrok antar baris import (all-or-nothing)
            for ($i = 0; $i < count($excelData); $i++) {
                for ($j = 0; $j < $i; $j++) {
                    $row1 = $excelData[$i];
                    $row2 = $excelData[$j];

                    $row1['mata_kuliah_kode'] = $kode;
                    $row2['mata_kuliah_kode'] = $kode;

                    if (isset($row1['use_ruangan']) && $row1['use_ruangan'] === false) {
                        $row1['ruangan_id'] = null;
                    }
                    if (isset($row2['use_ruangan']) && $row2['use_ruangan'] === false) {
                        $row2['ruangan_id'] = null;
                    }

                    $type1 = $this->resolveScheduleType($row1['jenis_baris']);
                    $type2 = $this->resolveScheduleType($row2['jenis_baris']);

                    $detail =
                        $this->validationService->validateImportDataConflictDetail($row1, $row2, $type1, $isSemesterAntara)
                        ?? $this->validationService->validateImportDataConflictDetail($row1, $row2, $type2, $isSemesterAntara);

                    if ($detail) {
                        $errors[] = "Baris " . ($i + 1) . ": Jadwal bentrok dengan data pada baris " . ($j + 1) . " (" . $detail . ")";
                        break 2;
                    }
                }
            }

            if (count($errors) > 0) {
                return response()->json([
                    'success' => false,
                    'total' => count($excelData),
                    'errors' => $errors,
                    'message' => "Gagal mengimport data. Semua data harus valid untuk dapat diimport."
                ], 422);
            }

            // Validasi per baris (tanggal, kapasitas, bentrok database)
            foreach ($excelData as $index => $row) {
                try {
                    $row['mata_kuliah_kode'] = $kode;

                    if (isset($row['use_ruangan']) && $row['use_ruangan'] === false) {
                        $row['ruangan_id'] = null;
                    }

                    $tanggalMessage = $this->validationService->validateTanggalMataKuliah($row, $mataKuliah);
                    if ($tanggalMessage) {
                        $errors[] = "Baris " . ($index + 1) . ": " . $tanggalMessage;
                        continue;
                    }

                    if (($row['jenis_baris'] ?? null) === 'materi') {
                        if (empty($row['dosen_id'])) {
                            $errors[] = "Baris " . ($index + 1) . ": Dosen wajib diisi untuk jenis materi";
                            continue;
                        }
                        if (empty($row['materi'])) {
                            $errors[] = "Baris " . ($index + 1) . ": Materi wajib diisi untuk jenis materi";
                            continue;
                        }
                        if (empty($row['ruangan_id'])) {
                            $errors[] = "Baris " . ($index + 1) . ": Ruangan wajib diisi untuk jenis materi";
                            continue;
                        }
                    }

                    if (($row['jenis_baris'] ?? null) === 'agenda') {
                        if (empty($row['agenda'])) {
                            $errors[] = "Baris " . ($index + 1) . ": Agenda wajib diisi untuk jenis agenda";
                            continue;
                        }
                    }

                    if (($row['jenis_baris'] ?? null) === 'seminar_proposal') {
                        if (empty($row['pembimbing_id'])) {
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
                        $duplicateIds = array_intersect([$row['pembimbing_id']], $row['komentator_ids']);
                        if (!empty($duplicateIds)) {
                            $duplicateNames = User::whereIn('id', $duplicateIds)->pluck('name')->toArray();
                            $errors[] = "Baris " . ($index + 1) . ": Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Komentator: " . implode(', ', $duplicateNames);
                            continue;
                        }
                        if (empty($row['mahasiswa_nims']) || count($row['mahasiswa_nims']) === 0) {
                            $errors[] = "Baris " . ($index + 1) . ": Mahasiswa wajib diisi (minimal 1) untuk Seminar Proposal";
                            continue;
                        }
                    }

                    if (($row['jenis_baris'] ?? null) === 'sidang_skripsi') {
                        if (empty($row['pembimbing_id'])) {
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
                        $duplicateIds = array_intersect([$row['pembimbing_id']], $row['penguji_ids']);
                        if (!empty($duplicateIds)) {
                            $duplicateNames = User::whereIn('id', $duplicateIds)->pluck('name')->toArray();
                            $errors[] = "Baris " . ($index + 1) . ": Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Penguji: " . implode(', ', $duplicateNames);
                            continue;
                        }
                        if (empty($row['mahasiswa_nims']) || count($row['mahasiswa_nims']) === 0) {
                            $errors[] = "Baris " . ($index + 1) . ": Mahasiswa wajib diisi (minimal 1) untuk Sidang Skripsi";
                            continue;
                        }
                    }

                    $scheduleType = $this->resolveScheduleType($row['jenis_baris']);

                    $kapasitasMessage = $this->validationService->validateRoomCapacity($row, $scheduleType, $isSemesterAntara);
                    if ($kapasitasMessage) {
                        $errors[] = "Baris " . ($index + 1) . ": " . $kapasitasMessage;
                        continue;
                    }

                    $bentrokMessage = $this->validationService->validateConflict($row, $scheduleType, null, $isSemesterAntara);
                    if ($bentrokMessage) {
                        $errors[] = "Baris " . ($index + 1) . ": " . $bentrokMessage;
                        continue;
                    }
                } catch (\Exception $e) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $e->getMessage();
                }
            }

            if (count($errors) > 0) {
                return response()->json([
                    'success' => false,
                    'total' => count($excelData),
                    'errors' => $errors,
                    'message' => "Gagal mengimport data. Semua data harus valid untuk dapat diimport."
                ], 422);
            }

            DB::beginTransaction();
            try {
                $importedCount = 0;
                foreach ($excelData as $row) {
                    if (isset($row['use_ruangan']) && $row['use_ruangan'] === false) {
                        $row['ruangan_id'] = null;
                    }

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

                    $jadwal->load(['mataKuliah', 'dosen', 'ruangan', 'createdBy']);
                    $this->sendJadwalNotifications($jadwal);
                    $importedCount++;
                }

                DB::commit();

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

    // Get jadwal Non Blok Non CSR for mahasiswa
    public function getJadwalForMahasiswa($mahasiswaId, Request $request)
    {
        try {
            $mahasiswa = User::where('id', $mahasiswaId)->where('role', 'mahasiswa')->first();
            if (!$mahasiswa) {
                return response()->json(['message' => 'Mahasiswa tidak ditemukan', 'data' => []], 404);
            }

            $mahasiswaNim = $mahasiswa->nim;

            // Normalize NIM to string untuk perbandingan yang konsisten
            $mahasiswaNimStr = trim((string) $mahasiswaNim);

            Log::info("JadwalNonBlokNonCSR getJadwalForMahasiswa: start", [
                'mahasiswa_id' => $mahasiswaId,
                'mahasiswa_nim' => $mahasiswaNim,
                'mahasiswa_nim_str' => $mahasiswaNimStr,
                'mahasiswa_semester' => $mahasiswa->semester
            ]);

            // Get jadwal:
            // 1. Untuk jadwal biasa (materi, agenda), filter berdasarkan semester mata kuliah
            // 2. Untuk jadwal bimbingan akhir (seminar_proposal, sidang_skripsi), ambil semua tanpa filter semester
            //    karena mahasiswa bisa dijadwalkan di semester manapun
            $jadwalBimbinganAkhir = JadwalNonBlokNonCSR::with(['mataKuliah', 'dosen', 'ruangan', 'kelompokBesar', 'pembimbing'])
                ->whereIn('jenis_baris', ['seminar_proposal', 'sidang_skripsi'])
                ->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();

            $jadwalBiasa = JadwalNonBlokNonCSR::with(['mataKuliah', 'dosen', 'ruangan', 'kelompokBesar', 'pembimbing'])
                ->whereHas('mataKuliah', function ($q) use ($mahasiswa) {
                    $q->where('semester', $mahasiswa->semester);
                })
                ->whereNotIn('jenis_baris', ['seminar_proposal', 'sidang_skripsi'])
                ->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();

            // Gabungkan kedua hasil
            $jadwal = $jadwalBimbinganAkhir->merge($jadwalBiasa);

            Log::info("JadwalNonBlokNonCSR getJadwalForMahasiswa: query result", [
                'total_jadwal_bimbingan_akhir' => $jadwalBimbinganAkhir->count(),
                'total_jadwal_biasa' => $jadwalBiasa->count(),
                'total_jadwal_gabungan' => $jadwal->count(),
                'jadwal_bimbingan_akhir_ids' => $jadwalBimbinganAkhir->pluck('id')->toArray()
            ]);

            // Filter jadwal: untuk seminar_proposal dan sidang_skripsi, hanya ambil yang mahasiswa_nims berisi NIM mahasiswa
            $filteredJadwal = $jadwal->filter(function ($item) use ($mahasiswaNimStr, $mahasiswaNim) {
                // Jika jenis_baris adalah seminar_proposal atau sidang_skripsi, filter berdasarkan mahasiswa_nims
                if (in_array($item->jenis_baris, ['seminar_proposal', 'sidang_skripsi'])) {
                    // Gunakan getAttribute untuk memastikan casting bekerja
                    $mahasiswaNims = $item->getAttribute('mahasiswa_nims');

                    if (!$mahasiswaNims) {
                        Log::info("JadwalNonBlokNonCSR getJadwalForMahasiswa: mahasiswa_nims kosong", [
                            'jadwal_id' => $item->id,
                            'jenis_baris' => $item->jenis_baris,
                            'mahasiswa_nim' => $mahasiswaNim,
                            'mahasiswa_nims_raw' => $item->getRawOriginal('mahasiswa_nims')
                        ]);
                        return false;
                    }

                    // Pastikan mahasiswa_nims adalah array (casting seharusnya sudah bekerja, tapi pastikan)
                    $nims = is_array($mahasiswaNims)
                        ? $mahasiswaNims
                        : (is_string($mahasiswaNims) ? json_decode($mahasiswaNims, true) : []);

                    if (!is_array($nims) || empty($nims)) {
                        Log::info("JadwalNonBlokNonCSR getJadwalForMahasiswa: mahasiswa_nims bukan array atau kosong", [
                            'jadwal_id' => $item->id,
                            'jenis_baris' => $item->jenis_baris,
                            'mahasiswa_nim' => $mahasiswaNim,
                            'mahasiswa_nims_raw' => $item->getRawOriginal('mahasiswa_nims'),
                            'mahasiswa_nims_after_cast' => $mahasiswaNims,
                            'nims_after_decode' => $nims
                        ]);
                        return false;
                    }

                    // Normalize semua NIM dalam array ke string dan bandingkan
                    $nimsNormalized = array_map(function($nim) {
                        return trim((string) $nim);
                    }, $nims);

                    $isMatch = in_array($mahasiswaNimStr, $nimsNormalized, true);

                    Log::info("JadwalNonBlokNonCSR getJadwalForMahasiswa: cek match", [
                        'jadwal_id' => $item->id,
                        'jenis_baris' => $item->jenis_baris,
                        'mahasiswa_nim' => $mahasiswaNim,
                        'mahasiswa_nim_str' => $mahasiswaNimStr,
                        'nims_original' => $nims,
                        'nims_normalized' => $nimsNormalized,
                        'is_match' => $isMatch
                    ]);

                    return $isMatch;
                }
                // Untuk jenis_baris lainnya (materi, agenda), tetap tampilkan semua
                return true;
            });

            Log::info("JadwalNonBlokNonCSR getJadwalForMahasiswa: after filter", [
                'total_filtered' => $filteredJadwal->count(),
                'filtered_jadwal_ids' => $filteredJadwal->pluck('id')->toArray(),
                'filtered_jadwal_jenis' => $filteredJadwal->pluck('jenis_baris')->toArray()
            ]);

            $mappedJadwal = $filteredJadwal->map(function ($item) use ($mahasiswaNimStr) {
                // Determine jenis_baris - gunakan dari database jika ada
                $jenisBaris = $item->jenis_baris ?? ($item->agenda ? 'agenda' : 'materi');

                // Determine tipe text
                $tipe = match($jenisBaris) {
                    'seminar_proposal' => 'Seminar Proposal',
                    'sidang_skripsi' => 'Sidang Skripsi',
                    'agenda' => 'Agenda Khusus',
                    default => 'Jadwal Materi'
                };

                // Determine pengampu berdasarkan jenis_baris
                $pengampu = '-';
                if ($jenisBaris === 'seminar_proposal' || $jenisBaris === 'sidang_skripsi') {
                    // Untuk seminar proposal dan sidang skripsi, ambil pembimbing
                    if ($item->pembimbing_id) {
                        $pembimbing = User::find($item->pembimbing_id);
                        $pengampu = $pembimbing ? $pembimbing->name : '-';
                    }
                } elseif ($jenisBaris === 'agenda' || !$item->dosen) {
                    $pengampu = '-';
                } else {
                    $pengampu = $item->dosen->name;
                }

                // Get komentator/penguji untuk seminar proposal dan sidang skripsi
                $komentatorList = [];
                $pengujiList = [];
                if ($jenisBaris === 'seminar_proposal' && $item->komentator_ids && is_array($item->komentator_ids)) {
                    $komentatorList = User::whereIn('id', $item->komentator_ids)
                        ->pluck('name')
                        ->toArray();
                }
                if ($jenisBaris === 'sidang_skripsi' && $item->penguji_ids && is_array($item->penguji_ids)) {
                    $pengujiList = User::whereIn('id', $item->penguji_ids)
                        ->pluck('name')
                        ->toArray();
                }

                // Determine ruangan
                $ruangan = null;
                if ($item->use_ruangan && $item->ruangan) {
                    $ruangan = ['id' => $item->ruangan->id, 'nama' => $item->ruangan->nama];
                }

                // Determine status - show "-" if no dosen (agenda or no assigned dosen)
                $status = ($jenisBaris === 'agenda' || (!$item->dosen && !$item->pembimbing_id)) ? '-' : ($item->status_konfirmasi ?? 'belum_konfirmasi');

                return [
                    'id' => $item->id,
                    'tanggal' => date('d-m-Y', strtotime($item->tanggal)), // Format dd-mm-yyyy
                    'jam_mulai' => str_replace(':', '.', substr($item->jam_mulai, 0, 5)),
                    'jam_selesai' => str_replace(':', '.', substr($item->jam_selesai, 0, 5)),
                    'agenda' => $item->agenda ?? null,
                    'materi' => $item->materi ?? null,
                    'jenis_baris' => $jenisBaris, // Pastikan jenis_baris dikembalikan
                    'tipe' => $tipe,
                    'use_ruangan' => $item->use_ruangan ?? false,
                    'pengampu' => $pengampu,
                    'pembimbing_id' => $item->pembimbing_id,
                    'komentator_list' => $komentatorList,
                    'penguji_list' => $pengujiList,
                    'ruangan' => $ruangan ? ['id' => $ruangan['id'], 'nama' => $ruangan['nama']] : null,
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
            Log::error("JadwalNonBlokNonCSR getJadwalForMahasiswa error", [
                'mahasiswa_id' => $mahasiswaId ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
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

            // Tambahkan mahasiswa yang terdaftar secara eksplisit di mahasiswa_nims (untuk Seminar Proposal dan Sidang Skripsi)
            if ($jadwal->mahasiswa_nims) {
                $explicitNims = is_array($jadwal->mahasiswa_nims) 
                    ? $jadwal->mahasiswa_nims 
                    : json_decode($jadwal->mahasiswa_nims, true);
                
                if (is_array($explicitNims)) {
                    $mahasiswaTerdaftar = array_merge($mahasiswaTerdaftar, $explicitNims);
                }
            }

            // Ensure unique NIMs
            $mahasiswaTerdaftar = array_unique($mahasiswaTerdaftar);

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
}
