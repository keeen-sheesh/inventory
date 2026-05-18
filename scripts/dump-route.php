<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Route;

$route = Route::getRoutes()->getByName('admin.kitchen.index');
if (!$route) {
    echo "route not found\n";
    exit;
}

echo "uri: " . $route->uri() . "\n";
echo "methods: " . implode(',', $route->methods()) . "\n";
echo "middleware: " . implode(',', $route->gatherMiddleware()) . "\n";
