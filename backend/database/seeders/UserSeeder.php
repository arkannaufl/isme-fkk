<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\MataKuliah;
use App\Models\DosenPeran;
use App\Services\SemesterService;
use Illuminate\Support\Facades\DB; // Added DB facade

class UserSeeder extends Seeder
{
    protected $semesterService;

    public function __construct(SemesterService $semesterService)
    {
        $this->semesterService = $semesterService;
    }

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faker = \Faker\Factory::create('id_ID');
        // Data mahasiswa kedokteran dengan nama dan username yang realistis (100 data)
        $mahasiswaData = [
            ['name' => 'Ahmad Rizki Pratama', 'username' => 'ahmadrizki'],
            ['name' => 'Siti Nurhaliza', 'username' => 'sitinur'],
            ['name' => 'Budi Santoso', 'username' => 'budisantoso'],
            ['name' => 'Rina Kartika Sari', 'username' => 'rinakartika'],
            ['name' => 'Deni Kurniawan', 'username' => 'denikurnia'],
            ['name' => 'Fitri Handayani', 'username' => 'fitrihanda'],
            ['name' => 'Agung Setiawan', 'username' => 'agungsetia'],
            ['name' => 'Maya Sari Dewi', 'username' => 'mayasari'],
            ['name' => 'Reza Fahlevi', 'username' => 'rezafahlevi'],
            ['name' => 'Indah Permatasari', 'username' => 'indahpermata'],
            ['name' => 'Eko Prasetyo', 'username' => 'ekoprasetyo'],
            ['name' => 'Wulan Dari', 'username' => 'wulandari'],
            ['name' => 'Arif Rahman', 'username' => 'arifrahman'],
            ['name' => 'Dinda Ayu Lestari', 'username' => 'dindaayu'],
            ['name' => 'Fajar Nugraha', 'username' => 'fajarnugraha'],
            ['name' => 'Cantika Putri', 'username' => 'cantikaputri'],
            ['name' => 'Gilang Ramadhan', 'username' => 'gilangrama'],
            ['name' => 'Hana Safitri', 'username' => 'hanasafitri'],
            ['name' => 'Ivan Pradipta', 'username' => 'ivanpradipta'],
            ['name' => 'Kirana Maharani', 'username' => 'kiranamaharani'],
            ['name' => 'Lukas Wijaya', 'username' => 'lukaswijaya'],
            ['name' => 'Melati Kusuma', 'username' => 'melatikusuma'],
            ['name' => 'Naufal Akbar', 'username' => 'naufalakbar'],
            ['name' => 'Olivia Sari', 'username' => 'oliviasari'],
            ['name' => 'Putra Mahendra', 'username' => 'putramahendra'],
            ['name' => 'Qonita Zahrani', 'username' => 'qonitazahrani'],
            ['name' => 'Ridho Pratama', 'username' => 'ridhopratama'],
            ['name' => 'Sabrina Dewi', 'username' => 'sabrinadewi'],
            ['name' => 'Taufik Hidayat', 'username' => 'taufikhidayat'],
            ['name' => 'Ulfa Rahmawati', 'username' => 'ulfarahmawati'],
            ['name' => 'Vina Anggraini', 'username' => 'vinaanggraini'],
            ['name' => 'Wahyu Nugroho', 'username' => 'wahyunugroho'],
            ['name' => 'Xenia Putri', 'username' => 'xeniaputri'],
            ['name' => 'Yusuf Rahman', 'username' => 'yusufrahman'],
            ['name' => 'Zahra Amelia', 'username' => 'zahraamelia'],
            ['name' => 'Aldi Firmansyah', 'username' => 'aldifirmansyah'],
            ['name' => 'Bella Kartika', 'username' => 'bellakartika'],
            ['name' => 'Candra Wijaya', 'username' => 'candrawijaya'],
            ['name' => 'Dila Ramadhani', 'username' => 'dilaramadhani'],
            ['name' => 'Eka Purnama', 'username' => 'ekapurnama'],
            ['name' => 'Farid Setiawan', 'username' => 'faridsetiawan'],
            ['name' => 'Gina Permata', 'username' => 'ginapermata'],
            ['name' => 'Hendra Kurnia', 'username' => 'hendrakurnia'],
            ['name' => 'Intan Sari', 'username' => 'intansari'],
            ['name' => 'Jihan Maharani', 'username' => 'jihanmaharani'],
            ['name' => 'Krisna Bayu', 'username' => 'krisnabayu'],
            ['name' => 'Laila Nurjannah', 'username' => 'lailanurjannah'],
            ['name' => 'Muhammad Iqbal', 'username' => 'muhammadiqbal'],
            ['name' => 'Nadia Fitriani', 'username' => 'nadiafitriani'],
            ['name' => 'Oscar Ramadhan', 'username' => 'oscarramadhan'],
            ['name' => 'Priska Dewi', 'username' => 'priskadewi'],
            ['name' => 'Qori Ananda', 'username' => 'qoriananda'],
            ['name' => 'Rian Saputra', 'username' => 'riansaputra'],
            ['name' => 'Shinta Maharani', 'username' => 'shintamaharani'],
            ['name' => 'Teguh Santoso', 'username' => 'teguhsantoso'],
            ['name' => 'Umi Kalsum', 'username' => 'umikalsum'],
            ['name' => 'Vera Angeline', 'username' => 'veraangeline'],
            ['name' => 'Wira Kusuma', 'username' => 'wirakusuma'],
            ['name' => 'Ximena Putri', 'username' => 'ximenaputri'],
            ['name' => 'Yoga Pratama', 'username' => 'yogapratama'],
            ['name' => 'Zulfa Maharani', 'username' => 'zulfamaharani'],
            ['name' => 'Alvin Pradana', 'username' => 'alvinpradana'],
            ['name' => 'Bianca Safira', 'username' => 'biancasafira'],
            ['name' => 'Citra Kencana', 'username' => 'citrakencana'],
            ['name' => 'David Setiadi', 'username' => 'davidsetiadi'],
            ['name' => 'Elena Maharani', 'username' => 'elenamaharani'],
            ['name' => 'Felix Gunawan', 'username' => 'felixgunawan'],
            ['name' => 'Ghina Azzahra', 'username' => 'ghinaazzahra'],
            ['name' => 'Hafiz Rahman', 'username' => 'hafizrahman'],
            ['name' => 'Ika Puspita', 'username' => 'ikapuspita'],
            ['name' => 'Joko Susilo', 'username' => 'jokosusilo'],
            ['name' => 'Kayla Sari', 'username' => 'kaylasari'],
            ['name' => 'Lingga Wijaya', 'username' => 'linggawijaya'],
            ['name' => 'Mira Anggraini', 'username' => 'miraanggraini'],
            ['name' => 'Nizar Hakim', 'username' => 'nizarhakim'],
            ['name' => 'Okta Pratama', 'username' => 'oktapratama'],
            ['name' => 'Putri Cahaya', 'username' => 'putricahaya'],
            ['name' => 'Qasim Nuraini', 'username' => 'qasimnuraini'],
            ['name' => 'Rania Safitri', 'username' => 'raniasafitri'],
            ['name' => 'Satria Kusuma', 'username' => 'satriakusuma'],
            ['name' => 'Tiara Melati', 'username' => 'tiaramelati'],
            ['name' => 'Umar Farouk', 'username' => 'umarfarouk'],
            ['name' => 'Viona Permata', 'username' => 'vionapermata'],
            ['name' => 'Widi Prabowo', 'username' => 'widiprabowo'],
            ['name' => 'Xavier Pratama', 'username' => 'xavierpratama'],
            ['name' => 'Yasmin Fitria', 'username' => 'yasminfitria'],
            ['name' => 'Zaki Ramadhan', 'username' => 'zakiramadhan'],
            ['name' => 'Aulia Rahman', 'username' => 'auliarahman'],
            ['name' => 'Bima Sakti', 'username' => 'bimasakti'],
            ['name' => 'Clara Indira', 'username' => 'claraindira'],
            ['name' => 'Dani Kurniawan', 'username' => 'danikurniawan'],
            ['name' => 'Elsa Purnama', 'username' => 'elsapurnama'],
            ['name' => 'Fahri Aditya', 'username' => 'fahriaditya'],
            ['name' => 'Galuh Maharani', 'username' => 'galuhmaharani'],
            ['name' => 'Husni Mubarak', 'username' => 'husnimubarak'],
            ['name' => 'Irma Suryani', 'username' => 'irmasuryani'],
            ['name' => 'Jefri Setiawan', 'username' => 'jefrisetiawan'],
            ['name' => 'Keisya Permata', 'username' => 'keisyapermata'],
            ['name' => 'Luthfi Hakim', 'username' => 'luthfihakim'],
            ['name' => 'Mila Kusuma', 'username' => 'milakusuma'],
            ['name' => 'Nanda Pratiwi', 'username' => 'nandapratiwi'],
            ['name' => 'Oki Saputra', 'username' => 'okisaputra'],
            ['name' => 'Prita Maharani', 'username' => 'pritamaharani'],
            ['name' => 'Qirana Dewi', 'username' => 'qiranadewi'],
            ['name' => 'Raka Wijaya', 'username' => 'rakawijaya'],
            ['name' => 'Sari Purnama', 'username' => 'saripurnama'],
            ['name' => 'Tito Raharjo', 'username' => 'titoraharjo'],
            ['name' => 'Ulfah Rahmawati', 'username' => 'ulfahrahmawati']
        ];

