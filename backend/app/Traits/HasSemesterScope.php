<?php

namespace App\Traits;

use App\Models\Semester;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

trait HasSemesterScope
{
    /**
     * Boot the trait
     */
    protected static function bootHasSemesterScope()
    {
        // Auto-set semester_id saat create jika belum di-set
        static::creating(function ($model) {
            if (empty($model->semester_id) && Schema::hasColumn($model->getTable(), 'semester_id')) {
                $activeSemester = Semester::where('aktif', true)->first();
                if ($activeSemester) {
                    $model->semester_id = $activeSemester->id;
                }
            }
        });

        // Global scope untuk auto-filter berdasarkan semester aktif
        static::addGlobalScope('activeSemester', function (Builder $builder) {
            if (Schema::hasColumn($builder->getModel()->getTable(), 'semester_id')) {
                $activeSemester = Semester::where('aktif', true)->first();
                if ($activeSemester) {
                    $builder->where('semester_id', $activeSemester->id);
                }
            }
        });
    }

    /**
     * Scope untuk mendapatkan data tanpa filter semester (untuk admin/histori)
     */
    public function scopeWithoutSemesterFilter(Builder $query): Builder
    {
        return $query->withoutGlobalScope('activeSemester');
    }

    /**
     * Scope untuk mendapatkan data berdasarkan semester tertentu
     */
    public function scopeForSemester(Builder $query, $semesterId): Builder
    {
        return $query->withoutGlobalScope('activeSemester')
                     ->where('semester_id', $semesterId);
    }

    /**
     * Relasi ke Semester
     */
    public function semester()
    {
        return $this->belongsTo(Semester::class, 'semester_id');
    }
}

