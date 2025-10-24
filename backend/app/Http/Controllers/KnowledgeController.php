<?php

namespace App\Http\Controllers;

use App\Models\KnowledgeArticle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class KnowledgeController extends Controller
{
    /**
     * Get all published knowledge articles
     */
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 10);
        $articles = KnowledgeArticle::where('is_published', true)
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $articles
        ]);
    }

    /**
     * Get all knowledge articles (Super Admin only)
     */
    public function all(Request $request)
    {
        $user = Auth::user();
        
        // Check if user is super admin
        if ($user->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access'
            ], 403);
        }
        
        $perPage = $request->get('per_page', 10);
        $articles = KnowledgeArticle::orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $articles
        ]);
    }

    /**
     * Store a new knowledge article
     */
    public function store(Request $request)
    {
        $user = Auth::user();
        
        // Check if user is super admin
        if ($user->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access'
            ], 403);
        }

        // Debug: Log received data
        \Log::info('Knowledge Store Request Data:', [
            'all' => $request->all(),
            'title' => $request->input('title'),
            'content' => $request->input('content'),
            'category' => $request->input('category'),
            'is_published' => $request->input('is_published'),
            'tags' => $request->input('tags'),
            'method' => $request->method(),
            'content_type' => $request->header('Content-Type')
        ]);

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'category' => 'required|string|in:general,technical,faq,troubleshooting,guide',
            'tags' => 'array',
            'tags.*' => 'string|max:50',
            'is_published' => 'required|in:0,1,true,false',
            'images.*' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:5120', // Max 5MB per image
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Convert is_published to boolean
        $isPublished = $request->is_published === '1' || $request->is_published === 'true' || $request->is_published === true;
        
        $article = KnowledgeArticle::create([
            'title' => $request->title,
            'content' => $request->content,
            'category' => $request->category,
            'tags' => $request->tags ?? [],
            'is_published' => $isPublished,
            'author_id' => $user->id,
        ]);

        // Handle image uploads
        $uploadedImages = [];
        if ($request->hasFile('images')) {
            \Log::info('Knowledge Store: Processing images', [
                'has_images' => $request->hasFile('images'),
                'images_count' => count($request->file('images'))
            ]);
            
            foreach ($request->file('images') as $index => $image) {
                if ($image->isValid()) {
                    $filename = 'knowledge_' . $article->id . '_' . $index . '_' . time() . '.' . $image->getClientOriginalExtension();
                    $image->move(public_path('uploads/knowledge-images'), $filename);
                    $uploadedImages[] = 'uploads/knowledge-images/' . $filename;
                    
                    \Log::info('Knowledge Store: Image uploaded', [
                        'filename' => $filename,
                        'path' => 'uploads/knowledge-images/' . $filename
                    ]);
                }
            }
        }

        // Update article with images
        if (!empty($uploadedImages)) {
            $article->update(['images' => $uploadedImages]);
            \Log::info('Knowledge Store: Images updated', [
                'uploaded_images' => $uploadedImages
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Artikel knowledge base berhasil ditambahkan!',
            'data' => $article
        ]);
    }

    /**
     * Update a knowledge article
     */
    public function update(Request $request, $id)
    {
        $user = Auth::user();
        
        // Check if user is super admin
        if ($user->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access'
            ], 403);
        }

        // Debug: Log received data
        \Log::info('Knowledge Update Request Data:', [
            'all' => $request->all(),
            'title' => $request->input('title'),
            'content' => $request->input('content'),
            'category' => $request->input('category'),
            'is_published' => $request->input('is_published'),
            'tags' => $request->input('tags'),
            'method' => $request->method(),
            'spoofed_method' => $request->input('_method'),
            'content_type' => $request->header('Content-Type')
        ]);

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'category' => 'required|string|in:general,technical,faq,troubleshooting,guide',
            'tags' => 'array',
            'tags.*' => 'string|max:50',
            'is_published' => 'required|in:0,1,true,false',
            'images.*' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $article = KnowledgeArticle::findOrFail($id);
        
        // Convert is_published to boolean
        $isPublished = $request->is_published === '1' || $request->is_published === 'true' || $request->is_published === true;
        
        $article->update([
            'title' => $request->title,
            'content' => $request->content,
            'category' => $request->category,
            'tags' => $request->tags ?? [],
            'is_published' => $isPublished,
        ]);

        // Handle image uploads for update
        $uploadedImages = [];
        if ($request->hasFile('images')) {
            \Log::info('Knowledge Update: Processing images', [
                'has_images' => $request->hasFile('images'),
                'images_count' => count($request->file('images'))
            ]);
            
            foreach ($request->file('images') as $index => $image) {
                if ($image->isValid()) {
                    $filename = 'knowledge_' . $article->id . '_' . $index . '_' . time() . '.' . $image->getClientOriginalExtension();
                    $image->move(public_path('uploads/knowledge-images'), $filename);
                    $uploadedImages[] = 'uploads/knowledge-images/' . $filename;
                    
                    \Log::info('Knowledge Update: Image uploaded', [
                        'filename' => $filename,
                        'path' => 'uploads/knowledge-images/' . $filename
                    ]);
                }
            }
        }

        // Update article with images if any were uploaded
        if (!empty($uploadedImages)) {
            $article->update(['images' => $uploadedImages]);
            \Log::info('Knowledge Update: Images updated', [
                'uploaded_images' => $uploadedImages
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Artikel knowledge base berhasil diperbarui!',
            'data' => $article
        ]);
    }

    /**
     * Delete a knowledge article
     */
    public function destroy($id)
    {
        $user = Auth::user();
        
        // Check if user is super admin
        if ($user->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access'
            ], 403);
        }

        $article = KnowledgeArticle::findOrFail($id);
        
        // Delete associated image files
        if ($article->images && is_array($article->images)) {
            foreach ($article->images as $imagePath) {
                $fullPath = public_path($imagePath);
                if (file_exists($fullPath)) {
                    unlink($fullPath);
                    \Log::info('Knowledge Delete: Image file deleted', [
                        'image_path' => $imagePath,
                        'full_path' => $fullPath
                    ]);
                }
            }
        }
        
        $article->delete();

        return response()->json([
            'success' => true,
            'message' => 'Artikel knowledge base berhasil dihapus!'
        ]);
    }
}
