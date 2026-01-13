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
        Schema::create('mata_kuliah_tahun_ajaran', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->foreignId('tahun_ajaran_id')->constrained('tahun_ajaran')->onDelete('cascade');
            $table->timestamps();

            $table->foreign('mata_kuliah_kode')
                  ->references('kode')
                  ->on('mata_kuliah')
                  ->onDelete('cascade');

            $table->unique(['mata_kuliah_kode', 'tahun_ajaran_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mata_kuliah_tahun_ajaran');
    }
};
