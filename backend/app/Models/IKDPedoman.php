<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class IKDPedoman extends Model
{
    use LogsActivity;

    protected $table = 'ikd_pedoman';
    
    protected $fillable = [
        'no',
        'kegiatan',
        'indeks_poin',
        'unit_kerja',
        'bukti_fisik',
        'prosedur',
        'bidang',
        'bidang_nama',
        'parent_id',
        'level',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'indeks_poin' => 'decimal:2',
        'level' => 'integer',
        'parent_id' => 'integer',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "IKD Pedoman dengan no {$this->no} telah di-{$eventName}");
    }

    public function rekap()
    {
        return $this->hasMany(IKDRekap::class, 'ikd_pedoman_id');
    }

    public function parent()
    {
        return $this->belongsTo(IKDPedoman::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(IKDPedoman::class, 'parent_id');
    }
}
