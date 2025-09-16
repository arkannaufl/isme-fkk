<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserReplyBookmark extends Model
{
    protected $table = 'user_reply_bookmarks';

    protected $fillable = [
        'user_id',
        'forum_reply_id'
    ];

    /**
     * Get the user who bookmarked this reply
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the reply that was bookmarked
     */
    public function reply(): BelongsTo
    {
        return $this->belongsTo(ForumReply::class, 'forum_reply_id');
    }
}
