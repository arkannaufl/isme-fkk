<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class IKDBuktiFisik extends Model
{
    use LogsActivity;

    protected $table = 'ikd_bukti_fisik';
    
    protected $fillable = [
        'user_id',
        'ikd_pedoman_id',
        'unit',
        'file_path',
        'file_name',
        'file_type',
        'file_size',
        'skor',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'skor' => 'decimal:2',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "IKD Bukti Fisik untuk user {$this->user_id} dan pedoman {$this->ikd_pedoman_id} telah di-{$eventName}");
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
