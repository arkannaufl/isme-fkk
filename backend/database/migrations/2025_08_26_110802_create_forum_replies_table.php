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
        Schema::create('forum_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('forum_id')->constrained('forums')->onDelete('cascade'); // Forum yang direply
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade'); // User yang reply
            $table->foreignId('parent_id')->nullable()->constrained('forum_replies')->onDelete('cascade'); // Reply ke reply (nested)
            $table->longText('content'); // Konten reply
            $table->json('attachments')->nullable(); // File, gambar yang diupload
            $table->boolean('is_anonymous')->default(false); // Apakah reply anonim
            $table->enum('status', ['active', 'deleted', 'hidden'])->default('active'); // Status reply
            $table->integer('likes_count')->default(0); // Jumlah like
            $table->timestamp('edited_at')->nullable(); // Terakhir diedit
            $table->foreignId('edited_by')->nullable()->constrained('users')->onDelete('set null'); // Yang edit
            $table->timestamps();

            // Indexes untuk performance
            $table->index(['forum_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
            $table->index('parent_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('forum_replies');
    }
};
