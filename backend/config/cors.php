<?php

return [

'paths' => ['api/*', 'login'],
'allowed_origins' => [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://isme.fkkumj.ac.id', // Ganti dengan domain production
],
'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
'allowed_origins_patterns' => [],
'allowed_headers' => [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-CSRF-TOKEN',
    'Cache-Control',
    'Pragma'
],
'exposed_headers' => [],
'max_age' => 0,
'supports_credentials' => false, // CSRF tidak perlu

];
