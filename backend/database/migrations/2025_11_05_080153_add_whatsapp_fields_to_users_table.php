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
        Schema::table('users', function (Blueprint $table) {
            // WhatsApp fields untuk Wablas contact
            $table->string('whatsapp_phone')->nullable()->after('telp')->comment('Nomor WhatsApp untuk Wablas (format: 62...)');
            $table->string('whatsapp_email')->nullable()->after('whatsapp_phone')->comment('Email untuk Wablas (harus sama dengan email verification)');
            $table->text('whatsapp_address')->nullable()->after('whatsapp_email')->comment('Alamat untuk Wablas contact');
            $table->date('whatsapp_birth_day')->nullable()->after('whatsapp_address')->comment('Tanggal lahir untuk Wablas contact (format: YYYY-mm-dd)');

            // Tracking sync status
            $table->timestamp('wablas_synced_at')->nullable()->after('whatsapp_birth_day')->comment('Timestamp terakhir sync ke Wablas');
            $table->enum('wablas_sync_status', ['pending', 'synced', 'failed'])->nullable()->after('wablas_synced_at')->comment('Status sync ke Wablas');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'whatsapp_phone',
                'whatsapp_email',
                'whatsapp_address',
                'whatsapp_birth_day',
                'wablas_synced_at',
                'wablas_sync_status',
            ]);
        });
    }
};
