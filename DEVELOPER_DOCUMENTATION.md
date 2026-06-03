# Laravel Restaurant Inventory & POS System - Developer Documentation

**Last Updated**: June 2026  
**System**: Restaurant Inventory Management with COGS Calculation and Point of Sale

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Key Models & Relationships](#key-models--relationships)
3. [API Routes & Endpoints](#api-routes--endpoints)
4. [Services & Business Logic](#services--business-logic)
5. [Events & Observers](#events--observers)
6. [Database Structure](#database-structure)
7. [Authentication & Roles](#authentication--roles)
8. [Key Features](#key-features)

---

## System Architecture

### Overview

This is a **Laravel 11 web application** combining a restaurant POS (Point of Sale) system with a comprehensive inventory management system featuring real-time COGS (Cost of Goods Sold) calculation.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER (Inertia)              │
│              (React frontend integrated with Laravel)       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   ROUTING LAYER                              │
│  (routes/web.php - Role-based middleware routing)           │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┬──────────────┐
        ▼                 ▼                 ▼              ▼
   CONTROLLERS          SERVICES        MODELS        OBSERVERS
   ┌──────────┐       ┌────────┐      ┌────────┐     ┌─────────┐
   │Admin     │       │CogsCalc│      │Sale    │     │Ingredient
   │Cashier   │────→  │Txn.Seq.│  ├─→ │SaleItem│     │Observer │
   │Auth      │       │        │  │   │Item    │     └─────────┘
   │Profile   │       └────────┘  │   │        │
   └──────────┘                    │   └────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
              ┌────────────────┐      ┌──────────────────┐
              │ ELOQUENT ORM   │      │   EVENTS         │
              │  Models        │      │ KitchenOrder*   │
              │ Relationships  │      │ RestoOrder*     │
              └────────────────┘      │ OrderStatus*    │
                    │                 └──────────────────┘
                    ▼
              ┌────────────────┐
              │   DATABASE     │
              │  (MySQL)       │
              └────────────────┘
```

### Core Modules

| Module | Purpose | Key Files |
|--------|---------|-----------|
| **POS** | Point of Sale - Order creation & payment | `PosController.php`, `Sale`, `SaleItem`, `PaymentMethod` |
| **Kitchen** | Kitchen order management & preparation tracking | `KitchenOrderController.php`, `KitchenItem`, `KitchenCategory` |
| **Inventory** | Stock management, recipe definitions, COGS | `InventoryController.php`, `Ingredient`, `IngredientStock` |
| **Cashier** | Shift management & cash handling | `ShiftController.php`, `CashierShift`, `CashierShiftTransaction` |
| **Admin** | System administration, reports, settings | `DashboardController.php`, `ReportsController.php`, `RoleController.php` |
| **Auth** | User authentication & role management | Laravel Breeze (handled in `routes/auth.php`) |

### Technology Stack

- **Framework**: Laravel 11
- **Frontend**: Inertia.js + React (SPA-like experience)
- **Database**: MySQL
- **Real-time**: Laravel Broadcasting (WebSockets for order updates)
- **Authentication**: Laravel Breeze + custom role-based middleware
- **UI Framework**: Tailwind CSS
- **Build Tool**: Vite

---

## Key Models & Relationships

### Core Sales Models

#### **Sale** (Order Header)
```php
// Primary transaction record
attributes: [
    'txn_number'              // Unique transaction number (daily sequence)
    'txn_date'                // Transaction date
    'customer_id'             // Reference to customer
    'payment_method_id'       // Reference to payment method
    'cashier_shift_id'        // Reference to cashier shift
    'subtotal'                // Sum of items before tax/discount
    'tax_amount'              // Calculated tax
    'discount_amount'         // Applied discount
    'service_charge_amount'   // Service charge (optional)
    'total_amount'            // Final total
    'total_cost'              // Sum of COGS (for profit calculation)
    'gross_profit'            // total_amount - total_cost
    'profit_margin'           // (gross_profit / total_amount) * 100
    'status'                  // pending|preparing|ready|completed|cancelled
    'kitchen_status'          // pending|preparing|ready|null (null if no kitchen items)
    'order_type'              // dine_in|takeout|delivery
    'room_number'             // For dine-in orders
    'vatable_total'           // Total amount subject to VAT
    'vat_amount'              // Calculated VAT
    'paid_at'                 // When payment was received
]

relationships: [
    hasMany(SaleItem)         // Line items in this sale
    belongsTo(Customer)       // Customer who placed order
    belongsTo(User)           // User who processed order
    belongsTo(PaymentMethod)  // Payment method used
    belongsTo(CashierShift)   // Shift this sale occurred in
]
```

#### **SaleItem** (Order Line Item)
```php
attributes: [
    'sale_id'                 // Reference to Sale
    'item_id'                 // Reference to Item (restaurant menu item) [NULL for kitchen items]
    'kitchen_item_id'         // Reference to KitchenItem (drinks, etc) [NULL for regular items]
    'quantity'                // Quantity ordered
    'unit_price'              // Price per unit at time of sale
    'total_price'             // quantity × unit_price
    'cogs'                    // Cost of Goods Sold (calculated from recipe)
    'kitchen_status'          // pending|preparing|ready|completed|cancelled
    'kitchen_type'            // kitchen|resto (where item is prepared)
    'special_instructions'    // Customer notes/instructions
    'kitchen_started_at'      // When kitchen began preparing
    'kitchen_completed_at'    // When kitchen finished preparing
]

relationships: [
    belongsTo(Sale)           // Parent sale
    belongsTo(Item)           // Menu item (nullable)
    belongsTo(KitchenItem)    // Kitchen item (nullable)
]

key_logic: [
    • Either item_id OR kitchen_item_id must be set (not both, not neither)
    • COGS is calculated at sale time using CogsCalculator service
    • kitchen_status drives kitchen display system
]
```

### Menu & Recipe Models

#### **Item** (Restaurant Menu Item)
```php
attributes: [
    'name'                    // Item name (e.g., "Burger")
    'description'             // Item description
    'price'                   // Default price
    'category_id'             // Reference to Category
    'is_available'            // Boolean - item available for ordering
    'is_featured'             // Boolean - featured on menu
    'has_sizes'               // Boolean - has multiple size options
    'has_recipe'              // Boolean - has ingredient recipe defined
    'stock_quantity'          // Current stock (if trackable)
    'low_stock_threshold'     // Alert threshold
    'menu_visibility'         // both|resto|kitchen (where shown)
    'inventory_pool_code'     // resto|kitchen (which pool items deduct from)
]

relationships: [
    belongsTo(Category)       // Menu category
    hasMany(SaleItem)         // Sales containing this item
    hasMany(ItemSize)         // Size variants
    belongsToMany(Ingredient) // Recipe ingredients (pivot: item_ingredients)
]

calculated_attributes: [
    getRecipeCostAttribute()  // Returns COGS from CogsCalculator
    getHasRecipeAttribute()   // Checks if ingredients defined
]
```

#### **KitchenItem** (Kitchen Menu - Drinks, Beverages)
```php
attributes: [
    Similar structure to Item but for kitchen-specific items
    'kitchen_category_id'     // Reference to KitchenCategory
]

relationships: [
    belongsTo(KitchenCategory)
    hasMany(KitchenItemSize)  // Size + temperature variants (e.g., Small Hot, Large Iced)
    belongsToMany(Ingredient) // Recipe ingredients (pivot: kitchen_item_ingredients)
    hasMany(SaleItem)
]
```

### Inventory & Costing Models

#### **Ingredient** (Base Stock Item)
```php
attributes: [
    'name'                    // Ingredient name
    'unit'                    // kg|g|l|ml|pcs|box|pack|dozen
    'category_id'             // Category reference
    'quantity'                // Current stock quantity
    'total_price'             // Total cost of current stock
    'cost_per_unit'           // Auto-calculated: total_price / quantity
    'pieces_per_box'          // For piece-based items (e.g., 12 buns per box)
    'cost_per_piece'          // Auto-calculated if pieces_per_box set
    'min_stock'               // Low stock alert threshold
    'is_dry'                  // Boolean flag for dry goods
]

relationships: [
    hasMany(IngredientStock)  // Stock in each pool
    hasMany(InventoryTransaction) // Transaction history
    belongsToMany(Item)       // Items that use this ingredient
    belongsToMany(KitchenItem) // Kitchen items that use this
    belongsTo(Category)
]

auto_calculations: [
    cost_per_unit = total_price / quantity (on save)
    cost_per_piece = total_price / pieces_per_box (accessor)
]
```

#### **IngredientStock** (Pool-Specific Stock)
```php
// Ingredient stock is pool-specific (resto vs kitchen pools can have different stock)
attributes: [
    'ingredient_id'
    'inventory_pool_id'       // resto or kitchen
    'quantity'                // Stock in this pool
    'cost_per_unit'           // Unit cost for this pool
]

relationships: [
    belongsTo(Ingredient)
    belongsTo(InventoryPool)
]
```

#### **InventoryTransaction** (Audit Trail)
```php
// Records every stock movement
attributes: [
    'ingredient_id'
    'inventory_pool_id'
    'quantity_delta'          // +/- quantity change
    'reason'                  // sale|return|loss|waste|transfer|adjustment|receipt
    'reference_type'          // Sale|PurchaseReceipt|StockCountBatch|etc
    'reference_id'            // ID of reference record
    'user_id'                 // Who made the change
    'notes'
    'meta'                    // Additional JSON data
]

relationships: [
    belongsTo(Ingredient)
    belongsTo(InventoryPool)
    belongsTo(User)
]
```

### Purchasing Models

#### **Supplier**
```php
attributes: [
    'name', 'contact_person', 'email', 'phone', 'address'
    'tax_id', 'payment_terms', 'notes', 'is_active'
]

relationships: [
    hasMany(PurchaseOrder)
    belongsToMany(Ingredient) // With pivot data: unit_cost, min_order_qty, lead_time
]
```

#### **PurchaseOrder**
```php
attributes: [
    'po_number'               // Auto-generated: PO-YYYYMM-0001
    'supplier_id'
    'order_date', 'expected_delivery', 'delivery_date'
    'status'                  // draft|ordered|received|cancelled
    'inventory_pool_code'     // resto|kitchen
    'subtotal', 'tax', 'total'
]

relationships: [
    hasMany(PurchaseOrderItem)
    belongsTo(Supplier)
    belongsTo(User, 'created_by')
]
```

#### **PurchaseReceipt** (Received Goods)
```php
attributes: [
    'receipt_number', 'supplier_id', 'receipt_date'
    'inventory_pool_id', 'subtotal', 'tax', 'total'
]

relationships: [
    hasMany(PurchaseReceiptItem)
    belongsTo(Supplier)
    belongsTo(User)
    belongsTo(InventoryPool)
]

important: [
    • PurchaseReceiptItem creation automatically updates IngredientStock
    • InventoryTransaction records are created for audit trail
]
```

### Cash & Session Models

#### **CashierShift** (Daily Shift)
```php
attributes: [
    'user_id'                 // Cashier assigned to shift
    'starting_balance'        // Opening cash
    'total_sales'             // Sum of sales in shift
    'total_expenses'          // Sum of expenses in shift
    'ending_balance'          // Expected ending cash
    'check_in_time'
    'check_out_time'
    'status'                  // open|closed|verified
]

relationships: [
    belongsTo(User)
    hasMany(CashierShiftTransaction)
    hasMany(Sale)             // via cashier_shift_id
]
```

#### **CashierShiftTransaction** (Shift Transactions)
```php
attributes: [
    'shift_id', 'type'        // cash_in|cash_out|expense|adjustment
    'amount', 'description', 'reference_id'
]
```

### Category Models

#### **Category** (Hierarchical)
```php
attributes: [
    'name', 'description'
    'sort_order', 'is_active'
    'parent_id'               // For subcategories
    'is_kitchen_category'     // Flag for kitchen vs resto
]

relationships: [
    hasMany(Item)
    hasMany(Category, 'parent_id') // Subcategories
    belongsTo(Category, 'parent_id') // Parent category
    hasMany(Ingredient)
]

hierarchy: [
    Categories can be nested (parent_id)
    Used for both menu organization and ingredient organization
]
```

---

## API Routes & Endpoints

### Route Organization

All routes use role-based middleware (`role:admin,manager,cashier,etc.`) for access control.

### Admin Routes (`/admin`, requires: admin|manager role)

#### Dashboard & Reports
```
GET    /admin/dashboard           → Admin dashboard with stats
GET    /admin/transactions         → Transaction list
GET    /admin/transactions/{id}    → Transaction detail
GET    /admin/reports              → Reports dashboard
GET    /admin/reports/inventory-valuation
GET    /admin/reports/export-cogs
GET    /admin/reports/transaction-stats
```

#### POS System
```
GET    /admin/pos                  → POS interface
POST   /admin/pos/orders           → Create new order
POST   /admin/orders/{order}/pay   → Mark order as paid
POST   /admin/orders/{order}/ready → Mark order as ready
POST   /admin/orders/{order}/preparing → Mark preparing
POST   /admin/orders/{order}/complete → Complete order
POST   /admin/orders/{order}/cancel → Cancel order

Real-time endpoints (polling):
GET    /admin/pos/menu-updates     → Menu changes
GET    /admin/pos/order-updates    → Order status changes
GET    /admin/pos/menu-data        → Menu item data
GET    /admin/pos/order-data       → Order data
```

#### Inventory Management
```
GET    /admin/inventory/                         → Inventory dashboard
GET    /admin/inventory/ingredients              → List ingredients
GET    /admin/inventory/stats                    → Inventory statistics
POST   /admin/inventory/ingredients              → Create ingredient
PUT    /admin/inventory/ingredients/{ingredient} → Update ingredient
DELETE /admin/inventory/ingredients/{ingredient} → Delete ingredient
POST   /admin/inventory/add-stock                → Add stock to ingredient
POST   /admin/inventory/bulk-update-stock        → Bulk update stock

Recipe Management:
GET    /admin/inventory/items-with-recipes      → Items with recipes
GET    /admin/inventory/items/{item}/recipe     → Get item recipe
POST   /admin/inventory/items/{item}/recipe     → Save/update recipe
GET    /admin/inventory/items/{item}/check-availability → Check ingredient availability

Stock Operations:
GET    /admin/inventory/stock-value             → Current stock valuation
POST   /admin/inventory/update-stock            → Update stock quantity
GET    /admin/inventory/low-stock-alerts        → Low stock alerts

Stock Returns:
GET    /admin/inventory/stock-returns           → List returns
POST   /admin/inventory/stock-returns           → Create return

Stock Take (Audit):
GET    /admin/inventory/stock-takes             → List stock takes
POST   /admin/inventory/stock-takes             → Submit stock take

Stock Loss:
GET    /admin/inventory/stock-losses            → List losses
POST   /admin/inventory/stock-losses            → Record loss

Stock Transfer:
GET    /admin/inventory/stock-transfers         → List transfers
POST   /admin/inventory/stock-transfers         → Transfer between pools

Audit & Reports:
GET    /admin/inventory/audit-trail             → Audit trail
POST   /admin/inventory/stock-audit-import      → Import audit
GET    /admin/inventory/wastage                 → Wastage records
POST   /admin/inventory/wastage                 → Record wastage
```

#### Food Menu Management
```
GET    /admin/foods                             → Food categories page
GET    /admin/food-categories                   → List food categories (API)
POST   /admin/food-categories                   → Create category
PUT    /admin/food-categories/{category}        → Update category
DELETE /admin/food-categories/{category}        → Delete category
POST   /admin/food-categories/{category}/toggle-status
POST   /admin/food-categories/update-order      → Reorder categories

GET    /admin/food-items                        → List food items
POST   /admin/food-items                        → Create food item
PUT    /admin/food-items/{item}                 → Update food item
DELETE /admin/food-items/{item}                 → Delete food item
POST   /admin/food-items/{item}/toggle-status   → Toggle availability
POST   /admin/food-items/{item}/toggle-featured → Toggle featured
POST   /admin/food-items/update-order           → Reorder items
PUT    /admin/food-items/{item}/update-stock    → Update stock
DELETE /admin/food-items/clear-all              → Clear all items
```

#### Kitchen Menu Management
```
GET    /admin/kitchen-items                     → Kitchen items list
POST   /admin/kitchen-items                     → Create kitchen item
PUT    /admin/kitchen-items/{item}              → Update kitchen item
DELETE /admin/kitchen-items/{item}              → Delete kitchen item
POST   /admin/kitchen-items/{item}/toggle-status
POST   /admin/kitchen-items/update-order

GET    /admin/kitchen-categories                → Kitchen categories list
GET    /admin/kitchen-categories/api            → API endpoint
POST   /admin/kitchen-categories                → Create category
PUT    /admin/kitchen-categories/{category}     → Update category
DELETE /admin/kitchen-categories/{category}     → Delete category
POST   /admin/kitchen-categories/{category}/toggle-status
POST   /admin/kitchen-categories/update-order
```

#### Item Sizes
```
GET    /admin/items/{item}/sizes                → Get item sizes and variants
```

#### Kitchen Order Management
```
GET    /admin/kitchen/                          → Kitchen display interface
GET    /admin/kitchen/orders                    → Get kitchen orders (API)
GET    /admin/kitchen/check-new                 → Poll for new orders
POST   /admin/kitchen/orders/{order}/start      → Start preparing
POST   /admin/kitchen/orders/{order}/ready      → Mark as ready
```

#### Resto Order Monitor (Clean Kitchen)
```
GET    /admin/resto/                            → Resto order monitor UI
GET    /admin/resto/check-new                   → Poll for new orders
POST   /admin/resto/orders/{order}/start        → Start preparing
POST   /admin/resto/orders/{order}/ready        → Mark ready
POST   /admin/resto/orders/{order}/complete     → Complete order
```

#### Role Management
```
GET    /admin/roles                             → Roles page
POST   /admin/roles/users                       → Create user
POST   /admin/roles/users/{user}/toggle-active  → Activate/deactivate
DELETE /admin/roles/users/{user}                → Delete user
```

#### Settings
```
GET    /admin/settings                          → Settings page
POST   /admin/settings                          → Update settings
POST   /admin/settings/clear-cache              → Clear cache
GET    /admin/settings/inventory-audit          → Inventory audit page
GET    /admin/settings/inventory-audit/export   → Export audit CSV
POST   /admin/settings/danger/{action}          → Dangerous operations
```

### Cashier Routes (`/cashier`, requires: cashier|resto|admin|manager role)

#### POS (Same as Admin POS)
```
GET    /cashier/pos                             → POS interface
POST   /cashier/pos/orders                      → Create order
[same order status endpoints as admin]
```

#### Shifts (cashier role only)
```
GET    /cashier/shifts/current                  → Current shift info
POST   /cashier/shifts/check-in                 → Start shift
POST   /cashier/shifts/check-out                → End shift
GET    /cashier/shifts/{shift}/receipt          → Shift receipt
```

#### Shift Transactions
```
POST   /cashier/transactions                    → Create transaction (middleware: cashier.shift.open)
```

### Authentication Routes
```
GET    /                                        → Home (redirects based on role)
GET    /dashboard                               → Generic dashboard (redirects based on role)
POST   /manager/verify                          → Verify manager password
GET    /keep-alive                              → Session keep-alive (polling)
GET    /csrf-token                              → Get fresh CSRF token
```

---

## Services & Business Logic

### CogsCalculator Service

**Location**: `app/Services/CogsCalculator.php`

Handles automatic COGS (Cost of Goods Sold) calculation for menu items.

```php
class CogsCalculator {
    
    /**
     * Calculate COGS for a menu Item
     * @param Item $item
     * @param array $options - portion multiplier options
     * @return float - total COGS
     */
    public function calculateItemCogs(Item $item, array $options = []): float
    {
        // 1. Load all ingredients for this item
        // 2. For each ingredient:
        //    - Get quantity required (from pivot)
        //    - Apply portion multiplier if provided
        //    - Get unit cost (per piece or per unit)
        //    - Convert units if necessary using UNIT_CONVERSIONS
        //    - Calculate: quantity × cost = ingredient_cost
        // 3. Sum all ingredient costs
        // 4. Return total COGS
    }
    
    /**
     * Unit conversion system
     * Supports weight (kg, g, mg, lb, oz)
     *         volume (l, ml, cl, fl_oz, cup, tbsp, tsp)
     *         pieces (pcs, box, pack, dozen)
     */
    private const UNIT_CONVERSIONS = [...]
}
```

**How COGS Is Used**:
1. When creating a `SaleItem`, `CogsCalculator::calculateItemCogs()` is called
2. Result is stored in `SaleItem.cogs` field
3. Sum of `SaleItem.cogs` for all items in order → `Sale.total_cost`
4. `Sale.gross_profit = Sale.total_amount - Sale.total_cost`
5. `Sale.profit_margin = (gross_profit / total_amount) × 100`

**Key Unit Conversions**:
- Weight: 1 kg = 1000 g = 2.205 lb = 35.274 oz
- Volume: 1 l = 1000 ml = 100 cl = 33.814 fl_oz = 4.227 cup
- Pieces: 1 box = 12 pcs (or configurable)

### TxnSequenceService

**Location**: `app/Services/TxnSequenceService.php`

Generates unique daily transaction numbers and sequences.

```php
class TxnSequenceService {
    
    /**
     * Get next sequence number for a given date
     * Creates daily_txn_sequences record if needed
     * @param Carbon $date
     * @return int - next sequence number (1, 2, 3, ...)
     */
    public function getNextSequence(Carbon $date): int
    {
        // 1. Check daily_txn_sequences table for date
        // 2. If exists, increment and return
        // 3. If not exists, create with sequence = 1 and return 1
    }
    
    /**
     * Generate formatted txn_number
     * @param int $sequence, Carbon $date
     * @return string - format: YYYYMMDD-0001
     */
    public function formatTxnNumber(int $sequence, Carbon $date): string
    {
        return $date->format('Ymd') . '-' . str_pad($sequence, 4, '0', STR_PAD_LEFT);
    }
}
```

---

## Events & Observers

### Events (Real-time Broadcasting)

Events are fired when orders are created or status changes, enabling real-time updates via WebSocket broadcast.

#### **KitchenOrderCreated** Event
```php
// Fired when Sale with kitchen items is created
// Broadcasts to: kitchen.orders channel

broadcastWith(): [
    'id' => order.id,
    'txn_number' => order.txn_number,
    'order_type' => order.order_type,
    'kitchen_status' => order.kitchen_status,
    'total_amount' => order.total_amount,
    'items' => [ { id, name, quantity, kitchen_status, kitchen_type, notes } ]
]
```

#### **KitchenOrderStatusChanged** Event
```php
// Fired when kitchen_status changes
// Broadcasts to: kitchen.orders channel
```

#### **RestoOrderCreated** Event
```php
// Fired when Sale with resto kitchen items is created
// Broadcasts to: resto.orders channel

broadcastWith(): [
    Similar to KitchenOrderCreated but for resto kitchen
]
```

#### **RestoOrderStatusChanged** Event
```php
// Fired when resto status changes
// Broadcasts to: resto.orders channel
```

### Observers

#### **IngredientObserver**
```php
// Currently minimal - observers don't auto-create stock pools
// Stock creation is handled manually in InventoryController::storeIngredient()

// Future extension point for ingredient-related logic
```

**Note**: No observers are currently registered for Sale or SaleItem models. All business logic is in controllers and services.

---

## Database Structure

### Key Tables

#### `sales`
Core transaction record. Stores order header information.
```sql
-- Key columns
id (PK)
txn_number (unique, daily) → YYYYMMDD-0001
txn_date (date) → date portion of transaction
txn_sequence (int) → sequence # for the day
customer_id (FK)
user_id (FK) → cashier/user who processed
payment_method_id (FK)
cashier_shift_id (FK)
status (enum) → pending|preparing|ready|completed|cancelled
kitchen_status (enum) → pending|preparing|ready|completed|null
order_type (enum) → dine_in|takeout|delivery
subtotal, tax_amount, discount_amount, service_charge_amount (decimal)
total_amount, total_cost, gross_profit, profit_margin (decimal)
vatable_total, vat_amount (decimal) → VAT calculations
room_number (string, optional) → For dine-in
paid_at (datetime, nullable)
notes (text, nullable)
```

#### `sale_items`
Line items in a sale. Each item in an order.
```sql
id (PK)
sale_id (FK)
item_id (FK, nullable) → Regular menu item
kitchen_item_id (FK, nullable) → Kitchen item (drinks)
quantity (int)
unit_price, total_price, cogs (decimal)
kitchen_status (enum)
kitchen_type (enum) → kitchen|resto
special_instructions (text)
kitchen_started_at, kitchen_completed_at (datetime)
```

#### `items`
Restaurant menu items.
```sql
id (PK)
name, description (string)
price (decimal)
category_id (FK)
is_available, is_featured, has_sizes, has_recipe (boolean)
stock_quantity, low_stock_threshold (int)
menu_visibility (enum) → both|resto|kitchen
inventory_pool_code (string) → resto|kitchen
sort_order (int)
```

#### `kitchen_items`
Kitchen-specific items (drinks, beverages).
```sql
Similar to items but kitchen-focused
kitchen_category_id (FK)
```

#### `ingredients`
Base stock items (raw materials, ingredients).
```sql
id (PK)
name, unit (string)
category_id (FK)
quantity, cost_per_unit (decimal)
total_price, min_stock (decimal)
pieces_per_box (int, nullable)
is_dry (boolean)
```

#### `ingredient_stocks`
Pool-specific stock levels (resto vs kitchen).
```sql
id (PK)
ingredient_id (FK)
inventory_pool_id (FK) → resto or kitchen
quantity, cost_per_unit (decimal)
```

#### `inventory_pools`
Stock pool definitions.
```sql
id (PK)
code (string) → resto|kitchen
name (string)
```

#### `inventory_transactions`
Audit trail for all stock movements.
```sql
id (PK)
ingredient_id (FK)
inventory_pool_id (FK)
quantity_delta (decimal) → +/- amount
reason (enum) → sale|return|loss|waste|transfer|adjustment|receipt
reference_type (string) → Sale|PurchaseReceipt|etc
reference_id (int)
user_id (FK)
notes, meta (JSON)
```

#### `item_ingredients` (Pivot)
Recipe definition - items and their ingredients.
```sql
id (PK)
item_id (FK)
ingredient_id (FK)
quantity_required (decimal)
unit (string)
notes (text, nullable)
is_main (boolean) → Is primary ingredient
```

#### `kitchen_item_ingredients` (Pivot)
Recipe for kitchen items.
```sql
Similar to item_ingredients for KitchenItem
```

#### `categories`
Hierarchical categories.
```sql
id (PK)
name, description (string)
parent_id (FK, nullable) → For subcategories
sort_order (int)
is_active (boolean)
is_kitchen_category (boolean)
```

#### `cashier_shifts`
Daily cashier shift records.
```sql
id (PK)
user_id (FK)
starting_balance, ending_balance (decimal)
total_sales, total_expenses (decimal)
check_in_time, check_out_time (datetime)
status (enum) → open|closed|verified
```

#### `users`
System users.
```sql
id (PK)
name, email, password (string)
role (enum) → admin|manager|cashier|resto|kitchen|kitchen_resto|customer
is_active (boolean)
last_login_at (datetime)
email_verified_at (datetime)
```

#### `daily_txn_sequences`
Daily transaction sequence tracking.
```sql
id (PK)
date (date) → Sequence date
sequence (int) → Next sequence number
```

### Database Relationships Diagram

```
users ─────────────────┐
                       │
                       ├─→ sales ─────────────→ sale_items ┐
                       │      │                              │
                       │      ├─→ customers                  │
                       │      ├─→ payment_methods            │
                       │      └─→ cashier_shifts             │
                       │                                      │
                       ├─→ cashier_shifts                     │
                       │      └─→ cashier_shift_transactions │
                       │                                      │
                       └─→ inventory_transactions             │
                                                              │
                        ┌──────────────────────────────────┘
                        │
                        ├─→ items ─────→ categories
                        │        ├─→ item_sizes ─→ sizes
                        │        └─→ item_ingredients ─→ ingredients
                        │
                        ├─→ kitchen_items ─────→ kitchen_categories
                        │                 └─→ kitchen_item_ingredients ─→ ingredients
                        │
                        ├─→ ingredients ─────→ ingredient_stocks ─→ inventory_pools
                        │             └─→ inventory_transactions ─→ inventory_pools
                        │
                        ├─→ suppliers ─→ purchase_orders ─→ purchase_order_items
                        │                                        └─→ ingredients
                        │
                        └─→ purchase_receipts ─→ purchase_receipt_items ─→ ingredients
```

---

## Authentication & Roles

### Role System

Seven user roles with specific permissions and access routes:

| Role | Description | Primary Routes | Key Permissions |
|------|-------------|-----------------|-----------------|
| **admin** | Full system access | `/admin/*` | All operations, user management, settings |
| **manager** | Manager (similar to admin) | `/admin/*` | Inventory, reports, some admin functions |
| **cashier** | Cashier at POS terminal | `/cashier/pos`, `/cashier/shifts` | Create orders, manage shift |
| **resto** | Resto staff (dine-in coordinator) | `/cashier/pos`, `/admin/resto` | Orders, kitchen monitor |
| **kitchen** | Kitchen staff | `/admin/kitchen` | Kitchen orders, preparation tracking |
| **kitchen_resto** | Hybrid role (kitchen + resto) | `/admin/kitchen`, `/admin/kitchen-items` | Both kitchen and resto access |
| **customer** | Customer (future feature) | `/menu` | Browse menu, place orders |

### Role-Based Access Control

Implemented via middleware in `routes/web.php`:

```php
// Example: Only admin/manager can access admin routes
Route::middleware(['auth', 'verified', 'role:admin,manager'])->prefix('admin')->group(function() {
    Route::get('/dashboard', [DashboardController::class, 'index']);
});

// Example: Cashier can access POS
Route::middleware(['auth', 'verified', 'role:cashier,resto,admin,manager'])->prefix('cashier')->group(function() {
    Route::get('/pos', [PosController::class, 'index']);
});
```

### Role Middleware

**Location**: Custom middleware in `app/Http/Middleware/`

Checks if authenticated user has required role. Multiple roles use pipe-separated syntax: `role:admin,manager`.

### User Model Role Methods

```php
class User {
    // Check specific role
    public function hasRole(string $role): bool
    
    // Query scope
    public function scopeRole($query, $role)
    
    // Convenience methods
    public function isAdmin(): bool
    public function isManager(): bool
    public function isResto(): bool
    public function isKitchen(): bool
    public function isCashier(): bool
}
```

### Authentication Flow

1. User logs in via Breeze (`routes/auth.php`)
2. `last_login_at` is updated
3. User redirected to role-specific dashboard via `routes/web.php` root route
4. Session extended for active users via `extend.session` middleware (5-minute POS/Kitchen polling)

---

## Key Features

### 1. Automatic COGS Calculation

**Purpose**: Track profitability by calculating cost of goods sold per transaction.

**How It Works**:
1. Define ingredients with unit cost (auto-calculated)
2. Create recipe for menu items by selecting ingredients and quantities
3. When order is created, `CogsCalculator` computes cost
4. `SaleItem.cogs` = sum of (ingredient_quantity × ingredient_unit_cost)
5. Aggregate data shows profit margin per transaction

**Example**:
```
Burger Recipe:
  - Patty (0.3 kg @ ₱360/kg) = ₱108
  - Buns (1 pc @ ₱12.50/pc) = ₱12.50
  - Lettuce (0.05 kg @ ₱100/kg) = ₱5
  Total COGS = ₱125.50

Sale Price: ₱250
Gross Profit: ₱250 - ₱125.50 = ₱124.50 (49.8% margin)
```

**Key Features**:
- Automatic calculation on order creation
- Supports multiple units (kg, g, l, ml, pcs, etc.)
- Unit conversion between recipe units and purchase units
- Real-time updates when ingredient costs change
- Historical COGS tracking per sale for profit analysis

### 2. Kitchen Order Management

**Purpose**: Display and track food preparation in real-time.

**Components**:
- **Kitchen Display**: Shows orders awaiting preparation
- **Kitchen Items**: Drinks, beverages prepared by kitchen
- **Order Status Tracking**: pending → preparing → ready
- **Broadcasting**: Real-time updates via WebSocket events

**Order Types**:
- **Kitchen Orders**: Food items going to main kitchen
- **Resto Orders**: Drinks going to resto (clean kitchen)

**Status Flow**:
```
pending → (kitchen starts) → preparing → (kitchen ready) → ready → (paid)
```

### 3. Inventory Management

**Purpose**: Track stock levels, costs, and movements.

**Features**:
- **Multi-pool Inventory**: Separate stock for resto and kitchen
- **Stock Levels**: Track quantity per ingredient per pool
- **Cost Tracking**: Total price and cost per unit
- **Low Stock Alerts**: Automatic alerts for items below minimum
- **Audit Trail**: Every stock movement logged with reason
- **Stock Takes**: Physical count reconciliation
- **Stock Transfers**: Move stock between pools
- **Stock Returns**: Track returned goods
- **Wastage Tracking**: Record lost/spoiled inventory

**Transactions**:
```
Type: sale|return|loss|waste|transfer|adjustment|receipt
Every transaction creates InventoryTransaction record
Enables full audit trail and variance analysis
```

### 4. POS (Point of Sale) System

**Purpose**: Order creation and payment processing.

**Features**:
- **Menu Display**: Browse items by category
- **Size Variants**: Select size/temperature for items
- **Special Instructions**: Add notes to items
- **Discount/Tax**: Apply discounts, automatic VAT
- **Multiple Payment Methods**: Track payment type
- **Order Types**: Dine-in, takeout, delivery
- **Order Status**: Track from pending to completed
- **Real-time Updates**: Kitchen orders update live
- **Ready Orders Queue**: Show orders ready for pickup/payment

**Order Types**:
- **Dine-in**: Table-based, can have unpaid balance
- **Takeout**: Quick transaction
- **Delivery**: Customer address tracking

### 5. Cashier Shift Management

**Purpose**: Daily cash reconciliation and transaction tracking.

**Features**:
- **Shift Check-in**: Cashier opens shift with starting balance
- **Shift Transactions**: Track cash in/out and expenses
- **Daily Reconciliation**: Compare expected vs actual ending balance
- **Receipt Generation**: Shift summary with sales and expenses
- **Shift History**: Track all cashier activities

**Shift Workflow**:
```
Check-in (starting_balance)
  ↓
Process Sales (total_sales)
  ↓
Record Expenses (total_expenses)
  ↓
Check-out (ending_balance verification)
```

### 6. Reporting & Analytics

**Purpose**: Financial and operational insights.

**Reports**:
- **Inventory Valuation**: Current stock value at cost
- **COGS Report**: Cost of goods sold by period
- **Profit Analysis**: Gross profit and margin by item/category
- **Transaction Statistics**: Sales count, average transaction value
- **Usage Report**: Ingredient usage patterns
- **Stock Count**: Physical audit discrepancies

### 7. Expense Tracking

**Purpose**: Non-inventory expenses for profit analysis.

**Features**:
- **Expense Categories**: Utilities, maintenance, supplies, etc.
- **Payment Methods**: Cash, card, bank transfer
- **Date Tracking**: When expense occurred
- **Shift Association**: Optional shift tracking
- **Notes**: Description of expense

### 8. Supplier & Purchase Management

**Purpose**: Track inventory replenishment.

**Features**:
- **Supplier Records**: Contact, terms, tax info
- **Purchase Orders**: Formal order creation with PO number
- **Purchase Receipts**: Goods received tracking
- **Ingredient Linking**: Supplier pricing for ingredients
- **Stock Updates**: Automated stock increase on receipt

**Workflow**:
```
Purchase Order (planned purchase)
  ↓
Purchase Receipt (goods received)
  ↓
Stock Update (IngredientStock quantity increases)
  ↓
InventoryTransaction (audit record created)
```

### 9. Recipe System

**Purpose**: Define how menu items are made from ingredients.

**Features**:
- **Ingredient Selection**: Choose ingredients for menu item
- **Quantity Required**: How much per serving
- **Unit Specification**: kg, g, ml, pcs, etc.
- **Notes**: Special instructions (e.g., "drain water")
- **Automatic COGS**: Calculated from recipe
- **Availability Check**: Ensure all ingredients in stock

**Recipe Saving**:
```php
// Associate ingredients with item
$item->ingredients()->attach($ingredient_id, [
    'quantity_required' => 0.3,
    'unit' => 'kg',
    'notes' => 'Drained weight',
    'is_main' => true
]);

// COGS automatically calculated via CogsCalculator
$cogs = $item->recipe_cost; // ₱125.50
```

### 10. Multi-location Inventory Pools

**Purpose**: Support multiple kitchen/service areas with separate stock.

**Pools**:
- **Resto Pool**: Main restaurant inventory
- **Kitchen Pool**: Kitchen-specific items

**How It Works**:
- Ingredients exist in global Ingredient table
- Each ingredient has stock in each pool via IngredientStock
- Sale items deduct from specific pool based on menu_visibility
- Transfers allowed between pools

**Example**:
```
Tomato ingredient:
  - Resto pool: 50 kg (cost: ₱5,000)
  - Kitchen pool: 20 kg (cost: ₱2,000)

When resto order is placed → deduct from resto pool
When kitchen item is placed → deduct from kitchen pool
```

---

## Common Development Tasks

### Add a New Menu Item

```php
// 1. Create Item
$item = Item::create([
    'name' => 'Spaghetti',
    'price' => 150.00,
    'category_id' => $category->id,
    'inventory_pool_code' => 'resto',
    'is_available' => true,
    'has_recipe' => false,
]);

// 2. Add Recipe (optional)
$item->ingredients()->attach([
    $noodles->id => ['quantity_required' => 0.2, 'unit' => 'kg'],
    $sauce->id => ['quantity_required' => 0.1, 'unit' => 'kg'],
]);

// 3. Add Size Variants (optional)
ItemSize::create([
    'item_id' => $item->id,
    'size_id' => Size::where('name', 'Regular')->first()->id,
    'price' => 150.00,
]);
```

### Create a Purchase Receipt

```php
// 1. Create receipt
$receipt = PurchaseReceipt::create([
    'receipt_number' => 'REC-2026-001',
    'supplier_id' => $supplier->id,
    'receipt_date' => now(),
    'inventory_pool_id' => InventoryPool::where('code', 'resto')->first()->id,
]);

// 2. Add items
PurchaseReceiptItem::create([
    'purchase_receipt_id' => $receipt->id,
    'ingredient_id' => $tomato->id,
    'quantity' => 50,
    'unit_cost' => 100.00,
    'total_cost' => 5000.00,
]);

// 3. Save automatically:
// - Updates IngredientStock quantity
// - Updates Ingredient total_price and cost_per_unit
// - Creates InventoryTransaction for audit
```

### Process a Sale

```php
// See PosController::store() and createSaleWithDailyTxn()
// 1. Validate items and calculate costs
// 2. Get next transaction sequence
// 3. Create Sale record with calculated totals
// 4. Create SaleItem for each item (COGS calculated)
// 5. Update IngredientStock (deduct recipe ingredients)
// 6. Create InventoryTransactions (audit trail)
// 7. Dispatch KitchenOrderCreated event (broadcast to kitchen)
// 8. Return created sale with details
```

### Query Sales with Profitability

```php
$sales = Sale::with('saleItems')
    ->whereDate('txn_date', now())
    ->get();

foreach ($sales as $sale) {
    echo "Sale #{$sale->txn_number}";
    echo "  Total: ₱{$sale->total_amount}";
    echo "  Cost: ₱{$sale->total_cost}";
    echo "  Profit: ₱{$sale->gross_profit}";
    echo "  Margin: {$sale->profit_margin}%";
}
```

---

## Best Practices & Tips

### COGS Calculation

- ✅ Always define ingredients with `total_price` and `quantity` for accurate `cost_per_unit`
- ✅ For piece-based items, set `pieces_per_box` to get `cost_per_piece`
- ✅ Use consistent units across recipes (or rely on unit conversion)
- ⚠️ Changing ingredient cost retroactively doesn't update past sales (intentional for audit)
- ✅ Use `cost_per_unit` attribute to verify calculated costs

### Inventory Management

- ✅ Define `min_stock` levels to get low-stock alerts
- ✅ Use stock takes regularly for physical reconciliation
- ✅ Document wastage to track variances
- ✅ Use stock transfers to redistribute between pools
- ✅ Review InventoryTransaction audit trail for discrepancies

### Order Processing

- ✅ Ensure cashier shift is open before processing sales
- ✅ Verify payment method exists and is active
- ✅ Check inventory availability before confirming orders
- ⚠️ Don't manually update kitchen_status - use controller endpoints
- ✅ Use `order_type` to control order workflow (dine-in vs takeout)

### Real-time Updates

- ✅ Kitchen display polls for updates every 5 seconds
- ✅ POS checks order updates for ready orders
- ✅ Session kept alive via `/keep-alive` endpoint (5-minute interval)
- ⚠️ Don't assume WebSocket delivery - implement fallback polling
- ✅ Use event broadcasting for critical updates (kitchen orders)

### Database Performance

- ✅ Use eager loading (`with()`) to avoid N+1 queries
- ✅ Add indexes on frequently filtered columns (status, date, pool_id)
- ✅ Archive old sales data periodically for reporting efficiency
- ✅ Batch operations where possible (bulk updates)
- ⚠️ Avoid complex joins with recursive categories

### Security

- ✅ All routes require authentication (`auth` middleware)
- ✅ Role-based access control enforced via `role` middleware
- ✅ Manager password verification for sensitive operations
- ✅ CSRF token validation on all POST/PUT/DELETE
- ⚠️ Don't expose sensitive data (costs, margins) to customer role

---

## Troubleshooting Common Issues

### Sales Not Appearing in Kitchen Display

1. Check if sale has `kitchen_status` set (not null)
2. Verify items have `kitchen_type` assigned (kitchen or resto)
3. Check kitchen display is subscribed to correct broadcast channel
4. Verify WebSocket server is running (if using reverb)
5. Fall back to polling via `/admin/kitchen/check-new` endpoint

### COGS Calculation Incorrect

1. Verify ingredient `cost_per_unit` is correct (auto-calculated from total_price/quantity)
2. Check recipe has all ingredients attached
3. Verify quantities in pivot table are correct
4. Ensure units match or will be converted
5. Use `CogsCalculator::calculateItemCogs()` directly to debug

### Inventory Stock Mismatch

1. Review InventoryTransaction audit trail for discrepancies
2. Run stock take to reconcile physical count
3. Check if stock transfers are correctly applied
4. Verify purchase receipts updated stock
5. Look for accidental bulk updates or manual edits

### User Access Denied

1. Verify user role is in route middleware (e.g., `role:admin,manager`)
2. Check `is_active` flag is true on user record
3. Verify JWT token is valid (if using API)
4. Clear browser cookies and re-authenticate
5. Check role string matches exactly (case-sensitive)

---

## File Structure Reference

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── Admin/
│   │   │   ├── PosController.php        → Order creation & payment
│   │   │   ├── InventoryController.php  → Stock & recipe management
│   │   │   ├── KitchenOrderController.php → Kitchen display
│   │   │   ├── RestoOrderController.php  → Resto monitor
│   │   │   ├── DashboardController.php   → Admin dashboard
│   │   │   ├── ReportsController.php     → Reporting
│   │   │   ├── RoleController.php        → User management
│   │   │   └── SettingsController.php    → System settings
│   │   ├── Cashier/
│   │   │   ├── ShiftController.php       → Shift check-in/out
│   │   │   ├── ShiftTransactionController.php
│   │   │   └── DashboardController.php
│   │   └── ProfileController.php
│   ├── Middleware/
│   │   └── role.php                     → Role-based access control
│   └── Requests/
├── Models/
│   ├── Sale.php, SaleItem.php
│   ├── Item.php, KitchenItem.php
│   ├── Ingredient.php, IngredientStock.php
│   ├── Category.php, KitchenCategory.php
│   ├── Supplier.php, PurchaseOrder.php, PurchaseReceipt.php
│   ├── CashierShift.php, CashierShiftTransaction.php
│   ├── User.php, Customer.php
│   ├── PaymentMethod.php, Expense.php
│   ├── InventoryPool.php, InventoryTransaction.php
│   ├── Size.php, ItemSize.php, KitchenItemSize.php
│   └── Setting.php
├── Services/
│   ├── CogsCalculator.php               → COGS calculation logic
│   └── TxnSequenceService.php           → Transaction sequence
├── Events/
│   ├── KitchenOrderCreated.php
│   ├── KitchenOrderStatusChanged.php
│   ├── RestoOrderCreated.php
│   └── RestoOrderStatusChanged.php
├── Observers/
│   └── IngredientObserver.php           → Ingredient lifecycle
├── Traits/
│   └── VATCalculations.php              → VAT calculation logic
└── Providers/
    └── AppServiceProvider.php

routes/
├── web.php                              → Main application routes
├── auth.php                             → Authentication routes
└── console.php

database/
├── migrations/                          → Schema definitions
├── factories/                           → Model factories for testing
└── seeders/                             → Database seeders

resources/
├── js/                                  → React components
├── css/                                 → Tailwind CSS
└── views/                               → Blade templates (Inertia)
```

---

## Related Documentation

- [COGS System Documentation](./COGS_SYSTEM_DOCUMENTATION.md)
- [Sale Creation Analysis](./backups/Sale-creation-analysis.md)
- Laravel Documentation: https://laravel.com/docs
- Inertia.js Documentation: https://inertiajs.com/

---

**End of Document**

For additional questions or contributions, please refer to the team lead or project maintainer.
