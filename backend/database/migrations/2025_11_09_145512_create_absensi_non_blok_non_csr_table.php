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
        Schema::create('absensi_non_blok_non_csr', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_non_blok_non_csr_id');
            $table->string('mahasiswa_nim', 20);
            $table->boolean('hadir')->default(false);
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->foreign('jadwal_non_blok_non_csr_id')->references('id')->on('jadwal_non_blok_non_csr')->onDelete('cascade');
            $table->unique(['jadwal_non_blok_non_csr_id', 'mahasiswa_nim'], 'absensi_non_blok_non_csr_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('absensi_non_blok_non_csr');
    }
};
