<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AbsensiPBL extends Model
{
    use HasFactory;

    protected $table = 'absensi_pbl';
    
    protected $fillable = [
        'mata_kuliah_kode',
        'kelompok',
        'pertemuan',
        'mahasiswa_npm',
        'hadir'
    ];

    protected $casts = [
        'hadir' => 'boolean'
    ];

    public function mahasiswa()
    {
        return $this->belongsTo(User::class, 'mahasiswa_npm', 'nim');
    }

    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }
}
