<?php

namespace App\Http\Controllers;

use App\Services\WablasService;
use App\Models\User;
use App\Models\WhatsAppLog;
use App\Models\WhatsAppConversation;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class WhatsAppController extends Controller
{
    protected WablasService $wablasService;

    public function __construct(WablasService $wablasService)
    {
        $this->wablasService = $wablasService;
    }

    /**
     * Kirim notifikasi jadwal ke dosen via WhatsApp
     *
     * @param string $phone Nomor telepon dosen
     * @param string $message Pesan notifikasi
     * @param array $metadata Metadata tambahan (jadwal_id, jadwal_type, dll)
     * @return array|null
     */
    public function sendScheduleNotification(string $phone, string $message, array $metadata = []): ?array
    {
        if (!$this->wablasService->isEnabled()) {
            Log::warning('WhatsApp service tidak aktif, skip pengiriman notifikasi');
            return null;
        }

        try {
            $result = $this->wablasService->sendMessage($phone, $message);

            // Log ke database
            if ($result) {
                WhatsAppLog::create([
                    'phone' => $phone,
                    'message' => $message,
                    'status' => $result['success'] ? 'sent' : 'failed',
                    'response' => $result,
                    'metadata' => $metadata,
                    'sent_by' => Auth::id(),
                ]);

                if ($result['success']) {
                    Log::info("WhatsApp notifikasi jadwal berhasil dikirim ke {$phone}");
                } else {
                    Log::error("WhatsApp notifikasi jadwal gagal dikirim ke {$phone}: " . ($result['error'] ?? 'Unknown error'));
                }
            }

            return $result;
        } catch (\Exception $e) {
            Log::error("Exception saat kirim WhatsApp notifikasi ke {$phone}: " . $e->getMessage());

            // Log ke database meski gagal
            WhatsAppLog::create([
                'phone' => $phone,
                'message' => $message,
                'status' => 'failed',
                'response' => ['error' => $e->getMessage()],
                'metadata' => $metadata,
                'sent_by' => Auth::id(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * API endpoint untuk kirim pesan manual (untuk testing/admin)
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function sendMessage(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string',
            'message' => 'required|string|max:1000',
            'ref_id' => 'nullable|string|max:255', // Optional: custom reference ID untuk tracking
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Build options untuk sendMessage
        $options = [];
        if ($request->has('ref_id') && !empty($request->ref_id)) {
            $options['ref_id'] = $request->ref_id;
        }

        $result = $this->wablasService->sendMessage(
            $request->phone,
            $request->message,
            $options
        );

        if ($result && $result['success']) {
            return response()->json([
                'message' => 'Pesan berhasil dikirim',
                'data' => $result,
            ], 200);
        }

        return response()->json([
            'message' => 'Gagal mengirim pesan',
            'error' => $result['error'] ?? 'Unknown error',
            'data' => $result,
        ], 500);
    }

    /**
     * Webhook handler untuk menerima pesan masuk dari Wablas
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function webhook(Request $request): JsonResponse
    {
        $requestData = $request->all();
        Log::info('Wablas Webhook Received', [
            'headers' => $request->headers->all(),
            'data' => $requestData,
            'method' => $request->method(),
            'url' => $request->fullUrl(),
        ]);

        // Validasi webhook signature jika diperlukan
        // $signature = $request->header('X-Wablas-Signature');
        // if (!$this->validateWebhookSignature($signature, $request->all())) {
        //     return response()->json(['error' => 'Invalid signature'], 401);
        // }

        $data = $requestData;

        // Handle pesan masuk - Wablas bisa mengirim dalam berbagai format
        $messages = [];

        // Format 1: data adalah array langsung
        if (isset($data['data']) && is_array($data['data'])) {
            $messages = $data['data'];
        }
        // Format 2: data adalah object tunggal
        elseif (isset($data['phone']) && isset($data['message'])) {
            $messages = [$data];
        }
        // Format 3: langsung array of messages
        elseif (is_array($data) && isset($data[0]) && isset($data[0]['phone'])) {
            $messages = $data;
        }
        // Format 4: single message object
        elseif (isset($data['phone'])) {
            $messages = [$data];
        }

        Log::info('Processing webhook messages', [
            'messages_count' => count($messages),
            'messages' => $messages,
        ]);

        // Process each message
        foreach ($messages as $message) {
            try {
                $this->handleIncomingMessage($message);
            } catch (\Exception $e) {
                Log::error('Error processing webhook message', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'message_data' => $message,
                ]);
            }
        }

        return response()->json(['status' => 'ok', 'processed' => count($messages)], 200);
    }

    /**
     * Handle pesan masuk dari webhook
     *
     * @param array $messageData
     * @return void
     */
    protected function handleIncomingMessage(array $messageData): void
    {
        try {
            $phone = $messageData['phone'] ?? null;
            $message = $messageData['message'] ?? null;
            $messageId = $messageData['id'] ?? null;
            $isButtonReply = isset($messageData['button_reply']) || isset($messageData['button']); // Check if button reply
            $isListReply = isset($messageData['list_reply']) || isset($messageData['list']); // Check if list reply

            if (!$phone || !$message) {
                Log::warning('Invalid incoming message data', $messageData);
                return;
            }

            // Extract list selection if it's a list reply
            if ($isListReply) {
                $listData = $messageData['list_reply'] ?? $messageData['list'] ?? [];
                $message = $listData['title'] ?? $listData['id'] ?? $message; // Use title or id as message
            }

            // Normalize phone number untuk pencarian
            $normalizedPhone = $this->normalizePhoneForSearch($phone);

            // Cari user berdasarkan nomor telepon (whatsapp_phone atau telp)
            $user = User::where('whatsapp_phone', $phone)
                ->orWhere('whatsapp_phone', $normalizedPhone)
                ->orWhere('telp', $phone)
                ->orWhere('telp', $normalizedPhone)
                ->orWhere('telp', '0' . substr($phone, 2)) // Format dengan 0
                ->orWhere('telp', substr($phone, 2)) // Format tanpa 0 dan 62
                ->first();

            if (!$user || $user->role !== 'dosen') {
                Log::warning("User tidak ditemukan atau bukan dosen: {$phone}");
                return;
            }

            // Log pesan masuk
            WhatsAppLog::create([
                'phone' => $phone,
                'message' => $message,
                'status' => 'received',
                'response' => $messageData,
                'metadata' => [
                    'message_id' => $messageId,
                    'user_id' => $user->id,
                    'direction' => 'incoming',
                    'is_button_reply' => $isButtonReply,
                    'is_list_reply' => $isListReply,
                ],
            ]);

            // Cari active conversation untuk user ini
            // Cari dengan berbagai format phone untuk memastikan ditemukan
            $conversation = WhatsAppConversation::where('user_id', $user->id)
                ->where(function ($query) use ($phone, $normalizedPhone) {
                    $query->where('phone', $phone)
                        ->orWhere('phone', $normalizedPhone)
                        ->orWhere('phone', '0' . substr($phone, 2))
                        ->orWhere('phone', substr($phone, 2));
                })
                ->whereIn('state', ['waiting_button', 'waiting_konfirmasi_choice', 'waiting_alasan_tidak_bisa', 'waiting_reschedule_reason'])
                ->where(function ($query) {
                    $query->whereNull('expires_at')
                        ->orWhere('expires_at', '>', now());
                })
                ->orderBy('created_at', 'desc')
                ->first();

            // Disabled: Sistem konfirmasi/reschedule via WhatsApp bot telah dinonaktifkan
            // Semua konfirmasi harus dilakukan melalui dashboard
            if ($conversation) {
                Log::info("Active conversation found but system is disabled", [
                    'conversation_id' => $conversation->id,
                    'state' => $conversation->state,
                    'phone' => $phone,
                    'message' => $message,
                ]);

                // Kirim pesan bahwa sistem konfirmasi via WhatsApp telah dinonaktifkan
                $this->wablasService->sendMessage($phone, "⚠️ Sistem konfirmasi via WhatsApp bot telah dinonaktifkan. Silakan login ke dashboard untuk konfirmasi jadwal: https://isme.fkkumj.ac.id/");
            } else {
                Log::info("No active conversation for user", [
                    'user_id' => $user->id,
                    'phone' => $phone,
                    'message' => $message,
                ]);

                // Kirim pesan informatif ke user
                $this->wablasService->sendMessage($phone, "⚠️ Silakan login ke dashboard untuk melihat dan mengonfirmasi jadwal: https://isme.fkkumj.ac.id/");
            }
        } catch (\Exception $e) {
            Log::error('Error handling incoming message', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'data' => $messageData,
            ]);
        }
    }

    /**
     * Handle conversation flow berdasarkan state
     */
    protected function handleConversationFlow(WhatsAppConversation $conversation, User $user, string $phone, string $message, bool $isButtonReply): void
    {
        try {
            $state = $conversation->state;
            $metadata = $conversation->metadata ?? [];

            Log::info("Handling conversation flow", [
                'conversation_id' => $conversation->id,
                'state' => $state,
                'message' => $message,
                'is_button_reply' => $isButtonReply,
                'is_list_reply' => $isButtonReply, // List reply juga dianggap sebagai button reply untuk handling
            ]);

            switch ($state) {
                case 'waiting_button':
                    // User pilih dari list pertama: Konfirmasi atau Reschedule
                    // Juga handle text fallback (jika list message tidak berfungsi)
                    if ($isButtonReply) {
                        $buttonText = $message; // Button text yang diklik

                        if (stripos($buttonText, 'konfirmasi') !== false || stripos($buttonText, 'Konfirmasi') !== false) {
                            // User pilih "Konfirmasi" -> kirim list pilihan Bisa/Tidak Bisa
                            $this->sendKonfirmasiChoiceButtons($conversation, $user, $phone);
                        } elseif (stripos($buttonText, 'reschedule') !== false || stripos($buttonText, 'Reschedule') !== false) {
                            // User pilih "Reschedule" -> minta alasan
                            $this->requestRescheduleReason($conversation, $user, $phone);
                        }
                    } else {
                        // Handle text fallback (jika list tidak berfungsi, user bisa ketik manual)
                        $messageUpper = strtoupper(trim($message));
                        $messageClean = preg_replace('/[^A-Z0-9\s]/', '', $messageUpper); // Remove special chars

                        Log::info("Processing text message in waiting_button state", [
                            'original_message' => $message,
                            'message_upper' => $messageUpper,
                            'message_clean' => $messageClean,
                        ]);

                        if ($messageClean === 'KONFIRMASI' || stripos($messageClean, 'KONFIRMASI') !== false) {
                            // User ketik "KONFIRMASI" -> kirim list pilihan Bisa/Tidak Bisa
                            Log::info("User typed KONFIRMASI, sending choice buttons");
                            $this->sendKonfirmasiChoiceButtons($conversation, $user, $phone);
                        } elseif ($messageClean === 'RESCHEDULE' || stripos($messageClean, 'RESCHEDULE') !== false) {
                            // User ketik "RESCHEDULE" -> minta alasan
                            Log::info("User typed RESCHEDULE, requesting reason");
                            $this->requestRescheduleReason($conversation, $user, $phone);
                        } else {
                            // Jika tidak match, kirim pesan bantuan
                            Log::warning("Unrecognized message in waiting_button state", [
                                'message' => $message,
                                'message_clean' => $messageClean,
                            ]);
                            $this->wablasService->sendMessage($phone, "⚠️ Pesan tidak dikenali. Silakan ketik:\n• 'KONFIRMASI' untuk konfirmasi kesediaan\n• 'RESCHEDULE' untuk ajukan perubahan jadwal");
                        }
                    }
                    break;

                case 'waiting_konfirmasi_choice':
                    // User pilih Bisa atau Tidak Bisa (dari list atau text fallback)
                    if ($isButtonReply) {
                        $choice = strtolower(trim($message));

                        if (stripos($choice, 'bisa') !== false && stripos($choice, 'tidak') === false) {
                            // User pilih "Bisa Mengajar" -> langsung submit konfirmasi
                            $this->submitKonfirmasi($conversation, $user, 'bisa', null);
                        } elseif (stripos($choice, 'tidak') !== false || stripos($choice, 'tidak bisa') !== false) {
                            // User pilih "Tidak Bisa Mengajar" -> minta alasan
                            $this->requestAlasanTidakBisa($conversation, $user, $phone);
                        }
                    } else {
                        // Handle text fallback
                        $messageUpper = strtoupper(trim($message));
                        if ($messageUpper === 'BISA' || stripos($messageUpper, 'BISA') !== false) {
                            // User ketik "BISA" -> langsung submit konfirmasi
                            $this->submitKonfirmasi($conversation, $user, 'bisa', null);
                        } elseif ($messageUpper === 'TIDAK BISA' || stripos($messageUpper, 'TIDAK BISA') !== false || stripos($messageUpper, 'TIDAK') !== false) {
                            // User ketik "TIDAK BISA" -> minta alasan
                            $this->requestAlasanTidakBisa($conversation, $user, $phone);
                        }
                    }
                    break;

                case 'waiting_alasan_tidak_bisa':
                    // User kirim alasan tidak bisa -> submit konfirmasi dengan alasan
                    if (!$isButtonReply && !empty(trim($message))) {
                        $alasan = $this->mapAlasanFromText($message);
                        $this->submitKonfirmasi($conversation, $user, 'tidak_bisa', $alasan);
                    } else {
                        // Kirim pesan error jika kosong
                        $this->wablasService->sendMessage($phone, "❌ Alasan tidak boleh kosong. Silakan kirim alasan mengapa Anda tidak bisa mengajar.");
                    }
                    break;

                case 'waiting_reschedule_reason':
                    // User kirim alasan reschedule -> submit reschedule
                    if (!$isButtonReply && !empty(trim($message))) {
                        $this->submitReschedule($conversation, $user, $message);
                    } else {
                        // Kirim pesan error jika kosong
                        $this->wablasService->sendMessage($phone, "❌ Alasan reschedule tidak boleh kosong. Silakan kirim alasan mengapa jadwal perlu diubah.");
                    }
                    break;
            }
        } catch (\Exception $e) {
            Log::error('Error handling conversation flow', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'conversation_id' => $conversation->id,
            ]);

            // Kirim pesan error ke user
            $this->wablasService->sendMessage($phone, "❌ Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi atau hubungi admin.");
        }
    }

    /**
     * Normalize phone number untuk pencarian
     */
    protected function normalizePhoneForSearch(string $phone): string
    {
        // Remove + jika ada
        $phone = str_replace('+', '', $phone);

        // Jika mulai dengan 62, return as is
        if (strpos($phone, '62') === 0) {
            return $phone;
        }

        // Jika mulai dengan 0, replace dengan 62
        if (strpos($phone, '0') === 0) {
            return '62' . substr($phone, 1);
        }

        // Jika tidak mulai dengan 62 atau 0, tambahkan 62
        return '62' . $phone;
    }

    /**
     * Kirim list pilihan konfirmasi (Bisa Mengajar / Tidak Bisa Mengajar)
     */
    protected function sendKonfirmasiChoiceButtons(WhatsAppConversation $conversation, User $user, string $phone): void
    {
        try {
            $metadata = $conversation->metadata ?? [];
            $jadwalType = $conversation->jadwal_type;
            $jadwalId = $conversation->jadwal_id;

            // Build text message
            $message = "Pilih Ketersediaan\n\n";
            $message .= "Silakan pilih ketersediaan Anda untuk jadwal mengajar:\n\n";
            $message .= "Silakan balas dengan:\n";
            $message .= "• Ketik 'BISA' untuk konfirmasi bisa mengajar\n";
            $message .= "• Ketik 'TIDAK BISA' untuk konfirmasi tidak bisa mengajar";

            // Send text message
            $result = $this->wablasService->sendMessage($phone, $message);

            if ($result && $result['success']) {
                // Update conversation state
                $conversation->update([
                    'state' => 'waiting_konfirmasi_choice',
                    'last_message' => $message,
                ]);

                Log::info("Konfirmasi choice message sent", [
                    'conversation_id' => $conversation->id,
                    'user_id' => $user->id,
                    'jadwal_id' => $jadwalId,
                    'jadwal_type' => $jadwalType,
                ]);
            } else {
                Log::error("Failed to send konfirmasi choice message", [
                    'conversation_id' => $conversation->id,
                    'result' => $result,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Error sending konfirmasi choice list', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'conversation_id' => $conversation->id,
            ]);
        }
    }

    /**
     * Minta alasan reschedule dari user
     */
    protected function requestRescheduleReason(WhatsAppConversation $conversation, User $user, string $phone): void
    {
        try {
            $metadata = $conversation->metadata ?? [];
            $jadwalType = $conversation->jadwal_type;

            $message = "Silakan kirim alasan mengapa jadwal perlu diubah (reschedule).\n\n";
            if (isset($metadata['jadwal_info'])) {
                $message .= $metadata['jadwal_info'] . "\n\n";
            }
            $message .= "Contoh: Ada acara keluarga yang tidak bisa ditinggalkan";

            $result = $this->wablasService->sendMessage($phone, $message);

            if ($result && $result['success']) {
                // Update conversation state
                $conversation->update([
                    'state' => 'waiting_reschedule_reason',
                    'last_message' => $message,
                ]);

                Log::info("Reschedule reason requested", [
                    'conversation_id' => $conversation->id,
                    'user_id' => $user->id,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Error requesting reschedule reason', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'conversation_id' => $conversation->id,
            ]);
        }
    }

    /**
     * Minta alasan tidak bisa mengajar
     */
    protected function requestAlasanTidakBisa(WhatsAppConversation $conversation, User $user, string $phone): void
    {
        try {
            $metadata = $conversation->metadata ?? [];

            $message = "Silakan pilih atau kirim alasan mengapa Anda tidak bisa mengajar:\n\n";
            $message .= "1. Sakit\n";
            $message .= "2. Ada acara penting\n";
            $message .= "3. Cuti\n";
            $message .= "4. Lainnya (ketik alasan Anda)\n\n";
            $message .= "Kirim nomor pilihan (1-4) atau ketik alasan langsung.";

            $result = $this->wablasService->sendMessage($phone, $message);

            if ($result && $result['success']) {
                // Update conversation state
                $conversation->update([
                    'state' => 'waiting_alasan_tidak_bisa',
                    'last_message' => $message,
                ]);

                Log::info("Alasan tidak bisa requested", [
                    'conversation_id' => $conversation->id,
                    'user_id' => $user->id,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Error requesting alasan tidak bisa', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'conversation_id' => $conversation->id,
            ]);
        }
    }

    /**
     * Map alasan dari text ke format standar
     */
    protected function mapAlasanFromText(string $text): string
    {
        $text = strtolower(trim($text));

        // Mapping berdasarkan keyword
        if (stripos($text, '1') !== false || stripos($text, 'sakit') !== false) {
            return 'Sakit';
        }
        if (stripos($text, '2') !== false || stripos($text, 'acara') !== false || stripos($text, 'penting') !== false) {
            return 'Ada acara penting';
        }
        if (stripos($text, '3') !== false || stripos($text, 'cuti') !== false) {
            return 'Cuti';
        }
        if (stripos($text, '4') !== false || stripos($text, 'lainnya') !== false || stripos($text, 'lain') !== false) {
            return 'Lainnya';
        }

        // Jika tidak match, return text as is (custom alasan)
        return $text;
    }

    /**
     * Submit konfirmasi jadwal
     */
    protected function submitKonfirmasi(WhatsAppConversation $conversation, User $user, string $status, ?string $alasan): void
    {
        try {
            $jadwalType = $conversation->jadwal_type;
            $jadwalId = $conversation->jadwal_id;
            $phone = $conversation->phone;

            // Create a request object with the payload
            $request = Request::create('/api/temp', 'PUT', [
                'status' => $status,
                'dosen_id' => $user->id,
                'alasan' => $alasan,
            ]);

            // Set the authenticated user
            $request->setUserResolver(function () use ($user) {
                return $user;
            });

            // Call the appropriate controller method based on jadwal type
            $controller = $this->getKonfirmasiController($jadwalType);
            if (!$controller) {
                throw new \Exception("Jadwal type tidak valid: {$jadwalType}");
            }

            // Call the controller method (different controllers have different method names and signatures)
            $methodName = $this->getKonfirmasiMethodName($jadwalType);

            // NonBlokNonCSR has different signature: konfirmasiJadwal($id, Request $request)
            if ($jadwalType === 'non_blok_non_csr') {
                $response = $controller->$methodName($jadwalId, $request);
            } else {
                $response = $controller->$methodName($request, $jadwalId);
            }

            $responseData = $response->getData(true);

            if ($response->getStatusCode() === 200) {
                // Update conversation state to completed
                $conversation->update([
                    'state' => 'completed',
                    'metadata' => array_merge($conversation->metadata ?? [], [
                        'status' => $status,
                        'alasan' => $alasan,
                        'submitted_at' => now()->toISOString(),
                    ]),
                ]);

                // Send confirmation message
                $successMessage = $status === 'bisa'
                    ? "✅ Konfirmasi berhasil! Status Anda: Bisa Mengajar"
                    : "✅ Konfirmasi berhasil! Status Anda: Tidak Bisa Mengajar" . ($alasan ? "\nAlasan: {$alasan}" : "");

                $this->wablasService->sendMessage($phone, $successMessage);

                Log::info("Konfirmasi submitted successfully", [
                    'conversation_id' => $conversation->id,
                    'user_id' => $user->id,
                    'jadwal_id' => $jadwalId,
                    'jadwal_type' => $jadwalType,
                    'status' => $status,
                ]);
            } else {
                throw new \Exception($responseData['message'] ?? 'Gagal submit konfirmasi');
            }
        } catch (\Exception $e) {
            Log::error('Error submitting konfirmasi', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'conversation_id' => $conversation->id,
            ]);

            // Send error message to user
            $this->wablasService->sendMessage($phone, "❌ Gagal memproses konfirmasi. Silakan coba lagi atau hubungi admin.");
        }
    }

    /**
     * Submit reschedule jadwal
     */
    protected function submitReschedule(WhatsAppConversation $conversation, User $user, string $reason): void
    {
        try {
            $jadwalType = $conversation->jadwal_type;
            $jadwalId = $conversation->jadwal_id;
            $phone = $conversation->phone;

            // Create a request object with the payload
            $request = Request::create('/api/temp', 'POST', [
                'reschedule_reason' => $reason,
                'dosen_id' => $user->id,
            ]);

            // Set the authenticated user
            $request->setUserResolver(function () use ($user) {
                return $user;
            });

            // Call the appropriate controller method based on jadwal type
            $controller = $this->getRescheduleController($jadwalType);
            if (!$controller) {
                throw new \Exception("Jadwal type tidak valid: {$jadwalType}");
            }

            // Call the controller method
            $response = $controller->reschedule($request, $jadwalId);
            $responseData = $response->getData(true);

            if ($response->getStatusCode() === 200) {
                // Update conversation state to completed
                $conversation->update([
                    'state' => 'completed',
                    'metadata' => array_merge($conversation->metadata ?? [], [
                        'reschedule_reason' => $reason,
                        'submitted_at' => now()->toISOString(),
                    ]),
                ]);

                // Send confirmation message
                $successMessage = "✅ Permintaan reschedule berhasil diajukan!\n\n";
                $successMessage .= "Alasan: {$reason}\n\n";
                $successMessage .= "Admin akan meninjau permintaan Anda dan akan mengirim notifikasi setelah diproses.";

                $this->wablasService->sendMessage($phone, $successMessage);

                Log::info("Reschedule submitted successfully", [
                    'conversation_id' => $conversation->id,
                    'user_id' => $user->id,
                    'jadwal_id' => $jadwalId,
                    'jadwal_type' => $jadwalType,
                    'reason' => $reason,
                ]);
            } else {
                throw new \Exception($responseData['message'] ?? 'Gagal submit reschedule');
            }
        } catch (\Exception $e) {
            Log::error('Error submitting reschedule', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'conversation_id' => $conversation->id,
            ]);

            // Send error message to user
            $this->wablasService->sendMessage($phone, "❌ Gagal memproses permintaan reschedule. Silakan coba lagi atau hubungi admin.");
        }
    }

    /**
     * Get konfirmasi controller berdasarkan jadwal type
     */
    protected function getKonfirmasiController(string $jadwalType)
    {
        $controllers = [
            'pbl' => app(\App\Http\Controllers\JadwalPBLController::class),
            'kuliah_besar' => app(\App\Http\Controllers\JadwalKuliahBesarController::class),
            'praktikum' => app(\App\Http\Controllers\JadwalPraktikumController::class),
            'jurnal' => app(\App\Http\Controllers\JadwalJurnalReadingController::class),
            'csr' => app(\App\Http\Controllers\JadwalCSRController::class),
            'non_blok_non_csr' => app(\App\Http\Controllers\JadwalNonBlokNonCSRController::class),
        ];

        return $controllers[$jadwalType] ?? null;
    }

    /**
     * Get reschedule controller berdasarkan jadwal type
     */
    protected function getRescheduleController(string $jadwalType)
    {
        $controllers = [
            'pbl' => app(\App\Http\Controllers\JadwalPBLController::class),
            'kuliah_besar' => app(\App\Http\Controllers\JadwalKuliahBesarController::class),
            'praktikum' => app(\App\Http\Controllers\JadwalPraktikumController::class),
            'jurnal' => app(\App\Http\Controllers\JadwalJurnalReadingController::class),
            'csr' => app(\App\Http\Controllers\JadwalCSRController::class),
            'non_blok_non_csr' => app(\App\Http\Controllers\JadwalNonBlokNonCSRController::class),
        ];

        return $controllers[$jadwalType] ?? null;
    }

    /**
     * Get konfirmasi method name berdasarkan jadwal type
     */
    protected function getKonfirmasiMethodName(string $jadwalType): string
    {
        $methods = [
            'pbl' => 'konfirmasiJadwal',
            'kuliah_besar' => 'konfirmasi',
            'praktikum' => 'konfirmasi',
            'jurnal' => 'konfirmasi',
            'csr' => 'konfirmasiJadwal',
            'non_blok_non_csr' => 'konfirmasiJadwal',
        ];

        return $methods[$jadwalType] ?? 'konfirmasiJadwal';
    }

    /**
     * Get WhatsApp logs
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getLogs(Request $request): JsonResponse
    {
        $query = WhatsAppLog::query()
            ->orderBy('created_at', 'desc');

        if ($request->has('phone')) {
            $query->where('phone', 'like', '%' . $request->phone . '%');
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('user_id')) {
            $query->where('sent_by', $request->user_id);
        }

        $logs = $query->paginate($request->get('per_page', 20));

        return response()->json($logs);
    }

    /**
     * Test koneksi Wablas API
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function testConnection(Request $request): JsonResponse
    {
        // Default nomor untuk test (bisa diambil dari device info jika ada)
        $testPhone = $request->input('phone', $request->query('phone', '6281234567890'));
        $testMessage = 'Test koneksi Wablas API dari sistem akademik UMJ - ' . now()->format('d/m/Y H:i:s');

        // Cek apakah service enabled
        if (!$this->wablasService->isEnabled()) {
            return response()->json([
                'message' => 'WhatsApp service tidak aktif',
                'error' => 'WABLAS_ENABLED=false atau WABLAS_TOKEN tidak ditemukan',
                'config' => [
                    'enabled' => config('services.wablas.enabled'),
                    'token_set' => !empty(config('services.wablas.token')),
                ],
            ], 503);
        }

        $result = $this->wablasService->sendMessage($testPhone, $testMessage);

        if ($result && $result['success']) {
            return response()->json([
                'message' => 'Koneksi berhasil! Pesan test berhasil dikirim',
                'result' => $result,
                'phone' => $testPhone,
                'timestamp' => now()->toISOString(),
            ], 200);
        }

        return response()->json([
            'message' => 'Koneksi gagal',
            'error' => $result['error'] ?? 'Unknown error',
            'result' => $result,
            'phone' => $testPhone,
            'config' => [
                'enabled' => config('services.wablas.enabled'),
                'base_url' => config('services.wablas.base_url'),
            ],
        ], 500);
    }

    /**
     * Cek status device (apakah WhatsApp terhubung)
     * Endpoint: GET /api/whatsapp/device
     *
     * @return JsonResponse
     */
    public function checkDevice(Request $request): JsonResponse
    {
        if (!$this->wablasService->isEnabled()) {
            return response()->json([
                'message' => 'WhatsApp service tidak aktif',
                'error' => 'WABLAS_ENABLED=false atau WABLAS_TOKEN tidak ditemukan',
                'config' => [
                    'enabled' => config('services.wablas.enabled'),
                    'token_set' => !empty(config('services.wablas.token')),
                ],
            ], 503);
        }

        $result = $this->wablasService->checkDeviceStatus();

        if ($result && $result['success']) {
            return response()->json([
                'message' => $result['connected'] ? 'Device terhubung' : 'Device tidak terhubung',
                'status' => $result['connected'] ? 'connected' : 'disconnected',
                'connected' => $result['connected'],
                'active' => $result['active'] ?? false,
                'device' => $result['device'],
                'raw_response' => $result['raw_response'] ?? null,
            ], 200);
        }

        // Log error untuk debugging
        Log::error('WhatsApp Device Check Failed', [
            'result' => $result,
        ]);

        return response()->json([
            'message' => 'Gagal cek status device',
            'error' => $result['error'] ?? 'Unknown error',
            'result' => $result,
        ], 500);
    }

    /**
     * Ambil laporan pesan
     * Endpoint: GET /api/whatsapp/report
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getReport(Request $request): JsonResponse
    {
        if (!$this->wablasService->isEnabled()) {
            return response()->json([
                'message' => 'WhatsApp service tidak aktif',
                'error' => 'WABLAS_ENABLED=false atau WABLAS_TOKEN tidak ditemukan',
            ], 503);
        }

        $filters = $request->only([
            'date',
            'phone',
            'page',
            'perPage',
            'status',
            'type',
            'message_id',
            'text',
            'device',
            'ref_id'
        ]);

        $result = $this->wablasService->getReportMessage($filters);

        if ($result && $result['success']) {
            return response()->json([
                'message' => 'Laporan pesan berhasil diambil',
                'data' => $result['data'],
            ], 200);
        }

        // Jika result null atau tidak ada success, return error dengan detail
        Log::error('WhatsApp Report Failed', [
            'result' => $result,
            'filters' => $filters,
        ]);

        return response()->json([
            'message' => 'Gagal mengambil laporan pesan',
            'error' => $result['error'] ?? 'Unknown error',
            'result' => $result,
        ], 500);
    }

    /**
     * Ambil laporan pesan realtime
     * Endpoint: GET /api/whatsapp/report-realtime
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getReportRealtime(Request $request): JsonResponse
    {
        if (!$this->wablasService->isEnabled()) {
            return response()->json([
                'message' => 'WhatsApp service tidak aktif',
                'error' => 'WABLAS_ENABLED=false atau WABLAS_TOKEN tidak ditemukan',
            ], 503);
        }

        $filters = $request->only(['page', 'limit', 'message_id']);

        $result = $this->wablasService->getReportRealtime($filters);

        if ($result && $result['success']) {
            return response()->json([
                'message' => 'Laporan realtime berhasil diambil',
                'data' => $result['data'],
                'rate_limited' => $result['rate_limited'] ?? false,
            ], 200);
        }

        // Jika rate limited, return 200 dengan data kosong (bukan error)
        if ($result && isset($result['rate_limited']) && $result['rate_limited']) {
            return response()->json([
                'message' => 'Rate limit exceeded. Silakan tunggu beberapa saat.',
                'data' => $result['data'] ?? ['status' => true, 'message' => [], 'totalData' => 0],
                'rate_limited' => true,
            ], 200);
        }

        return response()->json([
            'message' => 'Gagal mengambil laporan realtime',
            'error' => $result['error'] ?? 'Unknown error',
            'result' => $result,
        ], 500);
    }

    /**
     * Ambil list contact
     * Endpoint: GET /api/whatsapp/contacts
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getContacts(Request $request): JsonResponse
    {
        if (!$this->wablasService->isEnabled()) {
            return response()->json([
                'message' => 'WhatsApp service tidak aktif',
                'error' => 'WABLAS_ENABLED=false atau WABLAS_TOKEN tidak ditemukan',
            ], 503);
        }

        $filters = $request->only(['phone', 'page', 'limit']);

        $result = $this->wablasService->getContacts($filters);

        if ($result && $result['success']) {
            return response()->json([
                'message' => 'List contact berhasil diambil',
                'data' => $result['data'],
            ], 200);
        }

        return response()->json([
            'message' => 'Gagal mengambil list contact',
            'error' => $result['error'] ?? 'Unknown error',
            'result' => $result,
        ], 500);
    }

    /**
     * Get Wablas settings (token & secret key)
     * Endpoint: GET /api/whatsapp/settings
     *
     * @return JsonResponse
     */
    public function getSettings(): JsonResponse
    {
        // Hanya super_admin yang bisa akses settings
        $user = Auth::user();
        if (!$user || $user->role !== 'super_admin') {
            return response()->json([
                'message' => 'Unauthorized',
                'error' => 'Hanya super admin yang dapat mengakses settings',
            ], 403);
        }

        return response()->json([
            'token' => env('WABLAS_TOKEN', ''),
            'secret_key' => env('WABLAS_SECRET_KEY', ''),
            'base_url' => env('WABLAS_BASE_URL', 'https://tegal.wablas.com/api'),
            'enabled' => env('WABLAS_ENABLED', 'false') === 'true',
        ], 200);
    }

    /**
     * Update Wablas settings
     * Endpoint: PUT /api/whatsapp/settings
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function updateSettings(Request $request): JsonResponse
    {
        // Hanya super_admin yang bisa update settings
        $user = Auth::user();
        if (!$user || $user->role !== 'super_admin') {
            return response()->json([
                'message' => 'Unauthorized',
                'error' => 'Hanya super admin yang dapat mengupdate settings',
            ], 403);
        }

        $validated = $request->validate([
            'token' => 'required|string',
            'secret_key' => 'required|string',
            'base_url' => 'nullable|string|url',
            'enabled' => 'nullable|boolean',
        ]);

        try {
            // Baca file .env
            $envPath = base_path('.env');
            if (!file_exists($envPath)) {
                return response()->json([
                    'message' => 'File .env tidak ditemukan',
                    'error' => 'File .env tidak ada di root project',
                ], 500);
            }

            $envContent = file_get_contents($envPath);

            // Update atau tambahkan nilai
            $updates = [
                'WABLAS_TOKEN' => $validated['token'],
                'WABLAS_SECRET_KEY' => $validated['secret_key'],
            ];

            if (isset($validated['base_url'])) {
                $updates['WABLAS_BASE_URL'] = $validated['base_url'];
            }

            // Otomatis aktifkan service jika token dan secret_key ada
            // Jika token dan secret_key tidak kosong, set enabled = true
            $hasTokenAndSecret = !empty($validated['token']) && !empty($validated['secret_key']);
            $updates['WABLAS_ENABLED'] = $hasTokenAndSecret ? 'true' : 'false';

            foreach ($updates as $key => $value) {
                // Escape special characters untuk regex
                $escapedKey = preg_quote($key, '/');

                // Pattern untuk match key=value atau key = value
                $pattern = "/^{$escapedKey}\s*=\s*.*$/m";

                if (preg_match($pattern, $envContent)) {
                    // Replace existing value
                    $envContent = preg_replace(
                        $pattern,
                        "{$key}={$value}",
                        $envContent
                    );
                } else {
                    // Append new key=value
                    $envContent .= "\n{$key}={$value}";
                }
            }

            // Backup .env sebelum write
            $backupPath = $envPath . '.backup.' . date('Y-m-d_H-i-s');
            copy($envPath, $backupPath);

            // Write updated content
            if (file_put_contents($envPath, $envContent) === false) {
                return response()->json([
                    'message' => 'Gagal menulis file .env',
                    'error' => 'Tidak dapat menulis ke file .env',
                ], 500);
            }

            // Clear config cache
            \Illuminate\Support\Facades\Artisan::call('config:clear');

            Log::info('Wablas Settings Updated', [
                'updated_by' => $user->id,
                'updated_keys' => array_keys($updates),
            ]);

            return response()->json([
                'message' => 'Settings berhasil diupdate',
                'settings' => [
                    'token' => $validated['token'],
                    'secret_key' => '***' . substr($validated['secret_key'], -4), // Hanya tampilkan 4 karakter terakhir
                    'base_url' => $validated['base_url'] ?? env('WABLAS_BASE_URL'),
                    'enabled' => $validated['enabled'] ?? env('WABLAS_ENABLED', 'false') === 'true',
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error updating Wablas settings', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'Terjadi kesalahan saat mengupdate settings',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
