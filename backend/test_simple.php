<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== SIMPLE TEST ===\n\n";

// Check users
$users = DB::table('users')->select('id', 'name', 'email', 'role')->get();
echo "Users found: " . $users->count() . "\n";
foreach ($users as $user) {
    echo "- ID: {$user->id}, Name: {$user->name}, Email: {$user->email}, Role: {$user->role}\n";
}

echo "\n=== TEST COMPLETED ===\n";
