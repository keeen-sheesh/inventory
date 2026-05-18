<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashierShiftTransaction extends Model
{
    protected $fillable = [
        'shift_id',
        'type',
        'amount',
        'description',
        'source',
        'sale_id',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function shift()
    {
        return $this->belongsTo(CashierShift::class, 'shift_id');
    }

    public function sale()
    {
        return $this->belongsTo(Sale::class, 'sale_id');
    }
}

