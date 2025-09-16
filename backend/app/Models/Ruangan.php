<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class Ruangan extends Model
{
    use LogsActivity;

    protected $table = 'ruangan';
    protected $fillable = [
        'id_ruangan',
        'nama',
        'kapasitas',
        'gedung',
        'keterangan'
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Ruangan dengan ID {$this->id_ruangan} telah di-{$eventName}");
    }
} 