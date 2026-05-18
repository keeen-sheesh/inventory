<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KitchenCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer'
    ];

    // Relationship with kitchen items
    public function items()
    {
        return $this->hasMany(KitchenItem::class)->orderBy('sort_order', 'asc');
    }

    // Scope for active categories
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    // Default order
    public static function boot()
    {
        parent::boot();

        static::creating(function ($category) {
            if (empty($category->sort_order)) {
                $category->sort_order = self::max('sort_order') + 1;
            }
        });
    }
}

