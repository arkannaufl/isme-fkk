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
        Schema::create('jadwal_agenda_khusus', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->string('agenda');
            $table->unsignedBigInteger('ruangan_id')->nullable(); // Bisa null jika tidak menggunakan ruangan
            $table->unsignedBigInteger('kelompok_besar_id')->nullable(); // Menyimpan semester (1, 2, 3, dst.), bukan ID dari tabel kelompok_besar
            $table->unsignedBigInteger('kelompok_besar_antara_id')->nullable(); // Untuk semester antara
            $table->boolean('use_ruangan')->default(true); // Flag untuk menentukan apakah menggunakan ruangan atau tidak
            $table->date('tanggal');
            $table->string('jam_mulai');
            $table->string('jam_selesai');
            $table->integer('jumlah_sesi')->default(1);
            $table->timestamps();

            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
            $table->foreign('ruangan_id')->references('id')->on('ruangan')->onDelete('cascade');
            $table->foreign('kelompok_besar_antara_id')->references('id')->on('kelompok_besar_antara')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jadwal_agenda_khusus');
    }
};
