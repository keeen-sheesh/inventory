<?php

namespace App\Http\Controllers\Cashier;

use App\Http\Controllers\Controller;
use App\Models\CashierShift;
use App\Models\CashierShiftTransaction;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShiftController extends Controller
{
    /** GET /cashier/shifts/current */
    public function current(Request $request)
    {
        $shift = CashierShift::where('user_id', auth()->id())
            ->where('status', 'open')
            ->latest('check_in_time')
            ->first();

        return response()->json([
            'success' => true,
            'shift' => $shift,
        ]);
    }

    /** POST /cashier/shifts/check-in */
    public function checkIn(Request $request)
    {
        $validated = $request->validate([
            'starting_balance' => 'required|numeric|min:0',
        ]);

        $shift = DB::transaction(function () use ($validated) {
            // Lock user row so concurrent check-ins can't create multiple open shifts.
            User::whereKey(auth()->id())->lockForUpdate()->firstOrFail();

            $existing = CashierShift::where('user_id', auth()->id())
                ->where('status', 'open')
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return null;
            }

            return CashierShift::create([
                'user_id' => auth()->id(),
                'starting_balance' => $validated['starting_balance'],
                'check_in_time' => now(),
                'status' => 'open',
            ]);
        });

        if (! $shift) {
            return response()->json([
                'success' => false,
                'error' => 'You already have an open shift. Please check out first.',
            ], 409);
        }

        return response()->json([
            'success' => true,
            'shift' => $shift,
        ]);
    }

    /** POST /cashier/shifts/check-out */
    public function checkOut(Request $request)
    {
        $result = DB::transaction(function () {
            $shift = CashierShift::where('user_id', auth()->id())
                ->where('status', 'open')
                ->lockForUpdate()
                ->latest('check_in_time')
                ->first();

            if (! $shift) {
                return ['error' => 'No open shift found. Please check in first.', 'status' => 409];
            }

            $hasActiveOrders = Sale::where('cashier_shift_id', $shift->id)
                ->whereNotIn('status', ['completed', 'cancelled'])
                ->exists();

            if ($hasActiveOrders) {
                return ['error' => 'Cannot check out while there are active orders for this shift.', 'status' => 409];
            }

            $totalSales = (float) CashierShiftTransaction::where('shift_id', $shift->id)
                ->where('type', 'sale')
                ->sum('amount');

            $totalExpenses = (float) CashierShiftTransaction::where('shift_id', $shift->id)
                ->where('type', 'expense')
                ->sum('amount');

            $starting = (float) $shift->starting_balance;
            $ending = $starting + $totalSales - $totalExpenses;

            $shift->update([
                'total_sales' => $totalSales,
                'total_expenses' => $totalExpenses,
                'ending_balance' => $ending,
                'check_out_time' => now(),
                'status' => 'closed',
            ]);

            return ['shift' => $shift->fresh(), 'status' => 200];
        });

        if (isset($result['error'])) {
            return response()->json([
                'success' => false,
                'error' => $result['error'],
            ], $result['status'] ?? 400);
        }

        $shift = $result['shift'];

        return response()->json([
            'success' => true,
            'receipt' => $this->receiptPayload($shift),
        ]);
    }

    /** GET /cashier/shifts/{shift}/receipt */
    public function receipt(CashierShift $shift)
    {
        if ((int) $shift->user_id !== (int) auth()->id()) {
            return response()->json([
                'success' => false,
                'error' => 'Not found.',
            ], 404);
        }

        if ($shift->status !== 'closed') {
            return response()->json([
                'success' => false,
                'error' => 'Receipt is only available after check-out.',
            ], 409);
        }

        return response()->json([
            'success' => true,
            'receipt' => $this->receiptPayload($shift),
        ]);
    }

    private function receiptPayload(CashierShift $shift): array
    {
        $user = auth()->user();

        return [
            'cashier_id' => $user?->id,
            'cashier_name' => $user?->name,
            'shift_id' => $shift->id,
            'shift_start' => optional($shift->check_in_time)->toISOString(),
            'shift_end' => optional($shift->check_out_time)->toISOString(),
            'starting_balance' => (float) $shift->starting_balance,
            'total_sales' => (float) $shift->total_sales,
            'total_expenses' => (float) $shift->total_expenses,
            'ending_balance' => (float) $shift->ending_balance,
        ];
    }
}
