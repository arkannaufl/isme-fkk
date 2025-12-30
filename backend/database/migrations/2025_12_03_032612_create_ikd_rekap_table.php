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
        Schema::create('ikd_rekap', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('semester_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable(); // ID dosen/user terkait
            $table->unsignedBigInteger('ikd_pedoman_id'); // Foreign key ke ikd_pedoman
            $table->string('unit'); // Tim Akademik, Dosen, AIK, MEU, Profesi, Kemahasiswaan, SDM, UPT Jurnal, UPT PPM
            $table->integer('tahun');
            $table->integer('semester')->nullable(); // 1 atau 2, nullable jika tahunan
            $table->integer('poin')->default(0);
            $table->text('keterangan')->nullable();
            $table->string('status')->default('draft'); // draft, submitted, approved, rejected
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('ikd_pedoman_id')->references('id')->on('ikd_pedoman')->onDelete('cascade');
            $table->foreign('semester_id')->references('id')->on('semesters')->onDelete('restrict');
            $table->index('semester_id');
            $table->index(['unit', 'tahun', 'semester']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ikd_rekap');
    }
};

