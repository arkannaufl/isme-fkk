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
        Schema::create('forum_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Nama kategori (Forum Diskusi Dosen, Forum Diskusi Mahasiswa, Custom)
            $table->string('slug')->unique(); // Slug untuk routing (dosen, mahasiswa, custom-name)
            $table->text('description')->nullable(); // Deskripsi kategori
            $table->string('icon')->nullable(); // Icon untuk kategori
            $table->string('color')->default('#3B82F6'); // Warna tema kategori
            $table->boolean('is_default')->default(false); // Apakah kategori default (Dosen, Mahasiswa)
            $table->boolean('is_active')->default(true); // Status aktif kategori
            $table->json('permissions')->nullable(); // Permission untuk siapa yang bisa buat forum
            $table->integer('sort_order')->default(0); // Urutan tampilan
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null'); // Yang buat kategori
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('forum_categories');
    }
};
