<?php

namespace Database\Seeders;

use App\Models\TahunAjaran;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TahunAjaranSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::transaction(function () {
            $tahunAjarans = [
                ['tahun' => '2022/2023', 'aktif' => true],
                ['tahun' => '2023/2024', 'aktif' => false],
                ['tahun' => '2024/2025', 'aktif' => false],
                ['tahun' => '2025/2026', 'aktif' => false],
            ];

            foreach ($tahunAjarans as $ta) {
                $tahunAjaran = TahunAjaran::create($ta);

                $ganjil = $tahunAjaran->semesters()->create(['jenis' => 'Ganjil']);
                $tahunAjaran->semesters()->create(['jenis' => 'Genap']);
                
                if ($tahunAjaran->aktif) {
                    $ganjil->update(['aktif' => true]);
                }
            }
        });
    }
} 