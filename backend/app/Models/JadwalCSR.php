<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JadwalCSR extends Model
{
    protected $table = 'jadwal_csr';
    
    protected $fillable = [
        'mata_kuliah_kode',
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'jumlah_sesi',
        'jenis_csr',
        'dosen_id',
        'ruangan_id',
        'kelompok_kecil_id',
        'kategori_id',
        'topik',
        'status_konfirmasi',
        'alasan_konfirmasi',
    ];

    protected $casts = [
        'tanggal' => 'date',
        'jam_mulai' => 'string',
        'jam_selesai' => 'string',
        'jumlah_sesi' => 'integer',
    ];

    public function mataKuliah(): BelongsTo
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }

    public function dosen(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dosen_id');
    }

    public function ruangan(): BelongsTo
    {
        return $this->belongsTo(Ruangan::class, 'ruangan_id');
    }

    public function kelompokKecil(): BelongsTo
    {
        return $this->belongsTo(KelompokKecil::class, 'kelompok_kecil_id');
    }

    public function kategori(): BelongsTo
    {
        return $this->belongsTo(CSR::class, 'kategori_id');
    }
}
