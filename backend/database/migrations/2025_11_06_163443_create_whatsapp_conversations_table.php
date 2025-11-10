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
        Schema::create('whatsapp_conversations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('phone', 20); // Nomor WhatsApp
            $table->unsignedBigInteger('jadwal_id'); // ID jadwal yang sedang dikonfirmasi
            $table->string('jadwal_type', 50); // pbl, kuliah_besar, praktikum, jurnal, csr, non_blok_non_csr
            $table->enum('state', [
                'waiting_button', // Menunggu user klik button (Konfirmasi/Reschedule)
                'waiting_konfirmasi_choice', // Menunggu user pilih Bisa/Tidak Bisa
                'waiting_alasan_tidak_bisa', // Menunggu user kirim alasan tidak bisa
                'waiting_reschedule_reason', // Menunggu user kirim alasan reschedule
                'completed', // Conversation selesai
                'cancelled' // Conversation dibatalkan
            ])->default('waiting_button');
            $table->text('last_message')->nullable(); // Pesan terakhir yang dikirim ke user
            $table->json('metadata')->nullable(); // Data tambahan (alasan, pilihan, dll)
            $table->timestamp('expires_at')->nullable(); // Auto-cleanup conversation yang sudah expired (default 24 jam)
            $table->timestamps();

            // Foreign keys
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            
            // Indexes
            $table->index(['user_id', 'jadwal_id', 'jadwal_type']);
            $table->index(['phone', 'state']);
            $table->index('expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('whatsapp_conversations');
    }
};
