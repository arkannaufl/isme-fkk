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
        Schema::create('jadwal_persamaan_persepsi', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->date('tanggal');
            $table->string('jam_mulai');
            $table->string('jam_selesai');
            $table->integer('jumlah_sesi')->default(1);
            $table->json('dosen_ids'); // Required, multiple dosen (pengampu)
            $table->json('koordinator_ids')->nullable(); // Optional, multiple koordinator
            $table->unsignedBigInteger('ruangan_id')->nullable(); // Bisa null jika tidak menggunakan ruangan
            $table->boolean('use_ruangan')->default(true); // Flag untuk menentukan apakah menggunakan ruangan atau tidak
            $table->string('topik')->nullable(); // Optional
            $table->boolean('penilaian_submitted')->default(false);
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa', 'waiting_reschedule'])->default('belum_konfirmasi');
            $table->text('alasan_konfirmasi')->nullable();
            $table->enum('status_reschedule', ['waiting', 'approved', 'rejected'])->nullable();
            $table->text('reschedule_reason')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
            $table->foreign('ruangan_id')->references('id')->on('ruangan')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jadwal_persamaan_persepsi');
    }
};