        // Tambahkan semester acak untuk setiap mahasiswa
        $nimStart = 20210001;
        $statusList = ['aktif', 'cuti', 'lulus'];
        foreach ($mahasiswaData as $i => &$mhs) {
            $mhs['semester'] = rand(1, 8);
            $mhs['nim'] = (string)($nimStart + $i);
            $mhs['gender'] = rand(0, 1) ? 'L' : 'P';
            $mhs['ipk'] = number_format(rand(200, 400) / 100, 2);
            $mhs['status'] = $statusList[array_rand($statusList)];
            $mhs['angkatan'] = rand(2019, 2024);
            // Untuk seeder, tahun ajaran masuk dan semester masuk akan di-set manual
            // karena SemesterService hanya untuk mahasiswa baru yang diinput manual
        }
        unset($mhs);

        // === GENERATE DOSEN PERFECT MATCH UNTUK SEMUA KEBUTUHAN PBL ===
        $totalDosen = 120;
        $faker = \Faker\Factory::create('id_ID');
        $listKompetensi = [
            'Klinik', 'Penelitian', 'Pengajaran', 'Riset', 'Laboratorium', 'Konsultasi', 'Manajemen', 'Statistik',
            'Epidemiologi', 'Kesehatan Masyarakat', 'Promosi Kesehatan', 'Pendidikan', 'Bedah', 'Farmasi',
            'Radiologi', 'Patologi', 'Gizi', 'Nutrisi', 'Forensik', 'Psikiatri', 'Pediatri', 'Kardiologi',
            'Neurologi', 'Parasitologi', 'Imunologi'
        ];
        $listKeahlian = [
            'Kardiologi', 'Anatomi', 'Biostatistik', 'Patologi', 'Farmakologi', 'Mikrobiologi', 'Fisiologi',
            'Parasitologi', 'Histologi', 'Epidemiologi', 'Imunologi', 'Gizi Klinik', 'Kesehatan Masyarakat',
            'Kedokteran Forensik', 'Radiologi', 'Neurologi', 'Pulmonologi', 'Gastroenterologi', 'Hematologi',
            'Pendidikan', 'Bedah', 'Riset', 'Laboratorium', 'Konsultasi Obat', 'Bakteriologi', 'Olahraga',
            'Infeksi', 'Mikroskopi', 'Statistik', 'Alergi', 'Nutrisi', 'Promosi Kesehatan', 'Hukum Medis',
            'CT Scan', 'EKG', 'EEG', 'Spirometri', 'Endoskopi', 'Transfusi Darah', 'Pencegahan Penyakit',
            'Konsultasi Jantung', 'Konsultasi Saraf', 'Sistem Pernapasan', 'Sistem Pencernaan', 'Penyakit Darah',
            'Pengabdian Masyarakat', 'Konsultasi Gizi', 'Etika Medis', 'Pencitraan Medis', 'Pengajaran',
        ];
        $listPeranKurikulum = [
            'Tutor PBL Blok Sistem Kardiovaskular', 'Koordinator Modul Anatomi', 'Pembimbing Skripsi',
            'Tutor PBL Blok Sistem Respirasi', 'Koordinator Modul Farmakologi', 'Koordinator Modul Fisiologi',
            'Tutor PBL Blok Sistem Pencernaan', 'Koordinator Modul Histologi', 'Penguji Seminar Proposal',
            'Dosen Pembimbing Akademik', 'Kepala Laboratorium', 'Anggota Tim Penyusun Kurikulum',
            'Reviewer Jurnal Ilmiah', 'Narasumber Workshop', 'Pengajar Mata Kuliah Pilihan',
            'Pembimbing KKN/Praktik Lapangan', 'Koordinator Penelitian Prodi', 'Pengelola Website Jurusan',
            'Koordinator Ujian OSCE', 'Pembimbing Praktikum Klinik', 'Anggota Komite Etik Penelitian',
            'Koordinator Program Keterampilan Medis', 'Pembimbing Tesis Magister',
            'Koordinator Praktikum Patologi Anatomi', 'Koordinator Praktikum Ilmu Anak',
            'Koordinator Praktikum Ilmu Penyakit Mata', 'Koordinator Praktikum Dermatologi',
            'Koordinator Praktikum Ilmu Kebidanan', 'Koordinator Praktikum Psikiatri Dasar',
            'Koordinator Praktikum Penyakit Dalam', 'Pengampu Ilmu Kesehatan Masyarakat',
            'Pengampu Ilmu Kebidanan', 'Pengampu Penyakit Dalam', 'Pengampu Psikiatri Dasar',
            'Pengampu Farmakologi Dasar', 'Pengampu Infeksi dan Imunologi',
        ];
        // 1. Ambil semua keahlian_required unik dari seluruh MataKuliah Blok
        $allKeahlianRequired = collect(\App\Models\MataKuliah::where('jenis', 'Blok')->pluck('keahlian_required')->toArray())
            ->filter() // Filter null values
            ->map(function($keahlian) {
                // Jika keahlian adalah string JSON, decode
                if (is_string($keahlian)) {
                    return json_decode($keahlian, true) ?? [];
                }
                // Jika sudah array, return as is
                return is_array($keahlian) ? $keahlian : [];
            })
            ->flatten()
            ->unique()
            ->values()
            ->toArray();
        $dosenData = [];
        // 2. Buat satu dosen untuk setiap keahlian unik (keahlian dosen = keahlian_required tsb)
        foreach ($allKeahlianRequired as $keahlian) {
            $name = $faker->unique()->name('male');
            $username = strtolower(preg_replace('/[^a-z0-9]/', '', $faker->unique()->userName));
            $keahlianArr = [$keahlian];
            $kompetensiArr = collect($listKompetensi)->shuffle()->take(rand(2,3))->values()->toArray();
            $dosenData[] = [
                'name' => $name,
                'username' => $username,
                'keahlian' => $keahlianArr,
                'kompetensi' => implode(', ', $kompetensiArr),
                'peran_dalam_kurikulum' => collect($listPeranKurikulum)->shuffle()->take(rand(2,3))->values()->toArray(),
            ];
        }
        // 3. Sisa dosen (hingga total 120) diisi random dari list keahlian
        $currentDosenCount = count($dosenData);
        if ($currentDosenCount < $totalDosen) {
            for ($i = $currentDosenCount; $i < $totalDosen; $i++) {
                $name = $faker->unique()->name('male');
                $username = strtolower(preg_replace('/[^a-z0-9]/', '', $faker->unique()->userName));
                $keahlianArr = collect($listKeahlian)->shuffle()->take(rand(1,3))->values()->toArray();
                $kompetensiArr = collect($listKompetensi)->shuffle()->take(rand(2,3))->values()->toArray();
                $dosenData[] = [
                    'name' => $name,
                    'username' => $username,
                    'keahlian' => $keahlianArr,
                    'kompetensi' => implode(', ', $kompetensiArr),
                    'peran_dalam_kurikulum' => collect($listPeranKurikulum)->shuffle()->take(rand(2,3))->values()->toArray(),
                ];
            }
        }
        // Tambahkan NID dan NIDN unik untuk setiap dosen
        $nidStart = 20230001;
        $nidnStart = 1234567001;
        // --- Multi peran, maksimal 4 peran total, max 2 per blok & semester ---
        $blokSemesterList = [];
        foreach (MataKuliah::where('jenis', 'Blok')->get() as $mk) {
            $blokSemesterList[] = [
                'blok' => $mk->blok,
                'semester' => $mk->semester,
                'kode' => $mk->kode,
            ];
        }
        // Ambil semua dosen (kecuali standby)
        $allDosen = array_values(array_filter($dosenData, fn($d) => !isset($d['keahlian']) || !in_array('standby', $d['keahlian'])));
        $dosenCount = count($allDosen);
        // Buat slot peran: 1 slot per blok/semester (atau bisa lebih jika ingin, misal 2x jumlah blokSemesterList)
        $slotList = [];
        foreach ($blokSemesterList as $bs) {
            // 3 slot per blok/semester: koordinator, tim_blok, mengajar
            $slotList[] = array_merge($bs, ['tipe_peran' => 'koordinator']);
            $slotList[] = array_merge($bs, ['tipe_peran' => 'tim_blok']);
            $slotList[] = array_merge($bs, ['tipe_peran' => 'dosen_mengajar']);
        }
        // Shuffle slot biar distribusi random
        shuffle($slotList);
        // Map untuk tracking peran per dosen
        $dosenPeranMap = [];
        foreach ($allDosen as $idx => $dosen) {
            $dosenPeranMap[$dosen['username']] = [
                'total' => 0,
                'blok_semester' => [] // blok-semester => count
            ];
        }
        // Assign dosen ke slot secara round robin
        $slotCount = count($slotList);
        for ($i = 0; $i < $slotCount; $i++) {
            $dosenIdx = $i % $dosenCount;
            $dosen = &$allDosen[$dosenIdx];
            $slot = $slotList[$i];
            $blokKey = $slot['blok'] . '-' . $slot['semester'];
            $username = $dosen['username'];
            // Cek max 2 per blok/semester dan max 4 total
            if (($dosenPeranMap[$username]['blok_semester'][$blokKey] ?? 0) < 2 && $dosenPeranMap[$username]['total'] < 4) {
                $dosen['dosen_peran'][] = [
                    'tipe_peran' => $slot['tipe_peran'],
                    'mata_kuliah_kode' => $slot['kode'],
                    'semester' => $slot['semester'],
                    'peran_kurikulum' => $listPeranKurikulum[array_rand($listPeranKurikulum)],
                ];
                $dosenPeranMap[$username]['blok_semester'][$blokKey] = ($dosenPeranMap[$username]['blok_semester'][$blokKey] ?? 0) + 1;
                $dosenPeranMap[$username]['total']++;
            }
        }
        // Pastikan semua dosen minimal dapat 1 assignment
        foreach ($allDosen as &$dosen) {
            if (empty($dosen['dosen_peran'])) {
                // Cari slot kosong
                foreach ($slotList as $slot) {
                    $blokKey = $slot['blok'] . '-' . $slot['semester'];
                    $username = $dosen['username'];
                    if (($dosenPeranMap[$username]['blok_semester'][$blokKey] ?? 0) < 2 && $dosenPeranMap[$username]['total'] < 4) {
                        $dosen['dosen_peran'][] = [
                            'tipe_peran' => $slot['tipe_peran'],
                            'mata_kuliah_kode' => $slot['kode'],
                            'semester' => $slot['semester'],
                            'peran_kurikulum' => $listPeranKurikulum[array_rand($listPeranKurikulum)],
                        ];
                        $dosenPeranMap[$username]['blok_semester'][$blokKey] = ($dosenPeranMap[$username]['blok_semester'][$blokKey] ?? 0) + 1;
                        $dosenPeranMap[$username]['total']++;
                        break;
                    }
                }
            }
        }
        unset($dosen);
        // Assign NID dan NIDN unik ke semua dosen (kecuali standby)
        foreach ($allDosen as $i => &$dosen) {
            $dosen['nid'] = (string)($nidStart + $i);
            $dosen['nidn'] = (string)($nidnStart + $i);
        }
        unset($dosen);
        // Gabungkan kembali ke $dosenData (biar proses insert tetap jalan)
        $dosenData = array_merge($allDosen, array_filter($dosenData, fn($d) => isset($d['keahlian']) && in_array('standby', $d['keahlian'])));

