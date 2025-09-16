<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class Kelas extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'kelas';

    protected $fillable = [
        'semester',
        'nama_kelas',
        'deskripsi'
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Kelas {$this->nama_kelas} (Semester {$this->semester}) telah di-{$eventName}");
    }

    /**
     * Relasi ke kelompok kecil melalui tabel pivot
     */
    public function kelompokKecil()
    {
        return $this->belongsToMany(KelompokKecil::class, 'kelas_kelompok', 'kelas_id', 'nama_kelompok', 'id', 'nama_kelompok')
                    ->wherePivot('semester', $this->semester);
    }

    /**
     * Scope untuk semester tertentu
     */
    public function scopeBySemester($query, $semester)
    {
        return $query->where('semester', $semester);
    }

    /**
     * Scope untuk nama kelas tertentu
     */
    public function scopeByNamaKelas($query, $namaKelas)
    {
        return $query->where('nama_kelas', $namaKelas);
    }

    /**
     * Dapatkan daftar kelas yang ada di semester tertentu
     */
    public static function getKelasList($semester)
    {
        return self::where('semester', $semester)
                   ->orderBy('nama_kelas', 'asc')
                   ->get();
    }

    /**
     * Dapatkan kelompok yang ada di kelas ini
     */
    public function getKelompokIds()
    {
        return DB::table('kelas_kelompok')
                  ->where('kelas_id', $this->id)
                  ->pluck('nama_kelompok')
                  ->toArray();
    }

    /**
     * Dapatkan mahasiswa dalam kelas ini
     */
    public function getMahasiswa()
    {
        $kelompokIds = $this->getKelompokIds();
        
        return KelompokKecil::with('mahasiswa')
                           ->where('semester', $this->semester)
                           ->whereIn('nama_kelompok', $kelompokIds)
                           ->get()
                           ->groupBy('nama_kelompok');
    }
} 