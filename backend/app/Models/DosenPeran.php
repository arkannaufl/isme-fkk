<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class DosenPeran extends Model
{
    use LogsActivity;

    protected $table = 'dosen_peran';
    protected $fillable = [
        'user_id',
        'tipe_peran',
        'mata_kuliah_kode',
        'peran_kurikulum',
        'blok',
        'semester',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Peran Dosen ID {$this->user_id} ({$this->tipe_peran}) telah di-{$eventName}");
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }
} 