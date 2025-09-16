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
        Schema::create('riwayat_konfirmasi_dosen', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dosen_id')->constrained('users')->onDelete('cascade');
            $table->string('jadwal_type'); // pbl, kuliah_besar, praktikum, agenda_khusus, jurnal
            $table->unsignedBigInteger('jadwal_id'); // ID dari jadwal yang dikonfirmasi
            $table->string('mata_kuliah_kode');
            $table->string('mata_kuliah_nama');
            $table->date('tanggal');
            $table->string('jam_mulai');
            $table->string('jam_selesai');
            $table->string('ruangan')->nullable();
            $table->text('materi')->nullable();
            $table->text('topik')->nullable();
            $table->text('agenda')->nullable();
            $table->string('kelas_praktikum')->nullable(); // untuk praktikum
            $table->enum('status_konfirmasi', ['bisa', 'tidak_bisa']);
            $table->text('alasan_konfirmasi')->nullable();
            $table->timestamp('waktu_konfirmasi');
            $table->timestamps();
            
            $table->index(['dosen_id', 'jadwal_type']);
            $table->index(['tanggal', 'status_konfirmasi']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('riwayat_konfirmasi_dosen');
    }
};
