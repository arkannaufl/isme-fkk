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
        Schema::create('proportional_distributions', function (Blueprint $table) {
            $table->id();
            $table->integer('blok_id'); // Blok yang sedang di-generate (1, 2, 3, 4)
            $table->string('active_semester'); // Semester aktif (ganjil/genap)
            $table->json('semester_needs'); // {1: 8, 3: 12, 5: 10, 7: 6}
            $table->json('semester_percentages'); // {1: 22.2, 3: 33.3, 5: 27.8, 7: 16.7}
            $table->json('semester_distribution'); // {1: 8, 3: 12, 5: 10, 7: 6}
            $table->integer('total_dosen_available'); // Total dosen yang tersedia
            $table->integer('total_needs'); // Total kebutuhan dosen
            $table->timestamp('generated_at'); // Waktu generate
            $table->timestamps();
            
            // Index untuk query yang efisien
            $table->index(['blok_id', 'active_semester']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('proportional_distributions');
    }
};