        // === Tambahkan 5 dosen standby ===
        $standbyDosen = [];
        for ($i = 1; $i <= 5; $i++) {
            $standbyDosen[] = [
                'name' => 'Dosen Standby ' . $i,
                'username' => 'standby' . $i,
                'keahlian' => ['standby'],
                'kompetensi' => null,
                'nid' => (string)($nidStart + $totalDosen + $i),
                'nidn' => (string)($nidnStart + $totalDosen + $i),
            ];
        }

        // Tambah user super admin
        User::updateOrCreate(
            ['username' => 'superadmin'],
            [
                'name' => 'Super Admin',
                'username' => 'superadmin',
                'email' => 'superadmin@umj.ac.id',
                'telp' => null,
                'role' => 'super_admin',
                'password' => Hash::make('password'),
                'kompetensi' => null,
                'keahlian' => null,
                'is_logged_in' => false,
                'current_token' => null,
                'semester' => null,
            ]
        );


        // Tambah user tim akademik
        User::updateOrCreate(
            ['username' => 'andipratama'],
            [
                'name' => 'Andi Pratama',
                'username' => 'andipratama',
                'email' => 'andi@umj.ac.id',
                'telp' => '081234567810',
                'role' => 'tim_akademik',
                'password' => Hash::make('password'),
                'kompetensi' => null,
                'keahlian' => null,
                'is_logged_in' => false,
                'current_token' => null,
                'semester' => null,
                'nip' => '100001',
                'ket' => 'Tim Akademik Bagian Administrasi',
            ]
        );
        User::updateOrCreate(
            ['username' => 'saridewi'],
            [
                'name' => 'Sari Dewi',
                'username' => 'saridewi',
                'email' => 'sari@umj.ac.id',
                'telp' => '081234567811',
                'role' => 'tim_akademik',
                'password' => Hash::make('password'),
                'kompetensi' => null,
                'keahlian' => null,
                'is_logged_in' => false,
                'current_token' => null,
                'semester' => null,
                'nip' => '100002',
                'ket' => 'Tim Akademik Bagian Kurikulum',
            ]
        );
        User::updateOrCreate(
            ['username' => 'bambangirawan'],
            [
                'name' => 'Bambang Irawan',
                'username' => 'bambangirawan',
                'email' => 'bambang@umj.ac.id',
                'telp' => '081234567812',
                'role' => 'tim_akademik',
                'password' => Hash::make('password'),
                'kompetensi' => null,
                'keahlian' => null,
                'is_logged_in' => false,
                'current_token' => null,
                'semester' => null,
                'nip' => '100003',
                'ket' => 'Tim Akademik Bagian Data & Evaluasi',
            ]
        );
        User::updateOrCreate(
            ['username' => 'dewilestari'],
            [
                'name' => 'Dewi Lestari',
                'username' => 'dewilestari',
                'email' => 'dewi@umj.ac.id',
                'telp' => '081234567813',
                'role' => 'tim_akademik',
                'password' => Hash::make('password'),
                'kompetensi' => null,
                'keahlian' => null,
                'is_logged_in' => false,
                'current_token' => null,
                'semester' => null,
                'nip' => '100004',
                'ket' => 'Tim Akademik Bagian Layanan Mahasiswa',
            ]
        );

