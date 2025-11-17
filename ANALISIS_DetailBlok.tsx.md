# Analisis DetailBlok.tsx - Praktikum

## Ringkasan
File `DetailBlok.tsx` adalah halaman detail untuk mata kuliah **blok biasa** (bukan blok antara). Berbeda dengan `DetailBlokAntara.tsx`, file ini **memiliki section Praktikum yang lengkap** dengan berbagai fitur.

## Struktur Praktikum di DetailBlok.tsx

### 1. Type Definitions
**Lokasi:** Line 131-151

```typescript
type JadwalPraktikumType = {
  id?: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  topik: string;
  kelas_praktikum: string;
  dosen_id: number;
  ruangan_id: number;
  jumlah_sesi: number;
  [key: string]: any;
};
```

### 2. State Variables
**Lokasi:** Line 574-884

Berikut state yang berkaitan dengan praktikum:

- `jadwalPraktikum` - Array jadwal praktikum
- `materiPraktikumOptions` - Options untuk dropdown materi
- `kelasPraktikumOptions` - Options untuk dropdown kelas praktikum
- `pengampuPraktikumOptions` - Options untuk dropdown pengampu
- `praktikumPage` & `praktikumPageSize` - Pagination
- `praktikumSuccess` - Success message
- `selectedPraktikumItems` - Items yang dipilih untuk bulk delete
- `showDeletePraktikumModal` & `selectedDeletePraktikumIndex` - Modal delete
- Import/Export Excel:
  - `showPraktikumImportModal` - Modal import Excel
  - `selectedPraktikumTemplate` - Template yang dipilih (Aplikasi/SIAKAD)
  - `praktikumImportFile` - File yang diimport
  - `praktikumImportData` - Data hasil import
  - `praktikumImportErrors` - Error dari import
  - `praktikumCellErrors` - Error per cell
  - `praktikumEditingCell` - Cell yang sedang diedit
  - `isPraktikumImporting` - Status importing
  - `praktikumImportedCount` - Jumlah data yang diimport
  - `showPraktikumSiakadImportModal` - Modal import template SIAKAD
  - `praktikumSiakadImportFile` - File template SIAKAD
  - `praktikumSiakadImportData` - Data template SIAKAD
  - `praktikumSiakadImportErrors` - Error template SIAKAD
  - `praktikumSiakadCellErrors` - Error per cell template SIAKAD
  - `praktikumSiakadEditingCell` - Cell yang diedit template SIAKAD
  - `praktikumSiakadImportPage` - Pagination import SIAKAD
  - `praktikumSiakadImportedCount` - Count import SIAKAD
  - `showPraktikumExportModal` - Modal export Excel
  - `selectedPraktikumExportTemplate` - Template export

### 3. Handler Functions
**Lokasi:** Line 3409-3609

#### a. handleTambahJadwalPraktikum()
- Fungsi untuk menambah atau mengedit jadwal praktikum
- Validasi field wajib
- Mengirim payload ke API `/praktikum/jadwal/{kode}` (POST untuk tambah, PUT untuk edit)
- Reset form setelah berhasil

#### b. handleEditJadwalPraktikum(idx: number)
- Fungsi untuk edit jadwal praktikum berdasarkan index
- Support multiple dosen (dosen_ids array) atau single dosen (dosen_id)
- Set form dengan data jadwal yang akan diedit
- Buka modal edit

#### c. handleDeleteJadwalPraktikum(idx: number)
- Fungsi untuk hapus jadwal praktikum
- Menampilkan modal konfirmasi
- Set selectedDeletePraktikumIndex

#### d. handleConfirmDeletePraktikum()
- Konfirmasi dan eksekusi hapus jadwal praktikum
- Mengirim DELETE request ke API `/praktikum/jadwal/{kode}/{id}`
- Refresh data setelah berhasil

### 4. UI Section Praktikum
**Lokasi:** Line 12748 - ~13800 (estimasi)

