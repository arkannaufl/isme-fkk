<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class SanitizeInput
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Sanitize query parameters
        $query = $request->query();
        $sanitizedQuery = $this->sanitizeArray($query);
        $request->query->replace($sanitizedQuery);

        // Sanitize request body
        $input = $request->all();
        $sanitizedInput = $this->sanitizeArray($input);
        $request->replace($sanitizedInput);

        return $next($request);
    }

    /**
     * Recursively sanitize array values.
     */
    protected function sanitizeArray(array $array): array
    {
        $sanitized = [];

        foreach ($array as $key => $value) {
            if (is_array($value)) {
                $sanitized[$key] = $this->sanitizeArray($value);
            } else {
                $sanitized[$key] = $this->sanitizeValue($value);
            }
        }

        return $sanitized;
    }

    /**
     * Sanitize individual value.
     */
    protected function sanitizeValue($value): string
    {
        if (!is_string($value)) {
            return $value;
        }

        // Remove null bytes
        $value = str_replace(chr(0), '', $value);

        // Remove control characters except newlines and tabs
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);

        // Trim whitespace
        $value = trim($value);

        // Convert special characters to HTML entities (basic XSS protection)
        $value = htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return $value;
    }
}
