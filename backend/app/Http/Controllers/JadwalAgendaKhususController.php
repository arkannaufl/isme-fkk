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
        return response()->json($jadwal);
    }

    // Hapus jadwal agenda khusus
    public function destroy($kode, $id)
    {
        $jadwal = JadwalAgendaKhusus::findOrFail($id);
        $jadwal->delete();
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
        // Jika tidak menggunakan ruangan, tidak perlu cek bentrok
        if (!$data['use_ruangan']) {
            return null;
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
