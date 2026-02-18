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
     * Menghitung semester mahasiswa (Sederhana: cukup +1 dari semester saat ini)
     */
    public function calculateStudentSemester($student, $activeSemester = null)
    {
        $currentSemester = $student->semester ?? 1;
        return $currentSemester + 1;
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
                // PENTING: Mahasiswa Veteran tidak ikut naik semester regular
                if ($student->is_veteran) {
                    // Handle Pre-Veteran → Veteran Aktif
                    if ($student->veteran_status === 'pre_veteran') {
                        // Pre-veteran naik semester dan jadi veteran aktif
                        $oldSemesterNumber = $student->semester ?? 1;
                        $newSemesterNumber = $oldSemesterNumber + 1; // Naik 1 semester
                        
                        $student->update([
                            'semester' => $newSemesterNumber,
                            'veteran_status' => 'aktif', // Ubah status jadi veteran aktif
                            'veteran_semester_count' => 1 // Mulai count dari 1
                        ]);
                        $updatedCount++;
                        
                        // Log pre-veteran to veteran activation
                        activity()
                            ->performedOn($student)
                            ->withProperties([
                                'old_semester' => $oldSemesterNumber,
                                'new_semester' => $newSemesterNumber,
                                'old_status' => 'pre_veteran',
                                'new_status' => 'aktif'
                            ])
                            ->log("Pre-Veteran activation: {$oldSemesterNumber} → {$newSemesterNumber} (Veteran Aktif)");
                    }
                    // Handle Veteran Aktif (bukan pre-veteran)
                    elseif ($student->veteran_status === 'aktif') {
                        $oldSemesterNumber = $student->semester ?? 1;
                        $newSemesterNumber = $oldSemesterNumber + 1; // Veteran naik 1 semester
                        
                        $student->update(['semester' => $newSemesterNumber]);
                        $updatedCount++;
                        
                        // Log veteran semester progression
                        activity()
                            ->performedOn($student)
                            ->withProperties([
                                'old_semester' => $oldSemesterNumber,
                                'new_semester' => $newSemesterNumber,
                                'veteran_status' => 'aktif'
                            ])
                            ->log("Veteran semester progression: {$oldSemesterNumber} → {$newSemesterNumber}");
                    } else {
                        $updatedCount++; // Tetap dihitung sebagai ter-update (status-quo)
                    }
                    continue;
                }

                $oldSemesterNumber = $student->semester ?? 1;
                $newSemesterNumber = $this->calculateStudentSemester($student, $newSemester);

                // Pastikan semester tidak kurang dari 1 dan tidak lebih dari 7
                $finalSemesterNumber = max(1, min($newSemesterNumber, 7));
                
                // Jika semester baru melebihi 7, mahasiswa lulus
                if ($newSemesterNumber > 7) {
                    $student->update([
                        'semester' => $oldSemesterNumber, // Simpan semester saat lulus
                        'status' => 'lulus'
                    ]);
                    $graduatedCount++;
                    $graduatedStudents[] = $student;
                } else {
                    // Update semester
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
            ->where(function($query) {
                $query->whereNull('status')
                      ->orWhere('status', '!=', 'keluar');
            })
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
     * PENTING: Hanya update kelompok yang sesuai dengan semester aktif (semester_id)
     * Kelompok dari semester berbeda (Ganjil vs Genap) tidak akan diubah
     */
    private function updateStudentGroupings($oldSemester = null, $newSemester = null)
    {
        if (!$newSemester || !$oldSemester) return;

        // Ambil semua mahasiswa yang aktif
        $students = User::where('role', 'mahasiswa')
            ->whereNotIn('status', ['lulus', 'keluar'])
            ->get();

        $clonedKelompokBesar = 0;
        $clonedKelompokKecil = 0;

        foreach ($students as $student) {
            // Ambil data kelompok dari semester LAMA
            // Gunakan withoutSemesterFilter karena kita mencari data Histori (oldSemester)
            
            // 1. Clone Kelompok Besar
            $oldKelompokBesar = \App\Models\KelompokBesar::withoutSemesterFilter()
                ->where('mahasiswa_id', $student->id)
                ->where('semester_id', $oldSemester->id)
                ->first();
            
            if ($oldKelompokBesar) {
                // Gunakan updateOrCreate untuk menghindari Duplicate entry
                \App\Models\KelompokBesar::updateOrCreate(
                    [
                        'mahasiswa_id' => $student->id,
                        'semester_id' => $newSemester->id,
                    ],
                    [
                        'semester' => $student->semester // Update the level if it already exists
                    ]
                );
                $clonedKelompokBesar++;
            }

            // 2. Clone Kelompok Kecil
            $oldKelompokKecil = \App\Models\KelompokKecil::withoutSemesterFilter()
                ->where('mahasiswa_id', $student->id)
                ->where('semester_id', $oldSemester->id)
                ->first();
            
            if ($oldKelompokKecil) {
                // Gunakan updateOrCreate untuk menghindari Duplicate entry
                \App\Models\KelompokKecil::updateOrCreate(
                    [
                        'mahasiswa_id' => $student->id,
                        'semester_id' => $newSemester->id,
                    ],
                    [
                        'semester' => $student->semester,
                        'nama_kelompok' => $oldKelompokKecil->nama_kelompok,
                        'jumlah_kelompok' => $oldKelompokKecil->jumlah_kelompok
                    ]
                );
                $clonedKelompokKecil++;
            }
        }

        // Log aktivitas cloning pengelompokan
        activity()
            ->causedBy(Auth::user())
            ->withProperties([
                'old_semester' => $oldSemester ? "{$oldSemester->jenis} ({$oldSemester->tahunAjaran->tahun})" : 'N/A',
                'new_semester' => "{$newSemester->jenis} ({$newSemester->tahunAjaran->tahun})",
                'total_students' => $students->count(),
                'cloned_kelompok_besar' => $clonedKelompokBesar,
                'cloned_kelompok_kecil' => $clonedKelompokKecil
            ])
            ->log("Kelompok mahasiswa telah disalin (migrasi) dari semester lama ke semester baru.");
    }
}
