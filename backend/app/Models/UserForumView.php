<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserForumView extends Model
{
    protected $fillable = [
        'user_id',
        'forum_id',
        'viewed_at',
    ];

    protected $table = 'user_forum_views';

    protected $casts = [
        'viewed_at' => 'datetime',
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
