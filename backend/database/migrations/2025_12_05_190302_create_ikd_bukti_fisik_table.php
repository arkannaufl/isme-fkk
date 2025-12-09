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
            // Unique constraint dengan unit akan ditambahkan di migration berikutnya setelah kolom unit ditambahkan
            $table->unique(['user_id', 'ikd_pedoman_id']); // Temporary unique constraint, akan diupdate di migration berikutnya
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
