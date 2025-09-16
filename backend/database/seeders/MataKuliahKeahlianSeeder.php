<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\MataKuliah;
use App\Models\User;

class MataKuliahKeahlianSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Ambil semua keahlian unik dari dosen
        $dosenKeahlian = User::where('role', 'dosen')
            ->whereNotNull('keahlian')
            ->pluck('keahlian')
            ->flatten()
            ->unique()
            ->values()
            ->toArray();

        // Keahlian yang sudah ada dari UserSeeder (untuk konsistensi)
        $keahlianList = [
            'Kardiologi', 'Pendidikan', 'Anatomi', 'Bedah', 'Biostatistik', 'Epidemiologi',
            'Patologi', 'Laboratorium', 'Farmakologi', 'Konsultasi Obat', 'Mikrobiologi', 'Bakteriologi',
            'Fisiologi', 'Olahraga', 'Parasitologi', 'Infeksi', 'Histologi', 'Mikroskopi',
            'Imunologi', 'Alergi', 'Gizi Klinik', 'Nutrisi', 'Kesehatan Masyarakat', 'Promosi Kesehatan',
            'Kedokteran Forensik', 'Hukum Medis', 'Radiologi', 'CT Scan', 'EKG', 'EEG', 'Spirometri', 
            'Endoskopi', 'Transfusi Darah', 'Pencegahan Penyakit', 'Konsultasi Jantung', 'Konsultasi Saraf', 
            'Sistem Pernapasan', 'Sistem Pencernaan', 'Penyakit Darah', 'Pengabdian Masyarakat', 
            'Konsultasi Gizi', 'Etika Medis', 'Pencitraan Medis', 'Pengajaran', 'Riset', 'Konsultasi'
        ];

        // Gabungkan keahlian dari database dengan list yang sudah ada
        $allKeahlian = array_unique(array_merge($dosenKeahlian, $keahlianList));

        // Mapping keahlian berdasarkan semester dan blok
        $semesterBlokKeahlian = [
            1 => [
                1 => ['Anatomi', 'Fisiologi', 'Biokimia Dasar'], // Dasar-dasar Kedokteran
                2 => ['Anatomi', 'Histologi', 'Mikroskopi'], // Anatomi Dasar
                3 => ['Fisiologi', 'Biostatistik', 'Laboratorium'], // Fisiologi Dasar
                4 => ['Biokimia Dasar', 'Laboratorium', 'Mikroskopi'], // Biokimia Dasar
            ],
            2 => [
                1 => ['Anatomi', 'Fisiologi', 'Radiologi'], // Sistem Muskuloskeletal
                2 => ['Anatomi', 'Fisiologi', 'Neurologi'], // Sistem Saraf
                3 => ['Kardiologi', 'Fisiologi', 'EKG'], // Sistem Kardiovaskular
                4 => ['Fisiologi', 'Pulmonologi', 'Spirometri'], // Sistem Pernafasan
            ],
            3 => [
                1 => ['Fisiologi', 'Gastroenterologi', 'Endoskopi'], // Sistem Pencernaan
                2 => ['Fisiologi', 'Endokrinologi', 'Laboratorium'], // Sistem Endokrin
                3 => ['Anatomi', 'Fisiologi', 'Kesehatan Masyarakat'], // Sistem Reproduksi
                4 => ['Fisiologi', 'Nefrologi', 'Laboratorium'], // Sistem Urinaria
            ],
            4 => [
                1 => ['Imunologi', 'Mikrobiologi', 'Laboratorium'], // Sistem Imun
                2 => ['Hematologi', 'Laboratorium', 'Transfusi Darah'], // Sistem Hematologi
                3 => ['Dermatologi', 'Anatomi', 'Mikroskopi'], // Kulit dan Jaringan Subkutan
                4 => ['Biokimia Dasar', 'Fisiologi', 'Laboratorium'], // Metabolisme Tubuh
            ],
            5 => [
                1 => ['Infeksi', 'Imunologi', 'Mikrobiologi'], // Infeksi dan Imunologi
                2 => ['Farmakologi', 'Konsultasi Obat', 'Laboratorium'], // Farmakologi Dasar
                3 => ['Patologi', 'Anatomi', 'Mikroskopi'], // Patologi Anatomi
                4 => ['Patologi', 'Laboratorium', 'Mikroskopi'], // Patologi Klinik
            ],
            6 => [
                1 => ['Penyakit Dalam', 'Konsultasi', 'Laboratorium'], // Penyakit Dalam
                2 => ['Bedah', 'Anatomi', 'Radiologi'], // Bedah Dasar
                3 => ['Pediatri', 'Ilmu Anak', 'Konsultasi'], // Ilmu Anak
                4 => ['Kebidanan', 'Kesehatan Masyarakat', 'Konsultasi'], // Ilmu Kebidanan
            ],
            7 => [
                1 => ['Psikiatri', 'Konsultasi', 'Pengajaran'], // Psikiatri Dasar
                2 => ['Kesehatan Masyarakat', 'Epidemiologi', 'Promosi Kesehatan'], // Ilmu Kesehatan Masyarakat
                3 => ['Dermatologi', 'Mikroskopi', 'Konsultasi'], // Dermatologi
                4 => ['Oftalmologi', 'Anatomi', 'Radiologi'], // Ilmu Penyakit Mata
            ],
        ];

        // Update mata kuliah blok dengan keahlian yang sesuai (kecuali semester antara)
        $mataKuliahBlok = MataKuliah::where('jenis', 'Blok')
            ->where('semester', '!=', 'Antara')
            ->get();
        
        foreach ($mataKuliahBlok as $mk) {
            $semester = $mk->semester;
            $blok = $mk->blok;
            
            // Ambil keahlian yang sesuai untuk semester dan blok ini
            $keahlianRequired = $semesterBlokKeahlian[$semester][$blok] ?? [];
            
            // Jika tidak ada mapping spesifik, ambil keahlian random
            if (empty($keahlianRequired)) {
                $keahlianRequired = collect($allKeahlian)
                    ->shuffle()
                    ->take(rand(2, 4))
                    ->values()
                    ->toArray();
            }
            
            // Update mata kuliah dengan keahlian yang diperlukan
            $mk->update([
                'keahlian_required' => $keahlianRequired
            ]);
        }

        // Update mata kuliah non-blok dengan keahlian yang sesuai (kecuali semester antara)
        $mataKuliahNonBlok = MataKuliah::where('jenis', '!=', 'Blok')
            ->where('semester', '!=', 'Antara')
            ->get();
        
        foreach ($mataKuliahNonBlok as $mk) {
            $semester = $mk->semester;
            
            // Mapping keahlian untuk mata kuliah non-blok berdasarkan semester
            $nonBlokKeahlian = [
                1 => ['Pendidikan', 'Pengajaran', 'Etika Medis'], // Pendidikan Agama Islam
                2 => ['Pendidikan', 'Pengajaran', 'Etika Medis'], // Pancasila
                3 => ['Pendidikan', 'Pengajaran', 'Komunikasi'], // Bahasa Indonesia
                4 => ['Pendidikan', 'Pengajaran', 'Etika Medis'], // Kewarganegaraan
                5 => ['Pendidikan', 'Pengajaran', 'Komunikasi'], // Bahasa Inggris Kedokteran
                6 => ['Etika Medis', 'Pengajaran', 'Konsultasi'], // Etika Kedokteran
                7 => ['Riset', 'Biostatistik', 'Epidemiologi'], // Metodologi Penelitian
            ];
            
            $keahlianRequired = $nonBlokKeahlian[$semester] ?? ['Pendidikan', 'Pengajaran'];
            
            $mk->update([
                'keahlian_required' => $keahlianRequired
            ]);
        }

        $this->command->info('Keahlian mata kuliah berhasil di-seed!');
        $this->command->info('Total mata kuliah yang diupdate: ' . ($mataKuliahBlok->count() + $mataKuliahNonBlok->count()));
    }
} 