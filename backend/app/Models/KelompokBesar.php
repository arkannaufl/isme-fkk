<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class KelompokBesar extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'kelompok_besar';

    protected $fillable = [
        'semester',
        'mahasiswa_id'
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Kelompok Besar Mahasiswa ID {$this->mahasiswa_id} (Semester {$this->semester}) telah di-{$eventName}");
    }

    /**
     * Relasi ke mahasiswa
     */
    public function mahasiswa()
    {
        return $this->belongsTo(User::class, 'mahasiswa_id');
    }

    /**
     * Scope untuk semester tertentu
     */
    public function scopeBySemester($query, $semester)
    {
        return $query->where('semester', $semester);
    }

    /**
     * Scope untuk mahasiswa tertentu
     */
    public function scopeByMahasiswa($query, $mahasiswaId)
    {
        return $query->where('mahasiswa_id', $mahasiswaId);
    }

    /**
     * Cek apakah mahasiswa sudah ada di semester lain
     */
    public static function isMahasiswaInOtherSemester($mahasiswaId, $currentSemester)
    {
        return self::where('mahasiswa_id', $mahasiswaId)
                   ->where('semester', '!=', $currentSemester)
                   ->exists();
    }

    /**
     * Dapatkan semester tempat mahasiswa terdaftar
     */
    public static function getMahasiswaSemester($mahasiswaId)
    {
        $kelompok = self::where('mahasiswa_id', $mahasiswaId)->first();
        return $kelompok ? $kelompok->semester : null;
    }

    /**
     * Relasi ke jadwal kuliah besar (tidak digunakan karena kelompok_besar_id sekarang menyimpan semester)
     */
    // public function jadwalKuliahBesar()
    // {
    //     return $this->hasMany(JadwalKuliahBesar::class, 'kelompok_besar_id');
    // }
} 