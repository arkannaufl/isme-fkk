<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class KelompokKecil extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'kelompok_kecil';

    protected $fillable = [
        'semester',
        'nama_kelompok',
        'mahasiswa_id',
        'jumlah_kelompok'
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Kelompok Kecil {$this->nama_kelompok} (Semester {$this->semester}) telah di-{$eventName}");
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
     * Scope untuk kelompok tertentu
     */
    public function scopeByKelompok($query, $namaKelompok)
    {
        return $query->where('nama_kelompok', $namaKelompok);
    }

    /**
     * Scope untuk mahasiswa tertentu
     */
    public function scopeByMahasiswa($query, $mahasiswaId)
    {
        return $query->where('mahasiswa_id', $mahasiswaId);
    }

    /**
     * Dapatkan daftar kelompok yang ada di semester tertentu
     */
    public static function getKelompokList($semester)
    {
        return self::where('semester', $semester)
                   ->distinct()
                   ->pluck('nama_kelompok')
                   ->sort()
                   ->values();
    }

    /**
     * Dapatkan mahasiswa dalam kelompok tertentu
     */
    public static function getMahasiswaInKelompok($semester, $namaKelompok)
    {
        return self::with('mahasiswa')
                   ->where('semester', $semester)
                   ->where('nama_kelompok', $namaKelompok)
                   ->get()
                   ->pluck('mahasiswa');
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
     * Dapatkan statistik kelompok
     */
    public static function getKelompokStats($semester)
    {
        $kelompokList = self::getKelompokList($semester);
        
        return $kelompokList->map(function($namaKelompok) use ($semester) {
            $mahasiswa = self::getMahasiswaInKelompok($semester, $namaKelompok);
            
            $lakiLaki = $mahasiswa->where('gender', 'Laki-laki')->count();
            $perempuan = $mahasiswa->where('gender', 'Perempuan')->count();
            $avgIPK = $mahasiswa->avg('ipk');
            
            return [
                'kelompok' => $namaKelompok,
                'jumlahMahasiswa' => $mahasiswa->count(),
                'lakiLaki' => $lakiLaki,
                'perempuan' => $perempuan,
                'avgIPK' => round($avgIPK, 2)
            ];
        });
    }
} 