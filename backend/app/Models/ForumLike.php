<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ForumLike extends Model
{
    protected $fillable = [
        'user_id',
        'forum_id',
    ];

    /**
     * Relationship ke User
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Relationship ke Forum
     */
    public function forum(): BelongsTo
    {
        return $this->belongsTo(Forum::class);
    }
}
