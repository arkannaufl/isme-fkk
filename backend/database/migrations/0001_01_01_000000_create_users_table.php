<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('nip')->unique()->nullable();
            $table->string('nid')->unique()->nullable();
            $table->string('nidn')->nullable();
            $table->string('nuptk')->nullable();
            $table->string('nim')->unique()->nullable();
            $table->string('gender')->nullable();
            $table->float('ipk')->nullable();
            $table->string('status')->nullable();
            $table->boolean('is_veteran')->default(false);
            $table->boolean('is_multi_veteran')->default(false)->comment('Mahasiswa veteran yang bisa masuk ke lebih dari 1 semester');
            $table->text('veteran_notes')->nullable();
            $table->timestamp('veteran_set_at')->nullable();
            $table->unsignedBigInteger('veteran_set_by')->nullable();
            $table->string('veteran_semester')->nullable()->comment('Semester dimana veteran dipilih untuk dikelompokkan');
            $table->json('veteran_semesters')->nullable()->comment('Array semester dimana multi-veteran terdaftar');
            $table->json('veteran_history')->nullable()->comment('Array riwayat veteran dengan timestamp');
            $table->string('angkatan')->nullable();
            $table->string('name');
            $table->string('username');
            $table->string('email')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('telp')->nullable();
            $table->string('whatsapp_phone')->nullable()->comment('Nomor WhatsApp untuk Wablas (format: 62...)');
            $table->string('whatsapp_email')->nullable()->comment('Email untuk Wablas (harus sama dengan email verification)');
            $table->text('whatsapp_address')->nullable()->comment('Alamat untuk Wablas contact');
            $table->date('whatsapp_birth_day')->nullable()->comment('Tanggal lahir untuk Wablas contact (format: YYYY-mm-dd)');
            $table->timestamp('wablas_synced_at')->nullable()->comment('Timestamp terakhir sync ke Wablas');
            $table->enum('wablas_sync_status', ['pending', 'synced', 'failed'])->nullable()->comment('Status sync ke Wablas');
            $table->string('ket')->nullable();
            $table->string('role', 50)->default('mahasiswa');
            $table->string('password');
            $table->string('avatar')->nullable();
            $table->longText('signature_image')->nullable();
            $table->boolean('email_verified')->default(false);

            $table->integer('semester')->nullable();
            $table->unsignedBigInteger('tahun_ajaran_masuk_id')->nullable();
            $table->enum('semester_masuk', ['Ganjil', 'Genap'])->nullable();

            $table->json('kompetensi')->nullable();
            $table->json('keahlian')->nullable();
            $table->enum('peran_utama', ['koordinator', 'tim_blok', 'dosen_mengajar', 'standby'])->nullable();
            $table->string('matkul_ketua_id')->nullable();
            $table->string('matkul_anggota_id')->nullable();
            $table->text('peran_kurikulum_mengajar')->nullable();

            $table->boolean('is_logged_in')->default(false);
            $table->string('current_token')->nullable();

            $table->rememberToken();
            $table->timestamps();
            $table->unsignedInteger('csr_assignment_count')->default(0);
            $table->unsignedInteger('pbl_assignment_count')->default(0);

            // Composite unique indexes for (email, role) and (username, role)
            $table->unique(['email', 'role']);
            $table->unique(['username', 'role']);
            
            // Foreign key constraint for veteran_set_by
            $table->foreign('veteran_set_by')->references('id')->on('users')->onDelete('set null');
            
            // Indexes for frequently queried columns
            $table->index('role');
            $table->index('semester');
            $table->index('is_logged_in');
            $table->index('created_at');
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('username')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
