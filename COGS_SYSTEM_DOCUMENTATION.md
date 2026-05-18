# Restaurant Inventory & Recipe Costing System

## Overview

This system provides automatic COGS (Cost of Goods Sold) calculation, expense tracking, and profit analytics for a restaurant POS system. All calculations are automatic and update in real-time when inventory prices change.

---

## 1. Inventory System

### Ingredient Structure

Each ingredient has the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Ingredient name |
| `unit` | string | Stock unit (kg, g, l, ml, pcs, box, pack) |
| `quantity` | decimal | Current stock quantity |
| `total_price` | decimal | Total purchase price for the quantity |
| `cost_per_unit` | decimal | **Auto-computed**: `total_price / quantity` |
| `pieces_per_box` | integer | Optional: pieces per pack/box |
| `cost_per_piece` | decimal | **Auto-computed**: `total_price / pieces_per_box` |
| `min_stock` | decimal | Minimum stock threshold for alerts |

### Automatic Calculations

```php
// When saving an ingredient:
$ingredient = Ingredient::create([
    'name' => 'Patty',
    'unit' => 'kg',
    'quantity' => 1.0,
    'total_price' => 360.00,  // You provide this
    // cost_per_unit is auto-calculated: 360 / 1 = 360/kg
]);

// For piece-based items:
$buns = Ingredient::create([
    'name' => 'Buns',
    'unit' => 'box',
    'quantity' => 1.0,
    'total_price' => 150.00,
    'pieces_per_box' => 12,
    // cost_per_unit: 150 / 1 = 150/box
    // cost_per_piece: 150 / 12 = 12.5/pc (auto-calculated)
]);
```

---

## 2. Recipe System (Menu Items)

### Recipe Structure

Each menu item can have a recipe with ingredients:

```php
// Create a Burger item
$burger = Item::create([
    'name' => 'Burger',
    'price' => 250.00,
]);

// Add recipe ingredients
$burger->ingredients()->attach($patty->id, [
    'quantity_required' => 0.3,  // 0.3 kg
    'unit' => 'kg',
]);

$burger->ingredients()->attach($buns->id, [
    'quantity_required' => 1,  // 1 piece
    'unit' => 'pcs',
]);
```

### Supported Unit Types

- **Weight**: kg, g, mg, lb, oz
- **Volume**: l, ml, cl, fl_oz, cup, tbsp, tsp
- **Pieces**: pcs, box, pack, dozen

---

## 3. Automatic COGS Calculation

### How It Works

When a recipe is created or updated, COGS is automatically calculated:

```
For each ingredient in recipe:
  - If unit is kg/g → use cost_per_unit
  - If pack with pieces → use cost_per_piece

ingredient_cost = quantity_used × unit_cost
total_cogs = sum of all ingredient_cost
```

### Example Calculation

**Ingredients:**
- Patty: 1kg = ₱360 → cost_per_unit = ₱360/kg
- Buns: 12 pcs = ₱150 → cost_per_piece = ₱12.5/pc

**Burger Recipe:**
- Patty: 0.3kg × ₱360/kg = ₱108
- Buns: 1pc × ₱12.5/pc = ₱12.5

**Total COGS:** ₱120.50

**If selling price is ₱250:**
- Profit = ₱250 - ₱120.50 = ₱129.50
- Profit Margin = (129.50 / 250) × 100 = 51.8%

### Accessing COGS

```php
// Get item COGS
$burger->recipe_cost;  // 120.50

// Get profit amount
$burger->profit_amount;  // 129.50

// Get profit margin percentage
$burger->profit_margin;  // 51.8
```

---

## 4. POS Integration

### When an Order is Created

1. Each sale item's COGS is calculated automatically
2. COGS is stored in `sale_items.cogs` field
3. When order is completed, total COGS is saved to `sales.total_cost`

### Order Profit Calculation

```php
// For each sale item:
$itemCogs = $saleItem->calculateCogs();  // Unit COGS
$totalItemCogs = $itemCogs * $quantity;

// For the entire order:
$totalOrderCogs = sum of all item COGS
$profit = $totalRevenue - $totalOrderCogs
$profitMargin = ($profit / $totalRevenue) × 100
```

### Stored Data

```php
$sale->total_cost;      // Total COGS for the order
$sale->gross_profit;    // Revenue - COGS
$sale->profit_margin;   // Profit margin percentage
```

---

## 5. Reports Integration

### Reports Module Metrics

The Reports module automatically computes:

| Metric | Formula |
|--------|---------|
| **Total Revenue** | `SUM(orders.total_amount)` |
| **Total COGS** | `SUM(orders.total_cost)` |
| **Gross Profit** | `Revenue - COGS` |
| **Profit Margin** | `(Profit / Revenue) × 100` |
| **Cost Percentage** | `(COGS / Revenue) × 100` |

### Available Reports

1. **Dashboard Metrics**
   - Total Revenue, COGS, Gross Profit
   - Profit Margin, Cost Percentage
   - Average Order Value, Average COGS, Average Profit

2. **Revenue vs COGS Chart**
   - Daily breakdown of revenue, COGS, and profit

3. **Profit Margin Trend**
   - Daily profit margin percentage over time

4. **Top Performing Items**
   - Items ranked by gross profit

5. **Low Margin Items**
   - Items with lowest profit margins

6. **Category Performance**
   - Revenue and profit by category

7. **Daily Summary Stats**
   - Daily orders count, revenue, COGS, profit

### CSV Exports

```php
// Order-level COGS report
GET /admin/reports/export-cogs?start_date=2026-03-01&end_date=2026-03-27

// Item-level COGS report
GET /admin/reports/export-item-cogs?start_date=2026-03-01&end_date=2026-03-27
```

