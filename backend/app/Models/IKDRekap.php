<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class IKDRekap extends Model
{
    use LogsActivity;

    protected $table = 'ikd_rekap';
    
    protected $fillable = [
        'user_id',
        'ikd_pedoman_id',
        'unit',
        'tahun',
        'semester',
        'poin',
        'keterangan',
        'status',
    ];

    protected $casts = [
        'tahun' => 'integer',
        'semester' => 'integer',
        'poin' => 'integer',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "IKD Rekap ID {$this->id} telah di-{$eventName}");
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function pedoman()
    {
        return $this->belongsTo(IKDPedoman::class, 'ikd_pedoman_id');
    }
}
