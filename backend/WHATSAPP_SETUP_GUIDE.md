# 🚀 Quick Setup Guide - WhatsApp Bot Wablas

Panduan cepat untuk setup WhatsApp bot dengan Wablas di sistem akademik ISME.

## 📋 Checklist Setup

- [ ] Register akun Wablas.com
- [ ] Dapatkan API Token dari dashboard
- [ ] Update `.env` file dengan token
- [ ] Run migration untuk table `whatsapp_logs`
- [ ] Pastikan dosen punya nomor telepon di field `telp`
- [ ] Test koneksi API
- [ ] Setup webhook (optional, untuk two-way chat)

---

## ⚡ Langkah-langkah

### 1. Register di Wablas.com

1. Buka https://console.wablas.com
2. Daftar/Login
3. Copy API Token dari dashboard (Settings → API Token)

### 2. Update .env

Tambahkan ke file `.env`:

```env
WABLAS_TOKEN=your_token_from_wablas_dashboard
WABLAS_BASE_URL=https://console.wablas.com/api
WABLAS_ENABLED=true
```

### 3. Run Migration

```bash
cd isme-fkk/backend
php artisan migrate
```

### 4. Update Nomor Telepon Dosen

Pastikan dosen punya nomor telepon di database:

```sql
UPDATE users SET telp = '081234567890' WHERE id = 1;
```

Format nomor bisa:
- `081234567890` (dengan 0)
- `6281234567890` (tanpa 0, dengan 62)
- `81234567890` (tanpa 0 dan 62)

### 5. Test Koneksi

**Via API:**
```bash
curl -X POST http://localhost:8000/api/whatsapp/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Atau via Browser (Postman/Thunder Client):**
- POST `/api/whatsapp/test`
- Header: `Authorization: Bearer YOUR_TOKEN`

### 6. Test Kirim Pesan

**Via API:**
```bash
curl -X POST http://localhost:8000/api/whatsapp/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "6281234567890",
    "message": "Test pesan dari sistem akademik"
  }'
```

---

## ✅ Verifikasi

Setelah setup, cek:

1. **Log Laravel:**
```bash
tail -f storage/logs/laravel.log | grep -i whatsapp
```

2. **Database:**
```sql
SELECT * FROM whatsapp_logs ORDER BY created_at DESC LIMIT 10;
```

3. **Test dengan membuat jadwal baru:**
   - Login sebagai Superadmin
   - Buat jadwal praktikum/CSR/PBL baru
   - Assign dosen yang punya nomor telepon
   - Cek WhatsApp dosen (harusnya dapat notifikasi)

---

## 🎯 Selesai!

Sekarang sistem akan otomatis mengirim WhatsApp notification ke dosen setiap kali:
- Superadmin membuat jadwal baru
- Dosen di-assign ke jadwal

**Note:** Notifikasi hanya terkirim jika:
- `WABLAS_ENABLED=true`
- Dosen punya nomor telepon (`telp` field)
- Token Wablas valid

---

## 🔧 Troubleshooting

**WhatsApp tidak terkirim?**
1. Cek `.env` sudah benar
2. Cek log Laravel
3. Cek table `whatsapp_logs` untuk error message
4. Pastikan nomor telepon dosen valid

**Error "Token tidak valid"?**
- Cek token di dashboard Wablas
- Pastikan token tidak ada spasi
- Coba generate token baru

**Nomor telepon tidak valid?**
- Pastikan format: `081234567890` atau `6281234567890`
- Cek di database field `telp` sudah terisi

---

## 📚 Dokumentasi Lengkap

Lihat `WHATSAPP_INTEGRATION.md` untuk dokumentasi lengkap.

