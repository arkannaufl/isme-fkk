<?php

namespace App\Http\Controllers;

use App\Models\JadwalAgendaKhusus;
use App\Models\MataKuliah;
use App\Models\Ruangan;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class JadwalAgendaKhususController extends Controller
{
    // List semua jadwal agenda khusus untuk satu mata kuliah blok
    public function index($kode)
    {
        $jadwal = JadwalAgendaKhusus::with(['mataKuliah', 'ruangan'])
            ->where('mata_kuliah_kode', $kode)
            ->orderBy('tanggal')
            ->orderBy('jam_mulai')
            ->get();
        return response()->json($jadwal);
    }

    // Tambah jadwal agenda khusus baru
    public function store(Request $request, $kode)
    {
        $data = $request->validate([
            'agenda' => 'required|string',
            'ruangan_id' => 'nullable|exists:ruangan,id',
            'kelompok_besar_id' => 'nullable|integer|min:1',
            'kelompok_besar_antara_id' => 'nullable|integer|min:1',
            'use_ruangan' => 'required|boolean',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
        ]);
        $data['mata_kuliah_kode'] = $kode;

        // Validasi kapasitas ruangan hanya jika menggunakan ruangan
        if ($data['use_ruangan'] && $data['ruangan_id']) {
            $kapasitasMessage = $this->validateRuanganCapacity($data);
            if ($kapasitasMessage) {
                return response()->json(['message' => $kapasitasMessage], 422);
            }
        }

        // Validasi bentrok
        $bentrokMessage = $this->checkBentrokWithDetail($data, null);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        $jadwal = JadwalAgendaKhusus::create($data);



        // Log activity


        activity()


            ->log('Jadwal Agenda Khusus deleted');



        // Log activity


        activity()


            ->log('Jadwal Agenda Khusus updated');



        // Log activity


        activity()


            ->log('Jadwal Agenda Khusus created');
        return response()->json($jadwal, Response::HTTP_CREATED);
    }

    // Update jadwal agenda khusus
    public function update(Request $request, $kode, $id)
    {
        $jadwal = JadwalAgendaKhusus::findOrFail($id);
        $data = $request->validate([
            'agenda' => 'required|string',
            'ruangan_id' => 'nullable|exists:ruangan,id',
            'kelompok_besar_id' => 'nullable|integer|min:1',
            'kelompok_besar_antara_id' => 'nullable|integer|min:1',
            'use_ruangan' => 'required|boolean',
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
        ]);
        $data['mata_kuliah_kode'] = $kode;

        // Validasi kapasitas ruangan hanya jika menggunakan ruangan
        if ($data['use_ruangan'] && $data['ruangan_id']) {
            $kapasitasMessage = $this->validateRuanganCapacity($data);
            if ($kapasitasMessage) {
                return response()->json(['message' => $kapasitasMessage], 422);
            }
        }

        // Validasi bentrok (kecuali dirinya sendiri)
        $bentrokMessage = $this->checkBentrokWithDetail($data, $id);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        $jadwal->update($data);


        // Log activity

        activity()

            ->log('Jadwal Agenda Khusus deleted');


        // Log activity

        activity()

            ->log('Jadwal Agenda Khusus updated');


        // Log activity

        activity()

            ->log('Jadwal Agenda Khusus created');
        return response()->json($jadwal);
    }

    // Hapus jadwal agenda khusus
    public function destroy($kode, $id)
    {
        $jadwal = JadwalAgendaKhusus::findOrFail($id);
        $jadwal->delete();


        // Log activity

        activity()

            ->log('Jadwal Agenda Khusus deleted');


        // Log activity

        activity()

            ->log('Jadwal Agenda Khusus updated');


        // Log activity

        activity()

            ->log('Jadwal Agenda Khusus created');
        return response()->json(['message' => 'Jadwal agenda khusus berhasil dihapus']);
    }

    // Cek bentrok antar jenis baris
    private function isBentrok($data, $ignoreId = null)
    {
        // Jika tidak menggunakan ruangan, tidak perlu cek bentrok
        if (!$data['use_ruangan']) {
            return false;
        }

        // Cek bentrok dengan jadwal Agenda Khusus
        $agendaKhususBentrok = JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                        ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        if ($ignoreId) {
            $agendaKhususBentrok->where('id', '!=', $ignoreId);
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

        // Cek bentrok dengan jadwal Praktikum
        $praktikumBentrok = \App\Models\JadwalPraktikum::where('tanggal', $data['tanggal'])
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

        // Cek bentrok dengan kelompok besar (jika ada kelompok_besar_id)
        $kelompokBesarBentrok = false;
        if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
            $kelompokBesarBentrok = $this->checkKelompokBesarBentrok($data, $ignoreId);
        }

        // Cek bentrok antar Kelompok Besar (Kelompok Besar vs Kelompok Besar)
        $kelompokBesarVsKelompokBesarBentrok = false;
        if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
            $kelompokBesarVsKelompokBesarBentrok = $this->checkKelompokBesarVsKelompokBesarBentrok($data, $ignoreId);
        }

        return $agendaKhususBentrok->exists() || $pblBentrok->exists() ||
               $kuliahBesarBentrok->exists() || $praktikumBentrok->exists() ||
               $jurnalBentrok->exists() || $kelompokBesarBentrok || $kelompokBesarVsKelompokBesarBentrok;
    }

    private function checkBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Jika tidak menggunakan ruangan, hanya cek bentrok berdasarkan kelompok
        if (!$data['use_ruangan']) {
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

            return null; // Tidak ada bentrok jika tidak menggunakan ruangan
        }

        // Cek bentrok dengan jadwal Agenda Khusus
        $agendaKhususBentrok = JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where(function ($q) use ($data) {
                $q->where('ruangan_id', $data['ruangan_id'])
                  ->orWhere(function($subQ) use ($data) {
                      // Cek bentrok berdasarkan kelompok yang sama
                      if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
                          $subQ->where('kelompok_besar_id', $data['kelompok_besar_id']);
                      }
                      if (isset($data['kelompok_besar_antara_id']) && $data['kelompok_besar_antara_id']) {
                          $subQ->where('kelompok_besar_antara_id', $data['kelompok_besar_antara_id']);
                      }
                  });
            })
            ->where(function ($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                        ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        if ($ignoreId) {
            $agendaKhususBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokAgendaKhusus = $agendaKhususBentrok->first();
        if ($jadwalBentrokAgendaKhusus) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokAgendaKhusus->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokAgendaKhusus->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $jadwalBentrokAgendaKhusus);
            return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " .
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
            ->where(function ($q) use ($data) {
                $q->where('ruangan_id', $data['ruangan_id'])
                  ->orWhere(function($subQ) use ($data) {
                      // Cek bentrok berdasarkan kelompok yang sama
                      if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
                          $subQ->where('kelompok_besar_id', $data['kelompok_besar_id']);
                      }
                      if (isset($data['kelompok_besar_antara_id']) && $data['kelompok_besar_antara_id']) {
                          $subQ->where('kelompok_besar_antara_id', $data['kelompok_besar_antara_id']);
                      }
                  });
            })
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
            $bentrokReason = $this->getBentrokReason($data, $praktikumBentrok);
            return "Jadwal bentrok dengan Jadwal Praktikum pada tanggal " .
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
    private function getBentrokReason($data, $jadwalBentrok): string
    {
        $reasons = [];

        // Cek bentrok ruangan
        if (isset($data['ruangan_id']) && isset($jadwalBentrok->ruangan_id) && $data['ruangan_id'] == $jadwalBentrok->ruangan_id) {
            $ruangan = \App\Models\Ruangan::find($data['ruangan_id']);
            $reasons[] = "Ruangan: " . ($ruangan ? $ruangan->nama : 'Tidak diketahui');
        }

        // Cek bentrok kelompok besar
        if (isset($data['kelompok_besar_id']) && isset($jadwalBentrok->kelompok_besar_id) && $data['kelompok_besar_id'] == $jadwalBentrok->kelompok_besar_id) {
            $reasons[] = "Kelompok Besar: Semester " . $data['kelompok_besar_id'];
        }

        // Cek bentrok kelompok besar antara
        if (isset($data['kelompok_besar_antara_id']) && isset($jadwalBentrok->kelompok_besar_antara_id) && $data['kelompok_besar_antara_id'] == $jadwalBentrok->kelompok_besar_antara_id) {
            $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($data['kelompok_besar_antara_id']);
            $reasons[] = "Kelompok Besar Antara: " . ($kelompokBesarAntara ? $kelompokBesarAntara->nama_kelompok : 'Tidak diketahui');
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
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecil', function($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->exists();

        // Cek bentrok dengan jadwal Jurnal Reading yang menggunakan kelompok kecil dari mahasiswa yang sama
        $jurnalBentrok = \App\Models\JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecil', function($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
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
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecil', function($q) use ($mahasiswaIds) {
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
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokKecil', function($q) use ($mahasiswaIds) {
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
     * Validasi kapasitas ruangan berdasarkan jumlah mahasiswa
     */
    private function validateRuanganCapacity($data)
    {
        // Jika tidak ada ruangan_id atau null, skip validasi kapasitas
        if (!isset($data['ruangan_id']) || $data['ruangan_id'] === null || $data['ruangan_id'] === 0) {
            return null; // Tidak ada validasi kapasitas jika tidak menggunakan ruangan
        }

        // Ambil data ruangan
        $ruangan = Ruangan::find($data['ruangan_id']);
        if (!$ruangan) {
            return 'Ruangan tidak ditemukan';
        }

        $totalPeserta = 0;

        // Jika ada kelompok besar yang dipilih, validasi kapasitas berdasarkan jumlah mahasiswa
        if (isset($data['kelompok_besar_id']) && $data['kelompok_besar_id']) {
            // Hitung jumlah mahasiswa di kelompok besar semester biasa
            $jumlahMahasiswa = \App\Models\KelompokBesar::where('semester', $data['kelompok_besar_id'])->count();
            $totalPeserta = $jumlahMahasiswa;
        }
        // Jika ada kelompok besar antara yang dipilih
        elseif (isset($data['kelompok_besar_antara_id']) && $data['kelompok_besar_antara_id']) {
            // Hitung jumlah mahasiswa di kelompok besar antara
            $kelompokAntara = \App\Models\KelompokBesarAntara::find($data['kelompok_besar_antara_id']);
            if ($kelompokAntara) {
                $totalPeserta = count($kelompokAntara->mahasiswa_ids ?? []);
            }
        } else {
            // Untuk Agenda Khusus tanpa kelompok besar, tidak perlu validasi kapasitas ketat
            // karena bisa jadi acara khusus dengan jumlah peserta yang bervariasi
            // Hanya pastikan ruangan memiliki kapasitas minimal 1 orang
            if ($ruangan->kapasitas < 1) {
                return "Ruangan {$ruangan->nama} tidak memiliki kapasitas yang valid.";
            }
            return null; // Kapasitas mencukupi
        }

        // Validasi kapasitas
        if ($totalPeserta > $ruangan->kapasitas) {
            return "Kapasitas ruangan {$ruangan->nama} ({$ruangan->kapasitas} orang) tidak mencukupi untuk {$totalPeserta} mahasiswa.";
        }

        return null; // Kapasitas mencukupi
    }

    /**
     * Import jadwal agenda khusus dari Excel
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
                'data.*.agenda' => 'required|string',
                'data.*.ruangan_id' => 'nullable|integer',
                'data.*.jumlah_sesi' => 'required|integer|min:1|max:6',
            ]);

            $excelData = $request->input('data');
            $successCount = 0;
            $errors = [];

            // Cek apakah mata kuliah ada
            $mataKuliah = MataKuliah::where('kode', $kode)->first();
            if (!$mataKuliah) {
                return response()->json(['message' => 'Mata kuliah tidak ditemukan'], 404);
            }

            // Validasi semua data terlebih dahulu (all or nothing approach)
            foreach ($excelData as $index => $data) {
                // Validasi ruangan_id jika diisi
                if (isset($data['ruangan_id']) && $data['ruangan_id'] !== null && $data['ruangan_id'] !== 0) {
                    $ruangan = \App\Models\Ruangan::find($data['ruangan_id']);
                    if (!$ruangan) {
                        $errors[] = "Baris " . ($index + 1) . ": Ruangan tidak ditemukan";
                    }
                }

                // Validasi tanggal dalam rentang mata kuliah
                $tanggalMessage = $this->validateTanggalMataKuliah($data, $mataKuliah);
                if ($tanggalMessage) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $tanggalMessage;
                }

                // Validasi kapasitas ruangan
                $kapasitasMessage = $this->validateRuanganCapacity($data);
                if ($kapasitasMessage) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $kapasitasMessage;
                }

                // Validasi bentrok
                $bentrokMessage = $this->checkBentrokWithDetail($data, null);
                if ($bentrokMessage) {
                    $errors[] = "Baris " . ($index + 1) . ": " . $bentrokMessage;
                }
            }

            // Jika ada error validasi, return error tanpa import apapun
            if (count($errors) > 0) {
                return response()->json([
                    'success' => 0,
                    'total' => count($excelData),
                    'errors' => $errors,
                    'message' => "Gagal mengimport data. Perbaiki error terlebih dahulu."
                ], 422);
            }

            // Jika tidak ada error, import semua data menggunakan database transaction
            \DB::beginTransaction();
            try {
                $importedData = [];
                foreach ($excelData as $index => $data) {
                    // Siapkan data untuk disimpan
                    $jadwalData = [
                        'mata_kuliah_kode' => $kode,
                        'tanggal' => $data['tanggal'],
                        'jam_mulai' => $data['jam_mulai'],
                        'jam_selesai' => $data['jam_selesai'],
                        'agenda' => $data['agenda'],
                        'ruangan_id' => ($data['ruangan_id'] && $data['ruangan_id'] !== 0) ? $data['ruangan_id'] : null,
                        'jumlah_sesi' => $data['jumlah_sesi'],
                        'kelompok_besar_id' => $data['kelompok_besar_id'] ?? null,
                        'kelompok_besar_antara_id' => $data['kelompok_besar_antara_id'] ?? null,
                        'use_ruangan' => $data['use_ruangan'] ?? true,
                    ];

                    // Simpan data
                    $jadwal = JadwalAgendaKhusus::create($jadwalData);
                    $importedData[] = $jadwal;

                    // Log activity
                    activity()
                        ->performedOn($jadwal)
                        ->withProperties([
                            'mata_kuliah_kode' => $kode,
                            'agenda' => $data['agenda'],
                            'tanggal' => $data['tanggal'],
                            'jam_mulai' => $data['jam_mulai'],
                            'jam_selesai' => $data['jam_selesai'],
                            'ruangan_id' => $data['ruangan_id'],
                            'jumlah_sesi' => $data['jumlah_sesi'],
                            'import_type' => 'excel'
                        ])
                        ->log('Jadwal agenda khusus diimport dari Excel');
                }

                \DB::commit();
            } catch (\Exception $e) {
                \DB::rollback();
                return response()->json([
                    'success' => 0,
                    'total' => count($excelData),
                    'errors' => ["Terjadi kesalahan saat menyimpan data: " . $e->getMessage()],
                    'message' => "Gagal mengimport data. Terjadi kesalahan saat menyimpan."
                ], 422);
            }

            // Jika ada error validasi, return status 422 dan tidak import data sama sekali (all-or-nothing)
            if (count($errors) > 0) {
                return response()->json([
                    'success' => 0, // Tidak ada data yang diimport jika ada error
                    'total' => count($excelData),
                    'errors' => $errors,
                    'message' => "Gagal mengimport data. Semua data harus valid untuk dapat diimport."
                ], 422);
            }

            // Jika tidak ada error, return status 200
            return response()->json([
                'success' => count($importedData),
                'total' => count($excelData),
                'errors' => $errors,
                'message' => "Berhasil mengimport " . count($importedData) . " dari " . count($excelData) . " jadwal agenda khusus"
            ]);

        } catch (\Exception $e) {
            \Log::error('Error importing jadwal agenda khusus: ' . $e->getMessage());
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengimport data: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Validasi tanggal dalam rentang mata kuliah
     */
    private function validateTanggalMataKuliah($data, $mataKuliah)
    {
        if (!$mataKuliah->tanggal_mulai || !$mataKuliah->tanggal_akhir) {
            return null; // Tidak ada validasi jika tanggal tidak di-set
        }

        $tanggalInput = new \DateTime($data['tanggal']);
        $tanggalMulai = new \DateTime($mataKuliah->tanggal_mulai);
        $tanggalAkhir = new \DateTime($mataKuliah->tanggal_akhir);

        if ($tanggalInput < $tanggalMulai || $tanggalInput > $tanggalAkhir) {
            return "Tanggal di luar rentang mata kuliah ({$mataKuliah->tanggal_mulai} s/d {$mataKuliah->tanggal_akhir})";
        }

        return null;
    }

    /**
     * Get kelompok besar options for agenda khusus
     */
    public function kelompokBesar(Request $request)
    {
        $semester = $request->query('semester');
        if (!$semester) {
            return response()->json(['message' => 'Parameter semester diperlukan'], 400);
        }

        // Jika semester antara, ambil dari kelompok_besar_antara
        if ($semester === 'Antara') {
            $kelompokBesarAntara = \App\Models\KelompokBesarAntara::orderBy('nama_kelompok')->get();

            return response()->json($kelompokBesarAntara->map(function($kelompok) {
                $mahasiswaCount = count($kelompok->mahasiswa_ids ?? []);
                return [
                    'id' => $kelompok->id,
                    'label' => "{$kelompok->nama_kelompok} ({$mahasiswaCount} mahasiswa)",
                    'jumlah_mahasiswa' => $mahasiswaCount
                ];
            }));
        }

        // Untuk semester biasa
        $jumlahMahasiswa = \App\Models\KelompokBesar::where('semester', $semester)->count();
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

    /**
     * Cek bentrok antar Kelompok Besar (Kelompok Besar vs Kelompok Besar)
     */
    private function checkKelompokBesarVsKelompokBesarBentrok($data, $ignoreId = null): bool
    {
        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan kelompok besar yang sama
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_id', $data['kelompok_besar_id'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan jadwal Agenda Khusus lain yang menggunakan kelompok besar yang sama
        $agendaKhususBentrok = JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_id', $data['kelompok_besar_id'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $agendaKhususBentrok->where('id', '!=', $ignoreId);
        }

        return $kuliahBesarBentrok->exists() || $agendaKhususBentrok->exists();
    }

    /**
     * Cek bentrok antar Kelompok Besar dengan detail
     */
    private function checkKelompokBesarVsKelompokBesarBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan kelompok besar yang sama
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_id', $data['kelompok_besar_id'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();

        if ($kuliahBesarBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $kuliahBesarBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $kuliahBesarBentrok->jam_selesai);
            $bentrokReason = "Kelompok Besar vs Kelompok Besar: Kelompok Besar Semester " . $data['kelompok_besar_id'];
            return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " .
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Agenda Khusus lain yang menggunakan kelompok besar yang sama
        $agendaKhususBentrok = JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_id', $data['kelompok_besar_id'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $agendaKhususBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokAgendaKhusus = $agendaKhususBentrok->first();
        if ($jadwalBentrokAgendaKhusus) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokAgendaKhusus->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokAgendaKhusus->jam_selesai);
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
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereExists(function($query) use ($mahasiswaIds) {
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
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereExists(function($query) use ($mahasiswaIds) {
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
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_antara_id', $data['kelompok_besar_antara_id'])
            ->where(function($q) use ($data) {
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

        // Cek bentrok dengan jadwal Agenda Khusus lain yang menggunakan kelompok besar antara yang sama
        $agendaKhususBentrok = JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('kelompok_besar_antara_id', $data['kelompok_besar_antara_id'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $agendaKhususBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokAgendaKhusus = $agendaKhususBentrok->first();
        if ($jadwalBentrokAgendaKhusus) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokAgendaKhusus->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokAgendaKhusus->jam_selesai);
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
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->whereNotNull('kelompok_besar_antara_id')
            ->where(function($q) use ($data) {
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
        $agendaKhususBentrok = JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->whereNotNull('kelompok_besar_antara_id')
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $agendaKhususBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokAgendaKhusus = $agendaKhususBentrok->first();
        if ($jadwalBentrokAgendaKhusus) {
            $kelompokBesarAntara = \App\Models\KelompokBesarAntara::find($jadwalBentrokAgendaKhusus->kelompok_besar_antara_id);
            if ($kelompokBesarAntara && !empty(array_intersect($mahasiswaIds, $kelompokBesarAntara->mahasiswa_ids))) {
                $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokAgendaKhusus->jam_mulai);
                $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokAgendaKhusus->jam_selesai);
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
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->whereNotNull('kelompok_besar_id')
            ->where(function($q) use ($data) {
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
        $agendaKhususBentrok = JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->whereNotNull('kelompok_besar_id')
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        if ($ignoreId) {
            $agendaKhususBentrok->where('id', '!=', $ignoreId);
        }

        $jadwalBentrokAgendaKhusus = $agendaKhususBentrok->first();
        if ($jadwalBentrokAgendaKhusus) {
            $kelompokBesarMahasiswaIds = \App\Models\KelompokBesar::where('semester', $jadwalBentrokAgendaKhusus->kelompok_besar_id)
                ->pluck('mahasiswa_id')
                ->toArray();

            if (!empty(array_intersect($mahasiswaIds, $kelompokBesarMahasiswaIds))) {
                $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokAgendaKhusus->jam_mulai);
                $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokAgendaKhusus->jam_selesai);
                $bentrokReason = "Kelompok Besar Antara vs Kelompok Besar: Kelompok Besar Semester " . $jadwalBentrokAgendaKhusus->kelompok_besar_id;
                return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " .
                       date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
                       $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
            }
        }

        return null;
    }
}
