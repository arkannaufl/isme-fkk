<?php

namespace App\Http\Controllers;

use App\Models\JadwalKuliahBesar;
use App\Models\MataKuliah;
use App\Models\User;
use App\Models\Ruangan;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class JadwalKuliahBesarController extends Controller
{
    // List semua jadwal kuliah besar untuk satu mata kuliah blok
    public function index($kode)
    {
        $jadwal = JadwalKuliahBesar::with(['mataKuliah', 'dosen', 'ruangan', 'kelompokBesarAntara'])
            ->where('mata_kuliah_kode', $kode)
            ->orderBy('tanggal')
            ->orderBy('jam_mulai')
            ->get();
        return response()->json($jadwal);
    }

    // Tambah jadwal kuliah besar baru
    public function store(Request $request, $kode)
    {
        // Cek apakah mata kuliah adalah semester antara
        $mataKuliah = MataKuliah::where('kode', $kode)->first();
        $isSemesterAntara = $mataKuliah && $mataKuliah->semester === "Antara";

        $validationRules = [
            'topik' => 'nullable|string',
            'ruangan_id' => 'required|exists:ruangan,id',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
        ];

        if ($isSemesterAntara) {
            // Untuk semester antara: tidak ada materi, multiple dosen, kelompok besar antara
            $validationRules['dosen_ids'] = 'required|array|min:1';
            $validationRules['dosen_ids.*'] = 'exists:users,id';
            $validationRules['kelompok_besar_antara_id'] = 'nullable|exists:kelompok_besar_antara,id';
        } else {
            // Untuk semester biasa: ada materi, single dosen, kelompok besar biasa
            $validationRules['materi'] = 'required|string';
            $validationRules['dosen_id'] = 'required|exists:users,id';
            $validationRules['kelompok_besar_id'] = 'nullable|integer|min:1';
        }

        $data = $request->validate($validationRules);
        $data['mata_kuliah_kode'] = $kode;
        $data['created_by'] = $request->input('created_by', auth()->id());

        // Untuk semester antara, set materi dan dosen_id ke null
        if ($isSemesterAntara) {
            $data['materi'] = null;
            $data['dosen_id'] = null;
        }

        // Validasi kapasitas ruangan
        $kapasitasMessage = $this->validateRuanganCapacity($data, $isSemesterAntara);
        if ($kapasitasMessage) {
            return response()->json(['message' => $kapasitasMessage], 422);
        }

        // Validasi bentrok
        $bentrokMessage = $this->checkBentrokWithDetail($data, null, $isSemesterAntara);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        $jadwal = JadwalKuliahBesar::create($data);

        // Log activity
        activity()
            ->performedOn($jadwal)
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'topik' => $data['topik'] ?? null,
                'tanggal' => $data['tanggal'],
                'jam_mulai' => $data['jam_mulai'],
                'jam_selesai' => $data['jam_selesai'],
                'is_semester_antara' => $isSemesterAntara
            ])
            ->log("Jadwal Kuliah Besar created: {$mataKuliah->nama}");

        // Kirim notifikasi ke dosen yang di-assign
        if (!$isSemesterAntara && isset($data['dosen_id'])) {
            // Untuk semester biasa - single dosen
            $this->sendAssignmentNotification($jadwal, $data['dosen_id']);
        } elseif ($isSemesterAntara && isset($data['dosen_ids'])) {
            // Untuk semester antara - multiple dosen
            foreach ($data['dosen_ids'] as $dosenId) {
                $this->sendAssignmentNotification($jadwal, $dosenId);
            }
        }

        // Reload data dengan relasi
        $jadwal->load(['mataKuliah', 'dosen', 'ruangan', 'kelompokBesarAntara']);

        // Send notification to mahasiswa
        $this->sendNotificationToMahasiswa($jadwal);

        return response()->json($jadwal, Response::HTTP_CREATED);
    }

    // Update jadwal kuliah besar
    public function update(Request $request, $kode, $id)
    {
        $jadwal = JadwalKuliahBesar::findOrFail($id);

        // Cek apakah mata kuliah adalah semester antara
        $mataKuliah = MataKuliah::where('kode', $kode)->first();
        $isSemesterAntara = $mataKuliah && $mataKuliah->semester === "Antara";

        $validationRules = [
            'topik' => 'nullable|string',
            'ruangan_id' => 'required|exists:ruangan,id',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
        ];

        if ($isSemesterAntara) {
            // Untuk semester antara: tidak ada materi, multiple dosen, kelompok besar antara
            $validationRules['dosen_ids'] = 'required|array|min:1';
            $validationRules['dosen_ids.*'] = 'exists:users,id';
            $validationRules['kelompok_besar_antara_id'] = 'nullable|exists:kelompok_besar_antara,id';
        } else {
            // Untuk semester biasa: ada materi, single dosen, kelompok besar biasa
            $validationRules['materi'] = 'required|string';
            $validationRules['dosen_id'] = 'required|exists:users,id';
            $validationRules['kelompok_besar_id'] = 'nullable|integer|min:1';
        }

        $data = $request->validate($validationRules);
        $data['mata_kuliah_kode'] = $kode;
        $data['created_by'] = $request->input('created_by', auth()->id());

        // Untuk semester antara, set materi dan dosen_id ke null
        if ($isSemesterAntara) {
            $data['materi'] = null;
            $data['dosen_id'] = null;
        }

        // Validasi kapasitas ruangan
        $kapasitasMessage = $this->validateRuanganCapacity($data, $isSemesterAntara);
        if ($kapasitasMessage) {
            return response()->json(['message' => $kapasitasMessage], 422);
        }

        // Validasi bentrok (kecuali dirinya sendiri)
        $bentrokMessage = $this->checkBentrokWithDetail($data, $id, $isSemesterAntara);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        $jadwal->update($data);

        // Log activity
        activity()
            ->performedOn($jadwal)
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'topik' => $data['topik'] ?? null,
                'tanggal' => $data['tanggal'],
                'jam_mulai' => $data['jam_mulai'],
                'jam_selesai' => $data['jam_selesai'],
                'is_semester_antara' => $isSemesterAntara
            ])
            ->log("Jadwal Kuliah Besar updated: {$mataKuliah->nama}");

        // Reload data dengan relasi
        $jadwal->load(['mataKuliah', 'dosen', 'ruangan', 'kelompokBesarAntara']);
        return response()->json($jadwal);
    }

    // Hapus jadwal kuliah besar
    public function destroy($kode, $id)
    {
        $jadwal = JadwalKuliahBesar::findOrFail($id);

        // Log activity before deletion
        activity()
            ->performedOn($jadwal)
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'topik' => $jadwal->topik,
                'tanggal' => $jadwal->tanggal,
                'jam_mulai' => $jadwal->jam_mulai,
                'jam_selesai' => $jadwal->jam_selesai
            ])
            ->log("Jadwal Kuliah Besar deleted: {$jadwal->mataKuliah->nama}");

        $jadwal->delete();
        return response()->json(['message' => 'Jadwal kuliah besar berhasil dihapus']);
    }

    // Endpoint: GET /kuliah-besar/materi?blok=...&semester=...
    public function materi(Request $request)
    {
        $blok = $request->query('blok');
        $semester = $request->query('semester');
        // Ambil dosen yang sudah dikelompokkan di blok & semester
        $dosen = User::where('role', 'dosen')
            ->whereHas('dosenPeran', function ($q) use ($blok, $semester) {
                if ($blok) $q->where('blok', $blok);
                if ($semester) $q->where('semester', $semester);
            })
            ->get();
        // Gabungkan semua keahlian unik
        $keahlian = [];
        foreach ($dosen as $d) {
            $arr = is_array($d->keahlian) ? $d->keahlian : (is_string($d->keahlian) ? explode(',', $d->keahlian) : []);
            foreach ($arr as $k) {
                $k = trim($k);
                if ($k && !in_array($k, $keahlian)) $keahlian[] = $k;
            }
        }

        // Debug: Log untuk melihat data
        \Log::info('Materi query params:', [
            'blok' => $blok,
            'semester' => $semester,
            'dosen_count' => $dosen->count(),
            'keahlian_found' => $keahlian
        ]);

        return response()->json($keahlian);
    }

    // Endpoint: GET /kuliah-besar/pengampu?keahlian=...&blok=...&semester=...
    public function pengampu(Request $request)
    {
        $keahlian = $request->query('keahlian');
        $blok = $request->query('blok');
        $semester = $request->query('semester');

        if (!$keahlian || !$blok || !$semester) {
            return response()->json(['message' => 'Parameter keahlian, blok, dan semester diperlukan'], 400);
        }

        // Debug: Cek semua dosen dengan keahlian yang sesuai (tanpa filter peran dulu)
        $allDosenWithKeahlian = User::where('role', 'dosen')
            ->whereJsonContains('keahlian', $keahlian)
            ->get(['id', 'name', 'keahlian']);

        \Log::info('All dosen with keahlian:', [
            'keahlian' => $keahlian,
            'count' => $allDosenWithKeahlian->count(),
            'data' => $allDosenWithKeahlian->toArray()
        ]);

        // Debug: Cek semua dosen dengan peran di blok/semester (tanpa filter keahlian dulu)
        $allDosenWithPeran = User::whereHas('dosenPeran', function ($q) use ($blok, $semester) {
            $q->where('blok', $blok)
                ->where('semester', $semester)
                ->whereIn('tipe_peran', ['koordinator', 'tim_blok', 'mengajar']);
        })->where('role', 'dosen')
            ->get(['id', 'name', 'keahlian']);

        \Log::info('All dosen with peran:', [
            'blok' => $blok,
            'semester' => $semester,
            'count' => $allDosenWithPeran->count(),
            'data' => $allDosenWithPeran->toArray()
        ]);

        // Debug: Cek apakah ada dosen dengan keahlian yang punya peran di blok/semester
        $dosenWithKeahlianAndPeran = User::whereHas('dosenPeran', function ($q) use ($blok, $semester) {
            $q->where('blok', $blok)
                ->where('semester', $semester)
                ->whereIn('tipe_peran', ['koordinator', 'tim_blok', 'mengajar']);
        })->where('role', 'dosen')
            ->whereJsonContains('keahlian', $keahlian)
            ->get(['id', 'name', 'keahlian']);

        \Log::info('Dosen with keahlian AND peran:', [
            'keahlian' => $keahlian,
            'blok' => $blok,
            'semester' => $semester,
            'count' => $dosenWithKeahlianAndPeran->count(),
            'data' => $dosenWithKeahlianAndPeran->toArray()
        ]);

        // Ambil dosen yang memiliki keahlian yang sesuai (relax constraint - tidak harus punya peran di blok/semester)
        $dosen = User::where('role', 'dosen')
            ->where(function ($q) use ($keahlian) {
                // Coba JSON contains
                $q->whereJsonContains('keahlian', $keahlian)
                    // Atau coba dengan LIKE untuk string
                    ->orWhere('keahlian', 'LIKE', '%' . $keahlian . '%')
                    // Atau coba dengan case insensitive
                    ->orWhereRaw('LOWER(JSON_EXTRACT(keahlian, "$")) LIKE ?', ['%' . strtolower($keahlian) . '%']);
            })
            ->get(['id', 'name', 'keahlian']);

        // Debug: Log untuk melihat data final
        \Log::info('Final pengampu query result:', [
            'keahlian' => $keahlian,
            'blok' => $blok,
            'semester' => $semester,
            'dosen_count' => $dosen->count(),
            'dosen_data' => $dosen->toArray()
        ]);

        return response()->json($dosen);
    }

    // Endpoint: GET /kuliah-besar/kelompok-besar?semester=...
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
        $jumlahMahasiswa = \App\Models\KelompokBesar::where('semester', $semester)->count();

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

    // Endpoint: GET /kuliah-besar/all-dosen
    public function allDosen()
    {
        $dosen = User::where('role', 'dosen')
            ->select('id', 'name', 'email')
            ->orderBy('name')
            ->get();

        return response()->json($dosen);
    }

    // Endpoint: GET /kuliah-besar/kelompok-besar-antara (global for Antara semester)
    public function kelompokBesarAntara()
    {
        $kelompokBesar = \App\Models\KelompokBesarAntara::all()
            ->map(function ($kelompok) {
                $mahasiswa = \App\Models\User::whereIn('id', $kelompok->mahasiswa_ids ?? [])->get();
                return [
                    'id' => $kelompok->id,
                    'label' => $kelompok->nama_kelompok . ' (' . $mahasiswa->count() . ' mahasiswa)',
                    'jumlah_mahasiswa' => $mahasiswa->count(),
                    'mahasiswa' => $mahasiswa
                ];
            });

        return response()->json($kelompokBesar);
    }

    // Helper validasi bentrok antar jenis baris
    private function isBentrok($data, $ignoreId = null, $isSemesterAntara = false)
    {
        // Cek bentrok dengan jadwal Kuliah Besar
        $kuliahBesarBentrok = JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data, $isSemesterAntara) {
                if ($isSemesterAntara && isset($data['dosen_ids'])) {
                    // Untuk semester antara, cek multiple dosen
                    $q->where(function ($subQ) use ($data) {
                        foreach ($data['dosen_ids'] as $dosenId) {
                            $subQ->orWhere('dosen_id', $dosenId);
                        }
                    });
                } else {
                    // Untuk semester biasa, cek single dosen
                    $q->where('dosen_id', $data['dosen_id']);
                }
                $q->orWhere('ruangan_id', $data['ruangan_id']);
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        if ($ignoreId) {
            $kuliahBesarBentrok->where('id', '!=', $ignoreId);
        }

        // Cek bentrok dengan jadwal PBL
        $pblBentrok = \App\Models\JadwalPBL::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data, $isSemesterAntara) {
                if ($isSemesterAntara && isset($data['dosen_ids'])) {
                    // Untuk semester antara, cek multiple dosen
                    $q->where(function ($subQ) use ($data) {
                        foreach ($data['dosen_ids'] as $dosenId) {
                            $subQ->orWhere('dosen_id', $dosenId);
                        }
                    });
                } else {
                    // Untuk semester biasa, cek single dosen
                    $q->where('dosen_id', $data['dosen_id']);
                }
                $q->orWhere('ruangan_id', $data['ruangan_id']);
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan jadwal Agenda Khusus
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan jadwal Praktikum
        $praktikumBentrok = \App\Models\JadwalPraktikum::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data) {
                $q->where('ruangan_id', $data['ruangan_id']);
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan jadwal Jurnal Reading
        $jurnalBentrok = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data, $isSemesterAntara) {
                if ($isSemesterAntara && isset($data['dosen_ids'])) {
                    // Untuk semester antara, cek multiple dosen
                    $q->where(function ($subQ) use ($data) {
                        foreach ($data['dosen_ids'] as $dosenId) {
                            $subQ->orWhere('dosen_id', $dosenId);
                        }
                    });
                } else {
                    // Untuk semester biasa, cek single dosen
                    $q->where('dosen_id', $data['dosen_id']);
                }
                $q->orWhere('ruangan_id', $data['ruangan_id']);
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan kelompok besar (jika ada kelompok_besar_id atau kelompok_besar_antara_id)
        $kelompokBesarBentrok = false;
        if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
            $kelompokBesarBentrok = $this->checkKelompokBesarBentrok($data, $ignoreId);
        }

        // Cek bentrok dengan kelompok besar antara (jika ada kelompok_besar_antara_id)
        $kelompokBesarAntaraBentrok = false;
        if (isset($data['kelompok_besar_antara_id']) && $data['kelompok_besar_antara_id']) {
            $kelompokBesarAntaraBentrok = $this->checkKelompokBesarAntaraBentrok($data, $ignoreId);
        }

        // Cek bentrok antar Kelompok Besar (Kelompok Besar vs Kelompok Besar)
        $kelompokBesarVsKelompokBesarBentrok = false;
        if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
            $kelompokBesarVsKelompokBesarBentrok = $this->checkKelompokBesarVsKelompokBesarBentrok($data, $ignoreId);
        }

        // Cek bentrok antar Kelompok Besar Antara (Kelompok Besar Antara vs Kelompok Besar Antara)
        $kelompokBesarAntaraVsKelompokBesarAntaraBentrok = false;
        if (isset($data['kelompok_besar_antara_id']) && $data['kelompok_besar_antara_id']) {
            $kelompokBesarAntaraVsKelompokBesarAntaraBentrok = $this->checkKelompokBesarAntaraVsKelompokBesarAntaraBentrok($data, $ignoreId);
        }

        // Cek bentrok antar Kelompok Besar vs Kelompok Besar Antara
        $kelompokBesarVsKelompokBesarAntaraBentrok = false;
        if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
            $kelompokBesarVsKelompokBesarAntaraBentrok = $this->checkKelompokBesarVsKelompokBesarAntaraBentrok($data, $ignoreId);
        }

        $kelompokBesarAntaraVsKelompokBesarBentrok = false;
        if (isset($data['kelompok_besar_antara_id']) && $data['kelompok_besar_antara_id']) {
            $kelompokBesarAntaraVsKelompokBesarBentrok = $this->checkKelompokBesarAntaraVsKelompokBesarBentrok($data, $ignoreId);
        }

        return $kuliahBesarBentrok->exists() || $pblBentrok->exists() ||
            $agendaKhususBentrok->exists() || $praktikumBentrok->exists() ||
            $jurnalBentrok->exists() || $kelompokBesarBentrok || $kelompokBesarAntaraBentrok ||
            $kelompokBesarVsKelompokBesarBentrok || $kelompokBesarAntaraVsKelompokBesarAntaraBentrok ||
            $kelompokBesarVsKelompokBesarAntaraBentrok || $kelompokBesarAntaraVsKelompokBesarBentrok;
    }

    private function checkBentrokWithDetail($data, $ignoreId = null, $isSemesterAntara = false): ?string
    {
        // Cek bentrok dengan jadwal Kuliah Besar
        $kuliahBesarBentrok = JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data, $isSemesterAntara) {
                if ($isSemesterAntara && isset($data['dosen_ids'])) {
                    // Untuk semester antara, cek multiple dosen
                    $q->where(function ($subQ) use ($data) {
                        $subQ->whereJsonOverlaps('dosen_ids', $data['dosen_ids'])
                            ->orWhere('dosen_id', '!=', null); // Juga cek single dosen
                    });
                } else {
                    // Untuk semester biasa, cek single dosen
                    $q->where('dosen_id', $data['dosen_id']);
                }
                $q->orWhere('ruangan_id', $data['ruangan_id']);
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        if ($ignoreId) {
            $kuliahBesarBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokKuliahBesar = $kuliahBesarBentrok->first();
        if ($jadwalBentrokKuliahBesar) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokKuliahBesar->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokKuliahBesar->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $jadwalBentrokKuliahBesar, $isSemesterAntara);
            return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal PBL
        $pblBentrok = \App\Models\JadwalPBL::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data, $isSemesterAntara) {
                if ($isSemesterAntara && isset($data['dosen_ids'])) {
                    // Untuk semester antara, cek multiple dosen
                    $q->where(function ($subQ) use ($data) {
                        foreach ($data['dosen_ids'] as $dosenId) {
                            $subQ->orWhere('dosen_id', $dosenId);
                        }
                    });
                } else {
                    // Untuk semester biasa, cek single dosen
                    $q->where('dosen_id', $data['dosen_id']);
                }
                $q->orWhere('ruangan_id', $data['ruangan_id']);
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($pblBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $pblBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $pblBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $pblBentrok, $isSemesterAntara);
            return "Jadwal bentrok dengan Jadwal PBL pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Agenda Khusus
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($agendaKhususBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $agendaKhususBentrok, $isSemesterAntara);
            return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Praktikum
        $praktikumBentrok = \App\Models\JadwalPraktikum::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($praktikumBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $praktikumBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $praktikumBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $praktikumBentrok, $isSemesterAntara);
            return "Jadwal bentrok dengan Jadwal Praktikum pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Jurnal Reading
        $jurnalBentrok = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data, $isSemesterAntara) {
                if ($isSemesterAntara && isset($data['dosen_ids'])) {
                    // Untuk semester antara, cek multiple dosen
                    $q->where(function ($subQ) use ($data) {
                        foreach ($data['dosen_ids'] as $dosenId) {
                            $subQ->orWhere('dosen_id', $dosenId);
                        }
                    });
                } else {
                    // Untuk semester biasa, cek single dosen
                    $q->where('dosen_id', $data['dosen_id']);
                }
                $q->orWhere('ruangan_id', $data['ruangan_id']);
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($jurnalBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $jurnalBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jurnalBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $jurnalBentrok, $isSemesterAntara);
            return "Jadwal bentrok dengan Jadwal Jurnal Reading pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan kelompok besar (jika ada kelompok_besar_id atau kelompok_besar_antara_id)
        if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
            $kelompokBesarBentrokMessage = $this->checkKelompokBesarBentrokWithDetail($data, $ignoreId);
            if ($kelompokBesarBentrokMessage) {
                return $kelompokBesarBentrokMessage;
            }
        }

        // Cek bentrok dengan kelompok besar antara (jika ada kelompok_besar_antara_id)
        if (isset($data['kelompok_besar_antara_id']) && $data['kelompok_besar_antara_id']) {
            $kelompokBesarAntaraBentrokMessage = $this->checkKelompokBesarAntaraBentrokWithDetail($data, $ignoreId);
            if ($kelompokBesarAntaraBentrokMessage) {
                return $kelompokBesarAntaraBentrokMessage;
            }
        }

        // Cek bentrok antar Kelompok Besar (Kelompok Besar vs Kelompok Besar)
        if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
            $kelompokBesarVsKelompokBesarBentrokMessage = $this->checkKelompokBesarVsKelompokBesarBentrokWithDetail($data, $ignoreId);
            if ($kelompokBesarVsKelompokBesarBentrokMessage) {
                return $kelompokBesarVsKelompokBesarBentrokMessage;
            }
        }

        // Cek bentrok antar Kelompok Besar Antara (Kelompok Besar Antara vs Kelompok Besar Antara)
        if (isset($data['kelompok_besar_antara_id']) && $data['kelompok_besar_antara_id']) {
            $kelompokBesarAntaraVsKelompokBesarAntaraBentrokMessage = $this->checkKelompokBesarAntaraVsKelompokBesarAntaraBentrokWithDetail($data, $ignoreId);
            if ($kelompokBesarAntaraVsKelompokBesarAntaraBentrokMessage) {
                return $kelompokBesarAntaraVsKelompokBesarAntaraBentrokMessage;
            }
        }

        // Cek bentrok antar Kelompok Besar vs Kelompok Besar Antara
        if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
            $kelompokBesarVsKelompokBesarAntaraBentrokMessage = $this->checkKelompokBesarVsKelompokBesarAntaraBentrokWithDetail($data, $ignoreId);
            if ($kelompokBesarVsKelompokBesarAntaraBentrokMessage) {
                return $kelompokBesarVsKelompokBesarAntaraBentrokMessage;
            }
        }

        if (isset($data['kelompok_besar_antara_id']) && $data['kelompok_besar_antara_id']) {
            $kelompokBesarAntaraVsKelompokBesarBentrokMessage = $this->checkKelompokBesarAntaraVsKelompokBesarBentrokWithDetail($data, $ignoreId);
            if ($kelompokBesarAntaraVsKelompokBesarBentrokMessage) {
                return $kelompokBesarAntaraVsKelompokBesarBentrokMessage;
            }
        }

        return null; // Tidak ada bentrok
    }

    /**
     * Mendapatkan alasan bentrok yang detail
     */
    private function getBentrokReason($data, $jadwalBentrok, $isSemesterAntara = false): string
    {
        $reasons = [];

        // Cek bentrok dosen
        if ($isSemesterAntara && isset($data['dosen_ids']) && isset($jadwalBentrok->dosen_id)) {
            // Untuk semester antara, cek apakah ada dosen yang sama
            if (in_array($jadwalBentrok->dosen_id, $data['dosen_ids'])) {
                $dosen = \App\Models\User::find($jadwalBentrok->dosen_id);
                $reasons[] = "Dosen: " . ($dosen ? $dosen->name : 'Tidak diketahui');
            }
        } elseif (isset($data['dosen_id']) && isset($jadwalBentrok->dosen_id) && $data['dosen_id'] == $jadwalBentrok->dosen_id) {
            // Untuk semester biasa
            $dosen = \App\Models\User::find($data['dosen_id']);
            $reasons[] = "Dosen: " . ($dosen ? $dosen->name : 'Tidak diketahui');
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

        // Cek bentrok kelas praktikum
        if (isset($data['kelas_praktikum']) && isset($jadwalBentrok->kelas_praktikum) && $data['kelas_praktikum'] == $jadwalBentrok->kelas_praktikum) {
            $reasons[] = "Kelas Praktikum: " . $data['kelas_praktikum'];
        }

        return implode(', ', $reasons);
    }

    /**
     * Cek bentrok dengan kelompok besar
     */
    private function checkKelompokBesarBentrok($data, $ignoreId = null): bool
    {
        // Ambil mahasiswa dalam kelompok besar yang dipilih
        $mahasiswaIds = \App\Models\KelompokBesar::where('semester', $data['kelompok_besar_id'])
            ->pluck('mahasiswa_id')
            ->toArray();

        if (empty($mahasiswaIds)) {
            return false;
        }

        // Cek bentrok dengan jadwal PBL yang menggunakan kelompok kecil dari mahasiswa yang sama
        $pblBentrok = \App\Models\JadwalPBL::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecil', function ($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->exists();

        // Cek bentrok dengan jadwal Jurnal Reading yang menggunakan kelompok kecil dari mahasiswa yang sama
        $jurnalBentrok = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecil', function ($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->exists();

        return $pblBentrok || $jurnalBentrok;
    }

    /**
     * Cek bentrok dengan kelompok besar antara (Kelompok Besar Antara vs Kelompok Kecil Antara)
     */
    private function checkKelompokBesarAntaraBentrok($data, $ignoreId = null): bool
    {
        // Ambil mahasiswa dalam kelompok besar antara yang dipilih
        $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($data['kelompok_besar_antara_id']);
        if (!$kelompokBesarAntara || empty($kelompokBesarAntara->mahasiswa_ids)) {
            return false;
        }

        $mahasiswaIds = $kelompokBesarAntara->mahasiswa_ids;

        // Cek bentrok dengan jadwal PBL yang menggunakan kelompok kecil antara dari mahasiswa yang sama
        $pblBentrok = \App\Models\JadwalPBL::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecilAntara', function ($q) use ($mahasiswaIds) {
                $q->whereJsonOverlaps('mahasiswa_ids', $mahasiswaIds);
            })
            ->exists();

        // Cek bentrok dengan jadwal Jurnal Reading yang menggunakan kelompok kecil antara dari mahasiswa yang sama
        $jurnalBentrok = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecilAntara', function ($q) use ($mahasiswaIds) {
                $q->whereJsonOverlaps('mahasiswa_ids', $mahasiswaIds);
            })
            ->exists();

        return $pblBentrok || $jurnalBentrok;
    }

    /**
     * Cek bentrok dengan kelompok besar dengan detail
     */
    private function checkKelompokBesarBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Ambil mahasiswa dalam kelompok besar yang dipilih
        $mahasiswaIds = \App\Models\KelompokBesar::where('semester', $data['kelompok_besar_id'])
            ->pluck('mahasiswa_id')
            ->toArray();

        if (empty($mahasiswaIds)) {
            return null;
        }

        // Cek bentrok dengan jadwal PBL yang menggunakan kelompok kecil dari mahasiswa yang sama
        $pblBentrok = \App\Models\JadwalPBL::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecil', function ($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->first();

        if ($pblBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $pblBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $pblBentrok->jam_selesai);
            $kelompokKecil = \App\Models\KelompokKecil::find($pblBentrok->kelompok_kecil_id);
            $bentrokReason = "Kelompok Besar vs Kelompok Kecil: " . ($kelompokKecil ? $kelompokKecil->nama_kelompok : 'Tidak diketahui');
            return "Jadwal bentrok dengan Jadwal PBL pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Jurnal Reading yang menggunakan kelompok kecil dari mahasiswa yang sama
        $jurnalBentrok = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecil', function ($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->first();

        if ($jurnalBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $jurnalBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jurnalBentrok->jam_selesai);
            $kelompokKecil = \App\Models\KelompokKecil::find($jurnalBentrok->kelompok_kecil_id);
            $bentrokReason = "Kelompok Besar vs Kelompok Kecil: " . ($kelompokKecil ? $kelompokKecil->nama_kelompok : 'Tidak diketahui');
            return "Jadwal bentrok dengan Jadwal Jurnal Reading pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        return null;
    }

    /**
     * Validasi kapasitas ruangan berdasarkan jumlah mahasiswa di kelompok besar + dosen
     */
    private function validateRuanganCapacity($data, $isSemesterAntara = false)
    {
        // Ambil data ruangan
        $ruangan = Ruangan::find($data['ruangan_id']);
        if (!$ruangan) {
            return 'Ruangan tidak ditemukan';
        }

        if ($isSemesterAntara) {
            // Untuk semester antara
            if (!isset($data['kelompok_besar_antara_id']) || !$data['kelompok_besar_antara_id']) {
                if ($ruangan->kapasitas < 1) {
                    return "Ruangan {$ruangan->nama} tidak memiliki kapasitas yang valid.";
                }
                return null;
            }

            // Hitung jumlah mahasiswa di kelompok besar antara
            $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($data['kelompok_besar_antara_id']);
            if (!$kelompokBesarAntara) {
                return 'Kelompok besar tidak ditemukan';
            }

            $jumlahMahasiswa = count($kelompokBesarAntara->mahasiswa_ids);
            $jumlahDosen = isset($data['dosen_ids']) ? count($data['dosen_ids']) : 1;
            $totalPeserta = $jumlahMahasiswa + $jumlahDosen;

            // Validasi kapasitas
            if ($totalPeserta > $ruangan->kapasitas) {
                return "Kapasitas ruangan tidak mencukupi. Ruangan {$ruangan->nama} hanya dapat menampung {$ruangan->kapasitas} orang, sedangkan diperlukan {$totalPeserta} orang ({$jumlahMahasiswa} mahasiswa + {$jumlahDosen} dosen).";
            }
        } else {
            // Untuk semester biasa
            if (!isset($data['kelompok_besar_id']) || !$data['kelompok_besar_id']) {
                if ($ruangan->kapasitas < 1) {
                    return "Ruangan {$ruangan->nama} tidak memiliki kapasitas yang valid.";
                }
                return null;
            }

            // Hitung jumlah mahasiswa di kelompok besar
            $jumlahMahasiswa = \App\Models\KelompokBesar::where('semester', $data['kelompok_besar_id'])->count();
            $jumlahDosen = 1; // Single dosen untuk semester biasa
            $totalPeserta = $jumlahMahasiswa + $jumlahDosen;

            // Validasi kapasitas
            if ($totalPeserta > $ruangan->kapasitas) {
                return "Kapasitas ruangan tidak mencukupi. Ruangan {$ruangan->nama} hanya dapat menampung {$ruangan->kapasitas} orang, sedangkan diperlukan {$totalPeserta} orang ({$jumlahMahasiswa} mahasiswa + {$jumlahDosen} dosen).";
            }
        }

        return null; // Kapasitas mencukupi
    }

    /**
     * Dapatkan semester mata kuliah
     */
    private function getMataKuliahSemester($kode)
    {
        $mataKuliah = \App\Models\MataKuliah::where('kode', $kode)->first();
        return $mataKuliah ? $mataKuliah->semester : null;
    }

    /**
     * Validasi tanggal jadwal dalam rentang mata kuliah
     */
    private function validateTanggalMataKuliah($data, $mataKuliah)
    {
        $tanggalJadwal = $data['tanggal'];

        // Ambil tanggal mulai dan akhir mata kuliah
        $tanggalMulai = $mataKuliah->tanggal_mulai ?? $mataKuliah->tanggalMulai;
        $tanggalAkhir = $mataKuliah->tanggal_akhir ?? $mataKuliah->tanggalAkhir;

        if (!$tanggalMulai || !$tanggalAkhir) {
            return 'Mata kuliah tidak memiliki rentang tanggal yang valid';
        }

        // Konversi ke format yang sama untuk perbandingan
        $tanggalJadwalFormatted = date('Y-m-d', strtotime($tanggalJadwal));
        $tanggalMulaiFormatted = date('Y-m-d', strtotime($tanggalMulai));
        $tanggalAkhirFormatted = date('Y-m-d', strtotime($tanggalAkhir));

        // Validasi tanggal jadwal harus dalam rentang mata kuliah
        if ($tanggalJadwalFormatted < $tanggalMulaiFormatted) {
            return "Tanggal jadwal ({$tanggalJadwalFormatted}) tidak boleh sebelum tanggal mulai mata kuliah ({$tanggalMulaiFormatted})";
        }

        if ($tanggalJadwalFormatted > $tanggalAkhirFormatted) {
            return "Tanggal jadwal ({$tanggalJadwalFormatted}) tidak boleh setelah tanggal akhir mata kuliah ({$tanggalAkhirFormatted})";
        }

        return null; // Tanggal valid
    }

    /**
     * Cek bentrok antar Kelompok Besar (Kelompok Besar vs Kelompok Besar)
     */
    private function checkKelompokBesarVsKelompokBesarBentrok($data, $ignoreId = null): bool
    {
        // Cek bentrok dengan jadwal Kuliah Besar lain yang menggunakan kelompok besar yang sama
        $kuliahBesarBentrok = JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_id', $data['kelompok_besar_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $kuliahBesarBentrok->where('id', '!=', $ignoreId);
        }

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_id', $data['kelompok_besar_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        return $kuliahBesarBentrok->exists() || $agendaKhususBentrok->exists();
    }

    /**
     * Cek bentrok antar Kelompok Besar Antara (Kelompok Besar Antara vs Kelompok Besar Antara)
     */
    private function checkKelompokBesarAntaraVsKelompokBesarAntaraBentrok($data, $ignoreId = null): bool
    {
        // Cek bentrok dengan jadwal Kuliah Besar lain yang menggunakan kelompok besar antara yang sama
        $kuliahBesarBentrok = JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_antara_id', $data['kelompok_besar_antara_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $kuliahBesarBentrok->where('id', '!=', $ignoreId);
        }

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar antara yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_antara_id', $data['kelompok_besar_antara_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        return $kuliahBesarBentrok->exists() || $agendaKhususBentrok->exists();
    }

    /**
     * Cek bentrok antar Kelompok Besar vs Kelompok Besar Antara
     */
    private function checkKelompokBesarVsKelompokBesarAntaraBentrok($data, $ignoreId = null): bool
    {
        // Ambil mahasiswa dalam kelompok besar yang dipilih
        $mahasiswaIds = \App\Models\KelompokBesar::where('semester', $data['kelompok_besar_id'])
            ->pluck('mahasiswa_id')
            ->toArray();

        if (empty($mahasiswaIds)) {
            return false;
        }

        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan kelompok besar antara yang memiliki mahasiswa yang sama
        $kuliahBesarBentrok = JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->whereNotNull('kelompok_besar_antara_id')
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $kuliahBesarBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokKuliahBesar = $kuliahBesarBentrok->first();
        if ($jadwalBentrokKuliahBesar) {
            $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($jadwalBentrokKuliahBesar->kelompok_besar_antara_id);
            if ($kelompokBesarAntara && !empty(array_intersect($mahasiswaIds, $kelompokBesarAntara->mahasiswa_ids))) {
                return true;
            }
        }

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar antara yang memiliki mahasiswa yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->whereNotNull('kelompok_besar_antara_id')
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($agendaKhususBentrok) {
            $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($agendaKhususBentrok->kelompok_besar_antara_id);
            if ($kelompokBesarAntara && !empty(array_intersect($mahasiswaIds, $kelompokBesarAntara->mahasiswa_ids))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Cek bentrok antar Kelompok Besar Antara vs Kelompok Besar
     */
    private function checkKelompokBesarAntaraVsKelompokBesarBentrok($data, $ignoreId = null): bool
    {
        // Ambil mahasiswa dalam kelompok besar antara yang dipilih
        $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($data['kelompok_besar_antara_id']);
        if (!$kelompokBesarAntara || empty($kelompokBesarAntara->mahasiswa_ids)) {
            return false;
        }

        $mahasiswaIds = $kelompokBesarAntara->mahasiswa_ids;

        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan kelompok besar yang memiliki mahasiswa yang sama
        $kuliahBesarBentrok = JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->whereNotNull('kelompok_besar_id')
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $kuliahBesarBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokKuliahBesar = $kuliahBesarBentrok->first();
        if ($jadwalBentrokKuliahBesar) {
            $kelompokBesarMahasiswaIds = \App\Models\KelompokBesar::where('semester', $jadwalBentrokKuliahBesar->kelompok_besar_id)
                ->pluck('mahasiswa_id')
                ->toArray();

            if (!empty(array_intersect($mahasiswaIds, $kelompokBesarMahasiswaIds))) {
                return true;
            }
        }

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar yang memiliki mahasiswa yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->whereNotNull('kelompok_besar_id')
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($agendaKhususBentrok) {
            $kelompokBesarMahasiswaIds = \App\Models\KelompokBesar::where('semester', $agendaKhususBentrok->kelompok_besar_id)
                ->pluck('mahasiswa_id')
                ->toArray();

            if (!empty(array_intersect($mahasiswaIds, $kelompokBesarMahasiswaIds))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Cek bentrok antar Kelompok Besar dengan detail
     */
    private function checkKelompokBesarVsKelompokBesarBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Cek bentrok dengan jadwal Kuliah Besar lain yang menggunakan kelompok besar yang sama
        $kuliahBesarBentrok = JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_id', $data['kelompok_besar_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $kuliahBesarBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokKuliahBesar = $kuliahBesarBentrok->first();
        if ($jadwalBentrokKuliahBesar) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokKuliahBesar->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokKuliahBesar->jam_selesai);
            $bentrokReason = "Kelompok Besar vs Kelompok Besar: Kelompok Besar Semester " . $data['kelompok_besar_id'];
            return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_id', $data['kelompok_besar_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($agendaKhususBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_selesai);
            $bentrokReason = "Kelompok Besar vs Kelompok Besar: Kelompok Besar Semester " . $data['kelompok_besar_id'];
            return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        return null;
    }

    /**
     * Cek bentrok dengan kelompok besar antara (Kelompok Besar Antara vs Kelompok Kecil Antara)
     */
    private function checkKelompokBesarAntaraBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Ambil mahasiswa dalam kelompok besar antara yang dipilih
        $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($data['kelompok_besar_antara_id']);
        if (!$kelompokBesarAntara || empty($kelompokBesarAntara->mahasiswa_ids)) {
            return null;
        }

        $mahasiswaIds = $kelompokBesarAntara->mahasiswa_ids;

        // Cek bentrok dengan jadwal PBL yang menggunakan kelompok kecil antara dari mahasiswa yang sama
        $pblBentrok = \App\Models\JadwalPBL::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereExists(function ($query) use ($mahasiswaIds) {
                $query->select(\DB::raw(1))
                    ->from('kelompok_kecil_antara')
                    ->whereRaw('kelompok_kecil_antara.id = jadwal_pbl.kelompok_kecil_id')
                    ->whereJsonOverlaps('kelompok_kecil_antara.mahasiswa_ids', $mahasiswaIds);
            })
            ->first();

        if ($pblBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $pblBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $pblBentrok->jam_selesai);
            $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($pblBentrok->kelompok_kecil_id);
            $bentrokReason = "Kelompok Besar Antara vs Kelompok Kecil Antara: " . ($kelompokKecilAntara ? $kelompokKecilAntara->nama_kelompok : 'Tidak diketahui');
            return "Jadwal bentrok dengan Jadwal PBL pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Jurnal Reading yang menggunakan kelompok kecil antara dari mahasiswa yang sama
        $jurnalBentrok = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereExists(function ($query) use ($mahasiswaIds) {
                $query->select(\DB::raw(1))
                    ->from('kelompok_kecil_antara')
                    ->whereRaw('kelompok_kecil_antara.id = jadwal_jurnal_reading.kelompok_kecil_id')
                    ->whereJsonOverlaps('kelompok_kecil_antara.mahasiswa_ids', $mahasiswaIds);
            })
            ->first();

        if ($jurnalBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $jurnalBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jurnalBentrok->jam_selesai);
            $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($jurnalBentrok->kelompok_kecil_id);
            $bentrokReason = "Kelompok Besar Antara vs Kelompok Kecil Antara: " . ($kelompokKecilAntara ? $kelompokKecilAntara->nama_kelompok : 'Tidak diketahui');
            return "Jadwal bentrok dengan Jadwal Jurnal Reading pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        return null;
    }

    /**
     * Cek bentrok antar Kelompok Besar Antara (Kelompok Besar Antara vs Kelompok Besar Antara)
     */
    private function checkKelompokBesarAntaraVsKelompokBesarAntaraBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Cek bentrok dengan jadwal Kuliah Besar lain yang menggunakan kelompok besar antara yang sama
        $kuliahBesarBentrok = JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_antara_id', $data['kelompok_besar_antara_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $kuliahBesarBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokKuliahBesar = $kuliahBesarBentrok->first();
        if ($jadwalBentrokKuliahBesar) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokKuliahBesar->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokKuliahBesar->jam_selesai);
            $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($data['kelompok_besar_antara_id']);
            $bentrokReason = "Kelompok Besar Antara vs Kelompok Besar Antara: " . ($kelompokBesarAntara ? $kelompokBesarAntara->nama_kelompok : 'Tidak diketahui');
            return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar antara yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_antara_id', $data['kelompok_besar_antara_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($agendaKhususBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_selesai);
            $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($data['kelompok_besar_antara_id']);
            $bentrokReason = "Kelompok Besar Antara vs Kelompok Besar Antara: " . ($kelompokBesarAntara ? $kelompokBesarAntara->nama_kelompok : 'Tidak diketahui');
            return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        return null;
    }

    /**
     * Cek bentrok antar Kelompok Besar vs Kelompok Besar Antara
     */
    private function checkKelompokBesarVsKelompokBesarAntaraBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Ambil mahasiswa dalam kelompok besar yang dipilih
        $mahasiswaIds = \App\Models\KelompokBesar::where('semester', $data['kelompok_besar_id'])
            ->pluck('mahasiswa_id')
            ->toArray();

        if (empty($mahasiswaIds)) {
            return null;
        }

        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan kelompok besar antara yang memiliki mahasiswa yang sama
        $kuliahBesarBentrok = JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->whereNotNull('kelompok_besar_antara_id')
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $kuliahBesarBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokKuliahBesar = $kuliahBesarBentrok->first();
        if ($jadwalBentrokKuliahBesar) {
            $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($jadwalBentrokKuliahBesar->kelompok_besar_antara_id);
            if ($kelompokBesarAntara && !empty(array_intersect($mahasiswaIds, $kelompokBesarAntara->mahasiswa_ids))) {
                $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokKuliahBesar->jam_mulai);
                $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokKuliahBesar->jam_selesai);
                $bentrokReason = "Kelompok Besar vs Kelompok Besar Antara: " . $kelompokBesarAntara->nama_kelompok;
                return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " .
                    date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                    $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
            }
        }

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar antara yang memiliki mahasiswa yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->whereNotNull('kelompok_besar_antara_id')
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($agendaKhususBentrok) {
            $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($agendaKhususBentrok->kelompok_besar_antara_id);
            if ($kelompokBesarAntara && !empty(array_intersect($mahasiswaIds, $kelompokBesarAntara->mahasiswa_ids))) {
                $jamMulaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_mulai);
                $jamSelesaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_selesai);
                $bentrokReason = "Kelompok Besar vs Kelompok Besar Antara: " . $kelompokBesarAntara->nama_kelompok;
                return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " .
                    date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                    $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
            }
        }

        return null;
    }

    /**
     * Cek bentrok antar Kelompok Besar Antara vs Kelompok Besar
     */
    private function checkKelompokBesarAntaraVsKelompokBesarBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Ambil mahasiswa dalam kelompok besar antara yang dipilih
        $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($data['kelompok_besar_antara_id']);
        if (!$kelompokBesarAntara || empty($kelompokBesarAntara->mahasiswa_ids)) {
            return null;
        }

        $mahasiswaIds = $kelompokBesarAntara->mahasiswa_ids;

        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan kelompok besar yang memiliki mahasiswa yang sama
        $kuliahBesarBentrok = JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->whereNotNull('kelompok_besar_id')
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $kuliahBesarBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokKuliahBesar = $kuliahBesarBentrok->first();
        if ($jadwalBentrokKuliahBesar) {
            $kelompokBesarMahasiswaIds = \App\Models\KelompokBesar::where('semester', $jadwalBentrokKuliahBesar->kelompok_besar_id)
                ->pluck('mahasiswa_id')
                ->toArray();

            if (!empty(array_intersect($mahasiswaIds, $kelompokBesarMahasiswaIds))) {
                $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokKuliahBesar->jam_mulai);
                $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokKuliahBesar->jam_selesai);
                $bentrokReason = "Kelompok Besar Antara vs Kelompok Besar: Kelompok Besar Semester " . $jadwalBentrokKuliahBesar->kelompok_besar_id;
                return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " .
                    date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                    $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
            }
        }

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar yang memiliki mahasiswa yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->whereNotNull('kelompok_besar_id')
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($agendaKhususBentrok) {
            $kelompokBesarMahasiswaIds = \App\Models\KelompokBesar::where('semester', $agendaKhususBentrok->kelompok_besar_id)
                ->pluck('mahasiswa_id')
                ->toArray();

            if (!empty(array_intersect($mahasiswaIds, $kelompokBesarMahasiswaIds))) {
                $jamMulaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_mulai);
                $jamSelesaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_selesai);
                $bentrokReason = "Kelompok Besar Antara vs Kelompok Besar: Kelompok Besar Semester " . $agendaKhususBentrok->kelompok_besar_id;
                return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " .
                    date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                    $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
            }
        }

        return null;
    }

    /**
     * Simpan riwayat konfirmasi dosen
     */
    private function saveRiwayatKonfirmasi($jadwal, $status, $alasan = null, $dosen_id = null)
    {
        try {
            \App\Models\RiwayatKonfirmasiDosen::create([
                'dosen_id' => $dosen_id ?: $jadwal->dosen_id,
                'jadwal_type' => 'kuliah_besar',
                'jadwal_id' => $jadwal->id,
                'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                'tanggal' => $jadwal->tanggal,
                'jam_mulai' => $jadwal->jam_mulai,
                'jam_selesai' => $jadwal->jam_selesai,
                'ruangan' => $jadwal->ruangan->nama,
                'materi' => $jadwal->materi,
                'topik' => $jadwal->topik,
                'status_konfirmasi' => $status,
                'alasan_konfirmasi' => $alasan,
                'waktu_konfirmasi' => now()
            ]);
        } catch (\Exception $e) {
            \Log::error("Gagal menyimpan riwayat konfirmasi kuliah besar: " . $e->getMessage());
        }
    }

    /**
     * Get jadwal kuliah besar untuk dosen tertentu
     */
    public function getJadwalForDosen($dosenId, Request $request)
    {
        try {
            $semesterType = $request->query('semester_type');

            $query = JadwalKuliahBesar::with([
                'mataKuliah:kode,nama,semester',
                'ruangan:id,nama,gedung',
                'kelompokBesarAntara:id,nama_kelompok'
            ])
                ->select([
                    'id',
                    'mata_kuliah_kode',
                    'materi',
                    'topik',
                    'dosen_id',
                    'dosen_ids',
                    'ruangan_id',
                    'kelompok_besar_id',
                    'kelompok_besar_antara_id',
                    'tanggal',
                    'jam_mulai',
                    'jam_selesai',
                    'jumlah_sesi',
                    'status_konfirmasi',
                    'alasan_konfirmasi',
                    'status_reschedule',
                    'reschedule_reason',
                    'created_at'
                ])
                ->where(function ($query) use ($dosenId) {
                    $query->where('dosen_id', $dosenId)
                        ->orWhereJsonContains('dosen_ids', (int)$dosenId);
                });

            // Filter berdasarkan semester type jika ada
            if ($semesterType && $semesterType !== 'all') {
                if ($semesterType === 'reguler') {
                    $query->whereHas('mataKuliah', function ($q) {
                        $q->where('semester', '!=', 'Antara');
                    });
                } elseif ($semesterType === 'antara') {
                    $query->whereHas('mataKuliah', function ($q) {
                        $q->where('semester', 'Antara');
                    });
                }
            }

            $jadwal = $query->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();

            // Tambahkan data dosen dan semester_type untuk setiap jadwal
            $jadwal->each(function ($item) use ($dosenId) {
                if ($item->dosen_id) {
                    $item->dosen = \App\Models\User::find($item->dosen_id);
                } elseif ($item->dosen_ids && in_array($dosenId, $item->dosen_ids)) {
                    $item->dosen = \App\Models\User::find($dosenId);
                }

                // Tambahkan semester_type berdasarkan mata kuliah
                $item->semester_type = $item->mataKuliah && $item->mataKuliah->semester === 'Antara' ? 'antara' : 'reguler';
            });

            return response()->json([
                'data' => $jadwal,
                'message' => 'Jadwal kuliah besar berhasil diambil'
            ]);
        } catch (\Exception $e) {
            \Log::error("Error getting jadwal kuliah besar for dosen {$dosenId}: " . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil jadwal kuliah besar',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Get jadwal Kuliah Besar for mahasiswa
    public function getJadwalForMahasiswa($mahasiswaId, Request $request)
    {
        try {
            // Check if user exists and is mahasiswa
            $mahasiswa = User::where('id', $mahasiswaId)->where('role', 'mahasiswa')->first();
            if (!$mahasiswa) {
                return response()->json([
                    'message' => 'Mahasiswa tidak ditemukan',
                    'data' => []
                ], 404);
            }

            // Get kelompok besar based on mahasiswa semester
            $kelompokBesar = \App\Models\KelompokBesar::where('semester', $mahasiswa->semester)->first();

            if (!$kelompokBesar) {
                return response()->json([
                    'message' => 'Mahasiswa belum memiliki kelompok besar',
                    'data' => []
                ]);
            }

            $query = JadwalKuliahBesar::with([
                'mataKuliah',
                'dosen',
                'ruangan',
                'kelompokBesar'
            ])->where('kelompok_besar_id', $kelompokBesar->id);

            $jadwal = $query->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();

            $mappedJadwal = $jadwal->map(function ($item) {
                return [
                    'id' => $item->id,
                    'tanggal' => $item->tanggal,
                    'jam_mulai' => substr($item->jam_mulai, 0, 5),
                    'jam_selesai' => substr($item->jam_selesai, 0, 5),
                    'materi' => $item->materi ?? 'N/A',
                    'topik' => $item->topik ?? 'N/A',
                    'mata_kuliah_kode' => $item->mata_kuliah_kode,
                    'mata_kuliah_nama' => $item->mataKuliah->nama ?? 'N/A',
                    'dosen' => $item->dosen ? [
                        'id' => $item->dosen->id,
                        'name' => $item->dosen->name,
                    ] : null,
                    'ruangan' => $item->ruangan ? [
                        'id' => $item->ruangan->id,
                        'nama' => $item->ruangan->nama,
                    ] : null,
                    'jumlah_sesi' => $item->jumlah_sesi ?? 1,
                    'semester_type' => 'reguler',
                ];
            });

            return response()->json([
                'message' => 'Data jadwal Kuliah Besar berhasil diambil',
                'data' => $mappedJadwal
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching jadwal Kuliah Besar for mahasiswa: ' . $e->getMessage());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengambil data jadwal Kuliah Besar',
                'error' => $e->getMessage(),
                'data' => []
            ], 500);
        }
    }

    /**
     * Kirim notifikasi assignment ke dosen
     */
    private function sendAssignmentNotification($jadwal, $dosenId)
    {
        try {
            $dosen = \App\Models\User::find($dosenId);
            if (!$dosen) {
                \Log::warning("Dosen dengan ID {$dosenId} tidak ditemukan untuk notifikasi jadwal kuliah besar");
                return;
            }

            $mataKuliah = $jadwal->mataKuliah;
            $ruangan = $jadwal->ruangan;

            \App\Models\Notification::create([
                'user_id' => $dosenId,
                'title' => 'Jadwal Kuliah Besar Baru',
                'message' => "Anda telah di-assign untuk mengajar Kuliah Besar {$mataKuliah->nama} pada tanggal " .
                    date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                    str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                    " di ruangan {$ruangan->nama}. Silakan konfirmasi ketersediaan Anda.",
                'type' => 'info',
                'is_read' => false,
                'data' => [
                    'jadwal_id' => $jadwal->id,
                    'jadwal_type' => 'kuliah_besar',
                    'mata_kuliah_kode' => $mataKuliah->kode,
                    'mata_kuliah_nama' => $mataKuliah->nama,
                    'tanggal' => $jadwal->tanggal,
                    'jam_mulai' => $jadwal->jam_mulai,
                    'jam_selesai' => $jadwal->jam_selesai,
                    'ruangan' => $ruangan->nama,
                    'materi' => $jadwal->materi,
                    'topik' => $jadwal->topik,
                    'dosen_id' => $dosen->id,
                    'dosen_name' => $dosen->name,
                    'dosen_role' => $dosen->role,
                    'created_by' => auth()->user()->name ?? 'Admin',
                    'created_by_role' => auth()->user()->role ?? 'admin',
                    'sender_name' => auth()->user()->name ?? 'Admin',
                    'sender_role' => auth()->user()->role ?? 'admin'
                ]
            ]);


            \Log::info("Notifikasi jadwal kuliah besar berhasil dikirim ke dosen {$dosen->name} (ID: {$dosenId})");
        } catch (\Exception $e) {
            \Log::error("Gagal mengirim notifikasi jadwal kuliah besar ke dosen {$dosenId}: " . $e->getMessage());
        }
    }

    /**
     * Send notification to mahasiswa in the semester
     */
    private function sendNotificationToMahasiswa($jadwal)
    {
        try {
            // Get all mahasiswa in the same semester
            $mahasiswaList = \App\Models\User::where('role', 'mahasiswa')
                ->where('semester', $jadwal->mataKuliah->semester)
                ->get();

            // Send notification to each mahasiswa
            foreach ($mahasiswaList as $mahasiswa) {
                \App\Models\Notification::create([
                    'user_id' => $mahasiswa->id,
                    'title' => 'Jadwal Kuliah Besar Baru',
                    'message' => "Jadwal Kuliah Besar baru telah ditambahkan: {$jadwal->mataKuliah->nama} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}.",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'kuliah_besar',
                        'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                        'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                        'materi' => $jadwal->materi,
                        'topik' => $jadwal->topik,
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

            \Log::info("Kuliah Besar notifications sent to " . count($mahasiswaList) . " mahasiswa for jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Error sending Kuliah Besar notifications to mahasiswa: " . $e->getMessage());
        }
    }

    /**
     * Konfirmasi ketersediaan dosen untuk jadwal kuliah besar
     */
    public function konfirmasi(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:bisa,tidak_bisa',
            'alasan' => 'nullable|string|max:1000',
            'dosen_id' => 'required|exists:users,id' // Tambahkan validasi dosen_id
        ]);

        $jadwal = JadwalKuliahBesar::with(['mataKuliah', 'ruangan'])->findOrFail($id);

        // Cek apakah dosen_id ada dalam dosen_ids (untuk semester antara)
        if ($jadwal->dosen_ids && in_array($request->dosen_id, $jadwal->dosen_ids)) {
            // Untuk semester antara - update status di pivot table atau field khusus
            $jadwal->update([
                'status_konfirmasi' => $request->status,
                'alasan_konfirmasi' => $request->alasan
            ]);

            // Ambil data dosen untuk notifikasi
            $dosen = \App\Models\User::find($request->dosen_id);

            // Reload jadwal dengan relasi untuk response
            $jadwal = JadwalKuliahBesar::with(['mataKuliah', 'ruangan'])->findOrFail($id);
            $jadwal->dosen = $dosen; // Set dosen untuk response
        } else {
            // Untuk semester biasa - single dosen
            $jadwal = JadwalKuliahBesar::with(['dosen', 'mataKuliah', 'ruangan'])->findOrFail($id);
            $jadwal->update([
                'status_konfirmasi' => $request->status,
                'alasan_konfirmasi' => $request->alasan
            ]);

            $dosen = $jadwal->dosen;
        }

        // Simpan riwayat konfirmasi
        $this->saveRiwayatKonfirmasi($jadwal, $request->status, $request->alasan, $request->dosen_id);

        // Kirim notifikasi ke super admin berdasarkan status
        \Log::info("Konfirmasi jadwal kuliah besar ID: {$jadwal->id}, Status: {$request->status}, Dosen: {$dosen->name}");

        if ($request->status === 'tidak_bisa') {
            \Log::info("Mengirim notifikasi replacement untuk jadwal ID: {$jadwal->id}");
            $this->sendReplacementNotification($jadwal, $request->alasan, $dosen);
        } elseif ($request->status === 'bisa') {
            \Log::info("Mengirim notifikasi konfirmasi bisa untuk jadwal ID: {$jadwal->id}");
            $this->sendConfirmationNotification($jadwal, 'bisa', $dosen);
        }

        return response()->json([
            'message' => 'Konfirmasi berhasil disimpan',
            'status' => $request->status
        ]);
    }

    /**
     * Get riwayat konfirmasi dosen
     */
    public function getRiwayatDosen($dosenId)
    {
        try {
            $riwayat = \App\Models\RiwayatKonfirmasiDosen::with('dosen')
                ->where('dosen_id', $dosenId)
                ->orderBy('waktu_konfirmasi', 'desc')
                ->get();

            return response()->json([
                'data' => $riwayat,
                'message' => 'Riwayat konfirmasi berhasil diambil'
            ]);
        } catch (\Exception $e) {
            \Log::error("Error getting riwayat dosen {$dosenId}: " . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil riwayat konfirmasi',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Kirim notifikasi konfirmasi ke super admin
     */
    private function sendConfirmationNotification($jadwal, $status, $dosen)
    {
        try {
            \Log::info("Memulai pengiriman notifikasi konfirmasi untuk jadwal ID: {$jadwal->id}, Status: {$status}");

            $superAdmins = \App\Models\User::where('role', 'super_admin')->get();
            \Log::info("Ditemukan {$superAdmins->count()} super admin");

            $statusText = $status === 'bisa' ? 'Bisa Mengajar' : 'Tidak Bisa Mengajar';
            $type = $status === 'bisa' ? 'success' : 'warning';

            foreach ($superAdmins as $admin) {
                \Log::info("Mengirim notifikasi ke admin ID: {$admin->id}, Nama: {$admin->name}");
                \App\Models\Notification::create([
                    'user_id' => $dosen->id,
                    'title' => "Konfirmasi Jadwal - {$statusText}",
                    'message' => "Dosen {$dosen->name} telah mengkonfirmasi {$statusText} untuk jadwal Kuliah Besar {$jadwal->mataKuliah->nama} pada tanggal " .
                        date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                        str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                        " di ruangan {$jadwal->ruangan->nama}.",
                    'type' => $type,
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'kuliah_besar',
                        'dosen_id' => $dosen->id,
                        'dosen_name' => $dosen->name,
                        'dosen_role' => $dosen->role,
                        'mata_kuliah' => $jadwal->mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal,
                        'waktu' => $jadwal->jam_mulai . ' - ' . $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'status_konfirmasi' => $status,
                        'dosen_name' => $dosen->name,
                        'dosen_role' => $dosen->role
                    ]
                ]);
            }

            \Log::info("Notifikasi konfirmasi {$status} berhasil dikirim ke super admin untuk jadwal kuliah besar ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Gagal mengirim notifikasi konfirmasi: " . $e->getMessage());
        }
    }

    /**
     * Kirim notifikasi replacement ke super admin
     */
    private function sendReplacementNotification($jadwal, $alasan = null, $dosen = null)
    {
        try {
            $superAdmins = \App\Models\User::where('role', 'super_admin')->get();
            $alasanText = $alasan ? "\n\nAlasan: {$alasan}" : "";

            // Jika dosen tidak diberikan, ambil dari relasi (untuk backward compatibility)
            if (!$dosen && $jadwal->dosen) {
                $dosen = $jadwal->dosen;
            }

            foreach ($superAdmins as $admin) {
                \App\Models\Notification::create([
                    'user_id' => $dosen->id,
                    'title' => 'Dosen Tidak Bisa Mengajar - Kuliah Besar',
                    'message' => "Dosen {$dosen->name} tidak bisa mengajar pada jadwal Kuliah Besar {$jadwal->mataKuliah->nama} pada tanggal " .
                        date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                        str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                        " di ruangan {$jadwal->ruangan->nama}.{$alasanText}",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'kuliah_besar',
                        'dosen_id' => $dosen->id,
                        'dosen_name' => $dosen->name,
                        'dosen_role' => $dosen->role,
                        'mata_kuliah' => $jadwal->mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal,
                        'waktu' => $jadwal->jam_mulai . ' - ' . $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'alasan' => $alasan,
                        'dosen_name' => $dosen->name,
                        'dosen_role' => $dosen->role
                    ]
                ]);
            }

            \Log::info("Notifikasi replacement berhasil dikirim ke super admin untuk jadwal kuliah besar ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Gagal mengirim notifikasi replacement untuk jadwal kuliah besar ID {$jadwal->id}: " . $e->getMessage());
        }
    }

    /**
     * Import jadwal kuliah besar dari Excel
     */
    public function importExcel(Request $request, $kode)
    {
        try {
            // Validasi input
            $request->validate([
                'data' => 'required|array|min:1',
                'data.*.tanggal' => 'required|date',
                'data.*.jam_mulai' => 'required|string',
                'data.*.jam_selesai' => 'required|string',
                'data.*.materi' => 'required|string',
                'data.*.dosen_id' => 'required|integer|exists:users,id',
                'data.*.ruangan_id' => 'required|integer|exists:ruangan,id',
                'data.*.jumlah_sesi' => 'required|integer|min:1|max:6',
            ]);

            $excelData = $request->input('data');
            $successCount = 0;
            $errors = [];

            // Cek apakah mata kuliah adalah semester antara
            $mataKuliah = MataKuliah::where('kode', $kode)->first();
            if (!$mataKuliah) {
                return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
            }
            $isSemesterAntara = $mataKuliah->semester === "Antara";

            // Validasi dan import data satu per satu
            foreach ($excelData as $index => $data) {
                try {
                    // Validasi tanggal dalam rentang mata kuliah
                    $tanggalMessage = $this->validateTanggalMataKuliah($data, $mataKuliah);
                    if ($tanggalMessage) {
                        $errors[] = "Baris " . ($index + 1) . ": " . $tanggalMessage;
                        continue;
                    }

                    // Validasi kapasitas ruangan
                    $kapasitasMessage = $this->validateRuanganCapacity($data, $isSemesterAntara);
                    if ($kapasitasMessage) {
                        $errors[] = "Baris " . ($index + 1) . ": " . $kapasitasMessage;
                        continue;
                    }

                    // Validasi bentrok
                    $bentrokMessage = $this->checkBentrokWithDetail($data, null, $isSemesterAntara);
                    if ($bentrokMessage) {
                        $errors[] = "Baris " . ($index + 1) . ": " . $bentrokMessage;
                        continue;
                    }

                    // Validasi keahlian dosen dengan materi (hanya untuk semester biasa)
                    if (!$isSemesterAntara && isset($data['materi']) && isset($data['dosen_id'])) {
                        $dosen = User::find($data['dosen_id']);
                        if ($dosen) {
                            $keahlianDosen = is_array($dosen->keahlian)
                                ? $dosen->keahlian
                                : array_map('trim', explode(',', $dosen->keahlian ?? ''));

                            if (!in_array($data['materi'], $keahlianDosen)) {
                                $errors[] = "Baris " . ($index + 1) . ": Materi \"" . $data['materi'] . "\" tidak sesuai dengan keahlian dosen \"" . $dosen->name . "\". Keahlian dosen: " . implode(', ', $keahlianDosen);
                                continue;
                            }
                        }
                    }

                    // Validasi kelompok besar ID sesuai dengan semester mata kuliah (hanya untuk semester biasa)
                    if (!$isSemesterAntara && isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
                        $kelompokBesarSemester = $data['kelompok_besar_id'];
                        $mataKuliahSemester = $mataKuliah->semester;

                        if ($kelompokBesarSemester != $mataKuliahSemester) {
                            $errors[] = "Baris " . ($index + 1) . ": Kelompok besar ID {$kelompokBesarSemester} tidak sesuai dengan semester mata kuliah ({$mataKuliahSemester}). Hanya boleh menggunakan kelompok besar semester {$mataKuliahSemester}.";
                            continue;
                        }
                    }

                    // Siapkan data untuk disimpan
                    $jadwalData = [
                        'mata_kuliah_kode' => $kode,
                        'tanggal' => $data['tanggal'],
                        'jam_mulai' => $data['jam_mulai'],
                        'jam_selesai' => $data['jam_selesai'],
                        'materi' => $data['materi'],
                        'topik' => $data['topik'] ?? null,
                        'dosen_id' => $data['dosen_id'],
                        'ruangan_id' => $data['ruangan_id'],
                        'jumlah_sesi' => $data['jumlah_sesi'],
                        'kelompok_besar_id' => $data['kelompok_besar_id'] ?? null,
                        'kelompok_besar_antara_id' => $data['kelompok_besar_antara_id'] ?? null,
                    ];

                    // Untuk semester antara, set dosen_ids
                    if ($isSemesterAntara) {
                        $jadwalData['dosen_ids'] = [$data['dosen_id']];
                        $jadwalData['materi'] = null;
                        $jadwalData['dosen_id'] = null;
                    }

                    // Simpan data
                    $jadwal = JadwalKuliahBesar::create($jadwalData);

                    // Kirim notifikasi ke dosen yang di-assign
                    if (!$isSemesterAntara && isset($data['dosen_id']) && $data['dosen_id']) {
                        // Untuk semester biasa - single dosen
                        $this->sendAssignmentNotification($jadwal, $data['dosen_id']);
                    } elseif ($isSemesterAntara && isset($data['dosen_id']) && $data['dosen_id']) {
                        // Untuk semester antara - single dosen
                        $this->sendAssignmentNotification($jadwal, $data['dosen_id']);
                    }

                    // Log activity
                    activity()
                        ->performedOn($jadwal)
                        ->withProperties([
                            'mata_kuliah_kode' => $kode,
                            'topik' => $jadwalData['topik'] ?? null,
                            'tanggal' => $data['tanggal'],
                            'jam_mulai' => $data['jam_mulai'],
                            'jam_selesai' => $data['jam_selesai'],
                            'materi' => $data['materi'],
                            'dosen_id' => $data['dosen_id'],
                            'ruangan_id' => $data['ruangan_id'],
                            'jumlah_sesi' => $data['jumlah_sesi'],
                            'import_type' => 'excel'
                        ])
                        ->log('Jadwal kuliah besar diimport dari Excel');

                    $successCount++;
                } catch (\Exception $e) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $e->getMessage();
                }
            }

            // Jika ada error validasi, return status 422
            if (count($errors) > 0) {
                return response()->json([
                    'success' => $successCount,
                    'total' => count($excelData),
                    'errors' => $errors,
                    'message' => "Gagal mengimport {$successCount} dari " . count($excelData) . " jadwal"
                ], 422);
            }

            // Jika tidak ada error, return status 200
            return response()->json([
                'success' => $successCount,
                'total' => count($excelData),
                'errors' => $errors,
                'message' => "Berhasil mengimport {$successCount} dari " . count($excelData) . " jadwal"
            ]);
        } catch (\Exception $e) {
            \Log::error('Error importing jadwal kuliah besar: ' . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengimport data: ' . $e->getMessage()
            ], 500);
        }
    }

    // Ajukan reschedule jadwal Kuliah Besar
    public function reschedule(Request $request, $id)
    {
        $request->validate([
            'reschedule_reason' => 'required|string|max:1000',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $jadwal = JadwalKuliahBesar::with(['mataKuliah', 'ruangan'])->findOrFail($id);

        // Cek apakah dosen_id ada dalam dosen_ids (untuk semester antara)
        if ($jadwal->dosen_ids && in_array($request->dosen_id, $jadwal->dosen_ids)) {
            // Untuk semester antara - update status
            $jadwal->update([
                'status_konfirmasi' => 'waiting_reschedule',
                'reschedule_reason' => $request->reschedule_reason,
                'status_reschedule' => 'waiting'
            ]);

            $dosen = \App\Models\User::find($request->dosen_id);
        } else {
            // Untuk semester biasa - single dosen
            $jadwal = JadwalKuliahBesar::with(['dosen', 'mataKuliah', 'ruangan'])->findOrFail($id);
            $jadwal->update([
                'status_konfirmasi' => 'waiting_reschedule',
                'reschedule_reason' => $request->reschedule_reason,
                'status_reschedule' => 'waiting'
            ]);

            $dosen = $jadwal->dosen;
        }

        // Kirim notifikasi ke admin
        $this->sendRescheduleNotification($jadwal, $request->reschedule_reason, $dosen);

        return response()->json([
            'message' => 'Permintaan reschedule berhasil diajukan',
            'status' => 'waiting_reschedule'
        ]);
    }

    /**
     * Kirim notifikasi reschedule ke admin
     */
    private function sendRescheduleNotification($jadwal, $reason, $dosen)
    {
        try {
            // Buat hanya 1 notifikasi yang bisa dilihat oleh semua admin
            $firstAdmin = User::where('role', 'super_admin')->first() ?? User::where('role', 'tim_akademik')->first();

            if ($firstAdmin) {
                Notification::create([
                    'user_id' => $firstAdmin->id,
                    'title' => 'Permintaan Reschedule Jadwal',
                    'message' => "Dosen {$dosen->name} mengajukan reschedule untuk jadwal Kuliah Besar. Alasan: {$reason}",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'kuliah_besar',
                        'dosen_name' => $dosen->name,
                        'dosen_id' => $dosen->id,
                        'reschedule_reason' => $reason,
                        'notification_type' => 'reschedule_request'
                    ]
                ]);
            }

            \Log::info("Reschedule notification sent for Kuliah Besar jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Error sending reschedule notification for Kuliah Besar jadwal ID: {$jadwal->id}: " . $e->getMessage());
        }
    }
}
