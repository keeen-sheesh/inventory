<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Size extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'display_name',
        'sort_order',
    ];

    // Relationship with items (many-to-many)
    public function items()
    {
        return $this->belongsToMany(Item::class, 'item_sizes')
                    ->withPivot('price', 'additional_price')
                    ->withTimestamps();
    }

    // Relationship with item_sizes
    public function itemSizes()
    {
        return $this->hasMany(ItemSize::class);
    }
}