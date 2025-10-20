<?php

require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use App\Models\User;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== TEST API WITH AUTH ===\n\n";

// Get super_admin user for authentication
$admin = User::where('role', 'super_admin')->first();
if (!$admin) {
    echo "❌ No super_admin user found\n";
    exit;
}

echo "Using admin: {$admin->name} ({$admin->email})\n\n";

// Create a test request with authentication
$request = new \Illuminate\Http\Request();
$request->setUserResolver(function () use ($admin) {
    return $admin;
});

// Test the controller directly
$controller = new \App\Http\Controllers\NotificationController();

try {
    echo "1. Testing getPendingDosen without filter:\n";
    $response = $controller->getPendingDosen($request);
    $data = $response->getData(true);

    echo "✅ Response received\n";
    echo "Total pending dosen: " . ($data['total'] ?? 0) . "\n";
    echo "Current page: " . ($data['current_page'] ?? 1) . "\n";
    echo "Per page: " . ($data['per_page'] ?? 5) . "\n";
    echo "Last page: " . ($data['last_page'] ?? 1) . "\n";
    echo "Dosen count: " . count($data['pending_dosen'] ?? []) . "\n\n";

    // Show dosen details
    if (!empty($data['pending_dosen'])) {
        echo "Dosen details:\n";
        foreach ($data['pending_dosen'] as $dosen) {
            echo "- {$dosen['name']} ({$dosen['email']}) - Email verified: {$dosen['email_verified']} - Type: {$dosen['jadwal_type']}\n";
        }
    }
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

echo "\n2. Testing getPendingDosen with semester=1 filter:\n";
$request->merge(['semester' => '1']);
try {
    $response = $controller->getPendingDosen($request);
    $data = $response->getData(true);

    echo "✅ Response received\n";
    echo "Total pending dosen (semester 1): " . ($data['total'] ?? 0) . "\n";
    echo "Dosen count: " . count($data['pending_dosen'] ?? []) . "\n\n";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

echo "\n3. Testing getPendingDosen with blok=1 filter:\n";
$request->merge(['blok' => '1']);
try {
    $response = $controller->getPendingDosen($request);
    $data = $response->getData(true);

    echo "✅ Response received\n";
    echo "Total pending dosen (blok 1): " . ($data['total'] ?? 0) . "\n";
    echo "Dosen count: " . count($data['pending_dosen'] ?? []) . "\n\n";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

echo "=== TEST COMPLETED ===\n";
