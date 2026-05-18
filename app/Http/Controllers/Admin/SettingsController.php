<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SettingsController extends Controller
{
    protected array $keys = [
        'business_name',
        'business_tagline',
        'business_logo',
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
            'business_logo'         => 'nullable|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
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

        $logoPath = null;

        // Handle logo upload
        if ($request->hasFile('business_logo')) {
            $file = $request->file('business_logo');
            
            // Delete old logo if exists
            $oldLogo = Setting::get('business_logo');
            if ($oldLogo && \Storage::disk('public')->exists($oldLogo)) {
                \Storage::disk('public')->delete($oldLogo);
            }
            
            // Store new logo
            $logoPath = $file->store('logos', 'public');
            Setting::set('business_logo', $logoPath);
        }

        foreach ($data as $key => $value) {
            if ($key === 'business_logo') continue; // Already handled above
            Setting::set($key, $value);
        }

        // Clear config/cache so new settings take effect immediately
        try {
            \Artisan::call('config:clear');
            \Artisan::call('cache:clear');
        } catch (\Exception $e) {
            // Non-fatal — settings still saved
        }

        return response()->json([
            'success' => true,
            'message' => 'Settings saved successfully.',
            'logo_path' => $logoPath,
        ]);
    }

    public function dangerAction(Request $request, string $action)
    {
        try {
            $request->validate([
                'password' => ['required', 'current_password'],
            ], [
                'password.current_password' => 'Incorrect password.',
            ]);

            switch ($action) {
                case 'clear-orders':
                    // Delete all sale items first (FK), then sales/orders
                    \DB::table('sale_items')->delete();
                    \DB::table('sales')->delete();
                    return response()->json(['success' => true, 'message' => 'All orders deleted successfully.']);

                case 'reset-txn-count':
                    // Reset transaction sequence counter by clearing txn_date and txn_sequence
                    \DB::table('sales')
                        ->whereNotNull('txn_date')
                        ->update([
                            'txn_date' => null,
                            'txn_sequence' => null,
                            'txn_number' => \DB::raw('CONCAT("RESET-", id, "-", UNIX_TIMESTAMP())'),
                        ]);
                    return response()->json(['success' => true, 'message' => 'Transaction count reset successfully. All sales have been marked with RESET- prefix.']);

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

    public function inventoryAudit(Request $request)
    {
        $filters = $request->validate([
            'pool' => 'nullable|string|in:resto,kitchen',
            'or_number' => 'nullable|string|max:64',
            'ingredient' => 'nullable|string|max:255',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
            'limit' => 'nullable|integer|min:10|max:500',
        ]);

        $limit = (int) ($filters['limit'] ?? 100);

        $rows = $this->buildInventoryAuditQuery($filters)
            ->orderByDesc('scb.created_at')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'rows' => $rows,
        ]);
    }

    public function exportInventoryAuditCsv(Request $request)
    {
        $filters = $request->validate([
            'pool' => 'nullable|string|in:resto,kitchen',
            'or_number' => 'nullable|string|max:64',
            'ingredient' => 'nullable|string|max:255',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
        ]);

        $rows = $this->buildInventoryAuditQuery($filters)
            ->orderByDesc('scb.created_at')
            ->get();

        $filename = 'inventory-audit-' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Counted At',
                'Count Date',
                'Pool',
                'OR Number',
                'Ingredient',
                'Previous Stock',
                'Counted Stock',
                'Variance',
                'Mode',
                'Counted By',
                'Notes',
                'Batch ID',
            ]);

            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row->counted_at,
                    $row->count_date,
                    strtoupper((string) $row->pool_code),
                    $row->or_number,
                    $row->ingredient_name,
                    $row->previous_stock,
                    $row->counted_stock,
                    $row->variance,
                    ((int) $row->items_in_batch > 1 ? 'BULK' : 'SINGLE'),
                    $row->counted_by,
                    $row->notes,
                    $row->batch_id,
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    private function buildInventoryAuditQuery(array $filters)
    {
        $batchSizes = DB::table('stock_count_batch_items')
            ->select('stock_count_batch_id', DB::raw('COUNT(*) as items_in_batch'))
            ->groupBy('stock_count_batch_id');

        $query = DB::table('stock_count_batch_items as sbi')
            ->join('stock_count_batches as scb', 'scb.id', '=', 'sbi.stock_count_batch_id')
            ->join('ingredients as ing', 'ing.id', '=', 'sbi.ingredient_id')
            ->leftJoin('users as u', 'u.id', '=', 'scb.user_id')
            ->leftJoinSub($batchSizes, 'batch_sizes', function ($join) {
                $join->on('batch_sizes.stock_count_batch_id', '=', 'scb.id');
            })
            ->select([
                'scb.id as batch_id',
                'scb.created_at as counted_at',
                'scb.count_date',
                'scb.inventory_pool_code as pool_code',
                'scb.or_number',
                'scb.notes',
                'ing.name as ingredient_name',
                'sbi.current_stock as previous_stock',
                'sbi.actual_counted_stock as counted_stock',
                'sbi.variance',
                DB::raw('COALESCE(batch_sizes.items_in_batch, 1) as items_in_batch'),
                DB::raw('COALESCE(u.name, "System") as counted_by'),
            ]);

        if (!empty($filters['pool'])) {
            $query->where('scb.inventory_pool_code', $filters['pool']);
        }

        if (!empty($filters['or_number'])) {
            $query->where('scb.or_number', 'like', '%' . trim((string) $filters['or_number']) . '%');
        }

        if (!empty($filters['ingredient'])) {
            $query->where('ing.name', 'like', '%' . trim((string) $filters['ingredient']) . '%');
        }

        if (!empty($filters['from_date'])) {
            $query->whereDate('scb.count_date', '>=', $filters['from_date']);
        }

        if (!empty($filters['to_date'])) {
            $query->whereDate('scb.count_date', '<=', $filters['to_date']);
        }

        return $query;
    }
}
