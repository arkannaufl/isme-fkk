# Perbaikan Sistem Autentikasi - Single Device Login & Error Handling

## Masalah yang Ditemukan

### 1. Logout Otomatis
- User sering mengalami logout otomatis tanpa alasan yang jelas
- Token tidak divalidasi dengan benar saat setiap request
- Tidak ada pengecekan apakah token masih valid

### 2. Pesan "Akun Sedang Berada di Perangkat Lain"
- Sistem single-device login tidak berfungsi dengan baik
- Tidak ada validasi token aktif saat request
- User bisa login di multiple device tanpa batasan

### 3. Network Error Handling
- Error `ERR_NETWORK_CHANGED` sering terjadi saat koneksi internet tidak stabil
- Tidak ada retry mechanism untuk network errors
- User experience buruk saat koneksi terputus

### 4. Inconsistent Error Handling
- Error handling berbeda-beda di setiap file frontend
- Tidak ada centralized error management
- Pesan error tidak user-friendly

## Solusi yang Diimplementasikan

### 1. Middleware Validasi Token (`ValidateActiveToken`)

**File:** `backend/app/Http/Middleware/ValidateActiveToken.php`

Middleware ini akan:
- Memvalidasi apakah user masih login (`is_logged_in = true`)
- Mengecek apakah token yang digunakan masih valid (`current_token`)
- Mengembalikan error yang sesuai jika token tidak valid

```php
// Validasi status login
if (!$user->is_logged_in) {
    return response()->json([
        'message' => 'Sesi Anda telah berakhir. Silakan login kembali.',
        'code' => 'SESSION_EXPIRED'
    ], 401);
}

// Validasi token aktif
if ($user->current_token !== $currentToken) {
    return response()->json([
        'message' => 'Akun ini sedang digunakan di perangkat lain.',
        'code' => 'DEVICE_CONFLICT'
    ], 401);
}
```

### 2. Perbaikan AuthController

**File:** `backend/app/Http/Controllers/AuthController.php`

#### Login Process:
- Menambahkan pengecekan single-device login
- Menyimpan token aktif ke database
- Logging untuk audit trail

#### Logout Process:
- Menghapus semua token user (termasuk di perangkat lain)
- Reset status login
- Logging untuk audit trail

#### Force Logout:
- Endpoint baru untuk force logout dari perangkat lain
- Berguna ketika user lupa logout di perangkat lain

### 3. Perbaikan Frontend

**File:** `frontend/src/utils/api.ts`

#### API Interceptor dengan Retry Logic:
- Menangani error 401 dengan kode yang berbeda
- Dispatch event untuk session expired
- **Automatic retry untuk network errors** (`ERR_NETWORK_CHANGED`, `ERR_NETWORK`, `ECONNABORTED`)
- **Exponential backoff** dengan maksimal 3 retry
- **Centralized error handling** dengan `handleApiError` function
- Pesan yang lebih informatif dan user-friendly

#### Network Error Handling:
```typescript
// Automatic retry untuk network errors
if (
  (error.code === 'ERR_NETWORK' || 
   error.code === 'ERR_NETWORK_CHANGED' || 
   error.code === 'ECONNABORTED') &&
  !originalRequest._retry
) {
  originalRequest._retry = true;
  try {
    return await retryRequest(originalRequest);
  } catch (retryError) {
    console.error('All retry attempts failed:', retryError);
    return Promise.reject(retryError);
  }
}
```

**File:** `frontend/src/pages/AuthPages/SignIn.tsx`

#### Force Logout Modal:
- Modal untuk memberikan opsi force logout
- Retry login otomatis setelah force logout
- UX yang lebih baik
- **Consistent error handling** dengan `handleApiError`

### 4. Centralized Error Management

**File:** `frontend/src/utils/api.ts`

#### `handleApiError` Function:
- **Centralized error message generation**
- **Consistent error handling** across all frontend files
- **User-friendly error messages** berdasarkan error type
- **Proper logging** untuk debugging

```typescript
export const handleApiError = (error: any, context: string = 'API Call') => {
  if (error.response) {
    const message = error.response.data?.message || error.response.data?.error || 'Terjadi kesalahan pada server';
    const status = error.response.status;
    
    switch (status) {
      case 400: return 'Permintaan tidak valid';
      case 401: return 'Sesi Anda telah berakhir. Silakan login kembali';
      case 403: return 'Anda tidak memiliki akses untuk melakukan tindakan ini';
      case 404: return 'Data tidak ditemukan';
      case 422: return 'Data yang dimasukkan tidak valid';
      case 500: return 'Server sedang mengalami masalah. Silakan coba lagi nanti';
      default: return message;
    }
  } else if (error.request) {
    if (error.code === 'ERR_NETWORK_CHANGED' || error.code === 'ERR_NETWORK') {
      return 'Koneksi internet terputus. Silakan periksa koneksi Anda dan coba lagi';
    }
    return 'Tidak dapat terhubung ke server. Silakan periksa koneksi internet Anda';
  } else {
    return error.message || 'Terjadi kesalahan yang tidak diketahui';
  }
};
```

#### Frontend Files Updated:
- **43+ frontend files** telah diupdate untuk menggunakan `handleApiError`
- **Consistent error handling** di semua komponen
- **Better user experience** dengan pesan error yang jelas

### 5. Middleware Registration

**File:** `backend/bootstrap/app.php`

