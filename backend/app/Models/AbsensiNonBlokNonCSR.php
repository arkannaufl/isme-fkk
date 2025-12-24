<?php

namespace App\Models;

use App\Traits\HasSemesterScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class AbsensiNonBlokNonCSR extends Model
{
    use HasFactory, LogsActivity, HasSemesterScope;

    protected $table = 'absensi_non_blok_non_csr';

    protected $fillable = [
        'semester_id',
        'jadwal_non_blok_non_csr_id',
        'mahasiswa_nim',
        'hadir',
        'catatan'
    ];

    protected $casts = [
        'hadir' => 'boolean'
    ];

    public function jadwalNonBlokNonCSR()
    {
        return $this->belongsTo(JadwalNonBlokNonCSR::class, 'jadwal_non_blok_non_csr_id');
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
            ->setDescriptionForEvent(fn(string $eventName) => "Absensi Non Blok Non CSR telah di-{$eventName}");
    }
}
