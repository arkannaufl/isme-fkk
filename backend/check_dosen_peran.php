
<?php

require_once __DIR__ . '/vendor/autoload.php';

// Load Laravel environment
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\User;

echo "🔍 Checking Dosen Peran...\n\n";

// Cek dosen dengan dosen_peran
$dosenDenganPeran = User::where('role', 'dosen')
    ->whereNotNull('dosen_peran')
    ->get();

echo "📊 Dosen dengan dosen_peran: {$dosenDosenPeran->count()}\n\n";

foreach ($dosenDenganPeran as $dosen) {
    $peran = json_decode($dosen->dosen_peran, true);
    if (is_array($peran)) {
        echo "👤 {$dosen->name}:\n";
        foreach ($peran as $p) {
            $tipePeran = $p['tipe_peran'] ?? 'unknown';
            $semester = $p['semester'] ?? 'unknown';
            $mataKuliah = $p['mata_kuliah_nama'] ?? 'unknown';
            echo "  - {$tipePeran} (Semester {$semester}, {$mataKuliah})\n";
        }
        echo "\n";
    }
}

// Cek dosen yang akan difilter sebagai Koordinator/Tim Blok
$dosenAktif = User::where('role', 'dosen')
    ->get()
    ->filter(function ($dosen) {
        $keahlian = [];
        if (is_string($dosen->keahlian)) {
            $decoded = json_decode($dosen->keahlian, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $keahlian = $decoded;
            } else {
                $keahlian = explode(',', $dosen->keahlian);
            }
        } elseif (is_array($dosen->keahlian)) {
            $keahlian = $dosen->keahlian;
        }

        return !collect($keahlian)->some(function ($k) {
            return stripos(trim($k), 'standby') !== false;
        });
    });

$dosenYangAkanDifilter = $dosenAktif->filter(function ($dosen) {
    if (!$dosen->dosen_peran) return false;

    $peran = json_decode($dosen->dosen_peran, true);
    if (!is_array($peran)) return false;

    return collect($peran)->some(function ($p) {
        return in_array($p['tipe_peran'] ?? '', ['koordinator', 'tim_blok']);
    });
});

echo "📊 Dosen yang akan difilter (Koordinator/Tim Blok): {$dosenYangAkanDifilter->count()}\n";

$dosenTersedia = $dosenAktif->count() - $dosenYangAkanDifilter->count();
echo "📊 Dosen tersedia setelah filter: {$dosenTersedia}\n";

echo "\n✅ Check completed!\n";