        // Ambil tahun ajaran aktif untuk tracking
        $activeTahunAjaran = \App\Models\TahunAjaran::where('aktif', true)->first();
        $activeSemester = \App\Models\Semester::where('aktif', true)->first();

        // Debug: Cek data tahun ajaran dan semester
        if (!$activeTahunAjaran) {
            echo "WARNING: Tidak ada tahun ajaran aktif!\n";
        } else {
            echo "Tahun ajaran aktif: " . $activeTahunAjaran->tahun . " (ID: " . $activeTahunAjaran->id . ")\n";
        }
        
        if (!$activeSemester) {
            echo "WARNING: Tidak ada semester aktif!\n";
        } else {
            echo "Semester aktif: " . $activeSemester->jenis . "\n";
        }

        // Tambah mahasiswa
        foreach ($mahasiswaData as $mahasiswa) {
            // Tentukan tahun ajaran masuk berdasarkan angkatan
            $tahunAjaranMasuk = null;
            $semesterMasuk = null;
            
            if ($activeTahunAjaran && $activeSemester) {
                // Untuk seeder, set tracking data berdasarkan angkatan
                $angkatan = $mahasiswa['angkatan'] ?? 2022;
                $tahunAjaranMasuk = $activeTahunAjaran->id; // Default ke tahun ajaran aktif
                $semesterMasuk = $activeSemester->jenis; // Default ke semester aktif
                
                // Jika angkatan berbeda, sesuaikan tahun ajaran masuk
                if ($angkatan < 2022) {
                    // Mahasiswa angkatan lama, set tahun ajaran sesuai angkatan
                    $tahunAjaranMasuk = \App\Models\TahunAjaran::where('tahun', 'like', $angkatan . '/%')->first()?->id ?? $activeTahunAjaran->id;
                }
            }

            $user = User::updateOrCreate(
                ['username' => $mahasiswa['username']],
                [
                    'name' => $mahasiswa['name'],
                    'username' => $mahasiswa['username'],
                    'email' => $mahasiswa['username'] . '@umj.ac.id',
                    'telp' => '0812345679' . str_pad(rand(1, 99), 2, '0', STR_PAD_LEFT),
                    'role' => 'mahasiswa',
                    'password' => Hash::make('password'),
                    'kompetensi' => null,
                    'keahlian' => null,
                    'is_logged_in' => false,
                    'current_token' => null,
                    'semester' => $mahasiswa['semester'] ?? null,
                    'nim' => $mahasiswa['nim'] ?? null,
                    'gender' => $mahasiswa['gender'] ?? null,
                    'ipk' => $mahasiswa['ipk'] ?? null,
                    'status' => $mahasiswa['status'] ?? null,
                    'angkatan' => $mahasiswa['angkatan'] ?? null,
                    'tahun_ajaran_masuk_id' => $tahunAjaranMasuk,
                    'semester_masuk' => $semesterMasuk,
                ]
            );
        }

