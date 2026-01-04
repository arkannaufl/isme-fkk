<?php

namespace App\Models;

use App\Traits\HasSemesterScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class JadwalPraktikum extends Model
{
    use HasFactory, LogsActivity, HasSemesterScope;

    protected $table = 'jadwal_praktikum';

    protected $fillable = [
        'semester_id',
        'mata_kuliah_kode',
        'materi',
        'topik',
        'kelompok_kecil_id',
        'ruangan_id',
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'jumlah_sesi',
        'created_by',
        'penilaian_submitted',
        'penilaian_submitted_by',
        'penilaian_submitted_at',
        'qr_enabled',
        'koordinator_signature',
    ];

    protected $casts = [
        'qr_enabled' => 'boolean',
        'penilaian_submitted' => 'boolean',
        'penilaian_submitted_at' => 'datetime',
        // SIAKAD fields
        'siakad_kurikulum',
        'siakad_kode_mk',
        'siakad_nama_kelas',
        'siakad_jenis_pertemuan',
        'siakad_metode',
        'siakad_dosen_pengganti',

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
    public function dosen()
    {
        return $this->belongsToMany(User::class, 'jadwal_praktikum_dosen', 'jadwal_praktikum_id', 'dosen_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function kelompokKecil()
    {
        return $this->belongsToMany(KelompokKecil::class, 'jadwal_praktikum_kelompok', 'jadwal_praktikum_id', 'kelompok_kecil_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "JadwalPraktikum telah di-{$eventName}");
    }
}
