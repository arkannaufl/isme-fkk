<?php

namespace App\Models;

use App\Traits\HasSemesterScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class AbsensiDosenPraktikum extends Model
{
    use HasFactory, LogsActivity, HasSemesterScope;

    protected $table = 'absensi_dosen_praktikum';

    protected $fillable = [
        'semester_id',
        'jadwal_praktikum_id',
        'dosen_id',
        'hadir',
        'catatan',
        'tanda_tangan',
    ];

    protected $casts = [
        'hadir' => 'boolean',
    ];

    // Relationship dengan JadwalPraktikum
    public function jadwalPraktikum()
    {
        return $this->belongsTo(JadwalPraktikum::class, 'jadwal_praktikum_id');
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
            ->setDescriptionForEvent(fn(string $eventName) => "Absensi Dosen Praktikum telah di-{$eventName}");
    }
}
