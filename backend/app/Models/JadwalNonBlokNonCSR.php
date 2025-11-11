<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class JadwalNonBlokNonCSR extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'jadwal_non_blok_non_csr';

    protected $fillable = [
        'mata_kuliah_kode',
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'jumlah_sesi',
        'jenis_baris',
        'agenda',
        'materi',
        'dosen_id',
        'dosen_ids',
        'ruangan_id',
        'kelompok_besar_id',
        'kelompok_besar_antara_id',
        'use_ruangan',
        'status_konfirmasi',
        'alasan_konfirmasi',
        'status_reschedule',
        'reschedule_reason',
        'qr_enabled',
        'created_by',
    ];

    protected $casts = [
        'tanggal' => 'date',
        'jam_mulai' => 'string',
        'jam_selesai' => 'string',
        'use_ruangan' => 'boolean',
        'dosen_ids' => 'array',
        'qr_enabled' => 'boolean',
    ];

    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }

    public function dosen()
    {
        return $this->belongsTo(User::class, 'dosen_id');
    }

    public function ruangan()
    {
        return $this->belongsTo(Ruangan::class, 'ruangan_id');
    }

    public function kelompokBesar()
    {
        return $this->belongsTo(KelompokBesar::class, 'kelompok_besar_id');
    }

    public function kelompokBesarAntara()
    {
        return $this->belongsTo(KelompokBesarAntara::class, 'kelompok_besar_antara_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get multiple dosen names
     */
    public function getDosenNamesAttribute()
    {
        if ($this->dosen_ids && is_array($this->dosen_ids)) {
            $dosenNames = User::whereIn('id', $this->dosen_ids)->pluck('name')->toArray();
            return implode(', ', $dosenNames);
        }
        return $this->dosen ? $this->dosen->name : '';
    }

    /**
     * Get the activity log options for the model.
     */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Jadwal Non Blok Non CSR telah di-{$eventName}");
    }
}
