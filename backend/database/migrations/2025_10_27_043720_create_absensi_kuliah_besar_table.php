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
        Schema::create('absensi_kuliah_besar', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_kuliah_besar_id');
            $table->string('mahasiswa_nim', 20);
            $table->boolean('hadir')->default(false);
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->foreign('jadwal_kuliah_besar_id')->references('id')->on('jadwal_kuliah_besar')->onDelete('cascade');
            $table->unique(['jadwal_kuliah_besar_id', 'mahasiswa_nim'], 'absensi_kuliah_besar_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('absensi_kuliah_besar');
    }
};
