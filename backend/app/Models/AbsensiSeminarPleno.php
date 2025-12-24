<?php

namespace App\Models;

use App\Traits\HasSemesterScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class AbsensiSeminarPleno extends Model
{
    use HasFactory, LogsActivity, HasSemesterScope;

    protected $table = 'absensi_seminar_pleno';

    protected $fillable = [
        'semester_id',
        'jadwal_seminar_pleno_id',
        'dosen_id',
        'hadir',
        'catatan',
    ];

    protected $casts = [
        'hadir' => 'boolean',
    ];

    // Relationship dengan JadwalSeminarPleno
    public function jadwalSeminarPleno()
    {
        return $this->belongsTo(JadwalSeminarPleno::class, 'jadwal_seminar_pleno_id');
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
            ->setDescriptionForEvent(fn(string $eventName) => "Absensi Seminar Pleno telah di-{$eventName}");
    }
}
