<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'sort_order',
        'is_active',
        'parent_id'
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer'
    ];

    // Relationship with items
    public function items()
    {
        return $this->hasMany(Item::class)->orderBy('sort_order', 'asc');
    }

    // Relationship with subcategories
    public function subcategories()
    {
        return $this->hasMany(Category::class, 'parent_id')->orderBy('sort_order', 'asc');
    }

    // Relationship with parent category
    public function parent()
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    // Relationship with all children (recursive)
    public function children()
    {
        return $this->hasMany(Category::class, 'parent_id')->with('children');
    }

    // Scope for main categories (no parent)
    public function scopeMainCategories($query)
    {
        return $query->whereNull('parent_id');
    }

    // Scope for subcategories
    public function scopeSubcategories($query)
    {
        return $query->whereNotNull('parent_id');
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