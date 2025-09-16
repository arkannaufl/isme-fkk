<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AbsensiJurnal extends Model
{
    use HasFactory;

    protected $table = 'absensi_jurnal';
    
    protected $fillable = [
        'jadwal_jurnal_reading_id',
        'mahasiswa_nim',
        'hadir'
    ];

    protected $casts = [
        'hadir' => 'boolean'
    ];

    public function jadwalJurnalReading()
    {
        return $this->belongsTo(JadwalJurnalReading::class, 'jadwal_jurnal_reading_id');
    }

    public function mahasiswa()
    {
        return $this->belongsTo(User::class, 'mahasiswa_nim', 'nim');
    }
}
