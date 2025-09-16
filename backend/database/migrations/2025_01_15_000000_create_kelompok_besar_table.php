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
        Schema::create('kelompok_besar', function (Blueprint $table) {
            $table->id();
            $table->string('semester');
            $table->unsignedBigInteger('mahasiswa_id');
            $table->timestamps();

            // Foreign key ke tabel users (mahasiswa)
            $table->foreign('mahasiswa_id')->references('id')->on('users')->onDelete('cascade');
            
            // Unique constraint: satu mahasiswa hanya bisa ada di satu semester
            $table->unique(['mahasiswa_id', 'semester']);
            
            // Index untuk performa query
            $table->index(['semester', 'mahasiswa_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kelompok_besar');
    }
}; 