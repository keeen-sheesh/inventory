<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CashSession;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

/**
 * SIMPLIFIED Cash Session Controller
 * Boss's preference: Fixed float (petty cash), just count at end of day
 */
class CashSessionController extends Controller
{
    // Your fixed float - always the same amount in the register
    private const FIXED_FLOAT = 3000.00;
    
    // How much shortage/overage is acceptable before requiring manager approval
    private const TOLERANCE = 50.00;

    /** GET /cashier/cash-session/current — return the open session for this user, if any */
    public function current(Request $request)
    {
        $session = CashSession::where('user_id', auth()->id())
            ->where('status', 'open')
            ->latest()
            ->first();

        return response()->json([
            'success' => true,
            'session' => $session,
        ]);
    }

    /** POST /cashier/cash-session/open — start shift (auto-start with fixed float) */
    public function open(Request $request)
    {
        // Close any old sessions
        CashSession::where('user_id', auth()->id())
            ->where('status', 'open')
            ->update(['status' => 'closed', 'closed_at' => now()]);

        // Create new session with fixed float (no user input needed)
        $session = CashSession::create([
            'user_id'        => auth()->id(),
            'opening_float'  => self::FIXED_FLOAT,
            'expected_cash'  => self::FIXED_FLOAT,
            'opened_at'      => now(),
            'status'         => 'open',
        ]);

        return response()->json([
            'success' => true,
            'session' => $session,
            'message' => 'Shift started.',
        ]);
    }

    /** POST /cashier/cash-session/close — cashier counts total cash in drawer */
    public function close(Request $request)
    {
        $request->validate([
            'actual_cash' => 'required|numeric|min:0',
        ]);

        $session = CashSession::where('user_id', auth()->id())
            ->where('status', 'open')
            ->latest()
            ->firstOrFail();

        // Get all cash sales during this session
        $cashSales = Sale::where('user_id', auth()->id())
            ->where('status', 'completed')
            ->whereHas('paymentMethod', fn($q) => $q->where('name', 'Cash'))
            ->where('created_at', '>=', $session->opened_at)
            ->sum('total_amount');

        // Expected = Float + Cash Sales
        $expected = self::FIXED_FLOAT + (float) $cashSales;
        $actual   = (float) $request->actual_cash;
        $discrepancy = $actual - $expected;
        
        // OVERAGE (positive) = Good! Extra money, always acceptable
        // SHORTAGE (negative) = Problem! Missing money, check tolerance
        if ($discrepancy >= 0) {
            // Overage - always acceptable, no approval needed
            $withinTolerance = true;
        } else {
            // Shortage - check if within tolerance
            $withinTolerance = abs($discrepancy) <= self::TOLERANCE;
        }

        // Update session (keep status as 'open' until manager override or within tolerance)
        $session->update([
            'expected_cash' => $expected,
            'actual_cash'   => $actual,
            'discrepancy'   => $discrepancy,
            // If within tolerance OR overage, auto-close. Otherwise keep open for manager override.
            'status'        => $withinTolerance ? 'closed' : 'open',
            'closed_at'     => $withinTolerance ? now() : null,
        ]);

        // Build friendly message
        if ($discrepancy == 0) {
            $message = '✅ Perfect! Drawer is balanced.';
        } elseif ($discrepancy > 0) {
            // Overage - always good
            $message = "✅ Drawer has ₱" . number_format($discrepancy, 2) . " extra. Great! You may log out.";
        } elseif ($withinTolerance) {
            // Shortage within tolerance
            $diff = abs($discrepancy);
            $message = "Drawer is ₱" . number_format($diff, 2) . " short. Within tolerance (±₱" . number_format(self::TOLERANCE, 2) . "). You may log out.";
        } else {
            // Shortage outside tolerance - requires approval
            $diff = abs($discrepancy);
            $message = "⚠️ Drawer is SHORT by ₱" . number_format($diff, 2) . " (tolerance: ±₱" . number_format(self::TOLERANCE, 2) . "). Manager approval required.";
        }

        return response()->json([
            'success'      => true,
            'session'      => $session->fresh(),
            'can_logout'   => $withinTolerance,
            'discrepancy'  => $discrepancy,
            'expected'     => $expected,
            'actual'       => $actual,
            'message'      => $message,
        ]);
    }

    /** POST /cashier/cash-session/override — manager approves variance */
    public function override(Request $request)
    {
        $request->validate([
            'manager_email' => 'required|email',
            'manager_password' => 'required|string',
            'override_reason'  => 'nullable|string|max:500',
        ]);

        // Verify manager credentials (email + password) for accountability
        $manager = User::whereIn('role', ['admin', 'manager'])
            ->where('is_active', true)
            ->whereRaw('LOWER(email) = ?', [strtolower((string) $request->manager_email)])
            ->first();

        if (!$manager || !Hash::check($request->manager_password, $manager->password)) {
            return response()->json([
                'success' => false,
                'error'   => 'Invalid manager credentials.',
            ], 422);
        }

        // Get session
        $session = CashSession::where('user_id', auth()->id())
            ->where('status', 'open')
            ->latest()
            ->firstOrFail();

        // Close with override
        $session->update([
            'status'          => 'override',
            'override_by'     => $manager->id,
            'override_reason' => $request->override_reason ?? 'Manager override',
            'closed_at'       => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Override approved by ' . $manager->name . '. You may log out.',
        ]);
    }
}
