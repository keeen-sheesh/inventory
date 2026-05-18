<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'ingredient_id',
        'inventory_pool_id',
        'quantity_delta',
        'reason',
        'reference_type',
        'reference_id',
        'user_id',
        'notes',
        'meta',
    ];

    protected $casts = [
        'quantity_delta' => 'decimal:3',
        'meta' => 'array',
    ];

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }

    public function pool()
    {
        return $this->belongsTo(InventoryPool::class, 'inventory_pool_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
