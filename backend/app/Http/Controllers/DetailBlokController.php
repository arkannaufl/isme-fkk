<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\MataKuliah;
use App\Models\JadwalPBL;
use App\Models\JadwalKuliahBesar;
use App\Models\JadwalAgendaKhusus;
use App\Models\JadwalPraktikum;
use App\Models\JadwalJurnalReading;
use App\Models\PBL;
use App\Models\KelompokKecil;
use App\Models\KelompokBesar;
use App\Models\User;
use App\Models\Ruangan;


class DetailBlokController extends Controller
{
    /**
     * Fetch all data needed for DetailBlok page in a single request
     */
    public function getBatchData($kode)
    {
        try {
            // Get mata kuliah data
            $mataKuliah = MataKuliah::where('kode', $kode)->first();
            if (!$mataKuliah) {
                return response()->json(['error' => 'Mata kuliah tidak ditemukan'], 404);
            }

            // Get all data in parallel using Promise-like approach
            $data = [
                'mata_kuliah' => $mataKuliah,
                'jadwal_pbl' => $this->getJadwalPBL($kode),
                'jadwal_kuliah_besar' => $this->getJadwalKuliahBesar($kode),
                'jadwal_agenda_khusus' => $this->getJadwalAgendaKhusus($kode),
                'jadwal_praktikum' => $this->getJadwalPraktikum($kode),
                'jadwal_jurnal_reading' => $this->getJadwalJurnalReading($kode),
                'modul_pbl' => $this->getModulPBL($kode),
                'jurnal_reading' => $this->getJurnalReading($kode),
                'kelompok_kecil' => $this->getKelompokKecil($mataKuliah->semester),
                'kelompok_besar' => $this->getKelompokBesar($mataKuliah->semester),
                'dosen' => $this->getDosen($mataKuliah),
                'ruangan' => $this->getRuangan(),
                'kelas_praktikum' => [],
                'materi_praktikum' => [],
                'jam_options' => $this->getJamOptions(),
            ];

            return response()->json($data);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Gagal mengambil data: ' . $e->getMessage()], 500);
        }
    }

