<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MateriKuliah extends Model
{
    protected $table = 'materi_pembelajaran';

    protected $fillable = [
        'kode_mata_kuliah',
        'filename',
        'judul',
        'file_type',
        'file_size',
        'file_path',
        'upload_date',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'upload_date' => 'datetime',
    ];

    public function mataKuliah()
    {
        return $this->belongsTo(MataKuliah::class, 'kode_mata_kuliah', 'kode');
    }
}
