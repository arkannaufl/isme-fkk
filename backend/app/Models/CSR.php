<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class CSR extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'csrs';

    protected $fillable = [
        'mata_kuliah_kode',
        'nomor_csr',
        'nama',
        'keahlian_required',
        'tanggal_mulai',
        'tanggal_akhir',
        'status'
    ];

    protected $casts = [
        'keahlian_required' => 'array',
        'tanggal_mulai' => 'date',
        'tanggal_akhir' => 'date'
    ];

    // Accessor untuk mendapatkan semester dari nomor_csr
    public function getSemesterAttribute()
    {
        $parts = explode('.', $this->nomor_csr);
        return isset($parts[0]) ? (int) $parts[0] : null;
    }

    // Accessor untuk mendapatkan blok dari nomor_csr
    public function getBlokAttribute()
    {
        $parts = explode('.', $this->nomor_csr);
        return isset($parts[1]) ? (int) $parts[1] : null;
    }

    // Relasi ke mata kuliah
    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }

    // Scope untuk mata kuliah yang tersedia
    public function scopeAvailable($query)
    {
        return $query->where('status', 'available');
    }

    // Scope untuk mata kuliah yang sudah ditugaskan
    public function scopeAssigned($query)
    {
        return $query->where('status', 'assigned');
    }

    // Scope untuk mata kuliah yang selesai
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "CSR {$this->nomor_csr} ({$this->nama}) pada Mata Kuliah {$this->mata_kuliah_kode} telah di-{$eventName}");
    }
}
