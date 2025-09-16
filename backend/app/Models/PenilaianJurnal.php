<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PenilaianJurnal extends Model
{
    protected $table = 'penilaian_jurnal';

    protected $fillable = [
        'mata_kuliah_kode',
        'kelompok_kecil_nama',
        'jurnal_reading_id',
        'mahasiswa_nim',
        'nilai_keaktifan',
        'nilai_laporan',
        'tanggal_paraf',
        'signature_paraf',
        'nama_tutor',
    ];

    protected $casts = [
        'tanggal_paraf' => 'date',
        'nilai_keaktifan' => 'integer',
        'nilai_laporan' => 'integer',
    ];

    // Relationships
    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }

    public function jurnalReading()
    {
        return $this->belongsTo(JadwalJurnalReading::class, 'jurnal_reading_id');
    }
}
