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
        Schema::create('dosen_peran', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->enum('tipe_peran', ['koordinator', 'tim_blok', 'dosen_mengajar']);
            $table->string('mata_kuliah_kode')->nullable();
            $table->string('peran_kurikulum');
            $table->integer('blok')->nullable();
            $table->string('semester')->nullable();
            $table->unsignedBigInteger('pbl_id')->nullable();
            $table->foreign('pbl_id')->references('id')->on('pbls')->onDelete('set null');
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
            // Hapus unique index agar multi peran per matkul/blok diperbolehkan
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dosen_peran');
    }
};
