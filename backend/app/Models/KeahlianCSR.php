<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KeahlianCSR extends Model
{
    protected $table = 'keahlian_csr';
    
    protected $fillable = [
        'csr_id',
        'keahlian'
    ];

    public function csr(): BelongsTo
    {
        return $this->belongsTo(CSR::class);
    }
}
