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
        Schema::create('jadwal_praktikum', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->string('materi');
            $table->longText('topik')->nullable();
            $table->unsignedBigInteger('kelompok_kecil_id');
            $table->unsignedBigInteger('ruangan_id');
            $table->date('tanggal');
            $table->string('jam_mulai');
            $table->string('jam_selesai');
            $table->integer('jumlah_sesi')->default(1);
            $table->boolean('penilaian_submitted')->default(false);
            $table->unsignedBigInteger('penilaian_submitted_by')->nullable();
            $table->timestamp('penilaian_submitted_at')->nullable();
            $table->boolean('qr_enabled')->default(false);
            $table->text('koordinator_signature')->nullable();
            $table->text('status_konfirmasi')->nullable();
            $table->text('alasan_konfirmasi')->nullable();
            $table->text('alasan_asli')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->string('siakad_kurikulum')->nullable();
            $table->string('siakad_kode_mk')->nullable();
            $table->string('siakad_nama_kelas')->nullable();
            $table->string('siakad_jenis_pertemuan')->nullable();
            $table->string('siakad_metode')->nullable();
            $table->string('siakad_dosen_pengganti')->nullable();
            $table->unsignedBigInteger('semester_id')->nullable();
            $table->timestamps();

            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
            $table->foreign('kelompok_kecil_id')->references('id')->on('kelompok_kecil')->onDelete('cascade');
            $table->foreign('ruangan_id')->references('id')->on('ruangan')->onDelete('cascade');
            $table->foreign('penilaian_submitted_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('semester_id')->references('id')->on('semesters')->onDelete('restrict');
            $table->index('semester_id');
            $table->index(['mata_kuliah_kode', 'tanggal']);
            $table->index(['kelompok_kecil_id', 'tanggal']);
            $table->index(['ruangan_id', 'tanggal']);
            $table->index('tanggal');
            $table->index('jam_mulai');
        });

        // Tabel untuk relasi many-to-many antara jadwal praktikum dan dosen
        Schema::create('jadwal_praktikum_dosen', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_praktikum_id');
            $table->unsignedBigInteger('dosen_id');
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa', 'waiting_reschedule'])->default('belum_konfirmasi');
            $table->text('alasan_konfirmasi')->nullable();
            $table->enum('status_reschedule', ['waiting', 'approved', 'rejected'])->nullable();
            $table->text('reschedule_reason')->nullable();
            $table->timestamps();

            $table->foreign('jadwal_praktikum_id')->references('id')->on('jadwal_praktikum')->onDelete('cascade');
            $table->foreign('dosen_id')->references('id')->on('users')->onDelete('cascade');
            $table->unique(['jadwal_praktikum_id', 'dosen_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jadwal_praktikum_dosen');
        Schema::dropIfExists('jadwal_praktikum');
    }
};

