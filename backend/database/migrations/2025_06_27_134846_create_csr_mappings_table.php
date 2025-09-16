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
        Schema::create('csr_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('csr_id')->constrained('csrs')->onDelete('cascade');
            $table->foreignId('dosen_id')->constrained('users')->onDelete('cascade');
            $table->string('keahlian')->nullable();
            $table->timestamps();

            // Memastikan satu dosen hanya bisa mengajar satu keahlian di satu CSR
            $table->unique(['csr_id', 'keahlian', 'dosen_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('csr_mappings');
    }
};
