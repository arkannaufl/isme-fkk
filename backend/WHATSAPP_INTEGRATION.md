# 📱 Integrasi WhatsApp dengan Wablas.com

Dokumentasi lengkap untuk integrasi WhatsApp bot menggunakan Wablas API di sistem akademik ISME FKK UMJ.

## 📋 Daftar Isi

1. [Setup Awal](#setup-awal)
2. [Konfigurasi](#konfigurasi)
3. [Cara Kerja](#cara-kerja)
4. [API Endpoints](#api-endpoints)
5. [Integrasi ke Controller Jadwal](#integrasi-ke-controller-jadwal)
6. [Webhook Handler](#webhook-handler)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Setup Awal

### 1. Register di Wablas.com

1. Kunjungi https://console.wablas.com
2. Buat akun baru atau login
3. Dapatkan API Token dari dashboard
4. Setup nomor WhatsApp yang akan digunakan

### 2. Install Dependencies

Semua dependencies sudah termasuk di Laravel, tidak perlu install package tambahan.

### 3. Run Migration

```bash
cd isme-fkk/backend
php artisan migrate
```

Migration akan membuat table `whatsapp_logs` untuk tracking pesan.

---

## ⚙️ Konfigurasi

### 1. Update .env File

Tambahkan konfigurasi berikut ke file `.env`:

```env
# Wablas API Configuration
WABLAS_TOKEN=your_token_here
WABLAS_BASE_URL=https://console.wablas.com/api
WABLAS_ENABLED=true
```

**Catatan:**
- `WABLAS_TOKEN`: Token API dari dashboard Wablas
- `WABLAS_BASE_URL`: URL API Wablas (default sudah benar)
- `WABLAS_ENABLED`: Set `false` untuk disable WhatsApp notifications (testing mode)

### 2. Update User Data

Pastikan dosen memiliki nomor telepon di field `telp` di table `users`. Format nomor:
- `081234567890` (dengan 0)
- `6281234567890` (tanpa 0, dengan 62)
- `81234567890` (tanpa 0 dan 62)

Service akan otomatis format ke format yang benar (62xxxxxxxxxx).

---

## 🔧 Cara Kerja

### Flow Pengiriman Notifikasi

1. **Superadmin membuat jadwal baru** → Controller jadwal (misalnya `JadwalPraktikumController@store`)
2. **Controller memanggil `sendAssignmentNotification()`** → Method ini membuat notifikasi di database
3. **Method memanggil `sendWhatsAppNotification()`** → Trait `SendsWhatsAppNotification` dipanggil
4. **Trait menggunakan `WhatsAppController`** → Controller mengirim via `WablasService`
5. **WablasService mengirim ke API Wablas** → HTTP POST request ke Wablas API
6. **Response disimpan di `whatsapp_logs`** → Tracking semua pengiriman

### Komponen Utama

1. **WablasService** (`app/Services/WablasService.php`)
   - Handle semua komunikasi dengan Wablas API
   - Format nomor telepon
   - Error handling

2. **WhatsAppController** (`app/Http/Controllers/WhatsAppController.php`)
   - Controller untuk WhatsApp operations
   - Method `sendScheduleNotification()` untuk kirim notifikasi jadwal
   - Webhook handler untuk pesan masuk
   - API endpoints untuk testing

3. **SendsWhatsAppNotification Trait** (`app/Traits/SendsWhatsAppNotification.php`)
   - Trait untuk digunakan di controller jadwal
   - Method `sendWhatsAppNotification()` untuk kirim pesan
   - Method `formatScheduleMessage()` untuk format pesan

4. **WhatsAppLog Model** (`app/Models/WhatsAppLog.php`)
   - Model untuk tracking semua pesan WhatsApp
   - Menyimpan status, response, dan metadata

---

## 📡 API Endpoints

### 1. Send Message (Manual)

**POST** `/api/whatsapp/send`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body:**
```json
{
  "phone": "6281234567890",
  "message": "Pesan test"
}
```

**Response:**
```json
{
  "message": "Pesan berhasil dikirim",
  "data": {
    "success": true,
    "message_id": "123456",
    "status": "sent"
  }
}
```

### 2. Get Logs

**GET** `/api/whatsapp/logs`

**Query Parameters:**
- `phone` (optional): Filter by phone number
- `status` (optional): Filter by status (sent, failed, received)
- `user_id` (optional): Filter by sender user_id
- `per_page` (optional): Items per page (default: 20)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "phone": "6281234567890",
      "message": "Pesan...",
      "status": "sent",
      "response": {...},
      "metadata": {...},
      "created_at": "2025-11-05T10:00:00.000000Z"
    }
  ],
  "current_page": 1,
  "per_page": 20,
  "total": 100
}
```

### 3. Test Connection

**POST** `/api/whatsapp/test`

**Body (optional):**
```json
{
  "phone": "6281234567890"
}
```

**Response:**
```json
{
  "message": "Koneksi berhasil",
  "result": {
    "success": true,
    "message_id": "123456"
  }
}
```

### 4. Webhook (Wablas → Sistem)

**POST** `/api/whatsapp/webhook`

Endpoint ini digunakan oleh Wablas untuk mengirim pesan masuk ke sistem.

**Note:** Endpoint ini tidak memerlukan authentication karena dipanggil oleh external service.

---

## 🔗 Integrasi ke Controller Jadwal

### Contoh: JadwalPraktikumController

Controller sudah diupdate untuk mengirim WhatsApp notification. Berikut contohnya:

```php
use App\Traits\SendsWhatsAppNotification;

class JadwalPraktikumController extends Controller
{
    use SendsWhatsAppNotification;

    private function sendAssignmentNotification($jadwal, $dosenId)
    {
        // ... kode notifikasi database ...

        // Kirim WhatsApp notification
        $whatsappMessage = $this->formatScheduleMessage('praktikum', [
            'mata_kuliah_nama' => $mataKuliah->nama,
            'tanggal' => $jadwal->tanggal,
            'jam_mulai' => $jadwal->jam_mulai,
            'jam_selesai' => $jadwal->jam_selesai,
            'ruangan' => $ruangan->nama,
            'kelas_praktikum' => $jadwal->kelas_praktikum,
            'topik' => $jadwal->topik,
            'materi' => $jadwal->materi,
        ]);

        $this->sendWhatsAppNotification($dosen, $whatsappMessage, [
            'jadwal_id' => $jadwal->id,
            'jadwal_type' => 'praktikum',
            'mata_kuliah_kode' => $mataKuliah->kode,
            'mata_kuliah_nama' => $mataKuliah->nama,
        ]);
    }
}
```

### Integrasi ke Controller Lain

Untuk mengintegrasikan ke controller jadwal lain (CSR, PBL, dll):

1. **Import trait:**
```php
use App\Traits\SendsWhatsAppNotification;
```

2. **Use trait di class:**
```php
class JadwalCSRController extends Controller
{
    use SendsWhatsAppNotification;
    // ...
}
```

3. **Panggil method di `sendAssignmentNotification()`:**
```php
// Setelah membuat notifikasi database
$this->sendWhatsAppNotification($dosen, $message, $metadata);
```

---

## 🔄 Webhook Handler

Webhook handler sudah disiapkan untuk menerima pesan masuk dari Wablas. Ini akan berguna untuk fitur two-way chat di masa depan.

### Setup Webhook di Wablas

1. Login ke dashboard Wablas
2. Buka menu Webhook
3. Set webhook URL: `https://your-domain.com/api/whatsapp/webhook`
4. Save

### Handle Pesan Masuk

Saat ini webhook handler akan:
- Menerima pesan masuk
- Mencari user berdasarkan nomor telepon
- Log pesan ke `whatsapp_logs`
- (TODO: Implementasi logic untuk handle pesan, misalnya update status konfirmasi jadwal)

---

## 🧪 Testing

### 1. Test Koneksi API

```bash
curl -X POST https://your-domain.com/api/whatsapp/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "6281234567890"}'
```

### 2. Test Kirim Pesan Manual

```bash
curl -X POST https://your-domain.com/api/whatsapp/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "6281234567890",
    "message": "Test pesan dari sistem akademik"
  }'
```

### 3. Test dari Controller

Buat jadwal baru melalui sistem, lalu cek:
- Log Laravel (`storage/logs/laravel.log`)
- Table `whatsapp_logs`
- WhatsApp dosen yang menerima

---

## 🐛 Troubleshooting

### Problem: WhatsApp tidak terkirim

**Solusi:**
1. Cek `WABLAS_TOKEN` di `.env` sudah benar
2. Cek `WABLAS_ENABLED=true`
3. Cek log Laravel untuk error detail
4. Cek table `whatsapp_logs` untuk melihat response dari API

### Problem: Format nomor telepon salah

**Solusi:**
Service akan otomatis format nomor. Pastikan format input:
- `081234567890` ✅
- `6281234567890` ✅
- `81234567890` ✅

Service akan convert ke `6281234567890`.

### Problem: Webhook tidak menerima pesan

**Solusi:**
1. Cek webhook URL sudah benar di dashboard Wablas
2. Pastikan server bisa diakses dari internet (untuk production)
3. Cek log Laravel untuk melihat request webhook
4. Pastikan route `/api/whatsapp/webhook` tidak memerlukan authentication

### Problem: Dosen tidak menerima pesan

**Solusi:**
1. Cek field `telp` di table `users` sudah terisi
2. Cek format nomor benar
3. Cek di `whatsapp_logs` apakah pesan terkirim atau gagal
4. Jika gagal, cek response error di log

---

## 📊 Monitoring

### Cek Logs

```bash
# Laravel log
tail -f storage/logs/laravel.log | grep -i whatsapp

# Database logs
SELECT * FROM whatsapp_logs ORDER BY created_at DESC LIMIT 50;
```

### Statistik

```sql
-- Total pesan terkirim
SELECT COUNT(*) FROM whatsapp_logs WHERE status = 'sent';

-- Total pesan gagal
SELECT COUNT(*) FROM whatsapp_logs WHERE status = 'failed';

-- Pesan per hari
SELECT DATE(created_at) as date, COUNT(*) as total
FROM whatsapp_logs
WHERE status = 'sent'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🔮 Future Enhancements

1. **Two-way Chat Dashboard**
   - Dashboard untuk melihat dan membalas pesan masuk
   - Integration dengan notification system
   - Auto-reply untuk konfirmasi jadwal

2. **Template Messages**
   - Template pesan yang bisa dikustomisasi
   - Support untuk rich messages (image, document)

3. **Scheduled Messages**
   - Kirim pesan terjadwal (reminder sebelum jadwal)
   - Queue system untuk rate limiting

4. **Analytics**
   - Dashboard analytics untuk WhatsApp usage
   - Report delivery rate, response rate, dll

---

## 📝 Notes

- WhatsApp notifications akan **otomatis terkirim** saat superadmin membuat jadwal baru
- Jika dosen tidak punya nomor telepon, notifikasi akan di-skip (tidak error)
- Semua pengiriman di-log ke database untuk tracking
- Service akan handle error gracefully, tidak akan crash aplikasi jika Wablas API down

---

## 📞 Support

Jika ada masalah atau pertanyaan:
1. Cek log Laravel
2. Cek table `whatsapp_logs`
3. Dokumentasi Wablas: https://documentation.wablas.com
4. Contact developer team

