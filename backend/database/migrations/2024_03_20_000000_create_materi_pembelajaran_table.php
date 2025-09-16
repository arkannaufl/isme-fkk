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
        Schema::create('materi_pembelajaran', function (Blueprint $table) {
            $table->id();
            $table->string('kode_mata_kuliah', 50);
            $table->string('filename', 255);
            $table->string('judul', 255);
            $table->string('file_type', 20);
            $table->bigInteger('file_size');
            $table->string('file_path', 500);
            $table->timestamp('upload_date')->useCurrent();

            // Foreign key ke tabel mata_kuliah
            $table->foreign('kode_mata_kuliah')->references('kode')->on('mata_kuliah')->onDelete('cascade');

            // Indexes untuk performance
            $table->index('kode_mata_kuliah');
            $table->index('upload_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('materi_pembelajaran');
    }
};
