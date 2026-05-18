<?php
// app/Traits/VATCalculations.php

namespace App\Traits;

trait VATCalculations
{
    /**
     * Calculate VAT breakdown for an order
     */
    public function calculateVATBreakdown($items, $subtotal, $discount = 0, $serviceCharge = 0, $taxRate = 12)
    {
        $vatableTotal = 0;
        $vatExemptTotal = 0;
        $zeroRatedTotal = 0;
        
        foreach ($items as $item) {
            $itemTotal = $item['price'] * $item['quantity'];
            
            // Determine VAT type based on source
            if (isset($item['source']) && $item['source'] === 'kitchen') {
                $vatType = $this->getKitchenItemVATType($item['id']);
            } else {
                $vatType = $this->getRegularItemVATType($item['id']);
            }
            
            switch ($vatType) {
                case 'vat_exempt':
                    $vatExemptTotal += $itemTotal;
                    break;
                case 'zero_rated':
                    $zeroRatedTotal += $itemTotal;
                    break;
                case 'vatable':
                default:
                    $vatableTotal += $itemTotal;
                    break;
            }
        }
        
        // Apply discount proportionally to all VAT types
        if ($discount > 0) {
            $discountRatio = $discount / $subtotal;
            $vatableTotal -= $vatableTotal * $discountRatio;
            $vatExemptTotal -= $vatExemptTotal * $discountRatio;
            $zeroRatedTotal -= $zeroRatedTotal * $discountRatio;
        }
        
        // Add service charge to vatable total (service charge is vatable)
        if ($serviceCharge > 0) {
            $vatableTotal += $serviceCharge;
        }

        // Prices are VAT-inclusive. Extract VAT using the standard formula:
        //   VAT amount  = inclusive_amount - (inclusive_amount / (1 + rate/100))
        //   VAT-ex base = inclusive_amount / (1 + rate/100)
        $divisor    = 1 + ($taxRate / 100);   // e.g. 1.12 for 12%
        $vatAmount  = $taxRate > 0
            ? round($vatableTotal - ($vatableTotal / $divisor), 2)
            : 0;
        // vatable_total stored in DB is the VAT-exclusive base for BIR reporting
        $vatExBase  = $taxRate > 0 ? round($vatableTotal / $divisor, 2) : round($vatableTotal, 2);

        return [
            'vatable_total'    => $vatExBase,
            'vat_exempt_total' => round($vatExemptTotal, 2),
            'zero_rated_total' => round($zeroRatedTotal, 2),
            'vat_amount'       => $vatAmount,
        ];
    }
    
    /**
     * Get VAT type for regular item
     */
    private function getRegularItemVATType($itemId)
    {
        return \App\Models\Item::where('id', $itemId)->value('vat_type') ?? 'vatable';
    }
    
    /**
     * Get VAT type for kitchen item
     */
    private function getKitchenItemVATType($itemId)
    {
        return \App\Models\KitchenItem::where('id', $itemId)->value('vat_type') ?? 'vatable';
    }
}