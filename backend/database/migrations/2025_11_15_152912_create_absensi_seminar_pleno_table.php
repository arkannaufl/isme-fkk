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
        Schema::create('absensi_seminar_pleno', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_seminar_pleno_id');
            $table->unsignedBigInteger('dosen_id');
            $table->boolean('hadir')->default(false);
            $table->text('catatan')->nullable();
            $table->timestamps();

            // Foreign key constraints
            $table->foreign('jadwal_seminar_pleno_id')->references('id')->on('jadwal_seminar_pleno')->onDelete('cascade');
            $table->foreign('dosen_id')->references('id')->on('users')->onDelete('cascade');

            // Unique constraint untuk mencegah duplikasi absensi
            $table->unique(['jadwal_seminar_pleno_id', 'dosen_id'], 'absensi_seminar_pleno_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('absensi_seminar_pleno');
    }
};
