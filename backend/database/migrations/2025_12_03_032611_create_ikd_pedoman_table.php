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
        Schema::create('ikd_pedoman', function (Blueprint $table) {
            $table->id();
            $table->string('no'); // "1", "1.1", "1.2", "2", etc.
            $table->text('kegiatan');
            $table->decimal('indeks_poin', 8, 2)->default(0);
            $table->string('unit_kerja'); // Unit Kerja PJ Input data
            $table->text('bukti_fisik')->nullable();
            $table->text('prosedur')->nullable(); // Prosedur yang dilakukan oleh dosen
            $table->string('bidang'); // "A", "D", or custom
            $table->string('bidang_nama')->nullable(); // "Pengajaran", "Penunjang", or custom
            $table->unsignedBigInteger('parent_id')->nullable(); // For sub items (1.1, 1.2, etc.)
            $table->integer('level')->default(0); // 0 = main item, 1 = sub item
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('parent_id')->references('id')->on('ikd_pedoman')->onDelete('cascade');
            $table->index(['bidang', 'no']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ikd_pedoman');
    }
};
