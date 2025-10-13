<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\JadwalJurnalReading;
use App\Models\JadwalPBL;
use App\Models\JadwalCSR;
use App\Models\AbsensiJurnal;
use App\Models\AbsensiPBL;
use App\Models\AbsensiCSR;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MahasiswaKeabsenanController extends Controller
{
    /**
     * Get attendance data for a specific student
     */
    public function getKeabsenanMahasiswa($mahasiswaId)
    {
        try {
            // Get student data
            $mahasiswa = User::where('id', $mahasiswaId)
                ->where('role', 'mahasiswa')
                ->first();

            if (!$mahasiswa) {
                return response()->json(['message' => 'Mahasiswa tidak ditemukan'], 404);
            }

            // Get Jurnal Reading schedules for this student
            $jurnalSchedules = $this->getJurnalReadingSchedules($mahasiswa);

            // Get PBL schedules for this student
            $pblSchedules = $this->getPBLSchedules($mahasiswa);

            // Get CSR schedules for this student
            $csrSchedules = $this->getCSRSchedules($mahasiswa);

            // Combine and process attendance data
            $attendanceData = $this->processAttendanceData($jurnalSchedules, $pblSchedules, $csrSchedules, $mahasiswa);

            // Calculate statistics
            $stats = $this->calculateAttendanceStats($attendanceData);

            // Get kelompok data
            $kelompokKecil = DB::table('kelompok_kecil')
                ->where('mahasiswa_id', $mahasiswa->id)
                ->first();

            $kelompokBesar = DB::table('kelompok_besar')
                ->where('mahasiswa_id', $mahasiswa->id)
                ->first();

            return response()->json([
                'mahasiswa' => [
                    'id' => $mahasiswa->id,
                    'nama' => $mahasiswa->name,
                    'nid' => $mahasiswa->nim,
                    'email' => $mahasiswa->email,
                    'telp' => $mahasiswa->telp,
                    'username' => $mahasiswa->username,
                    'semester' => $mahasiswa->semester ?? 1,
                    'kelompok_kecil' => $kelompokKecil ? $kelompokKecil->nama_kelompok : null,
                    'kelompok_besar' => $kelompokBesar ? "Semester " . $kelompokBesar->semester : null,
                ],
                'statistik' => $stats,
                'detail_kehadiran' => $attendanceData
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal memuat data keabsenan: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get Jurnal Reading schedules for student
     */
    private function getJurnalReadingSchedules($mahasiswa)
    {
        // Get kelompok kecil for this mahasiswa
        $kelompokKecil = DB::table('kelompok_kecil')
            ->where('mahasiswa_id', $mahasiswa->id)
            ->first();

        if (!$kelompokKecil) {
            return [];
        }

        $schedules = JadwalJurnalReading::with(['mataKuliah', 'dosen', 'ruangan'])
            ->where('kelompok_kecil_id', $kelompokKecil->id)
            ->get();

        $result = [];
        foreach ($schedules as $schedule) {
            // Check if attendance is marked
            $attendance = AbsensiJurnal::where('jadwal_jurnal_reading_id', $schedule->id)
                ->where('mahasiswa_nim', $mahasiswa->nim)
                ->first();

            $status = 'waiting'; // Default status
            $alasan = null;

            if ($attendance) {
                if ($attendance->hadir) {
                    $status = 'hadir';
                } else {
                    $status = 'tidak_hadir';
                }
                // If there's a catatan, use it as alasan (regardless of hadir status)
                if ($attendance->catatan) {
                    $alasan = $attendance->catatan;
                }
            }

            $result[] = [
                'id' => $schedule->id,
                'tanggal' => $schedule->tanggal,
                'mata_kuliah' => $schedule->mataKuliah->nama ?? $schedule->mata_kuliah_kode,
                'jenis_jadwal' => 'jurnal_reading',
                'status' => $status,
                'alasan' => $alasan,
                'jam_mulai' => $schedule->jam_mulai,
                'jam_selesai' => $schedule->jam_selesai,
                'ruangan' => $schedule->ruangan->nama ?? 'Tidak ada',
                'dosen' => $schedule->dosen->name ?? 'Tidak ada',
                'topik' => $schedule->topik,
            ];
        }

        return $result;
    }

    /**
     * Get PBL schedules for student
     */
    private function getPBLSchedules($mahasiswa)
    {
        // Get kelompok kecil for this mahasiswa
        $kelompokKecil = DB::table('kelompok_kecil')
            ->where('mahasiswa_id', $mahasiswa->id)
            ->first();

        if (!$kelompokKecil) {
            return [];
        }

        $schedules = JadwalPBL::with(['mataKuliah', 'dosen', 'ruangan'])
            ->where('kelompok_kecil_id', $kelompokKecil->id)
            ->get();

        $result = [];
        foreach ($schedules as $schedule) {
            // Check if attendance is marked
            $attendance = AbsensiPBL::where('mata_kuliah_kode', $schedule->mata_kuliah_kode)
                ->where('kelompok', $schedule->kelompokKecil->nama_kelompok ?? '')
                ->where('pertemuan', $schedule->pbl_tipe)
                ->where('mahasiswa_npm', $mahasiswa->nim)
                ->first();

            $status = 'waiting'; // Default status
            $alasan = null;

            if ($attendance) {
                if ($attendance->hadir) {
                    $status = 'hadir';
                } else {
                    $status = 'tidak_hadir';
                }
                // If there's a catatan, use it as alasan (regardless of hadir status)
                if ($attendance->catatan) {
                    $alasan = $attendance->catatan;
                }
            }

            $result[] = [
                'id' => $schedule->id,
                'tanggal' => $schedule->tanggal,
                'mata_kuliah' => $schedule->mataKuliah->nama ?? $schedule->mata_kuliah_kode,
                'jenis_jadwal' => 'pbl',
                'jenis_detail' => $schedule->pbl_tipe === 'PBL1' ? 'PBL 1' : 'PBL 2',
                'status' => $status,
                'alasan' => $alasan,
                'jam_mulai' => $schedule->jam_mulai,
                'jam_selesai' => $schedule->jam_selesai,
                'ruangan' => $schedule->ruangan->nama ?? 'Tidak ada',
                'dosen' => $schedule->dosen->name ?? 'Tidak ada',
                'pbl_tipe' => $schedule->pbl_tipe,
            ];
        }

        return $result;
    }

    /**
     * Get CSR schedules for student
     */
    private function getCSRSchedules($mahasiswa)
    {
        // Get kelompok kecil for this mahasiswa
        $kelompokKecil = DB::table('kelompok_kecil')
            ->where('mahasiswa_id', $mahasiswa->id)
            ->first();

        if (!$kelompokKecil) {
            return [];
        }

        $schedules = JadwalCSR::with(['mataKuliah', 'dosen', 'ruangan', 'kategori'])
            ->where('kelompok_kecil_id', $kelompokKecil->id)
            ->get();

        $result = [];
        foreach ($schedules as $schedule) {
            // Check if attendance is marked
            $attendance = AbsensiCSR::where('jadwal_csr_id', $schedule->id)
                ->where('mahasiswa_npm', $mahasiswa->nim)
                ->first();

            $status = 'waiting'; // Default status
            $alasan = null;

            if ($attendance) {
                if ($attendance->hadir) {
                    $status = 'hadir';
                } else {
                    $status = 'tidak_hadir';
                }
                // If there's a catatan, use it as alasan (regardless of hadir status)
                if ($attendance->catatan) {
                    $alasan = $attendance->catatan;
                }
            }

            $result[] = [
                'id' => $schedule->id,
                'tanggal' => $schedule->tanggal,
                'mata_kuliah' => $schedule->mataKuliah->nama ?? $schedule->mata_kuliah_kode,
                'jenis_jadwal' => 'csr',
                'jenis_detail' => $schedule->jenis_csr === 'reguler' ? 'CSR Reguler' : 'CSR Responsi',
                'status' => $status,
                'alasan' => $alasan,
                'jam_mulai' => $schedule->jam_mulai,
                'jam_selesai' => $schedule->jam_selesai,
                'ruangan' => $schedule->ruangan->nama ?? 'Tidak ada',
                'dosen' => $schedule->dosen->name ?? 'Tidak ada',
                'topik' => $schedule->topik,
                'kategori' => $schedule->kategori->nama ?? 'Tidak ada',
            ];
        }

        return $result;
    }

    /**
     * Process and combine attendance data
     */
    private function processAttendanceData($jurnalSchedules, $pblSchedules, $csrSchedules, $mahasiswa)
    {
        $allSchedules = array_merge($jurnalSchedules, $pblSchedules, $csrSchedules);

        // Sort by date
        usort($allSchedules, function ($a, $b) {
            return strtotime($a['tanggal']) - strtotime($b['tanggal']);
        });

        return $allSchedules;
    }

    /**
     * Calculate attendance statistics
     */
    private function calculateAttendanceStats($attendanceData)
    {
        $totalSchedules = count($attendanceData);
        $hadir = 0;
        $tidakHadir = 0;
        $waiting = 0;

        foreach ($attendanceData as $attendance) {
            switch ($attendance['status']) {
                case 'hadir':
                    $hadir++;
                    break;
                case 'tidak_hadir':
                    $tidakHadir++;
                    break;
                case 'waiting':
                    $waiting++;
                    break;
            }
        }

        $persentase = $totalSchedules > 0 ? ($hadir / $totalSchedules) * 100 : 0;

        // Determine status kehadiran
        $statusKehadiran = 'baik';
        if ($persentase < 70) {
            $statusKehadiran = 'buruk';
        } elseif ($persentase < 85) {
            $statusKehadiran = 'kurang';
        }

        return [
            'total_kehadiran' => $hadir,
            'total_absensi' => $tidakHadir,
            'total_waiting' => $waiting,
            'total_schedules' => $totalSchedules,
            'persentase_kehadiran' => round($persentase, 1),
            'status_kehadiran' => $statusKehadiran,
        ];
    }
}
