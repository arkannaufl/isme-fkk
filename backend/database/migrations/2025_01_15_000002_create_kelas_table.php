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
        Schema::create('kelas', function (Blueprint $table) {
            $table->id();
            $table->string('semester');
            $table->string('nama_kelas'); // Kelas A, Kelas B, dst
            $table->text('deskripsi')->nullable();
            $table->timestamps();

            // Unique constraint: nama kelas harus unik per semester
            $table->unique(['semester', 'nama_kelas']);
            
            // Index untuk performa query
            $table->index(['semester', 'nama_kelas']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kelas');
    }
}; 