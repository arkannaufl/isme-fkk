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
        Schema::create('keahlian_csr', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('csr_id');
            $table->string('keahlian');
            $table->timestamps();
            
            $table->foreign('csr_id')->references('id')->on('csrs')->onDelete('cascade');
            $table->index(['csr_id', 'keahlian']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('keahlian_csr');
    }
};
