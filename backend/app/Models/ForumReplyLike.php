<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ForumReplyLike extends Model
{
    protected $fillable = [
        'user_id',
        'forum_reply_id',
    ];

    /**
     * Relationship ke User
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Relationship ke ForumReply
     */
    public function forumReply(): BelongsTo
    {
        return $this->belongsTo(ForumReply::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "ForumReplyLike telah di-{$eventName}");
    }
}
