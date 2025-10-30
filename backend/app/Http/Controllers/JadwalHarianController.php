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

    /**
     * Get today's schedule for a specific dosen
     */
    public function getTodayScheduleForDosen($dosenId)
    {
        try {
            $today = now()->format('Y-m-d');
            $todaySchedules = collect();

            // Get PBL schedules for today
            $pblSchedules = JadwalPBL::with(['mataKuliah', 'dosen', 'ruangan'])
                ->where('dosen_id', $dosenId)
                ->where('tanggal', $today)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'type' => 'pbl',
                        'mata_kuliah' => $item->mataKuliah->nama ?? 'N/A',
                        'dosen' => $item->dosen->name ?? 'N/A',
                        'ruangan' => $item->ruangan->nama ?? 'N/A',
                        'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai,
                        'topik' => $item->pbl_tipe ?? 'N/A',
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'status_reschedule' => $item->status_reschedule,
                        'semester_type' => $item->semester_type,
                    ];
                });
            $todaySchedules = $todaySchedules->concat($pblSchedules);

            // Get Kuliah Besar schedules for today
            $kuliahBesarSchedules = JadwalKuliahBesar::with(['mataKuliah', 'dosen', 'ruangan'])
                ->where('dosen_id', $dosenId)
                ->where('tanggal', $today)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'type' => 'kuliah_besar',
                        'mata_kuliah' => $item->mataKuliah->nama ?? 'N/A',
                        'dosen' => $item->dosen->name ?? 'N/A',
                        'ruangan' => $item->ruangan->nama ?? 'N/A',
                        'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai,
                        'topik' => $item->materi ?? $item->topik ?? 'N/A',
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'status_reschedule' => $item->status_reschedule,
                        'semester_type' => $item->semester_type,
                    ];
                });
            $todaySchedules = $todaySchedules->concat($kuliahBesarSchedules);

            // Get Praktikum schedules for today (check if dosen is assigned)
            $praktikumSchedules = JadwalPraktikum::with(['mataKuliah', 'ruangan', 'dosen'])
                ->where('tanggal', $today)
                ->get()
                ->filter(function ($item) use ($dosenId) {
                    // Check if dosen is in the dosen array
                    return $item->dosen && collect($item->dosen)->contains('id', $dosenId);
                })
                ->map(function ($item) use ($dosenId) {
                    $dosen = collect($item->dosen)->firstWhere('id', $dosenId);
                    return [
                        'id' => $item->id,
                        'type' => 'praktikum',
                        'mata_kuliah' => $item->mataKuliah->nama ?? 'N/A',
                        'dosen' => $dosen['name'] ?? 'N/A',
                        'ruangan' => $item->ruangan->nama ?? 'N/A',
                        'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai,
                        'topik' => $item->materi ?? 'N/A',
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'status_reschedule' => $item->status_reschedule,
                        'semester_type' => $item->semester_type,
                    ];
                });
            $todaySchedules = $todaySchedules->concat($praktikumSchedules);

            // Get Jurnal Reading schedules for today
            $jurnalSchedules = JadwalJurnalReading::with(['mataKuliah', 'dosen', 'ruangan'])
                ->where('dosen_id', $dosenId)
                ->where('tanggal', $today)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'type' => 'jurnal',
                        'mata_kuliah' => $item->mataKuliah->nama ?? 'N/A',
                        'dosen' => $item->dosen->name ?? 'N/A',
                        'ruangan' => $item->ruangan->nama ?? 'N/A',
                        'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai,
                        'topik' => $item->topik ?? 'N/A',
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'status_reschedule' => $item->status_reschedule,
                        'semester_type' => $item->semester_type,
                    ];
                });
            $todaySchedules = $todaySchedules->concat($jurnalSchedules);

            // Get CSR schedules for today
            $csrSchedules = JadwalCSR::with(['mataKuliah', 'dosen', 'ruangan'])
                ->where('dosen_id', $dosenId)
                ->where('tanggal', $today)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'type' => 'csr',
                        'mata_kuliah' => $item->mataKuliah->nama ?? 'N/A',
                        'dosen' => $item->dosen->name ?? 'N/A',
                        'ruangan' => $item->ruangan->nama ?? 'N/A',
                        'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai,
                        'topik' => $item->topik ?? 'N/A',
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'status_reschedule' => $item->status_reschedule,
                        'semester_type' => $item->semester_type,
                    ];
                });
            $todaySchedules = $todaySchedules->concat($csrSchedules);

            // Get Non Blok Non CSR schedules for today
            $nonBlokSchedules = JadwalNonBlokNonCSR::with(['mataKuliah', 'dosen', 'ruangan'])
                ->where('dosen_id', $dosenId)
                ->where('tanggal', $today)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'type' => 'non_blok_non_csr',
                        'mata_kuliah' => $item->mataKuliah->nama ?? 'N/A',
                        'dosen' => $item->dosen->name ?? 'N/A',
                        'ruangan' => $item->ruangan->nama ?? 'N/A',
                        'waktu' => $item->jam_mulai . ' - ' . $item->jam_selesai,
                        'topik' => $item->materi ?? $item->agenda ?? 'N/A',
                        'status_konfirmasi' => $item->status_konfirmasi,
                        'status_reschedule' => $item->status_reschedule,
                        'semester_type' => $item->semester_type,
                    ];
                });
            $todaySchedules = $todaySchedules->concat($nonBlokSchedules);

            // Sort by time - extract start time for sorting
            $sortedSchedules = $todaySchedules->sortBy(function ($item) {
                // Extract start time from "07.20 - 09.00" or "07:20 - 09:00"
                $timeString = str_replace('.', ':', $item['waktu']);
                $startTime = explode(' - ', $timeString)[0];
                return \Carbon\Carbon::createFromFormat('H:i', $startTime);
            })->values();

            return response()->json([
                'message' => 'Data jadwal hari ini berhasil diambil',
                'data' => $sortedSchedules
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengambil data jadwal hari ini',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
