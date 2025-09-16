<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

class SystemBackupController extends Controller
{
    protected $backupPath;
    
    public function __construct()
    {
        $this->backupPath = storage_path('app/backups');
        
        // Create backup directory if it doesn't exist
        if (!File::exists($this->backupPath)) {
            File::makeDirectory($this->backupPath, 0755, true);
        }
    }

    /**
     * Create a database backup
     */
    public function createBackup(Request $request): JsonResponse|BinaryFileResponse
    {
        try {
            $request->validate([
                'type' => 'required|in:full,data_only,structure_only',
                'include_files' => 'boolean'
            ]);

            $type = $request->input('type', 'full');
            $includeFiles = $request->input('include_files', false);
            
            $timestamp = Carbon::now()->format('Y-m-d_H-i-s');
            $filename = "backup_{$type}_{$timestamp}.sql";
            $filepath = $this->backupPath . DIRECTORY_SEPARATOR . $filename;

            // Generate backup using PHP approach (more reliable than shell commands)
            $this->createBackupUsingPHP($type, $filepath);

            // Create ZIP archive if including files
            if ($includeFiles) {
                $zipFilename = "backup_full_{$timestamp}.zip";
                $zipFilepath = $this->backupPath . DIRECTORY_SEPARATOR . $zipFilename;
                
                $zip = new \ZipArchive();
                if ($zip->open($zipFilepath, \ZipArchive::CREATE) === TRUE) {
                    // Add SQL file
                    $zip->addFile($filepath, $filename);
                    
                    // Add storage files
                    $this->addStorageFilesToZip($zip);
                    
                    $zip->close();
                    
                    // Delete the standalone SQL file
                    File::delete($filepath);
                    
                    $filepath = $zipFilepath;
                    $filename = $zipFilename;
                }
            }

            // Update last backup time in system health
            $this->updateLastBackupTime();

            // Return file download and delete from server after sending
            return response()->download($filepath, $filename)->deleteFileAfterSend(true);

        } catch (\Exception $e) {
            Log::error('Backup failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Backup failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get list of available backups (for import only - showing only pre-import backups)
     */
    public function getBackups(Request $request): JsonResponse
    {
        try {
            $files = File::files($this->backupPath);
            $backups = [];

            foreach ($files as $file) {
                // Only show pre-import backup files for reference
                if (in_array($file->getExtension(), ['sql', 'zip']) && 
                    strpos($file->getFilename(), 'pre_import_backup_') !== false) {
                    $backups[] = [
                        'name' => $file->getFilename(),
                        'size' => $this->formatBytes($file->getSize()),
                        'size_bytes' => $file->getSize(),
                        'created_at' => Carbon::createFromTimestamp($file->getMTime())->format('Y-m-d H:i:s'),
                        'created_at_human' => Carbon::createFromTimestamp($file->getMTime())->diffForHumans(),
                        'type' => 'pre_import_backup',
                        'extension' => $file->getExtension()
                    ];
                }
            }

            // Sort by creation time (newest first)
            usort($backups, function($a, $b) {
                return strtotime($b['created_at']) - strtotime($a['created_at']);
            });

            return response()->json([
                'success' => true,
                'backups' => $backups,
                'message' => 'Manual backups are downloaded directly to your computer. Only pre-import safety backups are stored on server.'
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get backups: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get backups: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Import/Restore database from backup file
     */
    public function importBackup(Request $request): JsonResponse
    {
        try {
            // More flexible validation - we'll do content-based validation later
            $request->validate([
                'backup_file' => 'required|file|max:102400', // 100MB max - no MIME restriction
                'type' => 'required|in:full,data_only'
            ]);
            
            // Get file and validate
            $file = $request->file('backup_file');
            $type = $request->input('type', 'full');
            $filename = $file->getClientOriginalName();
            $extension = strtolower($file->getClientOriginalExtension());
            
            // Accept common backup file extensions
            $allowedExtensions = ['sql', 'zip', 'txt', 'bak'];
            if (!in_array($extension, $allowedExtensions)) {
                Log::warning('File extension not in allowed list', [
                    'filename' => $filename,
                    'extension' => $extension,
                    'allowed' => $allowedExtensions
                ]);
                // Still allow it - we'll validate content later
            }
            
            $timestamp = Carbon::now()->format('Y-m-d_H-i-s');
            
            // Create temp directory if it doesn't exist
            $tempDir = storage_path('app/temp');
            if (!File::exists($tempDir)) {
                File::makeDirectory($tempDir, 0755, true);
            }
            
            $uploadedFilename = $timestamp . '_' . $file->getClientOriginalName();
            
            // Try different approach - move file manually
            $targetPath = $tempDir . DIRECTORY_SEPARATOR . $uploadedFilename;
            
            // Normalize all paths to use consistent separators
            $targetPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $targetPath);
            
            try {
                // Method 1: Try Laravel's storeAs method
                $uploadedPath = $file->storeAs('temp', $uploadedFilename);
                $fullPath = storage_path('app') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $uploadedPath);
                
                // Normalize path separators
                $fullPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $fullPath);
                
                Log::info('File upload attempt', [
                    'method' => 'storeAs',
                    'uploaded_path' => $uploadedPath,
                    'full_path' => $fullPath,
                    'target_path' => $targetPath,
                    'file_exists_store_as' => File::exists($fullPath),
                    'file_exists_target' => File::exists($targetPath)
                ]);
                
                if (!$uploadedPath || !File::exists($fullPath)) {
                    Log::warning('storeAs method failed, trying manual move');
                    
                    // Method 2: Manual file move with absolute path
                    try {
                        $moved = $file->move($tempDir, $uploadedFilename);
                        if ($moved) {
                            $fullPath = $targetPath;
                            Log::info('Manual file move successful', [
                                'path' => $fullPath,
                                'file_exists_after_move' => File::exists($fullPath),
                                'file_size_after_move' => File::exists($fullPath) ? File::size($fullPath) : 'not found'
                            ]);
                        } else {
                            throw new \Exception('Manual move returned false');
                        }
                    } catch (\Exception $moveError) {
                        Log::error('Manual move failed', ['error' => $moveError->getMessage()]);
                        
                        // Method 3: Copy uploaded file content
                        try {
                            // Store the real path before move operations
                            $originalPath = $file->getRealPath();
                            Log::info('Attempting file copy', [
                                'original_path' => $originalPath,
                                'target_path' => $targetPath,
                                'original_exists' => file_exists($originalPath)
                            ]);
                            
                            $content = file_get_contents($originalPath);
                            if ($content !== false && file_put_contents($targetPath, $content) !== false) {
                                $fullPath = $targetPath;
                                Log::info('File copy successful', ['path' => $fullPath, 'size' => strlen($content)]);
                            } else {
                                throw new \Exception('File copy failed - could not read or write content');
                            }
                        } catch (\Exception $copyError) {
                            Log::error('File copy failed', ['error' => $copyError->getMessage()]);
                            throw new \Exception('All file upload methods failed: ' . $copyError->getMessage());
                        }
                    }
                }
            } catch (\Exception $e) {
                Log::error('File upload error', ['error' => $e->getMessage()]);
                throw new \Exception('Failed to store uploaded file: ' . $e->getMessage());
            }

            // Debug logging - don't access file after move
            Log::info('Import process started', [
                'original_filename' => $file->getClientOriginalName(),
                'uploaded_filename' => $uploadedFilename,
                'uploaded_path' => $uploadedPath ?? 'null',
                'full_path' => $fullPath,
                'file_exists' => File::exists($fullPath),
                'file_size_actual' => File::exists($fullPath) ? File::size($fullPath) : 'file not found',
                'temp_dir_exists' => File::exists($tempDir),
                'temp_dir_writable' => is_writable($tempDir),
                'temp_dir_contents' => File::exists($tempDir) ? array_map('basename', File::files($tempDir)) : [],
                'storage_app_path' => storage_path('app'),
                'type' => $type
            ]);

            // Final verification that file exists and is accessible
            if (!File::exists($fullPath)) {
                Log::error('File upload failed - file not found after all upload attempts', [
                    'full_path' => $fullPath,
                    'target_path' => $targetPath,
                    'temp_dir' => $tempDir,
                    'temp_dir_files' => File::exists($tempDir) ? array_map('basename', File::files($tempDir)) : 'temp dir not exists'
                ]);
                throw new \Exception("File upload failed - file not accessible at: {$fullPath}");
            }
            
            Log::info('File upload successful', [
                'final_path' => $fullPath,
                'file_size' => File::size($fullPath),
                'readable' => is_readable($fullPath)
            ]);
            
            // Validate file content to ensure it's a valid backup file
            $isValidBackup = $this->validateBackupFileContent($fullPath);
            if (!$isValidBackup) {
                Log::error('Invalid backup file content', [
                    'file' => $filename,
                    'path' => $fullPath
                ]);
                throw new \Exception("The uploaded file does not appear to be a valid backup file. Please check the file content and try again.");
            }

            try {
                // Check if file is ZIP by content (not just extension)
                $isZipFile = $this->isZipFile($fullPath);
                
                if ($file->getClientOriginalExtension() === 'zip' || $isZipFile) {
                    // Extract ZIP file and find SQL file
                    $extractPath = storage_path('app') . DIRECTORY_SEPARATOR . 'temp' . DIRECTORY_SEPARATOR . 'extracted_' . $timestamp;
                    File::makeDirectory($extractPath, 0755, true);
                    
                    $zip = new \ZipArchive();
                    if ($zip->open($fullPath) === TRUE) {
                        $zip->extractTo($extractPath);
                        $zip->close();
                        
                        // Find SQL file in extracted content
                        $sqlFiles = glob($extractPath . DIRECTORY_SEPARATOR . '*.sql');
                        if (empty($sqlFiles)) {
                            throw new \Exception('No SQL file found in the ZIP archive');
                        }
                        $sqlFile = $sqlFiles[0];
                    } else {
                        throw new \Exception('Failed to open ZIP file: ' . $fullPath);
                    }
                } else {
                    $sqlFile = $fullPath;
                }
                
                // Verify that the SQL file exists before proceeding
                if (!File::exists($sqlFile)) {
                    throw new \Exception("SQL file not found: {$sqlFile}");
                }

                // Create backup of current database before importing
                $preImportBackup = $this->backupPath . DIRECTORY_SEPARATOR . 'pre_import_backup_' . $timestamp . '.sql';
                
                try {
                    $this->createBackupUsingPHP('full', $preImportBackup);
                } catch (\Exception $e) {
                    Log::warning('Pre-import backup failed: ' . $e->getMessage() . ', but continuing with import');
                }

                // Validate and correct import type based on file content
                $validation = $this->validateAndCorrectImportType($sqlFile, $type);
                $correctedType = $validation['type'];
                $detectedType = $validation['detected_type'];
                $warnings = $validation['warnings'];
                
                // Import the SQL file with corrected type
                $this->importSqlFileUsingPHP($sqlFile, $correctedType);

                // Restore storage files if this is a full backup with files
                if (($file->getClientOriginalExtension() === 'zip' || $isZipFile) && $correctedType === 'full') {
                    $this->restoreStorageFilesFromZip($fullPath, $extractPath);
                }

                // Clean up temporary files
                File::delete($fullPath);
                if (isset($extractPath)) {
                    File::deleteDirectory($extractPath);
                }

                // Prepare response message
                $message = 'Database restored successfully!';
                if ($correctedType !== $type) {
                    $message .= " Import type was auto-corrected from '{$type}' to '{$correctedType}' based on file content.";
                }
                
                $responseData = [
                    'success' => true,
                    'message' => $message,
                    'pre_import_backup' => basename($preImportBackup),
                    'backup_type' => $correctedType,
                    'original_requested_type' => $type,
                    'detected_file_type' => $detectedType,
                    'restored_at' => Carbon::now()->format('Y-m-d H:i:s')
                ];
                
                // Add warnings if any
                if (!empty($warnings)) {
                    $responseData['warnings'] = $warnings;
                }
                
                return response()->json($responseData);

            } catch (\Exception $e) {
                // Clean up on error
                File::delete($fullPath);
                if (isset($extractPath)) {
                    File::deleteDirectory($extractPath);
                }
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Import failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Import failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Download a specific backup file
     */
    public function downloadBackup(Request $request, string $filename): BinaryFileResponse|JsonResponse
    {
        try {
            $filepath = $this->backupPath . DIRECTORY_SEPARATOR . $filename;
            
            if (!File::exists($filepath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Backup file not found'
                ], 404);
            }

            return response()->download($filepath);

        } catch (\Exception $e) {
            Log::error('Download backup failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Download failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a backup file
     */
    public function deleteBackup(Request $request, string $filename): JsonResponse
    {
        try {
            $filepath = $this->backupPath . DIRECTORY_SEPARATOR . $filename;
            
            if (!File::exists($filepath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Backup file not found'
                ], 404);
            }

            File::delete($filepath);

            return response()->json([
                'success' => true,
                'message' => 'Backup file deleted successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Delete backup failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Delete failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reset system data (keep only super admin users)
     */
    public function resetSystem(Request $request): JsonResponse
    {
        try {
            // Get current user to preserve their account
            $currentUser = $request->user();
            if (!$currentUser || $currentUser->role !== 'super_admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only Super Admin can perform system reset'
                ], 403);
            }

            Log::info('System reset initiated', [
                'user_id' => $currentUser->id,
                'user_name' => $currentUser->name,
                'timestamp' => Carbon::now()
            ]);

            // Get all super admin users to preserve them
            $superAdminUsers = DB::table('users')
                ->where('role', 'super_admin')
                ->get();

            // Preserve current user's token to prevent logout
            $currentUserToken = null;
            if ($request->bearerToken()) {
                $currentUserToken = DB::table('personal_access_tokens')
                    ->where('tokenable_id', $currentUser->id)
                    ->where('tokenable_type', 'App\\Models\\User')
                    ->where('name', 'auth_token')
                    ->first();
            }

            // List of tables to reset (exclude users table for now)
            $tablesToReset = [
                'absensi_csr',
                'absensi_jurnal', 
                'absensi_pbl',
                'csr',
                'csr_mapping',
                'dosen_peran',
                'jadwal_agenda_khusus',
                'jadwal_csr',
                'jadwal_jurnal_reading',
                'jadwal_kuliah_besar',
                'jadwal_non_blok_non_csr',
                'jadwal_pbl',
                'jadwal_praktikum',
                'kelas',
                'kelompok_besar',
                'kelompok_besar_antara',
                'kelompok_kecil',
                'kelompok_kecil_antara',
                'mata_kuliah',
                'mata_kuliah_pbl_kelompok_kecil',
                'materi_kuliah',
                'notifications',
                'pbl',
                'pbl_mapping',
                'penilaian_jurnal',
                'penilaian_pbl',
                'ruangan',
                'semester',
                'tahun_ajaran'
            ];

            // Disable foreign key checks temporarily
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
            
            // Reset each table
            foreach ($tablesToReset as $table) {
                if (DB::getSchemaBuilder()->hasTable($table)) {
                    DB::table($table)->truncate();
                    Log::info("Table reset: {$table}");
                }
            }
            
            // Re-enable foreign key checks
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');

            // Reset users table but preserve super admin accounts
            DB::table('users')->where('role', '!=', 'super_admin')->delete();
            Log::info('Non-super admin users deleted');

            // Reset other system tables
            $systemTables = [
                'migrations',
                'password_resets', 
                'failed_jobs'
            ];

            // Disable foreign key checks for system tables too
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
            
            foreach ($systemTables as $table) {
                if (DB::getSchemaBuilder()->hasTable($table)) {
                    DB::table($table)->truncate();
                    Log::info("System table reset: {$table}");
                }
            }
            
            // Handle personal_access_tokens separately to preserve current user's token
            if (DB::getSchemaBuilder()->hasTable('personal_access_tokens')) {
                if ($currentUserToken) {
                    // Delete all tokens except current user's token
                    DB::table('personal_access_tokens')
                        ->where('id', '!=', $currentUserToken->id)
                        ->delete();
                    Log::info("Personal access tokens reset (preserved current user token)");
                } else {
                    // If no current token found, truncate all
                    DB::table('personal_access_tokens')->truncate();
                    Log::info("Personal access tokens reset (no current token to preserve)");
                }
            }
            
            // Re-enable foreign key checks
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');

            // Clear cache
            cache()->flush();
            Log::info('Cache cleared');

            Log::info('System reset completed successfully', [
                'preserved_super_admins' => $superAdminUsers->count(),
                'reset_tables' => count($tablesToReset),
                'timestamp' => Carbon::now()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'System reset completed successfully. All data has been deleted except Super Admin accounts.',
                'preserved_super_admins' => $superAdminUsers->count(),
                'reset_tables' => count($tablesToReset),
                'reset_at' => Carbon::now()->format('Y-m-d H:i:s')
            ]);

        } catch (\Exception $e) {
            Log::error('System reset failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'System reset failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create backup using PHP approach (more reliable than shell commands)
     */
    private function createBackupUsingPHP(string $type, string $filepath): void
    {
        $host = config('database.connections.mysql.host');
        $port = config('database.connections.mysql.port');
        $database = config('database.connections.mysql.database');
        $username = config('database.connections.mysql.username');
        $password = config('database.connections.mysql.password');

        try {
            // Create PDO connection
            $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
            $pdo = new \PDO($dsn, $username, $password, [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC
            ]);

            // Start with SQL header
            $sql = "-- MySQL Database Backup\n";
            $sql .= "-- Generated on: " . Carbon::now()->format('Y-m-d H:i:s') . "\n";
            $sql .= "-- Database: {$database}\n";
            $sql .= "-- Backup Type: {$type}\n";
            $sql .= "-- \n\n";
            $sql .= "SET FOREIGN_KEY_CHECKS=0;\n";
            $sql .= "SET SQL_MODE = \"NO_AUTO_VALUE_ON_ZERO\";\n";
            $sql .= "SET AUTOCOMMIT = 0;\n";
            $sql .= "START TRANSACTION;\n";
            $sql .= "SET time_zone = \"+00:00\";\n\n";
            
            // Get all tables
            $tables = $pdo->query("SHOW TABLES")->fetchAll(\PDO::FETCH_COLUMN);
            
            // Define tables to exclude from backup
            $excludeTables = ['migrations', 'password_resets', 'personal_access_tokens', 'failed_jobs'];
            
            foreach ($tables as $table) {
                // Skip excluded tables
                if (in_array($table, $excludeTables)) {
                    continue;
                }
                
                // Add table structure if needed
                if ($type === 'full' || $type === 'structure_only') {
                    $sql .= "-- Table structure for table `{$table}`\n";
                    $sql .= "DROP TABLE IF EXISTS `{$table}`;\n";
                    
                    $createTable = $pdo->query("SHOW CREATE TABLE `{$table}`")->fetch();
                    $sql .= $createTable['Create Table'] . ";\n\n";
                }
                
                // Add table data if needed
                if ($type === 'full' || $type === 'data_only') {
                    $sql .= "-- Dumping data for table `{$table}`\n";
                    
                    // For data only mode, use TRUNCATE to completely clear existing data
                    if ($type === 'data_only') {
                        $sql .= "SET FOREIGN_KEY_CHECKS=0;\n";
                        $sql .= "TRUNCATE TABLE `{$table}`;\n";
                        $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";
                    }
                    
                    $stmt = $pdo->query("SELECT * FROM `{$table}`");
                    $rows = $stmt->fetchAll();
                    
                    if (!empty($rows)) {
                        $columns = array_keys($rows[0]);
                        $columnsList = '`' . implode('`, `', $columns) . '`';
                        
                        // For data_only, use INSERT (not IGNORE) since we cleared the table
                        // For full backup, use INSERT IGNORE for safety
                        $insertType = ($type === 'data_only') ? 'INSERT' : 'INSERT IGNORE';
                        
                        foreach ($rows as $row) {
                            $values = array_map(function($value) use ($pdo) {
                                return $value === null ? 'NULL' : $pdo->quote($value);
                            }, array_values($row));
                            
                            $sql .= "{$insertType} INTO `{$table}` ({$columnsList}) VALUES (" . implode(', ', $values) . ");\n";
                        }
                    }
                    $sql .= "\n";
                }
            }
            
            // Add SQL footer
            $sql .= "\nCOMMIT;\n";
            $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";
            $sql .= "-- Backup completed on: " . Carbon::now()->format('Y-m-d H:i:s') . "\n";
            
            // Write to file
            if (file_put_contents($filepath, $sql) === false) {
                throw new \Exception("Failed to write backup file to: {$filepath}");
            }
            
            // For debugging data_only backups, log sample content
            if ($type === 'data_only') {
                $sqlPreview = substr($sql, 0, 1000) . (strlen($sql) > 1000 ? '...' : '');
                Log::info("Data only backup preview", [
                    'sql_preview' => $sqlPreview,
                    'contains_truncate' => str_contains($sql, 'TRUNCATE'),
                    'contains_insert' => str_contains($sql, 'INSERT INTO')
                ]);
            }
            
            Log::info("Backup created successfully", [
                'type' => $type,
                'filepath' => $filepath,
                'file_size' => filesize($filepath),
                'tables_count' => count($tables)
            ]);
            
        } catch (\PDOException $e) {
            throw new \Exception("Database connection failed: " . $e->getMessage());
        }
    }

    /**
     * Generate mysqldump command based on backup type (fallback method)
     */
    private function generateBackupCommand(string $type, string $filepath): string
    {
        $host = config('database.connections.mysql.host');
        $port = config('database.connections.mysql.port');
        $database = config('database.connections.mysql.database');
        $username = config('database.connections.mysql.username');
        $password = config('database.connections.mysql.password');

        // Escape filepath for Windows
        $escapedFilepath = '"' . str_replace('/', '\\', $filepath) . '"';
        
        // Build command array for better security and Windows compatibility
        $command = ['mysqldump'];
        $command[] = "--host={$host}";
        $command[] = "--port={$port}";
        $command[] = "--user={$username}";
        
        if ($password) {
            $command[] = "--password={$password}";
        }

        // Add type-specific options
        switch ($type) {
            case 'structure_only':
                $command[] = '--no-data';
                $command[] = '--routines';
                $command[] = '--triggers';
                break;
            case 'data_only':
                $command[] = '--no-create-info';
                $command[] = '--complete-insert';
                break;
            case 'full':
            default:
                $command[] = '--routines';
                $command[] = '--triggers';
                $command[] = '--complete-insert';
                break;
        }

        $command[] = $database;
        
        // Return as string command with output redirect
        return implode(' ', $command) . " > {$escapedFilepath}";
    }

    /**
     * Import SQL file to database using PHP approach (more reliable)
     */
    private function importSqlFileUsingPHP(string $sqlFile, string $type): void
    {
        $host = config('database.connections.mysql.host');
        $port = config('database.connections.mysql.port');
        $database = config('database.connections.mysql.database');
        $username = config('database.connections.mysql.username');
        $password = config('database.connections.mysql.password');

        try {
            // Create PDO connection
            $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
            $pdo = new \PDO($dsn, $username, $password, [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION
            ]);

            // Read SQL file
            $sqlContent = file_get_contents($sqlFile);
            if ($sqlContent === false) {
                throw new \Exception("Failed to read SQL file: {$sqlFile}");
            }

            Log::info("Starting SQL import", [
                'file' => $sqlFile,
                'size' => strlen($sqlContent),
                'type' => $type
            ]);

            // For debugging data_only imports, count current records before import
            if ($type === 'data_only') {
                try {
                    $userCount = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
                    Log::info("Pre-import record count", ['users' => $userCount]);
                } catch (\Exception $e) {
                    Log::warning("Could not count records before import: " . $e->getMessage());
                }
            }

            // Split SQL content into individual statements - improved parsing
            $statements = [];
            $currentStatement = '';
            $lines = explode("\n", $sqlContent);
            
            foreach ($lines as $line) {
                $line = trim($line);
                
                // Skip empty lines and comments
                if (empty($line) || str_starts_with($line, '--') || str_starts_with($line, '#')) {
                    continue;
                }
                
                $currentStatement .= $line . "\n";
                
                // Check if statement is complete (ends with semicolon)
                if (str_ends_with($line, ';')) {
                    $statements[] = trim($currentStatement);
                    $currentStatement = '';
                }
            }
            
            // Add remaining statement if any
            if (!empty(trim($currentStatement))) {
                $statements[] = trim($currentStatement);
            }

            Log::info("Parsed SQL statements", ['count' => count($statements)]);

            // Execute each statement
            $pdo->beginTransaction();
            $successCount = 0;
            $errorCount = 0;
            
            foreach ($statements as $index => $statement) {
                if (!empty(trim($statement))) {
                    $statement = trim($statement);
                    
                    // Skip transaction control statements since we're managing transactions ourselves
                    $skipStatements = [
                        'START TRANSACTION',
                        'COMMIT',
                        'ROLLBACK',
                        'SET AUTOCOMMIT',
                        'BEGIN'
                    ];
                    
                    $shouldSkip = false;
                    foreach ($skipStatements as $skipPattern) {
                        if (stripos($statement, $skipPattern) === 0) {
                            $shouldSkip = true;
                            Log::info("Skipping transaction control statement", [
                                'statement' => substr($statement, 0, 100) . "...",
                                'pattern' => $skipPattern
                            ]);
                            break;
                        }
                    }
                    
                    if ($shouldSkip) {
                        continue;
                    }
                    
                    try {
                        $pdo->exec($statement);
                        $successCount++;
                        
                        // Log progress for large imports
                        if (($index + 1) % 100 === 0) {
                            Log::info("Import progress: " . ($index + 1) . "/" . count($statements) . " statements executed");
                        }
                        
                    } catch (\PDOException $e) {
                        $errorCount++;
                        // Log the error but continue with other statements
                        Log::warning("Failed to execute SQL statement", [
                            'error' => $e->getMessage(),
                            'statement_preview' => substr($statement, 0, 200) . "...",
                            'statement_number' => $index + 1
                        ]);
                        
                        // For critical errors, fail the entire transaction
                        if (str_contains($e->getMessage(), 'Table') && str_contains($e->getMessage(), "doesn't exist")) {
                            throw new \Exception("Critical database structure error: " . $e->getMessage());
                        }
                    }
                }
            }
            
            // Commit transaction safely
            try {
                if ($pdo->inTransaction()) {
                    $pdo->commit();
                    Log::info("Transaction committed successfully");
                } else {
                    Log::warning("No active transaction to commit");
                }
            } catch (\PDOException $e) {
                Log::error("Failed to commit transaction: " . $e->getMessage());
                throw new \Exception("Failed to commit database changes: " . $e->getMessage());
            }
            
            // For debugging data_only imports, count records after import
            if ($type === 'data_only') {
                try {
                    $userCountAfter = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
                    Log::info("Post-import record count", ['users' => $userCountAfter]);
                } catch (\Exception $e) {
                    Log::warning("Could not count records after import: " . $e->getMessage());
                }
            }
            
            Log::info("SQL import completed", [
                'total_statements' => count($statements),
                'successful' => $successCount,
                'errors' => $errorCount,
                'type' => $type
            ]);
            
        } catch (\PDOException $e) {
            if (isset($pdo)) {
                try {
                    if ($pdo->inTransaction()) {
                        $pdo->rollBack();
                        Log::info("Transaction rolled back due to error");
                    }
                } catch (\PDOException $rollbackError) {
                    Log::error("Failed to rollback transaction: " . $rollbackError->getMessage());
                }
            }
            Log::error("Database import failed", [
                'error' => $e->getMessage(),
                'file' => $sqlFile,
                'type' => $type
            ]);
            throw new \Exception("Database import failed: " . $e->getMessage());
        }
    }

    /**
     * Import SQL file to database (fallback method using mysql command)
     */
    private function importSqlFile(string $sqlFile, string $type): void
    {
        $host = config('database.connections.mysql.host');
        $port = config('database.connections.mysql.port');
        $database = config('database.connections.mysql.database');
        $username = config('database.connections.mysql.username');
        $password = config('database.connections.mysql.password');

        $command = "mysql -h{$host} -P{$port} -u{$username}";
        
        if ($password) {
            $command .= " -p{$password}";
        }

        $command .= " {$database} < {$sqlFile}";

        $process = Process::fromShellCommandline($command);
        $process->setTimeout(600); // 10 minutes timeout for large imports
        $process->run();

        if (!$process->isSuccessful()) {
            throw new ProcessFailedException($process);
        }
    }

    /**
     * Add storage files to ZIP archive
     */
    private function addStorageFilesToZip(\ZipArchive $zip): void
    {
        $storagePath = storage_path('app/public');
        
        if (File::exists($storagePath)) {
            $files = File::allFiles($storagePath);
            
            foreach ($files as $file) {
                $relativePath = 'storage/' . $file->getRelativePathname();
                $zip->addFile($file->getRealPath(), $relativePath);
            }
        }
    }

    /**
     * Restore storage files from ZIP backup
     */
    private function restoreStorageFilesFromZip(string $zipPath, string $extractPath): void
    {
        try {
            $storagePath = storage_path('app/public');
            
            // Create storage directory if it doesn't exist
            if (!File::exists($storagePath)) {
                File::makeDirectory($storagePath, 0755, true);
            }
            
            // Find storage folder in extracted content
            $storageFolder = $extractPath . DIRECTORY_SEPARATOR . 'storage';
            if (!File::exists($storageFolder)) {
                Log::info('No storage folder found in backup, skipping file restoration');
                return;
            }
            
            // Copy files from extracted storage to actual storage
            $this->copyDirectory($storageFolder, $storagePath);
            
            Log::info('Storage files restored successfully', [
                'from' => $storageFolder,
                'to' => $storagePath,
                'files_count' => count(File::allFiles($storagePath))
            ]);
            
        } catch (\Exception $e) {
            Log::warning('Failed to restore storage files: ' . $e->getMessage());
            // Don't throw error - file restoration is optional
        }
    }
    
    /**
     * Copy directory recursively
     */
    private function copyDirectory(string $source, string $destination): void
    {
        if (!File::exists($destination)) {
            File::makeDirectory($destination, 0755, true);
        }
        
        $items = new \FilesystemIterator($source);
        foreach ($items as $item) {
            $target = $destination . DIRECTORY_SEPARATOR . $item->getBasename();
            
            if ($item->isDir()) {
                $this->copyDirectory($item->getRealPath(), $target);
            } else {
                File::copy($item->getRealPath(), $target);
            }
        }
    }

    /**
     * Update last backup time in cache or database
     */
    private function updateLastBackupTime(): void
    {
        cache()->put('last_backup_time', Carbon::now(), now()->addDays(30));
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = array('B', 'KB', 'MB', 'GB', 'TB');

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, $precision) . ' ' . $units[$i];
    }

    /**
     * Get backup type from filename
     */
    private function getBackupType(string $filename): string
    {
        if (strpos($filename, '_full_') !== false) {
            return 'full';
        } elseif (strpos($filename, '_data_only_') !== false) {
            return 'data_only';
        } elseif (strpos($filename, '_structure_only_') !== false) {
            return 'structure_only';
        }
        
        return 'unknown';
    }
    
    /**
     * Check if file is a ZIP file by reading file signature
     */
    private function isZipFile(string $filePath): bool
    {
        try {
            if (!File::exists($filePath)) {
                return false;
            }
            
            $handle = fopen($filePath, 'rb');
            if (!$handle) {
                return false;
            }
            
            // Read first 4 bytes
            $header = fread($handle, 4);
            fclose($handle);
            
            // ZIP file signature: PK\x03\x04 or PK\x05\x06 or PK\x07\x08
            $isZip = $header === "PK\x03\x04" || $header === "PK\x05\x06" || $header === "PK\x07\x08";
            
            Log::info('File type detection', [
                'file' => basename($filePath),
                'header_hex' => bin2hex($header),
                'is_zip' => $isZip
            ]);
            
            return $isZip;
            
        } catch (\Exception $e) {
            Log::warning('Failed to check if file is ZIP: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Detect backup type from SQL file content
     */
    private function detectBackupTypeFromContent(string $filePath): string
    {
        try {
            if (!File::exists($filePath)) {
                return 'unknown';
            }
            
            // Read first 2KB to analyze content
            $handle = fopen($filePath, 'r');
            if (!$handle) {
                return 'unknown';
            }
            
            $content = fread($handle, 2048);
            fclose($handle);
            
            // Check for backup type indicator in header comments
            if (preg_match('/-- Backup Type: (\w+)/i', $content, $matches)) {
                $detectedType = strtolower($matches[1]);
                Log::info('Detected backup type from header', [
                    'file' => basename($filePath),
                    'detected_type' => $detectedType
                ]);
                return $detectedType;
            }
            
            // Fallback: Analyze SQL statements to determine type
            $hasCreateTable = stripos($content, 'CREATE TABLE') !== false || stripos($content, 'DROP TABLE') !== false;
            $hasInsertData = stripos($content, 'INSERT INTO') !== false || stripos($content, 'INSERT IGNORE') !== false;
            $hasTruncate = stripos($content, 'TRUNCATE TABLE') !== false;
            
            if ($hasCreateTable && $hasInsertData) {
                $detectedType = 'full';
            } elseif ($hasInsertData && ($hasTruncate || stripos($content, 'DELETE FROM') !== false)) {
                $detectedType = 'data_only';
            } elseif ($hasCreateTable && !$hasInsertData) {
                $detectedType = 'structure_only';
            } else {
                $detectedType = 'unknown';
            }
            
            Log::info('Detected backup type from content analysis', [
                'file' => basename($filePath),
                'detected_type' => $detectedType,
                'has_create_table' => $hasCreateTable,
                'has_insert_data' => $hasInsertData,
                'has_truncate' => $hasTruncate
            ]);
            
            return $detectedType;
            
        } catch (\Exception $e) {
            Log::warning('Failed to detect backup type: ' . $e->getMessage());
            return 'unknown';
        }
    }
    
    /**
     * Validate and correct import type based on file content
     */
    private function validateAndCorrectImportType(string $filePath, string $requestedType): array
    {
        $detectedType = $this->detectBackupTypeFromContent($filePath);
        $correctedType = $requestedType;
        $warnings = [];
        
        if ($detectedType !== 'unknown' && $detectedType !== $requestedType) {
            $warnings[] = "File appears to be '{$detectedType}' backup but '{$requestedType}' import was requested";
            
            // Auto-correct the type based on file content for better compatibility
            if ($detectedType === 'data_only' && $requestedType === 'full') {
                $correctedType = 'data_only';
                $warnings[] = "Auto-corrected import type to 'data_only' based on file content";
            } elseif ($detectedType === 'full' && $requestedType === 'data_only') {
                // Keep as 'data_only' - will import data portion only
                $warnings[] = "Importing data portion only from full backup as requested";
            } elseif ($detectedType === 'structure_only') {
                $correctedType = 'structure_only';
                $warnings[] = "Auto-corrected import type to 'structure_only' based on file content";
            }
        }
        
        Log::info('Import type validation', [
            'file' => basename($filePath),
            'requested_type' => $requestedType,
            'detected_type' => $detectedType,
            'corrected_type' => $correctedType,
            'warnings' => $warnings
        ]);
        
        return [
            'type' => $correctedType,
            'detected_type' => $detectedType,
            'warnings' => $warnings
        ];
    }
    
    /**
     * Validate that the uploaded file is a valid backup file
     */
    private function validateBackupFileContent(string $filePath): bool
    {
        try {
            if (!File::exists($filePath)) {
                return false;
            }
            
            // Check if it's a ZIP file first
            if ($this->isZipFile($filePath)) {
                // For ZIP files, try to peek inside
                $zip = new \ZipArchive();
                if ($zip->open($filePath) === TRUE) {
                    for ($i = 0; $i < $zip->numFiles; $i++) {
                        $filename = $zip->getNameIndex($i);
                        if (pathinfo($filename, PATHINFO_EXTENSION) === 'sql') {
                            $zip->close();
                            return true; // Found SQL file inside ZIP
                        }
                    }
                    $zip->close();
                }
                return false; // ZIP but no SQL file found
            }
            
            // For non-ZIP files, check if it contains SQL content
            $handle = fopen($filePath, 'r');
            if (!$handle) {
                return false;
            }
            
            $content = fread($handle, 4096); // Read first 4KB
            fclose($handle);
            
            // Check for SQL indicators
            $sqlIndicators = [
                'CREATE TABLE',
                'INSERT INTO',
                'DROP TABLE',
                'TRUNCATE TABLE',
                'SET FOREIGN_KEY_CHECKS',
                '-- MySQL',
                'START TRANSACTION',
                'COMMIT'
            ];
            
            $foundIndicators = 0;
            foreach ($sqlIndicators as $indicator) {
                if (stripos($content, $indicator) !== false) {
                    $foundIndicators++;
                }
            }
            
            // Must have at least 2 SQL indicators to be considered valid
            $isValid = $foundIndicators >= 2;
            
            Log::info('Backup file content validation', [
                'file' => basename($filePath),
                'found_indicators' => $foundIndicators,
                'is_valid' => $isValid,
                'file_size' => filesize($filePath)
            ]);
            
            return $isValid;
            
        } catch (\Exception $e) {
            Log::warning('Failed to validate backup file content: ' . $e->getMessage());
            return false; // Fail safe - reject invalid files
        }
    }
}
