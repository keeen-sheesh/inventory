<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;
use App\Http\Middleware\CheckRole;

// create dummy request and attach user
$request = Request::create('/admin/kitchen', 'GET');
$user = App\Models\User::where('role','admin')->first();
Auth::setUser($user);

$middleware = new CheckRole();
$result = $middleware->handle($request, function($req){ return 'passed'; }, 'kitchen,admin');

echo "middleware result: ";
var_dump($result);
