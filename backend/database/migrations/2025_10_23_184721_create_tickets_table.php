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
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number')->unique();
            $table->string('title');
            $table->text('description');
            $table->string('category');
            $table->enum('priority', ['Low', 'Medium', 'High', 'Critical']);
            $table->enum('status', ['Open', 'In Progress', 'Resolved', 'Closed'])->default('Open');
            $table->foreignId('assigned_to')->constrained('developers');
            $table->string('user_name');
            $table->string('user_email');
            $table->integer('response_time')->nullable(); // in minutes
            $table->integer('resolution_time')->nullable(); // in hours
            $table->integer('satisfaction_rating')->nullable(); // 1-5 scale
            $table->timestamps();
            
            $table->index(['user_email', 'status']);
            $table->index(['assigned_to', 'status']);
            $table->index(['priority', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
