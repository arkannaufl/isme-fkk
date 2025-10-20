<?php

/**
 * Script untuk reset semua jadwal dan notifikasi
 *
 * Cara menjalankan:
 * php reset_schedules_and_notifications.php
 *
 * atau dari dalam Laravel:
 * php artisan tinker --execute="require 'reset_schedules_and_notifications.php';"
 */

echo "🔄 Starting reset of all schedules and notifications...\n\n";

try {
    // Reset notifications
    $notificationsDeleted = \App\Models\Notification::count();
    \App\Models\Notification::query()->delete();
    echo "✅ Deleted {$notificationsDeleted} notifications\n";

    // Reset PBL schedules
    $pblDeleted = \App\Models\JadwalPBL::count();
    \App\Models\JadwalPBL::query()->delete();
    echo "✅ Deleted {$pblDeleted} PBL schedules\n";

    // Reset Kuliah Besar schedules
    $kuliahBesarDeleted = \App\Models\JadwalKuliahBesar::count();
    \App\Models\JadwalKuliahBesar::query()->delete();
    echo "✅ Deleted {$kuliahBesarDeleted} Kuliah Besar schedules\n";

    // Reset Praktikum schedules (delete from pivot table first)
    $pivotDeleted = \DB::table('jadwal_praktikum_dosen')->count();
    \DB::table('jadwal_praktikum_dosen')->delete();
    echo "✅ Deleted {$pivotDeleted} Praktikum pivot records\n";

    $praktikumDeleted = \App\Models\JadwalPraktikum::count();
    \App\Models\JadwalPraktikum::query()->delete();
    echo "✅ Deleted {$praktikumDeleted} Praktikum schedules\n";

    // Reset Jurnal Reading schedules
    $jurnalDeleted = \App\Models\JadwalJurnalReading::count();
    \App\Models\JadwalJurnalReading::query()->delete();
    echo "✅ Deleted {$jurnalDeleted} Jurnal Reading schedules\n";

    // Reset CSR schedules
    $csrDeleted = \App\Models\JadwalCSR::count();
    \App\Models\JadwalCSR::query()->delete();
    echo "✅ Deleted {$csrDeleted} CSR schedules\n";

    // Reset Non Blok Non CSR schedules
    $nonBlokDeleted = \App\Models\JadwalNonBlokNonCSR::count();
    \App\Models\JadwalNonBlokNonCSR::query()->delete();
    echo "✅ Deleted {$nonBlokDeleted} Non Blok Non CSR schedules\n";

    // Reset Agenda Khusus schedules
    $agendaDeleted = \App\Models\JadwalAgendaKhusus::count();
    \App\Models\JadwalAgendaKhusus::query()->delete();
    echo "✅ Deleted {$agendaDeleted} Agenda Khusus schedules\n";

    // Reset Riwayat Konfirmasi Dosen
    $riwayatDeleted = \App\Models\RiwayatKonfirmasiDosen::count();
    \App\Models\RiwayatKonfirmasiDosen::query()->delete();
    echo "✅ Deleted {$riwayatDeleted} Riwayat Konfirmasi Dosen records\n";

    echo "\n🎉 All schedule and notification data has been reset successfully!\n";
    echo "📝 You can now test creating new schedules.\n";
} catch (Exception $e) {
    echo "\n❌ Error occurred: " . $e->getMessage() . "\n";
    echo "📍 File: " . $e->getFile() . " Line: " . $e->getLine() . "\n";
}

echo "\n";
