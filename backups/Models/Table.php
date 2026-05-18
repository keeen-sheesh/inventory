<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Table extends Model
{
    use HasFactory;

    protected $fillable = [
        'table_number',
        'capacity',
        'status',
        'is_active',
    ];

    protected $casts = [
        'capacity' => 'integer',
        'is_active' => 'boolean',
    ];

    public function sales()
    {
        return $this->hasMany(Sale::class);
    }

    public function getCurrentStatusAttribute()
    {
        if ($this->status === 'occupied') {
            return 'occupied';
        }
        
        $hasActiveOrders = Sale::where('table_id', $this->id)
            ->whereIn('status', ['pending', 'ready'])
            ->where('order_type', 'dine_in')
            ->exists();
            
        return $hasActiveOrders ? 'occupied' : 'available';
    }
}   