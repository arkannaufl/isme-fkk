<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\User;

echo "=== DEBUG PENDING DOSEN ===\n\n";

// Check specific jadwal
echo "1. Checking specific jadwal:\n";

// PBL
$pblJadwal = DB::table('jadwal_pbl')
    ->join('mata_kuliah', 'jadwal_pbl.mata_kuliah_kode', '=', 'mata_kuliah.kode')
    ->join('users', 'jadwal_pbl.dosen_id', '=', 'users.id')
    ->where('jadwal_pbl.status_konfirmasi', 'belum_konfirmasi')
    ->select('jadwal_pbl.id', 'users.name', 'users.email', 'users.email_verified', 'mata_kuliah.nama as mata_kuliah_nama', 'mata_kuliah.semester', 'mata_kuliah.blok')
    ->get();

echo "PBL jadwal:\n";
foreach ($pblJadwal as $jadwal) {
    echo "- ID: {$jadwal->id}, Dosen: {$jadwal->name}, Email: {$jadwal->email}, Email verified: {$jadwal->email_verified}, MK: {$jadwal->mata_kuliah_nama}, Semester: {$jadwal->semester}, Blok: {$jadwal->blok}\n";
}

// Jurnal Reading
$jurnalJadwal = DB::table('jadwal_jurnal_reading')
    ->join('mata_kuliah', 'jadwal_jurnal_reading.mata_kuliah_kode', '=', 'mata_kuliah.kode')
    ->join('users', 'jadwal_jurnal_reading.dosen_id', '=', 'users.id')
    ->where('jadwal_jurnal_reading.status_konfirmasi', 'belum_konfirmasi')
    ->select('jadwal_jurnal_reading.id', 'users.name', 'users.email', 'users.email_verified', 'mata_kuliah.nama as mata_kuliah_nama', 'mata_kuliah.semester', 'mata_kuliah.blok')
    ->get();

echo "\nJurnal Reading jadwal:\n";
foreach ($jurnalJadwal as $jadwal) {
    echo "- ID: {$jadwal->id}, Dosen: {$jadwal->name}, Email: {$jadwal->email}, Email verified: {$jadwal->email_verified}, MK: {$jadwal->mata_kuliah_nama}, Semester: {$jadwal->semester}, Blok: {$jadwal->blok}\n";
}

echo "\n2. Testing controller method directly:\n";

// Test the controller method
$controller = new \App\Http\Controllers\NotificationController();

// Create request
$request = new \Illuminate\Http\Request();
$request->setUserResolver(function () {
    return User::where('role', 'super_admin')->first();
});

try {
    $response = $controller->getPendingDosen($request);
    $data = $response->getData(true);
    
    echo "Controller response:\n";
    echo "Total: " . ($data['total'] ?? 0) . "\n";
    echo "Dosen count: " . count($data['pending_dosen'] ?? []) . "\n";
    
    if (!empty($data['pending_dosen'])) {
        echo "Dosen details:\n";
        foreach ($data['pending_dosen'] as $dosen) {
            echo "- {$dosen['name']} ({$dosen['email']}) - Email verified: {$dosen['email_verified']} - Type: {$dosen['jadwal_type']}\n";
        }
    }
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}

echo "\n=== DEBUG COMPLETED ===\n";
