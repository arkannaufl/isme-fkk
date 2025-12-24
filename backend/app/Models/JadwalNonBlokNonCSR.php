<?php

namespace App\Models;

use App\Traits\HasSemesterScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class JadwalNonBlokNonCSR extends Model
{
    use HasFactory, LogsActivity, HasSemesterScope;

    protected $table = 'jadwal_non_blok_non_csr';

    protected $fillable = [
        'semester_id',
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
        'pembimbing_id',
        'komentator_ids',
        'penguji_ids',
        'ruangan_id',
        'kelompok_besar_id',
        'kelompok_besar_antara_id',
        'mahasiswa_nims',
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
        'komentator_ids' => 'array',
        'penguji_ids' => 'array',
        'mahasiswa_nims' => 'array',
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

    public function pembimbing()
    {
        return $this->belongsTo(User::class, 'pembimbing_id');
    }

    public function komentator()
    {
        // Relasi ke komentator berdasarkan komentator_ids (array)
        if ($this->komentator_ids && is_array($this->komentator_ids)) {
            return User::whereIn('id', $this->komentator_ids);
        }
        return User::whereRaw('1 = 0'); // Return empty query if no komentator_ids
    }

    public function penguji()
    {
        // Relasi ke penguji berdasarkan penguji_ids (array)
        if ($this->penguji_ids && is_array($this->penguji_ids)) {
            return User::whereIn('id', $this->penguji_ids);
        }
        return User::whereRaw('1 = 0'); // Return empty query if no penguji_ids
    }

    public function mahasiswa()
    {
        // Relasi ke mahasiswa berdasarkan NIM
        return User::whereIn('nim', $this->mahasiswa_nims ?? [])->where('role', 'mahasiswa');
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
