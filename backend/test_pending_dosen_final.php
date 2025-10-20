<?php

require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\DB;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== TEST PENDING DOSEN FINAL ===\n\n";

// Test 1: Check database directly
echo "1. Checking database directly:\n";
$totalPBL = DB::table('jadwal_pbl')->where('status_konfirmasi', 'belum_konfirmasi')->count();
$totalJurnal = DB::table('jadwal_jurnal_reading')->where('status_konfirmasi', 'belum_konfirmasi')->count();
$totalKuliahBesar = DB::table('jadwal_kuliah_besar')->where('status_konfirmasi', 'belum_konfirmasi')->count();
$totalPraktikum = DB::table('jadwal_praktikum')->where('status_konfirmasi', 'belum_konfirmasi')->count();
$totalCSR = DB::table('jadwal_csr')->where('status_konfirmasi', 'belum_konfirmasi')->count();
$totalNonBlok = DB::table('jadwal_non_blok_non_csr')->where('status_konfirmasi', 'belum_konfirmasi')->count();

echo "PBL belum konfirmasi: $totalPBL\n";
echo "Jurnal Reading belum konfirmasi: $totalJurnal\n";
echo "Kuliah Besar belum konfirmasi: $totalKuliahBesar\n";
echo "Praktikum belum konfirmasi: $totalPraktikum\n";
echo "CSR belum konfirmasi: $totalCSR\n";
echo "Non Blok Non CSR belum konfirmasi: $totalNonBlok\n";

$totalAll = $totalPBL + $totalJurnal + $totalKuliahBesar + $totalPraktikum + $totalCSR + $totalNonBlok;
echo "Total semua jadwal belum konfirmasi: $totalAll\n\n";

// Test 2: Check specific semester and blok (FIXED)
echo "2. Checking semester 1 blok 1 (FIXED):\n";
$pblSem1Blok1 = DB::table('jadwal_pbl')
    ->join('mata_kuliah', 'jadwal_pbl.mata_kuliah_kode', '=', 'mata_kuliah.kode')
    ->where('jadwal_pbl.status_konfirmasi', 'belum_konfirmasi')
    ->where('mata_kuliah.semester', 1)
    ->where('mata_kuliah.blok', 1)  // FIXED: blok ada di mata_kuliah
    ->count();

$jurnalSem1Blok1 = DB::table('jadwal_jurnal_reading')
    ->join('mata_kuliah', 'jadwal_jurnal_reading.mata_kuliah_kode', '=', 'mata_kuliah.kode')
    ->where('jadwal_jurnal_reading.status_konfirmasi', 'belum_konfirmasi')
    ->where('mata_kuliah.semester', 1)
    ->where('mata_kuliah.blok', 1)  // FIXED: blok ada di mata_kuliah
    ->count();

echo "PBL semester 1 blok 1: $pblSem1Blok1\n";
echo "Jurnal Reading semester 1 blok 1: $jurnalSem1Blok1\n";
echo "Total semester 1 blok 1: " . ($pblSem1Blok1 + $jurnalSem1Blok1) . "\n\n";

// Test 3: Check dosen details
echo "3. Checking dosen details:\n";
$dosenPBL = DB::table('jadwal_pbl')
    ->join('mata_kuliah', 'jadwal_pbl.mata_kuliah_kode', '=', 'mata_kuliah.kode')
    ->join('users', 'jadwal_pbl.dosen_id', '=', 'users.id')
    ->where('jadwal_pbl.status_konfirmasi', 'belum_konfirmasi')
    ->where('mata_kuliah.semester', 1)
    ->where('mata_kuliah.blok', 1)
    ->select('users.name', 'users.email', 'users.email_verified', 'mata_kuliah.nama as mata_kuliah_nama')
    ->get();

echo "Dosen PBL semester 1 blok 1:\n";
foreach ($dosenPBL as $dosen) {
    echo "- {$dosen->name} ({$dosen->email}) - Email verified: {$dosen->email_verified} - MK: {$dosen->mata_kuliah_nama}\n";
}

$dosenJurnal = DB::table('jadwal_jurnal_reading')
    ->join('mata_kuliah', 'jadwal_jurnal_reading.mata_kuliah_kode', '=', 'mata_kuliah.kode')
    ->join('users', 'jadwal_jurnal_reading.dosen_id', '=', 'users.id')
    ->where('jadwal_jurnal_reading.status_konfirmasi', 'belum_konfirmasi')
    ->where('mata_kuliah.semester', 1)
    ->where('mata_kuliah.blok', 1)
    ->select('users.name', 'users.email', 'users.email_verified', 'mata_kuliah.nama as mata_kuliah_nama')
    ->get();

echo "\nDosen Jurnal Reading semester 1 blok 1:\n";
foreach ($dosenJurnal as $dosen) {
    echo "- {$dosen->name} ({$dosen->email}) - Email verified: {$dosen->email_verified} - MK: {$dosen->mata_kuliah_nama}\n";
}

echo "\n=== TEST COMPLETED ===\n";
