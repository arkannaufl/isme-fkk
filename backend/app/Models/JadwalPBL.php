<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JadwalPBL extends Model
{
    use HasFactory;

    protected $table = 'jadwal_pbl';

    protected $fillable = [
        'mata_kuliah_kode',
        'pbl_id',
        'kelompok_kecil_id',
        'kelompok_kecil_antara_id',
        'dosen_id',
        'dosen_ids',
        'ruangan_id',
        'tanggal',
        'jam_mulai',
        'jam_selesai',
        'jumlah_sesi',
        'pbl_tipe',
        'status_konfirmasi',
        'penilaian_submitted',
        'penilaian_submitted_by',
        'penilaian_submitted_at',
    ];

    protected $casts = [
        'dosen_ids' => 'array',
        'penilaian_submitted' => 'boolean',
        'penilaian_submitted_at' => 'datetime',
    ];

    // Relasi
    public function mataKuliah() { return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode'); }
    public function modulPBL() { return $this->belongsTo(PBL::class, 'pbl_id'); }
    public function kelompokKecil() { return $this->belongsTo(KelompokKecil::class, 'kelompok_kecil_id'); }
    public function kelompokKecilAntara() { return $this->belongsTo(KelompokKecilAntara::class, 'kelompok_kecil_antara_id'); }
    public function dosen() { return $this->belongsTo(User::class, 'dosen_id'); }
    public function ruangan() { return $this->belongsTo(Ruangan::class, 'ruangan_id'); }
    public function penilaianSubmittedBy() { return $this->belongsTo(User::class, 'penilaian_submitted_by'); }

    // Relationship untuk penilaian PBL
    public function penilaianPBL()
    {
        return $this->hasMany(PenilaianPBL::class, 'mata_kuliah_kode', 'mata_kuliah_kode')
                    ->where('kelompok', $this->kelompok_kecil_id ?? '');
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
     * Reset penilaian submitted status
     * Dipanggil saat jadwal diubah oleh tim akademik/super admin
     */
    public function resetPenilaianSubmitted()
    {
        $this->update([
            'penilaian_submitted' => false,
            'penilaian_submitted_by' => null,
            'penilaian_submitted_at' => null,
        ]);
    }

    /**
     * Update penilaian data when PBL type changes
     * Dipanggil saat PBL 1 diubah ke PBL 2 atau sebaliknya
     */
    public function updatePenilaianForPBLTypeChange($oldPBLType, $newPBLType)
    {
        // Jika PBL 1 → PBL 2: tambah kolom peta_konsep
        if ($oldPBLType === 'PBL 1' && $newPBLType === 'PBL 2') {
            $this->addPetaKonsepToPenilaian();
        }
        // Jika PBL 2 → PBL 1: hapus kolom peta_konsep (optional)
        elseif ($oldPBLType === 'PBL 2' && $newPBLType === 'PBL 1') {
            $this->removePetaKonsepFromPenilaian();
        }
    }

    /**
     * Add peta_konsep column to existing penilaian data
     */
    private function addPetaKonsepToPenilaian()
    {
        // Update penilaian PBL yang sudah ada
        \App\Models\PenilaianPBL::where('mata_kuliah_kode', $this->mata_kuliah_kode)
            ->where('kelompok', $this->kelompok_kecil_id ?? '')
            ->where('pertemuan', $this->pbl_tipe)
            ->whereNull('peta_konsep') // Hanya yang belum ada peta_konsep
            ->update(['peta_konsep' => 0]); // Set default 0, wajib diisi ulang
    }

    /**
     * Remove peta_konsep column from existing penilaian data
     */
    private function removePetaKonsepFromPenilaian()
    {
        // Update penilaian PBL untuk menghapus peta_konsep
        \App\Models\PenilaianPBL::where('mata_kuliah_kode', $this->mata_kuliah_kode)
            ->where('kelompok', $this->kelompok_kecil_id ?? '')
            ->where('pertemuan', $this->pbl_tipe)
            ->update(['peta_konsep' => null]);
    }
}
