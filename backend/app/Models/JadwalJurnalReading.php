<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JadwalJurnalReading extends Model
{
    use HasFactory;

    protected $table = 'jadwal_jurnal_reading';

    protected $fillable = [
        'mata_kuliah_kode',
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'jumlah_sesi',
        'kelompok_kecil_id',
        'kelompok_kecil_antara_id',
        'dosen_id',
        'dosen_ids',
        'ruangan_id',
        'topik',
        'file_jurnal',
        'status_konfirmasi',
        'alasan_konfirmasi',
    ];

    protected $casts = [
        'dosen_ids' => 'array',
    ];

    // Relasi
    public function mataKuliah() { return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode'); }
    public function kelompokKecil() { return $this->belongsTo(KelompokKecil::class, 'kelompok_kecil_id'); }
    public function kelompokKecilAntara() { return $this->belongsTo(KelompokKecilAntara::class, 'kelompok_kecil_antara_id'); }
    public function dosen() { return $this->belongsTo(User::class, 'dosen_id'); }
    public function ruangan() { return $this->belongsTo(Ruangan::class, 'ruangan_id'); }

    // Relationship untuk penilaian jurnal
    public function penilaianJurnal()
    {
        return $this->hasMany(PenilaianJurnal::class, 'jurnal_reading_id');
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
