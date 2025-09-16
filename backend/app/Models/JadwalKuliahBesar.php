<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JadwalKuliahBesar extends Model
{
    use HasFactory;

    protected $table = 'jadwal_kuliah_besar';

    protected $fillable = [
        'mata_kuliah_kode',
        'materi',
        'topik',
        'dosen_id',
        'dosen_ids', // Array of dosen IDs for multiple dosen
        'ruangan_id',
        'kelompok_besar_id',
        'kelompok_besar_antara_id', // For manual kelompok besar
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'jumlah_sesi',
        'status_konfirmasi',
        'alasan_konfirmasi',
    ];

    protected $casts = [
        'dosen_ids' => 'array',
    ];

    // Relasi
    public function mataKuliah() { return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode'); }
    public function dosen() { return $this->belongsTo(User::class, 'dosen_id'); }
    public function ruangan() { return $this->belongsTo(Ruangan::class, 'ruangan_id'); }
    
    /**
     * Relasi ke kelompok besar berdasarkan semester
     */
    public function kelompokBesar()
    {
        return $this->hasMany(KelompokBesar::class, 'semester', 'kelompok_besar_id');
    }

    /**
     * Relasi ke kelompok besar antara (manual)
     */
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
