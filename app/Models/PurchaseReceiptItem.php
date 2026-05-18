<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseReceiptItem extends Model
{
    protected $fillable = [
        'purchase_receipt_id',
        'ingredient_id',
        'quantity',
        'cost_per_unit',
        'total',
    ];

    protected $casts = [
        'quantity'      => 'integer',
        'cost_per_unit' => 'float',
        'total'         => 'float',
    ];

    public function receipt()
    {
        return $this->belongsTo(PurchaseReceipt::class, 'purchase_receipt_id');
    }

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }
}