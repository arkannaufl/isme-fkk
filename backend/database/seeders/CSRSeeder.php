<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\CSR;
use App\Models\MataKuliah;

class CSRSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $semesters = [1, 2, 4, 7];
        $csrs = [];
        // Ambil keahlian unik dari dosen (UserSeeder)
        $dosenKeahlian = [
            'Kardiologi', 'Pendidikan', 'Anatomi', 'Bedah', 'Biostatistik', 'Epidemiologi',
            'Patologi', 'Laboratorium', 'Farmakologi', 'Konsultasi Obat', 'Mikrobiologi', 'Bakteriologi',
            'Fisiologi', 'Olahraga', 'Parasitologi', 'Infeksi', 'Histologi', 'Mikroskopi',
            'Imunologi', 'Alergi', 'Gizi Klinik', 'Nutrisi', 'Kesehatan Masyarakat', 'Promosi Kesehatan',
            'Kedokteran Forensik', 'Hukum Medis', 'Radiologi', 'CT Scan'
        ];
        $keahlianChunk = array_chunk($dosenKeahlian, 4);
        foreach ($semesters as $i => $semester) {
            $kode = 'MKU' . str_pad($semester, 3, '0', STR_PAD_LEFT);
            for ($blok = 1; $blok <= 4; $blok++) {
                $keahlian = $keahlianChunk[$blok - 1] ?? $dosenKeahlian;
                $csrs[] = [
                    'mata_kuliah_kode' => $kode,
                    'nomor_csr' => "$semester.$blok",
                    'nama' => null,
                    'keahlian_required' => [],
                    'status' => 'available',
                ];
            }
        }
        foreach ($csrs as $csrData) {
            // Ambil semester dan blok dari nomor_csr
            $parts = explode('.', $csrData['nomor_csr']);
            $semester = (int) $parts[0];
            $blok = (int) $parts[1];
            // Cari mata kuliah blok yang sesuai
            $mataKuliahBlok = MataKuliah::where('kode', 'MKB' . $semester . '0' . $blok)->first();
            if ($mataKuliahBlok) {
                $csrData['tanggal_mulai'] = $mataKuliahBlok->tanggal_mulai;
                $csrData['tanggal_akhir'] = $mataKuliahBlok->tanggal_akhir;
            } else {
                $csrData['tanggal_mulai'] = '2024-01-01';
                $csrData['tanggal_akhir'] = '2024-01-31';
            }
            $csrData['keahlian_required'] = $csrData['keahlian_required'] ?? [];
            CSR::create($csrData);
        }
    }
} 