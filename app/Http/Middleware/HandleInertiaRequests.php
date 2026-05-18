<?php

namespace App\Http\Middleware;

use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $settings = $this->resolveSharedSettings();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'settings' => $settings,
        ];
    }

    /**
     * Avoid crashing requests in test/bootstrap states where `settings` table
     * is not yet migrated.
     */
    private function resolveSharedSettings(): array
    {
        $defaults = [
            'business_name' => 'CJ BREW & DINE',
            'business_tagline' => 'Restobar System',
            'business_logo' => null,
        ];

        try {
            if (!Schema::hasTable('settings')) {
                return $defaults;
            }

            return [
                'business_name' => Setting::get('business_name', $defaults['business_name']),
                'business_tagline' => Setting::get('business_tagline', $defaults['business_tagline']),
                'business_logo' => Setting::get('business_logo', $defaults['business_logo']),
            ];
        } catch (\Throwable) {
            return $defaults;
        }
    }
}