    private function getJadwalPBL($kode)
    {
        return JadwalPBL::where('mata_kuliah_kode', $kode)
            ->with(['modulPBL', 'kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan'])
            ->orderBy('tanggal', 'asc')
            ->orderBy('jam_mulai', 'asc')
            ->get()
            ->map(function ($jadwal) {
                // Transform jam format for frontend compatibility
                if ($jadwal->jam_mulai) {
                    $jadwal->jam_mulai = $this->formatJamForFrontend($jadwal->jam_mulai);
                }
                if ($jadwal->jam_selesai) {
                    $jadwal->jam_selesai = $this->formatJamForFrontend($jadwal->jam_selesai);
                }
                // Add modul_pbl_id for frontend compatibility
                $jadwal->modul_pbl_id = $jadwal->pbl_id;

                // Transform modul name based on pbl_tipe
                if ($jadwal->modulPBL && $jadwal->pbl_tipe && $jadwal->pbl_tipe !== 'PBL 1') {
                    // Cek apakah nama_modul sudah memiliki prefix yang benar
                    if (!str_starts_with($jadwal->modulPBL->nama_modul, $jadwal->pbl_tipe . ':')) {
                        // Jika belum memiliki prefix yang benar, tambahkan
                        $cleanModulName = str_replace(['PBL 1: ', 'PBL 2: '], '', $jadwal->modulPBL->nama_modul);
                        $jadwal->modulPBL->nama_modul = $jadwal->pbl_tipe . ': ' . $cleanModulName;
                    }
                }

                // Add dosen_names for frontend compatibility
                if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
                    $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
                    $jadwal->dosen_names = implode(', ', $dosenNames);
                }

                // Add nama_kelompok for frontend compatibility
                if ($jadwal->kelompok_kecil_antara) {
                    $jadwal->nama_kelompok = $jadwal->kelompok_kecil_antara->nama_kelompok;
                } elseif ($jadwal->kelompok_kecil) {
                    $jadwal->nama_kelompok = $jadwal->kelompok_kecil->nama_kelompok;
                }

                return $jadwal;
            });
    }

    private function getJadwalKuliahBesar($kode)
    {
        return JadwalKuliahBesar::where('mata_kuliah_kode', $kode)
            ->with(['dosen', 'ruangan', 'kelompokBesar'])
            ->orderBy('tanggal', 'asc')
            ->orderBy('jam_mulai', 'asc')
            ->get()
            ->map(function ($jadwal) {
                if ($jadwal->jam_mulai) {
                    $jadwal->jam_mulai = $this->formatJamForFrontend($jadwal->jam_mulai);
                }
                if ($jadwal->jam_selesai) {
                    $jadwal->jam_selesai = $this->formatJamForFrontend($jadwal->jam_selesai);
                }
                // Ensure kelompok_besar_id is included from relationship if not already set
                if (!$jadwal->kelompok_besar_id && $jadwal->kelompokBesar) {
                    $jadwal->kelompok_besar_id = $jadwal->kelompokBesar->id;
                }
                // Ensure dosen_id is included (even if dosen_ids exists)
                if (!$jadwal->dosen_id && $jadwal->dosen) {
                    $jadwal->dosen_id = $jadwal->dosen->id;
                }
                // Ensure materi is included
                if (empty($jadwal->materi)) {
                    $originalMateri = $jadwal->getOriginal('materi');
                    if ($originalMateri) {
                        $jadwal->materi = $originalMateri;
                    }
                }
                // Ensure topik is included
                if ($jadwal->topik === null) {
                    $originalTopik = $jadwal->getOriginal('topik');
                    if ($originalTopik !== null) {
                        $jadwal->topik = $originalTopik;
                    }
                }
                // Ensure ruangan_id is included
                if (!$jadwal->ruangan_id && $jadwal->ruangan) {
                    $jadwal->ruangan_id = $jadwal->ruangan->id;
                }
                return $jadwal;
            });
    }

    private function getJadwalAgendaKhusus($kode)
    {
        return JadwalAgendaKhusus::where('mata_kuliah_kode', $kode)
            ->with(['ruangan'])
            ->orderBy('tanggal', 'asc')
            ->orderBy('jam_mulai', 'asc')
            ->get()
            ->map(function ($jadwal) {
                if ($jadwal->jam_mulai) {
                    $jadwal->jam_mulai = $this->formatJamForFrontend($jadwal->jam_mulai);
                }
                if ($jadwal->jam_selesai) {
                    $jadwal->jam_selesai = $this->formatJamForFrontend($jadwal->jam_selesai);
                }
                // Ensure kelompok_besar_id is included
                if (!$jadwal->kelompok_besar_id && $jadwal->getOriginal('kelompok_besar_id')) {
                    $jadwal->kelompok_besar_id = $jadwal->getOriginal('kelompok_besar_id');
                }
                // Ensure ruangan_id is included
                if (!$jadwal->ruangan_id && $jadwal->ruangan) {
                    $jadwal->ruangan_id = $jadwal->ruangan->id;
                }
                // Ensure agenda is included
                if (empty($jadwal->agenda)) {
                    $originalAgenda = $jadwal->getOriginal('agenda');
                    if ($originalAgenda) {
                        $jadwal->agenda = $originalAgenda;
                    }
                }
                return $jadwal;
            });
    }

    private function getJadwalPraktikum($kode)
    {
        return JadwalPraktikum::where('mata_kuliah_kode', $kode)
            ->with(['dosen', 'ruangan'])
            ->orderBy('tanggal', 'asc')
            ->orderBy('jam_mulai', 'asc')
            ->get()
            ->map(function ($jadwal) {
                if ($jadwal->jam_mulai) {
                    $jadwal->jam_mulai = $this->formatJamForFrontend($jadwal->jam_mulai);
                }
                if ($jadwal->jam_selesai) {
                    $jadwal->jam_selesai = $this->formatJamForFrontend($jadwal->jam_selesai);
                }
                // Ensure dosen_ids is available for frontend (extract from relationship)
                if ($jadwal->dosen && $jadwal->dosen->isNotEmpty()) {
                    $jadwal->dosen_ids = $jadwal->dosen->pluck('id')->toArray();
                }
                // Ensure kelas_praktikum is included and not null
                if (empty($jadwal->kelas_praktikum)) {
                    $original = $jadwal->getOriginal('kelas_praktikum');
                    if ($original) {
                        $jadwal->kelas_praktikum = $original;
                    }
                }
                // Ensure materi is included
                if (empty($jadwal->materi)) {
                    $originalMateri = $jadwal->getOriginal('materi');
                    if ($originalMateri) {
                        $jadwal->materi = $originalMateri;
                    }
                }
                // Ensure topik is included
                if (empty($jadwal->topik)) {
                    $originalTopik = $jadwal->getOriginal('topik');
                    if ($originalTopik) {
                        $jadwal->topik = $originalTopik;
                    }
                }
                return $jadwal;
            });
    }

    private function getJadwalJurnalReading($kode)
    {
        return JadwalJurnalReading::where('mata_kuliah_kode', $kode)
            ->with(['kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan'])
            ->orderBy('tanggal', 'asc')
            ->orderBy('jam_mulai', 'asc')
            ->get()
            ->map(function ($jadwal) {
                if ($jadwal->jam_mulai) {
                    $jadwal->jam_mulai = $this->formatJamForFrontend($jadwal->jam_mulai);
                }
                if ($jadwal->jam_selesai) {
                    $jadwal->jam_selesai = $this->formatJamForFrontend($jadwal->jam_selesai);
                }

                // Add nama_kelompok for frontend compatibility
                if ($jadwal->kelompok_kecil_antara) {
                    $jadwal->nama_kelompok = $jadwal->kelompok_kecil_antara->nama_kelompok;
                } elseif ($jadwal->kelompok_kecil) {
                    $jadwal->nama_kelompok = $jadwal->kelompok_kecil->nama_kelompok;
                }

                // Add dosen_names for frontend compatibility
                if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
                    $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
                    $jadwal->dosen_names = implode(', ', $dosenNames);
                }

                // Ensure dosen_id is included for single dosen
                if (!$jadwal->dosen_id && $jadwal->dosen_ids && is_array($jadwal->dosen_ids) && count($jadwal->dosen_ids) > 0) {
                    $jadwal->dosen_id = $jadwal->dosen_ids[0];
                } elseif (!$jadwal->dosen_id && $jadwal->dosen) {
                    $dosen = is_array($jadwal->dosen) ? $jadwal->dosen->first() : $jadwal->dosen;
                    if ($dosen) {
                        $jadwal->dosen_id = $dosen->id;
                    }
                }

                // Ensure topik is included
                if (empty($jadwal->topik)) {
                    $originalTopik = $jadwal->getOriginal('topik');
                    if ($originalTopik) {
                        $jadwal->topik = $originalTopik;
                    }
                }

                // Ensure ruangan_id is included
                if (!$jadwal->ruangan_id && $jadwal->ruangan) {
                    $jadwal->ruangan_id = $jadwal->ruangan->id;
                }

                return $jadwal;
            });
    }

    private function getModulPBL($kode)
    {
        return PBL::where('mata_kuliah_kode', $kode)->get();
    }

    private function getJurnalReading($kode)
    {
        return \App\Models\JurnalReading::where('mata_kuliah_kode', $kode)->get();
    }

    private function getKelompokKecil($semester)
    {
        return KelompokKecil::where('semester', $semester)->get();
    }

    private function getKelompokBesar($semester)
    {
        // Ambil semua semester yang memiliki kelompok besar
        $semesters = KelompokBesar::distinct()->pluck('semester')->toArray();

        $kelompokBesarData = [];

        foreach ($semesters as $sem) {
            $jumlahMahasiswa = KelompokBesar::where('semester', $sem)->count();

            if ($jumlahMahasiswa > 0) {
                $kelompokBesarData[] = [
                    'id' => $sem, // Gunakan semester sebagai ID
                    'label' => "Kelompok Besar Semester {$sem} ({$jumlahMahasiswa} mahasiswa)",
                    'jumlah_mahasiswa' => $jumlahMahasiswa
                ];
            }
        }

        return $kelompokBesarData;
    }

    private function getDosen($mataKuliah)
    {
        $allDosen = User::where('role', 'dosen')->get();

        // Filter dosen berdasarkan keahlian jika ada
        if ($mataKuliah->keahlian_required && !empty($mataKuliah->keahlian_required)) {
            $keahlianRequired = is_array($mataKuliah->keahlian_required)
                ? $mataKuliah->keahlian_required
                : explode(',', $mataKuliah->keahlian_required);

            $matchingDosen = $allDosen->filter(function ($dosen) use ($keahlianRequired) {
                $dosenKeahlian = is_array($dosen->keahlian)
                    ? $dosen->keahlian
                    : explode(',', $dosen->keahlian ?? '');

                return collect($keahlianRequired)->intersect($dosenKeahlian)->isNotEmpty();
            });

            return [
                'all' => $allDosen,
                'matching' => $matchingDosen->values()
            ];
        }

        return [
            'all' => $allDosen,
            'matching' => $allDosen
        ];
    }

    private function getRuangan()
    {
        return Ruangan::all();
    }

    /**
     * Format jam dari HH:MM:SS ke HH.MM untuk frontend compatibility
     */
    private function formatJamForFrontend($jam)
    {
        if (!$jam) return $jam;

        // Jika sudah format HH.MM, return as is
        if (preg_match('/^\d{2}\.\d{2}$/', $jam)) {
            return $jam;
        }

        // Jika format HH:MM:SS, konversi ke HH.MM
        if (preg_match('/^(\d{2}):(\d{2}):\d{2}$/', $jam, $matches)) {
            return $matches[1] . '.' . $matches[2];
        }

        // Jika format HH:MM, konversi ke HH.MM
        if (preg_match('/^(\d{2}):(\d{2})$/', $jam, $matches)) {
            return $matches[1] . '.' . $matches[2];
        }

        return $jam;
    }

    private function getJamOptions()
    {
        return [
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
    }
}
