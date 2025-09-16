<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class MataKuliah extends Model
{
    use LogsActivity;

    protected $table = 'mata_kuliah';
    protected $primaryKey = 'kode';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'kode',
        'nama',
        'semester',
        'periode',
        'jenis',
        'tipe_non_block',
        'kurikulum',
        'tanggal_mulai',
        'tanggal_akhir',
        'blok',
        'durasi_minggu',
        'keahlian_required',
        'peran_dalam_kurikulum',
        'rps_file',
    ];

    protected $casts = [
        'semester' => 'string',
        'kurikulum' => 'integer',
        'tanggal_mulai' => 'date',
        'tanggal_akhir' => 'date',
        'blok' => 'integer',
        'durasi_minggu' => 'integer',
        'keahlian_required' => 'array',
        'peran_dalam_kurikulum' => 'array',
    ];

    public function csrs()
    {
        return $this->hasMany(CSR::class, 'mata_kuliah_kode', 'kode');
    }

    public function pbls()
    {
        return $this->hasMany(PBL::class, 'mata_kuliah_kode', 'kode');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Mata Kuliah {$this->nama} ({$this->kode}) telah di-{$eventName}");
    }
}
