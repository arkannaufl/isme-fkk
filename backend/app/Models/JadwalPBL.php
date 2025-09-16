<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JadwalPBL extends Model
{
    use HasFactory;

    protected $table = 'jadwal_pbl';

    protected $fillable = [
        'mata_kuliah_kode',
        'pbl_id',
        'kelompok_kecil_id',
        'kelompok_kecil_antara_id',
        'dosen_id',
        'dosen_ids',
        'ruangan_id',
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'jumlah_sesi',
        'pbl_tipe',
        'status_konfirmasi',
    ];

    protected $casts = [
        'dosen_ids' => 'array',
    ];

    // Relasi
    public function mataKuliah() { return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode'); }
    public function modulPBL() { return $this->belongsTo(PBL::class, 'pbl_id'); }
    public function kelompokKecil() { return $this->belongsTo(KelompokKecil::class, 'kelompok_kecil_id'); }
    public function kelompokKecilAntara() { return $this->belongsTo(KelompokKecilAntara::class, 'kelompok_kecil_antara_id'); }
    public function dosen() { return $this->belongsTo(User::class, 'dosen_id'); }
    public function ruangan() { return $this->belongsTo(Ruangan::class, 'ruangan_id'); }

    // Relationship untuk penilaian PBL
    public function penilaianPBL()
    {
        return $this->hasMany(PenilaianPBL::class, 'mata_kuliah_kode', 'mata_kuliah_kode')
                    ->where('kelompok', $this->kelompok_kecil_id ?? '');
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
