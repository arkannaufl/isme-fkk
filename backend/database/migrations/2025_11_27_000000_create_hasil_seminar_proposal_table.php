<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hasil_seminar_proposal', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_id');
            $table->unsignedBigInteger('mahasiswa_id');
            $table->unsignedBigInteger('moderator_id');
            $table->text('judul_skripsi');
            $table->enum('keputusan', ['tidak_lulus', 'lulus_tanpa_perbaikan', 'lulus_dengan_perbaikan']);
            $table->text('catatan_perbaikan')->nullable();
            $table->timestamps();

            $table->unique(['jadwal_id', 'mahasiswa_id'], 'unique_hasil_sempro');
            $table->foreign('jadwal_id')->references('id')->on('jadwal_non_blok_non_csr')->onDelete('cascade');
            $table->foreign('moderator_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hasil_seminar_proposal');
    }
};

