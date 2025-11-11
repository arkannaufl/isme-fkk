<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppConversation extends Model
{
    protected $fillable = [
        'user_id',
        'phone',
        'jadwal_id',
        'jadwal_type',
        'state',
        'last_message',
        'metadata',
        'expires_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'expires_at' => 'datetime',
    ];

    /**
     * User yang memiliki conversation ini
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
