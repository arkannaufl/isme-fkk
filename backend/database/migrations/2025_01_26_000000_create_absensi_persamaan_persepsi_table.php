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
        Schema::create('absensi_persamaan_persepsi', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_persamaan_persepsi_id');
            $table->unsignedBigInteger('dosen_id');
            $table->boolean('hadir')->default(false);
            $table->text('catatan')->nullable();
            $table->timestamps();
            
            // Foreign key constraints
            $table->foreign('jadwal_persamaan_persepsi_id')->references('id')->on('jadwal_persamaan_persepsi')->onDelete('cascade');
            $table->foreign('dosen_id')->references('id')->on('users')->onDelete('cascade');
            
            // Unique constraint untuk mencegah duplikasi absensi
            $table->unique(['jadwal_persamaan_persepsi_id', 'dosen_id'], 'absensi_persamaan_persepsi_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('absensi_persamaan_persepsi');
    }
};

