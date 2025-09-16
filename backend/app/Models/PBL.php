<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\PBLMapping;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class PBL extends Model
{
    use LogsActivity;

    protected $table = 'pbls';

    protected $fillable = [
        'mata_kuliah_kode',
        'modul_ke',
        'nama_modul',
    ];

    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'mata_kuliah_kode', 'kode');
    }

    public function mappings()
    {
        return $this->hasMany(PBLMapping::class, 'pbl_id');
    }

    public function jadwalPBL()
    {
        return $this->hasMany(JadwalPBL::class, 'pbl_id');
    }

    public function dosen()
    {
        return $this->belongsToMany(User::class, 'pbl_mappings', 'pbl_id', 'dosen_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "PBL Modul {$this->modul_ke} ({$this->nama_modul}) pada Mata Kuliah {$this->mata_kuliah_kode} telah di-{$eventName}");
    }
}
