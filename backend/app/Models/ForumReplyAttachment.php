<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ForumReplyAttachment extends Model
{
    use HasFactory;

    protected $fillable = [
        'forum_reply_id',
        'filename',
        'original_name',
        'file_path',
        'file_type',
        'file_size',
    ];

    protected $casts = [
        'file_size' => 'integer',
    ];

    public function forumReply()
    {
        return $this->belongsTo(ForumReply::class);
    }

    public function getHumanFileSizeAttribute()
    {
        $bytes = $this->file_size;
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }

    public function getIsImageAttribute()
    {
        return str_starts_with($this->file_type, 'image/');
    }

    public function getIsVideoAttribute()
    {
        return str_starts_with($this->file_type, 'video/');
    }

    public function getIsDocumentAttribute()
    {
        return in_array($this->file_type, [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain'
        ]);
    }

    public function getIsArchiveAttribute()
    {
        return in_array($this->file_type, [
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed'
        ]);
    }
}
