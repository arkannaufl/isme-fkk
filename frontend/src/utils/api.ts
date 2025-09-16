import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

// Konstanta untuk URL API yang bisa digunakan di seluruh aplikasi
export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const API_BASE_URL = `${BASE_URL}/api`;

// Retry configuration
const RETRY_DELAY = 1000; // 1 second
const MAX_RETRIES = 3;

// Retry function untuk network errors
const retryRequest = async (config: AxiosRequestConfig, retryCount = 0): Promise<AxiosResponse> => {
  try {
    return await axios(config);
  } catch (error) {
    const axiosError = error as AxiosError;
    
    // Only retry for network errors and if we haven't exceeded max retries
    if (
      (axiosError.code === 'ERR_NETWORK' || 
       axiosError.code === 'ERR_NETWORK_CHANGED' || 
       axiosError.code === 'ECONNABORTED') &&
      retryCount < MAX_RETRIES
    ) {
      console.warn(`Network error detected, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return retryRequest(config, retryCount + 1);
    }
    
    throw error;
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 detik timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Request interceptor untuk menambahkan token dan retry logic
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      if (!config.headers) {
        config.headers = {} as any;
      }
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add retry logic for network errors
    (config as any).retryCount = 0;
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor untuk handling error dan token expiration
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle network errors with retry
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
    
    // Handle 401 Unauthorized - redirect ke login
    if (error.response?.status === 401) {
      const errorCode = error.response?.data?.code;
      const message = error.response?.data?.message || 'Sesi Anda telah berakhir';
      
      // Clear token and user data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Dispatch custom event dengan pesan yang sesuai
      if (errorCode === 'DEVICE_CONFLICT') {
        window.dispatchEvent(new CustomEvent('sessionExpired', {
          detail: { message: 'Akun ini sedang digunakan di perangkat lain. Silakan login kembali.' }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('sessionExpired', {
          detail: { message: message }
        }));
      }
      
      return Promise.reject(error);
    }
    
    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.warn('Access forbidden:', error.response?.data?.message);
      return Promise.reject(error);
    }
    
    // Handle 422 Validation Error
    if (error.response?.status === 422) {
      console.warn('Validation error:', error.response?.data?.errors);
      return Promise.reject(error);
    }
    
    // Handle 500 Server Error
    if (error.response?.status >= 500) {
      console.error('Server error:', error.response?.data?.message);
      return Promise.reject(error);
    }
    
    // Handle other errors
    console.error('API Error:', error.message);
    return Promise.reject(error);
  }
);

// Utility function untuk error handling yang konsisten
export const handleApiError = (error: any, context: string = 'API Call') => {
  if (error.response) {
    // Server responded with error status
    const message = error.response.data?.message || error.response.data?.error || 'Terjadi kesalahan pada server';
    const status = error.response.status;
    
    switch (status) {
      case 400:
        return 'Permintaan tidak valid';
      case 401:
        return 'Sesi Anda telah berakhir. Silakan login kembali';
      case 403:
        return 'Anda tidak memiliki akses untuk melakukan tindakan ini';
      case 404:
        return 'Data tidak ditemukan';
      case 422:
        return 'Data yang dimasukkan tidak valid';
      case 500:
        return 'Server sedang mengalami masalah. Silakan coba lagi nanti';
      default:
        return message;
    }
  } else if (error.request) {
    // Network error
    if (error.code === 'ERR_NETWORK_CHANGED' || error.code === 'ERR_NETWORK') {
      return 'Koneksi internet terputus. Silakan periksa koneksi Anda dan coba lagi';
    }
    return 'Tidak dapat terhubung ke server. Silakan periksa koneksi internet Anda';
  } else {
    // Something else happened
    return error.message || 'Terjadi kesalahan yang tidak diketahui';
  }
};

// Utility function untuk retry dengan exponential backoff
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Only retry for network errors
      if (
        (error as any).code === 'ERR_NETWORK' || 
        (error as any).code === 'ERR_NETWORK_CHANGED' || 
        (error as any).code === 'ECONNABORTED'
      ) {
        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i);
          console.warn(`Retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      throw error;
    }
  }
  
  throw lastError;
};

export default api; 