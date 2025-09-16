<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JadwalPraktikum extends Model
{
    use HasFactory;

    protected $table = 'jadwal_praktikum';

    protected $fillable = [
        'mata_kuliah_kode',
        'materi',
        'topik',
        'kelas_praktikum',
        'ruangan_id',
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'jumlah_sesi',
    ];

    // Relasi
    public function mataKuliah() { return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode'); }
    public function ruangan() { return $this->belongsTo(Ruangan::class, 'ruangan_id'); }
    public function dosen() { return $this->belongsToMany(User::class, 'jadwal_praktikum_dosen', 'jadwal_praktikum_id', 'dosen_id'); }
}
