<?php

require_once 'vendor/autoload.php';

use Illuminate\Http\Request;
use App\Http\Controllers\UserController;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

try {
    echo "Testing getJadwalMengajar for dosen ID 177...\n";

    $semesterService = new \App\Services\SemesterService();
    $controller = new UserController($semesterService);
    $request = new Request();

    // Test without semester_type parameter
    $response = $controller->getJadwalMengajar(177, $request);
    $data = $response->getData();

    echo "Response status: " . $response->getStatusCode() . "\n";
    echo "Total jadwal: " . count($data) . "\n";

    foreach ($data as $jadwal) {
        echo "Jadwal ID: " . $jadwal->id . ", Jenis: " . $jadwal->jenis_jadwal . ", Tanggal: " . $jadwal->tanggal . "\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}
