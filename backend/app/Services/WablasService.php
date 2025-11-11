<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Config;

class WablasService
{
    protected string $baseUrl;
    protected string $token;
    protected string $secretKey;
    protected bool $enabled;

    public function __construct()
    {
        // Ambil langsung dari env, tidak perlu melalui config
        $this->baseUrl = env('WABLAS_BASE_URL', 'https://tegal.wablas.com/api');
        $this->token = env('WABLAS_TOKEN', '');
        $this->secretKey = env('WABLAS_SECRET_KEY', '');
        $this->enabled = env('WABLAS_ENABLED', true);
    }

    /**
     * Kirim pesan WhatsApp melalui Wablas API (GET request sesuai dokumentasi)
     *
     * @param string $phone Nomor telepon (format: 6281234567890, tanpa +)
     * @param string $message Pesan yang akan dikirim
     * @param array $options Opsi tambahan (isGroup, etc.)
     * @return array|null
     */
    public function sendMessage(string $phone, string $message, array $options = []): ?array
    {
        if (!$this->enabled || empty($this->token)) {
            Log::warning('Wablas service tidak diaktifkan atau token tidak ditemukan');
            return null;
        }

        // Format nomor telepon (pastikan tanpa +, mulai dengan 62)
        $phone = $this->formatPhoneNumber($phone);

        if (!$phone) {
            Log::error("Format nomor telepon tidak valid: {$phone}");
            return null;
        }

        try {
            // Format token: token.secret_key (sesuai dokumentasi)
            $authToken = !empty($this->secretKey) ? "{$this->token}.{$this->secretKey}" : $this->token;

            // Build URL dengan query string manual sesuai dokumentasi PHP
            // Format: https://tegal.wablas.com/api/send-message?token=$token.$secret_key&phone=$phone&message=$message
            // Gunakan Laravel Http dengan query parameters - akan otomatis encode dengan benar
            // Laravel Http menggunakan rawurlencode yang akan convert spasi jadi %20, bukan +
            $url = "{$this->baseUrl}/send-message";

            $params = [
                'token' => $authToken,
                'phone' => $phone,
                'message' => $message, // Biarkan Laravel Http encode dengan benar
            ];

            // Tambahkan opsi jika ada (misalnya isGroup)
            if (isset($options['isGroup']) && $options['isGroup']) {
                $params['isGroup'] = 'true';
            }

            // Tambahkan ref_id jika ada (custom reference ID untuk tracking)
            if (isset($options['ref_id']) && !empty($options['ref_id'])) {
                $params['ref_id'] = $options['ref_id'];
            }

            Log::info('Wablas Send Message Request', [
                'url' => $url,
                'phone' => $phone,
                'token_set' => !empty($this->token),
                'secret_key_set' => !empty($this->secretKey),
                'message_length' => strlen($message),
                'token_format' => $authToken,
                'message_preview' => substr($message, 0, 100),
            ]);

            // Laravel Http akan otomatis URL encode query parameters dengan benar
            // Menggunakan rawurlencode internally, jadi spasi jadi %20, bukan +
            $response = Http::withoutVerifying() // SSL verification off sesuai dokumentasi
                ->get($url, $params);

            $responseData = $response->json() ?? $response->body();

            // Log response
            Log::info('Wablas API Response', [
                'phone' => $phone,
                'status' => $response->status(),
                'response' => $responseData,
            ]);

            // Parse response (bisa JSON atau string)
            if (is_string($responseData)) {
                $responseData = json_decode($responseData, true) ?? ['message' => $responseData];
            }

            if ($response->successful()) {
                // Extract message_id dari berbagai kemungkinan lokasi di response
                // Format 1: response.data.response.data.messages[0].id (paling umum)
                // Format 2: response.data.id
                // Format 3: response.id
                $messageId = null;
                if (isset($responseData['data']['response']['data']['messages'][0]['id'])) {
                    $messageId = $responseData['data']['response']['data']['messages'][0]['id'];
                } elseif (isset($responseData['data']['id'])) {
                    $messageId = $responseData['data']['id'];
                } elseif (isset($responseData['id'])) {
                    $messageId = $responseData['id'];
                } elseif (isset($responseData['response']['data']['messages'][0]['id'])) {
                    $messageId = $responseData['response']['data']['messages'][0]['id'];
                }

                // Extract ref_id jika ada (custom reference ID)
                $refId = null;
                if (isset($responseData['data']['response']['data']['messages'][0]['ref_id'])) {
                    $refId = $responseData['data']['response']['data']['messages'][0]['ref_id'];
                } elseif (isset($responseData['response']['data']['messages'][0]['ref_id'])) {
                    $refId = $responseData['response']['data']['messages'][0]['ref_id'];
                }

                return [
                    'success' => true,
                    'message_id' => $messageId,
                    'ref_id' => $refId ?? $options['ref_id'] ?? null,
                    'status' => $responseData['status'] ?? ($responseData['data']['response']['data']['messages'][0]['status'] ?? 'sent'),
                    'response' => $responseData,
                ];
            } else {
                Log::error('Wablas API Error', [
                    'phone' => $phone,
                    'status' => $response->status(),
                    'response' => $responseData,
                ]);

                return [
                    'success' => false,
                    'error' => $responseData['message'] ?? $responseData['error'] ?? 'Gagal mengirim pesan',
                    'status_code' => $response->status(),
                    'response' => $responseData,
                ];
            }
        } catch (\Exception $e) {
            Log::error('Wablas Service Exception', [
                'phone' => $phone,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Kirim pesan WhatsApp bulk melalui Wablas API v2 (POST request untuk bulk messaging)
     *
     * @param array $messages Array of message objects dengan format:
     *   [
     *     ['phone' => '6281234567890', 'message' => 'Pesan 1', 'isGroup' => 'false', 'ref_id' => 'optional'],
     *     ['phone' => '6281234567891', 'message' => 'Pesan 2', 'isGroup' => 'false']
     *   ]
     * @return array|null
     */
    public function sendBulkMessage(array $messages): ?array
    {
        if (!$this->enabled || empty($this->token)) {
            Log::warning('Wablas service tidak diaktifkan atau token tidak ditemukan');
            return null;
        }

        if (empty($messages)) {
            Log::warning('Tidak ada pesan untuk dikirim');
            return null;
        }

        // Limit 100 messages per request sesuai dokumentasi
        if (count($messages) > 100) {
            Log::warning('Jumlah pesan melebihi limit 100, akan diproses dalam batch');
        }

        try {
            // Format token: token.secret_key (sesuai dokumentasi)
            $authToken = !empty($this->secretKey) ? "{$this->token}.{$this->secretKey}" : $this->token;

            // Endpoint v2 API
            $url = "{$this->baseUrl}/v2/send-message";

            // Prepare payload sesuai dokumentasi v2 API
            $payload = ['data' => []];

            foreach ($messages as $msg) {
                $phone = $this->formatPhoneNumber($msg['phone'] ?? '');

                if (!$phone) {
                    Log::warning("Format nomor telepon tidak valid: {$msg['phone']}");
                    continue;
                }

                $messageData = [
                    'phone' => $phone,
                    'message' => $msg['message'] ?? '',
                    'isGroup' => $msg['isGroup'] ?? 'false',
                ];

                // Tambahkan ref_id jika ada
                if (isset($msg['ref_id']) && !empty($msg['ref_id'])) {
                    $messageData['ref_id'] = $msg['ref_id'];
                }

                $payload['data'][] = $messageData;
            }

            if (empty($payload['data'])) {
                Log::warning('Tidak ada pesan valid untuk dikirim setelah validasi');
                return null;
            }

            Log::info('Wablas Bulk Send Message Request', [
                'url' => $url,
                'total_messages' => count($payload['data']),
                'token_set' => !empty($this->token),
                'secret_key_set' => !empty($this->secretKey),
            ]);

            // POST request dengan JSON body
            $response = Http::withoutVerifying()
                ->withHeaders([
                    'Authorization' => $authToken,
                    'Content-Type' => 'application/json',
                ])
                ->post($url, $payload);

            $responseData = $response->json() ?? $response->body();

            // Log response
            Log::info('Wablas Bulk API Response', [
                'status' => $response->status(),
                'total_messages' => count($payload['data']),
                'response' => $responseData,
            ]);

            // Parse response
            if (is_string($responseData)) {
                $responseData = json_decode($responseData, true) ?? ['message' => $responseData];
            }

            if ($response->successful()) {
                return [
                    'success' => true,
                    'status' => $responseData['status'] ?? true,
                    'message' => $responseData['message'] ?? 'Messages processed successfully',
                    'data' => $responseData['data'] ?? [],
                    'response' => $responseData,
                ];
            } else {
                Log::error('Wablas Bulk API Error', [
                    'status' => $response->status(),
                    'response' => $responseData,
                ]);

                return [
                    'success' => false,
                    'error' => $responseData['message'] ?? $responseData['error'] ?? 'Gagal mengirim pesan bulk',
                    'status_code' => $response->status(),
                    'response' => $responseData,
                ];
            }
        } catch (\Exception $e) {
            Log::error('Wablas Bulk Service Exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Kirim button message melalui Wablas API v2
     * POST https://tegal.wablas.com/api/v2/send-button
     *
     * @param string $phone Nomor telepon (format: 6281234567890)
     * @param string $content Konten pesan utama
     * @param array $buttons Array button (max 3)
     * @param string|null $footer Footer pesan (optional)
     * @param array $options Opsi tambahan (ref_id, isGroup, etc.)
     * @return array|null
     */
    public function sendButtonMessage(string $phone, string $content, array $buttons, ?string $footer = null, array $options = []): ?array
    {
        if (!$this->enabled || empty($this->token)) {
            Log::warning('Wablas service tidak diaktifkan atau token tidak ditemukan');
            return null;
        }

        // Format nomor telepon
        $phone = $this->formatPhoneNumber($phone);

        if (!$phone) {
            Log::error("Format nomor telepon tidak valid: {$phone}");
            return null;
        }

        // Validasi buttons (max 3)
        if (count($buttons) > 3) {
            Log::warning('Jumlah button melebihi limit 3, hanya 3 button pertama yang akan digunakan');
            $buttons = array_slice($buttons, 0, 3);
        }

        if (empty($buttons)) {
            Log::error('Button tidak boleh kosong');
            return null;
        }

        try {
            // Format token: token.secret_key
            $authToken = !empty($this->secretKey) ? "{$this->token}.{$this->secretKey}" : $this->token;

            // Endpoint v2 API
            $url = "{$this->baseUrl}/v2/send-button";

            // Build message object sesuai dokumentasi
            $messageData = [
                'buttons' => $buttons,
                'content' => $content,
            ];

            if ($footer) {
                $messageData['footer'] = $footer;
            }

            // Build payload
            $payload = [
                'data' => [
                    [
                        'phone' => $phone,
                        'message' => $messageData,
                    ]
                ]
            ];

            // Tambahkan opsi jika ada
            if (isset($options['isGroup']) && $options['isGroup']) {
                $payload['data'][0]['isGroup'] = 'true';
            }

            if (isset($options['ref_id']) && !empty($options['ref_id'])) {
                $payload['data'][0]['ref_id'] = $options['ref_id'];
            }

            Log::info('Wablas Send Button Message Request', [
                'url' => $url,
                'phone' => $phone,
                'buttons' => $buttons,
                'content_preview' => substr($content, 0, 100),
                'ref_id' => $options['ref_id'] ?? null,
            ]);

            // POST request dengan JSON body
            $response = Http::withoutVerifying()
                ->withHeaders([
                    'Authorization' => $authToken,
                    'Content-Type' => 'application/json',
                ])
                ->post($url, $payload);

            $responseData = $response->json() ?? $response->body();

            // Log response
            Log::info('Wablas Button API Response', [
                'phone' => $phone,
                'status' => $response->status(),
                'response' => $responseData,
            ]);

            // Parse response
            if (is_string($responseData)) {
                $responseData = json_decode($responseData, true) ?? ['message' => $responseData];
            }

            if ($response->successful()) {
                // Extract message_id dari response
                $messageId = null;
                if (isset($responseData['data']['messages'][0]['id'])) {
                    $messageId = $responseData['data']['messages'][0]['id'];
                } elseif (isset($responseData['data'][0]['messages'][0]['id'])) {
                    $messageId = $responseData['data'][0]['messages'][0]['id'];
                }

                return [
                    'success' => true,
                    'status' => $responseData['status'] ?? true,
                    'message' => $responseData['message'] ?? 'Button message sent successfully',
                    'message_id' => $messageId,
                    'data' => $responseData['data'] ?? [],
                    'response' => $responseData,
                ];
            } else {
                Log::error('Wablas Button API Error', [
                    'status' => $response->status(),
                    'response' => $responseData,
                ]);

                return [
                    'success' => false,
                    'error' => $responseData['message'] ?? $responseData['error'] ?? 'Gagal mengirim button message',
                    'status_code' => $response->status(),
                    'response' => $responseData,
                ];
            }
        } catch (\Exception $e) {
            Log::error('Wablas Button Service Exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Cek status device (apakah WhatsApp terhubung)
     * Sesuai dokumentasi: GET https://tegal.wablas.com/api/device/info?token=$token
     *
     * @return array|null
     */
    public function checkDeviceStatus(): ?array
    {
        if (!$this->enabled || empty($this->token)) {
            return null;
        }

        try {
            // Endpoint sesuai dokumentasi: /api/device/info dengan token di query parameter
            // Endpoint ini hanya perlu token saja, tidak perlu secret_key (berbeda dengan send-message)
            $url = "{$this->baseUrl}/device/info";

            Log::info('Wablas Device Info Request', [
                'url' => $url,
                'token_set' => !empty($this->token),
                'secret_key_set' => !empty($this->secretKey),
            ]);

            $response = Http::withoutVerifying()
                ->get($url, [
                    'token' => $this->token, // Hanya token, tidak pakai secret_key untuk endpoint ini
                ]);

            $responseData = $response->json() ?? $response->body();

            // Parse response jika string
            if (is_string($responseData)) {
                $responseData = json_decode($responseData, true) ?? ['message' => $responseData];
            }

            Log::info('Wablas Device Info Response', [
                'status_code' => $response->status(),
                'response' => $responseData,
            ]);

            if ($response->successful()) {
                // Handle response format sesuai dokumentasi
                if (isset($responseData['status']) && $responseData['status'] === true && isset($responseData['data'])) {
                    $deviceData = $responseData['data'];

                    return [
                        'success' => true,
                        'connected' => ($deviceData['status'] ?? 'disconnected') === 'connected',
                        'active' => $deviceData['active'] ?? false,
                        'device' => [
                            'serial' => $deviceData['serial'] ?? null,
                            'sender' => $deviceData['sender'] ?? null,
                            'name' => $deviceData['name'] ?? null,
                            'quota' => $deviceData['quota'] ?? null,
                            'expired_date' => $deviceData['expired_date'] ?? null,
                            'status' => $deviceData['status'] ?? 'disconnected',
                            'active' => $deviceData['active'] ?? false,
                        ],
                        'raw_response' => $responseData,
                    ];
                } else {
                    // Jika response tidak sesuai format
                    return [
                        'success' => false,
                        'error' => $responseData['message'] ?? 'Response tidak valid dari Wablas',
                        'response' => $responseData,
                    ];
                }
            }

            return [
                'success' => false,
                'error' => $responseData['message'] ?? $responseData['error'] ?? 'Gagal cek status device',
                'status_code' => $response->status(),
                'response' => $responseData,
            ];
        } catch (\Exception $e) {
            Log::error('Wablas Check Device Exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Cek apakah nomor WhatsApp aktif
     *
     * @param string|array $phones Nomor telepon (bisa string atau array)
     * @return array|null
     */
    public function checkPhoneNumber($phones): ?array
    {
        if (!$this->enabled || empty($this->token)) {
            return null;
        }

        try {
            // Convert array to comma-separated string
            if (is_array($phones)) {
                $phones = implode(',', array_map([$this, 'formatPhoneNumber'], $phones));
            } else {
                $phones = $this->formatPhoneNumber($phones);
            }

            if (!$phones) {
                return [
                    'success' => false,
                    'error' => 'Format nomor telepon tidak valid',
                ];
            }

            $response = Http::withoutVerifying()
                ->get('https://phone.wablas.com/check-phone-number', [
                    'phones' => $phones,
                ]);

            $responseData = $response->json() ?? $response->body();

            if (is_string($responseData)) {
                $responseData = json_decode($responseData, true) ?? ['message' => $responseData];
            }

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $responseData,
                ];
            }

            return [
                'success' => false,
                'error' => $responseData['message'] ?? 'Gagal cek nomor telepon',
                'response' => $responseData,
            ];
        } catch (\Exception $e) {
            Log::error('Wablas Check Phone Exception', [
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Format nomor telepon ke format Wablas (62xxxxxxxxxx)
     *
     * @param string $phone Nomor telepon
     * @return string|null
     */
    protected function formatPhoneNumber(string $phone): ?string
    {
        // Hapus semua karakter non-digit
        $phone = preg_replace('/[^0-9]/', '', $phone);

        // Jika sudah mulai dengan 62, langsung return
        if (preg_match('/^62\d{9,12}$/', $phone)) {
            return $phone;
        }

        // Jika mulai dengan 0, ganti dengan 62
        if (preg_match('/^0(\d{9,12})$/', $phone, $matches)) {
            return '62' . $matches[1];
        }

        // Jika mulai dengan 8 (tanpa 0), tambahkan 62
        if (preg_match('/^8(\d{9,12})$/', $phone)) {
            return '62' . $phone;
        }

        // Jika sudah 9-12 digit, tambahkan 62
        if (preg_match('/^\d{9,12}$/', $phone)) {
            return '62' . $phone;
        }

        return null;
    }

    /**
     * Cek status pengiriman pesan
     *
     * @param string $messageId ID pesan dari response sebelumnya
     * @return array|null
     */
    public function checkMessageStatus(string $messageId): ?array
    {
        if (!$this->enabled || empty($this->token)) {
            return null;
        }

        try {
            $authToken = !empty($this->secretKey) ? "{$this->token}.{$this->secretKey}" : $this->token;

            $response = Http::withoutVerifying()
                ->get("{$this->baseUrl}/report", [
                    'token' => $authToken,
                    'id' => $messageId,
                ]);

            if ($response->successful()) {
                $responseData = $response->json();
                return [
                    'success' => true,
                    'data' => $responseData,
                ];
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Wablas Check Status Exception', [
                'message_id' => $messageId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Cek apakah service aktif
     *
     * @return bool
     */
    public function isEnabled(): bool
    {
        return $this->enabled && !empty($this->token);
    }

    /**
     * Ambil laporan pesan dari Wablas
     * GET https://tegal.wablas.com/api/report/message
     *
     * @param array $filters Filter parameters (date, phone, page, perPage, status, type, message_id, text, device, ref_id)
     * @return array|null
     */
    public function getReportMessage(array $filters = []): ?array
    {
        if (!$this->enabled || empty($this->token)) {
            return null;
        }

        try {
            $authToken = !empty($this->secretKey) ? "{$this->token}.{$this->secretKey}" : $this->token;
            $url = "{$this->baseUrl}/report/message";

            // Build query parameters
            // Hanya tambahkan parameter jika ada value dan tidak kosong
            // Ini penting untuk reset: jika semua filter kosong, Wablas akan return semua data
            $params = [];
            if (isset($filters['date']) && $filters['date'] !== '' && trim($filters['date']) !== '') {
                $params['date'] = $filters['date'];
            }
            if (isset($filters['phone']) && $filters['phone'] !== '' && trim($filters['phone']) !== '') {
                $params['phone'] = $filters['phone'];
            }
            if (isset($filters['page']) && $filters['page'] !== '' && $filters['page'] !== null) {
                $params['page'] = $filters['page'];
            }
            if (isset($filters['perPage']) && $filters['perPage'] !== '' && $filters['perPage'] !== null) {
                $params['perPage'] = $filters['perPage'];
            }
            if (isset($filters['status']) && $filters['status'] !== '' && trim($filters['status']) !== '') {
                $params['status'] = $filters['status'];
            }
            if (isset($filters['type']) && $filters['type'] !== '' && trim($filters['type']) !== '') {
                $params['type'] = $filters['type'];
            }
            if (isset($filters['message_id']) && $filters['message_id'] !== '' && trim($filters['message_id']) !== '') {
                $params['message_id'] = $filters['message_id'];
            }
            if (isset($filters['text']) && $filters['text'] !== '' && trim($filters['text']) !== '') {
                $params['text'] = $filters['text'];
            }
            if (isset($filters['device']) && $filters['device'] !== '' && trim($filters['device']) !== '') {
                $params['device'] = $filters['device'];
            }
            if (isset($filters['ref_id']) && $filters['ref_id'] !== '' && trim($filters['ref_id']) !== '') {
                $params['ref_id'] = $filters['ref_id'];
            }

            Log::info('Wablas Report Message Request', [
                'url' => $url,
                'auth_token_set' => !empty($authToken),
                'filters_received' => $filters,
                'params_to_send' => $params,
                'has_date_filter' => isset($params['date']),
                'params_count' => count($params),
            ]);

            $response = Http::withoutVerifying()
                ->withHeaders([
                    'Authorization' => $authToken,
                ])
                ->get($url, $params);

            $responseData = $response->json() ?? $response->body();

            if (is_string($responseData)) {
                $responseData = json_decode($responseData, true) ?? ['message' => $responseData];
            }

            Log::info('Wablas Report Message Response', [
                'status_code' => $response->status(),
                'filters' => $filters,
                'params_sent' => $params,
                'response_keys' => is_array($responseData) ? array_keys($responseData) : 'not_array',
                'response_preview' => is_array($responseData)
                    ? (isset($responseData['message']) ? 'has_message_field' : 'no_message_field')
                    : substr((string)$responseData, 0, 200),
                'total_data' => $responseData['totalData'] ?? null,
                'message_count' => isset($responseData['message']) && is_array($responseData['message']) ? count($responseData['message']) : 0,
                'full_response' => $responseData, // Log full response untuk debugging
            ]);

            // Handle rate limit (429) atau error "Report generation limit exceeded"
            if (
                $response->status() === 429 ||
                (isset($responseData['error']) && strpos(strtolower($responseData['error']), 'limit exceeded') !== false)
            ) {
                return [
                    'success' => true,
                    'data' => [
                        'status' => true,
                        'message' => [],
                        'totalData' => 0,
                        'page' => $filters['page'] ?? 1,
                        'totalPage' => 0,
                    ],
                    'rate_limited' => true,
                    'message' => $responseData['message'] ?? 'Rate limit exceeded. Silakan tunggu beberapa saat.',
                ];
            }

            // Handle error 500 dari Wablas - bisa jadi valid tapi format berbeda
            if ($response->status() === 500) {
                // Cek apakah response masih valid (kadang Wablas return 500 tapi ada data)
                if (isset($responseData['status']) && $responseData['status'] === true) {
                    return [
                        'success' => true,
                        'data' => $responseData,
                    ];
                }

                // Cek apakah HTML error page (bukan JSON)
                if (is_string($responseData) && strpos($responseData, '<!DOCTYPE html>') !== false) {
                    Log::error('Wablas Report Message HTML Error', [
                        'filters' => $filters,
                    ]);
                    return [
                        'success' => false,
                        'error' => 'Wablas API mengembalikan error. Silakan coba lagi nanti.',
                        'status_code' => 500,
                    ];
                }

                // Jika benar-benar error, log dan return error
                Log::error('Wablas Report Message 500 Error', [
                    'response' => $responseData,
                    'filters' => $filters,
                ]);

                return [
                    'success' => false,
                    'error' => $responseData['message'] ?? $responseData['error'] ?? 'Wablas API error (500)',
                    'status_code' => 500,
                    'response' => $responseData,
                ];
            }

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $responseData,
                ];
            }

            return [
                'success' => false,
                'error' => $responseData['message'] ?? $responseData['error'] ?? 'Gagal mengambil laporan pesan',
                'status_code' => $response->status(),
                'response' => $responseData,
            ];
        } catch (\Exception $e) {
            Log::error('Wablas Report Message Exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Ambil laporan pesan realtime dari Wablas
     * GET https://tegal.wablas.com/api/report-realtime
     *
     * @param array $filters Filter parameters (page, limit, message_id)
     * @return array|null
     */
    public function getReportRealtime(array $filters = []): ?array
    {
        if (!$this->enabled || empty($this->token)) {
            return null;
        }

        try {
            $authToken = !empty($this->secretKey) ? "{$this->token}.{$this->secretKey}" : $this->token;
            $url = "{$this->baseUrl}/report-realtime";

            // Build query parameters
            $params = [];
            if (isset($filters['page'])) $params['page'] = $filters['page'];
            if (isset($filters['limit'])) $params['limit'] = $filters['limit'];
            if (isset($filters['message_id'])) $params['message_id'] = $filters['message_id'];

            $response = Http::withoutVerifying()
                ->withHeaders([
                    'Authorization' => $authToken,
                ])
                ->get($url, $params);

            $responseData = $response->json() ?? $response->body();

            if (is_string($responseData)) {
                $responseData = json_decode($responseData, true) ?? ['message' => $responseData];
            }

            Log::info('Wablas Report Realtime Response', [
                'status_code' => $response->status(),
                'filters' => $filters,
                'response_keys' => is_array($responseData) ? array_keys($responseData) : 'not_array',
            ]);

            // Handle rate limit (429) atau error "Report generation limit exceeded"
            if (
                $response->status() === 429 ||
                (isset($responseData['error']) && strpos(strtolower($responseData['error']), 'limit exceeded') !== false)
            ) {
                return [
                    'success' => true,
                    'data' => [
                        'status' => true,
                        'message' => [],
                        'totalData' => 0,
                        'page' => $filters['page'] ?? 1,
                        'totalPage' => 0,
                    ],
                    'rate_limited' => true,
                    'message' => $responseData['message'] ?? 'Rate limit exceeded. Silakan tunggu beberapa saat.',
                ];
            }

            // Handle error 500 dari Wablas - bisa jadi valid tapi format berbeda
            if ($response->status() === 500) {
                // Cek apakah response masih valid (kadang Wablas return 500 tapi ada data)
                if (isset($responseData['status']) && $responseData['status'] === true) {
                    return [
                        'success' => true,
                        'data' => $responseData,
                    ];
                }

                // Cek apakah HTML error page (bukan JSON)
                if (is_string($responseData) && strpos($responseData, '<!DOCTYPE html>') !== false) {
                    Log::error('Wablas Report Realtime HTML Error', [
                        'filters' => $filters,
                    ]);
                    return [
                        'success' => false,
                        'error' => 'Wablas API mengembalikan error. Silakan coba lagi nanti.',
                        'status_code' => 500,
                    ];
                }

                // Jika benar-benar error, log dan return error
                Log::error('Wablas Report Realtime 500 Error', [
                    'response' => $responseData,
                    'filters' => $filters,
                ]);

                return [
                    'success' => false,
                    'error' => $responseData['message'] ?? $responseData['error'] ?? 'Wablas API error (500)',
                    'status_code' => 500,
                    'response' => $responseData,
                ];
            }

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $responseData,
                ];
            }

            return [
                'success' => false,
                'error' => $responseData['message'] ?? $responseData['error'] ?? 'Gagal mengambil laporan realtime',
                'status_code' => $response->status(),
                'response' => $responseData,
            ];
        } catch (\Exception $e) {
            Log::error('Wablas Report Realtime Exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Ambil list contact dari Wablas
     * GET https://tegal.wablas.com/api/v2/contact
     *
     * @param array $filters Filter parameters (phone, page, limit)
     * @return array|null
     */
    public function getContacts(array $filters = []): ?array
    {
        if (!$this->enabled || empty($this->token)) {
            return null;
        }

        try {
            $authToken = !empty($this->secretKey) ? "{$this->token}.{$this->secretKey}" : $this->token;
            $url = "{$this->baseUrl}/v2/contact";

            // Build query parameters
            $params = [];
            if (isset($filters['phone'])) $params['phone'] = $filters['phone'];
            if (isset($filters['page'])) $params['page'] = $filters['page'];
            if (isset($filters['limit'])) $params['limit'] = $filters['limit'];

            $response = Http::withoutVerifying()
                ->withHeaders([
                    'Authorization' => $authToken,
                    'Content-Type' => 'application/json',
                ])
                ->get($url, $params);

            $responseData = $response->json() ?? $response->body();

            if (is_string($responseData)) {
                $responseData = json_decode($responseData, true) ?? ['message' => $responseData];
            }

            Log::info('Wablas Contacts Response', [
                'status_code' => $response->status(),
                'filters' => $filters,
                'response_structure' => [
                    'has_status' => isset($responseData['status']),
                    'has_message' => isset($responseData['message']),
                    'message_is_array' => isset($responseData['message']) && is_array($responseData['message']),
                    'total_data' => $responseData['totalData'] ?? null,
                    'message_count' => isset($responseData['message']) && is_array($responseData['message']) ? count($responseData['message']) : 0,
                ],
            ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $responseData,
                ];
            }

            return [
                'success' => false,
                'error' => $responseData['message'] ?? 'Gagal mengambil list contact',
                'response' => $responseData,
            ];
        } catch (\Exception $e) {
            Log::error('Wablas Contacts Exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Tambah contact ke Wablas
     * POST https://tegal.wablas.com/api/v2/contact
     *
     * @param array $contacts Array of contact data (name, phone, email, address, birth_day)
     * @return array|null
     */
    public function addContact(array $contacts): ?array
    {
        if (!$this->enabled || empty($this->token)) {
            return null;
        }

        try {
            $authToken = !empty($this->secretKey) ? "{$this->token}.{$this->secretKey}" : $this->token;
            $url = "{$this->baseUrl}/v2/contact";

            // Format payload sesuai dokumentasi
            $payload = [
                'data' => array_map(function ($contact) {
                    $formatted = [
                        'name' => $contact['name'] ?? '',
                        'phone' => $this->formatPhoneNumber($contact['phone'] ?? ''),
                    ];

                    if (isset($contact['email']) && !empty($contact['email'])) {
                        $formatted['email'] = $contact['email'];
                    }

                    if (isset($contact['address']) && !empty($contact['address'])) {
                        $formatted['address'] = $contact['address'];
                    }

                    if (isset($contact['birth_day']) && !empty($contact['birth_day'])) {
                        $formatted['birth_day'] = $contact['birth_day'];
                    }

                    return $formatted;
                }, $contacts),
            ];

            Log::info('Wablas Add Contact Request', [
                'url' => $url,
                'contacts_count' => count($payload['data']),
                'auth_token_set' => !empty($authToken),
            ]);

            $response = Http::withoutVerifying()
                ->withHeaders([
                    'Authorization' => $authToken,
                    'Content-Type' => 'application/json',
                ])
                ->post($url, $payload);

            $responseData = $response->json() ?? $response->body();

            if (is_string($responseData)) {
                $responseData = json_decode($responseData, true) ?? ['message' => $responseData];
            }

            Log::info('Wablas Add Contact Response', [
                'status_code' => $response->status(),
                'response' => $responseData,
            ]);

            if ($response->successful()) {
                // Check if response contains messages array (for addContact)
                if (isset($responseData['data']['messages']) && is_array($responseData['data']['messages'])) {
                    $failedMessages = [];
                    foreach ($responseData['data']['messages'] as $msg) {
                        if (isset($msg['status']) && $msg['status'] === false) {
                            $failedMessages[] = $msg['message'] ?? 'Unknown error';
                        }
                    }

                    // Jika ada yang gagal tapi ada yang berhasil, tetap return success tapi dengan warning
                    if (!empty($failedMessages)) {
                        // Check jika error karena "already add" - ini bukan error fatal
                        $isAlreadyExists = false;
                        foreach ($failedMessages as $msg) {
                            if (stripos($msg, 'already') !== false || stripos($msg, 'sudah') !== false) {
                                $isAlreadyExists = true;
                                break;
                            }
                        }

                        if ($isAlreadyExists) {
                            // Jika sudah ada, anggap sebagai success (karena kontak sudah ada di Wablas)
                            return [
                                'success' => true,
                                'data' => $responseData,
                                'warning' => 'Contact sudah ada di Wablas',
                            ];
                        }
                    }
                }

                return [
                    'success' => true,
                    'data' => $responseData,
                ];
            }

            return [
                'success' => false,
                'error' => $responseData['message'] ?? $responseData['error'] ?? 'Gagal menambahkan contact',
                'status_code' => $response->status(),
                'response' => $responseData,
            ];
        } catch (\Exception $e) {
            Log::error('Wablas Add Contact Exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Kirim list message melalui Wablas API v2
     * POST https://tegal.wablas.com/api/v2/send-list
     *
     * @param string $phone Nomor telepon (format: 6281234567890)
     * @param string $title Judul pesan
     * @param string $description Deskripsi/konten pesan
     * @param string $buttonText Teks untuk tombol yang menampilkan list
     * @param array $lists Array of list items dengan format: [['title' => 'Title', 'description' => 'Description'], ...]
     * @param string|null $footer Footer pesan (optional)
     * @param array $options Opsi tambahan (ref_id, isGroup, etc.)
     * @return array|null
     */
    public function sendListMessage(string $phone, string $title, string $description, string $buttonText, array $lists, ?string $footer = null, array $options = []): ?array
    {
        if (!$this->enabled || empty($this->token)) {
            Log::warning('Wablas service tidak diaktifkan atau token tidak ditemukan');
            return null;
        }

        // Format nomor telepon
        $phone = $this->formatPhoneNumber($phone);

        if (!$phone) {
            Log::error("Format nomor telepon tidak valid: {$phone}");
            return null;
        }

        // Validasi lists
        if (empty($lists)) {
            Log::error('List tidak boleh kosong');
            return null;
        }

        try {
            // Format token: token.secret_key
            $authToken = !empty($this->secretKey) ? "{$this->token}.{$this->secretKey}" : $this->token;

            // Endpoint v2 API
            $url = "{$this->baseUrl}/v2/send-list";

            // Build message object sesuai dokumentasi
            $messageData = [
                'title' => $title,
                'description' => $description,
                'buttonText' => $buttonText,
                'lists' => $lists,
            ];

            if ($footer) {
                $messageData['footer'] = $footer;
            }

            // Build payload
            $payload = [
                'data' => [
                    [
                        'phone' => $phone,
                        'message' => $messageData,
                    ]
                ]
            ];

            // Tambahkan opsi jika ada
            if (isset($options['isGroup']) && $options['isGroup']) {
                $payload['data'][0]['isGroup'] = 'true';
            }

            if (isset($options['ref_id']) && !empty($options['ref_id'])) {
                $payload['data'][0]['ref_id'] = $options['ref_id'];
            }

            Log::info('Wablas Send List Message Request', [
                'url' => $url,
                'phone' => $phone,
                'title' => $title,
                'buttonText' => $buttonText,
                'lists_count' => count($lists),
                'ref_id' => $options['ref_id'] ?? null,
            ]);

            // POST request dengan JSON body
            $response = Http::withoutVerifying()
                ->withHeaders([
                    'Authorization' => $authToken,
                    'Content-Type' => 'application/json',
                ])
                ->post($url, $payload);

            $responseData = $response->json() ?? $response->body();

            // Log response
            Log::info('Wablas List API Response', [
                'phone' => $phone,
                'status' => $response->status(),
                'response' => $responseData,
            ]);

            // Parse response
            if (is_string($responseData)) {
                $responseData = json_decode($responseData, true) ?? ['message' => $responseData];
            }

            if ($response->successful()) {
                // Extract message_id dari response
                $messageId = null;
                if (isset($responseData['data']['messages'][0]['id'])) {
                    $messageId = $responseData['data']['messages'][0]['id'];
                } elseif (isset($responseData['data'][0]['messages'][0]['id'])) {
                    $messageId = $responseData['data'][0]['messages'][0]['id'];
                }

                return [
                    'success' => true,
                    'status' => $responseData['status'] ?? true,
                    'message' => $responseData['message'] ?? 'List message sent successfully',
                    'message_id' => $messageId,
                    'data' => $responseData['data'] ?? [],
                    'response' => $responseData,
                ];
            } else {
                Log::error('Wablas List API Error', [
                    'status' => $response->status(),
                    'response' => $responseData,
                ]);

                return [
                    'success' => false,
                    'error' => $responseData['message'] ?? $responseData['error'] ?? 'Gagal mengirim list message',
                    'status_code' => $response->status(),
                    'response' => $responseData,
                ];
            }
        } catch (\Exception $e) {
            Log::error('Wablas List Service Exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Update contact di Wablas
     * POST https://tegal.wablas.com/api/v2/contact/update
     *
     * @param array $contacts Array of contact data (name, phone, email, address, birth_day)
     * @return array|null
     */
    public function updateContact(array $contacts): ?array
    {
        if (!$this->enabled || empty($this->token)) {
            return null;
        }

        try {
            $authToken = !empty($this->secretKey) ? "{$this->token}.{$this->secretKey}" : $this->token;
            $url = "{$this->baseUrl}/v2/contact/update";

            // Format payload sesuai dokumentasi
            $payload = [
                'data' => array_map(function ($contact) {
                    $formatted = [
                        'name' => $contact['name'] ?? '',
                        'phone' => $this->formatPhoneNumber($contact['phone'] ?? ''),
                    ];

                    if (isset($contact['email']) && !empty($contact['email'])) {
                        $formatted['email'] = $contact['email'];
                    }

                    if (isset($contact['address']) && !empty($contact['address'])) {
                        $formatted['address'] = $contact['address'];
                    }

                    if (isset($contact['birth_day']) && !empty($contact['birth_day'])) {
                        $formatted['birth_day'] = $contact['birth_day'];
                    }

                    return $formatted;
                }, $contacts),
            ];

            Log::info('Wablas Update Contact Request', [
                'url' => $url,
                'contacts_count' => count($payload['data']),
                'auth_token_set' => !empty($authToken),
            ]);

            $response = Http::withoutVerifying()
                ->withHeaders([
                    'Authorization' => $authToken,
                    'Content-Type' => 'application/json',
                ])
                ->post($url, $payload);

            $responseData = $response->json() ?? $response->body();

            if (is_string($responseData)) {
                $responseData = json_decode($responseData, true) ?? ['message' => $responseData];
            }

            Log::info('Wablas Update Contact Response', [
                'status_code' => $response->status(),
                'response' => $responseData,
            ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $responseData,
                ];
            }

            return [
                'success' => false,
                'error' => $responseData['message'] ?? $responseData['error'] ?? 'Gagal mengupdate contact',
                'status_code' => $response->status(),
                'response' => $responseData,
            ];
        } catch (\Exception $e) {
            Log::error('Wablas Update Contact Exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
