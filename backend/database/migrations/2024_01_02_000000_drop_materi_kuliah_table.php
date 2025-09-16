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
        // Hapus tabel materi_kuliah yang lama (tidak terpakai)
        Schema::dropIfExists('materi_kuliah');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Recreate tabel materi_kuliah jika rollback
        Schema::create('materi_kuliah', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode', 50);
            $table->string('nama_file', 255);
            $table->string('nama_asli', 255);
            $table->string('tipe_file', 20);
            $table->bigInteger('ukuran_file');
            $table->text('deskripsi')->nullable();
            $table->timestamps();
        });
    }
};
