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
            $table->string('topik')->nullable();
            $table->string('kelas_praktikum');
            $table->unsignedBigInteger('ruangan_id');
            $table->date('tanggal');
            $table->string('jam_mulai');
            $table->string('jam_selesai');
            $table->integer('jumlah_sesi')->default(1);
            $table->boolean('penilaian_submitted')->default(false);
            $table->unsignedBigInteger('penilaian_submitted_by')->nullable();
            $table->timestamp('penilaian_submitted_at')->nullable();
            $table->timestamps();

            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
            $table->foreign('ruangan_id')->references('id')->on('ruangan')->onDelete('cascade');
            $table->foreign('penilaian_submitted_by')->references('id')->on('users')->onDelete('set null');
        });

        // Tabel untuk relasi many-to-many antara jadwal praktikum dan dosen
        Schema::create('jadwal_praktikum_dosen', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_praktikum_id');
            $table->unsignedBigInteger('dosen_id');
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa'])->default('belum_konfirmasi');
            $table->text('alasan_konfirmasi')->nullable();
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
