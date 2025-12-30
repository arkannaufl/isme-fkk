#!/usr/bin/env php
<?php

/**
 * Setup Environment Script untuk Backend
 * 
 * Usage:
 *   php setup-env.php development
 *   php setup-env.php production
 */

$args = $argv ?? [];
$environment = $args[1] ?? 'development';

$validEnvironments = ['development', 'production'];

if (!in_array($environment, $validEnvironments)) {
    echo "❌ Environment tidak valid. Gunakan: development atau production\n";
    echo "Contoh: php setup-env.php development\n";
    exit(1);
}

$baseDir = __DIR__;
$envFiles = [
    'development' => '.env.development',
    'production' => '.env.production'
];

$sourceFile = $baseDir . '/' . $envFiles[$environment];
$targetFile = $baseDir . '/.env';

// Template untuk development
$developmentTemplate = <<<'ENV'
APP_NAME=ISME
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file
# APP_MAINTENANCE_STORE=database

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=isme-db-local
DB_USERNAME=root
DB_PASSWORD=

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database

CACHE_STORE=database
# CACHE_PREFIX=

MEMCACHED_HOST=127.0.0.1

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_SCHEME=null
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=epicgsnew20@gmail.com
MAIL_PASSWORD="gpon stlr elhd rmcx"
MAIL_FROM_ADDRESS="epicgsnew20@gmail.com"
MAIL_FROM_NAME="${APP_NAME}"

WABLAS_TOKEN=8nJAtEBEAggiJRZ4sii7wsTlbhEcDBXJnvPa9PZto5LN9n7U9nf3rZ3
WABLAS_SECRET_KEY=W6hDTKYG
WABLAS_BASE_URL=https://tegal.wablas.com/api
WABLAS_ENABLED=true

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

VITE_APP_NAME="${APP_NAME}"
ENV;

// Template untuk production
$productionTemplate = <<<'ENV'
APP_NAME=ISME
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=http://isme.fkkumj.ac.id

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file
# APP_MAINTENANCE_STORE=database

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=isme-db
DB_USERNAME=isme-fkk
DB_PASSWORD=Ism3fkk@2025

SESSION_DRIVER=redis
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=redis

CACHE_STORE=redis
# CACHE_PREFIX=

MEMCACHED_HOST=127.0.0.1

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
REDIS_DB=0
REDIS_CACHE_DB=1

MAIL_MAILER=smtp
MAIL_SCHEME=null
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=epicgsnew20@gmail.com
MAIL_PASSWORD="gpon stlr elhd rmcx"
MAIL_FROM_ADDRESS="epicgsnew20@gmail.com"
MAIL_FROM_NAME="${APP_NAME}"

WABLAS_TOKEN=8nJAtEBEAggiJRZ4sii7wsTlbhEcDBXJnvPa9PZto5LN9n7U9nf3rZ3
WABLAS_SECRET_KEY=W6hDTKYG
WABLAS_BASE_URL=https://tegal.wablas.com/api
WABLAS_ENABLED=true

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

VITE_APP_NAME="${APP_NAME}"
ENV;

// Check if source file exists, jika tidak ada buat dari template
if (!file_exists($sourceFile)) {
    echo "⚠️  File {$envFiles[$environment]} tidak ditemukan.\n";
    echo "💡 Membuat file {$envFiles[$environment]} dari template...\n";
    
    $template = $environment === 'development' ? $developmentTemplate : $productionTemplate;
    file_put_contents($sourceFile, $template);
    
    echo "✅ File {$envFiles[$environment]} berhasil dibuat!\n";
    echo "⚠️  Jangan lupa edit file tersebut sesuai kebutuhan Anda (APP_KEY, DB_DATABASE, dll)\n\n";
}

try {
    // Copy file
    copy($sourceFile, $targetFile);
    
    echo "✅ Environment {$environment} berhasil di-setup!\n";
    echo "📁 File .env telah dibuat dari {$envFiles[$environment]}\n";
    
    // Read and display key values
    $envContent = file_get_contents($targetFile);
    $lines = explode("\n", $envContent);
    $envMap = [];
    
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) {
            continue;
        }
        
        $pos = strpos($line, '=');
        if ($pos === false) {
            continue;
        }
        
        $key = trim(substr($line, 0, $pos));
        $value = trim(substr($line, $pos + 1));
        $envMap[$key] = $value;
    }
    
    // Auto-generate APP_KEY if empty
    $appKey = $envMap['APP_KEY'] ?? '';
    if (empty($appKey)) {
        echo "\n🔑 APP_KEY kosong, generating new key...\n";
        $newKey = 'base64:' . base64_encode(random_bytes(32));
        $envContent = preg_replace('/^APP_KEY=.*$/m', "APP_KEY={$newKey}", $envContent);
        file_put_contents($targetFile, $envContent);
        echo "✅ APP_KEY berhasil di-generate!\n";
    }
    
    // Display important configs
    $cacheStore = $envMap['CACHE_STORE'] ?? 'not set';
    $sessionDriver = $envMap['SESSION_DRIVER'] ?? 'not set';
    $appEnv = $envMap['APP_ENV'] ?? 'not set';
    $appDebug = $envMap['APP_DEBUG'] ?? 'not set';
    
    echo "\n📋 Konfigurasi:\n";
    echo "   APP_ENV: {$appEnv}\n";
    echo "   APP_DEBUG: {$appDebug}\n";
    echo "   CACHE_STORE: {$cacheStore}\n";
    echo "   SESSION_DRIVER: {$sessionDriver}\n";
    
    if ($environment === 'development' && $cacheStore === 'database') {
        echo "\n💡 Development mode: Menggunakan database cache (tidak perlu Redis)\n";
    } elseif ($environment === 'production' && $cacheStore === 'redis') {
        echo "\n💡 Production mode: Menggunakan Redis cache\n";
        echo "   ⚠️ Pastikan Redis sudah diinstall dan running!\n";
    }
    
    // Auto-clear cache and config
    echo "\n🧹 Clearing cache dan config...\n";
    $commands = [
        'config:clear' => 'php artisan config:clear',
        'cache:clear' => 'php artisan cache:clear',
        'route:clear' => 'php artisan route:clear',
        'view:clear' => 'php artisan view:clear',
    ];
    
    foreach ($commands as $name => $command) {
        $output = [];
        $returnVar = 0;
        exec($command . ' 2>&1', $output, $returnVar);
        if ($returnVar === 0) {
            echo "   ✅ {$name}\n";
        } else {
            echo "   ⚠️  {$name} (warning, mungkin tidak ada cache)\n";
        }
    }
    
    echo "\n✅ Setup selesai! Environment {$environment} sudah siap digunakan.\n";
    
} catch (Exception $e) {
    echo "❌ Error saat setup environment: " . $e->getMessage() . "\n";
    exit(1);
}

