<?php
// app/Models/Item.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'price',
        'category_id',
        'inventory_pool_code',
        'is_available',
        'is_featured',
        'stock_quantity',
        'low_stock_threshold',
        'pricing_type',
        'price_solo',
        'price_whole',
        'sort_order',
        'image',
        'has_sizes',
        'has_recipe', // Add this
    ];

    protected $casts = [
        'is_available' => 'boolean',
        'is_featured' => 'boolean',
        'has_sizes' => 'boolean',
        'has_recipe' => 'boolean', // Add this
        'price' => 'decimal:2',
        'price_solo' => 'decimal:2',
        'price_whole' => 'decimal:2',
        'inventory_pool_code' => 'string',
        'stock_quantity' => 'integer',
        'low_stock_threshold' => 'integer',
        'sort_order' => 'integer'
    ];

    // Relationship with category
    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    // Relationship with sale items
    public function saleItems()
    {
        return $this->hasMany(SaleItem::class);
    }

    // Relationship with sizes
    public function sizes()
    {
        return $this->belongsToMany(Size::class, 'item_sizes')
                    ->withPivot('price', 'additional_price')
                    ->withTimestamps();
    }

    public function itemSizes()
    {
        return $this->hasMany(ItemSize::class);
    }

    // NEW: Relationship with ingredients
    public function ingredients()
    {
        return $this->belongsToMany(Ingredient::class, 'item_ingredients')
                    ->withPivot('quantity_required', 'unit', 'notes')
                    ->withTimestamps();
    }

    // NEW: Check if item has all ingredients defined
    public function getHasRecipeAttribute()
    {
        return $this->ingredients()->count() > 0;
    }

    // NEW: Calculate potential profit margin
    public function getRecipeCostAttribute()
    {
        $totalCost = 0;
        foreach ($this->ingredients as $ingredient) {
            $cost = $ingredient->cost_per_unit * $ingredient->pivot->quantity_required;
            $totalCost += $cost;
        }
        return $totalCost;
    }

    // NEW: Get profit margin
    public function getProfitMarginAttribute()
    {
        $cost = $this->recipe_cost;
        if ($cost <= 0) return 0;
        return (($this->price - $cost) / $this->price) * 100;
    }

    // Scope for items that need recipe setup
    public function scopeNeedsRecipe($query)
    {
        return $query->whereDoesntHave('ingredients');
    }

    // Get display price based on pricing type
    public function getDisplayPriceAttribute()
    {
        if ($this->has_sizes && $this->itemSizes->isNotEmpty()) {
            $minPrice = $this->itemSizes->min('price');
            $maxPrice = $this->itemSizes->max('price');
            
            if ($minPrice == $maxPrice) {
                return '₱' . number_format($minPrice, 2);
            }
            return '₱' . number_format($minPrice, 2) . ' - ₱' . number_format($maxPrice, 2);
        }
        
        if ($this->pricing_type === 'dual') {
            // Return as string for consistency
            return '₱' . number_format($this->price_solo, 2) . ' - ₱' . number_format($this->price_whole, 2);
        }
        
        return '₱' . number_format($this->price, 2);
    }

    // Get available sizes for this item
    public function getAvailableSizesAttribute()
    {
        if (!$this->has_sizes) {
            return collect();
        }
        
        return $this->itemSizes->map(function($itemSize) {
            return [
                'id' => $itemSize->size_id,
                'name' => $itemSize->size->name,
                'display_name' => $itemSize->size->display_name,
                'price' => $itemSize->price,
                'formatted_price' => '₱' . number_format($itemSize->price, 2),
            ];
        });
    }

    // Get min price for items with sizes
    public function getMinPriceAttribute()
    {
        if ($this->has_sizes && $this->itemSizes->isNotEmpty()) {
            return $this->itemSizes->min('price');
        }
        return $this->price;
    }

    // Get max price for items with sizes
    public function getMaxPriceAttribute()
    {
        if ($this->has_sizes && $this->itemSizes->isNotEmpty()) {
            return $this->itemSizes->max('price');
        }
        return $this->price;
    }

    // Check if item has multiple sizes
    public function getHasMultipleSizesAttribute()
    {
        return $this->has_sizes && $this->itemSizes->count() > 0;
    }

    // Default order
    public static function boot()
    {
        parent::boot();

        static::creating(function ($item) {
            if (empty($item->sort_order)) {
                $item->sort_order = self::where('category_id', $item->category_id)->max('sort_order') + 1;
            }
        });
    }
}
