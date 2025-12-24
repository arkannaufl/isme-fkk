<?php

namespace App\Models;

use App\Traits\HasSemesterScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class PenilaianPBL extends Model
{
    use HasFactory, LogsActivity, HasSemesterScope;

    protected $table = 'penilaian_pbl';

    protected $fillable = [
        'semester_id',
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
        'jadwal_pbl_id',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Penilaian PBL telah di-{$eventName}");
    }
}
