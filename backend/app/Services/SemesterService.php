<?php

namespace App\Services;

use App\Models\User;
use App\Models\Semester;
use App\Models\TahunAjaran;
use App\Models\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class SemesterService
{
    /**
     * Mendapatkan semester yang aktif saat ini
     */
    public function getActiveSemester()
    {
        return Semester::where('aktif', true)
            ->with('tahunAjaran')
            ->first();
    }

    /**
     * Mendapatkan tahun ajaran yang aktif saat ini
     */
    public function getActiveTahunAjaran()
    {
        return TahunAjaran::where('aktif', true)
            ->with(['semesters' => function($q) {
                $q->where('aktif', true);
            }])
            ->first();
    }

    /**
     * Menghitung semester mahasiswa berdasarkan tahun ajaran masuk dan semester aktif saat ini
     */
    public function calculateStudentSemester($student, $activeSemester = null)
    {
        // Jika mahasiswa belum punya data tahun ajaran masuk, gunakan semester yang ada
        if (!$student->tahun_ajaran_masuk_id || !$student->semester_masuk) {
            return $student->semester ?? 1;
        }

        // Jika tidak ada semester aktif, return semester yang ada
        if (!$activeSemester) {
            return $student->semester ?? 1;
        }

        // Ambil tahun ajaran masuk mahasiswa
        $tahunAjaranMasuk = TahunAjaran::find($student->tahun_ajaran_masuk_id);
        if (!$tahunAjaranMasuk) {
            return $student->semester ?? 1;
        }

        // Hitung selisih tahun ajaran
        $tahunMasuk = (int) explode('/', $tahunAjaranMasuk->tahun)[0];
        $tahunAktif = (int) explode('/', $activeSemester->tahunAjaran->tahun)[0];
        $selisihTahun = $tahunAktif - $tahunMasuk;

        // Hitung semester dasar berdasarkan semester masuk
        $semesterDasar = $student->semester_masuk === 'Ganjil' ? 1 : 2;

        // Hitung semester berdasarkan selisih tahun dan semester aktif
        $semesterHitung = $semesterDasar + ($selisihTahun * 2);

        // Jika tahun ajaran sama, hitung berdasarkan semester aktif
        if ($selisihTahun === 0) {
            if ($student->semester_masuk === 'Ganjil' && $activeSemester->jenis === 'Genap') {
                $semesterHitung = 2;
            } elseif ($student->semester_masuk === 'Genap' && $activeSemester->jenis === 'Ganjil') {
                $semesterHitung = 1;
            } else {
                $semesterHitung = $semesterDasar;
            }
        } else {
            // Jika berbeda tahun, hitung berdasarkan semester aktif
            if ($activeSemester->jenis === 'Ganjil') {
                $semesterHitung = $semesterDasar + ($selisihTahun * 2);
            } else {
                $semesterHitung = $semesterDasar + ($selisihTahun * 2) + 1;
            }
        }

        // Pastikan semester tidak melebihi 8 dan tidak kurang dari 1
        return max(1, min($semesterHitung, 8));
    }

    /**
     * Mengupdate semester semua mahasiswa berdasarkan tahun ajaran aktif
     */
    public function updateAllStudentSemesters($oldSemester = null, $newSemester = null)
    {
        return DB::transaction(function () use ($oldSemester, $newSemester) {
            // Ambil semua mahasiswa yang aktif (bukan lulus/keluar)
            $students = User::where('role', 'mahasiswa')
                ->whereNotIn('status', ['lulus', 'keluar'])
                ->get();

            $updatedCount = 0;
            $graduatedCount = 0;
            $graduatedStudents = [];

            foreach ($students as $student) {
                $oldSemesterNumber = $student->semester ?? 1;
                $newSemesterNumber = $this->calculateStudentSemester($student, $newSemester);

                // Pastikan semester tidak kurang dari 1 dan tidak lebih dari 8
                $finalSemesterNumber = max(1, min($newSemesterNumber, 8));
                
                // Jika semester baru melebihi 8, mahasiswa lulus
                if ($newSemesterNumber > 8) {
                    $student->update([
                        'semester' => 8,
                        'status' => 'lulus'
                    ]);
                    $graduatedCount++;
                    $graduatedStudents[] = $student;
                } else {
                    $student->update(['semester' => $finalSemesterNumber]);
                    $updatedCount++;
                }
            }

            // Buat notifikasi untuk semua user
            $this->createSemesterUpdateNotifications($updatedCount, $graduatedCount, $oldSemester, $newSemester);

            // Update pengelompokan mahasiswa jika diperlukan
            $this->updateStudentGroupings($oldSemester, $newSemester);

            // Log aktivitas
            $this->logSemesterUpdate($updatedCount, $graduatedCount, $oldSemester, $newSemester);

            return [
                'updated_count' => $updatedCount,
                'graduated_count' => $graduatedCount,
                'graduated_students' => $graduatedStudents
            ];
        });
    }

    /**
     * Mengupdate semester mahasiswa saat input data baru
     */
    public function updateNewStudentSemester($student)
    {
        $activeSemester = $this->getActiveSemester();
        
        // Set tahun ajaran masuk dan semester masuk
        if ($activeSemester) {
            $student->update([
                'tahun_ajaran_masuk_id' => $activeSemester->tahun_ajaran_id,
                'semester_masuk' => $activeSemester->jenis,
                'semester' => $activeSemester->jenis === 'Ganjil' ? 1 : 2
            ]);
        } else {
            // Jika tidak ada semester aktif, set default
            $student->update([
                'semester' => 1
            ]);
        }

        // Log aktivitas
        $semesterNumber = $student->semester;
        $tahunAjaranInfo = $activeSemester ? "{$activeSemester->jenis} ({$activeSemester->tahunAjaran->tahun})" : 'Tidak ada semester aktif';
        
        activity()
            ->causedBy(Auth::user())
            ->performedOn($student)
            ->withProperties([
                'old_semester' => null,
                'new_semester' => $semesterNumber,
                'tahun_ajaran_masuk' => $activeSemester ? $activeSemester->tahunAjaran->tahun : null,
                'semester_masuk' => $activeSemester ? $activeSemester->jenis : null,
                'active_semester' => $tahunAjaranInfo
            ])
            ->log("Mahasiswa {$student->name} (NIM: {$student->nim}) ditambahkan dengan semester {$semesterNumber} pada {$tahunAjaranInfo}");

        return $semesterNumber;
    }

    /**
     * Membuat notifikasi untuk semua role
     */
    private function createSemesterUpdateNotifications($updatedCount, $graduatedCount, $oldSemester, $newSemester)
    {
        // Ambil semua user yang perlu diberi notifikasi
        $users = User::whereIn('role', ['super_admin', 'tim_akademik', 'dosen', 'mahasiswa'])
            ->where('status', '!=', 'keluar')
            ->get();

        $oldSemesterInfo = $oldSemester ? "{$oldSemester->jenis} ({$oldSemester->tahunAjaran->tahun})" : 'Tidak ada semester aktif';
        $newSemesterInfo = $newSemester ? "{$newSemester->jenis} ({$newSemester->tahunAjaran->tahun})" : 'Tidak ada semester aktif';

        foreach ($users as $user) {
            $title = 'Pergantian Semester Akademik';
            $message = "Semester akademik telah berubah dari {$oldSemesterInfo} ke {$newSemesterInfo}. ";
            
            if ($updatedCount > 0) {
                $message .= "{$updatedCount} mahasiswa telah naik semester. ";
            }
            
            if ($graduatedCount > 0) {
                $message .= "{$graduatedCount} mahasiswa telah lulus.";
            }

            Notification::create([
                'user_id' => $user->id,
                'title' => $title,
                'message' => $message,
                'type' => 'info',
                'data' => [
                    'updated_count' => $updatedCount,
                    'graduated_count' => $graduatedCount,
                    'old_semester' => $oldSemesterInfo,
                    'new_semester' => $newSemesterInfo
                ]
            ]);
        }
    }

    /**
     * Log aktivitas pergantian semester
     */
    private function logSemesterUpdate($updatedCount, $graduatedCount, $oldSemester, $newSemester)
    {
        $oldSemesterInfo = $oldSemester ? "{$oldSemester->jenis} ({$oldSemester->tahunAjaran->tahun})" : 'Tidak ada semester aktif';
        $newSemesterInfo = $newSemester ? "{$newSemester->jenis} ({$newSemester->tahunAjaran->tahun})" : 'Tidak ada semester aktif';

        $description = "Pergantian semester dari {$oldSemesterInfo} ke {$newSemesterInfo}. ";
        $description .= "{$updatedCount} mahasiswa naik semester. ";
        
        if ($graduatedCount > 0) {
            $description .= "{$graduatedCount} mahasiswa lulus.";
        }

        activity()
            ->causedBy(Auth::user())
            ->withProperties([
                'updated_count' => $updatedCount,
                'graduated_count' => $graduatedCount,
                'old_semester' => $oldSemesterInfo,
                'new_semester' => $newSemesterInfo
            ])
            ->log($description);
    }

    /**
     * Update pengelompokan mahasiswa saat pergantian semester
     */
    private function updateStudentGroupings($oldSemester = null, $newSemester = null)
    {
        if (!$newSemester) return;

        // Ambil semua mahasiswa yang aktif
        $students = User::where('role', 'mahasiswa')
            ->whereNotIn('status', ['lulus', 'keluar'])
            ->get();

        foreach ($students as $student) {
            $newSemesterNumber = $this->calculateStudentSemester($student, $newSemester);
            
            // Pastikan semester tidak kurang dari 1 dan tidak lebih dari 8
            $finalSemesterNumber = max(1, min($newSemesterNumber, 8));
            
            // Update kelompok besar jika ada
            $kelompokBesar = \App\Models\KelompokBesar::where('mahasiswa_id', $student->id)->first();
            if ($kelompokBesar) {
                $kelompokBesar->update(['semester' => $finalSemesterNumber]);
            }

            // Update kelompok kecil jika ada
            $kelompokKecil = \App\Models\KelompokKecil::where('mahasiswa_id', $student->id)->first();
            if ($kelompokKecil) {
                $kelompokKecil->update(['semester' => $finalSemesterNumber]);
            }
        }

        // Log aktivitas update pengelompokan
        activity()
            ->causedBy(Auth::user())
            ->withProperties([
                'old_semester' => $oldSemester ? "{$oldSemester->jenis} ({$oldSemester->tahunAjaran->tahun})" : 'Tidak ada semester aktif',
                'new_semester' => "{$newSemester->jenis} ({$newSemester->tahunAjaran->tahun})",
                'updated_students' => $students->count()
            ])
            ->log("Pengelompokan mahasiswa telah diupdate untuk semester {$newSemester->jenis} ({$newSemester->tahunAjaran->tahun})");
    }
}
