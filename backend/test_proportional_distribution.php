<?php

require_once 'vendor/autoload.php';

use App\Models\User;
use App\Models\MataKuliah;
use App\Models\KelompokKecil;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== Test Sistem Distribusi Proporsional ===\n\n";

try {
    // 1. Ambil data semester 1,3,5,7 di blok 1
    $targetSemesters = [1, 3, 5, 7];
    $blok = 1;

    echo "=== Data Semester ===\n";
    $semesterData = [];
    $totalNeeds = 0;

    foreach ($targetSemesters as $semester) {
        // Ambil mata kuliah
        $mataKuliah = MataKuliah::where('semester', $semester)
            ->where('blok', $blok)
            ->where('jenis', 'Blok')
            ->get();

        // Ambil kelompok kecil
        $kelompokKecil = KelompokKecil::where('semester', $semester)->get();
        $uniqueKelompok = $kelompokKecil->pluck('nama_kelompok')->unique();

        $modulCount = $mataKuliah->count();
        $kelompokCount = $uniqueKelompok->count();
        $dosenNeeded = $modulCount * $kelompokCount;

        $semesterData[$semester] = [
            'modul' => $modulCount,
            'kelompok' => $kelompokCount,
            'dosen_needed' => $dosenNeeded
        ];

        $totalNeeds += $dosenNeeded;

        echo "Semester {$semester}: {$modulCount} modul × {$kelompokCount} kelompok = {$dosenNeeded} dosen\n";
    }

    echo "\nTotal kebutuhan: {$totalNeeds} dosen\n\n";

    // 2. Ambil keahlian spesifik semester 1,3,5,7 di blok 1
    echo "=== Keahlian Spesifik ===\n";
    $keahlianSpesifik = [];

    foreach ($targetSemesters as $semester) {
        $mataKuliah = MataKuliah::where('semester', $semester)
            ->where('blok', $blok)
            ->where('jenis', 'Blok')
            ->get();

        foreach ($mataKuliah as $mk) {
            if ($mk->keahlian_required) {
                $keahlian = is_string($mk->keahlian_required)
                    ? json_decode($mk->keahlian_required, true)
                    : $mk->keahlian_required;

                if (is_array($keahlian)) {
                    foreach ($keahlian as $k) {
                        $keahlianSpesifik[] = $k;
                    }
                }
            }
        }
    }

    $keahlianSpesifik = array_unique($keahlianSpesifik);
    echo "Keahlian spesifik: " . implode(', ', $keahlianSpesifik) . "\n\n";

    // 3. Filter dosen dengan "Kompetensi Dokter Umum" + keahlian spesifik
    echo "=== Filter Dosen ===\n";
    $allDosen = User::where('role', 'dosen')->get();

    $dosenWithKompetensiDokterUmum = $allDosen->filter(function ($dosen) use ($keahlianSpesifik) {
        $keahlian = json_decode($dosen->keahlian, true) ?: [];

        // Kecualikan dosen standby
        if (in_array('standby', $keahlian)) {
            return false;
        }

        // Harus memiliki "Kompetensi Dokter Umum"
        if (!in_array('Kompetensi Dokter Umum', $keahlian)) {
            return false;
        }

        // Harus memiliki setidaknya satu keahlian spesifik
        $hasKeahlianSpesifik = !empty(array_intersect($keahlian, $keahlianSpesifik));

        return $hasKeahlianSpesifik;
    });

    $totalDosenAvailable = $dosenWithKompetensiDokterUmum->count();
    echo "Total dosen tersedia: {$totalDosenAvailable}\n\n";

    // 4. Hitung distribusi proporsional menggunakan Metode 2 (Distribusi Sisa)
    echo "=== Distribusi Proporsional ===\n";

    // Hitung persentase per semester
    $percentages = [];
    foreach ($targetSemesters as $semester) {
        $percentages[$semester] = ($semesterData[$semester]['dosen_needed'] / $totalNeeds) * 100;
    }

    // Hitung distribusi dasar (integer part)
    $baseDistribution = [];
    $fractions = [];

    foreach ($targetSemesters as $semester) {
        $exactDosen = ($percentages[$semester] / 100) * $totalDosenAvailable;
        $baseDistribution[$semester] = floor($exactDosen);
        $fractions[$semester] = $exactDosen - $baseDistribution[$semester];
    }

    // Hitung total yang sudah didistribusikan
    $totalDistributed = array_sum($baseDistribution);
    $remainingDosen = $totalDosenAvailable - $totalDistributed;

    // Urutkan berdasarkan fraction (terbesar dulu) untuk distribusi sisa
    $sortedSemesters = collect($fractions)
        ->map(function ($fraction, $semester) {
            return ['semester' => $semester, 'fraction' => $fraction];
        })
        ->sortByDesc('fraction')
        ->values();

    // Distribusikan sisa dosen
    $finalDistribution = $baseDistribution;
    for ($i = 0; $i < $remainingDosen; $i++) {
        $semester = $sortedSemesters[$i % $sortedSemesters->count()]['semester'];
        $finalDistribution[$semester]++;
    }

    // Tampilkan hasil
    foreach ($targetSemesters as $semester) {
        $needed = $semesterData[$semester]['dosen_needed'];
        $percentage = $percentages[$semester];
        $distributed = $finalDistribution[$semester];

        echo "Semester {$semester}:\n";
        echo "  - Kebutuhan: {$needed} dosen\n";
        echo "  - Persentase: " . number_format($percentage, 1) . "%\n";
        echo "  - Distribusi: {$distributed} dosen\n";
        echo "  - Selisih: " . ($distributed - $needed) . " dosen\n\n";
    }

    // 5. Hitung total distribusi
    $totalDistributed = array_sum($finalDistribution);
    echo "Total distribusi: {$totalDistributed} dosen\n";
    echo "Total tersedia: {$totalDosenAvailable} dosen\n";
    echo "Selisih: " . ($totalDistributed - $totalDosenAvailable) . " dosen\n\n";

    // 6. Tampilkan contoh dosen yang tersedia
    echo "=== Contoh Dosen Tersedia ===\n";
    $dosenWithKompetensiDokterUmum->take(5)->each(function ($dosen) {
        $keahlian = json_decode($dosen->keahlian, true) ?: [];
        echo "- {$dosen->name}: " . implode(', ', $keahlian) . "\n";
    });

    echo "\n=== Selesai! ===\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n";
}
