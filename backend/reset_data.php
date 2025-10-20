<?php

/**
 * Reset Schedules and Notifications Script
 *
 * Usage: php reset_data.php
 */

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "🔄 Starting reset of schedules and notifications...\n\n";

try {
    // Disable foreign key checks
    DB::statement('SET FOREIGN_KEY_CHECKS=0');
    echo "✅ Foreign key checks disabled\n";

    // Reset notifications
    echo "🗑️  Clearing notifications...\n";
    DB::table('notifications')->delete();
    echo "   - Notifications cleared\n";

    // Reset jadwal tables
    echo "🗑️  Clearing jadwal tables...\n";

    // PBL
    DB::table('jadwal_pbl')->delete();
    echo "   - jadwal_pbl cleared\n";

    // Kuliah Besar
    DB::table('jadwal_kuliah_besar')->delete();
    echo "   - jadwal_kuliah_besar cleared\n";

    // Praktikum
    DB::table('jadwal_praktikum')->delete();
    echo "   - jadwal_praktikum cleared\n";

    // Praktikum Dosen
    DB::table('jadwal_praktikum_dosen')->delete();
    echo "   - jadwal_praktikum_dosen cleared\n";

    // Jurnal Reading
    DB::table('jadwal_jurnal_reading')->delete();
    echo "   - jadwal_jurnal_reading cleared\n";

    // CSR
    DB::table('jadwal_csr')->delete();
    echo "   - jadwal_csr cleared\n";

    // Non Blok Non CSR
    DB::table('jadwal_non_blok_non_csr')->delete();
    echo "   - jadwal_non_blok_non_csr cleared\n";

    // Agenda Khusus
    DB::table('jadwal_agenda_khusus')->delete();
    echo "   - jadwal_agenda_khusus cleared\n";

    // Riwayat Konfirmasi Dosen
    DB::table('riwayat_konfirmasi_dosen')->delete();
    echo "   - riwayat_konfirmasi_dosen cleared\n";

    // Re-enable foreign key checks
    DB::statement('SET FOREIGN_KEY_CHECKS=1');
    echo "✅ Foreign key checks re-enabled\n";

    echo "\n🎉 Reset completed successfully!\n";
    echo "📊 Summary:\n";
    echo "   - All notifications cleared\n";
    echo "   - All jadwal tables cleared\n";
    echo "   - All riwayat konfirmasi cleared\n";
    echo "\n✨ You can now test the updated praktikum notification system!\n";
} catch (Exception $e) {
    echo "❌ Error during reset: " . $e->getMessage() . "\n";
    echo "🔄 Re-enabling foreign key checks...\n";
    DB::statement('SET FOREIGN_KEY_CHECKS=1');
    exit(1);
}
