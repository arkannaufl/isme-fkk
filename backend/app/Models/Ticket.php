<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Ticket extends Model
{
    use LogsActivity;

    protected $fillable = [
        'ticket_number',
        'title',
        'description',
        'images',
        'category',
        'priority',
        'status',
        'assigned_to',
        'user_name',
        'user_email',
        'response_time',
        'resolution_time',
        'satisfaction_rating',
    ];

    protected $casts = [
        'images' => 'array',
        'response_time' => 'integer',
        'resolution_time' => 'integer',
        'satisfaction_rating' => 'integer',
    ];

    /**
     * Relationship to Developer
     */
    public function developer(): BelongsTo
    {
        return $this->belongsTo(Developer::class, 'assigned_to');
    }

    /**
     * Scope to filter by status
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to filter by priority
     */
    public function scopeByPriority($query, $priority)
    {
        return $query->where('priority', $priority);
    }

    /**
     * Scope to filter by user email
     */
    public function scopeByUser($query, $email)
    {
        return $query->where('user_email', $email);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "Ticket {$this->ticket_number} telah di-{$eventName}");
    }
}
