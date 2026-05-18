<?php

namespace App\Http\Middleware;

use App\Models\CashierShift;
use Closure;
use Illuminate\Http\Request;

class EnsureOpenCashierShift
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'error' => 'Unauthenticated.',
            ], 401);
        }

        if ($user->role !== 'cashier') {
            return response()->json([
                'success' => false,
                'error' => 'Forbidden.',
            ], 403);
        }

        $shift = CashierShift::where('user_id', $user->id)
            ->where('status', 'open')
            ->latest('check_in_time')
            ->first();

        if (! $shift) {
            return response()->json([
                'success' => false,
                'error' => 'No open shift found. Please check in first.',
            ], 409);
        }

        // Allow downstream controller to reuse without another query.
        $request->attributes->set('cashier_shift', $shift);

        return $next($request);
    }
}

