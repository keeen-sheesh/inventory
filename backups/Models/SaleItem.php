<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SaleItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id',
        'item_id',
        'quantity',
        'unit_price',
        'total_price',
        'special_instructions',
        'kitchen_status',        // ADD THIS
        'kitchen_started_at',    // ADD THIS
        'kitchen_completed_at',  // ADD THIS
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
        'kitchen_started_at' => 'datetime',    // ADD THIS
        'kitchen_completed_at' => 'datetime',  // ADD THIS
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}