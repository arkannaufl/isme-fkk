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
        Schema::create('pbl_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pbl_id')->constrained('pbls')->onDelete('cascade');
            $table->foreignId('dosen_id')->constrained('users')->onDelete('cascade');
            $table->string('role')->nullable()->comment('Role dosen: koordinator, tim_blok, dosen_mengajar');
            $table->timestamps();
            $table->unique(['pbl_id', 'dosen_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pbl_mappings');
    }
}; 