<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('penilaian_pbl', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->string('kelompok');
            $table->string('pertemuan');
            $table->string('mahasiswa_npm');
            $table->integer('nilai_a');
            $table->integer('nilai_b');
            $table->integer('nilai_c');
            $table->integer('nilai_d');
            $table->integer('nilai_e');
            $table->integer('nilai_f');
            $table->integer('nilai_g');
            $table->integer('peta_konsep')->nullable();
            $table->string('nama_tutor')->nullable();
            $table->date('tanggal_paraf')->nullable();
            $table->longText('signature_paraf')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('penilaian_pbl');
    }
};
