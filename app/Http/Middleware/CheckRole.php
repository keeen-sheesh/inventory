<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = Auth::user();
        
        if (!$user) {
            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'error' => 'Unauthenticated.',
                ], 401);
            }

            return redirect()->route('login');
        }

        // Treat null as active (DB defaults aren't always present on in-memory models, e.g. tests).
        if ($user->is_active === false) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'error' => 'Your account is deactivated. Contact an administrator to reactivate it.',
                ], 403);
            }

            return redirect()->route('login')
                ->withErrors([
                    'email' => 'Your account is deactivated. Contact an administrator to reactivate it.',
                ]);
        }
        
        
        // Check if user has any of the required roles
        foreach ($roles as $role) {
            if ($user->hasRole($role)) {
                return $next($request);
            }
        }

        if ($request->expectsJson()) {
            return response()->json([
                'success' => false,
                'error' => 'Forbidden.',
            ], 403);
        }
        
        // If no role matches, redirect based on user role
        return match($user->role) {
            'admin', 'manager'  => redirect()->route('admin.dashboard'),
            'kitchen'           => redirect('/admin/kitchen'),
            'kitchen_resto'     => redirect('/admin/kitchen'),
            'cashier'           => redirect('/cashier/dashboard'),
            'resto'             => redirect('/cashier/dashboard'),
            default             => redirect('/menu'),
        };
    }
}
