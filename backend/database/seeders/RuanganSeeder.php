<?php

namespace Database\Seeders;

use App\Models\Ruangan;
use Illuminate\Database\Seeder;

class RuanganSeeder extends Seeder
{
    public function run()
    {
        $ruangan = [
            [
                'id_ruangan' => 'R001',
                'nama' => 'Ruang Kuliah 1',
                'kapasitas' => 40,
                'gedung' => 'Gedung A',
                'keterangan' => 'Lantai 1'
            ],
            [
                'id_ruangan' => 'R002',
                'nama' => 'Ruang Kuliah 2',
                'kapasitas' => 35,
                'gedung' => 'Gedung A',
                'keterangan' => 'Lantai 2'
            ],
            [
                'id_ruangan' => 'R003',
                'nama' => 'Lab Komputer',
                'kapasitas' => 25,
                'gedung' => 'Gedung B',
                'keterangan' => 'PC Lengkap'
            ],
            [
                'id_ruangan' => 'R004',
                'nama' => 'Aula',
                'kapasitas' => 100,
                'gedung' => 'Gedung C',
                'keterangan' => 'Acara Besar'
            ],
            [
                'id_ruangan' => 'R005',
                'nama' => 'Ruang Dosen',
                'kapasitas' => 10,
                'gedung' => 'Gedung D',
                'keterangan' => 'Staff Only'
            ],
        ];

        foreach ($ruangan as $r) {
            Ruangan::create($r);
        }
    }
} 