---

## 6. Real-Time Updates

### Automatic Recalculation

When an ingredient price changes:

1. `cost_per_unit` is auto-recalculated
2. All menu items using that ingredient have their COGS recalculated
3. Future orders will use the new COGS values

```php
// In InventoryController::updateIngredient()
$ingredient->update(['total_price' => $newPrice]);
// → Triggers recalculation for all affected menu items
```

### Affected Items Log

```
INFO: COGS recalculated for ingredient change
{
  "ingredient_id": 1,
  "ingredient_name": "Patty",
  "affected_items": [
    {"item_name": "Burger", "old_cogs": 120.50, "new_cogs": 125.00}
  ]
}
```

---

## 7. Unit Conversion

### Supported Conversions

| From | To | Factor |
|------|-----|--------|
| g → kg | × 0.001 |
| kg → g | × 1000 |
| ml → l | × 0.001 |
| l → ml | × 1000 |
| pcs → box | 1:1 (configurable via `pieces_per_box`) |

### Example

```php
// Ingredient stored in kg
$cheese = Ingredient::create([
    'unit' => 'kg',
    'cost_per_unit' => 500,  // ₱500/kg
]);

// Recipe uses grams
$burger->ingredients()->attach($cheese->id, [
    'quantity_required' => 100,  // 100g
    'unit' => 'g',
]);

// COGS calculation:
// 100g = 0.1kg
// Cost = 0.1 × 500 = ₱50
```

---

## 8. Database Schema

### New/Modified Tables

**ingredients**
```sql
ALTER TABLE ingredients ADD total_price DECIMAL(12,2);
-- cost_per_unit is auto-calculated
```

**sale_items**
```sql
ALTER TABLE sale_items ADD cogs DECIMAL(12,2);
-- Stores COGS per unit at time of sale
```

---

## 9. Key Classes

### Models

| Model | Purpose |
|-------|---------|
| `Ingredient` | Inventory items with auto cost calculation |
| `Item` | Menu items with recipe COGS calculation |
| `KitchenItem` | Kitchen menu items with COGS |
| `Sale` | Orders with profit tracking |
| `SaleItem` | Order line items with COGS |

### Services

| Service | Purpose |
|---------|---------|
| `CogsCalculator` | Centralized COGS calculation with unit conversion |

### Controllers

| Controller | Purpose |
|------------|---------|
| `InventoryController` | Ingredient management with auto COGS recalc |
| `PosController` | Order creation with COGS calculation |
| `ReportsController` | Profit analytics and reporting |

---

## 10. Usage Examples

### Create Ingredient with Pricing

```php
// Method 1: Provide total_price (recommended)
$patty = Ingredient::create([
    'name' => 'Patty',
    'unit' => 'kg',
    'quantity' => 5.0,
    'total_price' => 1800.00,  // ₱1800 for 5kg
    // cost_per_unit auto-calculated: ₱360/kg
]);

// Method 2: Provide cost_per_unit directly
$cheese = Ingredient::create([
    'name' => 'Cheese',
    'unit' => 'kg',
    'quantity' => 2.0,
    'cost_per_unit' => 500.00,  // ₱500/kg
    'total_price' => 1000.00,   // Auto-calculated
]);
```

### Create Recipe

```php
$burger = Item::create([
    'name' => 'Burger',
    'price' => 250.00,
]);

$burger->ingredients()->attach($patty->id, [
    'quantity_required' => 0.3,
    'unit' => 'kg',
]);

$burger->ingredients()->attach($buns->id, [
    'quantity_required' => 1,
    'unit' => 'pcs',
]);

// Access COGS
echo $burger->recipe_cost;  // ₱120.50
echo $burger->profit_amount;  // ₱129.50
echo $burger->profit_margin;  // 51.8%
```

### Get Reports Data

```php
// In ReportsController
$metrics = $this->calculateKeyMetrics('2026-03-01', '2026-03-27');
// Returns:
// - total_revenue
// - total_cogs
// - gross_profit
// - profit_margin
// - cost_percentage
// - average_order_value
// - average_cogs
// - average_profit
```

---

## 11. Testing

### Run COGS Tests

```bash
php artisan test --filter CogsCalculationTest
```

### Test Scenarios

1. **Burger COGS Calculation** - Verifies the example scenario
2. **Unit Conversion** - Tests g ↔ kg conversion
3. **Piece-based Ingredients** - Tests cost_per_piece calculation

---

## 12. Troubleshooting

### COGS Not Calculating

1. Ensure ingredient has `total_price` or `cost_per_unit` set
2. Ensure recipe has ingredients attached with `quantity_required` and `unit`
3. Check that units are properly normalized (kg, g, pcs, etc.)

### Incorrect COGS Values

1. Verify ingredient `cost_per_unit` is correct
2. Check recipe `quantity_required` matches intended amount
3. Ensure `unit` in recipe matches the measurement system

### Unit Conversion Issues

1. Use standard unit names: kg, g, l, ml, pcs
2. For piece-based items, set `pieces_per_box`
3. Recipe unit should match how you measure the ingredient

---

## Summary

This system provides:

✅ **Automatic COGS calculation** when recipes are created  
✅ **Real-time updates** when ingredient prices change  
✅ **Unit conversion** (kg ↔ g, l ↔ ml, pcs ↔ box)  
✅ **Piece-based costing** for items like buns, napkins  
✅ **POS integration** with per-item COGS tracking  
✅ **Comprehensive reports** with profit analytics  
✅ **CSV exports** for detailed analysis  

All calculations are automatic and connected to the reports dashboard.
