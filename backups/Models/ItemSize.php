<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ItemSize extends Model
{
    use HasFactory;

    protected $table = 'item_sizes';

    protected $fillable = [
        'item_id',
        'size_id',
        'price',
        'additional_price',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'additional_price' => 'decimal:2',
    ];

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function size()
    {
        return $this->belongsTo(Size::class);
    }
}