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
                'kelompok_kecil' => $this->getKelompokKecil($mataKuliah->semester),
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
            ->with(['dosen', 'ruangan'])
            ->get()
            ->map(function ($jadwal) {
                if ($jadwal->jam_mulai) {
                    $jadwal->jam_mulai = $this->formatJamForFrontend($jadwal->jam_mulai);
                }
                if ($jadwal->jam_selesai) {
                    $jadwal->jam_selesai = $this->formatJamForFrontend($jadwal->jam_selesai);
                }
                return $jadwal;
            });
    }

    private function getJadwalAgendaKhusus($kode)
    {
        return JadwalAgendaKhusus::where('mata_kuliah_kode', $kode)
            ->with(['ruangan'])
            ->get()
            ->map(function ($jadwal) {
                if ($jadwal->jam_mulai) {
                    $jadwal->jam_mulai = $this->formatJamForFrontend($jadwal->jam_mulai);
                }
                if ($jadwal->jam_selesai) {
                    $jadwal->jam_selesai = $this->formatJamForFrontend($jadwal->jam_selesai);
                }
                return $jadwal;
            });
    }

    private function getJadwalPraktikum($kode)
    {
        return JadwalPraktikum::where('mata_kuliah_kode', $kode)
            ->with(['dosen', 'ruangan'])
            ->get()
            ->map(function ($jadwal) {
                if ($jadwal->jam_mulai) {
                    $jadwal->jam_mulai = $this->formatJamForFrontend($jadwal->jam_mulai);
                }
                if ($jadwal->jam_selesai) {
                    $jadwal->jam_selesai = $this->formatJamForFrontend($jadwal->jam_selesai);
                }
                return $jadwal;
            });
    }

    private function getJadwalJurnalReading($kode)
    {
        return JadwalJurnalReading::where('mata_kuliah_kode', $kode)
            ->with(['kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan'])
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
                
                return $jadwal;
            });
    }

    private function getModulPBL($kode)
    {
        return PBL::where('mata_kuliah_kode', $kode)->get();
    }

    private function getKelompokKecil($semester)
    {
        return KelompokKecil::where('semester', $semester)->get();
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
            '07.20', '08.10', '09.00', '09.50', '10.40', '11.30', '12.35', 
            '13.25', '14.15', '15.05', '15.35', '16.25', '17.15'
        ];
    }
}
