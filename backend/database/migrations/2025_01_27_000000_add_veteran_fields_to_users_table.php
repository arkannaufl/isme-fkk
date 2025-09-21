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
            $table->boolean('is_veteran')->default(false)->after('status');
            $table->text('veteran_notes')->nullable()->after('is_veteran');
            $table->timestamp('veteran_set_at')->nullable()->after('veteran_notes');
            $table->unsignedBigInteger('veteran_set_by')->nullable()->after('veteran_set_at');

            // Foreign key constraint
            $table->foreign('veteran_set_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['veteran_set_by']);
            $table->dropColumn(['is_veteran', 'veteran_notes', 'veteran_set_at', 'veteran_set_by']);
        });
    }
};
