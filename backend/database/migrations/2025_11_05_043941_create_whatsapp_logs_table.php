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
        Schema::create('whatsapp_logs', function (Blueprint $table) {
            $table->id();
            $table->string('phone', 20)->index();
            $table->text('message');
            $table->enum('status', ['sent', 'failed', 'received', 'pending'])->default('pending');
            $table->json('response')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedBigInteger('sent_by')->nullable();
            $table->timestamps();

            $table->foreign('sent_by')->references('id')->on('users')->onDelete('set null');
            $table->index(['phone', 'status'], 'whatsapp_logs_phone_status_index');
            $table->index('created_at', 'whatsapp_logs_created_at_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('whatsapp_logs');
    }
};
