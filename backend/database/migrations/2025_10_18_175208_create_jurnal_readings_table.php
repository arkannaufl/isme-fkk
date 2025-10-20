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
        Schema::create('jurnal_readings', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->string('topik_ke');
            $table->string('nama_topik');
            $table->timestamps();

            // Foreign key constraint
            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jurnal_readings');
    }
};
