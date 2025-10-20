<?php

require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\DB;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== TEST PENDING DOSEN FIXED ===\n\n";

// Test 1: Get all pending dosen without filter
echo "1. Testing getPendingDosen without filter:\n";
$response = file_get_contents('http://localhost:8000/api/notifications/pending-dosen', false, stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => 'Content-Type: application/json',
        'timeout' => 30
    ]
]));

if ($response === false) {
    echo "❌ Failed to get response\n";
} else {
    $data = json_decode($response, true);
    echo "✅ Response received\n";
    echo "Total pending dosen: " . ($data['total'] ?? 0) . "\n";
    echo "Current page: " . ($data['current_page'] ?? 1) . "\n";
    echo "Per page: " . ($data['per_page'] ?? 5) . "\n";
    echo "Last page: " . ($data['last_page'] ?? 1) . "\n";
    echo "Dosen count: " . count($data['pending_dosen'] ?? []) . "\n\n";
}

// Test 2: Get pending dosen with semester filter
echo "2. Testing getPendingDosen with semester=1 filter:\n";
$response = file_get_contents('http://localhost:8000/api/notifications/pending-dosen?semester=1', false, stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => 'Content-Type: application/json',
        'timeout' => 30
    ]
]));

if ($response === false) {
    echo "❌ Failed to get response\n";
} else {
    $data = json_decode($response, true);
    echo "✅ Response received\n";
    echo "Total pending dosen (semester 1): " . ($data['total'] ?? 0) . "\n";
    echo "Dosen count: " . count($data['pending_dosen'] ?? []) . "\n\n";
}

// Test 3: Get pending dosen with blok filter
echo "3. Testing getPendingDosen with blok=1 filter:\n";
$response = file_get_contents('http://localhost:8000/api/notifications/pending-dosen?blok=1', false, stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => 'Content-Type: application/json',
        'timeout' => 30
    ]
]));

if ($response === false) {
    echo "❌ Failed to get response\n";
} else {
    $data = json_decode($response, true);
    echo "✅ Response received\n";
    echo "Total pending dosen (blok 1): " . ($data['total'] ?? 0) . "\n";
    echo "Dosen count: " . count($data['pending_dosen'] ?? []) . "\n\n";
}

// Test 4: Get pending dosen with pagination
echo "4. Testing getPendingDosen with pagination (page=1, page_size=2):\n";
$response = file_get_contents('http://localhost:8000/api/notifications/pending-dosen?page=1&page_size=2', false, stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => 'Content-Type: application/json',
        'timeout' => 30
    ]
]));

if ($response === false) {
    echo "❌ Failed to get response\n";
} else {
    $data = json_decode($response, true);
    echo "✅ Response received\n";
    echo "Total pending dosen: " . ($data['total'] ?? 0) . "\n";
    echo "Current page: " . ($data['current_page'] ?? 1) . "\n";
    echo "Per page: " . ($data['per_page'] ?? 2) . "\n";
    echo "Last page: " . ($data['last_page'] ?? 1) . "\n";
    echo "Dosen count: " . count($data['pending_dosen'] ?? []) . "\n\n";
}

// Test 5: Check database directly
echo "5. Checking database directly:\n";
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

echo "=== TEST COMPLETED ===\n";
