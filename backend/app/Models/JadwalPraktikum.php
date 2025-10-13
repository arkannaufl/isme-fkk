<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class JadwalPraktikum extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'jadwal_praktikum';

    protected $fillable = [
        'mata_kuliah_kode',
        'materi',
        'topik',
        'kelas_praktikum',
        'ruangan_id',
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'jumlah_sesi',
        'created_by',
    ];

    // Relasi
    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }
    public function ruangan()
    {
        return $this->belongsTo(Ruangan::class, 'ruangan_id');
    }
    public function dosen()
    {
        return $this->belongsToMany(User::class, 'jadwal_praktikum_dosen', 'jadwal_praktikum_id', 'dosen_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "JadwalPraktikum telah di-{$eventName}");
    }
}
