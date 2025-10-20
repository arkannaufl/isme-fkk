<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, LogsActivity;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'username',
        'email',
        'email_verified',
        'password',
        'avatar',
        'nip',
        'nid',
        'nidn',
        'nuptk',
        'nim',
        'gender',
        'ipk',
        'status',
        'angkatan',
        'telp',
        'ket',
        'role',
        'kompetensi',
        'keahlian',
        'is_logged_in',
        'current_token',
        'semester',
        'tahun_ajaran_masuk_id',
        'semester_masuk',
        'matkul_ketua_id',
        'matkul_anggota_id',
        'peran_kurikulum_mengajar',
        'peran_utama',
        'is_veteran',
        'veteran_notes',
        'veteran_set_at',
        'veteran_set_by',
        'veteran_semester',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'kompetensi' => 'array',
            'keahlian' => 'array',
            'is_veteran' => 'boolean',
            'veteran_set_at' => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontLogIfAttributesChangedOnly(['password', 'current_token', 'remember_token', 'is_logged_in', 'updated_at'])
            ->setDescriptionForEvent(fn(string $eventName) => "User {$this->name} telah di-{$eventName}");
    }

    public function matkulKetua()
    {
        return $this->belongsTo(MataKuliah::class, 'matkul_ketua_id', 'kode');
    }

    public function matkulAnggota()
    {
        return $this->belongsTo(MataKuliah::class, 'matkul_anggota_id', 'kode');
    }

    public function dosenPeran()
    {
        return $this->hasMany(DosenPeran::class, 'user_id');
    }

    public function tahunAjaranMasuk()
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran_masuk_id');
    }

    // Relationship untuk absensi PBL
    public function absensiPBL()
    {
        return $this->hasMany(AbsensiPBL::class, 'mahasiswa_npm', 'nim');
    }

    // Relationship untuk absensi jurnal
    public function absensiJurnal()
    {
        return $this->hasMany(AbsensiJurnal::class, 'mahasiswa_nim', 'nim');
    }

    // Relationship untuk penilaian jurnal
    public function penilaianJurnal()
    {
        return $this->hasMany(PenilaianJurnal::class, 'mahasiswa_nim', 'nim');
    }

    /**
     * Get all bookmarks for this user
     */
    public function bookmarks()
    {
        return $this->hasMany(UserReplyBookmark::class);
    }

    /**
     * Get all bookmarked replies for this user
     */
    public function bookmarkedReplies()
    {
        return $this->belongsToMany(ForumReply::class, 'user_reply_bookmarks', 'user_id', 'forum_reply_id')
            ->withTimestamps();
    }

    /**
     * Get the user who set this user as veteran
     */
    public function veteranSetBy()
    {
        return $this->belongsTo(User::class, 'veteran_set_by');
    }

    /**
     * Get the kelompok kecil for this mahasiswa
     */
    public function kelompokKecil()
    {
        return $this->belongsTo(KelompokKecil::class, 'kelompok_kecil_id');
    }

    /**
     * Get the kelompok besar for this mahasiswa
     */
    public function kelompokBesar()
    {
        return $this->belongsTo(KelompokBesar::class, 'kelompok_besar_id');
    }
}
