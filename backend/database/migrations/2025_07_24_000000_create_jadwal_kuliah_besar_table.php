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
        Schema::create('jadwal_kuliah_besar', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->string('materi')->nullable(); // keahlian/materi
            $table->string('topik')->nullable();
            $table->unsignedBigInteger('dosen_id')->nullable();
            $table->json('dosen_ids')->nullable(); // Array of dosen IDs for multiple dosen
            $table->unsignedBigInteger('ruangan_id');
            $table->unsignedBigInteger('kelompok_besar_id')->nullable(); // Menyimpan semester (1, 2, 3, dst.), bukan ID dari tabel kelompok_besar
            $table->unsignedBigInteger('kelompok_besar_antara_id')->nullable(); // For manual kelompok besar
            $table->date('tanggal');
            $table->string('jam_mulai');
            $table->string('jam_selesai');
            $table->integer('jumlah_sesi')->default(1);
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa'])->default('belum_konfirmasi');
            $table->text('alasan_konfirmasi')->nullable();
            $table->timestamps();

            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
            $table->foreign('dosen_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('ruangan_id')->references('id')->on('ruangan')->onDelete('cascade');
            $table->foreign('kelompok_besar_antara_id')->references('id')->on('kelompok_besar_antara')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jadwal_kuliah_besar');
    }
};
