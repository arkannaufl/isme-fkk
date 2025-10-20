<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Notification;
use App\Models\JadwalPBL;
use App\Models\JadwalKuliahBesar;
use App\Models\JadwalPraktikum;
use App\Models\JadwalJurnalReading;
use App\Models\JadwalCSR;
use App\Models\JadwalNonBlokNonCSR;
use App\Models\JadwalAgendaKhusus;
use App\Models\RiwayatKonfirmasiDosen;
use Illuminate\Support\Facades\DB;

class ResetSchedulesAndNotifications extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'reset:schedules-notifications {--confirm : Skip confirmation prompt}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reset all schedules and notifications data';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        if (!$this->option('confirm')) {
            if (!$this->confirm('Are you sure you want to reset all schedules and notifications? This action cannot be undone.')) {
                $this->info('Operation cancelled.');
                return;
            }
        }

        $this->info('🔄 Starting reset of all schedules and notifications...');
        $this->newLine();

        try {
            // Reset notifications
            $notificationsDeleted = Notification::count();
            Notification::query()->delete();
            $this->line("✅ Deleted {$notificationsDeleted} notifications");

            // Reset PBL schedules
            $pblDeleted = JadwalPBL::count();
            JadwalPBL::query()->delete();
            $this->line("✅ Deleted {$pblDeleted} PBL schedules");

            // Reset Kuliah Besar schedules
            $kuliahBesarDeleted = JadwalKuliahBesar::count();
            JadwalKuliahBesar::query()->delete();
            $this->line("✅ Deleted {$kuliahBesarDeleted} Kuliah Besar schedules");

            // Reset Praktikum schedules (delete from pivot table first)
            $pivotDeleted = DB::table('jadwal_praktikum_dosen')->count();
            DB::table('jadwal_praktikum_dosen')->delete();
            $this->line("✅ Deleted {$pivotDeleted} Praktikum pivot records");

            $praktikumDeleted = JadwalPraktikum::count();
            JadwalPraktikum::query()->delete();
            $this->line("✅ Deleted {$praktikumDeleted} Praktikum schedules");

            // Reset Jurnal Reading schedules
            $jurnalDeleted = JadwalJurnalReading::count();
            JadwalJurnalReading::query()->delete();
            $this->line("✅ Deleted {$jurnalDeleted} Jurnal Reading schedules");

            // Reset CSR schedules
            $csrDeleted = JadwalCSR::count();
            JadwalCSR::query()->delete();
            $this->line("✅ Deleted {$csrDeleted} CSR schedules");

            // Reset Non Blok Non CSR schedules
            $nonBlokDeleted = JadwalNonBlokNonCSR::count();
            JadwalNonBlokNonCSR::query()->delete();
            $this->line("✅ Deleted {$nonBlokDeleted} Non Blok Non CSR schedules");

            // Reset Agenda Khusus schedules
            $agendaDeleted = JadwalAgendaKhusus::count();
            JadwalAgendaKhusus::query()->delete();
            $this->line("✅ Deleted {$agendaDeleted} Agenda Khusus schedules");

            // Reset Riwayat Konfirmasi Dosen
            $riwayatDeleted = RiwayatKonfirmasiDosen::count();
            RiwayatKonfirmasiDosen::query()->delete();
            $this->line("✅ Deleted {$riwayatDeleted} Riwayat Konfirmasi Dosen records");

            $this->newLine();
            $this->info('🎉 All schedule and notification data has been reset successfully!');
            $this->info('📝 You can now test creating new schedules.');
        } catch (\Exception $e) {
            $this->error('❌ Error occurred: ' . $e->getMessage());
            $this->error('📍 File: ' . $e->getFile() . ' Line: ' . $e->getLine());
            return 1;
        }

        return 0;
    }
}
