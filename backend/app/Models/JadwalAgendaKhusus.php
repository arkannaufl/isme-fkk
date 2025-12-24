<?php

namespace App\Models;

use App\Traits\HasSemesterScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class JadwalAgendaKhusus extends Model
{
    use HasFactory, LogsActivity, HasSemesterScope;

    protected $table = 'jadwal_agenda_khusus';

    protected $fillable = [
        'semester_id',
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

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "JadwalAgendaKhusus telah di-{$eventName}");
    }
}
