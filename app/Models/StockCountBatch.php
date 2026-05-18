<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockCountBatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'inventory_pool_code',
        'or_number',
        'count_date',
        'user_id',
        'notes',
    ];

    protected $casts = [
        'count_date' => 'date',
    ];

    public function items()
    {
        return $this->hasMany(StockCountBatchItem::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
