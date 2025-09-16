<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class PBLMapping extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'pbl_mappings';

    protected $fillable = [
        'pbl_id',
        'dosen_id',
        'role'
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "PBL Mapping Dosen ID {$this->dosen_id} ke PBL ID {$this->pbl_id} telah di-{$eventName}");
    }

    // Relasi ke PBL
    public function pbl()
    {
        return $this->belongsTo(PBL::class, 'pbl_id');
    }

    // Relasi ke dosen
    public function dosen()
    {
        return $this->belongsTo(User::class, 'dosen_id');
    }
}
