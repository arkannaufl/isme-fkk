<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KelompokKecilAntara extends Model
{
    protected $table = 'kelompok_kecil_antara';
    
    protected $fillable = [
        'nama_kelompok',
        'mahasiswa_ids'
    ];

    protected $casts = [
        'mahasiswa_ids' => 'array'
    ];



    /**
     * Get the mahasiswa for this kelompok kecil antara
     */
    public function mahasiswa()
    {
        return User::whereIn('id', $this->mahasiswa_ids ?? [])->get();
    }
}
