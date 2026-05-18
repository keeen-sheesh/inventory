<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KitchenItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'price',
        'kitchen_category_id',
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
        'has_recipe',
    ];

    protected $casts = [
        'is_available' => 'boolean',
        'is_featured' => 'boolean',
        'has_sizes' => 'boolean',
        'has_recipe' => 'boolean',
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
        return $this->belongsTo(KitchenCategory::class, 'kitchen_category_id');
    }

    // Relationship with sale items
    public function saleItems()
    {
        return $this->hasMany(SaleItem::class);
    }

    // Relationship with ingredients
    public function ingredients()
    {
        return $this->belongsToMany(Ingredient::class, 'kitchen_item_ingredients')
                    ->withPivot('quantity_required', 'unit', 'notes', 'is_main')
                    ->withTimestamps();
    }

    // Relationship with size+temperature variants
    public function sizes()
    {
        return $this->hasMany(KitchenItemSize::class)
                    ->with('size')
                    ->orderByRaw("CASE temperature WHEN 'hot' THEN 0 WHEN 'iced' THEN 1 ELSE 2 END")
                    ->orderBy('size_id');
    }

    /**
     * Return size variants formatted for the POS frontend.
     * Groups by size and lists available temperatures with prices.
     *
     * Result shape:
     * [
     *   { size_id, size_name, display_name, variants: [{ id, temperature, price }] }
     * ]
     */
    public function getSizeVariantsForPosAttribute(): array
    {
        $grouped = [];
        foreach ($this->sizes as $sv) {
            $sizeId = $sv->size_id;
            if (!isset($grouped[$sizeId])) {
                $grouped[$sizeId] = [
                    'size_id'      => $sizeId,
                    'size_name'    => $sv->size->name ?? '',
                    'display_name' => $sv->size->display_name ?? $sv->size->name ?? '',
                    'variants'     => [],
                ];
            }
            $grouped[$sizeId]['variants'][] = [
                'id'          => $sv->id,
                'temperature' => $sv->temperature,
                'price'       => (float) $sv->price,
                'label'       => $sv->label,
            ];
        }
        return array_values($grouped);
    }

    // Check if item has all ingredients defined
    public function getHasRecipeAttribute()
    {
        return $this->ingredients()->count() > 0;
    }

    // Calculate COGS using the CogsCalculator service
    public function getRecipeCostAttribute()
    {
        $calculator = new \App\Services\CogsCalculator();
        return $calculator->calculateKitchenItemCogs($this);
    }

    // Calculate COGS with specific options (size, temperature, etc.)
    public function getRecipeCostWithOptionsAttribute(array $options = [])
    {
        $calculator = new \App\Services\CogsCalculator();
        return $calculator->calculateKitchenItemCogs($this, $options);
    }

    // Get profit margin based on COGS
    public function getProfitMarginAttribute()
    {
        $cost = $this->recipe_cost;
        if ($cost <= 0) return 0;
        return (($this->price - $cost) / $this->price) * 100;
    }

    // Get profit amount
    public function getProfitAmountAttribute()
    {
        return round($this->price - $this->recipe_cost, 2);
    }

    // Get display price based on pricing type
    public function getDisplayPriceAttribute()
    {
        if ($this->pricing_type === 'dual') {
            return '₱' . number_format($this->price_solo, 2) . ' - ₱' . number_format($this->price_whole, 2);
        }
        
        return '₱' . number_format($this->price, 2);
    }

    // Default order
    public static function boot()
    {
        parent::boot();

        static::creating(function ($item) {
            if (empty($item->sort_order)) {
                $item->sort_order = self::where('kitchen_category_id', $item->kitchen_category_id)->max('sort_order') + 1;
            }
            // Default to kitchen pool
            if (empty($item->inventory_pool_code)) {
                $item->inventory_pool_code = InventoryPool::KITCHEN;
            }
        });
    }
}
