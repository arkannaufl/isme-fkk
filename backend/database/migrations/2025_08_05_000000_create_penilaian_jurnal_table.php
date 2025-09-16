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
        Schema::create('penilaian_jurnal', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->string('kelompok_kecil_nama');
            $table->unsignedBigInteger('jurnal_reading_id');
            $table->string('mahasiswa_nim');
            $table->integer('nilai_keaktifan')->default(0);
            $table->integer('nilai_laporan')->default(0);
            $table->date('tanggal_paraf')->nullable();
            $table->text('signature_paraf')->nullable();
            $table->string('nama_tutor')->nullable();
            $table->timestamps();

            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
            $table->foreign('jurnal_reading_id')->references('id')->on('jadwal_jurnal_reading')->onDelete('cascade');

            // Unique constraint untuk mencegah duplikasi penilaian
            $table->unique(['mata_kuliah_kode', 'kelompok_kecil_nama', 'jurnal_reading_id', 'mahasiswa_nim'], 'unique_penilaian_jurnal');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('penilaian_jurnal');
    }
};
