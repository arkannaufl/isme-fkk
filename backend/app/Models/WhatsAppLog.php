<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppLog extends Model
{
    protected $fillable = [
        'phone',
        'message',
        'status',
        'response',
        'metadata',
        'sent_by',
    ];

    protected $casts = [
        'response' => 'array',
        'metadata' => 'array',
    ];

    /**
     * User yang mengirim pesan
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    /**
     * Scope untuk pesan terkirim
     */
    public function scopeSent($query)
    {
        return $query->where('status', 'sent');
    }

    /**
     * Scope untuk pesan gagal
     */
    public function scopeFailed($query)
    {
        return $query->where('status', 'failed');
    }

    /**
     * Scope untuk pesan masuk
     */
    public function scopeReceived($query)
    {
        return $query->where('status', 'received');
    }
}

