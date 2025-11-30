<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PenilaianSeminarProposal extends Model
{
    use HasFactory;

    protected $table = 'penilaian_seminar_proposal';

    protected $fillable = [
        'jadwal_id',
        'mahasiswa_id',
        'penguji_id',
        'peran_penguji',
        'nilai_penyajian_lisan',
        'nilai_sistematika_penulisan',
        'nilai_isi_tulisan',
        'nilai_originalitas',
        'nilai_tanya_jawab',
        'nilai_akhir',
        'catatan',
    ];

    protected $casts = [
        'nilai_penyajian_lisan' => 'decimal:2',
        'nilai_sistematika_penulisan' => 'decimal:2',
        'nilai_isi_tulisan' => 'decimal:2',
        'nilai_originalitas' => 'decimal:2',
        'nilai_tanya_jawab' => 'decimal:2',
        'nilai_akhir' => 'decimal:2',
    ];

    // Bobot untuk setiap aspek
    const BOBOT_PENYAJIAN_LISAN = 2;
    const BOBOT_SISTEMATIKA_PENULISAN = 1;
    const BOBOT_ISI_TULISAN = 3;
    const BOBOT_ORIGINALITAS = 1;
    const BOBOT_TANYA_JAWAB = 3;
    const TOTAL_BOBOT = 10;

    // Konversi nilai ke huruf
    public static function konversiNilaiHuruf($nilai)
    {
        if ($nilai >= 85) return 'A';
        if ($nilai >= 80) return 'A-';
        if ($nilai >= 75) return 'B+';
        if ($nilai >= 70) return 'B';
        if ($nilai >= 65) return 'B-';
        if ($nilai >= 60) return 'C+';
        if ($nilai >= 55) return 'C';
        if ($nilai >= 50) return 'C-';
        if ($nilai >= 45) return 'D';
        return 'E';
    }

    // Hitung nilai akhir per penguji
    public function hitungNilaiAkhir()
    {
        if (
            is_null($this->nilai_penyajian_lisan) ||
            is_null($this->nilai_sistematika_penulisan) ||
            is_null($this->nilai_isi_tulisan) ||
            is_null($this->nilai_originalitas) ||
            is_null($this->nilai_tanya_jawab)
        ) {
            return null;
        }

        $total = ($this->nilai_penyajian_lisan * self::BOBOT_PENYAJIAN_LISAN) +
                 ($this->nilai_sistematika_penulisan * self::BOBOT_SISTEMATIKA_PENULISAN) +
                 ($this->nilai_isi_tulisan * self::BOBOT_ISI_TULISAN) +
                 ($this->nilai_originalitas * self::BOBOT_ORIGINALITAS) +
                 ($this->nilai_tanya_jawab * self::BOBOT_TANYA_JAWAB);

        return round($total / self::TOTAL_BOBOT, 2);
    }

    // Relationships
    public function jadwal()
    {
        return $this->belongsTo(JadwalNonBlokNonCSR::class, 'jadwal_id');
    }

    public function mahasiswa()
    {
        return $this->belongsTo(User::class, 'mahasiswa_id');
    }

    public function penguji()
    {
        return $this->belongsTo(User::class, 'penguji_id');
    }
}

