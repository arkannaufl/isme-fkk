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
        Schema::create('absensi_praktikum', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_praktikum_id');
            $table->string('mahasiswa_nim', 20);
            $table->boolean('hadir')->default(false);
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->foreign('jadwal_praktikum_id')->references('id')->on('jadwal_praktikum')->onDelete('cascade');
            $table->foreign('mahasiswa_nim')->references('nim')->on('users')->onDelete('cascade');
            $table->unique(['jadwal_praktikum_id', 'mahasiswa_nim'], 'absensi_praktikum_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('absensi_praktikum');
    }
};
