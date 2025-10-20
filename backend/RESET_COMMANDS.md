# Reset Commands Documentation

## Cara Reset Jadwal dan Notifikasi

### 1. Menggunakan Artisan Command (Recommended)

```bash
# Dengan konfirmasi
php artisan reset:schedules-notifications

# Tanpa konfirmasi (auto-confirm)
php artisan reset:schedules-notifications --confirm
```

### 2. Menggunakan PHP Script

```bash
# Dari direktori backend



# Atau dari Laravel tinker
php artisan tinker --execute="require 'reset_schedules_and_notifications.php';"
```

### 3. Menggunakan Tinker (Manual)

```bash
php artisan tinker
```

Kemudian paste kode berikut:

```php
echo 'Resetting all schedule and notification data...' . PHP_EOL;

// Reset notifications
$notificationsDeleted = \App\Models\Notification::count();
\App\Models\Notification::query()->delete();
echo 'Deleted ' . $notificationsDeleted . ' notifications' . PHP_EOL;

// Reset PBL schedules
$pblDeleted = \App\Models\JadwalPBL::count();
\App\Models\JadwalPBL::query()->delete();
echo 'Deleted ' . $pblDeleted . ' PBL schedules' . PHP_EOL;

// Reset Kuliah Besar schedules
$kuliahBesarDeleted = \App\Models\JadwalKuliahBesar::count();
\App\Models\JadwalKuliahBesar::query()->delete();
echo 'Deleted ' . $kuliahBesarDeleted . ' Kuliah Besar schedules' . PHP_EOL;

// Reset Praktikum schedules (delete from pivot table first)
$pivotDeleted = \DB::table('jadwal_praktikum_dosen')->count();
\DB::table('jadwal_praktikum_dosen')->delete();
echo 'Deleted ' . $pivotDeleted . ' Praktikum pivot records' . PHP_EOL;

$praktikumDeleted = \App\Models\JadwalPraktikum::count();
\App\Models\JadwalPraktikum::query()->delete();
echo 'Deleted ' . $praktikumDeleted . ' Praktikum schedules' . PHP_EOL;

// Reset Jurnal Reading schedules
$jurnalDeleted = \App\Models\JadwalJurnalReading::count();
\App\Models\JadwalJurnalReading::count();
\App\Models\JadwalJurnalReading::query()->delete();
echo 'Deleted ' . $jurnalDeleted . ' Jurnal Reading schedules' . PHP_EOL;

// Reset CSR schedules
$csrDeleted = \App\Models\JadwalCSR::count();
\App\Models\JadwalCSR::query()->delete();
echo 'Deleted ' . $csrDeleted . ' CSR schedules' . PHP_EOL;

// Reset Non Blok Non CSR schedules
$nonBlokDeleted = \App\Models\JadwalNonBlokNonCSR::count();
\App\Models\JadwalNonBlokNonCSR::query()->delete();
echo 'Deleted ' . $nonBlokDeleted . ' Non Blok Non CSR schedules' . PHP_EOL;

// Reset Agenda Khusus schedules
$agendaDeleted = \App\Models\JadwalAgendaKhusus::count();
\App\Models\JadwalAgendaKhusus::query()->delete();
echo 'Deleted ' . $agendaDeleted . ' Agenda Khusus schedules' . PHP_EOL;

// Reset Riwayat Konfirmasi Dosen
$riwayatDeleted = \App\Models\RiwayatKonfirmasiDosen::count();
\App\Models\RiwayatKonfirmasiDosen::query()->delete();
echo 'Deleted ' . $riwayatDeleted . ' Riwayat Konfirmasi Dosen records' . PHP_EOL;

echo PHP_EOL . 'All schedule and notification data has been reset successfully!' . PHP_EOL;
echo 'You can now test creating new schedules.' . PHP_EOL;
```

## Yang Direset

Script ini akan menghapus data dari tabel berikut:

-   ✅ `notifications` - Semua notifikasi
-   ✅ `jadwal_pbl` - Jadwal PBL
-   ✅ `jadwal_kuliah_besar` - Jadwal Kuliah Besar
-   ✅ `jadwal_praktikum` - Jadwal Praktikum
-   ✅ `jadwal_praktikum_dosen` - Pivot table Praktikum-Dosen
-   ✅ `jadwal_jurnal_reading` - Jadwal Jurnal Reading
-   ✅ `jadwal_csr` - Jadwal CSR
-   ✅ `jadwal_non_blok_non_csr` - Jadwal Non Blok Non CSR
-   ✅ `jadwal_agenda_khusus` - Jadwal Agenda Khusus
-   ✅ `riwayat_konfirmasi_dosen` - Riwayat Konfirmasi Dosen

## Catatan Penting

⚠️ **PERINGATAN**: Script ini akan menghapus SEMUA data jadwal dan notifikasi. Pastikan Anda sudah backup data penting sebelum menjalankan script ini.

✅ **AMAN**: Script ini TIDAK menghapus data user, mata kuliah, ruangan, atau data master lainnya.
