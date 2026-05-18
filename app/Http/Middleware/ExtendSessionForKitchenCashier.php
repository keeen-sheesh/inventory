<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;

class ExtendSessionForKitchenCashier
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     */
    public function handle(Request $request, Closure $next): mixed
    {
        // Extend session lifetime for kitchen and cashier roles
        if (Auth::check()) {
            $user = Auth::user();
            // Check if user has kitchen, resto, or cashier role
            // These roles need longer sessions as they work continuously
            if (in_array($user->role, ['kitchen', 'kitchen_resto', 'cashier', 'resto'])) {
                // Extend session to 24 hours (1440 minutes)
                Config::set('session.lifetime', 1440);
                
                // Touch the session to extend its lifetime
                $request->session()->save();
            }
        }

        return $next($request);
    }
}
