<?php

namespace App\Models;

use App\Traits\HasSemesterScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class AbsensiPraktikum extends Model
{
    use HasFactory, LogsActivity, HasSemesterScope;

    protected $table = 'absensi_praktikum';

    protected $fillable = [
        'semester_id',
        'jadwal_praktikum_id',
        'mahasiswa_nim',
        'hadir',
        'catatan'
    ];

    protected $casts = [
        'hadir' => 'boolean'
    ];

    public function jadwalPraktikum()
    {
        return $this->belongsTo(JadwalPraktikum::class, 'jadwal_praktikum_id');
    }

    public function mahasiswa()
    {
        return $this->belongsTo(User::class, 'mahasiswa_nim', 'nim');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
