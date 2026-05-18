<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id',
        'item_id',
        'kitchen_item_id',
        'quantity',
        'unit_price',
        'total_price',
        'cogs',
        'special_instructions',
        'kitchen_status',
        'kitchen_started_at',
        'kitchen_completed_at',
        'kitchen_type',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
        'cogs' => 'decimal:2',
        'kitchen_started_at' => 'datetime',
        'kitchen_completed_at' => 'datetime',
    ];

    /**
     * Validation: Ensure either item_id OR kitchen_item_id is set, never both
     */
    public static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            // Both cannot be null
            if (is_null($model->item_id) && is_null($model->kitchen_item_id)) {
                throw new \InvalidArgumentException('A SaleItem must have either item_id or kitchen_item_id');
            }

            // Both cannot be set at the same time
            if (!is_null($model->item_id) && !is_null($model->kitchen_item_id)) {
                throw new \InvalidArgumentException('A SaleItem cannot have both item_id and kitchen_item_id');
            }
        });

        static::updating(function ($model) {
            // Both cannot be null
            if (is_null($model->item_id) && is_null($model->kitchen_item_id)) {
                throw new \InvalidArgumentException('A SaleItem must have either item_id or kitchen_item_id');
            }

            // Both cannot be set at the same time
            if (!is_null($model->item_id) && !is_null($model->kitchen_item_id)) {
                throw new \InvalidArgumentException('A SaleItem cannot have both item_id and kitchen_item_id');
            }
        });
    }

    /**
     * Check if this is a kitchen item
     */
    public function isKitchenItem(): bool
    {
        return !is_null($this->kitchen_item_id);
    }

    /**
     * Check if this is a resto item
     */
    public function isRestoItem(): bool
    {
        return !is_null($this->item_id);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    /**
     * Get the kitchen item (if this is a kitchen sale item)
     */
    public function kitchenItem(): BelongsTo
    {
        return $this->belongsTo(KitchenItem::class, 'kitchen_item_id');
    }

    /**
     * Get the resolved item (works for both resto and kitchen items)
     */
    public function getResolvedItem()
    {
        if ($this->kitchen_item_id) {
            return $this->kitchenItem;
        }
        return $this->item;
    }

    /**
     * Calculate COGS for this sale item
     * Uses the CogsCalculator service with options from special_instructions
     */
    public function calculateCogs(): float
    {
        $calculator = new \App\Services\CogsCalculator();
        $options = $this->getCogsOptions();
        
        if ($this->kitchen_item_id && $this->kitchenItem) {
            return $calculator->calculateKitchenItemCogs($this->kitchenItem, $options);
        }
        
        if ($this->item_id && $this->item) {
            return $calculator->calculateItemCogs($this->item, $options);
        }
        
        return 0.0;
    }

    /**
     * Get COGS calculation options from special_instructions
     */
    public function getCogsOptions(): array
    {
        $options = [];
        
        if ($this->special_instructions) {
            // Extract portion type
            if (preg_match('/\[portion:(solo|whole)\]/i', $this->special_instructions, $matches)) {
                $options['portion'] = strtolower($matches[1]);
            }
            
            // Extract size
            if (preg_match('/\[size:([^\]]+)\]/i', $this->special_instructions, $matches)) {
                $options['size'] = $matches[1];
            }
            
            // Extract temperature
            if (preg_match('/\[temp:(hot|iced)\]/i', $this->special_instructions, $matches)) {
                $options['temperature'] = strtolower($matches[1]);
            }
        }
        
        return $options;
    }

    /**
     * Get profit for this line item
     */
    public function getProfitAttribute(): float
    {
        return round(($this->total_price ?? 0) - ($this->cogs ?? 0), 2);
    }

    /**
     * Get profit margin percentage for this line item
     */
    public function getProfitMarginAttribute(): float
    {
        $revenue = $this->total_price ?? 0;
        $cogs = $this->cogs ?? 0;
        
        if ($revenue <= 0) {
            return 0.0;
        }
        
        return round((($revenue - $cogs) / $revenue) * 100, 2);
    }

    /**
     * Get the resolved item name
     */
    public function getItemNameAttribute(): string
    {
        $item = $this->getResolvedItem();
        return $item ? $item->name : 'Unknown Item';
    }

    public static function extractPortion(?string $notes): ?string
    {
        if (!$notes) {
            return null;
        }

        if (preg_match('/^\s*\[portion:(solo|whole)\]\s*/i', $notes, $m)) {
            return strtolower($m[1]);
        }

        return null;
    }

    public static function stripPortionPrefix(?string $notes): ?string
    {
        if ($notes === null) {
            return null;
        }

        return trim((string) preg_replace('/^\s*\[portion:(solo|whole)\]\s*/i', '', $notes));
    }

    public static function applyPortionPrefix(?string $notes, ?string $portion): ?string
    {
        // Strip only the portion tag — preserve [size:…] and [temp:…] tags
        $cleanNotes = trim((string) preg_replace('/^\s*\[portion:(solo|whole)\]\s*/i', '', $notes ?? ''));

        $tags = [];

        if ($portion && in_array($portion, ['solo', 'whole'], true)) {
            $tags[] = '[portion:' . $portion . ']';
        }

        // Re-extract and re-attach size/temp tags that may already be present
        // (passed through from buildSpecialInstructions in PosController)
        if (preg_match('/\[size:[^\]]+\]/i', $cleanNotes, $sm)) {
            $tags[] = $sm[0];
            $cleanNotes = trim(str_replace($sm[0], '', $cleanNotes));
        }
        if (preg_match('/\[temp:[^\]]+\]/i', $cleanNotes, $tm)) {
            $tags[] = $tm[0];
            $cleanNotes = trim(str_replace($tm[0], '', $cleanNotes));
        }

        $parts = array_filter([implode(' ', $tags), $cleanNotes]);
        $combined = trim(implode(' ', array_values($parts)));
        return $combined !== '' ? $combined : null;
    }

    public function getPortionAttribute(): ?string
    {
        return self::extractPortion($this->special_instructions);
    }

    public function getCleanNotesAttribute(): ?string
    {
        return self::cleanNotes($this->special_instructions);
    }
    // special_instructions encoding: "[portion:solo] [size:Grande] [temp:iced] user notes"

    /**
     * Extract size name from special_instructions.
     * e.g. "[size:Grande][temp:iced] Extra shot" → "Grande"
     */
    public static function extractSize(?string $instructions): ?string
    {
        if (!$instructions) return null;
        if (preg_match('/\[size:([^\]]+)\]/i', $instructions, $m)) {
            return trim($m[1]);
        }
        return null;
    }

    /**
     * Extract temperature from special_instructions.
     * e.g. "[size:Grande][temp:iced] Extra shot" → "iced"
     */
    public static function extractTemperature(?string $instructions): ?string
    {
        if (!$instructions) return null;
        if (preg_match('/\[temp:(hot|iced)\]/i', $instructions, $m)) {
            return strtolower($m[1]);
        }
        return null;
    }

    /**
     * Human-readable variant label, e.g. "Grande Iced" or "Tall Hot".
     */
    public static function extractVariantLabel(?string $instructions): ?string
    {
        $size = self::extractSize($instructions);
        $temp = self::extractTemperature($instructions);
        $parts = array_filter([$size, $temp ? ucfirst($temp) : null]);
        return $parts ? implode(' ', array_values($parts)) : null;
    }

    /**
     * Return user-visible notes with ALL encoded tags stripped
     * ([portion:…], [size:…], [temp:…]).
     */
    public static function cleanNotes(?string $instructions): ?string
    {
        if ($instructions === null) return null;
        $cleaned = preg_replace('/\[(portion|size|temp):[^\]]+\]\s*/i', '', $instructions);
        return trim($cleaned) ?: null;
    }

    // Accessors
    public function getSizeNameAttribute(): ?string
    {
        return self::extractSize($this->special_instructions);
    }

    public function getTemperatureAttribute(): ?string
    {
        return self::extractTemperature($this->special_instructions);
    }

    public function getVariantLabelAttribute(): ?string
    {
        return self::extractVariantLabel($this->special_instructions);
    }
}