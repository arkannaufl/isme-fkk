<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use App\Models\Forum;
use App\Models\ForumCategory;
use App\Models\ForumReply;
use App\Models\UserReplyBookmark;
use App\Models\UserForumBookmark;
use App\Models\UserForumView;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class ForumController extends Controller
{
    /**
     * Get all forum categories dengan forums
     */
    public function getCategories(): JsonResponse
    {
        try {
            // Tambahkan is_liked untuk setiap forum jika user login
            // Check jika ada header Authorization (optional auth)
            $userId = null;
            if (request()->hasHeader('Authorization')) {
                try {
                    $user = Auth::guard('sanctum')->user();
                    $userId = $user ? $user->id : null;
                } catch (\Exception $e) {
                    // Silent fail jika token invalid
                    $userId = null;
                }
            }

            $categories = ForumCategory::active()
                ->with(['forums' => function ($query) use ($userId) {
                    $query->active()
                        ->with(['user:id,name,role', 'lastReplyUser:id,name'])
                        ->where(function ($subQuery) use ($userId) {
                            // Public forums selalu bisa diakses
                            $subQuery->where('access_type', 'public');

                            // Private forums hanya bisa diakses oleh user yang berhak
                            if ($userId) {
                                $subQuery->orWhere(function ($subSubQuery) use ($userId) {
                                    $subSubQuery->where('access_type', 'private')
                                        ->where(function ($subSubSubQuery) use ($userId) {
                                            // User yang dipilih untuk akses
                                            $subSubSubQuery->whereJsonContains('allowed_users', $userId)
                                                // ATAU user yang buat forum (author)
                                                ->orWhere('user_id', $userId);
                                        });
                                });
                            }
                        })
                        ->orderBy('status', 'desc') // pinned first
                        ->orderBy('last_activity_at', 'desc');
                }])
                ->orderBy('sort_order')
                ->orderBy('created_at')
                ->get();

            $categories->each(function ($category) use ($userId) {
                if ($category->forums) {
                    $category->forums->transform(function ($forum) use ($userId) {
                        $forum->is_liked = $userId ? $forum->isLikedByUser($userId) : false;
                        $forum->is_new = $userId ? $forum->isNewForUser($userId) : false;
                        return $forum;
                    });
                }
            });

            return response()->json([
                'success' => true,
                'data' => $categories
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengambil data kategori forum',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display a listing of forums with search and filter
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = Forum::with([
                'user:id,name,role',
                'category:id,name,slug,color',
                'lastReplyUser:id,name'
            ]);

            // Filter by category
            if ($request->has('category')) {
                $query->byCategory($request->category);
            }

            // Search by keyword
            if ($request->has('search')) {
                $query->search($request->search);
            }

            // Filter by status
            if ($request->has('status')) {
                $query->where('status', $request->status);
            } else {
                $query->active();
            }

            $forums = $query->orderBy('status', 'desc')
                ->orderBy('last_activity_at', 'desc')
                ->paginate($request->get('per_page', 15));

            // Tambahkan is_liked dan is_new untuk setiap forum dengan optional authentication
            $userId = null;
            if (request()->hasHeader('Authorization')) {
                try {
                    $user = Auth::guard('sanctum')->user();
                    $userId = $user ? $user->id : null;
                } catch (\Exception $e) {
                    // Silent fail jika token invalid
                    $userId = null;
                }
            }

            $forums->getCollection()->transform(function ($forum) use ($userId) {
                $forum->is_liked = $userId ? $forum->isLikedByUser($userId) : false;
                $forum->is_new = $userId ? $forum->isNewForUser($userId) : false;
                return $forum;
            });

            return response()->json([
                'success' => true,
                'data' => $forums
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengambil data forum',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Optimize content by compressing large base64 images
     */
    private function optimizeContent($content)
    {
        // If content is very long, it might contain large base64 images
        if (strlen($content) > 1000000) { // 1MB threshold
            Log::info('Large content detected, checking for base64 images');

            // You can add image compression logic here if needed
            // For now, we'll just log the size
            Log::info('Content size: ' . number_format(strlen($content)) . ' characters');
        }

        return $content;
    }

    /**
     * Store a newly created forum in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'category_id' => 'required|exists:forum_categories,id',
            'access_type' => 'required|in:public,private',
            'selected_users' => 'nullable|array',
            'selected_users.*' => 'integer|exists:users,id',
            'attachments.*' => 'nullable|file|max:10240', // Max 10MB per file
        ]);

        try {
            DB::beginTransaction();

            // Optimize content if needed
            $optimizedContent = $this->optimizeContent($request->content);

            // Log content length for debugging
            $contentLength = strlen($optimizedContent);
            Log::info('Creating forum with content length: ' . $contentLength . ' characters');

            // Create forum
            $forum = Forum::create([
                'title' => $request->title,
                'content' => $optimizedContent, // Optimized rich text HTML content
                'category_id' => $request->category_id,
                'user_id' => Auth::guard('sanctum')->id(),
                'status' => 'active',
                'access_type' => $request->access_type,
                'allowed_users' => $request->access_type === 'private' ? $request->selected_users : null,
                'last_activity_at' => now(),
            ]);

            // Handle file uploads
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    if ($file->isValid()) {
                        // Generate unique filename
                        $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();

                        // Store file
                        $filePath = $file->storeAs('forum-attachments', $filename, 'public');

                        // Create attachment record
                        $forum->attachments()->create([
                            'filename' => $filename,
                            'original_name' => $file->getClientOriginalName(),
                            'file_path' => '/storage/' . $filePath,
                            'file_type' => $file->getMimeType(),
                            'file_size' => $file->getSize(),
                        ]);
                    }
                }
            }

            DB::commit();

            // Log forum creation activity
            activity()
                ->performedOn($forum)
                ->withProperties([
                    'title' => $forum->title,
                    'category_id' => $forum->category_id,
                    'access_type' => $forum->access_type,
                    'attachments_count' => $forum->attachments()->count()
                ])
                ->log("Forum created: {$forum->title}");

            // Send notifications
            try {
                $this->sendForumNotification($forum->load(['user', 'category']));
                Log::info('Forum notifications sent successfully', ['id' => $forum->id, 'title' => $forum->title]);
            } catch (\Exception $e) {
                Log::error('Error sending forum notifications: ' . $e->getMessage(), [
                    'forum_id' => $forum->id,
                    'trace' => $e->getTraceAsString()
                ]);
            }

            Log::info('Forum created successfully', ['id' => $forum->id, 'title' => $forum->title]);

            return response()->json([
                'success' => true,
                'message' => 'Forum berhasil dibuat',
                'data' => [
                    'forum' => $forum->load(['user', 'category', 'attachments']),
                ],
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error creating forum: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'content_length' => strlen($request->content ?? ''),
                'title' => $request->title,
                'category_id' => $request->category_id
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Gagal membuat forum',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified forum with replies
     */
    public function show($slug): JsonResponse
    {
        try {


            $forum = Forum::where('slug', $slug)
                ->with([
                    'user:id,name,role',
                    'category:id,name,slug,color',
                    'lastReplyUser:id,name'
                ])
                ->firstOrFail();

            // Increment views dengan user ID jika ada
            $userId = null;
            if (request()->hasHeader('Authorization')) {
                try {
                    $user = Auth::guard('sanctum')->user();
                    $userId = $user ? $user->id : null;
                    if ($userId) {
                        $forum->incrementViews($userId);
                    }
                } catch (\Exception $e) {
                    // Silent fail jika token invalid
                    $userId = null;
                }
            }

            // Check access control
            if ($forum->access_type === 'private') {
                // Jika forum private, cek apakah user berhak akses
                if (!$userId) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Forum ini bersifat privat. Silakan login untuk mengakses.',
                    ], 403);
                }

                // Author selalu punya akses ke forum yang dia buat
                if ($userId === $forum->user_id) {
                    // Author punya akses, lanjutkan
                } else {
                    // Cek apakah user lain punya akses
                    $allowedUsers = $forum->allowed_users ?? [];
                    if (!in_array($userId, $allowedUsers)) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Anda tidak memiliki akses ke forum ini.',
                        ], 403);
                    }
                }
            }

            // Get replies dengan nested structure - menggunakan recursive function untuk semua level
            $replies = ForumReply::byForum($forum->id)
                ->active()
                ->with([
                    'user:id,name,role',
                    'editor:id,name',
                    'attachments' // Load attachments
                ])
                ->whereNull('parent_id') // Top level replies only
                ->orderBy('created_at', 'desc')
                ->get();

            Log::info('=== DEBUG SHOW METHOD ===');
            Log::info('Forum ID: ' . $forum->id);
            Log::info('Replies count: ' . $replies->count());

            // Recursive function untuk load semua level children tanpa batas
            $loadChildrenRecursively = function ($parentId) use (&$loadChildrenRecursively) {
                $children = ForumReply::where('parent_id', $parentId)
                    ->where('status', 'active')
                    ->with(['user:id,name,role', 'attachments']) // Load attachments for children too
                    ->orderBy('created_at', 'desc')
                    ->get();

                $children->each(function ($child) use (&$loadChildrenRecursively) {
                    // Load children untuk setiap child (recursive - infinite levels)
                    $child->setRelation('children', $loadChildrenRecursively($child->id));

                    // Load parent data untuk setiap child
                    if ($child->parent_id) {
                        $parentReply = ForumReply::with('user:id,name,role')->find($child->parent_id);
                        if ($parentReply) {
                            $child->parent = $parentReply;
                        }
                    }
                });

                return $children;
            };

            // Load semua children secara recursive untuk setiap top-level reply
            $replies->each(function ($reply) use ($loadChildrenRecursively) {
                $reply->setRelation('children', $loadChildrenRecursively($reply->id));
            });

            // Load parent data untuk nested replies secara manual
            $replies->each(function ($reply) {
                if ($reply->children) {
                    $reply->children->each(function ($childReply) {
                        if ($childReply->parent_id) {
                            // Load parent reply dengan user data
                            $parentReply = ForumReply::with(['user:id,name,role', 'attachments'])->find($childReply->parent_id);
                            if ($parentReply) {
                                $childReply->parent = $parentReply;
                            }
                        }
                    });
                }
            });

            // Tambahkan is_liked untuk setiap reply jika user login
            if ($userId) {
                $replies->transform(function ($reply) use ($userId) {
                    $reply->is_liked = $reply->isLikedByUser($userId);
                    $reply->is_bookmarked = $reply->isBookmarkedByUser($userId);
                    return $reply;
                });

                // Recursive function untuk transform infinite levels
                $transformRecursively = function ($replies) use ($userId, &$transformRecursively) {
                    $replies->each(function ($reply) use ($userId, &$transformRecursively) {
                        if ($reply->children && $reply->children->count() > 0) {
                            $reply->children->transform(function ($childReply) use ($userId) {
                                $childReply->is_liked = $childReply->isLikedByUser($userId);
                                $childReply->is_bookmarked = $childReply->isBookmarkedByUser($userId);
                                return $childReply;
                            });
                            // Transform children recursively
                            $transformRecursively($reply->children);
                        }
                    });
                };

                // Transform nested replies secara recursive
                $transformRecursively($replies);
            } else {
                // Set default values untuk unauthenticated users
                $replies->transform(function ($reply) {
                    $reply->is_liked = false;
                    $reply->is_bookmarked = false;
                    return $reply;
                });

                // Recursive function untuk transform infinite levels (unauthenticated)
                $transformRecursivelyUnauth = function ($replies) use (&$transformRecursivelyUnauth) {
                    $replies->each(function ($reply) use (&$transformRecursivelyUnauth) {
                        if ($reply->children && $reply->children->count() > 0) {
                            $reply->children->transform(function ($childReply) {
                                $childReply->is_liked = false;
                                $childReply->is_bookmarked = false;
                                return $childReply;
                            });
                            // Transform children recursively
                            $transformRecursivelyUnauth($reply->children);
                        }
                    });
                };

                // Transform nested replies secara recursive
                $transformRecursivelyUnauth($replies);
            }

            // Cek apakah user yang login sudah like dan bookmark forum ini
            $isLiked = false;
            $isNew = false;
            $isBookmarked = false;
            if ($userId) {
                $isLiked = $forum->isLikedByUser($userId);
                $isNew = $forum->isNewForUser($userId);
                $isBookmarked = $forum->isBookmarkedByUser($userId);

                // Debug log untuk bookmark status
                Log::info('=== DEBUG FORUM BOOKMARK STATUS ===');
                Log::info("User ID: {$userId}");
                Log::info("Forum ID: {$forum->id}");
                Log::info("isBookmarkedByUser result: " . ($isBookmarked ? 'true' : 'false'));
            }

            // Debug: Log replies data before sending
            Log::info('=== DEBUG FINAL RESPONSE ===');
            $replies->each(function ($reply, $index) {
                try {
                    Log::info("Reply {$index} (ID: {$reply->id}):");
                    Log::info("  - Content: " . substr($reply->content, 0, 50) . "...");

                    // Safe debug logging for attachments
                    if ($reply->attachments) {
                        $attachmentsType = gettype($reply->attachments);
                        Log::info("  - Attachments type: {$attachmentsType}");

                        if (is_array($reply->attachments)) {
                            Log::info("  - Attachments count: " . count($reply->attachments));
                            if (count($reply->attachments) > 0) {
                                foreach ($reply->attachments as $attIndex => $attachment) {
                                    if (is_object($attachment) && isset($attachment->original_name, $attachment->file_path)) {
                                        Log::info("    Attachment {$attIndex}: {$attachment->original_name} ({$attachment->file_path})");
                                    } else {
                                        Log::info("    Attachment {$attIndex}: " . json_encode($attachment));
                                    }
                                }
                            }
                        } elseif (is_object($reply->attachments) && method_exists($reply->attachments, 'count')) {
                            Log::info("  - Attachments count: " . $reply->attachments->count());
                            if ($reply->attachments->count() > 0) {
                                $reply->attachments->each(function ($attachment, $attIndex) {
                                    if (is_object($attachment) && isset($attachment->original_name, $attachment->file_path)) {
                                        Log::info("    Attachment {$attIndex}: {$attachment->original_name} ({$attachment->file_path})");
                                    } else {
                                        Log::info("    Attachment {$attIndex}: " . json_encode($attachment));
                                    }
                                });
                            }
                        } else {
                            Log::info("  - Attachments: " . json_encode($reply->attachments));
                        }
                    } else {
                        Log::info("  - Attachments count: 0");
                    }
                } catch (\Exception $e) {
                    Log::error("Error logging reply {$index}: " . $e->getMessage());
                    Log::info("Reply {$index} (ID: {$reply->id}): Error in debug logging");
                }
            });

            // Debug log untuk response JSON
            Log::info('=== DEBUG RESPONSE JSON ===');
            Log::info("is_liked: " . ($isLiked ? 'true' : 'false'));
            Log::info("is_new: " . ($isNew ? 'true' : 'false'));
            Log::info("is_bookmarked: " . ($isBookmarked ? 'true' : 'false'));

            return response()->json([
                'success' => true,
                'data' => [
                    'forum' => $forum,
                    'replies' => $replies,
                    'is_liked' => $isLiked,
                    'is_new' => $isNew,
                    'is_bookmarked' => $isBookmarked
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Forum tidak ditemukan',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Update the specified forum
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            $forum = Forum::findOrFail($id);
            $user = Auth::user();

            // Cek permission
            if (!$forum->canUserEdit($user)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki permission untuk mengedit forum ini'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'title' => 'required|string|max:255',
                'content' => 'required|string',
                'tags' => 'nullable|array',
                'attachments' => 'nullable|array',
                'deadline' => 'nullable|date|after:now',
                'status' => 'in:active,closed,pinned,archived',
                'access_type' => 'required|in:public,private',
                'selected_users' => 'nullable|array',
                'selected_users.*' => 'integer|exists:users,id',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Update forum dengan edit tracking
            $updateData = $request->only([
                'title',
                'content',
                'tags',
                'attachments',
                'deadline',
                'status',
                'access_type'
            ]);

            // Handle access control
            if ($request->access_type === 'private') {
                $updateData['allowed_users'] = $request->selected_users;
            } else {
                $updateData['allowed_users'] = null;
            }

            // Tambahkan edit tracking
            $updateData['is_edited'] = true;
            $updateData['edited_at'] = now();

            $forum->update($updateData);

            $forum->load(['user:id,name,role', 'category:id,name,slug,color']);

            return response()->json([
                'success' => true,
                'message' => 'Forum berhasil diupdate',
                'data' => $forum
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengupdate forum',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified forum
     */
    public function destroy($id): JsonResponse
    {
        try {
            $forum = Forum::findOrFail($id);
            $user = Auth::user();

            // Cek permission
            if (!$forum->canUserDelete($user)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki permission untuk menghapus forum ini'
                ], 403);
            }

            // Hapus turunannya dalam transaksi untuk memastikan konsistensi
            DB::transaction(function () use ($forum) {
                // Hapus semua replies dan bookmark terkait forum ini
                $replyIds = ForumReply::where('forum_id', $forum->id)->pluck('id');
                if ($replyIds->count() > 0) {
                    // Hapus bookmark reply
                    UserReplyBookmark::whereIn('forum_reply_id', $replyIds)->delete();
                    // Hapus replies
                    ForumReply::whereIn('id', $replyIds)->delete();
                }
                // Hapus bookmark forum
                UserForumBookmark::where('forum_id', $forum->id)->delete();
                // Hapus forum
                $forum->delete();
            });

            // Kembalikan 204 agar frontend bisa menangani sukses tanpa body
            return response()->json(null, 204);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menghapus forum',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a forum category (non-default only) and cascade delete its forums and replies
     */
    public function destroyCategory($id)
    {
        try {
            $user = Auth::user();
            if (!$user || !in_array($user->role, ['super_admin', 'tim_akademik'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki permission untuk menghapus kategori forum'
                ], 403);
            }

            $category = ForumCategory::findOrFail($id);

            // Proteksi: kategori default tidak boleh dihapus
            if ($category->is_default) {
                return response()->json([
                    'success' => false,
                    'message' => 'Kategori default tidak dapat dihapus'
                ], 422);
            }

            DB::transaction(function () use ($category) {
                // Ambil semua forum pada kategori ini
                $forums = Forum::where('category_id', $category->id)->get();

                foreach ($forums as $forum) {
                    // Kumpulkan semua reply id
                    $replyIds = ForumReply::where('forum_id', $forum->id)->pluck('id');
                    if ($replyIds->count() > 0) {
                        // Hapus bookmark reply
                        UserReplyBookmark::whereIn('forum_reply_id', $replyIds)->delete();
                        // Hapus replies
                        ForumReply::whereIn('id', $replyIds)->delete();
                    }

                    // Hapus bookmark forum
                    UserForumBookmark::where('forum_id', $forum->id)->delete();

                    // Hapus forumnya
                    $forum->delete();
                }

                // Terakhir, hapus kategori
                $category->delete();
            });

            // 204 No Content untuk sukses
            return response()->json(null, 204);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menghapus kategori forum',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle like untuk forum
     */
    public function toggleLike($id): JsonResponse
    {
        try {
            $forum = Forum::findOrFail($id);
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User harus login untuk like forum'
                ], 401);
            }

            $isLiked = $forum->toggleLike($user->id);

            return response()->json([
                'success' => true,
                'message' => $isLiked ? 'Forum berhasil di-like' : 'Forum berhasil di-unlike',
                'data' => [
                    'is_liked' => $isLiked,
                    'likes_count' => $forum->fresh()->likes_count
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal toggle like forum',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle like untuk reply
     */
    public function toggleReplyLike($replyId): JsonResponse
    {
        try {
            $reply = ForumReply::findOrFail($replyId);
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User harus login untuk like reply'
                ], 401);
            }

            $isLiked = $reply->toggleLike($user->id);

            return response()->json([
                'success' => true,
                'message' => $isLiked ? 'Reply berhasil di-like' : 'Reply berhasil di-unlike',
                'data' => [
                    'is_liked' => $isLiked,
                    'likes_count' => $reply->fresh()->likes_count
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal toggle like reply',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get forums by category slug
     */
    public function getForumsByCategory($categorySlug): JsonResponse
    {
        try {
            $category = ForumCategory::where('slug', $categorySlug)
                ->active()
                ->firstOrFail();

            // Tambahkan is_liked dan is_new untuk setiap forum dengan optional authentication
            $userId = null;
            if (request()->hasHeader('Authorization')) {
                try {
                    $user = Auth::guard('sanctum')->user();
                    $userId = $user ? $user->id : null;
                } catch (\Exception $e) {
                    // Silent fail jika token invalid
                    $userId = null;
                }
            }

            $forums = Forum::with([
                'user:id,name,role',
                'category:id,name,slug,color',
                'lastReplyUser:id,name'
            ])
                ->where('category_id', $category->id)
                ->active()
                ->where(function ($query) use ($userId) {
                    // Public forums selalu bisa diakses
                    $query->where('access_type', 'public');

                    // Private forums hanya bisa diakses oleh user yang berhak
                    if ($userId) {
                        $query->orWhere(function ($subQuery) use ($userId) {
                            $subQuery->where('access_type', 'private')
                                ->where(function ($subSubQuery) use ($userId) {
                                    // User yang dipilih untuk akses
                                    $subSubQuery->whereJsonContains('allowed_users', $userId)
                                        // ATAU user yang buat forum (author)
                                        ->orWhere('user_id', $userId);
                                });
                        });
                    }
                })
                ->orderBy('status', 'desc') // pinned first
                ->orderBy('last_activity_at', 'desc')
                ->paginate(15);

            $forums->getCollection()->transform(function ($forum) use ($userId) {
                $forum->is_liked = $userId ? $forum->isLikedByUser($userId) : false;
                $forum->is_new = $userId ? $forum->isNewForUser($userId) : false;
                $forum->is_bookmarked = $userId ? $forum->isBookmarkedByUser($userId) : false;
                return $forum;
            });

            return response()->json([
                'success' => true,
                'data' => [
                    'category' => $category,
                    'forums' => $forums
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengambil data forum kategori',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a new forum category
     */
    public function storeCategory(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();

            // Cek permission - hanya Super Admin dan Tim Akademik
            if (!in_array($user->role, ['super_admin', 'tim_akademik'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki permission untuk membuat kategori forum baru'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'description' => 'required|string',
                'icon' => 'nullable|string|max:50',
                'color' => 'required|string|max:7',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            $category = ForumCategory::create([
                'name' => $request->name,
                'slug' => Str::slug($request->name),
                'description' => $request->description,
                'icon' => $request->icon ?? 'solid:faComments',
                'color' => $request->color,
                'is_default' => false,
                'is_active' => true,
                'permissions' => ['super_admin', 'tim_akademik'], // Default permissions
                'sort_order' => ForumCategory::max('sort_order') + 1,
                'created_by' => $user->id,
            ]);

            // Send notifications
            $this->sendCategoryNotification($category);

            return response()->json([
                'success' => true,
                'message' => 'Kategori forum berhasil dibuat',
                'data' => $category
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal membuat kategori forum',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a reply to forum
     */
    public function storeReply(Request $request, $forumId): JsonResponse
    {
        try {
            // Debug: Log request data
            \Illuminate\Support\Facades\Log::info('=== DEBUG STORE REPLY ===');
            \Illuminate\Support\Facades\Log::info('Forum ID: ' . $forumId);
            \Illuminate\Support\Facades\Log::info('Request Data: ' . json_encode($request->all()));
            \Illuminate\Support\Facades\Log::info('User: ' . (Auth::check() ? Auth::user()->name : 'Not authenticated'));
            \Illuminate\Support\Facades\Log::info('========================');

            $validator = Validator::make($request->all(), [
                'content' => 'required|string',
                'parent_id' => 'nullable|exists:forum_replies,id',
                'attachments.*' => 'nullable|file|max:10240', // Max 10MB per file
                'is_anonymous' => 'boolean'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            $forum = Forum::findOrFail($forumId);
            $user = Auth::user();

            DB::beginTransaction();
            try {
                $reply = ForumReply::create([
                    'forum_id' => $forum->id,
                    'user_id' => $user->id,
                    'parent_id' => $request->parent_id,
                    'content' => $request->content,
                    'is_anonymous' => $request->get('is_anonymous', false)
                ]);

                // Handle file uploads
                Log::info('=== DEBUG FILE UPLOAD ===');
                Log::info('Has files: ' . ($request->hasFile('attachments') ? 'YES' : 'NO'));
                Log::info('Files count: ' . ($request->hasFile('attachments') ? count($request->file('attachments')) : 0));

                if ($request->hasFile('attachments')) {
                    Log::info('Processing ' . count($request->file('attachments')) . ' files');
                    foreach ($request->file('attachments') as $index => $file) {
                        Log::info("File {$index}: " . $file->getClientOriginalName() . ' (' . $file->getMimeType() . ')');
                        if ($file->isValid()) {
                            $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
                            $filePath = $file->storeAs('forum-reply-attachments', $filename, 'public');

                            Log::info("Stored file: {$filename} at {$filePath}");

                            $attachment = $reply->attachments()->create([
                                'filename' => $filename,
                                'original_name' => $file->getClientOriginalName(),
                                'file_path' => request()->getSchemeAndHttpHost() . '/storage/' . $filePath,
                                'file_type' => $file->getMimeType(),
                                'file_size' => $file->getSize(),
                            ]);

                            Log::info("Created attachment ID: {$attachment->id}");
                        } else {
                            Log::warning("File {$index} is not valid");
                        }
                    }
                } else {
                    Log::info('No files in request');
                }
                Log::info('=== END FILE UPLOAD DEBUG ===');

                DB::commit();

                // Log reply creation activity
                activity()
                    ->performedOn($reply)
                    ->withProperties([
                        'forum_id' => $forum->id,
                        'forum_title' => $forum->title,
                        'parent_id' => $request->parent_id,
                        'is_anonymous' => $request->get('is_anonymous', false),
                        'attachments_count' => $reply->attachments()->count()
                    ])
                    ->log("Forum reply created for: {$forum->title}");

                $reply->load(['user:id,name,role', 'attachments']);

                // Send notifications
                $forum = $reply->forum->load(['user', 'category']);
                if ($request->parent_id) {
                    // This is a reply to a comment
                    $parentReply = ForumReply::with('user')->find($request->parent_id);
                    $this->sendReplyNotification($reply, $forum, $parentReply);
                } else {
                    // This is a new comment
                    $this->sendCommentNotification($reply, $forum);
                }

                Log::info('=== DEBUG RESPONSE ===');
                Log::info('Reply ID: ' . $reply->id);

                // Safe logging for attachments
                if ($reply->attachments) {
                    Log::info('Attachments count: ' . $reply->attachments->count());
                    Log::info('Attachments data: ' . json_encode($reply->attachments->toArray()));
                } else {
                    Log::info('Attachments count: 0 (null)');
                    Log::info('Attachments data: []');
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Reply berhasil ditambahkan',
                    'data' => $reply
                ], 201);
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menambahkan reply',
                'error' => $e->getMessage()
            ], 500);
        }
    }


    /**
     * Update reply
     */
    public function updateReply(Request $request, $replyId): JsonResponse
    {
        try {
            $reply = ForumReply::findOrFail($replyId);

            // Check permission
            if (!Auth::check()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 401);
            }

            $user = Auth::user();

            // Admin dan tim akademik bisa edit kapan saja
            $canEdit = false;
            if (in_array($user->role, ['tim_akademik', 'super_admin'])) {
                $canEdit = true;
            } elseif ($reply->user_id === $user->id) {
                // User biasa hanya bisa edit dalam 2 menit
                $replyTime = new \DateTime($reply->created_at);
                $now = new \DateTime();
                $diffMinutes = ($now->getTimestamp() - $replyTime->getTimestamp()) / 60;
                $canEdit = $diffMinutes < 2;
            }

            if (!$canEdit) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tidak dapat mengedit balasan setelah 2 menit'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'content' => 'required|string|max:5000',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Data tidak valid',
                    'errors' => $validator->errors()
                ], 422);
            }

            $reply->update([
                'content' => $request->content,
                'is_edited' => true,
                'edited_at' => now(),
                'editor_id' => $user->id
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Balasan berhasil diperbarui',
                'data' => $reply
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal memperbarui balasan',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a reply and all its children (cascade delete)
     */
    public function deleteReply(Request $request, $replyId)
    {
        try {
            // Check authentication
            if (!Auth::check()) {
                return response()->json([
                    'message' => 'Unauthorized'
                ], 401);
            }

            $user = Auth::user();
            $reply = ForumReply::findOrFail($replyId);

            // Check if user can delete this reply
            if (!$reply->canUserDelete($user)) {
                return response()->json([
                    'message' => 'Unauthorized to delete this reply'
                ], 403);
            }

            // Get forum for updating replies count
            $forum = Forum::find($reply->forum_id);

            // Count total replies to be deleted (including children)
            $totalToDelete = $this->countTotalReplies($reply);

            // Debug: Log counting info
            Log::info("Delete Reply Debug:", [
                'reply_id' => $reply->id,
                'reply_content' => $reply->content,
                'total_to_delete' => $totalToDelete,
                'forum_replies_before' => $forum ? $forum->replies_count : 'N/A'
            ]);

            // Delete the reply and all children (cascade delete)
            $this->deleteReplyRecursively($reply);

            // Update forum replies count and last activity
            if ($forum) {
                // Calculate new replies count manually instead of using decrement
                $newRepliesCount = max(0, $forum->replies_count - $totalToDelete);

                // Safety check: replies count should never be negative
                if ($newRepliesCount < 0) {
                    Log::warning("Negative replies count detected, setting to 0", [
                        'forum_id' => $forum->id,
                        'old_count' => $forum->replies_count,
                        'calculated_count' => $newRepliesCount,
                        'total_deleted' => $totalToDelete
                    ]);
                    $newRepliesCount = 0;
                }

                $forum->update([
                    'replies_count' => $newRepliesCount,
                    'last_activity_at' => now()
                ]);

                // Debug: Log after update
                Log::info("Forum Updated:", [
                    'forum_id' => $forum->id,
                    'old_replies_count' => $forum->replies_count,
                    'new_replies_count' => $newRepliesCount,
                    'decremented_by' => $totalToDelete
                ]);
            }

            return response()->json([
                'message' => 'Reply deleted successfully',
                'deleted_count' => $totalToDelete
            ]);
        } catch (\Exception $e) {
            Log::error('Error deleting reply: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'message' => 'Failed to delete reply: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Count total replies including all children recursively
     */
    private function countTotalReplies($reply)
    {
        $count = 1; // Count the reply itself

        // Get all children directly from database
        $children = ForumReply::where('parent_id', $reply->id)->get();

        Log::info("Counting reply:", [
            'reply_id' => $reply->id,
            'content' => $reply->content,
            'children_count' => $children->count()
        ]);

        foreach ($children as $child) {
            $childCount = $this->countTotalReplies($child);
            $count += $childCount;

            Log::info("Child counted:", [
                'child_id' => $child->id,
                'child_content' => $child->content,
                'child_count' => $childCount,
                'total_so_far' => $count
            ]);
        }

        Log::info("Final count for reply {$reply->id}: {$count}");
        return $count;
    }

    /**
     * Delete reply and all children recursively
     */
    private function deleteReplyRecursively($reply)
    {
        // Delete all children first
        $children = ForumReply::where('parent_id', $reply->id)->get();

        foreach ($children as $child) {
            $this->deleteReplyRecursively($child);
        }

        // Delete the reply itself
        $reply->delete();
    }

    /**
     * Toggle bookmark for a reply
     */
    public function toggleBookmark(Request $request, $replyId): JsonResponse
    {
        try {
            if (!Auth::check()) {
                return response()->json([
                    'message' => 'Unauthorized'
                ], 401);
            }

            $user = Auth::user();
            $reply = ForumReply::findOrFail($replyId);

            // Check if already bookmarked
            $existingBookmark = UserReplyBookmark::where('user_id', $user->id)
                ->where('forum_reply_id', $replyId)
                ->first();

            if ($existingBookmark) {
                // Remove bookmark
                $existingBookmark->delete();
                $isBookmarked = false;
                $message = 'Bookmark removed successfully';
            } else {
                // Add bookmark
                UserReplyBookmark::create([
                    'user_id' => $user->id,
                    'forum_reply_id' => $replyId
                ]);
                $isBookmarked = true;
                $message = 'Reply bookmarked successfully';
            }

            return response()->json([
                'success' => true,
                'message' => $message,
                'is_bookmarked' => $isBookmarked
            ]);
        } catch (\Exception $e) {
            Log::error('Error toggling bookmark: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to toggle bookmark'
            ], 500);
        }
    }

    /**
     * Get user's bookmarked replies
     */
    public function getUserBookmarks(Request $request): JsonResponse
    {
        try {
            if (!Auth::check()) {
                return response()->json([
                    'message' => 'Unauthorized'
                ], 401);
            }

            $user = Auth::user();
            $perPage = $request->get('per_page', 15);

            $bookmarks = UserReplyBookmark::where('user_id', $user->id)
                ->with([
                    'reply.user:id,name,role,avatar',
                    'reply.forum:id,title,slug,category_id',
                    'reply.forum.category:id,name,slug,color',
                    'reply.parent:id,content,user_id',
                    'reply.parent.user:id,name'
                ])
                ->orderBy('created_at', 'desc')
                ->paginate($perPage);

            return response()->json([
                'success' => true,
                'data' => $bookmarks
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting user bookmarks: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get bookmarks'
            ], 500);
        }
    }

    /**
     * Check if a reply is bookmarked by current user
     */
    public function checkBookmarkStatus(Request $request, $replyId): JsonResponse
    {
        try {
            if (!Auth::check()) {
                return response()->json([
                    'success' => true,
                    'is_bookmarked' => false
                ]);
            }

            $user = Auth::user();
            $isBookmarked = UserReplyBookmark::where('user_id', $user->id)
                ->where('forum_reply_id', $replyId)
                ->exists();

            return response()->json([
                'success' => true,
                'is_bookmarked' => $isBookmarked
            ]);
        } catch (\Exception $e) {
            Log::error('Error checking bookmark status: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'is_bookmarked' => false
            ], 500);
        }
    }

    /**
     * Toggle forum bookmark for current user
     */
    public function toggleForumBookmark(Request $request, $forumId): JsonResponse
    {
        try {
            if (!Auth::guard('sanctum')->check()) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $user = Auth::guard('sanctum')->user();
            $forum = Forum::findOrFail($forumId);

            $existingBookmark = UserForumBookmark::where('user_id', $user->id)
                ->where('forum_id', $forumId)
                ->get();

            if ($existingBookmark->count() > 0) {
                // Remove bookmark
                $existingBookmark->first()->delete();
                $isBookmarked = false;
                $message = 'Forum bookmark removed successfully';
            } else {
                // Add bookmark
                UserForumBookmark::create([
                    'user_id' => $user->id,
                    'forum_id' => $forumId
                ]);
                $isBookmarked = true;
                $message = 'Forum bookmarked successfully';
            }

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => [
                    'is_bookmarked' => $isBookmarked
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error toggling forum bookmark: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to toggle forum bookmark'
            ], 500);
        }
    }

    /**
     * Get user's bookmarked forums
     */
    public function getUserForumBookmarks(Request $request): JsonResponse
    {
        try {
            if (!Auth::guard('sanctum')->check()) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $user = Auth::guard('sanctum')->user();
            $perPage = $request->get('per_page', 15);

            $bookmarks = UserForumBookmark::where('user_id', $user->id)
                ->with([
                    'forum.user:id,name,role,avatar',
                    'forum.category:id,name,slug,color'
                ])
                ->orderBy('created_at', 'desc')
                ->paginate($perPage);

            // Log untuk debugging
            Log::info('Forum bookmarks found: ' . $bookmarks->count());
            Log::info('User ID: ' . $user->id);

            // Tambahkan log response structure
            Log::info('Response structure:', [
                'success' => true,
                'data_type' => get_class($bookmarks),
                'data_count' => $bookmarks->count(),
                'data_total' => $bookmarks->total(),
                'data_structure' => $bookmarks->toArray()
            ]);

            return response()->json([
                'success' => true,
                'data' => $bookmarks
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting user forum bookmarks: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get forum bookmarks'
            ], 500);
        }
    }


    /**
     * Simple method untuk forum bookmarks tanpa pagination
     */
    public function getUserForumBookmarksSimple(Request $request): JsonResponse
    {
        try {
            if (!Auth::guard('sanctum')->check()) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $user = Auth::guard('sanctum')->user();

            $bookmarks = UserForumBookmark::where('user_id', $user->id)
                ->with([
                    'forum.user:id,name,role,avatar',
                    'forum.category:id,name,slug,color'
                ])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $bookmarks
            ]);
        } catch (\Exception $e) {
            Log::error('Error getting user forum bookmarks simple: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get forum bookmarks'
            ], 500);
        }
    }

    /**
     * Send notification for new forum
     */
    private function sendForumNotification($forum)
    {
        try {
            $author = $forum->user;
            $category = $forum->category;
            
            if ($forum->access_type === 'public') {
                // Create a single public notification (user_id = null means it's for all users)
                $notification = Notification::create([
                    'user_id' => null, // null means this is a public notification
                    'title' => 'Forum Baru: ' . $forum->title,
                    'message' => "{$author->name} ({$author->role}) telah membuat forum baru di kategori {$category->name}: \"{$forum->title}\"",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'forum_id' => $forum->id,
                        'forum_title' => $forum->title,
                        'forum_slug' => $forum->slug,
                        'category_id' => $category->id,
                        'category_name' => $category->name,
                        'author_id' => $author->id,
                        'author_name' => $author->name,
                        'author_role' => $author->role,
                        'access_type' => $forum->access_type,
                        'notification_type' => 'forum_created_public'
                    ]
                ]);

            } else {
                // Send to selected users only
                if ($forum->allowed_users) {
                    $selectedUsers = User::whereIn('id', $forum->allowed_users)->get();
                    
                    foreach ($selectedUsers as $user) {
                        // Skip author
                        if ($user->id === $author->id) continue;
                        
                        // Create database notification
                        $notification = Notification::create([
                            'user_id' => $user->id,
                            'title' => 'Forum Private Baru: ' . $forum->title,
                            'message' => "{$author->name} ({$author->role}) telah membuat forum private baru di kategori {$category->name}: \"{$forum->title}\"",
                            'type' => 'info',
                            'is_read' => false,
                            'data' => [
                                'forum_id' => $forum->id,
                                'forum_title' => $forum->title,
                                'forum_slug' => $forum->slug,
                                'category_id' => $category->id,
                                'category_name' => $category->name,
                                'author_id' => $author->id,
                                'author_name' => $author->name,
                                'author_role' => $author->role,
                                'access_type' => $forum->access_type,
                                'notification_type' => 'forum_created'
                            ]
                        ]);

                    }
                }
            }
            
            Log::info("Forum notifications sent for forum: {$forum->title} (ID: {$forum->id})");
        } catch (\Exception $e) {
            Log::error('Error sending forum notifications: ' . $e->getMessage());
        }
    }

    /**
     * Send notification for new comment
     */
    private function sendCommentNotification($reply, $forum)
    {
        try {
            $commenter = $reply->user;
            $author = $forum->user;
            $category = $forum->category;
            
            // Get preview of comment content (strip HTML tags and limit length)
            $contentPreview = strip_tags($reply->content);
            $contentPreview = strlen($contentPreview) > 100 ? substr($contentPreview, 0, 100) . '...' : $contentPreview;
            
            // Get all users who have commented on this forum
            $commenterIds = ForumReply::where('forum_id', $forum->id)
                ->where('user_id', '!=', $commenter->id) // Exclude current commenter
                ->distinct()
                ->pluck('user_id')
                ->toArray();
            
            // Add forum author if not already in the list
            if ($author->id !== $commenter->id && !in_array($author->id, $commenterIds)) {
                $commenterIds[] = $author->id;
            }
            
            // Send notification to all previous commenters and forum author
            foreach ($commenterIds as $userId) {
                Notification::create([
                    'user_id' => $userId,
                    'title' => 'Komentar Baru di Forum: ' . $forum->title,
                    'message' => "{$commenter->name} ({$commenter->role}) telah berkomentar di forum \"{$forum->title}\" di kategori {$category->name}: \"{$contentPreview}\"",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'forum_id' => $forum->id,
                        'forum_title' => $forum->title,
                        'forum_slug' => $forum->slug,
                        'category_id' => $category->id,
                        'category_name' => $category->name,
                        'reply_id' => $reply->id,
                        'commenter_id' => $commenter->id,
                        'commenter_name' => $commenter->name,
                        'commenter_role' => $commenter->role,
                        'comment_preview' => $contentPreview,
                        'notification_type' => 'forum_comment'
                    ]
                ]);
            }
            
            Log::info("Comment notifications sent for forum: {$forum->title} (ID: {$forum->id})");
        } catch (\Exception $e) {
            Log::error('Error sending comment notifications: ' . $e->getMessage());
        }
    }

    /**
     * Send notification for reply to comment
     */
    private function sendReplyNotification($reply, $forum, $parentReply)
    {
        try {
            $replier = $reply->user;
            $parentCommenter = $parentReply->user;
            $author = $forum->user;
            $category = $forum->category;
            
            // Get preview of reply content (strip HTML tags and limit length)
            $contentPreview = strip_tags($reply->content);
            $contentPreview = strlen($contentPreview) > 100 ? substr($contentPreview, 0, 100) . '...' : $contentPreview;
            
            // Notify the parent comment author
            if ($parentCommenter->id !== $replier->id) {
                Notification::create([
                    'user_id' => $parentCommenter->id,
                    'title' => 'Balasan Komentar di Forum: ' . $forum->title,
                    'message' => "{$replier->name} ({$replier->role}) telah membalas komentar Anda di forum \"{$forum->title}\" di kategori {$category->name}: \"{$contentPreview}\"",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'forum_id' => $forum->id,
                        'forum_title' => $forum->title,
                        'forum_slug' => $forum->slug,
                        'category_id' => $category->id,
                        'category_name' => $category->name,
                        'reply_id' => $reply->id,
                        'parent_reply_id' => $parentReply->id,
                        'replier_id' => $replier->id,
                        'replier_name' => $replier->name,
                        'replier_role' => $replier->role,
                        'reply_preview' => $contentPreview,
                        'notification_type' => 'forum_reply'
                    ]
                ]);
            }
            
            // Also notify forum author if different from replier and parent commenter
            if ($author->id !== $replier->id && $author->id !== $parentCommenter->id) {
                Notification::create([
                    'user_id' => $author->id,
                    'title' => 'Balasan Komentar di Forum: ' . $forum->title,
                    'message' => "{$replier->name} ({$replier->role}) telah membalas komentar di forum \"{$forum->title}\" di kategori {$category->name}: \"{$contentPreview}\"",
                    'type' => 'info',
                    'is_read' => false,
                    'data' => [
                        'forum_id' => $forum->id,
                        'forum_title' => $forum->title,
                        'forum_slug' => $forum->slug,
                        'category_id' => $category->id,
                        'category_name' => $category->name,
                        'reply_id' => $reply->id,
                        'parent_reply_id' => $parentReply->id,
                        'replier_id' => $replier->id,
                        'replier_name' => $replier->name,
                        'replier_role' => $replier->role,
                        'reply_preview' => $contentPreview,
                        'notification_type' => 'forum_reply'
                    ]
                ]);
            }
            
            Log::info("Reply notifications sent for forum: {$forum->title} (ID: {$forum->id})");
        } catch (\Exception $e) {
            Log::error('Error sending reply notifications: ' . $e->getMessage());
        }
    }

    /**
     * Send notification for new category
     */
    private function sendCategoryNotification($category)
    {
        try {
            $creator = Auth::user();
            
            // Create a single public notification (user_id = null means it's for all users)
            $notification = Notification::create([
                'user_id' => null, // null means this is a public notification
                'title' => 'Kategori Forum Baru: ' . $category->name,
                'message' => "{$creator->name} ({$creator->role}) telah membuat kategori forum baru: \"{$category->name}\"",
                'type' => 'info',
                'is_read' => false,
                'data' => [
                    'category_id' => $category->id,
                    'category_name' => $category->name,
                    'category_slug' => $category->slug,
                    'creator_id' => $creator->id,
                    'creator_name' => $creator->name,
                    'creator_role' => $creator->role,
                    'notification_type' => 'category_created_public'
                ]
            ]);

            
            Log::info("Category notifications sent for category: {$category->name} (ID: {$category->id})");
        } catch (\Exception $e) {
            Log::error('Error sending category notifications: ' . $e->getMessage());
        }
    }

    /**
     * Get users who viewed a specific forum
     */
    public function getForumViewers(Request $request, $id)
    {
        try {
            $forum = Forum::findOrFail($id);
            $user = Auth::user();
            
            // Hanya author forum yang bisa melihat daftar viewer
            if (!$user || $forum->user_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Hanya author forum yang dapat melihat daftar viewer',
                    'code' => 'UNAUTHORIZED'
                ], 403);
            }
            
            // Get users who viewed this forum with pagination
            $viewers = UserForumView::where('forum_id', $id)
                ->with(['user:id,name,email,role,avatar'])
                ->orderBy('viewed_at', 'desc')
                ->paginate(20);

            return response()->json([
                'success' => true,
                'data' => $viewers->items(),
                'pagination' => [
                    'current_page' => $viewers->currentPage(),
                    'last_page' => $viewers->lastPage(),
                    'per_page' => $viewers->perPage(),
                    'total' => $viewers->total(),
                    'has_more' => $viewers->hasMorePages()
                ],
                'forum' => [
                    'id' => $forum->id,
                    'title' => $forum->title,
                    'views_count' => $forum->views_count
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengambil data viewer forum',
                'error' => $e->getMessage()
            ], 500);
        }
    }





}
