<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Auth;

// Try both credentials
$credentials = [
    ['email'=>'admin@cjbrew.com','password'=>'password123'],
    ['email'=>'cashier@cjbrew.com','password'=>'password123'],
    ['email'=>'kitchen@cjbrew.com','password'=>'password123'],
];

foreach($credentials as $creds) {
    Auth::logout();
    $ok = Auth::attempt($creds);
    echo "Trying {$creds['email']} -> ".($ok ? 'success' : 'fail')."\n";
    if ($ok) {
        $user = Auth::user();
        echo "user role: {$user->role}\n";
        if ($user->role === 'admin') {
            echo "redirect admin.dashboard\n";
        } elseif ($user->role === 'resto' || $user->role === 'resto_admin') {
            echo "redirect cashier pos\n";
        } elseif ($user->role === 'kitchen') {
            echo "redirect admin.kitchen.index\n";
        } elseif ($user->role === 'customer') {
            echo "redirect menu\n";
        } else {
            echo "redirect admin.dashboard (default)\n";
        }
    }
}
