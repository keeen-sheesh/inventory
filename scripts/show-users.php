<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$users = Illuminate\Support\Facades\DB::table('users')->select('id','email','role')->get();
foreach ($users as $u) {
    echo $u->id . ' ' . $u->email . ' ' . $u->role . "\n";
}
