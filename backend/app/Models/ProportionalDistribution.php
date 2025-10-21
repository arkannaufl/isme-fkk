<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class ProportionalDistribution extends Model
{
    use LogsActivity;

    protected $table = 'proportional_distributions';

    protected $fillable = [
        'blok_id',
        'active_semester',
        'semester_needs',
        'semester_percentages',
        'semester_distribution',
        'total_dosen_available',
        'total_needs',
        'generated_at',
    ];

    protected $casts = [
        'semester_needs' => 'array',
        'semester_percentages' => 'array',
        'semester_distribution' => 'array',
        'generated_at' => 'datetime',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "ProportionalDistribution telah di-{$eventName}");
    }
}
