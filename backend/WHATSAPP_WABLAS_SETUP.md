# 📱 Setup WhatsApp dengan Wablas (Free Tier)

Panduan lengkap setup WhatsApp integration menggunakan Wablas API sesuai dengan dokumentasi resmi.

## 📋 Prerequisites

1. Akun Wablas (free tier)
2. Device WhatsApp sudah terhubung (scan QR code)
3. Token API dari dashboard Wablas

## ⚙️ Konfigurasi .env

Tambahkan ke file `.env`:

```env
# Wablas API Configuration
WABLAS_TOKEN=your_token_here
WABLAS_SECRET_KEY=your_secret_key_here  # Optional, jika ada
WABLAS_BASE_URL=https://tegal.wablas.com/api
WABLAS_ENABLED=true
```

**Catatan:**

-   `WABLAS_TOKEN`: Token dari dashboard Wablas (Device → Settings)
-   `WABLAS_SECRET_KEY`: Secret key jika ada (optional, untuk format token.secret_key)
-   `WABLAS_BASE_URL`: Default sudah benar untuk free tier (`https://tegal.wablas.com/api`)
-   `WABLAS_ENABLED`: Set `false` untuk disable

## 🔧 Setup Device WhatsApp

### 1. Scan QR Code

1. Login ke dashboard Wablas: https://tegal.wablas.com
2. Pilih menu **Device**
3. Klik icon **Scan QR Code**
4. Scan QR code dengan aplikasi WhatsApp Anda
5. Tunggu 5 menit sampai device terhubung
6. Anda akan dapat notifikasi jika device sudah connected

### 2. Cek Status Device

**Endpoint:** `GET /api/whatsapp/device`

**Headers:**

```
Authorization: Bearer YOUR_TOKEN
```

**Response:**

```json
{
    "message": "Device terhubung",
    "connected": true,
    "device": {
        "deviceId": "ABC123",
        "status": "connected",
        "deviceName": "Your Device"
    }
}
```

## 📤 Send Message

### Format API

Sesuai dokumentasi Wablas, menggunakan **GET request** dengan query parameters:

```
GET https://tegal.wablas.com/api/send-message?token={token}&phone={phone}&message={message}
```

### Via API Endpoint

**Endpoint:** `GET /api/whatsapp/test` atau `POST /api/whatsapp/test`

**Headers:**

```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

**Query Parameters (GET):**

```
?phone=6281234567890
```

**Body (POST):**

```json
{
    "phone": "6281234567890"
}
```

**Response Success:**

```json
{
  "message": "Koneksi berhasil! Pesan test berhasil dikirim",
  "result": {
    "success": true,
    "message_id": "abc123",
    "status": "sent",
    "response": {...}
  },
  "phone": "6281234567890",
  "timestamp": "2025-11-05T12:00:00.000Z"
}
```

**Response Error:**

```json
{
    "message": "Koneksi gagal",
    "error": "Error message",
    "result": {
        "success": false,
        "error": "..."
    }
}
```

### Via Send Message Endpoint

**Endpoint:** `POST /api/whatsapp/send`

**Body:**

```json
{
    "phone": "6281234567890",
    "message": "Pesan yang akan dikirim"
}
```

## ✅ Check Phone Number

Cek apakah nomor WhatsApp aktif (tersedia di Wablas free tier).

**Endpoint:** `GET /api/whatsapp/check-phone` atau `POST /api/whatsapp/check-phone`

**Query Parameters (GET):**

```
?phone=6281234567890
```

**Body (POST):**

```json
{
    "phone": "6281234567890"
}
```

**Response:**

```json
{
    "message": "Cek nomor telepon berhasil",
    "data": {
        "status": "active",
        "phone": "6281234567890"
    }
}
```

## 📊 API Endpoints Summary

| Endpoint                    | Method   | Description                         |
| --------------------------- | -------- | ----------------------------------- |
| `/api/whatsapp/test`        | GET/POST | Test koneksi dan kirim pesan test   |
| `/api/whatsapp/send`        | POST     | Kirim pesan manual                  |
| `/api/whatsapp/device`      | GET      | Cek status device (terhubung/tidak) |
| `/api/whatsapp/check-phone` | GET/POST | Cek nomor WhatsApp aktif            |
| `/api/whatsapp/logs`        | GET      | Lihat log pengiriman                |
| `/api/whatsapp/webhook`     | POST     | Webhook untuk pesan masuk           |

## 🧪 Testing

### 1. Test Device Status

```bash
curl -X GET "http://localhost:8000/api/whatsapp/device" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Test Send Message

```bash
curl -X GET "http://localhost:8000/api/whatsapp/test?phone=6281234567890" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Test Check Phone

```bash
curl -X GET "http://localhost:8000/api/whatsapp/check-phone?phone=6281234567890" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔍 Troubleshooting

### Problem: Device tidak terhubung

**Solusi:**

1. Pastikan sudah scan QR code
2. Tunggu 5 menit setelah scan
3. Cek status di dashboard Wablas
4. Jika masih tidak connect, hubungi support Wablas

### Problem: Message gagal terkirim

**Solusi:**

1. Cek device status: `GET /api/whatsapp/device`
2. Pastikan device status = "connected"
3. Cek nomor telepon format benar (62xxxxxxxxxx)
4. Cek log di dashboard Wablas
5. Cek log Laravel: `storage/logs/laravel.log`

### Problem: Token tidak valid

**Solusi:**

1. Pastikan token dari dashboard Wablas (Device → Settings)
2. Pastikan token tidak ada spasi
3. Jika pakai secret_key, format: `token.secret_key`
4. Cek di `.env` sudah benar

### Problem: Format nomor salah

**Solusi:**

-   Format yang benar: `6281234567890` (tanpa +, mulai dengan 62)
-   Service akan otomatis format:
    -   `081234567890` → `6281234567890`
    -   `81234567890` → `6281234567890`
    -   `6281234567890` → `6281234567890` (sudah benar)

## 📝 Format Nomor Telepon

Service otomatis akan format nomor ke format yang benar:

-   ✅ `081234567890` → `6281234567890`
-   ✅ `81234567890` → `6281234567890`
-   ✅ `6281234567890` → `6281234567890`
-   ✅ `+6281234567890` → `6281234567890`

## 🎯 Next Steps

Setelah send message berhasil:

1. ✅ Test send message - **SELESAI**
2. ⏭️ Setup webhook untuk receive message (two-way chat)
3. ⏭️ Setup group message (jika diperlukan)
4. ⏭️ Setup auto-reply (jika diperlukan)

## 📚 Referensi

-   Dokumentasi Wablas: https://tegal.wablas.com/documentation/api
-   Dashboard Wablas: https://tegal.wablas.com
