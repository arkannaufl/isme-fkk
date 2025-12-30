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
        // Tabel absensi untuk jurnal reading
        Schema::create('absensi_jurnal', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('semester_id')->nullable();
            $table->unsignedBigInteger('jadwal_jurnal_reading_id');
            $table->string('mahasiswa_nim');
            $table->boolean('hadir')->default(false); // 0 = tidak hadir, 1 = hadir
            $table->text('catatan')->nullable();
            $table->timestamps();
            
            $table->foreign('jadwal_jurnal_reading_id')->references('id')->on('jadwal_jurnal_reading')->onDelete('cascade');
            $table->foreign('semester_id')->references('id')->on('semesters')->onDelete('restrict');
            $table->index('semester_id');
            $table->unique(['jadwal_jurnal_reading_id', 'mahasiswa_nim']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('absensi_jurnal');
    }
};

