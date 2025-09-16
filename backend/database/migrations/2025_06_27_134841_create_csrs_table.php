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
        Schema::create('csrs', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode'); // Kode mata kuliah
            $table->string('nomor_csr'); // Nomor CSR (1.1, 1.2, dst) - angka pertama = semester, angka kedua = blok
            $table->string('nama')->nullable(); // Nama mata kuliah CSR, boleh null
            $table->json('keahlian_required'); // Keahlian yang diperlukan (array)
            $table->date('tanggal_mulai')->nullable(); // Tanggal mulai
            $table->date('tanggal_akhir')->nullable(); // Tanggal akhir
            $table->enum('status', ['available', 'assigned', 'completed'])->default('available');
            $table->timestamps();
            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('csrs');
    }
};
