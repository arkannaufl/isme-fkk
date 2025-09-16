<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('mata_kuliah', function (Blueprint $table) {
            $table->string('kode')->primary();
            $table->string('nama');
            $table->string('semester');
            $table->string('periode');
            $table->string('jenis');
            $table->string('tipe_non_block')->nullable();
            $table->integer('kurikulum');
            $table->date('tanggal_mulai')->nullable();
            $table->date('tanggal_akhir')->nullable();
            $table->integer('blok')->nullable();
            $table->integer('durasi_minggu')->nullable();
            $table->json('keahlian_required')->nullable();
            $table->json('peran_dalam_kurikulum')->nullable();
            $table->string('rps_file')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('mata_kuliah');
    }
};
