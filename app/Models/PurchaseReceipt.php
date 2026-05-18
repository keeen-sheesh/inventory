<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseReceipt extends Model
{
    protected $fillable = [
        'receipt_number',
        'supplier_name',
        'receipt_date',
        'notes',
        'inventory_pool_id',
        'user_id',
        'total_amount',
    ];

    protected $casts = [
        'receipt_date' => 'date',
        'total_amount' => 'float',
    ];

    public function items()
    {
        return $this->hasMany(PurchaseReceiptItem::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function pool()
    {
        return $this->belongsTo(InventoryPool::class, 'inventory_pool_id');
    }
}