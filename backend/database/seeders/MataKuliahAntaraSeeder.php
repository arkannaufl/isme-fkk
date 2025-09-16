<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\MataKuliah;
use App\Models\PBL;

class MataKuliahAntaraSeeder extends Seeder
{
    public function run()
    {
        // Data mata kuliah semester antara
        $antaraData = [
            // Blok Semester Antara
            [
                'kode' => 'MKA001',
                'nama' => 'Praktik Klinik Dasar',
                'semester' => 'Antara',
                'periode' => 'Antara',
                'jenis' => 'Blok',
                'kurikulum' => 2024,
                'tanggal_mulai' => '2024-07-01',
                'tanggal_akhir' => '2024-07-28',
                'blok' => 1,
                'durasi_minggu' => 4,
                'tipe_non_block' => null,
                'peran_dalam_kurikulum' => null,
                'keahlian_required' => null,
            ],
            [
                'kode' => 'MKA002',
                'nama' => 'Komunikasi Medis',
                'semester' => 'Antara',
                'periode' => 'Antara',
                'jenis' => 'Blok',
                'kurikulum' => 2024,
                'tanggal_mulai' => '2024-07-29',
                'tanggal_akhir' => '2024-08-25',
                'blok' => 2,
                'durasi_minggu' => 4,
                'tipe_non_block' => null,
                'peran_dalam_kurikulum' => null,
                'keahlian_required' => null,
            ],
            [
                'kode' => 'MKA003',
                'nama' => 'Skill Lab Dasar',
                'semester' => 'Antara',
                'periode' => 'Antara',
                'jenis' => 'Blok',
                'kurikulum' => 2024,
                'tanggal_mulai' => '2024-08-26',
                'tanggal_akhir' => '2024-09-22',
                'blok' => 3,
                'durasi_minggu' => 4,
                'tipe_non_block' => null,
                'peran_dalam_kurikulum' => null,
                'keahlian_required' => null,
            ],
            [
                'kode' => 'MKA004',
                'nama' => 'Praktik Lapangan Kesehatan',
                'semester' => 'Antara',
                'periode' => 'Antara',
                'jenis' => 'Blok',
                'kurikulum' => 2024,
                'tanggal_mulai' => '2024-09-23',
                'tanggal_akhir' => '2024-10-20',
                'blok' => 4,
                'durasi_minggu' => 4,
                'tipe_non_block' => null,
                'peran_dalam_kurikulum' => null,
                'keahlian_required' => null,
            ],
            
            // Non Blok Semester Antara
            [
                'kode' => 'MKA101',
                'nama' => 'Pengembangan Diri Mahasiswa',
                'semester' => 'Antara',
                'periode' => 'Antara',
                'jenis' => 'Non Blok',
                'kurikulum' => 2024,
                'tanggal_mulai' => '2024-07-01',
                'tanggal_akhir' => '2024-10-20',
                'blok' => null,
                'durasi_minggu' => 16,
                'tipe_non_block' => 'Non-CSR',
                'peran_dalam_kurikulum' => null,
                'keahlian_required' => null,
            ],
            [
                'kode' => 'MKA102',
                'nama' => 'Kepemimpinan dan Manajemen Kesehatan',
                'semester' => 'Antara',
                'periode' => 'Antara',
                'jenis' => 'Non Blok',
                'kurikulum' => 2024,
                'tanggal_mulai' => '2024-07-01',
                'tanggal_akhir' => '2024-10-20',
                'blok' => null,
                'durasi_minggu' => 16,
                'tipe_non_block' => 'Non-CSR',
                'peran_dalam_kurikulum' => null,
                'keahlian_required' => null,
            ],
            [
                'kode' => 'MKA103',
                'nama' => 'Penelitian dan Publikasi Ilmiah',
                'semester' => 'Antara',
                'periode' => 'Antara',
                'jenis' => 'Non Blok',
                'kurikulum' => 2024,
                'tanggal_mulai' => '2024-07-01',
                'tanggal_akhir' => '2024-10-20',
                'blok' => null,
                'durasi_minggu' => 16,
                'tipe_non_block' => 'Non-CSR',
                'peran_dalam_kurikulum' => null,
                'keahlian_required' => null,
            ],
        ];

        // Insert data mata kuliah semester antara
        foreach ($antaraData as $item) {
            $mk = MataKuliah::create($item);

            // Untuk mata kuliah Blok, tambahkan modul PBL
            if ($item['jenis'] === 'Blok') {
                $this->createPBLModules($mk);
            }
        }
    }

    private function createPBLModules($mataKuliah)
    {
        $pblModules = [
            'MKA001' => [ // Praktik Klinik Dasar
                'PBL 1: Anamnesis dan Pemeriksaan Fisik Dasar',
                'PBL 2: Dokumentasi Medis dan Rekam Medis',
                'PBL 3: Komunikasi dengan Pasien dan Keluarga',
                'PBL 4: Etika dan Profesionalisme Medis',
            ],
            'MKA002' => [ // Komunikasi Medis
                'PBL 1: Teknik Wawancara Medis',
                'PBL 2: Komunikasi dalam Situasi Sulit',
                'PBL 3: Konseling dan Edukasi Pasien',
                'PBL 4: Komunikasi Interprofesional',
            ],
            'MKA003' => [ // Skill Lab Dasar
                'PBL 1: Teknik Pemeriksaan Vital Signs',
                'PBL 2: Prosedur Aseptik dan Sterilisasi',
                'PBL 3: Teknik Suntik dan Infus',
                'PBL 4: Resusitasi Jantung Paru (RJP)',
            ],
            'MKA004' => [ // Praktik Lapangan Kesehatan
                'PBL 1: Survei Kesehatan Masyarakat',
                'PBL 2: Promosi Kesehatan dan Pencegahan',
                'PBL 3: Manajemen Program Kesehatan',
                'PBL 4: Evaluasi dan Monitoring Kesehatan',
            ],
        ];

        $modules = $pblModules[$mataKuliah->kode] ?? [];
        
        foreach ($modules as $index => $moduleName) {
            PBL::create([
                'mata_kuliah_kode' => $mataKuliah->kode,
                'modul_ke' => $index + 1,
                'nama_modul' => $moduleName,
            ]);
        }
    }
}
