<?php

namespace App\Http\Controllers;

use App\Models\JadwalPraktikum;
use App\Models\MataKuliah;
use App\Models\Ruangan;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class JadwalPraktikumController extends Controller
{
    // List semua jadwal praktikum untuk satu mata kuliah blok
    public function index($kode)
    {
        $jadwal = JadwalPraktikum::with(['mataKuliah', 'ruangan', 'dosen'])
            ->where('mata_kuliah_kode', $kode)
            ->orderBy('tanggal')
            ->orderBy('jam_mulai')
            ->get();
        return response()->json($jadwal);
    }

    // Tambah jadwal praktikum baru
    public function store(Request $request, $kode)
    {
        $data = $request->validate([
            'materi' => 'required|string',
            'topik' => 'nullable|string',
            'kelas_praktikum' => 'required|string',
            'ruangan_id' => 'required|exists:ruangan,id',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
            'dosen_ids' => 'required|array|min:1',
            'dosen_ids.*' => 'exists:users,id',
        ]);
        $data['mata_kuliah_kode'] = $kode;
        $data['created_by'] = $request->input('created_by', auth()->id());

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

        $jadwal = JadwalPraktikum::create($data);



        // Log activity


        activity()


            ->log('Jadwal Praktikum deleted');



        // Log activity


        activity()


            ->log('Jadwal Praktikum updated');



        // Log activity


        activity()


            ->log('Jadwal Praktikum created');

        // Attach dosen
        $jadwal->dosen()->attach($data['dosen_ids']);

        // Kirim notifikasi ke semua dosen yang di-assign
        foreach ($data['dosen_ids'] as $dosenId) {
            $this->sendAssignmentNotification($jadwal, $dosenId);
        }

        // Load relasi untuk response
        $jadwal->load(['mataKuliah', 'ruangan', 'dosen']);

        // Send notification to mahasiswa
        $this->sendNotificationToMahasiswa($jadwal);

        return response()->json($jadwal, Response::HTTP_CREATED);
    }

    // Update jadwal praktikum
    public function update(Request $request, $kode, $id)
    {
        $jadwal = JadwalPraktikum::findOrFail($id);
        $data = $request->validate([
            'materi' => 'required|string',
            'topik' => 'nullable|string',
            'kelas_praktikum' => 'required|string',
            'ruangan_id' => 'required|exists:ruangan,id',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
            'dosen_ids' => 'required|array|min:1',
            'dosen_ids.*' => 'exists:users,id',
        ]);
        $data['mata_kuliah_kode'] = $kode;
        $data['created_by'] = $request->input('created_by', auth()->id());

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


        // Log activity

        activity()

            ->log('Jadwal Praktikum deleted');


        // Log activity

        activity()

            ->log('Jadwal Praktikum updated');


        // Log activity

        activity()

            ->log('Jadwal Praktikum created');

        // Sync dosen (replace semua dosen yang ada)
        $jadwal->dosen()->sync($data['dosen_ids']);

        // Load relasi untuk response
        $jadwal->load(['mataKuliah', 'ruangan', 'dosen']);

        return response()->json($jadwal);
    }

    // Hapus jadwal praktikum
    public function destroy($kode, $id)
    {
        $jadwal = JadwalPraktikum::findOrFail($id);
        $jadwal->delete();


        // Log activity

        activity()

            ->log('Jadwal Praktikum deleted');


        // Log activity

        activity()

            ->log('Jadwal Praktikum updated');


        // Log activity

        activity()

            ->log('Jadwal Praktikum created');
        return response()->json(['message' => 'Jadwal praktikum berhasil dihapus']);
    }

    // Get kelas praktikum berdasarkan semester
    public function getKelasPraktikum($semester)
    {
        try {
            // Ambil kelas dari semester yang sesuai
            $kelas = \App\Models\Kelas::where('semester', $semester)->get();
            return response()->json($kelas);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data kelas'], 500);
        }
    }

    // Get materi (keahlian) untuk praktikum
    public function getMateri($blok, $semester)
    {
        try {
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

            return response()->json($keahlian);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data materi'], 500);
        }
    }

    // Get pengampu berdasarkan keahlian
    public function getPengampu($keahlian, $blok, $semester)
    {
        try {
            $dosen = User::where('role', 'dosen')
                ->whereHas('dosenPeran', function ($q) use ($blok, $semester) {
                    if ($blok) $q->where('blok', $blok);
                    if ($semester) $q->where('semester', $semester);
                })
                ->get();

            $filtered = $dosen->filter(function ($d) use ($keahlian) {
                $arr = is_array($d->keahlian) ? $d->keahlian : (is_string($d->keahlian) ? explode(',', $d->keahlian) : []);
                return in_array($keahlian, array_map('trim', $arr));
            })->values();

            return response()->json($filtered);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data pengampu'], 500);
        }
    }

    // Cek bentrok antar jenis baris
    private function isBentrok($data, $ignoreId = null)
    {
        // Cek bentrok dengan jadwal Praktikum
        $praktikumBentrok = JadwalPraktikum::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data) {
                $q->where('kelas_praktikum', $data['kelas_praktikum'])
                    ->orWhere('ruangan_id', $data['ruangan_id']);
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        if ($ignoreId) {
            $praktikumBentrok->where('id', '!=', $ignoreId);
        }

        // Cek bentrok dengan jadwal PBL
        $pblBentrok = \App\Models\JadwalPBL::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan jadwal Kuliah Besar
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
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

        // Cek bentrok dengan jadwal Jurnal Reading
        $jurnalBentrok = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan kelompok besar (jika ada kelompok_besar_id di jadwal lain)
        $kelompokBesarBentrok = $this->checkKelompokBesarBentrok($data, $ignoreId);

        return $praktikumBentrok->exists() || $pblBentrok->exists() ||
            $kuliahBesarBentrok->exists() || $agendaKhususBentrok->exists() ||
            $jurnalBentrok->exists() || $kelompokBesarBentrok;
    }

    private function checkBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Cek bentrok dengan jadwal Praktikum
        $praktikumBentrok = JadwalPraktikum::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data) {
                $q->where('kelas_praktikum', $data['kelas_praktikum'])
                    ->orWhere('ruangan_id', $data['ruangan_id']);
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        if ($ignoreId) {
            $praktikumBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokPraktikum = $praktikumBentrok->first();
        if ($jadwalBentrokPraktikum) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokPraktikum->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokPraktikum->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $jadwalBentrokPraktikum);
            return "Jadwal bentrok dengan Jadwal Praktikum pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal PBL
        $pblBentrok = \App\Models\JadwalPBL::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($pblBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $pblBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $pblBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $pblBentrok);
            return "Jadwal bentrok dengan Jadwal PBL pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Kuliah Besar
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

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
            ->where(function ($q) use ($data) {
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

        // Cek bentrok dengan jadwal Jurnal Reading
        $jurnalBentrok = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($jurnalBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $jurnalBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jurnalBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $jurnalBentrok);
            return "Jadwal bentrok dengan Jadwal Jurnal Reading pada tanggal " .
                date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        return null; // Tidak ada bentrok
    }

    /**
     * Mendapatkan alasan bentrok yang detail
     */
    private function getBentrokReason($data, $jadwalBentrok): string
    {
        $reasons = [];

        // Cek bentrok ruangan
        if (isset($data['ruangan_id']) && isset($jadwalBentrok->ruangan_id) && $data['ruangan_id'] == $jadwalBentrok->ruangan_id) {
            $ruangan = \App\Models\Ruangan::find($data['ruangan_id']);
            $reasons[] = "Ruangan: " . ($ruangan ? $ruangan->nama : 'Tidak diketahui');
        }

        // Cek bentrok kelas praktikum
        if (isset($data['kelas_praktikum']) && isset($jadwalBentrok->kelas_praktikum) && $data['kelas_praktikum'] == $jadwalBentrok->kelas_praktikum) {
            $reasons[] = "Kelas Praktikum: " . $data['kelas_praktikum'];
        }

        return implode(', ', $reasons);
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

        // Untuk praktikum, hitung mahasiswa berdasarkan semester kelas praktikum
        $semester = $this->getMataKuliahSemester($data['mata_kuliah_kode']);

        // Ambil semester dari kelas praktikum
        $kelasPraktikum = \App\Models\Kelas::where('nama_kelas', $data['kelas_praktikum'])->first();
        $semesterKelas = $kelasPraktikum ? $kelasPraktikum->semester : $semester;

        // Hitung mahasiswa yang HANYA ada di kelas praktikum ini
        $jumlahMahasiswa = 0;
        if ($kelasPraktikum) {
            // Ambil kelompok yang ada di kelas ini
            $kelompokIds = DB::table('kelas_kelompok')
                ->where('kelas_id', $kelasPraktikum->id)
                ->pluck('nama_kelompok')
                ->toArray();

            // Hitung mahasiswa yang ada di kelompok tersebut
            $jumlahMahasiswa = \App\Models\KelompokKecil::where('semester', $semesterKelas)
                ->whereIn('nama_kelompok', $kelompokIds)
                ->count();
        } else {
            // Fallback: hitung semua mahasiswa di semester jika kelas tidak ditemukan
            $jumlahMahasiswa = \App\Models\KelompokKecil::where('semester', $semesterKelas)->count();
        }

        // Hitung jumlah dosen yang dipilih
        $jumlahDosen = count($data['dosen_ids']);

        // Total yang diperlukan
        $totalYangDiperlukan = $jumlahMahasiswa + $jumlahDosen;

        // Debug: Log untuk troubleshooting
        \Log::info('Praktikum Capacity Check:', [
            'kelas_praktikum' => $data['kelas_praktikum'],
            'semester' => $semester,
            'jumlah_mahasiswa' => $jumlahMahasiswa,
            'jumlah_dosen' => $jumlahDosen,
            'total_yang_diperlukan' => $totalYangDiperlukan,
            'kapasitas_ruangan' => $ruangan->kapasitas,
            'is_over_capacity' => $totalYangDiperlukan > $ruangan->kapasitas
        ]);

        // Cek apakah kapasitas ruangan mencukupi
        if ($totalYangDiperlukan > $ruangan->kapasitas) {
            return "Kapasitas ruangan tidak mencukupi. Ruangan {$ruangan->nama} hanya dapat menampung {$ruangan->kapasitas} orang, sedangkan diperlukan {$totalYangDiperlukan} orang (kelas {$data['kelas_praktikum']}: {$jumlahMahasiswa} mahasiswa + {$jumlahDosen} dosen).";
        }

        return null; // Kapasitas mencukupi
    }

    // Get jadwal Praktikum for mahasiswa
    public function getJadwalForMahasiswa($mahasiswaId, Request $request)
    {
        try {
            $mahasiswa = User::where('id', $mahasiswaId)->where('role', 'mahasiswa')->first();
            if (!$mahasiswa) {
                return response()->json(['message' => 'Mahasiswa tidak ditemukan', 'data' => []], 404);
            }

            // Get jadwal praktikum for mahasiswa's semester
            // Praktikum is linked to mata kuliah, so we filter by semester via mata kuliah
            $jadwal = JadwalPraktikum::with([
                'mataKuliah',
                'dosen' => function ($query) {
                    $query->withPivot('status_konfirmasi', 'status_reschedule', 'alasan_konfirmasi', 'reschedule_reason');
                },
                'ruangan'
            ])
                ->whereHas('mataKuliah', function ($query) use ($mahasiswa) {
                    $query->where('semester', $mahasiswa->semester);
                })
                ->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();

            $mappedJadwal = $jadwal->map(function ($item) {
                // For mahasiswa view, we show only active dosen (not "tidak_bisa")
                // Filter out dosen with "tidak_bisa" status
                $activeDosen = $item->dosen->filter(function ($dosen) {
                    return $dosen->pivot->status_konfirmasi !== 'tidak_bisa';
                });

                // If no active dosen, skip this jadwal entirely
                if ($activeDosen->isEmpty()) {
                    return null;
                }

                // Get status from the first active dosen
                $firstActiveDosen = $activeDosen->first();
                $statusKonfirmasi = 'belum_konfirmasi';
                $statusReschedule = null;

                if ($firstActiveDosen && $firstActiveDosen->pivot) {
                    $statusKonfirmasi = $firstActiveDosen->pivot->status_konfirmasi ?? 'belum_konfirmasi';
                    $statusReschedule = $firstActiveDosen->pivot->status_reschedule ?? null;
                }

                return [
                    'id' => $item->id,
                    'tanggal' => $item->tanggal,
                    'jam_mulai' => substr($item->jam_mulai, 0, 5),
                    'jam_selesai' => substr($item->jam_selesai, 0, 5),
                    'materi' => $item->materi ?? 'N/A',
                    'topik' => $item->topik ?? 'N/A',
                    'kelas_praktikum' => $item->kelas_praktikum ?? 'N/A',
                    'dosen' => $activeDosen->map(fn($d) => ['id' => $d->id, 'name' => $d->name])->toArray(),
                    'ruangan' => $item->ruangan ? ['id' => $item->ruangan->id, 'nama' => $item->ruangan->nama] : null,
                    'jumlah_sesi' => $item->jumlah_sesi ?? 2,
                    'status_konfirmasi' => $statusKonfirmasi,
                    'status_reschedule' => $statusReschedule,
                    'semester_type' => 'reguler',
                ];
            })->filter(); // Remove null entries

            return response()->json(['message' => 'Data jadwal Praktikum berhasil diambil', 'data' => $mappedJadwal]);
        } catch (\Exception $e) {
            Log::error('Error fetching jadwal Praktikum for mahasiswa: ' . $e->getMessage());
            return response()->json(['message' => 'Terjadi kesalahan', 'error' => $e->getMessage(), 'data' => []], 500);
        }
    }

    /**
     * Send notification to mahasiswa in the specific praktikum class
     */
    private function sendNotificationToMahasiswa($jadwal)
    {
        try {
            \Log::info("Praktikum sendNotificationToMahasiswa - Starting for jadwal ID: {$jadwal->id}, kelas_praktikum: {$jadwal->kelas_praktikum}");

            // Get kelas based on kelas_praktikum name
            $kelas = \App\Models\Kelas::where('nama_kelas', $jadwal->kelas_praktikum)
                ->where('semester', $jadwal->mataKuliah->semester)
                ->first();

            if (!$kelas) {
                \Log::warning("Praktikum sendNotificationToMahasiswa - Kelas '{$jadwal->kelas_praktikum}' not found for semester {$jadwal->mataKuliah->semester}");
                return;
            }

            \Log::info("Praktikum sendNotificationToMahasiswa - Kelas found: ID {$kelas->id}, semester {$kelas->semester}");

            // Get kelompok kecil IDs that belong to this kelas
            $kelompokIds = \DB::table('kelas_kelompok')
                ->where('kelas_id', $kelas->id)
                ->pluck('nama_kelompok')
                ->toArray();

            \Log::info("Praktikum sendNotificationToMahasiswa - Kelompok IDs: " . json_encode($kelompokIds));

            if (empty($kelompokIds)) {
                \Log::warning("Praktikum sendNotificationToMahasiswa - No kelompok found for kelas ID {$kelas->id}");
                return;
            }

            // Get mahasiswa in the specific kelompok kecil
            $mahasiswaIds = \App\Models\KelompokKecil::whereIn('nama_kelompok', $kelompokIds)
                ->where('semester', $jadwal->mataKuliah->semester)
                ->pluck('mahasiswa_id')
                ->toArray();

            $mahasiswaList = \App\Models\User::where('role', 'mahasiswa')
                ->whereIn('id', $mahasiswaIds)
                ->get();

            \Log::info("Praktikum sendNotificationToMahasiswa - Found " . count($mahasiswaList) . " mahasiswa in kelas '{$jadwal->kelas_praktikum}'");

            // Send notification to each mahasiswa
            foreach ($mahasiswaList as $mahasiswa) {
                \App\Models\Notification::create([
                    'user_id' => $mahasiswa->id,
                    'title' => 'Jadwal Praktikum Baru',
                    'message' => "Jadwal Praktikum baru telah ditambahkan: {$jadwal->mataKuliah->nama} - {$jadwal->materi} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama} untuk kelas {$jadwal->kelas_praktikum}.",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'praktikum',
                        'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                        'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                        'materi' => $jadwal->materi,
                        'topik' => $jadwal->topik,
                        'kelas_praktikum' => $jadwal->kelas_praktikum,
                        'tanggal' => $jadwal->tanggal,
                        'jam_mulai' => $jadwal->jam_mulai,
                        'jam_selesai' => $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'dosen' => $jadwal->dosen->map(fn($d) => $d->name)->join(', '),
                        'created_by' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->name ?? 'Admin' : 'Admin',
                        'created_by_role' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->role ?? 'admin' : 'admin',
                        'sender_name' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->name ?? 'Admin' : 'Admin',
                        'sender_role' => $jadwal->created_by ? \App\Models\User::find($jadwal->created_by)->role ?? 'admin' : 'admin'
                    ]
                ]);
            }

            \Log::info("Praktikum notifications sent to " . count($mahasiswaList) . " mahasiswa for jadwal ID: {$jadwal->id} in kelas '{$jadwal->kelas_praktikum}'");
        } catch (\Exception $e) {
            \Log::error("Error sending Praktikum notifications to mahasiswa: " . $e->getMessage());
        }
    }

    /**
     * Cek bentrok dengan kelompok besar
     */
    private function checkKelompokBesarBentrok($data, $ignoreId = null): bool
    {
        // Praktikum tidak menggunakan kelompok besar, jadi tidak ada bentrok
        return false;
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
     * Dapatkan informasi debug untuk validasi
     */
    private function getDebugInfo($data)
    {
        $ruangan = Ruangan::find($data['ruangan_id']);
        $semester = $this->getMataKuliahSemester($data['mata_kuliah_kode']);

        // Hitung jumlah mahasiswa berdasarkan kelas praktikum
        $jumlahMahasiswa = \App\Models\KelompokKecil::where('nama_kelompok', $data['kelas_praktikum'])
            ->where('semester', $semester)
            ->count();

        // Hitung jumlah dosen yang dipilih
        $jumlahDosen = count($data['dosen_ids']);

        // Total yang diperlukan
        $totalYangDiperlukan = $jumlahMahasiswa + $jumlahDosen;

        return [
            'kelas_praktikum' => $data['kelas_praktikum'],
            'mata_kuliah_kode' => $data['mata_kuliah_kode'],
            'semester' => $semester,
            'ruangan_nama' => $ruangan ? $ruangan->nama : 'Tidak ditemukan',
            'kapasitas_ruangan' => $ruangan ? $ruangan->kapasitas : 0,
            'jumlah_mahasiswa' => $jumlahMahasiswa,
            'jumlah_dosen' => $jumlahDosen,
            'total_yang_diperlukan' => $totalYangDiperlukan,
            'is_over_capacity' => $totalYangDiperlukan > ($ruangan ? $ruangan->kapasitas : 0)
        ];
    }

    /**
     * Kirim notifikasi assignment ke dosen
     */
    private function sendAssignmentNotification($jadwal, $dosenId)
    {
        try {
            $dosen = \App\Models\User::find($dosenId);
            if (!$dosen) {
                \Log::warning("Dosen dengan ID {$dosenId} tidak ditemukan untuk notifikasi jadwal praktikum");
                return;
            }

            $mataKuliah = $jadwal->mataKuliah;
            $ruangan = $jadwal->ruangan;

            \App\Models\Notification::create([
                'user_id' => $dosenId,
                'title' => 'Jadwal Praktikum Baru',
                'message' => "Anda telah di-assign untuk mengajar Praktikum {$mataKuliah->nama} pada tanggal " .
                    date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                    str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                    " di ruangan {$ruangan->nama} untuk kelas {$jadwal->kelas_praktikum}. Silakan konfirmasi ketersediaan Anda.",
                'type' => 'info',
                'is_read' => false,
                'data' => [
                    'jadwal_id' => $jadwal->id,
                    'jadwal_type' => 'praktikum',
                    'mata_kuliah_kode' => $mataKuliah->kode,
                    'mata_kuliah_nama' => $mataKuliah->nama,
                    'tanggal' => $jadwal->tanggal,
                    'jam_mulai' => $jadwal->jam_mulai,
                    'jam_selesai' => $jadwal->jam_selesai,
                    'ruangan' => $ruangan->nama,
                    'kelas_praktikum' => $jadwal->kelas_praktikum,
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


            \Log::info("Notifikasi jadwal praktikum berhasil dikirim ke dosen {$dosen->name} (ID: {$dosenId})");
        } catch (\Exception $e) {
            \Log::error("Gagal mengirim notifikasi jadwal praktikum ke dosen {$dosenId}: " . $e->getMessage());
        }
    }

    /**
     * Get jadwal praktikum untuk dosen tertentu
     */
    public function getJadwalForDosen($dosenId, Request $request)
    {
        try {
            $semesterType = $request->query('semester_type');

            $query = JadwalPraktikum::with(['mataKuliah', 'ruangan', 'dosen' => function ($query) use ($dosenId) {
                $query->where('dosen_id', $dosenId)->withPivot('status_konfirmasi', 'alasan_konfirmasi', 'status_reschedule', 'reschedule_reason');
            }])
                ->whereHas('dosen', function ($query) use ($dosenId) {
                    $query->where('dosen_id', $dosenId);
                });

            // Filter berdasarkan semester type jika ada
            if ($semesterType && $semesterType !== 'all') {
                if ($semesterType === 'reguler') {
                    $query->whereHas('mataKuliah', function ($q) {
                        $q->where('semester', '!=', 'Antara');
                    });
                } elseif ($semesterType === 'antara') {
                    // Semester antara tidak memiliki praktikum, return empty result
                    return response()->json([
                        'data' => [],
                        'message' => 'Semester antara tidak memiliki praktikum'
                    ]);
                }
            }

            $jadwal = $query->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();

            // Map data untuk menambahkan status_konfirmasi dari pivot table
            $mappedJadwal = $jadwal->map(function ($item) use ($dosenId) {
                // Ambil status_konfirmasi dari pivot table
                $pivotData = $item->dosen->where('id', $dosenId)->first();
                $statusKonfirmasi = $pivotData && $pivotData->pivot ? $pivotData->pivot->status_konfirmasi ?? 'belum_konfirmasi' : 'belum_konfirmasi';

                return (object) [
                    'id' => $item->id,
                    'tanggal' => $item->tanggal,
                    'jam_mulai' => $item->jam_mulai,
                    'jam_selesai' => $item->jam_selesai,
                    'materi' => $item->materi,
                    'topik' => $item->topik,
                    'status_konfirmasi' => $statusKonfirmasi,
                    'alasan_konfirmasi' => $pivotData && $pivotData->pivot ? $pivotData->pivot->alasan_konfirmasi ?? null : null,
                    'status_reschedule' => $pivotData && $pivotData->pivot ? $pivotData->pivot->status_reschedule ?? null : null,
                    'reschedule_reason' => $pivotData && $pivotData->pivot ? $pivotData->pivot->reschedule_reason ?? null : null,
                    'mata_kuliah_kode' => $item->mata_kuliah_kode,
                    'mata_kuliah' => (object) [
                        'kode' => $item->mataKuliah->kode ?? '',
                        'nama' => $item->mataKuliah->nama ?? 'N/A',
                        'semester' => $item->mataKuliah->semester ?? ''
                    ],
                    'kelas_praktikum' => $item->kelas_praktikum,
                    'dosen' => $item->dosen->map(function ($d) {
                        return (object) [
                            'id' => $d->id,
                            'name' => $d->name
                        ];
                    }),
                    'ruangan' => (object) [
                        'id' => $item->ruangan->id ?? null,
                        'nama' => $item->ruangan->nama ?? 'N/A'
                    ],
                    'jumlah_sesi' => $item->jumlah_sesi,
                    'semester_type' => $item->mataKuliah && $item->mataKuliah->semester === 'Antara' ? 'antara' : 'reguler',
                    'created_at' => $item->created_at
                ];
            });

            return response()->json([
                'data' => $mappedJadwal,
                'message' => 'Jadwal praktikum berhasil diambil'
            ]);
        } catch (\Exception $e) {
            \Log::error("Error getting jadwal praktikum for dosen {$dosenId}: " . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil jadwal praktikum',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Konfirmasi ketersediaan dosen untuk jadwal praktikum
     */
    public function konfirmasi(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:bisa,tidak_bisa',
            'dosen_id' => 'required|exists:users,id',
            'alasan' => 'nullable|string|max:1000'
        ]);

        $jadwal = JadwalPraktikum::findOrFail($id);

        // Update pivot table untuk konfirmasi dosen
        $jadwal->dosen()->updateExistingPivot($request->dosen_id, [
            'status_konfirmasi' => $request->status,
            'alasan_konfirmasi' => $request->alasan,
            'updated_at' => now()
        ]);

        // Kirim notifikasi ke super admin jika dosen tidak bisa
        if ($request->status === 'tidak_bisa') {
            $this->sendReplacementNotification($jadwal, $request->dosen_id, $request->alasan);
        }

        return response()->json([
            'message' => 'Konfirmasi berhasil disimpan',
            'status' => $request->status
        ]);
    }

    /**
     * Import Excel jadwal praktikum
     */
    public function importExcel(Request $request, $kode)
    {
        try {
            $data = $request->validate([
                'data' => 'required|array',
                'data.*.tanggal' => 'required|date',
                'data.*.jam_mulai' => 'required|string',
                'data.*.jam_selesai' => 'required|string',
                'data.*.sesi' => 'required|integer|min:1|max:6',
                'data.*.materi' => 'required|string',
                'data.*.topik' => 'required|string',
                'data.*.kelas_praktikum' => 'required|string',
                'data.*.dosen_id' => 'required|exists:users,id',
                'data.*.ruangan_id' => 'required|exists:ruangan,id',
                'data.*.jumlah_sesi' => 'nullable|integer|min:1|max:6',
            ]);

            $importedData = [];
            $errors = [];

            // Validasi semua data terlebih dahulu (all or nothing approach)
            foreach ($data['data'] as $index => $row) {
                // Set jumlah_sesi dari kolom sesi Excel
                $row['jumlah_sesi'] = $row['sesi'] ?? 2; // Gunakan sesi dari Excel, default 2

                // Set mata_kuliah_kode
                $row['mata_kuliah_kode'] = $kode;

                // Materi sudah ada di $row['materi'] dari input Excel

                // Validasi tanggal dalam range mata kuliah
                $mataKuliah = \App\Models\MataKuliah::where('kode', $kode)->first();
                if ($mataKuliah && $mataKuliah->tanggal_mulai && $mataKuliah->tanggal_akhir) {
                    $jadwalTanggal = new \DateTime($row['tanggal']);
                    $tanggalMulai = new \DateTime($mataKuliah->tanggal_mulai);
                    $tanggalAkhir = new \DateTime($mataKuliah->tanggal_akhir);
                    if ($jadwalTanggal < $tanggalMulai || $jadwalTanggal > $tanggalAkhir) {
                        $errors[] = "Baris " . ($index + 1) . ": Tanggal harus dalam rentang {$mataKuliah->tanggal_mulai} - {$mataKuliah->tanggal_akhir}";
                    }
                }

                // Konversi dosen_id ke dosen_ids untuk validasi kapasitas ruangan
                $rowForValidation = $row;
                $rowForValidation['dosen_ids'] = [$row['dosen_id']];

                // Validasi kapasitas ruangan
                $kapasitasMessage = $this->validateRuanganCapacity($rowForValidation);
                if ($kapasitasMessage) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $kapasitasMessage;
                }

                // Validasi bentrok
                $bentrokMessage = $this->checkBentrokWithDetail($row, null);
                if ($bentrokMessage) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $bentrokMessage;
                }
            }

            // Jika ada error validasi, return error tanpa import apapun
            if (count($errors) > 0) {
                return response()->json([
                    'success' => 0,
                    'total' => count($data['data']),
                    'errors' => $errors,
                    'message' => "Gagal mengimport data. Perbaiki error terlebih dahulu."
                ], 422);
            }

            // Jika tidak ada error, import semua data
            foreach ($data['data'] as $index => $row) {
                try {
                    // Set jumlah_sesi dari kolom sesi Excel
                    $row['jumlah_sesi'] = $row['sesi'] ?? 2; // Gunakan sesi dari Excel, default 2

                    // Set mata_kuliah_kode
                    $row['mata_kuliah_kode'] = $kode;

                    // Buat jadwal praktikum
                    $jadwal = JadwalPraktikum::create($row);

                    // Attach dosen (praktikum menggunakan single dosen, bukan multiple)
                    $jadwal->dosen()->attach($row['dosen_id']);

                    // Kirim notifikasi ke dosen
                    $this->sendAssignmentNotification($jadwal, $row['dosen_id']);

                    $importedData[] = $jadwal;

                    // Log activity
                    activity()
                        ->performedOn($jadwal)
                        ->withProperties([
                            'mata_kuliah_kode' => $kode,
                            'tanggal' => $row['tanggal'],
                            'jam_mulai' => $row['jam_mulai'],
                            'jam_selesai' => $row['jam_selesai'],
                            'materi' => $row['materi'],
                            'topik' => $row['topik'],
                            'kelas_praktikum' => $row['kelas_praktikum']
                        ])
                        ->log("Jadwal Praktikum imported: {$row['materi']} - {$row['topik']}");
                } catch (\Exception $e) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $e->getMessage();
                }
            }

            if (count($errors) > 0) {
                return response()->json([
                    'success' => count($importedData),
                    'total' => count($data['data']),
                    'errors' => $errors,
                    'message' => 'Gagal mengimport ' . (count($data['data']) - count($importedData)) . ' dari ' . count($data['data']) . ' jadwal'
                ], 422);
            }

            return response()->json([
                'success' => count($importedData),
                'total' => count($data['data']),
                'message' => 'Berhasil mengimport ' . count($importedData) . ' jadwal praktikum'
            ]);
        } catch (\Exception $e) {
            \Log::error('Error importing praktikum data: ' . $e->getMessage());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengimport data: ' . $e->getMessage()
            ], 500);
        }
    }

    // Ajukan reschedule jadwal Praktikum
    public function reschedule(Request $request, $id)
    {
        $request->validate([
            'reschedule_reason' => 'required|string|max:1000',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $jadwal = JadwalPraktikum::findOrFail($id);

        // Update pivot table untuk reschedule
        $jadwal->dosen()->updateExistingPivot($request->dosen_id, [
            'status_konfirmasi' => 'waiting_reschedule',
            'reschedule_reason' => $request->reschedule_reason,
            'status_reschedule' => 'waiting',
            'updated_at' => now()
        ]);

        // Kirim notifikasi ke admin
        $this->sendRescheduleNotification($jadwal, $request->dosen_id, $request->reschedule_reason);

        return response()->json([
            'message' => 'Permintaan reschedule berhasil diajukan',
            'status' => 'waiting_reschedule'
        ]);
    }

    /**
     * Kirim notifikasi reschedule ke admin
     */
    private function sendRescheduleNotification($jadwal, $dosenId, $reason)
    {
        try {
            $dosen = \App\Models\User::find($dosenId);

            // Buat hanya 1 notifikasi yang bisa dilihat oleh semua admin
            $firstAdmin = \App\Models\User::where('role', 'super_admin')->first() ?? \App\Models\User::where('role', 'tim_akademik')->first();

            if ($firstAdmin) {
                \App\Models\Notification::create([
                    'user_id' => $firstAdmin->id,
                    'title' => 'Permintaan Reschedule Jadwal',
                    'message' => "Dosen {$dosen->name} mengajukan reschedule untuk jadwal Praktikum. Alasan: {$reason}",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'praktikum',
                        'dosen_name' => $dosen->name,
                        'dosen_id' => $dosen->id,
                        'reschedule_reason' => $reason,
                        'notification_type' => 'reschedule_request'
                    ]
                ]);
            }

            \Log::info("Reschedule notification sent for Praktikum jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Error sending reschedule notification for Praktikum jadwal ID: {$jadwal->id}: " . $e->getMessage());
        }
    }

    /**
     * Kirim notifikasi replacement ke super admin
     */
    private function sendReplacementNotification($jadwal, $dosenId, $alasan = null)
    {
        try {
            $dosen = \App\Models\User::find($dosenId);
            $superAdmins = \App\Models\User::where('role', 'super_admin')->get();
            $alasanText = $alasan ? "\n\nAlasan: {$alasan}" : "";

            foreach ($superAdmins as $admin) {
                \App\Models\Notification::create([
                    'user_id' => $admin->id,
                    'title' => 'Dosen Tidak Bisa Mengajar - Praktikum',
                    'message' => "Dosen {$dosen->name} tidak bisa mengajar pada jadwal Praktikum {$jadwal->mataKuliah->nama} pada tanggal " .
                        date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                        str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                        " untuk kelas {$jadwal->kelas_praktikum} di ruangan {$jadwal->ruangan->nama}.{$alasanText}",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'praktikum',
                        'dosen_id' => $dosenId,
                        'mata_kuliah' => $jadwal->mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal,
                        'waktu' => $jadwal->jam_mulai . ' - ' . $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'kelas_praktikum' => $jadwal->kelas_praktikum,
                        'alasan' => $alasan
                    ]
                ]);
            }

            \Log::info("Notifikasi replacement berhasil dikirim ke super admin untuk jadwal praktikum ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Gagal mengirim notifikasi replacement untuk jadwal praktikum ID {$jadwal->id}: " . $e->getMessage());
        }
    }
}
