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
            $table->text('veteran_notes')->nullable();
            $table->timestamp('veteran_set_at')->nullable();
            $table->unsignedBigInteger('veteran_set_by')->nullable();
            $table->string('veteran_semester')->nullable()->comment('Semester dimana veteran dipilih untuk dikelompokkan');
            $table->string('angkatan')->nullable();
            $table->string('name');
            $table->string('username');
            $table->string('email')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('telp')->nullable();
            $table->string('ket')->nullable();
            $table->enum('role', ['super_admin', 'tim_akademik', 'dosen', 'mahasiswa'])->default('mahasiswa');
            $table->string('password');
            $table->string('avatar')->nullable();

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
