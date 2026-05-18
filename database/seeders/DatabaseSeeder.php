<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Item;
use App\Models\Customer;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Ingredient;
use App\Models\Category;
use App\Models\PaymentMethod;
use App\Models\Expense;
use App\Models\Table;
use App\Models\Size;
use App\Models\ItemSize;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ========== DELETE ALL EXISTING DATA ==========
        SaleItem::query()->delete();
        Sale::query()->delete();
        ItemSize::query()->delete();
        Item::query()->delete();
        Size::query()->delete();
        Category::query()->delete();
        User::query()->delete();
        Customer::query()->delete();
        Ingredient::query()->delete();
        PaymentMethod::query()->delete();
        Expense::query()->delete();
        Table::query()->delete();

        // ========== CREATE USERS ==========
        $users = [
            [
                'name' => 'Admin User',
                'email' => 'admin@cjbrew.com',
                'password' => Hash::make('password123'),
                'role' => 'admin',
                'email_verified_at' => now(),
            ],
            [
                'name' => 'Cashier User',
                'email' => 'cashier@cjbrew.com',
                'password' => Hash::make('password123'),
                'role' => 'resto',
                'email_verified_at' => now(),
            ],
            [
                'name' => 'Kitchen User',
                'email' => 'kitchen@cjbrew.com',
                'password' => Hash::make('password123'),
                'role' => 'kitchen',
                'email_verified_at' => now(),
            ],
            [
                'name' => 'Customer User',
                'email' => 'customer@example.com',
                'password' => Hash::make('password123'),
                'role' => 'customer',
                'email_verified_at' => now(),
            ],
        ];
        
        foreach ($users as $userData) {
            User::create($userData);
        }

        // ========== CREATE SIZES ==========
        $sizes = [
            // Coffee sizes
            ['name' => 'Tall', 'display_name' => 'Tall (12oz)', 'sort_order' => 1],
            ['name' => 'Grande', 'display_name' => 'Grande (16oz)', 'sort_order' => 2],
            ['name' => 'Venti', 'display_name' => 'Venti (20oz)', 'sort_order' => 3],
            
            // Soda sizes
            ['name' => 'Regular', 'display_name' => 'Regular', 'sort_order' => 1],
            ['name' => 'Large', 'display_name' => 'Large', 'sort_order' => 2],
            
            // Food sizes
            ['name' => 'Solo', 'display_name' => 'Solo (1-3 persons)', 'sort_order' => 1],
            ['name' => 'Whole', 'display_name' => 'Whole (3-6 persons)', 'sort_order' => 2],
            
            // Set meal sizes
            ['name' => '4-6 persons', 'display_name' => '4-6 persons', 'sort_order' => 1],
            ['name' => '6-8 persons', 'display_name' => '6-8 persons', 'sort_order' => 2],
            ['name' => '8-10 persons', 'display_name' => '8-10 persons', 'sort_order' => 3],
        ];
        
        foreach ($sizes as $sizeData) {
            Size::create($sizeData);
        }

        // Get size IDs for reference
        $sizeTall = Size::where('name', 'Tall')->first();
        $sizeGrande = Size::where('name', 'Grande')->first();
        $sizeVenti = Size::where('name', 'Venti')->first();
        $sizeRegular = Size::where('name', 'Regular')->first();
        $sizeLarge = Size::where('name', 'Large')->first();
        $sizeSolo = Size::where('name', 'Solo')->first();
        $sizeWhole = Size::where('name', 'Whole')->first();
        $size4_6 = Size::where('name', '4-6 persons')->first();
        $size6_8 = Size::where('name', '6-8 persons')->first();
        $size8_10 = Size::where('name', '8-10 persons')->first();

        // ========== CREATE CATEGORIES ==========
        $categories = [
            // Food Categories
            ['name' => 'Rice (4-5 persons)', 'is_active' => true, 'sort_order' => 1, 'description' => 'Rice dishes good for 4-5 persons'],
            ['name' => 'Soup and Salad', 'is_active' => true, 'sort_order' => 2, 'description' => 'Fresh soups and salads'],
            ['name' => 'Appetizer', 'is_active' => true, 'sort_order' => 3, 'description' => 'Starters and finger foods'],
            ['name' => 'Burgers & Sandwich', 'is_active' => true, 'sort_order' => 4, 'description' => 'Burgers and sandwiches with fries'],
            ['name' => 'Casa Jedliana Soup', 'is_active' => true, 'sort_order' => 5, 'description' => 'Signature soups'],
            ['name' => 'Salad', 'is_active' => true, 'sort_order' => 6, 'description' => 'Fresh garden salads'],
            ['name' => 'Pasta', 'is_active' => true, 'sort_order' => 7, 'description' => 'Pasta dishes'],
            ['name' => 'Noodles', 'is_active' => true, 'sort_order' => 8, 'description' => 'Asian noodle dishes'],
            ['name' => 'Side dish', 'is_active' => true, 'sort_order' => 9, 'description' => 'Small side dishes'],
            ['name' => 'Pork', 'is_active' => true, 'sort_order' => 10, 'description' => 'Pork dishes'],
            ['name' => 'Chicken', 'is_active' => true, 'sort_order' => 11, 'description' => 'Chicken dishes'],
            ['name' => 'Fish & Seafoods', 'is_active' => true, 'sort_order' => 12, 'description' => 'Fish and seafood dishes'],
            ['name' => 'Vegetables', 'is_active' => true, 'sort_order' => 13, 'description' => 'Vegetable dishes'],
            ['name' => 'Rice in a bowl', 'is_active' => true, 'sort_order' => 14, 'description' => 'Rice bowl dishes'],
            ['name' => 'Set Meals', 'is_active' => true, 'sort_order' => 15, 'description' => 'Family set meals'],
            ['name' => 'American Breakfast', 'is_active' => true, 'sort_order' => 16, 'description' => 'American style breakfast'],
            ['name' => 'Filipino Breakfast', 'is_active' => true, 'sort_order' => 17, 'description' => 'Traditional Filipino breakfast'],
            ['name' => 'Breakfast Side dish', 'is_active' => true, 'sort_order' => 18, 'description' => 'Breakfast sides'],
            
            // Beverage Categories
            ['name' => 'Coffee Based', 'is_active' => true, 'sort_order' => 19, 'description' => 'Hot and iced coffee drinks'],
            ['name' => 'Milk Based', 'is_active' => true, 'sort_order' => 20, 'description' => 'Milk-based beverages'],
            ['name' => 'Frappe', 'is_active' => true, 'sort_order' => 21, 'description' => 'Blended frozen drinks'],
            ['name' => 'Soda', 'is_active' => true, 'sort_order' => 22, 'description' => 'Carbonated drinks'],
            ['name' => 'Add Ons', 'is_active' => true, 'sort_order' => 23, 'description' => 'Beverage add-ons'],
            ['name' => 'Beverages', 'is_active' => true, 'sort_order' => 24, 'description' => 'Other beverages'],
        ];
        
        foreach ($categories as $cat) {
            Category::create($cat);
        }

        // Get category IDs
        $riceCategory = Category::where('name', 'Rice (4-5 persons)')->first();
        $soupSaladCategory = Category::where('name', 'Soup and Salad')->first();
        $appetizerCategory = Category::where('name', 'Appetizer')->first();
        $burgerCategory = Category::where('name', 'Burgers & Sandwich')->first();
        $casaSoupCategory = Category::where('name', 'Casa Jedliana Soup')->first();
        $saladCategory = Category::where('name', 'Salad')->first();
        $pastaCategory = Category::where('name', 'Pasta')->first();
        $noodlesCategory = Category::where('name', 'Noodles')->first();
        $sideDishCategory = Category::where('name', 'Side dish')->first();
        $porkCategory = Category::where('name', 'Pork')->first();
        $chickenCategory = Category::where('name', 'Chicken')->first();
        $seafoodCategory = Category::where('name', 'Fish & Seafoods')->first();
        $vegetablesCategory = Category::where('name', 'Vegetables')->first();
        $riceBowlCategory = Category::where('name', 'Rice in a bowl')->first();
        $setMealsCategory = Category::where('name', 'Set Meals')->first();
        $americanBreakfastCategory = Category::where('name', 'American Breakfast')->first();
        $filipinoBreakfastCategory = Category::where('name', 'Filipino Breakfast')->first();
        $breakfastSideCategory = Category::where('name', 'Breakfast Side dish')->first();
        $coffeeCategory = Category::where('name', 'Coffee Based')->first();
        $milkCategory = Category::where('name', 'Milk Based')->first();
        $frappeCategory = Category::where('name', 'Frappe')->first();
        $sodaCategory = Category::where('name', 'Soda')->first();
        $addOnsCategory = Category::where('name', 'Add Ons')->first();
        $beveragesCategory = Category::where('name', 'Beverages')->first();

        // ========== HELPER FUNCTION TO CREATE ITEM WITH SIZES ==========
        $createItemWithSizes = function($name, $description, $categoryId, $sizesWithPrices, $stockQuantity = 50, $lowStockThreshold = 10) {
            $item = Item::create([
                'name' => $name,
                'description' => $description,
                'category_id' => $categoryId,
                'is_available' => true,
                'has_sizes' => true,
                'price' => null,
                'stock_quantity' => $stockQuantity,
                'low_stock_threshold' => $lowStockThreshold,
                'pricing_type' => 'single',
            ]);

            foreach ($sizesWithPrices as $sizeData) {
                ItemSize::create([
                    'item_id' => $item->id,
                    'size_id' => $sizeData['size_id'],
                    'price' => $sizeData['price'],
                ]);
            }

            return $item;
        };

        // ========== HELPER FUNCTION FOR SINGLE SIZE ITEMS ==========
        $createSingleSizeItem = function($name, $description, $categoryId, $price, $stockQuantity = 50, $lowStockThreshold = 10) {
            return Item::create([
                'name' => $name,
                'description' => $description,
                'category_id' => $categoryId,
                'is_available' => true,
                'has_sizes' => false,
                'price' => $price,
                'stock_quantity' => $stockQuantity,
                'low_stock_threshold' => $lowStockThreshold,
                'pricing_type' => 'single',
            ]);
        };

        // ========== HELPER FUNCTION FOR DUAL PRICE ITEMS (Solo/Whole) ==========
        $createDualPriceItem = function($name, $description, $categoryId, $priceSolo, $priceWhole, $stockQuantity = 20, $lowStockThreshold = 5) {
            return Item::create([
                'name' => $name,
                'description' => $description,
                'category_id' => $categoryId,
                'is_available' => true,
                'has_sizes' => false,
                'price' => $priceSolo,
                'price_solo' => $priceSolo,
                'price_whole' => $priceWhole,
                'stock_quantity' => $stockQuantity,
                'low_stock_threshold' => $lowStockThreshold,
                'pricing_type' => 'dual',
            ]);
        };

        // ========== COFFEE BASED - UPDATED WITH CORRECT PRICES FROM PDF ==========
        $coffeeItems = [
            [
                'name' => 'Americano',
                'description' => 'Espresso with hot water',
                'sizes' => [
                    ['size_id' => $sizeTall->id, 'price' => 115],
                    ['size_id' => $sizeGrande->id, 'price' => 140],
                    ['size_id' => $sizeVenti->id, 'price' => 155],
                ]
            ],
            [
                'name' => 'Americano Honey',
                'description' => 'Espresso with honey and hot water',
                'sizes' => [
                    ['size_id' => $sizeTall->id, 'price' => 125],
                    ['size_id' => $sizeGrande->id, 'price' => 150],
                    ['size_id' => $sizeVenti->id, 'price' => 165],
                ]
            ],
            [
                'name' => 'Cafe Latte',
                'description' => 'Espresso with steamed milk',
                'sizes' => [
                    ['size_id' => $sizeTall->id, 'price' => 155],
                    ['size_id' => $sizeGrande->id, 'price' => 170],
                    ['size_id' => $sizeVenti->id, 'price' => 185],
                ]
            ],
            [
                'name' => 'Cappuccino Latte',
                'description' => 'Espresso with steamed milk and foam',
                'sizes' => [
                    ['size_id' => $sizeTall->id, 'price' => 155],
                    ['size_id' => $sizeGrande->id, 'price' => 170],
                    ['size_id' => $sizeVenti->id, 'price' => 185],
                ]
            ],
            [
                'name' => 'Spanish Latte',
                'description' => 'Espresso with condensed milk',
                'sizes' => [
                    ['size_id' => $sizeTall->id, 'price' => 160],
                    ['size_id' => $sizeGrande->id, 'price' => 175],
                    ['size_id' => $sizeVenti->id, 'price' => 190],
                ]
            ],
            [
                'name' => 'Caramel Macchiato',
                'description' => 'Espresso with vanilla, steamed milk and caramel',
                'sizes' => [
                    ['size_id' => $sizeTall->id, 'price' => 185],
                    ['size_id' => $sizeGrande->id, 'price' => 210],
                    ['size_id' => $sizeVenti->id, 'price' => 225],
                ]
            ],
            [
                'name' => 'White Chocolate',
                'description' => 'White chocolate with espresso',
                'sizes' => [
                    ['size_id' => $sizeTall->id, 'price' => 175],
                    ['size_id' => $sizeGrande->id, 'price' => 190],
                    ['size_id' => $sizeVenti->id, 'price' => 205],
                ]
            ],
            [
                'name' => 'Cafe Mocha',
                'description' => 'Espresso with chocolate and steamed milk',
                'sizes' => [
                    ['size_id' => $sizeTall->id, 'price' => 175],
                    ['size_id' => $sizeGrande->id, 'price' => 190],
                    ['size_id' => $sizeVenti->id, 'price' => 205],
                ]
            ],
            [
                'name' => 'French Vanilla Latte',
                'description' => 'Espresso with French vanilla syrup',
                'sizes' => [
                    ['size_id' => $sizeTall->id, 'price' => 190],
                    ['size_id' => $sizeGrande->id, 'price' => 205],
                    ['size_id' => $sizeVenti->id, 'price' => 220],
                ]
            ],
            [
                'name' => 'Salted Caramel',
                'description' => 'Espresso with salted caramel syrup',
                'sizes' => [
                    ['size_id' => $sizeTall->id, 'price' => 175],
                    ['size_id' => $sizeGrande->id, 'price' => 190],
                    ['size_id' => $sizeVenti->id, 'price' => 205],
                ]
            ],
            [
                'name' => 'Dirty Matcha',
                'description' => 'Matcha with espresso shot',
                'sizes' => [
                    ['size_id' => $sizeTall->id, 'price' => 200],
                    ['size_id' => $sizeGrande->id, 'price' => 225],
                    ['size_id' => $sizeVenti->id, 'price' => 250],
                ]
            ],
            [
                'name' => 'Biscoff Latte',
                'description' => 'Espresso with Biscoff syrup',
                'sizes' => [
                    ['size_id' => $sizeTall->id, 'price' => 200],
                    ['size_id' => $sizeGrande->id, 'price' => 225],
                    ['size_id' => $sizeVenti->id, 'price' => 250],
                ]
            ],
            [
                'name' => 'Coffee Jelly',
                'description' => 'Coffee with jelly',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 170],
                    ['size_id' => $sizeVenti->id, 'price' => 195],
                ]
            ],
        ];

        foreach ($coffeeItems as $item) {
            $createItemWithSizes(
                $item['name'],
                $item['description'],
                $coffeeCategory->id,
                $item['sizes'],
                50,
                15
            );
        }

        // ========== MILK BASED - UPDATED WITH CORRECT PRICES FROM YOUR TABLE ==========
        $milkItems = [
            [
                'name' => 'White Mocha',
                'description' => 'White chocolate mocha',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 120],
                    ['size_id' => $sizeVenti->id, 'price' => 145],
                ]
            ],
            [
                'name' => 'Signature Hot Mocha',
                'description' => 'Signature hot mocha',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 125],
                    ['size_id' => $sizeVenti->id, 'price' => 150],
                ]
            ],
            [
                'name' => 'Milky Caramel',
                'description' => 'Caramel milk drink',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 125],
                    ['size_id' => $sizeVenti->id, 'price' => 150],
                ]
            ],
            [
                'name' => 'Pure Matcha',
                'description' => 'Pure matcha green tea',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 140],
                    ['size_id' => $sizeVenti->id, 'price' => 165],
                ]
            ],
            [
                'name' => 'Milky Strawberry',
                'description' => 'Strawberry milk drink',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 130],
                    ['size_id' => $sizeVenti->id, 'price' => 155],
                ]
            ],
            [
                'name' => 'Milky Choco Lava',
                'description' => 'Chocolate lava milk drink',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 140],
                    ['size_id' => $sizeVenti->id, 'price' => 165],
                ]
            ],
            [
                'name' => 'Choco Hazelnut',
                'description' => 'Chocolate hazelnut milk drink',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 150],
                    ['size_id' => $sizeVenti->id, 'price' => 165],
                ]
            ],
            [
                'name' => 'Strawberry Matcha',
                'description' => 'Strawberry and matcha',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 155],
                    ['size_id' => $sizeVenti->id, 'price' => 180],
                ]
            ],
            [
                'name' => 'Milky Blueberry',
                'description' => 'Blueberry milk drink',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 130],
                    ['size_id' => $sizeVenti->id, 'price' => 155],
                ]
            ],
            [
                'name' => 'Milky Biscoff',
                'description' => 'Biscoff milk drink',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 175],
                    ['size_id' => $sizeVenti->id, 'price' => 200],
                ]
            ],
        ];

        foreach ($milkItems as $item) {
            $createItemWithSizes(
                $item['name'],
                $item['description'],
                $milkCategory->id,
                $item['sizes'],
                40,
                12
            );
        }

        // ========== FRAPPE - KEEP EXISTING ==========
        $frappeItems = [
            [
                'name' => 'Strawberry Cream',
                'description' => 'Strawberry cream frappe',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 155],
                    ['size_id' => $sizeVenti->id, 'price' => 180],
                ]
            ],
            [
                'name' => 'Blueberry Cream',
                'description' => 'Blueberry cream frappe',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 155],
                    ['size_id' => $sizeVenti->id, 'price' => 180],
                ]
            ],
            [
                'name' => 'Red Velvet Frappe',
                'description' => 'Red velvet frappe',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 170],
                    ['size_id' => $sizeVenti->id, 'price' => 195],
                ]
            ],
            [
                'name' => 'Sweet Green Matcha',
                'description' => 'Sweet matcha frappe',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 185],
                    ['size_id' => $sizeVenti->id, 'price' => 200],
                ]
            ],
            [
                'name' => 'Cookies & Cream',
                'description' => 'Cookies and cream frappe',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 185],
                    ['size_id' => $sizeVenti->id, 'price' => 200],
                ]
            ],
            [
                'name' => 'Choco Delight',
                'description' => 'Chocolate frappe',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 190],
                    ['size_id' => $sizeVenti->id, 'price' => 225],
                ]
            ],
            [
                'name' => 'Java Chip Frappe',
                'description' => 'Java chip frappe',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 200],
                    ['size_id' => $sizeVenti->id, 'price' => 235],
                ]
            ],
            [
                'name' => 'Biscoff Frappe',
                'description' => 'Biscoff frappe',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 245],
                    ['size_id' => $sizeVenti->id, 'price' => 275],
                ]
            ],
            [
                'name' => 'Green Matcha Espresso',
                'description' => 'Matcha with espresso frappe',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 250],
                    ['size_id' => $sizeVenti->id, 'price' => 285],
                ]
            ],
            [
                'name' => 'Almond Mocha Espresso',
                'description' => 'Almond mocha with espresso frappe',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 250],
                    ['size_id' => $sizeVenti->id, 'price' => 285],
                ]
            ],
            [
                'name' => 'Java Chip Espresso',
                'description' => 'Java chip with espresso frappe',
                'sizes' => [
                    ['size_id' => $sizeGrande->id, 'price' => 250],
                    ['size_id' => $sizeVenti->id, 'price' => 285],
                ]
            ],
        ];

        foreach ($frappeItems as $item) {
            $createItemWithSizes(
                $item['name'],
                $item['description'],
                $frappeCategory->id,
                $item['sizes'],
                35,
                10
            );
        }

        // ========== SODA ==========
        $sodaItems = [
            [
                'name' => 'Green Apple Soda',
                'description' => 'Green apple flavored soda',
                'sizes' => [
                    ['size_id' => $sizeRegular->id, 'price' => 115],
                    ['size_id' => $sizeLarge->id, 'price' => 130],
                ]
            ],
            [
                'name' => 'Lychee Soda',
                'description' => 'Lychee flavored soda',
                'sizes' => [
                    ['size_id' => $sizeRegular->id, 'price' => 115],
                    ['size_id' => $sizeLarge->id, 'price' => 130],
                ]
            ],
            [
                'name' => 'Lemon Soda',
                'description' => 'Lemon flavored soda',
                'sizes' => [
                    ['size_id' => $sizeRegular->id, 'price' => 115],
                    ['size_id' => $sizeLarge->id, 'price' => 130],
                ]
            ],
            [
                'name' => 'Strawberry Soda',
                'description' => 'Strawberry flavored soda',
                'sizes' => [
                    ['size_id' => $sizeRegular->id, 'price' => 120],
                    ['size_id' => $sizeLarge->id, 'price' => 135],
                ]
            ],
            [
                'name' => 'Blueberry Soda',
                'description' => 'Blueberry flavored soda',
                'sizes' => [
                    ['size_id' => $sizeRegular->id, 'price' => 120],
                    ['size_id' => $sizeLarge->id, 'price' => 135],
                ]
            ],
        ];

        foreach ($sodaItems as $item) {
            $createItemWithSizes(
                $item['name'],
                $item['description'],
                $sodaCategory->id,
                $item['sizes'],
                60,
                15
            );
        }

        // ========== RICE (4-5 persons) ==========
        $riceItems = [
            ['name' => 'Platter Rice', 'price' => 160],
            ['name' => 'Garlic Rice', 'price' => 190],
            ['name' => 'Young Chow Rice', 'price' => 240],
            ['name' => 'Mongolian Fried Rice', 'price' => 260],
            ['name' => 'Pineapple Fried Rice', 'price' => 280],
            ['name' => 'Pork Thai Glazed Fried Rice', 'price' => 280],
            ['name' => 'Thai Shrimp Fried Rice', 'price' => 280],
        ];
        
        foreach ($riceItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                null,
                $riceCategory->id,
                $item['price'],
                50,
                10
            );
        }

        // ========== APPETIZER / SOUP AND SALAD ==========
        $appetizerItems = [
            ['name' => 'Lava Fries', 'description' => 'Creamy cheese and bacon on top of the fries', 'price' => 180],
            ['name' => 'Assorted Finger Food', 'description' => 'Casa Jedliana Signature (2-3 persons) Taste of spicy and garlic mayo', 'price' => 220],
            ['name' => 'Calamar', 'description' => 'Squid coated with butter and garlic mayo dip sauce', 'price' => 190],
            ['name' => 'Cheese Loaded Fries', 'description' => 'Fries loaded with ground beef with mozzarella melted cheese on top', 'price' => 210],
            ['name' => 'CJ Special Finger Food', 'description' => 'Bacon, fish fillet, calamari, tempura, fries (2-3 persons) with CJ dressing sauce', 'price' => 280],
            ['name' => 'Salmon Sashimi', 'description' => 'Served with fresh wasabi, ginger, kikkoman soy sauce and lemon', 'price' => 320],
        ];
        
        foreach ($appetizerItems as $item) {
            // Add to Soup and Salad
            $createSingleSizeItem(
                $item['name'],
                $item['description'],
                $soupSaladCategory->id,
                $item['price'],
                30,
                8
            );
            
            // Add to Appetizer
            $createSingleSizeItem(
                $item['name'],
                $item['description'],
                $appetizerCategory->id,
                $item['price'],
                30,
                8
            );
        }

        // ========== BURGERS & SANDWICH ==========
        $burgerItems = [
            ['name' => 'Ham and Egg Sandwich', 'description' => '2 Slice Bread Pan, Ham, Egg, Lettuce, Japanese mayo, chips or fries', 'price' => 160],
            ['name' => 'Cheese Chicken Burger', 'description' => 'Chicken fillet, burger buns, burger sauce with fries and melted cheese', 'price' => 180],
            ['name' => 'CJ Special Sandwich', 'description' => 'Ham, poached egg, bacon with béarnaise sauce', 'price' => 220],
            ['name' => 'Clubhouse Sandwich', 'description' => 'Ham, egg, crabstick, Japanese mayo, tomato, cucumber and fries', 'price' => 200],
            ['name' => 'Surf & Turf Burger', 'description' => 'Shrimp tenderloin, beef, burger buns, melted cheese and hungarian sausage', 'price' => 280],
        ];
        
        foreach ($burgerItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                $item['description'],
                $burgerCategory->id,
                $item['price'],
                25,
                6
            );
        }

        // ========== CASA JEDLIANA SOUP ==========
        $casaSoupItems = [
            ['name' => 'Creamy Mushroom Soup', 'description' => 'Mushroom soup, seafood, creamy white sauce', 'price' => 140],
            ['name' => 'Seafood Egg Soup', 'description' => 'Shrimp, egg, vegetables and corn', 'price' => 150],
            ['name' => 'Creamy Pumpkin Soup', 'description' => 'Pumpkin, bacon on top and cream', 'price' => 140],
            ['name' => 'Chicken and Sweet Corn Soup', 'description' => 'Served with chicken and corn', 'price' => 130],
            ['name' => 'Seafood Chowder', 'description' => 'Bacon, butter spices, carrots, fish stock, corn cream and shrimp', 'price' => 170],
            ['name' => 'Seafood Creamy Mushroom Soup', 'description' => 'Shrimp, tahong, fish fillet, mushroom, bottom cream', 'price' => 180],
        ];
        
        foreach ($casaSoupItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                $item['description'],
                $casaSoupCategory->id,
                $item['price'],
                25,
                6
            );
        }

        // ========== SALAD ==========
        $saladItems = [
            ['name' => 'Caesar Salad', 'description' => 'Lettuce, caesar sauce, cherry tomato and parmesan', 'price' => 160],
            ['name' => 'Kanl Salad', 'description' => 'Lettuce, Japanese mayo, crabstick, cucumber, ebiko and seaweed', 'price' => 170],
            ['name' => 'Salmon Salad', 'description' => 'Lettuce, salmon, CJ dressing, red cabbage and parmesan', 'price' => 220],
            ['name' => 'Vitamnese Salad', 'description' => 'Peanut sauce, lettuce, carrots, cucumber, chicken fillet and fried', 'price' => 180],
            ['name' => 'CJ Special Salad', 'description' => 'Lettuce, cucumber, carrots, green apple steak with Casa Jedliana sauce', 'price' => 190],
        ];
        
        foreach ($saladItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                $item['description'],
                $saladCategory->id,
                $item['price'],
                20,
                5
            );
        }

        // ========== PASTA (Dual Price - Solo/Whole) ==========
        $pastaItems = [
            [
                'name' => 'Chicken Pesto Pasta',
                'description' => 'Round pasta with pesto paste, cream and chicken toppings',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Seafood Special Pancit Canton',
                'description' => 'Canton served with thick sauce, shrimp, squid, fish fillet, vegetables, egg white, and sesame oil',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Crabpot Pasta',
                'description' => 'Round pasta served with creamy sauce, crab, and paste sauce. Shrimp toppings and bread',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Chicken Truffle Pesto Pasta',
                'description' => 'Flat pasta with pesto paste, creamy sauce, truffle oil, and mushroom with grilled chicken and cheese parmesan on top',
                'price_solo' => 449,
                'price_whole' => 890,
            ],
            [
                'name' => 'Spicy Chicken Alfredo Pasta',
                'description' => 'Flat pasta with creamy sauce, mushroom, parsley, chili flakes, parmesan cheese, chicken toppings and sliced bread',
                'price_solo' => 449,
                'price_whole' => 890,
            ],
            [
                'name' => 'Beef Bolognese',
                'description' => 'Round pasta with beef bolognese sauce, parmesan cheese and sliced bread',
                'price_solo' => 449,
                'price_whole' => 890,
            ],
        ];
        
        foreach ($pastaItems as $item) {
            $createDualPriceItem(
                $item['name'],
                $item['description'],
                $pastaCategory->id,
                $item['price_solo'],
                $item['price_whole'],
                20,
                5
            );
        }

        // ========== NOODLES ==========
        $noodlesItems = [
            ['name' => 'Spicy Korean Noodles', 'price' => 199],
            ['name' => 'Cheezy Korean Noodles', 'price' => 199],
            ['name' => 'Japchae Noodles', 'price' => 249],
            ['name' => 'Podthai Noodles', 'price' => 249],
        ];
        
        foreach ($noodlesItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                null,
                $noodlesCategory->id,
                $item['price'],
                25,
                6
            );
        }

        // ========== SIDE DISH ==========
        $sideItems = [
            ['name' => 'Kimchi', 'price' => 80],
            ['name' => 'Potato Marble', 'price' => 70],
            ['name' => 'Coleslaw', 'price' => 60],
        ];
        
        foreach ($sideItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                null,
                $sideDishCategory->id,
                $item['price'],
                40,
                10
            );
        }

        // ========== PORK (Mixed - Some Dual, Some Single) ==========
        $porkItems = [
            [
                'name' => 'Salt & Pepper Ribs',
                'description' => 'Fried pork ribs, salt & pepper, vegetable with vinegar dip',
                'type' => 'dual',
                'price_solo' => 380,
                'price_whole' => 780,
            ],
            [
                'name' => 'Baby Back Ribs',
                'description' => 'Pork back ribs, marble potato, fries and back ribs sauce',
                'type' => 'dual',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Sisig',
                'description' => 'Crispy pork with onion and mayonnaise',
                'type' => 'dual',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Crispy Pork Binagoongan',
                'description' => 'Peanut sauce, coconut milk, pork bagnet, eggplant, petchay and sitaw with alamang',
                'type' => 'dual',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Crispy German Pork Knuckle',
                'description' => 'Pork knuckle with side dish fries, sweet corn and vegetables',
                'type' => 'dual',
                'price_solo' => 690,
                'price_whole' => 1390,
            ],
            [
                'name' => 'Pata Tim',
                'description' => '1 serving pata, sweet soy sauce and vinegar',
                'type' => 'single',
                'price' => 849,
            ],
            [
                'name' => 'Crispy Pata',
                'description' => 'Deep-fried pork leg with crispy skin and tender meat with crispy pata sauce',
                'type' => 'single',
                'price' => 849,
            ],
        ];
        
        foreach ($porkItems as $item) {
            if ($item['type'] === 'dual') {
                $createDualPriceItem(
                    $item['name'],
                    $item['description'],
                    $porkCategory->id,
                    $item['price_solo'],
                    $item['price_whole'],
                    20,
                    5
                );
            } else {
                $createSingleSizeItem(
                    $item['name'],
                    $item['description'],
                    $porkCategory->id,
                    $item['price'],
                    15,
                    4
                );
            }
        }

        // ========== CHICKEN (Mixed - Some Dual, Some Single) ==========
        $chickenItems = [
            [
                'name' => 'Chicken Rice Satay',
                'description' => 'Marinated grilled chicken leg, fried rice with peanut sauce, and sunny side up egg',
                'type' => 'dual',
                'price_solo' => 280,
                'price_whole' => 550,
            ],
            [
                'name' => 'Chicken Rice Inasal',
                'description' => '1 1/2 cup fried rice, chicken leg, inasal, grilled, sunny side up egg',
                'type' => 'dual',
                'price_solo' => 280,
                'price_whole' => 550,
            ],
            [
                'name' => 'Chicken Parmigiana',
                'description' => '2 pcs chicken fillet, wrapped in breadcrumbs and napoli and white sauce with mozzarella cheese on top',
                'type' => 'dual',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Buttered Chicken',
                'description' => 'Deep fried chicken coated with butter and with garlic dip sauce',
                'type' => 'dual',
                'price_solo' => 449,
                'price_whole' => 890,
            ],
            [
                'name' => 'Spicy Vietnamese Chicken',
                'description' => '300g chicken, sautéed with red bell, green bell and leaks, anatto oil (spicy) with garlic mayo dip sauce',
                'type' => 'dual',
                'price_solo' => 449,
                'price_whole' => 890,
            ],
            [
                'name' => 'Flavored Chicken Wings',
                'description' => '6 pcs wings with Casa Jedliana sauce (Buffalo, Korean, Spicy Honey Garlic, Gangnam Sauce, Parmesan)',
                'type' => 'single',
                'price' => 449,
            ],
        ];
        
        foreach ($chickenItems as $item) {
            if ($item['type'] === 'dual') {
                $createDualPriceItem(
                    $item['name'],
                    $item['description'],
                    $chickenCategory->id,
                    $item['price_solo'],
                    $item['price_whole'],
                    20,
                    5
                );
            } else {
                $createSingleSizeItem(
                    $item['name'],
                    $item['description'],
                    $chickenCategory->id,
                    $item['price'],
                    15,
                    4
                );
            }
        }

        // ========== FISH & SEAFOODS (All Dual) ==========
        $seafoodItems = [
            [
                'name' => 'Grilled Tuna Belly',
                'description' => 'Grilled tuna belly with vegetable side dish and gravy',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Fish Parmigiana',
                'description' => 'Fried breaded fish fillet with napoli & cheese',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Sinigang na Salmon/Hipon',
                'description' => 'Sour soup with vegetables, 300g Salmon head or 6-12 pcs shrimp',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Singaporean Chilichabs',
                'description' => '500g crabs, spicy sauce, Singaporean style',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Garlic Shrimp',
                'description' => '8 pcs shrimp with garlic butter',
                'price_solo' => 449,
                'price_whole' => 990,
            ],
            [
                'name' => 'Baked Salmon',
                'description' => 'Norwegian salmon, creamy, cheesy on top with vegetable side dish',
                'price_solo' => 490,
                'price_whole' => 990,
            ],
            [
                'name' => 'Rosemary Baked Salmon',
                'description' => 'Norwegian salmon, oven and rosemary, poached egg vegetables side dish and bearnaise sauce',
                'price_solo' => 490,
                'price_whole' => 990,
            ],
            [
                'name' => 'Seafood Cajun',
                'description' => 'Mixed seafood (Crab, Shrimp, Tahong, Squid) corn and cajun spicy sauce',
                'price_solo' => 649,
                'price_whole' => 1290,
            ],
        ];
        
        foreach ($seafoodItems as $item) {
            $createDualPriceItem(
                $item['name'],
                $item['description'],
                $seafoodCategory->id,
                $item['price_solo'],
                $item['price_whole'],
                15,
                4
            );
        }

        // ========== VEGETABLES (All Dual) ==========
        $vegetableItems = [
            [
                'name' => "Buddha's Delight",
                'description' => 'Tofu, cauliflower, broccoli, 3 kinds of mushroom, dark soy sauce, sitcharo, black beans',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Creamy Baked Vegetable',
                'description' => 'Bacon, ham, broccoli, cauliflower, young corn, black beans, sitcharo, cream and cheese',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Gising-Gising',
                'description' => 'Vegetables with sweet spicy sauce, chopseuy, shrimp, tokwa, squid',
                'price_solo' => 390,
                'price_whole' => 790,
            ],
            [
                'name' => 'Kare-Kare (Crispy Pork Bagnet)',
                'description' => 'Crispy pork bagnet with peanut sauce and vegetables',
                'price_solo' => 449,
                'price_whole' => 890,
            ],
            [
                'name' => 'Kare-Kare (Seafood)',
                'description' => 'Seafood with peanut sauce and vegetables',
                'price_solo' => 449,
                'price_whole' => 890,
            ],
            [
                'name' => 'Chinese Style Chopseuy',
                'description' => 'Vegetables with light sauce, oyster sauce, sesame oil, wine, fish fillet and shrimp',
                'price_solo' => 449,
                'price_whole' => 890,
            ],
        ];
        
        foreach ($vegetableItems as $item) {
            $createDualPriceItem(
                $item['name'],
                $item['description'],
                $vegetablesCategory->id,
                $item['price_solo'],
                $item['price_whole'],
                18,
                5
            );
        }

        // ========== RICE IN A BOWL ==========
        $riceBowlItems = [
            ['name' => 'Katsu (Chicken or Pork)', 'price' => 220],
            ['name' => 'Bibimbop (Beef, Pork or Chicken)', 'price' => 240],
            ['name' => 'Spicy Beef with Egg', 'price' => 230],
            ['name' => 'Gangnam Chicken', 'price' => 230],
            ['name' => 'Tempura Rice', 'price' => 220],
        ];
        
        foreach ($riceBowlItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                null,
                $riceBowlCategory->id,
                $item['price'],
                25,
                6
            );
        }

        // ========== SET MEALS ==========
        $setItems = [
            [
                'name' => 'SET A (4-6 persons)',
                'description' => '2 Platter of Rice, Flavored Chicken Wings, Sinigang Salmon Head, Buddha\'s Delight, Sisig, 2 Iced Tea Pitcher',
                'price' => 3420,
            ],
            [
                'name' => 'SET B (6-8 persons)',
                'description' => '3 Platter of Rice, Baby Back Ribs, Buttered Chicken, Fish Parmigiana, Special Bulalo, Gising-Gising, 2 Iced Tea Pitcher',
                'price' => 4370,
            ],
            [
                'name' => 'SET C (8-10 persons)',
                'description' => '4 Platter of Rice, Flavored Chicken Wings, Crispy Pork Bagnet Kare-Kare, Seafood Cajun, Crispy Pata, Beef Salpicao, 2 Iced Tea Pitcher',
                'price' => 5310,
            ],
        ];
        
        foreach ($setItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                $item['description'],
                $setMealsCategory->id,
                $item['price'],
                5,
                1
            );
        }

        // ========== AMERICAN BREAKFAST ==========
        $americanBreakfastItems = [
            [
                'name' => 'American Breakfast 1',
                'description' => 'Pancake, Ham, Sunny side up egg, Steamed Vegetables',
                'price' => 290,
            ],
            [
                'name' => 'American Breakfast 2',
                'description' => 'Hungarian Sausage, French toast bread, Bacon, Scrambled egg, Steamed Vegetables',
                'price' => 290,
            ],
            [
                'name' => 'American Breakfast 3',
                'description' => 'Waffle, Bacon, Hash brown, Sunny side up egg, Steamed Vegetables',
                'price' => 290,
            ],
        ];
        
        foreach ($americanBreakfastItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                $item['description'],
                $americanBreakfastCategory->id,
                $item['price'],
                15,
                4
            );
        }

        // ========== FILIPINO BREAKFAST ==========
        $filipinoBreakfastItems = [
            [
                'name' => 'Filipino Breakfast 1',
                'description' => 'Fried rice, longanisa, scrambled egg, 1 side dish',
                'price' => 249,
            ],
            [
                'name' => 'Filipino Breakfast 2',
                'description' => 'Garlic rice, pork tocino, sunny side up egg, 1 side dish',
                'price' => 249,
            ],
            [
                'name' => 'Filipino Breakfast 3',
                'description' => 'Garlic rice, beef tapa, scrambled egg, 1 side dish',
                'price' => 249,
            ],
            [
                'name' => 'Filipino Breakfast 4',
                'description' => 'Steamed rice, pork adobo, boiled egg, 1 side dish',
                'price' => 249,
            ],
            [
                'name' => 'Filipino Breakfast 5',
                'description' => 'Steamed rice, pork giniling, boiled egg, 1 side dish',
                'price' => 249,
            ],
            [
                'name' => 'Japanese Omelette',
                'description' => 'Fried rice, shrimp, mushroom gravy',
                'price' => 190,
            ],
        ];
        
        foreach ($filipinoBreakfastItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                $item['description'],
                $filipinoBreakfastCategory->id,
                $item['price'],
                18,
                5
            );
        }

        // ========== BREAKFAST SIDE DISH ==========
        $breakfastSideItems = [
            ['name' => 'Dilis and Tuyo', 'price' => 80],
            ['name' => 'Toast Bread', 'price' => 50],
            ['name' => 'French Toast', 'price' => 70],
            ['name' => 'Stirfry Kangkong/Tofu', 'price' => 90],
            ['name' => 'Steamed Vegetables', 'price' => 80],
        ];
        
        foreach ($breakfastSideItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                null,
                $breakfastSideCategory->id,
                $item['price'],
                25,
                7
            );
        }

        // ========== ADD ONS ==========
        $addOnsItems = [
            ['name' => 'Sugar', 'price' => 30],
            ['name' => 'Syrup', 'price' => 50],
            ['name' => 'Milk', 'price' => 50],
            ['name' => 'Others', 'price' => 50],
            ['name' => 'Espresso shot', 'price' => 70],
        ];
        
        foreach ($addOnsItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                null,
                $addOnsCategory->id,
                $item['price'],
                100,
                20
            );
        }

        // ========== BEVERAGES ==========
        $beverageItems = [
            ['name' => 'Pepsi', 'price' => 55],
            ['name' => 'Pepsi Zero Lime', 'price' => 60],
            ['name' => 'Mountain Dew Zero', 'price' => 60],
            ['name' => 'Chupa Chups', 'price' => 90],
            ['name' => 'A&W', 'price' => 90],
            ['name' => 'Evian (Bottled Water)', 'price' => 95],
            ['name' => 'Snapple', 'price' => 105],
            ['name' => 'Red Bull', 'price' => 125],
            ['name' => 'Starbucks Double Shot', 'price' => 180],
        ];
        
        foreach ($beverageItems as $item) {
            $createSingleSizeItem(
                $item['name'],
                null,
                $beveragesCategory->id,
                $item['price'],
                50,
                12
            );
        }

        // ========== CREATE PAYMENT METHODS ==========
        $paymentMethods = [
            ['name' => 'Cash', 'is_active' => true],
            ['name' => 'Credit Card', 'is_active' => true],
            ['name' => 'E-Wallet', 'is_active' => true],
            ['name' => 'Hotel', 'is_active' => true],
        ];
        
        foreach ($paymentMethods as $method) {
            PaymentMethod::create($method);
        }
        
        // ========== CREATE SAMPLE TABLES ==========
        for ($i = 1; $i <= 10; $i++) {
            Table::create([
                'table_number' => $i,
                'capacity' => rand(2, 8),
                'status' => 'available',
                'is_active' => true,
            ]);
        }
        
        // ========== CREATE SAMPLE CUSTOMER ==========
        Customer::create([
            'name' => 'John Doe',
            'phone' => '123-456-7890',
            'email' => 'john@example.com',
        ]);
        
        // ========== CREATE SAMPLE INGREDIENTS ==========
        $ingredients = [
            ['name' => 'Beef Patty', 'unit' => 'pcs', 'quantity' => 50, 'min_stock' => 10, 'cost_per_unit' => 2.50],
            ['name' => 'Lettuce', 'unit' => 'kg', 'quantity' => 5, 'min_stock' => 2, 'cost_per_unit' => 1.20],
            ['name' => 'Coffee Beans', 'unit' => 'kg', 'quantity' => 10, 'min_stock' => 3, 'cost_per_unit' => 15.00],
            ['name' => 'Chicken Breast', 'unit' => 'kg', 'quantity' => 20, 'min_stock' => 5, 'cost_per_unit' => 3.50],
            ['name' => 'Pork Belly', 'unit' => 'kg', 'quantity' => 15, 'min_stock' => 4, 'cost_per_unit' => 4.00],
            ['name' => 'Salmon Fillet', 'unit' => 'kg', 'quantity' => 8, 'min_stock' => 2, 'cost_per_unit' => 12.00],
            ['name' => 'Shrimp', 'unit' => 'kg', 'quantity' => 10, 'min_stock' => 3, 'cost_per_unit' => 8.50],
            ['name' => 'Pasta Noodles', 'unit' => 'kg', 'quantity' => 25, 'min_stock' => 8, 'cost_per_unit' => 2.00],
            ['name' => 'Rice', 'unit' => 'kg', 'quantity' => 50, 'min_stock' => 15, 'cost_per_unit' => 1.00],
            ['name' => 'Milk', 'unit' => 'liter', 'quantity' => 20, 'min_stock' => 5, 'cost_per_unit' => 1.50],
        ];
        
        foreach ($ingredients as $ingredient) {
            Ingredient::create($ingredient);
        }

        $this->command->info('✅ Database seeded successfully!');
        $this->command->info('🔐 Admin Login: admin@cjbrew.com / password123');
        $this->command->info('💵 Cashier Login: cashier@cjbrew.com / password123');
        $this->command->info('👨‍🍳 Kitchen Login: kitchen@cjbrew.com / password123');
        $this->command->info('👤 Customer Login: customer@example.com / password123');
        $this->command->info('📂 Created ' . count($categories) . ' categories');
        $this->command->info('📏 Created ' . count($sizes) . ' sizes');
        $this->command->info('🍽️  Created menu items with size options');
    }
}