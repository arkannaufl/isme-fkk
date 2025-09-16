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
        Schema::create('jadwal_jurnal_reading', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->date('tanggal');
            $table->string('jam_mulai');
            $table->string('jam_selesai');
            $table->integer('jumlah_sesi')->default(1);
            $table->unsignedBigInteger('kelompok_kecil_id')->nullable();
            $table->unsignedBigInteger('kelompok_kecil_antara_id')->nullable();
            $table->unsignedBigInteger('dosen_id')->nullable();
            $table->json('dosen_ids')->nullable();
            $table->unsignedBigInteger('ruangan_id');
            $table->string('topik');
            $table->string('file_jurnal')->nullable();
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa'])->default('belum_konfirmasi');
            $table->text('alasan_konfirmasi')->nullable();
            $table->timestamps();

            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
            $table->foreign('kelompok_kecil_id')->references('id')->on('kelompok_kecil')->onDelete('cascade');
            $table->foreign('dosen_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('ruangan_id')->references('id')->on('ruangan')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jadwal_jurnal_reading');
    }
};
