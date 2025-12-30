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
        Schema::create('jadwal_non_blok_non_csr', function (Blueprint $table) {
            $table->id();
            $table->string('mata_kuliah_kode');
            $table->date('tanggal');
            $table->string('jam_mulai');
            $table->string('jam_selesai');
            $table->integer('jumlah_sesi');
            $table->enum('jenis_baris', ['materi', 'agenda', 'seminar_proposal', 'sidang_skripsi']);
            $table->string('agenda')->nullable(); // untuk agenda khusus
            $table->string('materi')->nullable(); // untuk jadwal materi
            $table->unsignedBigInteger('dosen_id')->nullable(); // untuk jadwal materi
            $table->json('dosen_ids')->nullable(); // untuk multiple dosen
            $table->unsignedBigInteger('pembimbing_id')->nullable(); // untuk seminar proposal
            $table->json('komentator_ids')->nullable(); // untuk seminar proposal
            $table->json('penguji_ids')->nullable(); // untuk sidang skripsi
            $table->unsignedBigInteger('ruangan_id')->nullable(); // Bisa null jika tidak menggunakan ruangan
            $table->unsignedBigInteger('kelompok_besar_id')->nullable(); // Menyimpan semester (1, 2, 3, dst.), bukan ID dari tabel kelompok_besar
            $table->unsignedBigInteger('kelompok_besar_antara_id')->nullable();
            $table->json('mahasiswa_nims')->nullable(); // untuk seminar proposal
            $table->boolean('use_ruangan')->default(true); // Flag untuk menentukan apakah menggunakan ruangan atau tidak
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa', 'waiting_reschedule'])->default('belum_konfirmasi');
            $table->text('alasan_konfirmasi')->nullable();
            $table->text('alasan_asli')->nullable();
            $table->enum('status_reschedule', ['waiting', 'approved', 'rejected'])->nullable();
            $table->text('reschedule_reason')->nullable();
            $table->boolean('penilaian_submitted')->default(false);
            $table->unsignedBigInteger('penilaian_submitted_by')->nullable();
            $table->timestamp('penilaian_submitted_at')->nullable();
            $table->boolean('qr_enabled')->default(false);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('semester_id')->nullable();
            $table->timestamps();

            $table->foreign('mata_kuliah_kode')->references('kode')->on('mata_kuliah')->onDelete('cascade');
            $table->foreign('dosen_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('pembimbing_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('ruangan_id')->references('id')->on('ruangan')->onDelete('cascade')->nullable();
            $table->foreign('penilaian_submitted_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('semester_id')->references('id')->on('semesters')->onDelete('restrict');
            $table->index('semester_id');
            $table->index(['mata_kuliah_kode', 'tanggal']);
            $table->index(['ruangan_id', 'tanggal']);
            $table->index(['pembimbing_id', 'tanggal']);
            $table->index('tanggal');
            $table->index('jam_mulai');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jadwal_non_blok_non_csr');
    }
};

