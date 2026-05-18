<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryPool extends Model
{
    use HasFactory;

    public const RESTO = 'resto';
    public const KITCHEN = 'kitchen';

    protected $fillable = [
        'code',
        'name',
    ];

    public function ingredientStocks()
    {
        return $this->hasMany(IngredientStock::class);
    }
}

