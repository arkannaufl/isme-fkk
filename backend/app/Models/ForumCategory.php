<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Str;

class ForumCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'icon',
        'color',
        'is_default',
        'is_active',
        'permissions',
        'sort_order',
        'created_by',
    ];

    protected $casts = [
        'permissions' => 'array',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($category) {
            if (empty($category->slug)) {
                $category->slug = Str::slug($category->name);
            }
        });
    }

    /**
     * Relationship ke User yang membuat kategori
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Relationship ke Forum yang ada di kategori ini
     */
    public function forums(): HasMany
    {
        return $this->hasMany(Forum::class, 'category_id');
    }

    /**
     * Scope untuk kategori yang aktif
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope untuk kategori default
     */
    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }

    /**
     * Scope untuk kategori custom
     */
    public function scopeCustom($query)
    {
        return $query->where('is_default', false);
    }

    /**
     * Cek apakah user bisa membuat forum di kategori ini
     */
    public function canUserCreateForum(User $user): bool
    {
        if (!$this->permissions) {
            return false;
        }

        $userRole = $user->role ?? $user->roles->first()?->name;

        return in_array($userRole, $this->permissions);
    }

    /**
     * Get total forums count
     */
    public function getForumsCountAttribute(): int
    {
        return $this->forums()->count();
    }

    /**
     * Get active forums count
     */
    public function getActiveForumsCountAttribute(): int
    {
        return $this->forums()->where('status', 'active')->count();
    }
}
