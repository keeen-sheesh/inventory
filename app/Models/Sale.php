<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'user_id',
        'cashier_shift_id',
        'subtotal',
        'tax_amount',
        'discount_amount',
        'service_charge_amount',
        'total_amount',
        'total_cost',
        'gross_profit',
        'profit_margin',
        'status',
        'kitchen_status',
        'kitchen_kitchen_status',
        'resto_kitchen_status',
        'order_type',
        'people_count',
        'cards_presented',
        'payment_method_id',
        'paid_at',
        'notes',
        'customer_name',
        'customer_phone',
        'customer_address',
        'room_number',
        'discount_type',
        'discount_value',
        'cash_received',
        'change_due',
        'vatable_total',
        'vat_exempt_total',
        'zero_rated_total',
        'vat_amount',
        'txn_date',
        'txn_sequence',
        'txn_number',
        'invoice_number',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'service_charge_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'gross_profit' => 'decimal:2',
        'profit_margin' => 'decimal:2',
        'cash_received' => 'decimal:2',
        'change_due' => 'decimal:2',
        'paid_at' => 'datetime',
        'people_count' => 'integer',
        'cards_presented' => 'integer',
        'vatable_total' => 'decimal:2',
        'vat_exempt_total' => 'decimal:2',
        'zero_rated_total' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'txn_date' => 'date',
        'txn_sequence' => 'integer',
    ];

    // ========== RELATIONSHIPS ==========
    
    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function paymentMethod()
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function cashierShift()
    {
        return $this->belongsTo(CashierShift::class, 'cashier_shift_id');
    }

    public function saleItems()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function items()
    {
        return $this->belongsToMany(Item::class, 'sale_items')
            ->withPivot('quantity', 'unit_price', 'total_price')
            ->withTimestamps();
    }

    // ========== SCOPES ==========
    
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeReady($query)
    {
        return $query->where('status', 'ready');
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeDineIn($query)
    {
        return $query->where('order_type', 'dine_in');
    }

    // ========== HELPERS ==========

    /**
     * Calculate total cost of goods sold (COGS) for this order
     * Sum of (ingredient.cost_per_unit × recipe_quantity) for all items
     * Uses the CogsCalculator service for accurate unit conversion
     */
    public function calculateTotalCost(): float
    {
        $totalCost = 0.0;

        foreach ($this->saleItems as $item) {
            // Calculate COGS for this line item (quantity × unit COGS)
            $unitCogs = $item->calculateCogs();
            $itemTotalCogs = $unitCogs * $item->quantity;
            $totalCost += $itemTotalCogs;
        }

        return round($totalCost, 2);
    }

    /**
     * Calculate total COGS from all line items
     * This is the sum of (item_cogs × quantity) for each sale item
     */
    public function getTotalCogsAttribute(): float
    {
        return $this->saleItems->sum(function ($item) {
            return ($item->cogs ?? 0) * $item->quantity;
        });
    }

    /**
     * Calculate total profit for this order
     */
    public function getTotalProfitAttribute(): float
    {
        $revenue = $this->total_amount ?? 0;
        $cogs = $this->total_cost ?? 0;
        return round($revenue - $cogs, 2);
    }

    /**
     * Calculate and save COGS, profit, and margin
     * Called when order is completed to store final COGS data
     */
    public function saveCostData(): void
    {
        $totalCost = $this->calculateTotalCost();
        $revenue = $this->total_amount;
        $grossProfit = $revenue - $totalCost;
        $profitMargin = $revenue > 0 ? ($grossProfit / $revenue) * 100 : 0;

        $this->update([
            'total_cost' => round($totalCost, 2),
            'gross_profit' => round($grossProfit, 2),
            'profit_margin' => round($profitMargin, 2),
        ]);
    }

    /**
     * Generate unique invoice number
     * Format: CJ-YYYYMMDD-0001
     */
    public function generateInvoiceNumber(): string
    {
        $date = $this->created_at ? $this->created_at->format('Ymd') : now()->format('Ymd');

        // Get count of orders today
        $todayCount = static::whereDate('created_at', $this->created_at ?? now())
            ->count();

        $invoiceNumber = sprintf('CJ-%s-%04d', $date, $todayCount);

        // Ensure uniqueness
        $counter = $todayCount;
        while (static::where('invoice_number', $invoiceNumber)->exists()) {
            $counter++;
            $invoiceNumber = sprintf('CJ-%s-%04d', $date, $counter);
        }

        return $invoiceNumber;
    }

    public function getFormattedTotalAttribute()
    {
        return '₱' . number_format($this->total_amount, 2);
    }

    public function getOrderNumberAttribute()
    {
        return 'ORD-' . str_pad($this->id, 6, '0', STR_PAD_LEFT);
    }

    public function getTxnNumberAttribute($value)
    {
        if (!empty($value)) {
            return $value;
        }

        if (!$this->txn_date || !$this->txn_sequence) {
            return null;
        }

        return sprintf(
            'TXN-%s-%03d',
            $this->txn_date->format('Ymd'),
            (int) $this->txn_sequence
        );
    }
}
