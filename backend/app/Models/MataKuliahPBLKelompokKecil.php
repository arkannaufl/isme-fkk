<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class MataKuliahPBLKelompokKecil extends Model
{
    use LogsActivity;

    protected $table = 'mata_kuliah_pbl_kelompok_kecil';

    protected $fillable = [
        'mata_kuliah_kode',
        'nama_kelompok',
        'semester',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Mapping Kelompok {$this->nama_kelompok} ke Mata Kuliah {$this->mata_kuliah_kode} (Semester {$this->semester}) telah di-{$eventName}");
    }

    /**
     * Get the mata kuliah that owns the mapping
     */
    public function mataKuliah(): BelongsTo
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }

    // Relasi ke kelompok kecil bisa menggunakan nama_kelompok dan semester jika diperlukan
} 