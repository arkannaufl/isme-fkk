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
        Schema::create('ikd_bukti_fisik', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('ikd_pedoman_id');
            $table->string('file_path');
            $table->string('file_name');
            $table->string('file_type')->nullable(); // pdf, xlsx, docx, etc.
            $table->integer('file_size')->nullable(); // in bytes
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('ikd_pedoman_id')->references('id')->on('ikd_pedoman')->onDelete('cascade');
            $table->unique(['user_id', 'ikd_pedoman_id', 'unit']); // One file per user per kegiatan per unit
            $table->index(['user_id', 'ikd_pedoman_id', 'unit']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ikd_bukti_fisik');
    }
};
