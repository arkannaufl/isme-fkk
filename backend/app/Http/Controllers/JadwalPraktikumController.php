<?php

namespace App\Http\Controllers;

use App\Models\JadwalPraktikum;
use App\Models\MataKuliah;
use App\Models\Ruangan;
use App\Models\User;
use App\Models\DosenPeran;

use App\Models\AbsensiPraktikum;

use App\Traits\SendsWhatsAppNotification;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class JadwalPraktikumController extends Controller
{
    use SendsWhatsAppNotification;
    // List semua jadwal praktikum untuk satu mata kuliah blok
    public function index($kode)
    {
        $jadwal = JadwalPraktikum::WithoutSemesterFilter()->with(['mataKuliah', 'ruangan', 'kelompokKecil', 'dosen' => function ($query) {
            $query->select('users.id', 'users.name', 'users.nid', 'users.nidn', 'users.nuptk', 'users.signature_image')
                ->withPivot('status_konfirmasi', 'alasan_konfirmasi');
        }])
            ->where('mata_kuliah_kode', $kode)
            ->orderBy('tanggal')
            ->orderBy('jam_mulai')
            ->get();

        // Map dosen untuk include status_konfirmasi dan alasan_konfirmasi
        $mappedJadwal = $jadwal->map(function ($item) {
            $dosenMapped = $item->dosen->map(function ($d) {
                return [
                    'id' => $d->id,
                    'name' => $d->name,
                    'nid' => $d->nid,
                    'nidn' => $d->nidn,
                    'nuptk' => $d->nuptk,
                    'signature_image' => $d->signature_image,
                    'status_konfirmasi' => $d->pivot->status_konfirmasi ?? null,
                    'alasan_konfirmasi' => $d->pivot->alasan_konfirmasi ?? null,
                ];
            });

            $itemArray = $item->toArray();
            $itemArray['dosen'] = $dosenMapped;
            return $itemArray;
        });

        return response()->json($mappedJadwal);
    }

    // Tambah jadwal praktikum baru
    public function store(Request $request, $kode)
    {
        $data = $request->validate([
            'materi' => 'required|string',
            'topik' => 'nullable|string',
            'kelompok_kecil_ids' => 'required|array|min:1',
            'kelompok_kecil_ids.*' => 'exists:kelompok_kecil,id',
            'ruangan_id' => 'required|exists:ruangan,id',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
            'dosen_ids' => 'required|array|min:1',
            'dosen_ids.*' => 'exists:users,id',
            // SIAKAD fields
            'siakad_kurikulum' => 'nullable|string',
            'siakad_kode_mk' => 'nullable|string',
            'siakad_kelompok' => 'nullable|string',
            'siakad_jenis_pertemuan' => 'nullable|string',
            'siakad_metode' => 'nullable|string',
            'siakad_dosen_pengganti' => 'nullable|string',
        ]);
        $data['mata_kuliah_kode'] = $kode;
        $data['created_by'] = $request->input('created_by', Auth::id());

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

        // Create tanpa kelompok_kecil_id (karena sekarang pivot)
        $jadwal = JadwalPraktikum::create(\Illuminate\Support\Arr::except($data, ['kelompok_kecil_ids']));

        // Sync kelompok kecil
        $jadwal->kelompokKecil()->sync($data['kelompok_kecil_ids']);
        
        // Sync dosen (replace semua dosen yang ada)
        $jadwal->dosen()->sync($data['dosen_ids']);

        // Log activity
        activity()
            ->performedOn($jadwal)
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'tanggal' => $data['tanggal'],
                'jam_mulai' => $data['jam_mulai'],
                'jam_selesai' => $data['jam_selesai'],
                'materi' => $data['materi'],
                'topik' => $data['topik'],
                'kelompok_kecil_ids' => $data['kelompok_kecil_ids']
            ])
            ->log('Jadwal Praktikum created');

        // Kirim notifikasi ke semua dosen yang di-assign
        foreach ($data['dosen_ids'] as $dosenId) {
            $this->sendAssignmentNotification($jadwal, $dosenId);
        }

        // Load relasi untuk response
        $jadwal->load(['mataKuliah', 'ruangan', 'kelompokKecil', 'dosen']);

        // Send notification to mahasiswa
        $this->sendNotificationToMahasiswa($jadwal);

        // Kirim notifikasi ke semua tim akademik
        $this->sendNotificationToTimAkademik($jadwal);

        // Kirim notifikasi ke koordinator blok jika ada
        $this->sendNotificationToKoordinatorBlok($jadwal);

        return response()->json($jadwal, Response::HTTP_CREATED);
    }

    // Update jadwal praktikum
    public function update(Request $request, $kode, $id)
    {
        $jadwal = JadwalPraktikum::findOrFail($id);
        $data = $request->validate([
            'materi' => 'required|string',
            'topik' => 'nullable|string',
            'kelompok_kecil_ids' => 'required|array|min:1',
            'kelompok_kecil_ids.*' => 'exists:kelompok_kecil,id',
            'ruangan_id' => 'required|exists:ruangan,id',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
            'dosen_ids' => 'required|array|min:1',
            'dosen_ids.*' => 'exists:users,id',
            // SIAKAD fields
            'siakad_kurikulum' => 'nullable|string',
            'siakad_kode_mk' => 'nullable|string',
            'siakad_kelompok' => 'nullable|string',
            'siakad_jenis_pertemuan' => 'nullable|string',
            'siakad_metode' => 'nullable|string',
            'siakad_dosen_pengganti' => 'nullable|string',
        ]);
        $data['mata_kuliah_kode'] = $kode;
        $data['created_by'] = $request->input('created_by', Auth::id());

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

        $jadwal->update(\Illuminate\Support\Arr::except($data, ['kelompok_kecil_ids']));

        // Sync kelompok kecil
        $jadwal->kelompokKecil()->sync($data['kelompok_kecil_ids']);

        // Sync dosen (replace semua dosen yang ada)
        $jadwal->dosen()->sync($data['dosen_ids']);

        // Log activity
        activity()
            ->performedOn($jadwal)
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'tanggal' => $data['tanggal'],
                'jam_mulai' => $data['jam_mulai'],
                'jam_selesai' => $data['jam_selesai'],
                'materi' => $data['materi'],
                'topik' => $data['topik'],
                'kelompok_kecil_ids' => $data['kelompok_kecil_ids']
            ])
            ->log('Jadwal Praktikum updated');

        // Load relasi untuk response
        $jadwal->load(['mataKuliah', 'ruangan', 'kelompokKecil', 'dosen']);

        return response()->json($jadwal);
    }

    // Hapus jadwal praktikum
    public function destroy($kode, $id)
    {
        $jadwal = JadwalPraktikum::findOrFail($id);
        $jadwal->delete();

        // Log activity
        activity()
            ->performedOn($jadwal)
            ->log('Jadwal Praktikum deleted');
        return response()->json(['message' => 'Jadwal praktikum berhasil dihapus']);
    }

    // Get kelompok kecil berdasarkan semester (untuk dropdown di frontend)
    public function getKelompokKecil($semester)
    {
        try {
            // Ambil kelompok kecil dari semester yang sesuai
            $kelompokKecil = \App\Models\KelompokKecil::where('semester', $semester)
                ->distinct()
                ->select('id', 'nama_kelompok', 'semester')
                ->get()
                ->unique('nama_kelompok')
                ->values();
            return response()->json($kelompokKecil);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data kelompok kecil'], 500);
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
                $keahlianDosen = array_map('trim', $arr);
                // Case insensitive comparison
                return in_array(strtolower($keahlian), array_map('strtolower', $keahlianDosen));
            })->values();

            return response()->json($filtered);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengambil data pengampu'], 500);
        }
    }

    // Cek bentrok antar jenis baris
    private function isBentrok($data, $ignoreId = null)
    {
        // Ambil data mata kuliah untuk mendapatkan semester
        $mataKuliah = \App\Models\MataKuliah::where('kode', $data['mata_kuliah_kode'])->first();
        $semester = $mataKuliah ? $mataKuliah->semester : null;

        // Cek bentrok dengan jadwal Praktikum (dengan filter semester)
        $praktikumBentrok = JadwalPraktikum::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data) {
                $q->where('kelompok_kecil_id', $data['kelompok_kecil_id'])
                    ->orWhere('ruangan_id', $data['ruangan_id']);
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                    ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        if ($ignoreId) {
            $praktikumBentrok->where('id', '!=', $ignoreId);
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

        // Cek bentrok dengan kelompok besar (jika ada kelompok_besar_id di jadwal lain)
        $kelompokBesarBentrok = $this->checkKelompokBesarBentrok($data, $ignoreId);

        return $praktikumBentrok->exists() || $pblBentrok->exists() ||
            $kuliahBesarBentrok->exists() || $agendaKhususBentrok->exists() ||
            $jurnalBentrok->exists() || $kelompokBesarBentrok;
    }

    private function checkBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Ambil data mata kuliah untuk mendapatkan semester
        $mataKuliah = \App\Models\MataKuliah::where('kode', $data['mata_kuliah_kode'])->first();
        $semester = $mataKuliah ? $mataKuliah->semester : null;

        // Cek bentrok dengan jadwal Praktikum (dengan filter semester)
        $praktikumBentrok = JadwalPraktikum::where('tanggal', $data['tanggal'])
            ->whereHas('mataKuliah', function ($q) use ($semester) {
                if ($semester) {
                    $q->where('semester', $semester);
                }
            })
            ->where(function ($q) use ($data) {
                // Cek overlap kelompok kecil (menggunakan whereHas karena sekarang many-to-many)
                $q->whereHas('kelompokKecil', function ($subQ) use ($data) {
                    $subQ->whereIn('kelompok_kecil.id', $data['kelompok_kecil_ids']);
                })
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

        // Cek bentrok kelompok kecil
        if (isset($data['kelompok_kecil_ids'])) {
            $commonGroups = $jadwalBentrok->kelompokKecil()->whereIn('kelompok_kecil.id', $data['kelompok_kecil_ids'])->get();
            if ($commonGroups->isNotEmpty()) {
                $groupNames = $commonGroups->pluck('nama_kelompok')->join(', ');
                $reasons[] = "Kelompok: " . $groupNames;
            }
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

        // Untuk praktikum, hitung mahasiswa berdasarkan kelompok kecil
        $kelompokKecilList = \App\Models\KelompokKecil::whereIn('id', $data['kelompok_kecil_ids'])->get();

        if ($kelompokKecilList->isEmpty()) {
            return 'Kelompok kecil tidak ditemukan';
        }

        $jumlahMahasiswa = 0;
        $namaKelompokList = [];

        foreach ($kelompokKecilList as $kelompokKecil) {
            $count = \App\Models\KelompokKecil::where('nama_kelompok', $kelompokKecil->nama_kelompok)
                ->where('semester', $kelompokKecil->semester)
                ->count();
            $jumlahMahasiswa += $count;
            $namaKelompokList[] = $kelompokKecil->nama_kelompok;
        }
        
        $namaKelompokStr = implode(', ', $namaKelompokList);

        // Hitung jumlah dosen yang dipilih
        $jumlahDosen = count($data['dosen_ids']);

        // Total yang diperlukan
        $totalYangDiperlukan = $jumlahMahasiswa + $jumlahDosen;

        // Debug: Log untuk troubleshooting
        Log::info('Praktikum Capacity Check:', [
            'kelompok_kecil_ids' => $data['kelompok_kecil_ids'],
            'nama_kelompok' => $namaKelompokStr,
            'jumlah_mahasiswa' => $jumlahMahasiswa,
            'jumlah_dosen' => $jumlahDosen,
            'total_yang_diperlukan' => $totalYangDiperlukan,
            'kapasitas_ruangan' => $ruangan->kapasitas,
            'is_over_capacity' => $totalYangDiperlukan > $ruangan->kapasitas
        ]);

        // Cek apakah kapasitas ruangan mencukupi
        if ($totalYangDiperlukan > $ruangan->kapasitas) {
            return "Kapasitas ruangan tidak mencukupi. Ruangan {$ruangan->nama} hanya dapat menampung {$ruangan->kapasitas} orang, sedangkan diperlukan {$totalYangDiperlukan} orang (kelompok {$namaKelompokStr}: {$jumlahMahasiswa} mahasiswa + {$jumlahDosen} dosen).";
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
                    $query->withPivot('status_konfirmasi', 'alasan_konfirmasi');
                },
                'ruangan',
                'kelompokKecil'
            ])
                ->whereHas('mataKuliah', function ($query) use ($mahasiswa) {
                    $query->where('semester', $mahasiswa->semester);
                })
                ->whereHas('kelompokKecil', function($q) use ($mahasiswa) {
                    // Check if the schedule's groups contain a group that the student belongs to
                    $q->whereIn('nama_kelompok', function($sub) use ($mahasiswa) {
                        $sub->select('nama_kelompok')
                            ->from('kelompok_kecil')
                            ->where('mahasiswa_id', $mahasiswa->id)
                            ->where('semester', $mahasiswa->semester);
                    });
                })
                ->orderBy('tanggal', 'asc')
                ->orderBy('jam_mulai', 'asc')
                ->get();

            $mappedJadwal = $jadwal->map(function ($item) {
                // Return all assigned dosen with their individual status
                $dosenData = $item->dosen->map(function ($d) {
                    return [
                        'id' => $d->id,
                        'name' => $d->name,
                        'status_konfirmasi' => $d->pivot->status_konfirmasi ?? 'belum_konfirmasi',
                        'alasan_konfirmasi' => $d->pivot->alasan_konfirmasi ?? null,
                    ];
                })->toArray();

                // If no dosen assigned at all, we might still want to show the schedule
                // but usually there's at least one.

                // Get status for the row badge (use the first one or logic to determine overall status)
                $overallStatus = 'belum_konfirmasi';
                if ($item->dosen->isNotEmpty()) {
                    $firstDosen = $item->dosen->first();
                    $overallStatus = $firstDosen->pivot->status_konfirmasi ?? 'belum_konfirmasi';
                }

                $groupNames = $item->kelompokKecil->pluck('nama_kelompok')->join(', ');

                return [
                    'id' => $item->id,
                    'tanggal' => date('d-m-Y', strtotime($item->tanggal)),
                    'jam_mulai' => str_replace(':', '.', substr($item->jam_mulai, 0, 5)),
                    'jam_selesai' => str_replace(':', '.', substr($item->jam_selesai, 0, 5)),
                    'materi' => $item->materi ?? 'N/A',
                    'topik' => $item->topik ?? 'N/A',
                    'kelompok_kecil' => $groupNames ?: 'N/A',
                    'dosen' => $dosenData,
                    'ruangan' => $item->ruangan ? ['id' => $item->ruangan->id, 'nama' => $item->ruangan->nama] : null,
                    'jumlah_sesi' => $item->jumlah_sesi ?? 2,
                    'status_konfirmasi' => $overallStatus,
                    'semester_type' => 'reguler',
                ];
            });

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
            $kelompokKecilList = $jadwal->kelompokKecil;

            if ($kelompokKecilList->isEmpty()) {
                Log::warning("Praktikum sendNotificationToMahasiswa - Kelompok kecil tidak ditemukan untuk jadwal ID: {$jadwal->id}");
                return;
            }

            $groupNames = $kelompokKecilList->pluck('nama_kelompok')->join(', ');

            Log::info("Praktikum sendNotificationToMahasiswa - Starting for jadwal ID: {$jadwal->id}, kelompok: {$groupNames}");

            // Get all mahasiswa IDs in these groups
            $mahasiswaIds = [];
            foreach ($kelompokKecilList as $kk) {
                 $ids = \App\Models\KelompokKecil::where('nama_kelompok', $kk->nama_kelompok)
                    ->where('semester', $kk->semester)
                    ->pluck('mahasiswa_id')
                    ->toArray();
                 $mahasiswaIds = array_merge($mahasiswaIds, $ids);
            }
            $mahasiswaIds = array_unique($mahasiswaIds);

            $mahasiswaList = \App\Models\User::where('role', 'mahasiswa')
                ->whereIn('id', $mahasiswaIds)
                ->get();

            Log::info("Praktikum sendNotificationToMahasiswa - Found " . count($mahasiswaList) . " mahasiswa in kelompok '{$groupNames}'");

            // Send notification to each mahasiswa
            foreach ($mahasiswaList as $mahasiswa) {
                \App\Models\Notification::create([
                    'user_id' => $mahasiswa->id,
                    'title' => 'Jadwal Praktikum Baru',
                    'message' => "Jadwal Praktikum baru telah ditambahkan: {$jadwal->mataKuliah->nama} - {$jadwal->materi} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama} untuk kelompok {$groupNames}.",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'praktikum',
                        'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                        'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                        'materi' => $jadwal->materi,
                        'topik' => $jadwal->topik,
                        'kelompok_kecil' => [
                            'names' => $groupNames,
                            'count' => $kelompokKecilList->count()
                        ],
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

            Log::info("Praktikum notifications sent to " . count($mahasiswaList) . " mahasiswa for jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            Log::error("Error sending Praktikum notifications to mahasiswa: " . $e->getMessage());
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
    /**
     * Dapatkan informasi debug untuk validasi
     */
    private function getDebugInfo($data)
    {
        $ruangan = Ruangan::find($data['ruangan_id']);
        $semester = $this->getMataKuliahSemester($data['mata_kuliah_kode']);

        // Hitung jumlah mahasiswa berdasarkan kelompok kecil
        $kelompokKecilList = \App\Models\KelompokKecil::whereIn('id', $data['kelompok_kecil_ids'])->get();
        $jumlahMahasiswa = 0;
        $namaKelompokList = [];

        foreach ($kelompokKecilList as $kelompokKecil) {
            $count = \App\Models\KelompokKecil::where('nama_kelompok', $kelompokKecil->nama_kelompok)
                ->where('semester', $kelompokKecil->semester)
            ->count();
            $jumlahMahasiswa += $count;
            $namaKelompokList[] = $kelompokKecil->nama_kelompok;
        }

        // Hitung jumlah dosen yang dipilih
        $jumlahDosen = count($data['dosen_ids']);

        // Total yang diperlukan
        $totalYangDiperlukan = $jumlahMahasiswa + $jumlahDosen;

        return [
            'kelompok_kecil_ids' => $data['kelompok_kecil_ids'],
            'nama_kelompok' => implode(', ', $namaKelompokList),
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
                Log::warning("Dosen dengan ID {$dosenId} tidak ditemukan untuk notifikasi jadwal praktikum");
                return;
            }

            $mataKuliah = $jadwal->mataKuliah;
            $ruangan = $jadwal->ruangan;
            $groupNames = $jadwal->kelompokKecil->pluck('nama_kelompok')->join(', ');

            \App\Models\Notification::create([
                'user_id' => $dosenId,
                'title' => 'Jadwal Praktikum Baru',
                'message' => "Anda telah di-assign untuk mengajar Praktikum {$mataKuliah->nama} pada tanggal " .
                    date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                    str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                    " di ruangan {$ruangan->nama} untuk kelompok " . ($groupNames ?: 'Tidak diketahui') . ". Silakan konfirmasi ketersediaan Anda.",
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
                    'kelompok_kecil' => [
                        'names' => $groupNames
                    ],
                    'materi' => $jadwal->materi,
                    'topik' => $jadwal->topik,
                    'dosen_id' => $dosen->id,
                    'dosen_name' => $dosen->name,
                    'dosen_role' => $dosen->role,
                    'created_by' => Auth::user()->name ?? 'Admin',
                    'created_by_role' => Auth::user()->role ?? 'admin',
                    'sender_name' => Auth::user()->name ?? 'Admin',
                    'sender_role' => Auth::user()->role ?? 'admin'
                ]
            ]);



            Log::info("Notifikasi jadwal praktikum berhasil dikirim ke dosen {$dosen->name} (ID: {$dosenId})");

            // Kirim WhatsApp notification
            $whatsappMessage = $this->formatScheduleMessage('praktikum', [
                'mata_kuliah_nama' => $mataKuliah->nama,
                'tanggal' => $jadwal->tanggal,
                'jam_mulai' => $jadwal->jam_mulai,
                'jam_selesai' => $jadwal->jam_selesai,
                'ruangan' => $ruangan->nama,
                'kelompok_kecil' => $groupNames,
                'topik' => $jadwal->topik,
                'materi' => $jadwal->materi,
            ]);

            $this->sendWhatsAppNotification($dosen, $whatsappMessage, [
                'jadwal_id' => $jadwal->id,
                'jadwal_type' => 'praktikum',
                'mata_kuliah_kode' => $mataKuliah->kode,
                'mata_kuliah_nama' => $mataKuliah->nama,
            ]);
        } catch (\Exception $e) {
            Log::error("Gagal mengirim notifikasi jadwal praktikum ke dosen {$dosenId}: " . $e->getMessage());
        }
    }

    /**
     * Send notification to all tim akademik when a praktikum schedule is created
     */
    private function sendNotificationToTimAkademik($jadwal)
    {
        try {
            $timAkademikUsers = User::where('role', 'tim_akademik')->get();
            $mataKuliah = $jadwal->mataKuliah;
            $ruangan = $jadwal->ruangan;

            foreach ($timAkademikUsers as $user) {
                \App\Models\Notification::create([
                    'user_id' => $user->id,
                    'title' => 'Jadwal Praktikum Baru Dibuat',
                    'message' => "Jadwal Praktikum {$mataKuliah->nama} pada tanggal " .
                        date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                        str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                        " di ruangan {$ruangan->nama} untuk kelompok " . ($jadwal->kelompokKecil->pluck('nama_kelompok')->join(', ') ?: 'Tidak diketahui') . " telah dibuat. Mohon lakukan absensi dosen setelah praktikum selesai.",
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
                        'kelompok_kecil' => $jadwal->kelompokKecil->map(function($k) {
                            return [
                                'id' => $k->id,
                                'nama_kelompok' => $k->nama_kelompok
                            ];
                        }),
                        'materi' => $jadwal->materi,
                        'topik' => $jadwal->topik ?? null,
                        'created_by' => Auth::user()->name ?? 'Admin',
                        'created_by_role' => Auth::user()->role ?? 'admin',
                        'action_url' => "/absensi-praktikum/{$mataKuliah->kode}/{$jadwal->id}?tab=dosen"
                    ]
                ]);
            }
            Log::info("Notifikasi jadwal praktikum berhasil dikirim ke tim akademik untuk jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            Log::error("Gagal mengirim notifikasi jadwal praktikum ke tim akademik untuk jadwal ID {$jadwal->id}: " . $e->getMessage());
        }
    }

    /**
     * Get jadwal praktikum untuk dosen tertentu
     */
    public function getJadwalForDosen($dosenId, Request $request)
    {
        try {
            $semesterType = $request->query('semester_type');

            // PENTING: Untuk Praktikum, semua dosen disimpan di pivot table (jadwal_praktikum_dosen)
            // Dosen aktif: dosen yang ada di pivot dengan status bukan "tidak_bisa"
            // Dosen lama: dosen yang ada di pivot dengan status "tidak_bisa"
            // Untuk menampilkan semua pengampu, kita perlu mengambil semua dosen di jadwal, bukan hanya dosen yang login
            $query = JadwalPraktikum::with(['mataKuliah', 'ruangan', 'dosen' => function ($query) {
                $query->withPivot('status_konfirmasi', 'alasan_konfirmasi');
            }])
                ->whereHas('dosen', function ($query) use ($dosenId) {
                    // Ambil semua jadwal yang memiliki dosen ini di pivot (baik aktif maupun lama)
                    $query->where('dosen_id', $dosenId);
                });

            // Filter berdasarkan semester type jika ada
            if ($semesterType && $semesterType !== 'all') {
                if ($semesterType === 'reguler') {
                    $query->whereHas('mataKuliah', function ($q) {
                        $q->where('semester', '!=', 'Antara');
                    });
                } elseif ($semesterType === 'antara') {
                    // Filter untuk praktikum semester antara
                    $query->whereHas('mataKuliah', function ($q) {
                        $q->where('semester', '=', 'Antara');
                    });
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

                // PENTING: Untuk Praktikum, tentukan apakah dosen ini aktif atau hanya history
                // Dosen aktif: status bukan "tidak_bisa"
                // Dosen lama: status "tidak_bisa"
                $isActiveDosen = ($statusKonfirmasi !== 'tidak_bisa');
                $isInHistory = ($statusKonfirmasi === 'tidak_bisa');

                // Jika dosen hanya ada di history (sudah diganti), status harus "tidak_bisa" dan tidak bisa diubah
                // (Status sudah "tidak_bisa" dari pivot, tidak perlu diubah)

                return (object) [
                    'id' => $item->id,
                    'tanggal' => $item->tanggal,
                    'jam_mulai' => $item->jam_mulai,
                    'jam_selesai' => $item->jam_selesai,
                    'materi' => $item->materi,
                    'topik' => $item->topik,
                    'status_konfirmasi' => $statusKonfirmasi, // Status dari pivot table
                    'alasan_konfirmasi' => $pivotData && $pivotData->pivot ? $pivotData->pivot->alasan_konfirmasi ?? null : null,
                    'mata_kuliah_kode' => $item->mata_kuliah_kode,
                    'mata_kuliah' => (object) [
                        'kode' => $item->mataKuliah->kode ?? '',
                        'nama' => $item->mataKuliah->nama ?? 'N/A',
                        'semester' => $item->mataKuliah->semester ?? ''
                    ],
                    'kelompok_kecil' => $item->kelompokKecil->map(function($k) {
                        return [
                            'id' => $k->id,
                            'nama_kelompok' => $k->nama_kelompok
                        ];
                    }),
                    'dosen' => $item->dosen->map(function ($d) {
                        return (object) [
                            'id' => $d->id,
                            'name' => $d->name,
                            'status_konfirmasi' => $d->pivot->status_konfirmasi ?? 'belum_konfirmasi',
                            'alasan_konfirmasi' => $d->pivot->alasan_konfirmasi ?? null
                        ];
                    }),
                    'dosen_id' => $dosenId, // Dosen yang sedang login
                    'dosen_ids' => $item->dosen->pluck('id')->toArray(), // Semua dosen di pivot
                    'is_active_dosen' => $isActiveDosen, // Flag: apakah dosen ini adalah dosen aktif (status bukan "tidak_bisa")
                    'is_in_history' => $isInHistory, // Flag: apakah dosen ini hanya ada di history (status "tidak_bisa")
                    'ruangan' => (object) [
                        'id' => $item->ruangan->id ?? null,
                        'nama' => $item->ruangan->nama ?? 'N/A'
                    ],
                    'jumlah_sesi' => $item->jumlah_sesi,
                    'semester_type' => $item->mataKuliah && $item->mataKuliah->semester === 'Antara' ? 'antara' : 'reguler',
                    'penilaian_submitted' => (bool)($item->penilaian_submitted ?? false),
                    'penilaian_submitted_at' => $item->penilaian_submitted_at ?? null,
                    'penilaian_submitted_by' => $item->penilaian_submitted_by ?? null,
                    'created_at' => $item->created_at
                ];
            });

            return response()->json([
                'data' => $mappedJadwal,
                'message' => 'Jadwal praktikum berhasil diambil'
            ]);
        } catch (\Exception $e) {
            Log::error("Error getting jadwal praktikum for dosen {$dosenId}: " . $e->getMessage());
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

        try {
            $jadwal = JadwalPraktikum::with('dosen')->findOrFail($id);

            // Cek apakah dosen sudah ada di pivot table
            $pivotExists = $jadwal->dosen()->where('users.id', $request->dosen_id)->exists();

            if ($pivotExists) {
                // Update pivot table jika sudah ada
                $jadwal->dosen()->updateExistingPivot($request->dosen_id, [
                    'status_konfirmasi' => $request->status,
                    'alasan_konfirmasi' => $request->alasan,
                    'updated_at' => now()
                ]);
            } else {
                // Jika belum ada, attach dosen ke jadwal dengan status konfirmasi
                $jadwal->dosen()->attach($request->dosen_id, [
                    'status_konfirmasi' => $request->status,
                    'alasan_konfirmasi' => $request->alasan,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }

            // Kirim notifikasi ke super admin jika dosen tidak bisa
            if ($request->status === 'tidak_bisa') {
                $this->sendReplacementNotification($jadwal, $request->dosen_id, $request->alasan);
            }

            return response()->json([
                'message' => 'Konfirmasi berhasil disimpan',
                'status' => $request->status
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'message' => 'Jadwal praktikum tidak ditemukan',
                'error' => "Jadwal dengan ID {$id} tidak ditemukan"
            ], 404);
        } catch (\Exception $e) {
            Log::error("Error konfirmasi jadwal praktikum: " . $e->getMessage());
            return response()->json([
                'message' => 'Gagal menyimpan konfirmasi',
                'error' => $e->getMessage()
            ], 500);
        }
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
                'data.*.kelompok_kecil_ids' => 'required|array|min:1',
                'data.*.kelompok_kecil_ids.*' => 'exists:kelompok_kecil,id',
                'data.*.dosen_id' => 'nullable|exists:users,id', // Backward compatibility
                'data.*.dosen_ids' => 'nullable|array|min:1', // Support multiple dosen
                'data.*.dosen_ids.*' => 'exists:users,id',
                'data.*.ruangan_id' => 'required|exists:ruangan,id',
                'data.*.jumlah_sesi' => 'nullable|integer|min:1|max:6',
                // SIAKAD fields
                'data.*.siakad_kurikulum' => 'nullable|string',
                'data.*.siakad_kode_mk' => 'nullable|string',
                'data.*.siakad_kelompok' => 'nullable|string',
                'data.*.siakad_jenis_pertemuan' => 'nullable|string',
                'data.*.siakad_metode' => 'nullable|string',
                'data.*.siakad_dosen_pengganti' => 'nullable|string',
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

                // Handle dosen_ids: gunakan dosen_ids jika ada, jika tidak gunakan dosen_id (backward compatibility)
                if (!isset($row['dosen_ids']) || empty($row['dosen_ids'])) {
                    if (isset($row['dosen_id']) && $row['dosen_id']) {
                        $row['dosen_ids'] = [$row['dosen_id']];
                    } else {
                        $errors[] = "Baris " . ($index + 1) . ": Dosen wajib diisi (minimal 1 dosen)";
                        continue;
                    }
                }

                // Validasi dosen_ids adalah array dan tidak kosong
                if (!is_array($row['dosen_ids']) || empty($row['dosen_ids'])) {
                    $errors[] = "Baris " . ($index + 1) . ": Dosen wajib diisi (minimal 1 dosen)";
                    continue;
                }

                // Validasi kapasitas ruangan
                $kapasitasMessage = $this->validateRuanganCapacity($row);
                if ($kapasitasMessage) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $kapasitasMessage;
                }

                // Materi sudah ada di $row['materi'] dari input Excel

                // Validasi bentrok
                $row['mata_kuliah_kode'] = $kode; // Tambahkan mata_kuliah_kode untuk checkBentrokWithDetail
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

                    // Siapkan data untuk disimpan termasuk kolom SIAKAD
                    $jadwalData = [
                        'mata_kuliah_kode' => $kode,
                        'tanggal' => $row['tanggal'],
                        'jam_mulai' => $row['jam_mulai'],
                        'jam_selesai' => $row['jam_selesai'],
                        'materi' => $row['materi'],
                        'topik' => $row['topik'],
                        'ruangan_id' => $row['ruangan_id'],
                        'jumlah_sesi' => $row['jumlah_sesi'],
                        // SIAKAD fields
                        'siakad_kurikulum' => $row['siakad_kurikulum'] ?? null,
                        'siakad_kode_mk' => $row['siakad_kode_mk'] ?? null,
                        'siakad_kelompok' => $row['siakad_kelompok'] ?? null,
                        'siakad_jenis_pertemuan' => $row['siakad_jenis_pertemuan'] ?? null,
                        'siakad_metode' => $row['siakad_metode'] ?? null,
                        'siakad_dosen_pengganti' => $row['siakad_dosen_pengganti'] ?? null,
                    ];

                    // Buat jadwal praktikum
                    $jadwal = JadwalPraktikum::create($jadwalData);

                    // Sync dosen (support multiple dosen)
                    // Gunakan dosen_ids jika ada, jika tidak gunakan dosen_id (backward compatibility)
                    $dosenIdsForSync = $row['dosen_ids'] ?? (isset($row['dosen_id']) ? [$row['dosen_id']] : []);
                    $jadwal->dosen()->sync($dosenIdsForSync);

                    // Sync kelompok kecil (support multiple kelompok)
                    $kelompokKecilIdsForSync = $row['kelompok_kecil_ids'] ?? [];
                    $jadwal->kelompokKecil()->sync($kelompokKecilIdsForSync);

                    // Kirim notifikasi ke semua dosen yang di-assign
                    foreach ($dosenIdsForSync as $dosenId) {
                        $this->sendAssignmentNotification($jadwal, $dosenId);
                    }

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
                            'kelompok_kecil_ids' => $row['kelompok_kecil_ids'],
                            // SIAKAD fields
                            'siakad_kurikulum' => $row['siakad_kurikulum'] ?? null,
                            'siakad_kode_mk' => $row['siakad_kode_mk'] ?? null,
                            'siakad_kelompok' => $row['siakad_kelompok'] ?? null,
                            'siakad_jenis_pertemuan' => $row['siakad_jenis_pertemuan'] ?? null,
                            'siakad_metode' => $row['siakad_metode'] ?? null,
                            'siakad_dosen_pengganti' => $row['siakad_dosen_pengganti'] ?? null,
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
            Log::error('Error importing praktikum data: ' . $e->getMessage());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengimport data: ' . $e->getMessage()
            ], 500);
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
                        " untuk kelompok " . ($jadwal->kelompokKecil->pluck('nama_kelompok')->join(', ') ?: 'Tidak diketahui') . " di ruangan {$jadwal->ruangan->nama}.{$alasanText}",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'praktikum',
                        'dosen_id' => $dosenId,
                        'dosen_name' => $dosen->name, // Simpan nama dosen untuk ditampilkan di frontend
                        'mata_kuliah' => $jadwal->mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal,
                        'waktu' => $jadwal->jam_mulai . ' - ' . $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'kelompok_kecil' => $jadwal->kelompokKecil->map(function($k) {
                            return [
                                'id' => $k->id,
                                'nama_kelompok' => $k->nama_kelompok
                            ];
                        }),
                        'alasan' => $alasan
                    ]
                ]);
            }

            Log::info("Notifikasi replacement berhasil dikirim ke super admin untuk jadwal praktikum ID: {$jadwal->id}");
        } catch (\Exception $e) {
            Log::error("Gagal mengirim notifikasi replacement untuk jadwal praktikum ID {$jadwal->id}: " . $e->getMessage());
        }
    }

    /**
     * Toggle QR code enabled/disabled untuk jadwal praktikum
     */
    public function toggleQr($kode, $jadwalId)
    {
        try {
            $jadwal = JadwalPraktikum::where('id', $jadwalId)
                ->where('mata_kuliah_kode', $kode)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Cek apakah user adalah dosen yang mengajar di jadwal ini
            $userId = Auth::id();
            $isDosenJadwal = $jadwal->dosen()->where('users.id', $userId)->exists();

            // Hanya dosen yang mengajar atau super_admin/tim_akademik yang bisa toggle
            $user = Auth::user();
            if (!$isDosenJadwal && !in_array($user->role, ['super_admin', 'tim_akademik'])) {
                return response()->json(['message' => 'Anda tidak memiliki akses untuk mengubah status QR code'], 403);
            }

            // Toggle qr_enabled
            $jadwal->qr_enabled = !$jadwal->qr_enabled;
            $jadwal->save();

            Log::info('QR code toggled for Praktikum', [
                'jadwal_id' => $jadwalId,
                'qr_enabled' => $jadwal->qr_enabled,
                'user_id' => $userId
            ]);

            return response()->json([
                'message' => $jadwal->qr_enabled ? 'QR code diaktifkan' : 'QR code dinonaktifkan',
                'qr_enabled' => $jadwal->qr_enabled
            ]);
        } catch (\Exception $e) {
            Log::error("Error toggling QR for Praktikum: " . $e->getMessage());
            return response()->json(['message' => 'Gagal mengubah status QR code: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Generate QR token untuk absensi (expired setiap 20 detik)
     */
    public function generateQrToken($kode, $jadwalId)
    {
        try {
            $jadwal = JadwalPraktikum::where('id', $jadwalId)
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
            $isDosenJadwal = $jadwal->dosen()->where('users.id', $userId)->exists();

            // Hanya dosen yang mengajar atau super_admin/tim_akademik yang bisa generate token
            $user = Auth::user();
            if (!$isDosenJadwal && !in_array($user->role, ['super_admin', 'tim_akademik'])) {
                return response()->json(['message' => 'Anda tidak memiliki akses untuk generate QR token'], 403);
            }

            // Generate random token
            $token = Str::random(32);
            $cacheKey = "qr_token_praktikum_{$kode}_{$jadwalId}";

            // Simpan token di cache dengan expiry 20 detik
            Cache::put($cacheKey, $token, now()->addSeconds(20));

            // Calculate expires timestamp (unix timestamp in milliseconds untuk frontend)
            $expiresAt = now()->addSeconds(20);
            $expiresAtTimestamp = $expiresAt->timestamp * 1000; // Convert to milliseconds

            Log::info('QR token generated for Praktikum', [
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
            Log::error("Error generating QR token for Praktikum: " . $e->getMessage());
            return response()->json(['message' => 'Gagal generate QR token: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get mahasiswa untuk jadwal praktikum berdasarkan kelompok kecil
     */
    public function getMahasiswa($kode, $jadwalId)
    {
        try {
            $jadwal = JadwalPraktikum::with('kelompokKecil')->where('mata_kuliah_kode', $kode)
                ->where('id', $jadwalId)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Get kelompok kecil dari relasi (bisa multiple)
            $kelompokKecilCollection = $jadwal->kelompokKecil;

            if ($kelompokKecilCollection->isEmpty()) {
                Log::warning("Kelompok kecil tidak ditemukan untuk jadwal praktikum", [
                    'kode' => $kode,
                    'jadwal_id' => $jadwalId,
                    'mata_kuliah_kode' => $jadwal->mata_kuliah_kode
                ]);

                return response()->json([
                    'message' => 'Kelompok kecil tidak ditemukan',
                    'mahasiswa' => []
                ], 404);
            }

            // Collect all unique mahasiswa IDs from all selected groups
            $allMahasiswaIds = [];
            
            foreach ($kelompokKecilCollection as $kelompok) {
                $ids = \App\Models\KelompokKecil::where('nama_kelompok', $kelompok->nama_kelompok)
                    ->where('semester', $kelompok->semester)
                    ->pluck('mahasiswa_id')
                    ->toArray();
                
                $allMahasiswaIds = array_merge($allMahasiswaIds, $ids);
            }

            $uniqueMahasiswaIds = array_unique($allMahasiswaIds);

            $mahasiswaList = User::where('role', 'mahasiswa')
            ->whereIn('id', $uniqueMahasiswaIds)
            ->orderBy('nim', 'asc')
            ->get()
            ->map(function ($user) use ($uniqueMahasiswaIds, $kelompokKecilCollection) {
                // Cari kelompok mana mahasiswa ini tergabung (dari koleksi kelompok yang di-assign)
                $kelompokNama = "";
                foreach ($kelompokKecilCollection as $kelompok) {
                    $existsInThisGroup = \App\Models\KelompokKecil::where('nama_kelompok', $kelompok->nama_kelompok)
                        ->where('semester', $kelompok->semester)
                        ->where('mahasiswa_id', $user->id)
                        ->exists();
                    
                    if ($existsInThisGroup) {
                        $kelompokNama = "Kelompok " . $kelompok->nama_kelompok;
                        break;
                    }
                }

                return [
                    'id' => $user->id,
                    'nim' => $user->nim,
                    'nama' => $user->name,
                    'nama_kelompok' => $kelompokNama
                ];
            });

            return response()->json([
                'mahasiswa' => $mahasiswaList
            ]);
        } catch (\Exception $e) {
            Log::error("Error getting mahasiswa for Praktikum: " . $e->getMessage());
            return response()->json(['message' => 'Gagal mengambil data mahasiswa'], 500);
        }
    }

    /**
     * Get absensi untuk jadwal praktikum tertentu
     */
    public function getAbsensi($kode, $jadwalId)
    {
        try {
            $jadwal = JadwalPraktikum::where('mata_kuliah_kode', $kode)
                ->where('id', $jadwalId)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Get semua absensi untuk jadwal ini
            $absensiRecords = AbsensiPraktikum::where('jadwal_praktikum_id', $jadwalId)
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
            Log::error("Error getting absensi for Praktikum: " . $e->getMessage());
            return response()->json(['message' => 'Gagal mengambil data absensi'], 500);
        }
    }

    /**
     * Save absensi untuk jadwal praktikum tertentu
     */
    public function saveAbsensi(Request $request, $kode, $jadwalId)
    {
        try {
            $jadwal = JadwalPraktikum::where('mata_kuliah_kode', $kode)
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
                $cacheKey = "qr_token_praktikum_{$kode}_{$jadwalId}";

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

                Log::info('QR token validated successfully for Praktikum', [
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

            // Get mahasiswa yang terdaftar di kelompok kecil jadwal ini
            $mahasiswaTerdaftar = [];

            // Get kelompok kecil dari relasi
            $kelompokKecilCollection = $jadwal->kelompokKecil;

            if ($kelompokKecilCollection->isNotEmpty()) {
                // Collect all unique mahasiswa IDs from all selected groups
                $allMahasiswaIds = [];
                
                foreach ($kelompokKecilCollection as $kelompok) {
                    $ids = \App\Models\KelompokKecil::where('nama_kelompok', $kelompok->nama_kelompok)
                        ->where('semester', $kelompok->semester)
                        ->pluck('mahasiswa_id')
                        ->toArray();
                    
                    $allMahasiswaIds = array_merge($allMahasiswaIds, $ids);
                }

                $uniqueMahasiswaIds = array_unique($allMahasiswaIds);

                $mahasiswaList = User::where('role', 'mahasiswa')
                    ->whereIn('id', $uniqueMahasiswaIds)
                    ->get();
                $mahasiswaTerdaftar = $mahasiswaList->pluck('nim')->toArray();
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
                AbsensiPraktikum::updateOrCreate(
                    [
                        'jadwal_praktikum_id' => $jadwalId,
                        'mahasiswa_nim' => $absen['mahasiswa_nim']
                    ],
                    [
                        'hadir' => $absen['hadir'] ?? false,
                        'catatan' => $absen['catatan'] ?? ''
                    ]
                );
            }

            // Get kembali semua absensi untuk response
            $absensi = AbsensiPraktikum::where('jadwal_praktikum_id', $jadwalId)
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
            Log::error("Error saving absensi for Praktikum: " . $e->getMessage());
            return response()->json(['message' => 'Gagal menyimpan absensi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get absensi dosen untuk jadwal praktikum tertentu
     */
    public function getAbsensiDosen($kode, $jadwalId)
    {
        try {
            $jadwal = JadwalPraktikum::where('mata_kuliah_kode', $kode)
                ->where('id', $jadwalId)
                ->with(['dosen' => function ($query) {
                    $query->withPivot('status_konfirmasi', 'alasan_konfirmasi');
                }])
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Ambil semua dosen yang terdaftar di jadwal ini dengan pivot data
            $dosenWithPivot = $jadwal->dosen->map(function ($dosen) {
                return [
                    'id' => $dosen->id,
                    'status_konfirmasi' => $dosen->pivot->status_konfirmasi ?? null,
                    'alasan_konfirmasi' => $dosen->pivot->alasan_konfirmasi ?? null,
                ];
            });
            $dosenIds = $dosenWithPivot->pluck('id')->toArray();

            $absensiRecords = \App\Models\AbsensiDosenPraktikum::where('jadwal_praktikum_id', $jadwalId)
                ->whereIn('dosen_id', $dosenIds)
                ->with('dosen')
                ->get();

            // Konversi ke format yang diharapkan frontend (key by dosen_id)
            $absensi = [];
            foreach ($dosenWithPivot as $dosenData) {
                $dosenId = $dosenData['id'];
                $statusKonfirmasi = $dosenData['status_konfirmasi'];
                $alasanKonfirmasi = $dosenData['alasan_konfirmasi'];

                // Cek apakah sudah ada record absensi
                $existingRecord = $absensiRecords->firstWhere('dosen_id', $dosenId);

                // Jika dosen konfirmasi "tidak_bisa", otomatis set hadir = false dan catatan = alasan
                if ($statusKonfirmasi === 'tidak_bisa') {
                    $absensi[$dosenId] = [
                        'hadir' => false,
                        'catatan' => $alasanKonfirmasi ?? '',
                        'tanda_tangan' => null // Tidak hadir tidak perlu tanda tangan
                    ];
                } else if ($existingRecord) {
                    // Jika sudah ada record absensi, gunakan data yang ada
                    $absensi[$dosenId] = [
                        'hadir' => $existingRecord->hadir,
                        'catatan' => $existingRecord->catatan ?? '',
                        'tanda_tangan' => $existingRecord->tanda_tangan ?? null
                    ];
                } else {
                    // Jika belum ada record, set default
                    $absensi[$dosenId] = [
                        'hadir' => false,
                        'catatan' => '',
                        'tanda_tangan' => null
                    ];
                }
            }

            // Ambil informasi apakah sudah submitted (pastikan boolean)
            $penilaianSubmitted = (bool)($jadwal->penilaian_submitted ?? false);

            // Konversi ke array jika diperlukan (untuk kompatibilitas dengan format array)
            // Hanya return data yang benar-benar ada di database (bukan default)
            // Kecuali untuk dosen "tidak_bisa" yang memang otomatis dibuat
            $absensiArray = [];
            $absensiToReturn = []; // Hanya data yang benar-benar ada di database

            foreach ($absensi as $dosenId => $data) {
                $dosenData = $dosenWithPivot->firstWhere('id', $dosenId);
                $statusKonfirmasi = $dosenData['status_konfirmasi'] ?? null;

                // Cek apakah ada record di database untuk dosen ini
                $existingRecord = $absensiRecords->firstWhere('dosen_id', $dosenId);

                // Hanya return data jika:
                // 1. Ada record di database (sudah disimpan oleh tim akademik), ATAU
                // 2. Dosen "tidak_bisa" (otomatis dibuat)
                if ($existingRecord || $statusKonfirmasi === 'tidak_bisa') {
                    $absensiToReturn[$dosenId] = $data;
                    $absensiArray[] = [
                        'dosen_id' => $dosenId,
                        'hadir' => $data['hadir'],
                        'catatan' => $data['catatan'],
                        'tanda_tangan' => $data['tanda_tangan']
                    ];
                }
            }

            return response()->json([
                'absensi' => $absensiToReturn, // Object format (key by dosen_id) - hanya data yang benar-benar ada
                'penilaian_submitted' => (bool)$penilaianSubmitted,
                'report_submitted' => (bool)$penilaianSubmitted,
                'submitted' => (bool)$penilaianSubmitted,
            ]);
        } catch (\Exception $e) {
            Log::error("Error getting absensi dosen for Praktikum: " . $e->getMessage());
            return response()->json(['message' => 'Gagal memuat data absensi dosen: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Store absensi dosen untuk jadwal praktikum tertentu (hanya tim akademik)
     */
    public function storeAbsensiDosen(Request $request, $kode, $jadwalId)
    {
        try {
            $jadwal = JadwalPraktikum::where('mata_kuliah_kode', $kode)
                ->where('id', $jadwalId)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Cek apakah user adalah tim akademik, super_admin, atau dosen yang menyimpan tanda tangan sendiri
            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Cek apakah user adalah tim akademik/super_admin atau dosen yang menyimpan tanda tangan sendiri
            $isTimAkademik = in_array($user->role, ['super_admin', 'tim_akademik']);
            $isDosenSavingOwnSignature = false;

            // Jika bukan tim akademik, cek apakah user adalah dosen yang menyimpan tanda tangan sendiri
            if (!$isTimAkademik) {
                // Cek apakah request hanya untuk satu dosen dan itu adalah user yang login
                if (count($request->absensi) === 1 && $request->absensi[0]['dosen_id'] == $user->id) {
                    // Cek apakah hanya menyimpan tanda tangan (tidak mengubah hadir/catatan)
                    // Atau jika mengubah, pastikan hanya untuk dirinya sendiri
                    $isDosenSavingOwnSignature = true;
                }
            }

            // Hanya tim akademik/super_admin atau dosen yang menyimpan tanda tangan sendiri yang bisa menyimpan
            if (!$isTimAkademik && !$isDosenSavingOwnSignature) {
                return response()->json(['message' => 'Hanya tim akademik yang dapat menyimpan absensi dosen, atau dosen yang menyimpan tanda tangan sendiri'], 403);
            }

            // Validasi request
            $request->validate([
                'absensi' => 'required|array',
                'absensi.*.dosen_id' => 'required|exists:users,id',
                'absensi.*.hadir' => 'required|boolean',
                'absensi.*.catatan' => 'nullable|string|max:1000',
                'absensi.*.tanda_tangan' => 'nullable|string',
                'penilaian_submitted' => 'nullable|boolean',
            ]);

            // Ambil semua dosen_id yang valid untuk jadwal ini
            $dosenIds = $jadwal->dosen->pluck('id')->toArray();

            // Validasi bahwa semua dosen_id yang dikirim ada di jadwal
            foreach ($request->absensi as $absen) {
                if (!in_array($absen['dosen_id'], $dosenIds)) {
                    return response()->json([
                        'message' => 'Dosen dengan ID ' . $absen['dosen_id'] . ' tidak terdaftar dalam jadwal ini'
                    ], 400);
                }
            }

            // Hapus absensi lama untuk dosen-dosen ini
            $dosenIdsToUpdate = array_column($request->absensi, 'dosen_id');
            \App\Models\AbsensiDosenPraktikum::where('jadwal_praktikum_id', $jadwalId)
                ->whereIn('dosen_id', $dosenIdsToUpdate)
                ->delete();

            // Simpan absensi baru
            foreach ($request->absensi as $absen) {
                \App\Models\AbsensiDosenPraktikum::create([
                    'jadwal_praktikum_id' => $jadwalId,
                    'dosen_id' => $absen['dosen_id'],
                    'hadir' => $absen['hadir'],
                    'catatan' => $absen['catatan'] ?? '',
                    'tanda_tangan' => $absen['tanda_tangan'] ?? null,
                ]);
            }

            // Update jadwal Praktikum dengan status penilaian_submitted (setelah menyimpan absensi)
            $penilaianSubmitted = false;
            if ($request->has('penilaian_submitted') && $request->penilaian_submitted === true) {
                $jadwal->penilaian_submitted = true;
                $jadwal->penilaian_submitted_by = $user->id;
                $jadwal->penilaian_submitted_at = now();
                $jadwal->save();
                $penilaianSubmitted = true;
            }

            // Refresh jadwal untuk mendapatkan data terbaru
            $jadwal->refresh();

            // Pastikan nilai boolean yang dikembalikan sesuai dengan database
            $penilaianSubmitted = (bool)($jadwal->penilaian_submitted ?? false);

            Log::info('Absensi dosen saved for Praktikum', [
                'jadwal_id' => $jadwalId,
                'user_id' => $user->id,
                'count' => count($request->absensi),
                'penilaian_submitted' => $penilaianSubmitted,
                'penilaian_submitted_db' => $jadwal->penilaian_submitted
            ]);

            return response()->json([
                'message' => 'Absensi dosen berhasil disimpan',
                'count' => count($request->absensi),
                'penilaian_submitted' => (bool)$penilaianSubmitted,
                'submitted' => (bool)$penilaianSubmitted
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Validasi gagal',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error("Error storing absensi dosen for Praktikum: " . $e->getMessage());
            return response()->json(['message' => 'Gagal menyimpan absensi dosen: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get koordinator signature untuk jadwal praktikum tertentu
     */
    public function getKoordinatorSignature($kode, $jadwalId)
    {
        try {
            $jadwal = JadwalPraktikum::where('mata_kuliah_kode', $kode)
                ->where('id', $jadwalId)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            return response()->json([
                'tanda_tangan' => $jadwal->koordinator_signature
            ]);
        } catch (\Exception $e) {
            Log::error("Error getting koordinator signature for Praktikum: " . $e->getMessage());
            return response()->json(['message' => 'Gagal mengambil tanda tangan koordinator: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Store koordinator signature untuk jadwal praktikum tertentu
     */
    public function storeKoordinatorSignature(Request $request, $kode, $jadwalId)
    {
        try {
            $jadwal = JadwalPraktikum::where('mata_kuliah_kode', $kode)
                ->where('id', $jadwalId)
                ->first();

            if (!$jadwal) {
                return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
            }

            // Validasi request
            $request->validate([
                'tanda_tangan' => 'required|string',
            ]);

            // Cek apakah user adalah koordinator blok untuk blok dan semester ini
            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Ambil blok dan semester dari mata kuliah
            $mataKuliah = $jadwal->mataKuliah;
            if (!$mataKuliah) {
                return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
            }

            $blok = $mataKuliah->blok;
            $semester = $mataKuliah->semester;

            // Cek apakah user adalah koordinator blok untuk blok dan semester ini
            $isKoordinator = DosenPeran::where('user_id', $user->id)
                ->where('tipe_peran', 'koordinator')
                ->where('blok', $blok)
                ->where('semester', $semester)
                ->exists();

            if (!$isKoordinator) {
                return response()->json(['message' => 'Hanya koordinator blok yang dapat menyimpan tanda tangan'], 403);
            }

            // Simpan tanda tangan
            $jadwal->koordinator_signature = $request->tanda_tangan;
            $jadwal->save();

            Log::info('Koordinator signature saved for Praktikum', [
                'jadwal_id' => $jadwalId,
                'user_id' => $user->id,
                'blok' => $blok,
                'semester' => $semester,
            ]);

            return response()->json([
                'message' => 'Tanda tangan koordinator berhasil disimpan',
                'tanda_tangan' => $jadwal->koordinator_signature
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Validasi gagal',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error("Error storing koordinator signature for Praktikum: " . $e->getMessage());
            return response()->json(['message' => 'Gagal menyimpan tanda tangan koordinator: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get praktikum yang memerlukan tanda tangan koordinator untuk user tertentu
     */
    public function getKoordinatorPendingSignature($dosenId, Request $request)
    {
        try {
            $user = User::find($dosenId);
            if (!$user) {
                return response()->json(['message' => 'User tidak ditemukan'], 404);
            }

            // Ambil semester filter dari request
            $semester = $request->input('semester');
            $semesterType = $request->input('semester_type', 'reguler');

            // Cari semua peran koordinator user ini
            $koordinatorPeran = DosenPeran::where('user_id', $dosenId)
                ->where('tipe_peran', 'koordinator')
                ->get();

            Log::info("Praktikum getKoordinatorPendingSignature - Found " . count($koordinatorPeran) . " koordinator peran for user ID: {$dosenId}");

            if ($koordinatorPeran->isEmpty()) {
                Log::info("Praktikum getKoordinatorPendingSignature - No koordinator peran found for user ID: {$dosenId}");
                return response()->json(['data' => []]);
            }

            // Ambil blok dan semester dari peran koordinator
            $blokSemesterPairs = $koordinatorPeran->map(function ($peran) {
                return [
                    'blok' => $peran->blok,
                    'semester' => $peran->semester,
                ];
            })->unique(function ($pair) {
                return $pair['blok'] . '_' . $pair['semester'];
            });

            Log::info("Praktikum getKoordinatorPendingSignature - Blok/Semester pairs: " . json_encode($blokSemesterPairs->toArray()));

            // Cari jadwal praktikum yang sesuai dengan blok dan semester koordinator
            $jadwalPraktikum = JadwalPraktikum::with(['mataKuliah', 'ruangan', 'kelompokKecil'])
                ->whereHas('mataKuliah', function ($query) use ($blokSemesterPairs, $semester) {
                    $query->where(function ($q) use ($blokSemesterPairs, $semester) {
                        foreach ($blokSemesterPairs as $pair) {
                            // Jika ada filter semester, hanya ambil pair yang sesuai
                            if ($semester && $semester !== 'all') {
                                if ($pair['semester'] == $semester) {
                                    $q->orWhere(function ($subQ) use ($pair) {
                                        $subQ->where('blok', $pair['blok'])
                                            ->where('semester', $pair['semester']);
                                    });
                                }
                            } else {
                                // Jika tidak ada filter semester, ambil semua pair
                                $q->orWhere(function ($subQ) use ($pair) {
                                    $subQ->where('blok', $pair['blok'])
                                        ->where('semester', $pair['semester']);
                                });
                            }
                        }
                    });
                })
                ->get();

            Log::info("Praktikum getKoordinatorPendingSignature - Found " . count($jadwalPraktikum) . " jadwal praktikum before semester_type filter");

            // Filter by semester_type if provided (semester_type dihitung dari mataKuliah->semester)
            if ($semesterType && $semesterType !== 'all') {
                $jadwalPraktikum = $jadwalPraktikum->filter(function ($jadwal) use ($semesterType) {
                    $mataKuliahSemester = $jadwal->mataKuliah->semester ?? '';
                    $calculatedSemesterType = ($mataKuliahSemester === 'Antara') ? 'antara' : 'reguler';
                    return $calculatedSemesterType === $semesterType;
                });
            }

            // Map hasil
            $result = $jadwalPraktikum->map(function ($jadwal) {
                // kelompokKecil adalah collection (many-to-many), ambil yang pertama atau semua
                $kelompokKecilData = null;
                if ($jadwal->kelompokKecil && $jadwal->kelompokKecil->isNotEmpty()) {
                    $firstKelompok = $jadwal->kelompokKecil->first();
                    $kelompokKecilData = [
                        'id' => $firstKelompok->id,
                        'nama_kelompok' => $firstKelompok->nama_kelompok,
                    ];
                }

                return [
                    'id' => $jadwal->id,
                    'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                    'mata_kuliah_nama' => $jadwal->mataKuliah->nama ?? 'N/A',
                    'tanggal' => $jadwal->tanggal,
                    'jam_mulai' => $jadwal->jam_mulai,
                    'jam_selesai' => $jadwal->jam_selesai,
                    'ruangan' => $jadwal->ruangan->nama ?? 'N/A',
                    'kelompok_kecil' => $kelompokKecilData,
                    'materi' => $jadwal->materi,
                    'topik' => $jadwal->topik,
                    'koordinator_signature' => $jadwal->koordinator_signature,
                    'action_url' => "/absensi-praktikum/{$jadwal->mata_kuliah_kode}/{$jadwal->id}",
                ];
            })->values();

            Log::info("Praktikum getKoordinatorPendingSignature - Returning " . count($result) . " jadwal praktikum for user ID: {$dosenId}");

            return response()->json(['data' => $result]);
        } catch (\Exception $e) {
            Log::error("Error getting koordinator pending signature: " . $e->getMessage());
            return response()->json(['message' => 'Gagal mengambil data: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Send notification to koordinator blok when a praktikum schedule is created
     */
    private function sendNotificationToKoordinatorBlok($jadwal)
    {
        try {
            $mataKuliah = $jadwal->mataKuliah;
            if (!$mataKuliah) {
                Log::warning("Praktikum sendNotificationToKoordinatorBlok - Mata kuliah tidak ditemukan untuk jadwal ID: {$jadwal->id}");
                return;
            }

            $blok = $mataKuliah->blok;
            $semester = $mataKuliah->semester;

            if (!$blok || !$semester) {
                Log::warning("Praktikum sendNotificationToKoordinatorBlok - Blok atau semester tidak ditemukan untuk jadwal ID: {$jadwal->id}");
                return;
            }

            // Cari koordinator blok untuk blok dan semester ini
            $koordinatorBlok = DosenPeran::where('tipe_peran', 'koordinator')
                ->where('blok', $blok)
                ->where('semester', $semester)
                ->with('user')
                ->get();

            if ($koordinatorBlok->isEmpty()) {
                Log::info("Praktikum sendNotificationToKoordinatorBlok - Tidak ada koordinator blok untuk Blok {$blok}, Semester {$semester}");
                return;
            }

            $ruangan = $jadwal->ruangan;

            foreach ($koordinatorBlok as $koordinator) {
                $koordinatorUser = $koordinator->user;
                if (!$koordinatorUser) {
                    continue;
                }

                \App\Models\Notification::create([
                    'user_id' => $koordinatorUser->id,
                    'title' => 'Tanda Tangan Koordinator Blok Diperlukan',
                    'message' => "Jadwal Praktikum {$mataKuliah->nama} pada tanggal " .
                        date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " .
                        str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) .
                        " di ruangan {$ruangan->nama} untuk kelompok " . ($jadwal->kelompokKecil ? $jadwal->kelompokKecil->nama_kelompok : 'Tidak diketahui') . " memerlukan tanda tangan koordinator blok. Silakan lengkapi tanda tangan Anda.",
                    'type' => 'warning',
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
                        'kelompok_kecil' => $jadwal->kelompokKecil ? [
                            'id' => $jadwal->kelompokKecil->id,
                            'nama_kelompok' => $jadwal->kelompokKecil->nama_kelompok,
                        ] : null,
                        'materi' => $jadwal->materi,
                        'topik' => $jadwal->topik ?? null,
                        'blok' => $blok,
                        'semester' => $semester,
                        'created_by' => Auth::user()->name ?? 'Admin',
                        'created_by_role' => Auth::user()->role ?? 'admin',
                        'sender_name' => Auth::user()->name ?? 'Admin',
                        'sender_role' => Auth::user()->role ?? 'admin',
                        'action_url' => "/absensi-praktikum/{$mataKuliah->kode}/{$jadwal->id}?tab=dosen"
                    ]
                ]);
            }

            Log::info("Praktikum notifications sent to " . count($koordinatorBlok) . " koordinator blok for jadwal ID: {$jadwal->id}");
        } catch (\Exception $e) {
            Log::error("Error sending Praktikum notifications to koordinator blok: " . $e->getMessage());
        }
    }
}
