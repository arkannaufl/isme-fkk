<?php

namespace App\Models;

use App\Traits\HasSemesterScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class AbsensiPersamaanPersepsi extends Model
{
    use HasFactory, LogsActivity, HasSemesterScope;

    protected $table = 'absensi_persamaan_persepsi';

    protected $fillable = [
        'semester_id',
        'jadwal_persamaan_persepsi_id',
        'dosen_id',
        'hadir',
        'catatan',
    ];

    protected $casts = [
        'hadir' => 'boolean',
    ];

    // Relationship dengan JadwalPersamaanPersepsi
    public function jadwalPersamaanPersepsi()
    {
        return $this->belongsTo(JadwalPersamaanPersepsi::class, 'jadwal_persamaan_persepsi_id');
    }

    // Relationship dengan User (dosen)
    public function dosen()
    {
        return $this->belongsTo(User::class, 'dosen_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Absensi Persamaan Persepsi telah di-{$eventName}");
    }
}

