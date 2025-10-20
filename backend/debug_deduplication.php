<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Http\Controllers\NotificationController;
use App\Models\User;

echo "=== DEBUG DEDUPLICATION ===\n\n";

// Test the method directly
$controller = new \App\Http\Controllers\NotificationController();

// Use reflection to access private method
$reflection = new ReflectionClass($controller);
$method = $reflection->getMethod('getPendingDosenForJadwalType');
$method->setAccessible(true);

echo "1. Testing all jadwal types:\n";
$allDosen = [];

$jadwalTypes = ['pbl', 'kuliah_besar', 'praktikum', 'jurnal_reading', 'csr', 'non_blok_non_csr'];

foreach ($jadwalTypes as $type) {
    $result = $method->invoke($controller, $type, null, null);
    echo "$type: " . count($result) . " dosen\n";
    $allDosen = array_merge($allDosen, $result);
}

echo "\nTotal before deduplication: " . count($allDosen) . "\n";

// Test deduplication
$uniqueDosen = [];
$seenIds = [];
foreach ($allDosen as $dosen) {
    if (!in_array($dosen['dosen_id'], $seenIds)) {
        $uniqueDosen[] = $dosen;
        $seenIds[] = $dosen['dosen_id'];
    }
}

echo "Total after deduplication: " . count($uniqueDosen) . "\n";

echo "\nDosen details:\n";
foreach ($uniqueDosen as $dosen) {
    echo "- {$dosen['name']} ({$dosen['email']}) - Email verified: {$dosen['email_verified']} - Type: {$dosen['jadwal_type']}\n";
}

echo "\n=== DEBUG COMPLETED ===\n";
