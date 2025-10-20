<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class JurnalReading extends Model
{
    use LogsActivity;

    protected $table = 'jurnal_readings';

    protected $fillable = [
        'mata_kuliah_kode',
        'topik_ke',
        'nama_topik',
    ];

    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Jurnal Reading Topik {$this->topik_ke} ({$this->nama_topik}) pada Mata Kuliah {$this->mata_kuliah_kode} telah di-{$eventName}");
    }
}
