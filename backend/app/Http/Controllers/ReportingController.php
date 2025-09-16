<?php

namespace App\Http\Controllers;

use Spatie\Activitylog\Models\Activity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Pagination\LengthAwarePaginator;

class ReportingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Activity::with('causer') // Ganti 'user' jadi 'causer'
            ->orderBy('created_at', 'desc');

        // Filter by action (event di Spatie)
        if ($request->filled('action')) {
            $query->where('event', $request->action);
        }

        // Filter by module (subject_type di Spatie)
        if ($request->filled('module')) {
            // Kita akan ubah nama model menjadi format yang lebih rapi
            $moduleName = "App\\Models\\" . $request->module;
            $query->where('subject_type', $moduleName);
        }

        // Filter by user (causer_id di Spatie)
        if ($request->filled('user_id')) {
            $query->where('causer_id', $request->user_id);
        }

        // Filter by date range
        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        // Search by description
        if ($request->filled('search')) {
            $query->where('description', 'like', '%' . $request->search . '%');
        }

        $perPage = $request->get('per_page', 15);
        $logs = $query->paginate($perPage);
        
        // Transform data to include role information
        $transformedLogs = $logs->getCollection()->map(function ($log) {
            return [
                'id' => $log->id,
                'description' => $log->description,
                'subject_type' => $log->subject_type,
                'subject_id' => $log->subject_id,
                'causer_type' => $log->causer_type,
                'causer_id' => $log->causer_id,
                'event' => $log->event,
                'properties' => $log->properties,
                'created_at' => $log->created_at,
                'causer' => $log->causer ? [
                    'id' => $log->causer->id,
                    'name' => $log->causer->name,
                ] : null,
                'role' => $log->causer ? $log->causer->role : 'System',
            ];
        });
        
        // Create new paginator with transformed data
        $transformedPaginator = new LengthAwarePaginator(
            $transformedLogs,
            $logs->total(),
            $logs->perPage(),
            $logs->currentPage(),
            [
                'path' => $logs->path(),
                'pageName' => $logs->getPageName(),
            ]
        );

        // Ambil filter options
        $actions = Activity::distinct()->pluck('event');
        $modules = Activity::distinct()->pluck('subject_type')->map(function ($type) {
            // Ambil nama pendek dari model, misal: App\Models\Ruangan -> Ruangan
            return class_basename($type);
        })->unique()->values();

        return response()->json([
            'success' => true,
            'data' => $transformedPaginator,
            'filters' => [
                'actions' => $actions,
                'modules' => $modules,
            ]
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $query = Activity::query();

        // Filter by date range
        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $summary = [
            'total_activities' => (clone $query)->count(),
            'activities_by_action' => (clone $query)->select('event as action', DB::raw('count(*) as count'))
                ->groupBy('event')
                ->get(),
            'activities_by_module' => (clone $query)->select('subject_type as module', DB::raw('count(*) as count'))
                ->groupBy('subject_type')
                ->orderByDesc('count')
                ->get()->map(function($item) {
                    $item->module = class_basename($item->module);
                    return $item;
                }),
            'activities_by_date' => (clone $query)->select(DB::raw('DATE(created_at) as date'), DB::raw('count(*) as count'))
                ->groupBy('date')
                ->orderBy('date', 'desc')
                ->limit(30)
                ->get(),
            'top_users' => (clone $query)->select('causer_id as user_id', DB::raw('count(*) as count'))
                ->groupBy('causer_id')
                ->orderByDesc('count')
                ->limit(10)
                ->get(),
        ];

        // Modul terbanyak (ambil yang count-nya paling banyak)
        $summary['modul_terbanyak'] = $summary['activities_by_module']->first() ? $summary['activities_by_module']->first()->module : '-';
        // User terbanyak (ambil user_id dan count, lalu cari nama user jika ada)
        $topUser = $summary['top_users']->first();
        if ($topUser && $topUser->user_id) {
            $user = \App\Models\User::find($topUser->user_id);
            $summary['user_terbanyak'] = [
                'user_id' => $topUser->user_id,
                'name' => $user ? $user->name : 'User #' . $topUser->user_id,
                'count' => $topUser->count,
            ];
        } else {
            $summary['user_terbanyak'] = null;
        }
        // Aktivitas hari ini
        $summary['activities_today'] = (clone $query)->whereDate('created_at', now()->toDateString())->count();

        return response()->json([
            'success' => true,
            'data' => $summary
        ]);
    }

    public function export(Request $request): JsonResponse
    {
        $query = Activity::with('causer') // Ganti 'user' jadi 'causer'
            ->orderBy('created_at', 'desc');

        // Apply same filters as index method
        if ($request->filled('action')) {
            $query->where('event', $request->action);
        }

        if ($request->filled('module')) {
            $moduleName = "App\\Models\\" . $request->module;
            $query->where('subject_type', $moduleName);
        }

        if ($request->filled('user_id')) {
            $query->where('causer_id', $request->user_id);
        }

        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        if ($request->filled('search')) {
            $query->where('description', 'like', '%' . $request->search . '%');
        }

        $logs = $query->get();

        // Transform data for export
        $exportData = $logs->map(function ($log) {
            return [
                'ID' => $log->id,
                'Tanggal' => $log->created_at->format('Y-m-d H:i:s'),
                'User' => $log->causer ? $log->causer->name : 'System',
                'Aksi' => $log->event,
                'Modul' => class_basename($log->subject_type),
                'Deskripsi' => $log->description,
                'Properties' => $log->properties, // Tambahkan properties untuk detail
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $exportData,
            'filename' => 'activity_logs_' . now()->format('Y-m-d_H-i-s') . '.json'
        ]);
    }

    public function dosenCsrReport(Request $request)
    {
        // Ambil data mapping dosen ke CSR beserta semester & blok
        $mappings = \App\Models\CSRMapping::with(['dosen', 'csr'])->get();

        $result = [];
        foreach ($mappings as $mapping) {
            if (!$mapping->dosen || !$mapping->csr) continue;
            $dosenId = $mapping->dosen->id;
            $dosenName = $mapping->dosen->name;
            $nid = $mapping->dosen->nid;
            $keahlian = $mapping->dosen->keahlian ?? [];
            $csr = $mapping->csr;
            $semester = $csr->semester;
            $blok = $csr->nomor_csr;
            $tanggal_mulai = $csr->tanggal_mulai ? $csr->tanggal_mulai->format('Y-m-d') : null;
            $tanggal_akhir = $csr->tanggal_akhir ? $csr->tanggal_akhir->format('Y-m-d') : null;

            if (!isset($result[$dosenId])) {
                $result[$dosenId] = [
                    'dosen_id' => $dosenId,
                    'dosen_name' => $dosenName,
                    'nid' => $nid,
                    'keahlian' => $keahlian,
                    'total_csr' => 0,
                    'total_sesi' => 0,
                    'total_waktu_menit' => 0,
                    'per_semester' => [],
                    'all_tanggal_mulai' => [],
                    'all_tanggal_akhir' => [],
                ];
                // Tambahan keterangan peran utama (legacy)
                $peranUtama = $mapping->dosen->peran_utama ?? null;
                $result[$dosenId]['peran_utama'] = $peranUtama;
                if ($peranUtama === 'koordinator' && $mapping->dosen->matkulKetua) {
                    $result[$dosenId]['matkul_ketua_nama'] = $mapping->dosen->matkulKetua->nama;
                    $result[$dosenId]['matkul_ketua_kode'] = $mapping->dosen->matkulKetua->kode;
                }
                if ($peranUtama === 'tim_blok' && $mapping->dosen->matkulAnggota) {
                    $result[$dosenId]['matkul_anggota_nama'] = $mapping->dosen->matkulAnggota->nama;
                    $result[$dosenId]['matkul_anggota_kode'] = $mapping->dosen->matkulAnggota->kode;
                }
                if ($peranUtama === 'dosen_mengajar') {
                    $result[$dosenId]['peran_kurikulum_mengajar'] = $mapping->dosen->peran_kurikulum_mengajar;
                }
                // Tambahkan array dosen_peran (multi-peran)
                $dosenPeran = $mapping->dosen->dosenPeran;
                $result[$dosenId]['dosen_peran'] = $dosenPeran ? $dosenPeran->map(function($peran) {
                    $mk = $peran->mataKuliah;
                    return [
                        'tipe_peran' => $peran->tipe_peran,
                        'mata_kuliah_kode' => $peran->mata_kuliah_kode,
                        'mata_kuliah_nama' => $mk ? $mk->nama : null,
                        'blok' => $peran->blok,
                        'semester' => $peran->semester,
                        'peran_kurikulum' => $peran->peran_kurikulum,
                    ];
                })->values() : [];
            }
            $result[$dosenId]['total_csr'] += 1;
            $result[$dosenId]['total_sesi'] += 5;
            $result[$dosenId]['total_waktu_menit'] += 250;
            $result[$dosenId]['all_tanggal_mulai'][] = $tanggal_mulai;
            $result[$dosenId]['all_tanggal_akhir'][] = $tanggal_akhir;
            // Group by semester
            $found = false;
            foreach ($result[$dosenId]['per_semester'] as &$sem) {
                if ($sem['semester'] == $semester) {
                    $sem['jumlah'] += 1;
                    $sem['total_sesi'] += 5;
                    $sem['total_waktu_menit'] += 250;
                    $sem['blok_csr'][] = [
                        'blok' => $blok,
                        'nama' => $csr->nama,
                        'kode' => $csr->mata_kuliah_kode,
                        'waktu_menit' => 250,
                        'jumlah_sesi' => 5,
                    ];
                    $sem['tanggal_mulai'][] = $tanggal_mulai;
                    $sem['tanggal_akhir'][] = $tanggal_akhir;
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                $result[$dosenId]['per_semester'][] = [
                    'semester' => $semester,
                    'jumlah' => 1,
                    'total_sesi' => 5,
                    'total_waktu_menit' => 250,
                    'blok_csr' => [[
                        'blok' => $blok,
                        'nama' => $csr->nama,
                        'kode' => $csr->mata_kuliah_kode,
                        'waktu_menit' => 250,
                        'jumlah_sesi' => 5,
                    ]],
                    'tanggal_mulai' => [$tanggal_mulai],
                    'tanggal_akhir' => [$tanggal_akhir],
                ];
            }
        }
        // Reset array keys dan hitung tanggal mulai/akhir terawal/terakhir
        $result = array_map(function($d) {
            $allMulai = array_filter($d['all_tanggal_mulai']);
            $allAkhir = array_filter($d['all_tanggal_akhir']);
            $d['tanggal_mulai'] = $allMulai ? min($allMulai) : null;
            $d['tanggal_akhir'] = $allAkhir ? max($allAkhir) : null;
            unset($d['all_tanggal_mulai'], $d['all_tanggal_akhir']);
            // Untuk setiap per_semester, ambil tanggal terawal/terakhir di semester tsb
            foreach ($d['per_semester'] as &$sem) {
                $mulai = array_filter($sem['tanggal_mulai']);
                $akhir = array_filter($sem['tanggal_akhir']);
                $sem['tanggal_mulai'] = $mulai ? min($mulai) : null;
                $sem['tanggal_akhir'] = $akhir ? max($akhir) : null;
            }
            return $d;
        }, array_values($result));

        $page = $request->input('page', 1);
        $perPage = $request->input('per_page', 10);
        $result = collect($result);
        $paginated = new LengthAwarePaginator(
            $result->forPage($page, $perPage)->values(),
            $result->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );
        return response()->json($paginated);
    }

    public function dosenPblReport(Request $request)
    {
        // Ambil data mapping dosen ke PBL beserta semester & blok
        $mappings = \App\Models\PBLMapping::with(['dosen.dosenPeran', 'pbl.mataKuliah'])->get();

        $result = [];
        foreach ($mappings as $mapping) {
            if (!$mapping->dosen || !$mapping->pbl || !$mapping->pbl->mataKuliah) continue;

            $dosenId = $mapping->dosen->id;
            $dosenName = $mapping->dosen->name;
            $nid = $mapping->dosen->nid;
            $keahlian = $mapping->dosen->keahlian ?? [];
            $pbl = $mapping->pbl;
            $mataKuliah = $pbl->mataKuliah;
            $semester = $mataKuliah->semester;
            $blok = $mataKuliah->blok;
            $modulKe = $pbl->modul_ke;
            $namaModul = $pbl->nama_modul;
            $tanggal_mulai = $mataKuliah->tanggal_mulai ? $mataKuliah->tanggal_mulai->format('Y-m-d') : null;
            $tanggal_akhir = $mataKuliah->tanggal_akhir ? $mataKuliah->tanggal_akhir->format('Y-m-d') : null;

            // Setiap modul PBL = 5x50 menit = 250 menit
            $waktuPerModul = 250; // menit
            $sesiPerModul = 5; // sesi

            // --- Ambil peran_utama dari dosen_peran yang relevan dengan blok & semester ini ---
            $peranUtama = 'standby';
            $dosenPeran = $mapping->dosen->dosenPeran;
            if ($dosenPeran && $dosenPeran->count() > 0) {
                foreach ($dosenPeran as $peran) {
                    if ((string)$peran->semester === (string)$semester && (string)$peran->blok === (string)$blok) {
                        if (in_array($peran->tipe_peran, ['ketua', 'anggota', 'mengajar'])) {
                            $peranUtama = $peran->tipe_peran === 'mengajar' ? 'dosen_mengajar' : $peran->tipe_peran;
                            break;
                        }
                    }
                }
            }

            if (!isset($result[$dosenId])) {
                $result[$dosenId] = [
                    'dosen_id' => $dosenId,
                    'dosen_name' => $dosenName,
                    'nid' => $nid,
                    'keahlian' => $keahlian,
                    'peran_utama' => $peranUtama,
                    'total_pbl' => 0,
                    'total_sesi' => 0,
                    'total_waktu_menit' => 0,
                    'per_semester' => [],
                    'all_tanggal_mulai' => [],
                    'all_tanggal_akhir' => [],
                ];
                // Tambahan keterangan peran
                if ($peranUtama === 'ketua') {
                    $peranKetua = $dosenPeran->where('tipe_peran', 'ketua')->where('semester', $semester)->where('blok', $blok)->first();
                    if ($peranKetua) {
                        $mk = \App\Models\MataKuliah::where('kode', $peranKetua->mata_kuliah_kode)->first();
                        $result[$dosenId]['matkul_ketua_nama'] = $mk ? $mk->nama : null;
                        $result[$dosenId]['matkul_ketua_kode'] = $peranKetua->mata_kuliah_kode;
                    }
                }
                if ($peranUtama === 'anggota') {
                    $peranAnggota = $dosenPeran->where('tipe_peran', 'anggota')->where('semester', $semester)->where('blok', $blok)->first();
                    if ($peranAnggota) {
                        $mk = \App\Models\MataKuliah::where('kode', $peranAnggota->mata_kuliah_kode)->first();
                        $result[$dosenId]['matkul_anggota_nama'] = $mk ? $mk->nama : null;
                        $result[$dosenId]['matkul_anggota_kode'] = $peranAnggota->mata_kuliah_kode;
                    }
                }
                if ($peranUtama === 'dosen_mengajar') {
                    $peranMengajar = $dosenPeran->where('tipe_peran', 'mengajar')->where('semester', $semester)->where('blok', $blok)->first();
                    if ($peranMengajar) {
                        $result[$dosenId]['peran_kurikulum_mengajar'] = $peranMengajar->peran_kurikulum;
                    }
                }
                // Tambahkan array dosen_peran (multi-peran)
                $result[$dosenId]['dosen_peran'] = $dosenPeran->map(function($peran) {
                    $mk = $peran->mataKuliah;
                    return [
                        'tipe_peran' => $peran->tipe_peran,
                        'mata_kuliah_kode' => $peran->mata_kuliah_kode,
                        'mata_kuliah_nama' => $mk ? $mk->nama : null,
                        'blok' => $peran->blok,
                        'semester' => $peran->semester,
                        'peran_kurikulum' => $peran->peran_kurikulum,
                    ];
                })->values();
            }
            $result[$dosenId]['total_pbl'] += 1;
            $result[$dosenId]['total_sesi'] += $sesiPerModul;
            $result[$dosenId]['total_waktu_menit'] += $waktuPerModul;
            $result[$dosenId]['all_tanggal_mulai'][] = $tanggal_mulai;
            $result[$dosenId]['all_tanggal_akhir'][] = $tanggal_akhir;

            // Group by semester
            $found = false;
            foreach ($result[$dosenId]['per_semester'] as &$sem) {
                if ($sem['semester'] == $semester) {
                    $sem['jumlah'] += 1;
                    $sem['total_sesi'] += $sesiPerModul;
                    $sem['total_waktu_menit'] += $waktuPerModul;
                    $sem['modul_pbl'][] = [
                        'blok' => $blok,
                        'modul_ke' => $modulKe,
                        'nama_modul' => $namaModul,
                        'mata_kuliah_kode' => $mataKuliah->kode,
                        'mata_kuliah_nama' => $mataKuliah->nama,
                        'waktu_menit' => $waktuPerModul,
                        'jumlah_sesi' => $sesiPerModul,
                    ];
                    $sem['tanggal_mulai'][] = $tanggal_mulai;
                    $sem['tanggal_akhir'][] = $tanggal_akhir;
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                $result[$dosenId]['per_semester'][] = [
                    'semester' => $semester,
                    'jumlah' => 1,
                    'total_sesi' => $sesiPerModul,
                    'total_waktu_menit' => $waktuPerModul,
                    'modul_pbl' => [[
                        'blok' => $blok,
                        'modul_ke' => $modulKe,
                        'nama_modul' => $namaModul,
                        'mata_kuliah_kode' => $mataKuliah->kode,
                        'mata_kuliah_nama' => $mataKuliah->nama,
                        'waktu_menit' => $waktuPerModul,
                        'jumlah_sesi' => $sesiPerModul,
                    ]],
                    'tanggal_mulai' => [$tanggal_mulai],
                    'tanggal_akhir' => [$tanggal_akhir],
                ];
            }
        }

        // Reset array keys dan hitung tanggal mulai/akhir terawal/terakhir
        $result = array_map(function($d) {
            $allMulai = array_filter($d['all_tanggal_mulai']);
            $allAkhir = array_filter($d['all_tanggal_akhir']);
            $d['tanggal_mulai'] = $allMulai ? min($allMulai) : null;
            $d['tanggal_akhir'] = $allAkhir ? max($allAkhir) : null;
            unset($d['all_tanggal_mulai'], $d['all_tanggal_akhir']);

            // Untuk setiap per_semester, ambil tanggal terawal/terakhir di semester tsb
            foreach ($d['per_semester'] as &$sem) {
                $mulai = array_filter($sem['tanggal_mulai']);
                $akhir = array_filter($sem['tanggal_akhir']);
                $sem['tanggal_mulai'] = $mulai ? min($mulai) : null;
                $sem['tanggal_akhir'] = $akhir ? max($akhir) : null;
            }
            return $d;
        }, array_values($result));

        $page = $request->input('page', 1);
        $perPage = $request->input('per_page', 10);
        $result = collect($result);
        $paginated = new \Illuminate\Pagination\LengthAwarePaginator(
            $result->forPage($page, $perPage)->values(),
            $result->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );
        return response()->json($paginated);
    }
}
