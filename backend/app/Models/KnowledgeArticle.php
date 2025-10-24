<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KnowledgeArticle extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'content',
        'images',
        'category',
        'tags',
        'is_published',
        'author_id',
    ];

    protected $casts = [
        'images' => 'array',
        'tags' => 'array',
        'is_published' => 'boolean',
    ];

    /**
     * Get the author of the article
     */
    public function author()
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
