<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class CSRMapping extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'csr_mappings';
    protected $fillable = [
        'csr_id',
        'dosen_id',
        'keahlian',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "CSR Mapping Dosen ID {$this->dosen_id} ke CSR ID {$this->csr_id} telah di-{$eventName}");
    }

    public function csr()
    {
        return $this->belongsTo(CSR::class, 'csr_id');
    }

    public function dosen()
    {
        return $this->belongsTo(User::class, 'dosen_id');
    }
}
