<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ForumReply extends Model
{
    use HasFactory;

    protected $fillable = [
        'forum_id',
        'user_id',
        'parent_id',
        'content',
        'attachments',
        'is_anonymous',
        'status',
        'likes_count',
        'edited_at',
        'edited_by',
    ];

    protected $casts = [
        'attachments' => 'array',
        'is_anonymous' => 'boolean',
        'edited_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::created(function ($reply) {
            // Update forum replies count dan last activity
            $forum = $reply->forum;
            $forum->updateRepliesCount();
            $forum->last_reply_by = $reply->user_id;
            $forum->last_activity_at = now();
            $forum->save();
        });

        static::deleted(function ($reply) {
            // Update forum replies count setelah reply dihapus
            $forum = $reply->forum;
            $forum->updateRepliesCount();
            $forum->save();
        });
    }

    /**
     * Relationship ke Forum
     */
    public function forum(): BelongsTo
    {
        return $this->belongsTo(Forum::class, 'forum_id');
    }

    /**
     * Relationship ke User yang membuat reply
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Relationship ke User yang mengedit reply
     */
    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'edited_by');
    }

    /**
     * Relationship ke parent reply (untuk nested replies)
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(ForumReply::class, 'parent_id');
    }

    /**
     * Relationship ke child replies (replies ke reply ini)
     */
    public function children(): HasMany
    {
        return $this->hasMany(ForumReply::class, 'parent_id')->where('status', 'active');
    }

    /**
     * Relationship ke attachments
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(ForumReplyAttachment::class);
    }

    /**
     * Relationship ke semua child replies (termasuk deleted)
     */
    public function allChildren(): HasMany
    {
        return $this->hasMany(ForumReply::class, 'parent_id');
    }

    /**
     * Scope untuk reply yang aktif
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope untuk reply berdasarkan forum
     */
    public function scopeByForum($query, $forumId)
    {
        return $query->where('forum_id', $forumId);
    }

    /**
     * Scope untuk reply berdasarkan user
     */
    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope untuk reply level pertama (bukan reply ke reply)
     */
    public function scopeTopLevel($query)
    {
        return $query->whereNull('parent_id');
    }

    /**
     * Scope untuk nested replies (reply ke reply)
     */
    public function scopeNested($query)
    {
        return $query->whereNotNull('parent_id');
    }

    /**
     * Cek apakah reply sudah diedit
     */
    public function getIsEditedAttribute(): bool
    {
        return $this->edited_at !== null;
    }

    /**
     * Get time ago untuk created_at
     */
    public function getCreatedAgoAttribute(): string
    {
        return $this->created_at->diffForHumans();
    }

    /**
     * Get time ago untuk edited_at
     */
    public function getEditedAgoAttribute(): ?string
    {
        return $this->edited_at ? $this->edited_at->diffForHumans() : null;
    }

    /**
     * Cek apakah user bisa edit reply ini
     */
    public function canUserEdit(User $user): bool
    {
        // Pemilik reply bisa edit
        if ($this->user_id == $user->id) {
            return true;
        }

        // Tim akademik bisa edit semua
        $userRole = $user->role;
        return in_array($userRole, ['tim_akademik', 'super_admin', 'koordinator', 'tim_blok']);
    }

    /**
     * Cek apakah user bisa delete reply ini
     */
    public function canUserDelete(User $user): bool
    {
        return $this->canUserEdit($user);
    }

    /**
     * Get nested level (untuk indentation)
     */
    public function getNestedLevelAttribute(): int
    {
        $level = 0;
        $parent = $this->parent;

        while ($parent) {
            $level++;
            $parent = $parent->parent;
        }

        return $level;
    }

    /**
     * Relationship ke ForumReplyLike
     */
    public function likes(): HasMany
    {
        return $this->hasMany(ForumReplyLike::class);
    }

    /**
     * Update likes count
     */
    public function updateLikesCount()
    {
        $this->likes_count = $this->likes()->count();
        $this->save();
    }

    /**
     * Toggle like untuk user tertentu
     */
    public function toggleLike($userId)
    {
        $existingLike = $this->likes()->where('user_id', $userId)->first();

        if ($existingLike) {
            // Unlike
            $existingLike->delete();
            $this->decrement('likes_count');
            return false; // unliked
        } else {
            // Like
            $this->likes()->create(['user_id' => $userId]);
            $this->increment('likes_count');
            return true; // liked
        }
    }

    /**
     * Cek apakah user sudah like reply ini
     */
    public function isLikedByUser($userId)
    {
        return $this->likes()->where('user_id', $userId)->exists();
    }

    /**
     * Get all bookmarks for this reply
     */
    public function bookmarks()
    {
        return $this->hasMany(UserReplyBookmark::class, 'forum_reply_id');
    }

    /**
     * Cek apakah user sudah bookmark reply ini
     */
    public function isBookmarkedByUser($userId)
    {
        return $this->bookmarks()->where('user_id', $userId)->exists();
    }
}
