<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Forum extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'content',
        'slug',
        'category_id',
        'user_id',
        'status',
        'is_new',
        'is_edited',
        'edited_at',
        'tags',
        'views_count',
        'replies_count',
        'likes_count',
        'last_activity_at',
        'last_reply_by',
        'is_anonymous',
        'deadline',
        'target_audience',
        'access_type',
        'allowed_users',
    ];

    protected $casts = [
        'tags' => 'array',
        'target_audience' => 'array',
        'is_anonymous' => 'boolean',
        'last_activity_at' => 'datetime',
        'deadline' => 'datetime',
        'allowed_users' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($forum) {
            if (empty($forum->slug)) {
                $forum->slug = Str::slug($forum->title) . '-' . time();
            }
            $forum->last_activity_at = now();
        });

        static::updating(function ($forum) {
            $forum->last_activity_at = now();
        });
    }

    /**
     * Relationship ke ForumCategory
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ForumCategory::class, 'category_id');
    }

    /**
     * Relationship ke User yang membuat forum
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Relationship ke User yang terakhir reply
     */
    public function lastReplyUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_reply_by');
    }

    /**
     * Relationship ke ForumReply
     */
    public function replies(): HasMany
    {
        return $this->hasMany(ForumReply::class, 'forum_id')->where('status', 'active');
    }

    /**
     * Relationship ke semua ForumReply (termasuk deleted)
     */
    public function allReplies(): HasMany
    {
        return $this->hasMany(ForumReply::class, 'forum_id');
    }

    /**
     * Relationship ke UserForumView
     */
    public function userViews(): HasMany
    {
        return $this->hasMany(UserForumView::class);
    }

    /**
     * Relationship ke ForumLike
     */
    public function likes(): HasMany
    {
        return $this->hasMany(ForumLike::class);
    }

    /**
     * Get the attachments for the forum.
     */
    public function attachments()
    {
        return $this->hasMany(ForumAttachment::class);
    }

    /**
     * Scope untuk forum yang aktif
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope untuk forum yang pinned
     */
    public function scopePinned($query)
    {
        return $query->where('status', 'pinned');
    }

    /**
     * Scope untuk forum berdasarkan kategori
     */
    public function scopeByCategory($query, $categoryId)
    {
        return $query->where('category_id', $categoryId);
    }

    /**
     * Scope untuk forum berdasarkan user
     */
    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope untuk forum dengan keyword search
     */
    public function scopeSearch($query, $keyword)
    {
        return $query->where(function ($q) use ($keyword) {
            $q->where('title', 'like', '%' . $keyword . '%')
                ->orWhere('content', 'like', '%' . $keyword . '%');
        });
    }

    /**
     * Increment views count dengan tracking per user yang lebih cerdas
     */
    public function incrementViews($userId = null)
    {
        // Jika tidak ada user ID, tidak increment views
        if (!$userId) {
            return;
        }

        // Cek apakah user sudah pernah melihat forum ini
        $existingView = $this->userViews()
            ->where('user_id', $userId)
            ->first();

        if (!$existingView) {
            // User belum pernah melihat forum ini
            $this->userViews()->create([
                'user_id' => $userId,
                'viewed_at' => now(),
            ]);

            // Increment views count
            $this->increment('views_count');
            $this->touch();
        }
    }

    /**
     * Cek apakah forum baru untuk user tertentu
     */
    public function isNewForUser($userId): bool
    {
        if (!$userId) {
            return false;
        }

        return !$this->userViews()->where('user_id', $userId)->exists();
    }

    /**
     * Update replies count
     */
    public function updateRepliesCount()
    {
        $this->replies_count = $this->replies()->count();
        $this->save();
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
     * Cek apakah user sudah like forum ini
     */
    public function isLikedByUser($userId)
    {
        return $this->likes()->where('user_id', $userId)->exists();
    }

    /**
     * Cek apakah forum sudah deadline
     */
    public function getIsExpiredAttribute(): bool
    {
        return $this->deadline && Carbon::now()->isAfter($this->deadline);
    }

    /**
     * Get formatted deadline
     */
    public function getFormattedDeadlineAttribute(): ?string
    {
        return $this->deadline ? $this->deadline->format('d M Y H:i') : null;
    }

    /**
     * Get time ago for last activity
     */
    public function getLastActivityAgoAttribute(): string
    {
        return $this->last_activity_at ? $this->last_activity_at->diffForHumans() : '';
    }

    /**
     * Cek apakah user bisa edit forum ini
     */
    public function canUserEdit(User $user): bool
    {
        // Pemilik forum bisa edit
        if ($this->user_id == $user->id) {
            return true;
        }

        // Tim akademik bisa edit semua
        $userRole = $user->peran_utama ?? $user->role;
        return in_array($userRole, ['tim_akademik', 'super_admin', 'koordinator', 'tim_blok']);
    }

    /**
     * Cek apakah user bisa delete forum ini
     */
    public function canUserDelete(User $user): bool
    {
        return $this->canUserEdit($user);
    }

    /**
     * Relationship ke UserForumBookmark
     */
    public function bookmarks(): HasMany
    {
        return $this->hasMany(UserForumBookmark::class, 'forum_id');
    }

    /**
     * Relationship ke UserForumView
     */
    public function views(): HasMany
    {
        return $this->hasMany(UserForumView::class, 'forum_id');
    }

    /**
     * Cek apakah user sudah bookmark forum ini
     */
    public function isBookmarkedByUser($userId): bool
    {
        return $this->bookmarks()->where('user_id', $userId)->exists();
    }

    /**
     * Cek apakah user sudah pernah view forum ini
     */
    public function isViewedByUser($userId): bool
    {
        return $this->views()->where('user_id', $userId)->exists();
    }

    /**
     * Mark forum as viewed by user
     */
    public function markAsViewedByUser($userId): void
    {
        // Cek apakah sudah ada view
        if (!$this->isViewedByUser($userId)) {
            // Insert view baru
            $this->views()->create([
                'user_id' => $userId,
                'viewed_at' => now(),
            ]);

            // Increment views_count
            $this->increment('views_count');
        }
    }
}
