<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ingredient extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'unit',
        'pieces_per_box',
        'is_dry',
        'quantity',
        'min_stock',
        'cost_per_unit',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'min_stock' => 'decimal:3',
        'cost_per_unit' => 'decimal:2',
    ];

    public function items()
    {
        return $this->belongsToMany(Item::class, 'item_ingredients')
                    ->withPivot('quantity_required')
                    ->withTimestamps();
    }

    public function stocks()
    {
        return $this->hasMany(IngredientStock::class);
    }

    public function stockForPool(string $poolCode): ?IngredientStock
    {
        return $this->stocks
            ->first(fn (IngredientStock $stock) => optional($stock->pool)->code === $poolCode);
    }
}
