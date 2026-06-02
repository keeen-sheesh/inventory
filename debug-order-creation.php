<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

// Enable query logging to see what's happening
\Illuminate\Support\Facades\DB::enableQueryLog();

use App\Models\Sale;

// Get the most recent 3 orders
$orders = Sale::orderBy('created_at', 'desc')->limit(3)->get();

echo "=== RECENT ORDERS ===\n\n";

foreach ($orders as $order) {
    echo "Order #{$order->id}:\n";
    echo "  Created: " . $order->created_at . "\n";
    echo "  Status: " . $order->status . "\n";
    echo "  Kitchen Status: " . $order->kitchen_status . "\n";
    echo "  Items count: " . $order->saleItems()->count() . "\n";
    echo "  Has kitchen items: " . ($order->saleItems()->whereNotNull('kitchen_type')->count() > 0 ? 'Yes' : 'No') . "\n";
    echo "\n";
}

// Check if there are any middleware that might be affecting orders
echo "=== CHECKING MIDDLEWARE CHAIN ===\n\n";

$kernel = app(\Illuminate\Contracts\Http\Kernel::class);
$middleware = $kernel->getMiddlewareGroups();

echo "Web middleware: " . implode(', ', $middleware['web'] ?? []) . "\n";

$routes = \Illuminate\Support\Facades\Route::getRoutes();
$posRoutes = $routes->filter(function($route) {
    return strpos($route->uri(), 'pos') !== false;
});

echo "\nPOS routes: " . count($posRoutes) . "\n";
foreach ($posRoutes->take(3) as $route) {
    echo "  - " . $route->methods()[0] . " " . $route->uri() . "\n";
}