Section Praktikum memiliki fitur lengkap:

#### a. Header Section
- Judul "Praktikum"
- Info Box tentang dukungan template Excel (Template Aplikasi & Template SIAKAD)
- Tombol-tombol aksi:
  - **Import Excel** - Import data dari Excel (Aplikasi/SIAKAD)
  - **Download Template Excel** - Download template untuk import
  - **Export ke Excel** - Export data ke Excel
  - **Tambah Jadwal** - Tambah jadwal praktikum baru

#### b. Tabel Jadwal Praktikum
Tabel menampilkan:
- No
- Hari/Tanggal
- Kelas (kelas_praktikum)
- Pukul (jam_mulai - jam_selesai)
- Waktu (jumlah_sesi x 50 menit)
- Materi
- Pengampu (dosen, support multiple)
- Topik
- Lokasi (ruangan)
- Aksi:
  - **Absensi** - Navigate ke halaman absensi praktikum
  - **Edit** - Edit jadwal
  - **Hapus** - Hapus jadwal

#### c. Pagination
- Pagination untuk tabel jadwal praktikum
- Per page options (10, 20, 30, 40, 50)

### 5. Fitur Import/Export Excel

#### a. Import Excel (Template Aplikasi)
- Modal untuk pilih template (Aplikasi/SIAKAD)
- Preview data sebelum import
- Validasi data per cell
- Edit cell langsung di preview
- Import data ke database

#### b. Import Excel (Template SIAKAD)
- Modal khusus untuk template SIAKAD
- Preview data template SIAKAD
- Validasi dan mapping ke format aplikasi
- Import data

#### c. Export Excel
- Modal untuk pilih template export (Aplikasi/SIAKAD)
- Export data jadwal praktikum ke Excel

### 6. Modal Form Tambah/Edit Jadwal Praktikum
Modal untuk tambah/edit jadwal praktikum dengan field:
- Hari/Tanggal (date picker)
- Jam Mulai
- Jam Selesai
- Jumlah Kali (sesi)
- Materi (dropdown dengan options dari API)
- Kelas Praktikum (dropdown dengan options dari API)
- Pengampu (multi-select dosen, berdasarkan materi yang dipilih)
- Topik
- Lokasi (ruangan)

### 7. Modal Delete Konfirmasi
Modal konfirmasi sebelum menghapus jadwal praktikum.

## Perbedaan dengan DetailBlokAntara.tsx

| Fitur | DetailBlok.tsx (Blok Biasa) | DetailBlokAntara.tsx (Blok Antara) |
|-------|------------------------------|-------------------------------------|
| Section Praktikum | ✅ **Ada** - Lengkap dengan semua fitur | ❌ **Tidak Ada** - Sudah dihapus |
| Import Excel Praktikum | ✅ Ada | ❌ Tidak ada |
| Export Excel Praktikum | ✅ Ada | ❌ Tidak ada |
| Template SIAKAD | ✅ Ada | ❌ Tidak ada |
| Handler Functions | ✅ Ada (handleTambahJadwalPraktikum, handleEditJadwalPraktikum, handleDeleteJadwalPraktikum) | ❌ Sudah dihapus |
| State Variables | ✅ Lengkap | ❌ Sudah dihapus |

## Kesimpulan

**DetailBlok.tsx** adalah file untuk **blok biasa** yang memiliki section Praktikum **lengkap** dengan fitur:
- ✅ CRUD jadwal praktikum
- ✅ Import/Export Excel (Template Aplikasi & SIAKAD)
- ✅ Absensi praktikum
- ✅ Pagination
- ✅ Bulk operations

**File ini TIDAK perlu diubah** karena praktikum memang ada untuk blok biasa. Yang sudah dihapus adalah praktikum untuk blok antara saja (DetailBlokAntara.tsx).

## Status
✅ **Tidak perlu dihapus** - Praktikum memang bagian dari blok biasa

