<?php
// app/Models/KitchenItemSize.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KitchenItemSize extends Model
{
    protected $fillable = [
        'kitchen_item_id',
        'size_id',
        'temperature',
        'price',
    ];

    protected $casts = [
        'price' => 'decimal:2',
    ];

    public function kitchenItem()
    {
        return $this->belongsTo(KitchenItem::class);
    }

    public function size()
    {
        return $this->belongsTo(Size::class);
    }

    // Convenience: human-readable label e.g. "Grande Iced"
    public function getLabelAttribute(): string
    {
        $sizeName = $this->size->display_name ?? $this->size->name ?? '';
        return match($this->temperature) {
            'hot'  => "{$sizeName} Hot",
            'iced' => "{$sizeName} Iced",
            default => $sizeName,
        };
    }
}