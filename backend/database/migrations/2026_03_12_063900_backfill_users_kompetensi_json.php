<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->select(['id', 'kompetensi'])
            ->whereNotNull('kompetensi')
            ->whereRaw("JSON_TYPE(kompetensi) = 'STRING'")
            ->orderBy('id')
            ->chunkById(500, function ($users) {
                foreach ($users as $user) {
                    $decoded = json_decode($user->kompetensi, true);

                    if (!is_string($decoded)) {
                        continue;
                    }

                    $parts = array_values(array_filter(array_map('trim', explode(',', $decoded)), fn($v) => $v !== ''));

                    DB::table('users')
                        ->where('id', $user->id)
                        ->update([
                            'kompetensi' => $parts === [] ? null : json_encode($parts),
                        ]);
                }
            });
    }

    public function down(): void
    {
    }
};
