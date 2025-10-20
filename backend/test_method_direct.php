<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Http\Controllers\NotificationController;
use App\Models\User;

echo "=== TEST METHOD DIRECT ===\n\n";

// Test the method directly
$controller = new \App\Http\Controllers\NotificationController();

// Use reflection to access private method
$reflection = new ReflectionClass($controller);
$method = $reflection->getMethod('getPendingDosenForJadwalType');
$method->setAccessible(true);

echo "1. Testing getPendingDosenForJadwalType('pbl'):\n";
$result = $method->invoke($controller, 'pbl', null, null);
echo "Count: " . count($result) . "\n";
foreach ($result as $dosen) {
    echo "- {$dosen['name']} ({$dosen['email']}) - Email verified: {$dosen['email_verified']}\n";
}

echo "\n2. Testing getPendingDosenForJadwalType('jurnal_reading'):\n";
$result = $method->invoke($controller, 'jurnal_reading', null, null);
echo "Count: " . count($result) . "\n";
foreach ($result as $dosen) {
    echo "- {$dosen['name']} ({$dosen['email']}) - Email verified: {$dosen['email_verified']}\n";
}

echo "\n=== TEST COMPLETED ===\n";