```php
'validate.token' => \App\Http\Middleware\ValidateActiveToken::class,
```

### 6. Route Protection

**File:** `backend/routes/api.php`

Semua route yang memerlukan autentikasi sekarang menggunakan middleware `validate.token`:

```php
Route::middleware(['auth:sanctum', 'validate.token'])->get('/me', ...);
Route::middleware(['auth:sanctum', 'validate.token'])->post('/logout', ...);
Route::middleware(['auth:sanctum', 'validate.token'])->post('/force-logout', ...);
```

### 7. Notification API Permissions

**File:** `backend/app/Http/Controllers/NotificationController.php`

#### Perbaikan Permission untuk Mark as Read:
- **Sebelumnya**: Hanya super admin dan owner notification yang bisa mark as read
- **Sekarang**: **Semua role** (dosen, mahasiswa, tim_akademik, admin, super_admin) bisa mark notification as read
- **Fleksibilitas**: User bisa mark notification sebagai read tanpa batasan ownership

```php
// All authenticated users can mark any notification as read
// This allows all roles (dosen, mahasiswa, tim_akademik, admin) to mark notifications as read
$notification->update([
    'is_read' => true,
    'read_at' => now()
]);
```

## Cara Kerja Sistem Baru

### 1. Login Process
1. User memasukkan credentials
2. Sistem mengecek apakah user sudah login di perangkat lain
3. Jika sudah, tampilkan modal force logout
4. Jika belum, buat token baru dan simpan ke database
5. Set `is_logged_in = true` dan `current_token = token`

### 2. Request Validation
1. Setiap request ke API yang dilindungi akan melalui middleware `validate.token`
2. Middleware mengecek apakah user masih login
3. Middleware mengecek apakah token masih valid
4. Jika tidak valid, return error dengan kode yang sesuai

### 3. Logout Process
1. User logout manual: hapus token dan reset status
2. Force logout: hapus semua token user
3. Logging untuk audit trail

### 4. Error Handling
- `SESSION_EXPIRED`: Sesi berakhir, redirect ke login
- `DEVICE_CONFLICT`: Akun digunakan di perangkat lain, tampilkan modal force logout
- **Network Errors**: Automatic retry dengan exponential backoff
- **Server Errors**: User-friendly error messages dengan `handleApiError`

### 5. Network Error Recovery
1. **Automatic Retry**: Network errors akan di-retry otomatis hingga 3 kali
2. **Exponential Backoff**: Delay antar retry meningkat secara eksponensial
3. **User Feedback**: Pesan error yang jelas tentang status koneksi
4. **Graceful Degradation**: Aplikasi tetap berfungsi meski koneksi tidak stabil

## Keuntungan Solusi Ini

1. **Keamanan**: Mencegah login ganda di multiple device
2. **User Experience**: Pesan error yang jelas dan opsi force logout
3. **Audit Trail**: Logging untuk semua aktivitas login/logout
4. **Konsistensi**: Validasi token di setiap request
5. **Fleksibilitas**: User bisa force logout jika lupa logout di perangkat lain
6. **Network Resilience**: Automatic retry untuk network errors
7. **Centralized Error Management**: Consistent error handling di seluruh aplikasi
8. **Better Debugging**: Proper logging untuk semua error types
9. **Industry Standard**: Implementasi sesuai best practices React + Laravel Sanctum

## Testing

### 1. Single Device Login Testing:
1. Login di browser A
2. Coba login di browser B dengan akun yang sama
3. Sistem akan menampilkan pesan "Akun sedang digunakan di perangkat lain"
4. Pilih "Force Logout" untuk logout dari browser A
5. Login di browser B akan berhasil

### 2. Network Error Testing:
1. Matikan koneksi internet saat melakukan request
2. Sistem akan otomatis retry request
3. Pesan error yang jelas akan ditampilkan
4. Koneksi kembali normal, request akan berhasil

### 3. Error Handling Testing:
1. Test berbagai error scenarios (401, 403, 404, 422, 500)
2. Pastikan pesan error konsisten dan user-friendly
3. Verify logging berfungsi dengan baik

### 4. Notification Permission Testing:
1. Login dengan role apapun (dosen, mahasiswa, admin, dll)
2. Coba mark notification as read
3. Pastikan semua role bisa mark notification as read

## Monitoring

Sistem ini juga menyediakan logging untuk monitoring:
- Failed login attempts
- Successful logins
- Manual logouts
- Force logouts
- Session expirations
- **Network error retries**
- **API error patterns**
- **Error frequency analysis**

Semua log dapat dilihat di activity log Laravel.

## Performance Impact

### Network Error Handling:
- **Minimal overhead**: Retry hanya terjadi saat ada network error
- **Smart retry**: Tidak retry untuk error yang bukan network-related
- **Exponential backoff**: Mencegah spam retry yang berlebihan

### Error Handling:
- **Centralized processing**: Lebih efisien daripada manual error handling
- **Consistent UX**: User experience yang lebih baik
- **Better debugging**: Logging yang lebih terstruktur

## Maintenance

### Regular Checks:
1. Monitor error logs untuk pattern yang tidak normal
2. Review retry success rate
3. Update error messages jika diperlukan
4. Test network error scenarios secara berkala

### Future Improvements:
1. Implement circuit breaker pattern untuk API calls
2. Add more sophisticated retry strategies
3. Implement error analytics dashboard
4. Add performance monitoring untuk error handling
