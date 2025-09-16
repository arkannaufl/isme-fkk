<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JadwalNonBlokNonCSR extends Model
{
    use HasFactory;

    protected $table = 'jadwal_non_blok_non_csr';

    protected $fillable = [
        'mata_kuliah_kode',
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'jumlah_sesi',
        'jenis_baris',
        'agenda',
        'materi',
        'dosen_id',
        'dosen_ids',
        'ruangan_id',
        'kelompok_besar_id',
        'kelompok_besar_antara_id',
        'use_ruangan',
        'status_konfirmasi',
        'alasan_konfirmasi',
    ];

    protected $casts = [
        'tanggal' => 'date',
        'jam_mulai' => 'string',
        'jam_selesai' => 'string',
        'use_ruangan' => 'boolean',
        'dosen_ids' => 'array',
    ];

    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }

    public function dosen()
    {
        return $this->belongsTo(User::class, 'dosen_id');
    }

    public function ruangan()
    {
        return $this->belongsTo(Ruangan::class, 'ruangan_id');
    }

    public function kelompokBesar()
    {
        return $this->belongsTo(KelompokBesar::class, 'kelompok_besar_id');
    }

    public function kelompokBesarAntara()
    {
        return $this->belongsTo(KelompokBesarAntara::class, 'kelompok_besar_antara_id');
    }

    /**
     * Get multiple dosen names
     */
    public function getDosenNamesAttribute()
    {
        if ($this->dosen_ids && is_array($this->dosen_ids)) {
            $dosenNames = User::whereIn('id', $this->dosen_ids)->pluck('name')->toArray();
            return implode(', ', $dosenNames);
        }
        return $this->dosen ? $this->dosen->name : '';
    }
} 