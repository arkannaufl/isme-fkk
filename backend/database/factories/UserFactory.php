<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'username' => fake()->unique()->userName(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    /**
     * Configure the model factory.
     *
     * @return $this
     */
    public function mahasiswa()
    {
        return $this->state(function (array $attributes) {
            return [
                'role' => 'mahasiswa',
                'nim' => fake()->unique()->numerify('2021####'),
                'gender' => fake()->randomElement(['Laki-laki', 'Perempuan']),
                'ipk' => fake()->randomFloat(2, 2.0, 4.0),
                'status' => fake()->randomElement(['aktif', 'cuti', 'lulus']),
                'angkatan' => fake()->numberBetween(2019, 2024),
                'email' => fake()->unique()->safeEmail(),
                'telp' => fake()->numerify('08##########'),
                'semester' => fake()->numberBetween(1, 8),
                // Tahun ajaran masuk dan semester masuk akan diatur otomatis oleh SemesterService
            ];
        });
    }

    /**
     * Configure the model factory for dosen.
     *
     * @return $this
     */
    public function dosen()
    {
        return $this->state(function (array $attributes) {
            return [
                'role' => 'dosen',
                'nip' => fake()->unique()->numerify('100###'),
                'nidn' => fake()->unique()->numerify('00####'),
                'gender' => fake()->randomElement(['Laki-laki', 'Perempuan']),
                'email' => fake()->unique()->safeEmail(),
                'telp' => fake()->numerify('08##########'),
                'kompetensi' => fake()->randomElements([
                    'Klinik', 'Penelitian', 'Pengajaran', 'Riset', 'Laboratorium'
                ], fake()->numberBetween(1, 3)),
                'keahlian' => fake()->randomElements([
                    'Kardiologi', 'Anatomi', 'Biostatistik', 'Patologi', 'Farmakologi'
                ], fake()->numberBetween(1, 3)),
            ];
        });
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
