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
        Schema::create('semesters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tahun_ajaran_id')->constrained('tahun_ajaran')->onDelete('cascade');
            $table->enum('jenis', ['Ganjil', 'Genap']);
            $table->boolean('aktif')->default(false);
            $table->timestamps();
            
            // Add unique constraint to prevent duplicate semester types per academic year
            $table->unique(['tahun_ajaran_id', 'jenis'], 'unique_semester_per_year');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('semesters');
    }
};
