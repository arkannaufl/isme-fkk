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
        Schema::create('jadwal_kuliah_besar', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->string('materi')->nullable(); // keahlian/materi
            $table->longText('topik')->nullable();
            $table->unsignedBigInteger('dosen_id')->nullable();
            $table->json('dosen_ids')->nullable(); // Array of dosen IDs for multiple dosen
            $table->unsignedBigInteger('ruangan_id');
            $table->unsignedBigInteger('kelompok_besar_id')->nullable(); // Menyimpan semester (1, 2, 3, dst.), bukan ID dari tabel kelompok_besar
            $table->unsignedBigInteger('kelompok_besar_antara_id')->nullable(); // For manual kelompok besar
            $table->date('tanggal');
            $table->string('jam_mulai');
            $table->string('jam_selesai');
            $table->integer('jumlah_sesi')->default(1);
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa', 'waiting_reschedule'])->default('belum_konfirmasi');
            $table->text('alasan_konfirmasi')->nullable();
            $table->enum('status_reschedule', ['waiting', 'approved', 'rejected'])->nullable();
            $table->text('reschedule_reason')->nullable();
            $table->boolean('penilaian_submitted')->default(false);
            $table->unsignedBigInteger('penilaian_submitted_by')->nullable();
            $table->timestamp('penilaian_submitted_at')->nullable();
            $table->boolean('qr_enabled')->default(false);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->string('siakad_kurikulum')->nullable();
            $table->string('siakad_kode_mk')->nullable();
            $table->string('siakad_nama_kelas')->nullable();
            $table->string('siakad_kelompok')->nullable();
            $table->string('siakad_jenis_pertemuan')->nullable();
            $table->string('siakad_metode')->nullable();
            $table->string('siakad_dosen_pengganti')->nullable();
            $table->unsignedBigInteger('semester_id')->nullable();
            $table->timestamps();

            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
            $table->foreign('dosen_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('ruangan_id')->references('id')->on('ruangan')->onDelete('cascade');
            $table->foreign('kelompok_besar_antara_id')->references('id')->on('kelompok_besar_antara')->onDelete('cascade');
            $table->foreign('penilaian_submitted_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('semester_id')->references('id')->on('semesters')->onDelete('restrict');
            $table->index('semester_id');
            $table->index(['mata_kuliah_kode', 'tanggal']);
            $table->index(['dosen_id', 'tanggal']);
            $table->index(['ruangan_id', 'tanggal']);
            $table->index('tanggal');
            $table->index('jam_mulai');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jadwal_kuliah_besar');
    }
};

