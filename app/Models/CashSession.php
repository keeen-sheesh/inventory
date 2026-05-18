<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashSession extends Model
{
    protected $fillable = [
        'user_id',
        'opening_float',
        'expected_cash',
        'actual_cash',
        'discrepancy',
        'status',
        'override_by',
        'override_reason',
        'opened_at',
        'closed_at',
    ];

    protected $casts = [
        'opening_float' => 'decimal:2',
        'expected_cash' => 'decimal:2',
        'actual_cash'   => 'decimal:2',
        'discrepancy'   => 'decimal:2',
        'opened_at'     => 'datetime',
        'closed_at'     => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function overrideBy()
    {
        return $this->belongsTo(User::class, 'override_by');
    }

    /** Recalculate expected cash from all cash sales during this session */
    public function recalculateExpected(): void
    {
        $cashSales = Sale::where('user_id', $this->user_id)
            ->where('status', 'completed')
            ->whereHas('paymentMethod', fn($q) => $q->where('name', 'Cash'))
            ->where('created_at', '>=', $this->opened_at)
            ->when($this->closed_at, fn($q) => $q->where('created_at', '<=', $this->closed_at))
            ->sum('total_amount');

        $this->expected_cash = $this->opening_float + $cashSales;
        $this->save();
    }
}