<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IngredientStock extends Model
{
    use HasFactory;

    protected $fillable = [
        'ingredient_id',
        'inventory_pool_id',
        'quantity',
        'min_stock',
        'cost_per_unit',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'min_stock' => 'decimal:3',
        'cost_per_unit' => 'decimal:2',
    ];

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }

    public function pool()
    {
        return $this->belongsTo(InventoryPool::class, 'inventory_pool_id');
    }
}

