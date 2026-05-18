<?php

namespace App\Http\Controllers\Cashier;

use App\Http\Controllers\Controller;
use App\Models\CashierShift;
use App\Models\CashierShiftTransaction;
use Illuminate\Http\Request;

class ShiftTransactionController extends Controller
{
    /** POST /cashier/transactions */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:sale,expense',
            'amount' => 'required|numeric|min:0',
            'description' => 'nullable|string|max:255',
        ]);

        /** @var \App\Models\CashierShift|null $shift */
        $shift = $request->attributes->get('cashier_shift');
        $shift = $shift ?: CashierShift::where('user_id', auth()->id())
            ->where('status', 'open')
            ->latest('check_in_time')
            ->first();

        $transaction = CashierShiftTransaction::create([
            'shift_id' => $shift->id,
            'type' => $validated['type'],
            'amount' => $validated['amount'],
            'description' => $validated['description'] ?? null,
            'source' => 'manual',
        ]);

        $totalSales = (float) CashierShiftTransaction::where('shift_id', $shift->id)
            ->where('type', 'sale')
            ->sum('amount');

        $totalExpenses = (float) CashierShiftTransaction::where('shift_id', $shift->id)
            ->where('type', 'expense')
            ->sum('amount');

        return response()->json([
            'success' => true,
            'transaction' => $transaction,
            'shift' => [
                'id' => $shift->id,
                'starting_balance' => (float) $shift->starting_balance,
                'total_sales' => $totalSales,
                'total_expenses' => $totalExpenses,
            ],
        ]);
    }
}