        // Ambil semua mata kuliah blok
        $mataKuliahBlok = MataKuliah::where('jenis', 'Blok')->get();
        // Tambah user dosen standby
        foreach ($standbyDosen as $dosen) {
            User::updateOrCreate(
                ['username' => $dosen['username']],
                [
                    'name' => $dosen['name'],
                    'username' => $dosen['username'],
                    'email' => $dosen['username'] . '@umj.ac.id',
                    'telp' => '0812345678' . str_pad(rand(1, 99), 2, '0', STR_PAD_LEFT),
                    'role' => 'dosen',
                    'password' => Hash::make('password'),
                    'kompetensi' => null,
                    'keahlian' => 'standby',
                    'nid' => $dosen['nid'],
                    'nidn' => $dosen['nidn'],
                    'is_logged_in' => false,
                    'current_token' => null,
                    'semester' => null,
                ]
            );
        }
        
        // Insert semua dosen
        foreach ($dosenData as $dosen) {
            $user = User::updateOrCreate(
                ['username' => $dosen['username']],
                [
                    'name' => $dosen['name'],
                    'username' => $dosen['username'],
                    'email' => $dosen['username'] . '@umj.ac.id',
                    'telp' => '0812345678' . str_pad(rand(1, 99), 2, '0', STR_PAD_LEFT),
                    'role' => 'dosen',
                    'password' => Hash::make('password'),
                    'kompetensi' => $dosen['kompetensi'] ?? null,
                    'keahlian' => $dosen['keahlian'] ?? null,
                    'nid' => $dosen['nid'],
                    'nidn' => $dosen['nidn'],
                    'is_logged_in' => false,
                    'current_token' => null,
                    'semester' => null,
                ]
            );
            
            // Assign peran yang sudah dibuat sebelumnya
            if (isset($dosen['dosen_peran']) && !empty($dosen['dosen_peran'])) {
                foreach ($dosen['dosen_peran'] as $peranData) {
                    // Cari mata kuliah untuk mendapatkan kode
                    $mataKuliah = MataKuliah::where('kode', $peranData['mata_kuliah_kode'])->first();
                    
                    if ($mataKuliah) {
                        // Normalisasi tipe_peran agar sesuai enum terkini
                        $tipePeran = ($peranData['tipe_peran'] === 'mengajar') ? 'dosen_mengajar' : $peranData['tipe_peran'];
                        
                        DosenPeran::create([
                            'user_id' => $user->id,
                            'mata_kuliah_kode' => $peranData['mata_kuliah_kode'],
                            'semester' => $peranData['semester'],
                            'blok' => $mataKuliah->blok,
                            'tipe_peran' => $tipePeran,
                            'peran_kurikulum' => $peranData['peran_kurikulum'],
                        ]);
                        
                        echo "Inserted peran: {$tipePeran} for {$dosen['name']} in {$peranData['mata_kuliah_kode']}\n";
                    } else {
                        echo "Warning: Mata kuliah {$peranData['mata_kuliah_kode']} not found\n";
                    }
                }
            }
        }
    }
}
