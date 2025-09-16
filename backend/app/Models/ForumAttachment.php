<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ForumAttachment extends Model
{
    use HasFactory;

    protected $fillable = [
        'forum_id',
        'filename',
        'original_name',
        'file_path',
        'file_type',
        'file_size',
    ];

    protected $casts = [
        'file_size' => 'integer',
    ];

    /**
     * Get the forum that owns the attachment.
     */
    public function forum()
    {
        return $this->belongsTo(Forum::class);
    }

    /**
     * Get the file size in human readable format.
     */
    public function getHumanFileSizeAttribute()
    {
        $bytes = $this->file_size;
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }

    /**
     * Check if the file is an image.
     */
    public function getIsImageAttribute()
    {
        return str_starts_with($this->file_type, 'image/');
    }

    /**
     * Check if the file is a video.
     */
    public function getIsVideoAttribute()
    {
        return str_starts_with($this->file_type, 'video/');
    }

    /**
     * Check if the file is a document.
     */
    public function getIsDocumentAttribute()
    {
        $documentTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
        ];

        return in_array($this->file_type, $documentTypes);
    }

    /**
     * Check if the file is an archive.
     */
    public function getIsArchiveAttribute()
    {
        $archiveTypes = [
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/x-tar',
            'application/gzip',
        ];

        return in_array($this->file_type, $archiveTypes);
    }
}
