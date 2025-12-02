<?php

namespace App\Traits;

use App\Http\Controllers\WhatsAppController;
use App\Models\User;
use Illuminate\Support\Facades\Log;

trait SendsWhatsAppNotification
{
    /**
     * Kirim notifikasi WhatsApp ke dosen
     * 
     * @param User $dosen
     * @param string $message
     * @param array $metadata
     * @return void
     */
    protected function sendWhatsAppNotification(User $dosen, string $message, array $metadata = []): void
    {
        // Cek apakah dosen punya nomor telepon
        if (empty($dosen->telp)) {
            Log::info("Dosen {$dosen->name} (ID: {$dosen->id}) tidak memiliki nomor telepon, skip WhatsApp notification");
            return;
        }

        try {
            $whatsappController = app(WhatsAppController::class);
            $result = $whatsappController->sendScheduleNotification(
                $dosen->telp,
                $message,
                $metadata
            );

            if ($result && $result['success']) {
                Log::info("WhatsApp notifikasi berhasil dikirim ke dosen {$dosen->name} ({$dosen->telp})");
            } else {
                Log::warning("WhatsApp notifikasi gagal dikirim ke dosen {$dosen->name} ({$dosen->telp}): " . ($result['error'] ?? 'Unknown error'));
            }
        } catch (\Exception $e) {
            Log::error("Exception saat kirim WhatsApp ke dosen {$dosen->name}: " . $e->getMessage());
        }
    }

    /**
     * Format pesan WhatsApp untuk jadwal
     * 
     * @param string $type Tipe jadwal (praktikum, csr, pbl, dll)
     * @param array $jadwalData Data jadwal
     * @return string
     */
    protected function formatScheduleMessage(string $type, array $jadwalData): string
    {
        $typeLabels = [
            'praktikum' => 'Praktikum',
            'csr' => 'CSR',
            'pbl' => 'PBL',
            'kuliah_besar' => 'Kuliah Besar',
            'jurnal_reading' => 'Jurnal Reading',
            'non_blok_non_csr' => 'Non Blok Non CSR',
            'agenda_khusus' => 'Agenda Khusus',
        ];

        $label = $typeLabels[$type] ?? ucfirst($type);
        $mataKuliah = $jadwalData['mata_kuliah_nama'] ?? 'Mata Kuliah';
        $tanggal = $jadwalData['tanggal'] ?? '';
        $jamMulai = str_replace(':', '.', $jadwalData['jam_mulai'] ?? '');
        $jamSelesai = str_replace(':', '.', $jadwalData['jam_selesai'] ?? '');
        $ruangan = $jadwalData['ruangan'] ?? '';

        $message = "📅 *Jadwal {$label} Baru*\n\n";
        $message .= "Mata Kuliah: {$mataKuliah}\n";
        $message .= "Tanggal: " . date('d/m/Y', strtotime($tanggal)) . "\n";
        $message .= "Waktu: {$jamMulai} - {$jamSelesai}\n";
        
        if ($ruangan) {
            $message .= "Ruangan: {$ruangan}\n";
        }

        if (isset($jadwalData['kelas_praktikum'])) {
            $message .= "Kelas: {$jadwalData['kelas_praktikum']}\n";
        }

        if (isset($jadwalData['topik'])) {
            $message .= "Topik: {$jadwalData['topik']}\n";
        }

        if (isset($jadwalData['materi'])) {
            $message .= "Materi: {$jadwalData['materi']}\n";
        }

        if (isset($jadwalData['agenda'])) {
            $message .= "Agenda: {$jadwalData['agenda']}\n";
        }

        if (isset($jadwalData['jenis_baris'])) {
            $jenisLabels = [
                'materi' => 'Materi',
                'agenda' => 'Agenda Khusus',
                'seminar_proposal' => 'Seminar Proposal',
                'sidang_skripsi' => 'Sidang Skripsi',
            ];
            $jenisLabel = $jenisLabels[$jadwalData['jenis_baris']] ?? ucfirst($jadwalData['jenis_baris']);
            $message .= "Jenis: {$jenisLabel}\n";
        }

        $message .= "\nSilakan konfirmasi ketersediaan Anda melalui sistem akademik.\n";
        $message .= "\n_ISME - Sistem Akademik FKK UMJ_";

        return $message;
    }
}

