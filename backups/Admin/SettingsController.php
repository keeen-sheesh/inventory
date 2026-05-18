<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SettingsController extends Controller
{
    protected array $keys = [
        'business_name',
        'business_tagline',
        'address',
        'phone',
        'email',
        'tax_rate',
        'service_charge',
        'currency',
        'receipt_header',
        'receipt_footer',
        'auto_print',
        'show_tax',
        'show_service_charge',
        'default_order_type',
        'require_customer_name',
        'auto_logout_minutes',
        'show_item_images',
        'alert_sound',
        'auto_ready_timer',
        'show_order_timer',
    ];

    public function index()
    {
        $settings = Setting::getMany($this->keys);

        return Inertia::render('Admin/Settings', [
            'auth'     => ['user' => auth()->user()],
            'settings' => $settings,
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'business_name'         => 'nullable|string|max:255',
            'business_tagline'      => 'nullable|string|max:255',
            'address'               => 'nullable|string|max:500',
            'phone'                 => 'nullable|string|max:50',
            'email'                 => 'nullable|email|max:255',
            'tax_rate'              => 'nullable|numeric|min:0|max:100',
            'service_charge'        => 'nullable|numeric|min:0|max:100',
            'currency'              => 'nullable|string|max:10',
            'receipt_header'        => 'nullable|string|max:500',
            'receipt_footer'        => 'nullable|string|max:500',
            'auto_print'            => 'nullable|boolean',
            'show_tax'              => 'nullable|boolean',
            'show_service_charge'   => 'nullable|boolean',
            'default_order_type'    => 'nullable|string|max:50',
            'require_customer_name' => 'nullable|boolean',
            'auto_logout_minutes'   => 'nullable|integer|min:0',
            'show_item_images'      => 'nullable|boolean',
            'alert_sound'           => 'nullable|boolean',
            'auto_ready_timer'      => 'nullable|integer|min:0',
            'show_order_timer'      => 'nullable|boolean',
        ]);

        foreach ($data as $key => $value) {
            Setting::set($key, $value);
        }

        return response()->json(['success' => true, 'message' => 'Settings saved successfully.']);
    }

    public function dangerAction(string $action)
    {
        try {
            switch ($action) {
                case 'clear-orders':
                    // Delete all sale items first (FK), then sales/orders
                    \DB::table('sale_items')->delete();
                    \DB::table('sales')->delete();
                    return response()->json(['success' => true, 'message' => 'All orders deleted successfully.']);

                case 'reset-demo':
                    // Wipe all settings back to defaults
                    \DB::table('settings')->delete();
                    return response()->json(['success' => true, 'message' => 'Settings reset to factory defaults.']);

                case 'delete-ingredients':
                    // Remove recipe links first, then ingredients
                    \DB::table('item_ingredients')->delete();
                    \DB::table('ingredients')->delete();
                    return response()->json(['success' => true, 'message' => 'All ingredients deleted successfully.']);

                default:
                    return response()->json(['success' => false, 'message' => 'Unknown action.'], 400);
            }
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    public function clearCache()
    {
        try {
            \Artisan::call('cache:clear');
            \Artisan::call('config:clear');
            \Artisan::call('route:clear');
            \Artisan::call('view:clear');

            return response()->json([
                'success' => true,
                'message' => 'Cache cleared successfully.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}