<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class TahunAjaran extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'tahun_ajaran';

    protected $fillable = [
        'tahun',
        'aktif',
    ];

    public function semesters(): HasMany
    {
        return $this->hasMany(Semester::class);
    }

    public function mataKuliah()
    {
        return $this->belongsToMany(MataKuliah::class, 'mata_kuliah_tahun_ajaran', 'tahun_ajaran_id', 'mata_kuliah_kode');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Tahun Ajaran {$this->tahun} telah di-{$eventName}");
    }
} 