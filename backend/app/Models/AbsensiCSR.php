<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AbsensiCSR extends Model
{
    use HasFactory;

    protected $table = 'absensi_csr';

    protected $fillable = [
        'jadwal_csr_id',
        'mahasiswa_npm',
        'hadir',
    ];

    protected $casts = [
        'hadir' => 'boolean',
    ];

    // Relationship dengan JadwalCSR
    public function jadwalCSR()
    {
        return $this->belongsTo(JadwalCSR::class, 'jadwal_csr_id');
    }

    // Relationship dengan User (mahasiswa)
    public function mahasiswa()
    {
        return $this->belongsTo(User::class, 'mahasiswa_npm', 'nim');
    }
}
