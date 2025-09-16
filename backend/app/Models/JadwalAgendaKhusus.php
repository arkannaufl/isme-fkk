<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JadwalAgendaKhusus extends Model
{
    use HasFactory;

    protected $table = 'jadwal_agenda_khusus';

    protected $fillable = [
        'mata_kuliah_kode',
        'agenda',
        'ruangan_id',
        'kelompok_besar_id',
        'kelompok_besar_antara_id',
        'use_ruangan',
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'jumlah_sesi',
    ];

    // Relasi
    public function mataKuliah() { return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode'); }
    public function ruangan() { return $this->belongsTo(Ruangan::class, 'ruangan_id'); }
    
    /**
     * Relasi ke kelompok besar berdasarkan semester
     */
    public function kelompokBesar()
    {
        return $this->belongsTo(KelompokBesar::class, 'kelompok_besar_id');
    }

    /**
     * Relasi ke kelompok besar antara
     */
    public function kelompokBesarAntara()
    {
        return $this->belongsTo(KelompokBesarAntara::class, 'kelompok_besar_antara_id');
    }
}
