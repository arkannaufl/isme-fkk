<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class AbsensiJurnal extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'absensi_jurnal';

    protected $fillable = [
        'jadwal_jurnal_reading_id',
        'mahasiswa_nim',
        'hadir',
        'catatan'
    ];

    protected $casts = [
        'hadir' => 'boolean'
    ];

    public function jadwalJurnalReading()
    {
        return $this->belongsTo(JadwalJurnalReading::class, 'jadwal_jurnal_reading_id');
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
            ->setDescriptionForEvent(fn(string $eventName) => "Absensi Jurnal telah di-{$eventName}");
    }
}
