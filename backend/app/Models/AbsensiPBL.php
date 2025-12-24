<?php

namespace App\Models;

use App\Traits\HasSemesterScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class AbsensiPBL extends Model
{
    use HasFactory, LogsActivity, HasSemesterScope;

    protected $table = 'absensi_pbl';

    protected $fillable = [
        'semester_id',
        'mata_kuliah_kode',
        'kelompok',
        'pertemuan',
        'mahasiswa_npm',
        'hadir',
        'catatan',
        'jadwal_pbl_id',
    ];

    protected $casts = [
        'hadir' => 'boolean'
    ];

    public function mahasiswa()
    {
        return $this->belongsTo(User::class, 'mahasiswa_npm', 'nim');
    }

    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Absensi PBL telah di-{$eventName}");
    }
}
