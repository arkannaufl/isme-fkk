<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class PenilaianPBL extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'penilaian_pbl';

    protected $fillable = [
        'mata_kuliah_kode',
        'kelompok',
        'pertemuan',
        'mahasiswa_npm',
        'nilai_a',
        'nilai_b',
        'nilai_c',
        'nilai_d',
        'nilai_e',
        'nilai_f',
        'nilai_g',
        'peta_konsep',
        'tanggal_paraf',
        'signature_tutor',
        'signature_paraf',
        'nama_tutor',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Penilaian PBL telah di-{$eventName}");
    }
}
