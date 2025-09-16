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
        Schema::create('jadwal_non_blok_non_csr', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->date('tanggal');
            $table->string('jam_mulai');
            $table->string('jam_selesai');
            $table->integer('jumlah_sesi');
            $table->enum('jenis_baris', ['materi', 'agenda']);
            $table->string('agenda')->nullable(); // untuk agenda khusus
            $table->string('materi')->nullable(); // untuk jadwal materi
            $table->unsignedBigInteger('dosen_id')->nullable(); // untuk jadwal materi
            $table->json('dosen_ids')->nullable(); // untuk multiple dosen
            $table->unsignedBigInteger('ruangan_id')->nullable(); // Bisa null jika tidak menggunakan ruangan
            $table->unsignedBigInteger('kelompok_besar_id')->nullable(); // Menyimpan semester (1, 2, 3, dst.), bukan ID dari tabel kelompok_besar
            $table->unsignedBigInteger('kelompok_besar_antara_id')->nullable();
            $table->boolean('use_ruangan')->default(true); // Flag untuk menentukan apakah menggunakan ruangan atau tidak
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa'])->default('belum_konfirmasi');
            $table->text('alasan_konfirmasi')->nullable();
            $table->timestamps();

            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
            $table->foreign('dosen_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('ruangan_id')->references('id')->on('ruangan')->onDelete('cascade')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jadwal_non_blok_non_csr');
    }
}; 