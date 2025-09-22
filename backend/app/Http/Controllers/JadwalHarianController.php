<?php

namespace App\Http\Controllers;

use App\Models\JadwalNonBlokNonCSR;
use App\Models\JadwalCSR;
use App\Models\JadwalPBL;
use App\Models\JadwalKuliahBesar;
use App\Models\JadwalPraktikum;
use App\Models\JadwalJurnalReading;
use App\Models\JadwalAgendaKhusus;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class JadwalHarianController extends Controller
{
    /**
     * Get all jadwal harian (combined from all schedule types)
     */
    public function index()
    {
        try {
            // Get all types of schedules
            $nonBlokNonCSR = JadwalNonBlokNonCSR::with(['mataKuliah', 'dosen', 'ruangan'])
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => $item->tanggal,
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => $item->jenis_baris,
                        'agenda' => $item->agenda,
                        'materi' => $item->materi,
                        'dosen_id' => $item->dosen_id,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => $item->kelompok_besar_id,
                        'kelompok_besar_antara_id' => $item->kelompok_besar_antara_id,
                        'use_ruangan' => $item->use_ruangan,
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => $item->dosen,
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'non_blok_non_csr'
                    ];
                });

            $csr = JadwalCSR::with(['mataKuliah', 'dosen', 'ruangan'])
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => $item->tanggal,
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => 'materi',
                        'agenda' => null,
                        'materi' => $item->topik,
                        'dosen_id' => $item->dosen_id,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => null,
                        'kelompok_besar_antara_id' => null,
                        'use_ruangan' => true,
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => $item->dosen,
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'csr'
                    ];
                });

            $pbl = JadwalPBL::with(['mataKuliah', 'dosen', 'ruangan'])
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => $item->tanggal,
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => 'materi',
                        'agenda' => null,
                        'materi' => $item->pbl_tipe,
                        'dosen_id' => $item->dosen_id,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => null,
                        'kelompok_besar_antara_id' => null,
                        'use_ruangan' => true,
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => $item->dosen,
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'pbl'
                    ];
                });

            $kuliahBesar = JadwalKuliahBesar::with(['mataKuliah', 'dosen', 'ruangan'])
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => $item->tanggal,
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => 'materi',
                        'agenda' => null,
                        'materi' => $item->materi,
                        'dosen_id' => $item->dosen_id,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => $item->kelompok_besar_id,
                        'kelompok_besar_antara_id' => $item->kelompok_besar_antara_id,
                        'use_ruangan' => true,
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => $item->dosen,
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'kuliah_besar'
                    ];
                });

            $praktikum = JadwalPraktikum::with(['mataKuliah', 'ruangan'])
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => $item->tanggal,
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => 'materi',
                        'agenda' => null,
                        'materi' => $item->materi,
                        'dosen_id' => null,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => null,
                        'kelompok_besar_antara_id' => null,
                        'use_ruangan' => true,
                        'status_konfirmasi' => 'belum_konfirmasi',
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => null,
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'praktikum'
                    ];
                });

            $jurnalReading = JadwalJurnalReading::with(['mataKuliah', 'dosen', 'ruangan'])
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => $item->tanggal,
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => 'materi',
                        'agenda' => null,
                        'materi' => $item->topik,
                        'dosen_id' => $item->dosen_id,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => null,
                        'kelompok_besar_antara_id' => null,
                        'use_ruangan' => true,
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => $item->dosen,
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'jurnal_reading'
                    ];
                });

            // Combine all schedules
            $allSchedules = collect()
                ->merge($nonBlokNonCSR)
                ->merge($csr)
                ->merge($pbl)
                ->merge($kuliahBesar)
                ->merge($praktikum)
                ->merge($jurnalReading)
                ->sortBy(['tanggal', 'jam_mulai'])
                ->values();

            return response()->json([
                'message' => 'Data jadwal harian berhasil diambil',
                'data' => $allSchedules
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengambil data jadwal harian',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get jadwal harian by mata kuliah
     */
    public function getByMataKuliah($kode)
    {
        try {
            $allSchedules = collect();
            
            // Handle CSR course codes (e.g., MKU001_CSR_1 -> MKU001)
            $actualKode = $kode;
            if (strpos($kode, '_CSR_') !== false) {
                $actualKode = explode('_CSR_', $kode)[0];
            }

            // Get JadwalNonBlokNonCSR
            $nonBlokNonCSR = JadwalNonBlokNonCSR::with(['mataKuliah', 'dosen', 'ruangan'])
                ->where('mata_kuliah_kode', $actualKode)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => is_string($item->tanggal) ? $item->tanggal : $item->tanggal->format('Y-m-d'),
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => $item->jenis_baris,
                        'agenda' => $item->agenda,
                        'materi' => $item->materi,
                        'dosen_id' => $item->dosen_id,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => $item->kelompok_besar_id,
                        'kelompok_besar_antara_id' => $item->kelompok_besar_antara_id,
                        'use_ruangan' => $item->use_ruangan,
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => $item->dosen,
                        'dosen_names' => $item->getDosenNamesAttribute(),
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'non_blok_non_csr',
                        'jenis_jadwal_display' => $item->jenis_baris === 'agenda' ? 'Agenda Khusus' : 'Non Blok Non CSR'
                    ];
                });
            $allSchedules = $allSchedules->concat($nonBlokNonCSR);

            // Get JadwalCSR
            $csr = JadwalCSR::with(['mataKuliah', 'dosen', 'ruangan'])
                ->where('mata_kuliah_kode', $actualKode)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => is_string($item->tanggal) ? $item->tanggal : $item->tanggal->format('Y-m-d'),
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => 'materi',
                        'agenda' => null,
                        'materi' => $item->topik,
                        'dosen_id' => $item->dosen_id,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => null,
                        'kelompok_besar_antara_id' => null,
                        'use_ruangan' => true,
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => $item->dosen,
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'csr',
                        'jenis_jadwal_display' => 'CSR ' . ucfirst($item->jenis_csr)
                    ];
                });
            $allSchedules = $allSchedules->concat($csr);

            // Get JadwalPBL
            $pbl = JadwalPBL::with(['mataKuliah', 'dosen', 'ruangan'])
                ->where('mata_kuliah_kode', $actualKode)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => is_string($item->tanggal) ? $item->tanggal : $item->tanggal->format('Y-m-d'),
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => 'materi',
                        'agenda' => null,
                        'materi' => $item->pbl_tipe,
                        'dosen_id' => $item->dosen_id,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => null,
                        'kelompok_besar_antara_id' => $item->kelompok_kecil_antara_id,
                        'use_ruangan' => true,
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => $item->dosen,
                        'dosen_names' => $item->getDosenNamesAttribute(),
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'pbl',
                        'jenis_jadwal_display' => 'PBL'
                    ];
                });
            $allSchedules = $allSchedules->concat($pbl);

            // Get JadwalKuliahBesar
            $kuliahBesar = JadwalKuliahBesar::with(['mataKuliah', 'dosen', 'ruangan'])
                ->where('mata_kuliah_kode', $actualKode)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => is_string($item->tanggal) ? $item->tanggal : $item->tanggal->format('Y-m-d'),
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => 'materi',
                        'agenda' => null,
                        'materi' => $item->materi ?: $item->topik,
                        'dosen_id' => $item->dosen_id,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => $item->kelompok_besar_id,
                        'kelompok_besar_antara_id' => $item->kelompok_besar_antara_id,
                        'use_ruangan' => true,
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => $item->dosen,
                        'dosen_names' => $item->getDosenNamesAttribute(),
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'kuliah_besar',
                        'jenis_jadwal_display' => 'Kuliah Besar'
                    ];
                });
            $allSchedules = $allSchedules->concat($kuliahBesar);

            // Get JadwalPraktikum
            $praktikum = JadwalPraktikum::with(['mataKuliah', 'ruangan'])
                ->where('mata_kuliah_kode', $actualKode)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => is_string($item->tanggal) ? $item->tanggal : $item->tanggal->format('Y-m-d'),
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => 'materi',
                        'agenda' => null,
                        'materi' => $item->materi,
                        'dosen_id' => null,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => null,
                        'kelompok_besar_antara_id' => null,
                        'use_ruangan' => true,
                        'status_konfirmasi' => 'belum_konfirmasi',
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => null,
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'praktikum',
                        'jenis_jadwal_display' => 'Praktikum'
                    ];
                });
            $allSchedules = $allSchedules->concat($praktikum);

            // Get JadwalJurnalReading
            $jurnalReading = JadwalJurnalReading::with(['mataKuliah', 'dosen', 'ruangan'])
                ->where('mata_kuliah_kode', $actualKode)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => is_string($item->tanggal) ? $item->tanggal : $item->tanggal->format('Y-m-d'),
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => 'materi',
                        'agenda' => null,
                        'materi' => $item->topik,
                        'dosen_id' => $item->dosen_id,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => null,
                        'kelompok_besar_antara_id' => null,
                        'use_ruangan' => true,
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => $item->dosen,
                        'dosen_names' => $item->getDosenNamesAttribute(),
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'jurnal_reading',
                        'jenis_jadwal_display' => 'Jurnal Reading'
                    ];
                });
            $allSchedules = $allSchedules->concat($jurnalReading);

            // Get JadwalAgendaKhusus
            $agendaKhusus = JadwalAgendaKhusus::with(['mataKuliah', 'ruangan'])
                ->where('mata_kuliah_kode', $actualKode)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'mata_kuliah_kode' => $item->mata_kuliah_kode,
                        'tanggal' => is_string($item->tanggal) ? $item->tanggal : $item->tanggal->format('Y-m-d'),
                        'jam_mulai' => $item->jam_mulai,
                        'jam_selesai' => $item->jam_selesai,
                        'jumlah_sesi' => $item->jumlah_sesi,
                        'jenis_baris' => 'agenda',
                        'agenda' => $item->agenda,
                        'materi' => null,
                        'dosen_id' => null,
                        'ruangan_id' => $item->ruangan_id,
                        'kelompok_besar_id' => $item->kelompok_besar_id,
                        'kelompok_besar_antara_id' => $item->kelompok_besar_antara_id,
                        'use_ruangan' => $item->use_ruangan,
                        'status_konfirmasi' => 'belum_konfirmasi',
                        'mata_kuliah' => $item->mataKuliah,
                        'dosen' => null,
                        'ruangan' => $item->ruangan,
                        'jenis_jadwal' => 'agenda_khusus',
                        'jenis_jadwal_display' => 'Agenda Khusus'
                    ];
                });
            $allSchedules = $allSchedules->concat($agendaKhusus);

            // Sort all schedules by date and time
            $sortedSchedules = $allSchedules->sortBy(function ($item) {
                return \Carbon\Carbon::parse($item['tanggal'] . ' ' . $item['jam_mulai']);
            })->values();

            // Debug logging
            \Log::info("Jadwal data for {$kode} (actual: {$actualKode}):", [
                'non_blok_non_csr' => $nonBlokNonCSR->count(),
                'csr' => $csr->count(),
                'pbl' => $pbl->count(),
                'kuliah_besar' => $kuliahBesar->count(),
                'praktikum' => $praktikum->count(),
                'jurnal_reading' => $jurnalReading->count(),
                'agenda_khusus' => $agendaKhusus->count(),
                'total' => $sortedSchedules->count()
            ]);

            return response()->json([
                'message' => 'Data jadwal harian berhasil diambil',
                'data' => $sortedSchedules,
                'debug' => [
                    'non_blok_non_csr' => $nonBlokNonCSR->count(),
                    'csr' => $csr->count(),
                    'pbl' => $pbl->count(),
                    'kuliah_besar' => $kuliahBesar->count(),
                    'praktikum' => $praktikum->count(),
                    'jurnal_reading' => $jurnalReading->count(),
                    'agenda_khusus' => $agendaKhusus->count(),
                    'total' => $sortedSchedules->count()
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengambil data jadwal harian',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
