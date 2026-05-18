<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockCountBatchItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_count_batch_id',
        'ingredient_id',
        'current_stock',
        'actual_counted_stock',
        'variance',
    ];

    protected $casts = [
        'current_stock' => 'decimal:3',
        'actual_counted_stock' => 'decimal:3',
        'variance' => 'decimal:3',
    ];

    public function batch()
    {
        return $this->belongsTo(StockCountBatch::class, 'stock_count_batch_id');
    }

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }
}
