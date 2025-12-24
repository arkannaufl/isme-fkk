<?php

namespace App\Models;

use App\Traits\HasSemesterScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class AbsensiKuliahBesar extends Model
{
    use HasFactory, LogsActivity, HasSemesterScope;

    protected $table = 'absensi_kuliah_besar';

    protected $fillable = [
        'semester_id',
        'jadwal_kuliah_besar_id',
        'mahasiswa_nim',
        'hadir',
        'catatan'
    ];

    protected $casts = [
        'hadir' => 'boolean'
    ];

    public function jadwalKuliahBesar()
    {
        return $this->belongsTo(JadwalKuliahBesar::class, 'jadwal_kuliah_besar_id');
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
            ->setDescriptionForEvent(fn(string $eventName) => "Absensi Kuliah Besar telah di-{$eventName}");
    }
}
