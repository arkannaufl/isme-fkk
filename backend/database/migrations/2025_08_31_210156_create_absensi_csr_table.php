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
        Schema::create('absensi_csr', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('jadwal_csr_id');
            $table->string('mahasiswa_npm', 20);
            $table->boolean('hadir')->default(false); // 0 = tidak hadir, 1 = hadir
            $table->timestamps();
            
            // Foreign key constraint
            $table->foreign('jadwal_csr_id')->references('id')->on('jadwal_csr')->onDelete('cascade');
            
            // Unique constraint untuk mencegah duplikasi absensi
            $table->unique(['jadwal_csr_id', 'mahasiswa_npm'], 'absensi_csr_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('absensi_csr');
    }
};
