<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class AbsensiPBL extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'absensi_pbl';

    protected $fillable = [
        'mata_kuliah_kode',
        'kelompok',
        'pertemuan',
        'mahasiswa_npm',
        'hadir',
        'catatan'
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
