<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiwayatKonfirmasiDosen extends Model
{
    protected $table = 'riwayat_konfirmasi_dosen';
    
    protected $fillable = [
        'dosen_id',
        'jadwal_type',
        'jadwal_id',
        'mata_kuliah_kode',
        'mata_kuliah_nama',
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'ruangan',
        'materi',
        'topik',
        'agenda',
        'kelas_praktikum',
        'status_konfirmasi',
        'alasan_konfirmasi',
        'waktu_konfirmasi'
    ];

    protected $casts = [
        'tanggal' => 'date',
        'waktu_konfirmasi' => 'datetime'
    ];

    public function dosen(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dosen_id');
    }
}
