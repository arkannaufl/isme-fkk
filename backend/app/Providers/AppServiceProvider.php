<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Spatie\Activitylog\Models\Activity;
use Jenssegers\Agent\Agent;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Activity::saving(function ($activity) {
            $request = request();
            $agent = new Agent();
            $activity->properties = $activity->properties->put('details', [
                'ip_address' => $request->ip(),
                'browser' => $agent->browser() . ' ' . $agent->version($agent->browser()),
                'os' => $agent->platform() . ' ' . $agent->version($agent->platform()),
                'method' => $request->method(),
                'path' => $request->path(),
            ]);
        });
    }
}
