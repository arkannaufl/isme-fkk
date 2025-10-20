<?php

require_once 'vendor/autoload.php';

use App\Models\User;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== Test Filter Keahlian ===\n\n";

try {
    // 1. Ambil semua dosen
    $allDosen = User::where('role', 'dosen')->get();
    echo "Total dosen: {$allDosen->count()}\n\n";

    // 2. Test filter dosen dengan "Kompetensi Dokter Umum"
    $dosenWithKompetensiDokterUmum = $allDosen->filter(function ($dosen) {
        $keahlian = json_decode($dosen->keahlian, true) ?: [];
        return in_array('Kompetensi Dokter Umum', $keahlian);
    });

    echo "Dosen dengan 'Kompetensi Dokter Umum': {$dosenWithKompetensiDokterUmum->count()}\n";

    // 3. Test filter dosen standby
    $dosenStandby = $allDosen->filter(function ($dosen) {
        $keahlian = json_decode($dosen->keahlian, true) ?: [];
        return in_array('standby', $keahlian);
    });

    echo "Dosen standby: {$dosenStandby->count()}\n";

    // 4. Test filter dosen dengan >2 keahlian (sistem lama)
    $dosenWithMoreThan2Keahlian = $allDosen->filter(function ($dosen) {
        $keahlian = json_decode($dosen->keahlian, true) ?: [];
        return count($keahlian) > 2;
    });

    echo "Dosen dengan >2 keahlian: {$dosenWithMoreThan2Keahlian->count()}\n";

    // 5. Test filter dosen dengan "Kompetensi Dokter Umum" + >2 keahlian (sistem lama)
    $dosenLama = $allDosen->filter(function ($dosen) {
        $keahlian = json_decode($dosen->keahlian, true) ?: [];
        $hasKompetensiDokterUmum = in_array('Kompetensi Dokter Umum', $keahlian);
        $hasMoreThan2Keahlian = count($keahlian) > 2;
        $isNotStandby = !in_array('standby', $keahlian);

        return $hasKompetensiDokterUmum && $hasMoreThan2Keahlian && $isNotStandby;
    });

    echo "Dosen sistem lama (>2 keahlian + Kompetensi Dokter Umum + bukan standby): {$dosenLama->count()}\n";

    // 6. Test filter dosen dengan "Kompetensi Dokter Umum" + keahlian spesifik (sistem baru)
    $keahlianSpesifik = ['Anatomi', 'Fisiologi', 'Biokimia', 'Infeksi', 'Imunologi', 'Mikrobiologi', 'Gastroenterologi', 'Endoskopi', 'Psikiatri', 'Konsultasi', 'Pengajaran'];

    $dosenBaru = $allDosen->filter(function ($dosen) use ($keahlianSpesifik) {
        $keahlian = json_decode($dosen->keahlian, true) ?: [];
        $hasKompetensiDokterUmum = in_array('Kompetensi Dokter Umum', $keahlian);
        $isNotStandby = !in_array('standby', $keahlian);
        $hasKeahlianSpesifik = !empty(array_intersect($keahlian, $keahlianSpesifik));

        return $hasKompetensiDokterUmum && $isNotStandby && $hasKeahlianSpesifik;
    });

    echo "Dosen sistem baru (Kompetensi Dokter Umum + keahlian spesifik + bukan standby): {$dosenBaru->count()}\n";

    // 7. Tampilkan contoh dosen dari setiap kategori
    echo "\n=== Contoh Dosen ===\n";

    echo "\nDosen dengan 'Kompetensi Dokter Umum':\n";
    $dosenWithKompetensiDokterUmum->take(3)->each(function ($dosen) {
        $keahlian = json_decode($dosen->keahlian, true) ?: [];
        echo "- {$dosen->name}: " . implode(', ', $keahlian) . "\n";
    });

    echo "\nDosen sistem lama:\n";
    $dosenLama->take(3)->each(function ($dosen) {
        $keahlian = json_decode($dosen->keahlian, true) ?: [];
        echo "- {$dosen->name}: " . implode(', ', $keahlian) . "\n";
    });

    echo "\nDosen sistem baru:\n";
    $dosenBaru->take(3)->each(function ($dosen) {
        $keahlian = json_decode($dosen->keahlian, true) ?: [];
        echo "- {$dosen->name}: " . implode(', ', $keahlian) . "\n";
    });

    echo "\n=== Selesai! ===\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n";
}
