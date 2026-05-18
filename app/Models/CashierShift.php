<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashierShift extends Model
{
    protected $fillable = [
        'user_id',
        'starting_balance',
        'total_sales',
        'total_expenses',
        'ending_balance',
        'check_in_time',
        'check_out_time',
        'status',
    ];

    protected $casts = [
        'starting_balance' => 'decimal:2',
        'total_sales' => 'decimal:2',
        'total_expenses' => 'decimal:2',
        'ending_balance' => 'decimal:2',
        'check_in_time' => 'datetime',
        'check_out_time' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function transactions()
    {
        return $this->hasMany(CashierShiftTransaction::class, 'shift_id');
    }
}

