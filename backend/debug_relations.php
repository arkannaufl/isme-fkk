<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\JadwalPBL;

echo "=== DEBUG RELATIONS ===\n\n";

// Test PBL with relations
$jadwalPBL = JadwalPBL::with(['mataKuliah', 'ruangan', 'dosen'])
    ->where('status_konfirmasi', 'belum_konfirmasi')
    ->get();

echo "PBL jadwal count: " . $jadwalPBL->count() . "\n";

foreach ($jadwalPBL as $jadwal) {
    echo "Jadwal ID: {$jadwal->id}\n";
    echo "Dosen ID: {$jadwal->dosen_id}\n";
    echo "Dosen object: " . ($jadwal->dosen ? 'EXISTS' : 'NULL') . "\n";
    if ($jadwal->dosen) {
        echo "Dosen name: {$jadwal->dosen->name}\n";
        echo "Dosen email: {$jadwal->dosen->email}\n";
        echo "Dosen email_verified: {$jadwal->dosen->email_verified}\n";
    }
    echo "Mata Kuliah: " . ($jadwal->mataKuliah ? $jadwal->mataKuliah->nama : 'NULL') . "\n";
    echo "Ruangan: " . ($jadwal->ruangan ? $jadwal->ruangan->nama : 'NULL') . "\n";
    echo "---\n";
}

echo "\n=== DEBUG COMPLETED ===\n";
