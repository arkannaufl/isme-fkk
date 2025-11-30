<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('hasil_seminar_proposal');
        
        Schema::create('hasil_seminar_proposal', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_id');
            $table->unsignedBigInteger('mahasiswa_id');
            $table->unsignedBigInteger('moderator_id');
            $table->text('judul_skripsi');
            $table->enum('keputusan', ['tidak_lulus', 'lulus_tanpa_perbaikan', 'lulus_dengan_perbaikan']);
            $table->text('catatan_perbaikan')->nullable();
            $table->timestamps();

            $table->unique(['jadwal_id', 'mahasiswa_id'], 'unique_hasil_sempro');
            // No foreign key constraints - handled at application level
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hasil_seminar_proposal');
    }
};

