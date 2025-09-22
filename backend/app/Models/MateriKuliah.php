<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class MateriKuliah extends Model
{
    protected $table = 'materi_pembelajaran';

    protected $fillable = [
        'kode_mata_kuliah',
        'filename',
        'judul',
        'file_type',
        'file_size',
        'file_path',
        'upload_date',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'upload_date' => 'datetime',
    ];

    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'kode_mata_kuliah', 'kode');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "MateriKuliah telah di-{$eventName}");
    }
}
