<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Category;

class Ingredient extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'category_id',
        'unit',
        'pieces_per_box',
        'is_dry',
        'quantity',
        'total_price',
        'min_stock',
        'cost_per_unit',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'min_stock' => 'decimal:3',
        'cost_per_unit' => 'decimal:4',
        'total_price' => 'decimal:2',
        'pieces_per_box' => 'decimal:0',
    ];

    /**
     * Boot method to auto-calculate cost_per_unit when total_price or quantity changes
     */
    public static function boot()
    {
        parent::boot();

        static::saving(function ($ingredient) {
            // Auto-calculate cost_per_unit if total_price and quantity are provided
            if ($ingredient->total_price !== null && $ingredient->quantity > 0) {
                $ingredient->cost_per_unit = round($ingredient->total_price / $ingredient->quantity, 4);
            }
        });
    }

    /**
     * Get cost per piece if pieces_per_box is defined
     */
    public function getCostPerPieceAttribute(): ?float
    {
        if ($this->pieces_per_box && $this->pieces_per_box > 0 && $this->total_price) {
            return round($this->total_price / $this->pieces_per_box, 4);
        }
        return null;
    }

    /**
     * Get the unit cost for COGS calculation
     * Uses cost_per_unit for weight/volume items, cost_per_piece for piece-based items
     */
    public function getUnitCostAttribute(): float
    {
        // If this is a piece-based item (has pieces_per_box), use cost per piece
        if ($this->cost_per_piece !== null) {
            return $this->cost_per_piece;
        }
        return (float) $this->cost_per_unit;
    }

    public function items()
    {
        return $this->belongsToMany(Item::class, 'item_ingredients')
                    ->withPivot('quantity_required', 'unit', 'notes', 'is_main')
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

    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}
