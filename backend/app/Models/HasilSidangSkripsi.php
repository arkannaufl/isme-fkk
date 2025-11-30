<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HasilSidangSkripsi extends Model
{
    use HasFactory;

    protected $connection = 'mysql';
    protected $table = 'hasil_sidang_skripsi';

    protected $fillable = [
        'jadwal_id',
        'mahasiswa_id',
        'moderator_id',
        'judul_skripsi',
        'keputusan',
        'catatan_perbaikan',
        'is_finalized',
        'finalized_at',
        'finalized_by',
    ];

    protected $casts = [
        'is_finalized' => 'boolean',
        'finalized_at' => 'datetime',
    ];

    const KEPUTUSAN_TIDAK_LULUS = 'tidak_lulus';
    const KEPUTUSAN_LULUS_TANPA_PERBAIKAN = 'lulus_tanpa_perbaikan';
    const KEPUTUSAN_LULUS_DENGAN_PERBAIKAN = 'lulus_dengan_perbaikan';

    public function jadwal()
    {
        return $this->belongsTo(JadwalNonBlokNonCSR::class, 'jadwal_id');
    }

    public function moderator()
    {
        return $this->belongsTo(User::class, 'moderator_id');
    }

    public function finalizedBy()
    {
        return $this->belongsTo(User::class, 'finalized_by');
    }

    public static function getKeputusanLabel(string $keputusan): string
    {
        return match ($keputusan) {
            self::KEPUTUSAN_TIDAK_LULUS => 'Tidak Lulus',
            self::KEPUTUSAN_LULUS_TANPA_PERBAIKAN => 'Lulus Tanpa Perbaikan',
            self::KEPUTUSAN_LULUS_DENGAN_PERBAIKAN => 'Lulus Dengan Perbaikan',
            default => $keputusan,
        };
    }
}
