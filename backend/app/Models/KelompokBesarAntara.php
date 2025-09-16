<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KelompokBesarAntara extends Model
{
    protected $table = 'kelompok_besar_antara';

    protected $fillable = [
        'nama_kelompok',
        'mahasiswa_ids',
    ];

    protected $casts = [
        'mahasiswa_ids' => 'array',
    ];



    public function mahasiswa()
    {
        return User::whereIn('id', $this->mahasiswa_ids ?? []);
    }

    public function getMahasiswaAttribute()
    {
        return User::whereIn('id', $this->mahasiswa_ids ?? [])->get();
    }
}
