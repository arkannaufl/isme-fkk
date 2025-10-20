<?php

require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use App\Models\User;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== Menambahkan Kompetensi Dokter Umum ===\n\n";

try {
    // 1. Konstanta untuk "Kompetensi Dokter Umum"
    echo "1. Menyiapkan 'Kompetensi Dokter Umum'...\n";
    $kompetensiDokterUmum = 'Kompetensi Dokter Umum';
    echo "   - 'Kompetensi Dokter Umum' siap untuk ditambahkan ke semua dosen\n";

    // 2. Ambil semua dosen (termasuk yang sudah ada)
    echo "\n2. Mengambil semua dosen...\n";
    $allDosen = User::where('role', 'dosen')->get();
    echo "   - Ditemukan {$allDosen->count()} dosen\n";

    // 3. Tambahkan "Kompetensi Dokter Umum" ke semua dosen
    echo "\n3. Menambahkan 'Kompetensi Dokter Umum' ke semua dosen...\n";

    $updatedCount = 0;
    $skippedCount = 0;

    foreach ($allDosen as $dosen) {
        // Decode keahlian yang sudah ada
        $existingKeahlian = [];
        if ($dosen->keahlian) {
            if (is_string($dosen->keahlian)) {
                $existingKeahlian = json_decode($dosen->keahlian, true) ?: [];
            } elseif (is_array($dosen->keahlian)) {
                $existingKeahlian = $dosen->keahlian;
            }
        }

        // Cek apakah sudah punya "Kompetensi Dokter Umum"
        if (in_array($kompetensiDokterUmum, $existingKeahlian)) {
            $skippedCount++;
            continue;
        }

        // Tambahkan "Kompetensi Dokter Umum" ke daftar keahlian
        $existingKeahlian[] = $kompetensiDokterUmum;

        // Update dosen
        $dosen->update(['keahlian' => json_encode($existingKeahlian)]);
        $updatedCount++;
    }

    echo "   - {$updatedCount} dosen berhasil diupdate\n";
    echo "   - {$skippedCount} dosen sudah memiliki 'Kompetensi Dokter Umum'\n";

    // 4. Verifikasi hasil
    echo "\n4. Verifikasi hasil...\n";
    $dosenWithKompetensi = User::where('role', 'dosen')
        ->whereRaw("JSON_CONTAINS(keahlian, ?)", [json_encode($kompetensiDokterUmum)])
        ->count();

    echo "   - Total dosen dengan 'Kompetensi Dokter Umum': {$dosenWithKompetensi}\n";

    // 5. Tampilkan contoh dosen
    echo "\n5. Contoh dosen dengan keahlian:\n";
    $sampleDosen = User::where('role', 'dosen')
        ->whereRaw("JSON_CONTAINS(keahlian, ?)", [json_encode($kompetensiDokterUmum)])
        ->take(3)
        ->get();

    foreach ($sampleDosen as $dosen) {
        $keahlianList = json_decode($dosen->keahlian, true) ?: [];
        echo "   - {$dosen->name}: " . implode(', ', $keahlianList) . "\n";
    }

    echo "\n=== Selesai! ===\n";
    echo "Semua dosen sekarang memiliki 'Kompetensi Dokter Umum'\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n";
}
