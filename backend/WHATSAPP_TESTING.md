# 🧪 Testing WhatsApp Integration

Panduan untuk testing integrasi WhatsApp dengan Wablas.

## ✅ Cara Test yang Benar

### 1. Test via Browser (GET Request)

**URL yang benar:**

```
http://localhost:8000/api/whatsapp/test?phone=6281234567890
```

**Catatan:**

-   Pastikan backend Laravel running di `localhost:8000`
-   Pastikan sudah login dan punya auth token
-   Buka browser dan akses URL di atas (akan redirect ke login jika belum login)

### 2. Test via Postman/Thunder Client

**Method:** `GET` atau `POST`

**URL:**

```
http://localhost:8000/api/whatsapp/test
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body (untuk POST):**

```json
{
    "phone": "6281234567890"
}
```

**Query Parameter (untuk GET):**

```
?phone=6281234567890
```

### 3. Test via cURL

```bash
# GET request
curl -X GET "http://localhost:8000/api/whatsapp/test?phone=6281234567890" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# POST request
curl -X POST "http://localhost:8000/api/whatsapp/test" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "6281234567890"}'
```

### 4. Test via Frontend (React)

```typescript
import api from "@/utils/api";

// Test koneksi
const testWhatsApp = async () => {
    try {
        const response = await api.get("/whatsapp/test", {
            params: { phone: "6281234567890" },
        });
        console.log("Success:", response.data);
    } catch (error) {
        console.error("Error:", error);
    }
};
```

## ⚠️ Common Mistakes

### ❌ SALAH:

-   `http://localhost:5173/api/whatsaap/bot` ❌ (typo + salah endpoint)
-   `http://localhost:5173/api/whatsapp/test` ❌ (frontend, bukan backend)
-   Akses tanpa auth token ❌

### ✅ BENAR:

-   `http://localhost:8000/api/whatsapp/test` ✅ (backend + endpoint benar)
-   Dengan auth token di header ✅
-   Method GET atau POST ✅

## 🔍 Troubleshooting

### Problem: 401 Unauthorized

**Solusi:** Pastikan sudah login dan punya token di header

### Problem: 304 Not Modified

**Solusi:** Clear browser cache atau gunakan Postman/Thunder Client

### Problem: Redirect ke Dashboard

**Solusi:**

-   Pastikan URL benar: `localhost:8000` (bukan `localhost:5173`)
-   Pastikan endpoint benar: `/api/whatsapp/test` (bukan `/api/whatsaap/bot`)
-   Pastikan sudah login

### Problem: Service tidak aktif

**Solusi:**

-   Cek `.env` file: `WABLAS_ENABLED=true`
-   Cek `.env` file: `WABLAS_TOKEN=your_token`
-   Restart Laravel server setelah update `.env`

## 📋 Response yang Diharapkan

### Success Response (200):

```json
{
  "message": "Koneksi berhasil! Pesan test berhasil dikirim",
  "result": {
    "success": true,
    "message_id": "123456",
    "status": "sent",
    "response": {...}
  },
  "phone": "6281234567890",
  "timestamp": "2025-11-05T12:00:00.000Z"
}
```

### Error Response (500):

```json
{
    "message": "Koneksi gagal",
    "error": "Error message here",
    "result": {
        "success": false,
        "error": "..."
    },
    "phone": "6281234567890",
    "config": {
        "enabled": true,
        "base_url": "https://console.wablas.com/api"
    }
}
```

### Service Disabled (503):

```json
{
    "message": "WhatsApp service tidak aktif",
    "error": "WABLAS_ENABLED=false atau WABLAS_TOKEN tidak ditemukan",
    "config": {
        "enabled": false,
        "token_set": false
    }
}
```

## 🎯 Quick Test Steps

1. **Pastikan backend running:**

    ```bash
    cd isme-fkk/backend
    php artisan serve
    ```

2. **Pastikan `.env` sudah diupdate:**

    ```env
    WABLAS_TOKEN=your_token_here
    WABLAS_ENABLED=true
    ```

3. **Test via browser:**

    - Login dulu di frontend
    - Buka: `http://localhost:8000/api/whatsapp/test?phone=6281234567890`
    - Pastikan sudah login (ada token di localStorage)

4. **Atau test via Postman:**

    - Method: GET
    - URL: `http://localhost:8000/api/whatsapp/test?phone=6281234567890`
    - Headers: `Authorization: Bearer YOUR_TOKEN`

5. **Cek response:**
    - Jika success, nomor yang di-test akan dapat pesan WhatsApp
    - Cek juga di `whatsapp_logs` table untuk tracking
