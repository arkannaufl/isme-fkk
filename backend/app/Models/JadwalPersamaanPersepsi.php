<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class JadwalPersamaanPersepsi extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'jadwal_persamaan_persepsi';

    protected $fillable = [
        'mata_kuliah_kode',
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'jumlah_sesi',
        'dosen_ids',
        'koordinator_ids',
        'ruangan_id',
        'use_ruangan',
        'topik',
        'status_konfirmasi',
        'alasan_konfirmasi',
        'penilaian_submitted',
        'created_by',
    ];

    protected $casts = [
        'dosen_ids' => 'array',
        'koordinator_ids' => 'array',
        'penilaian_submitted' => 'boolean',
        'use_ruangan' => 'boolean',
    ];

    // Relasi
    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }

    public function ruangan()
    {
        return $this->belongsTo(Ruangan::class, 'ruangan_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function absensi()
    {
        return $this->hasMany(AbsensiPersamaanPersepsi::class, 'jadwal_persamaan_persepsi_id');
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
        return '';
    }

    /**
     * Get dosen with their roles for this schedule
     */
    public function getDosenWithRolesAttribute()
    {
        if (!$this->dosen_ids || !is_array($this->dosen_ids)) {
            return [];
        }

        $mataKuliah = $this->mataKuliah;
        if (!$mataKuliah) {
            return [];
        }

        $dosen = User::whereIn('id', $this->dosen_ids)
            ->with(['dosenPeran' => function ($query) use ($mataKuliah) {
                $query->where('blok', $mataKuliah->blok)
                    ->where('semester', $mataKuliah->semester);
            }])
            ->get();

        return $dosen->map(function ($d) use ($mataKuliah) {
            $peran = $d->dosenPeran->first(function ($p) use ($mataKuliah) {
                return $p->blok == $mataKuliah->blok && $p->semester == $mataKuliah->semester;
            });

            return [
                'id' => $d->id,
                'name' => $d->name,
                'peran' => $peran ? $peran->tipe_peran : 'dosen_mengajar',
                'peran_display' => $peran ? $this->getPeranDisplay($peran->tipe_peran) : 'Dosen Mengajar',
            ];
        })->toArray();
    }

    /**
     * Helper to get display text for peran
     */
    private function getPeranDisplay($tipePeran)
    {
        switch ($tipePeran) {
            case 'koordinator':
                return 'Koordinator';
            case 'tim_blok':
                return 'Tim Blok';
            case 'mengajar':
                return 'Dosen Mengajar';
            default:
                return 'Dosen Mengajar';
        }
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Jadwal Persamaan Persepsi telah di-{$eventName}");
    }
}

