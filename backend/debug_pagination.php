<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Http\Controllers\NotificationController;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

echo "=== DEBUG PAGINATION ===\n\n";

// Test the controller method directly
$controller = new \App\Http\Controllers\NotificationController();

// Create request and authenticate user
$request = new \Illuminate\Http\Request();
$user = User::where('role', 'super_admin')->first();
Auth::login($user);
$request->setUserResolver(function () use ($user) {
    return $user;
});

echo "1. Testing getPendingDosen without pagination:\n";
try {
    $response = $controller->getPendingDosen($request);
    $data = $response->getData(true);

    echo "Total: " . ($data['total'] ?? 0) . "\n";
    echo "Current page: " . ($data['current_page'] ?? 1) . "\n";
    echo "Per page: " . ($data['per_page'] ?? 5) . "\n";
    echo "Last page: " . ($data['last_page'] ?? 1) . "\n";
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

echo "\n2. Testing getPendingDosen with page_size=10:\n";
$request->merge(['page_size' => 10]);
try {
    $response = $controller->getPendingDosen($request);
    $data = $response->getData(true);

    echo "Total: " . ($data['total'] ?? 0) . "\n";
    echo "Current page: " . ($data['current_page'] ?? 1) . "\n";
    echo "Per page: " . ($data['per_page'] ?? 10) . "\n";
    echo "Last page: " . ($data['last_page'] ?? 1) . "\n";
    echo "Dosen count: " . count($data['pending_dosen'] ?? []) . "\n";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

echo "\n=== DEBUG COMPLETED ===\n";
