<?php

namespace App\Http\Controllers\Admin;

use App\Events\KitchenOrderStatusChanged;
use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Carbon\Carbon;

class KitchenOrderController extends Controller
{
    public function index(Request $request)
    {
        $userRole = auth()->user()->role;
        
        // Get ALL orders - same as Dashboard
        $orders = Sale::with(['saleItems', 'paymentMethod', 'user'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($order) {
                $kitchenItems = [];
                foreach ($order->saleItems as $item) {
                    $kitchenItems[] = [
                        'id' => $item->id,
                        'name' => $item->item_name,
                        'quantity' => $item->quantity,
                        'kitchen_status' => $item->kitchen_status ?? 'pending',
                        'notes' => $item->special_instructions ?? null,
                        'kitchen_type' => $this->getKitchenType($item),
                    ];
                }

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'txn_number' => $order->txn_number,
                    'order_type' => $order->order_type ?? 'takeout',
                    'customer_name' => $order->customer_name ?? 'Walk-in Customer',
                    'created_at' => $order->created_at->toIso8601String(),
                    'kitchen_status' => $order->kitchen_status ?? 'pending',
                    'status' => $order->status,
                    'items' => $kitchenItems,
                    'item_count' => count($kitchenItems),
                    'notes' => $order->notes,
                    'room_number' => $order->room_number,
                    'is_hotel' => $order->paymentMethod && $order->paymentMethod->name === 'Hotel',
                ];
            })
            ->filter(function ($order) {
                return $order['item_count'] > 0;
            })
            ->values();

        return Inertia::render('Admin/Kitchen', [
            'orders' => $orders,
            'hasNewOrder' => false,
            'userRole' => $userRole,
            'stats' => [
                'pending' => $orders->filter(fn($o) => $o['kitchen_status'] === 'pending')->count(),
                'preparing' => $orders->filter(fn($o) => $o['kitchen_status'] === 'preparing')->count(),
                'ready' => $orders->filter(fn($o) => $o['kitchen_status'] === 'ready')->count(),
                'completed' => $orders->filter(fn($o) => $o['kitchen_status'] === 'completed')->count(),
            ],
        ]);
    }

    /**
     * Get orders for kitchen display - SAME LOGIC AS DASHBOARD
     */
    public function getOrders(Request $request)
    {
        $dateRange  = $request->input('date_range', 'today');
        $startDate  = $request->input('start_date'); // yyyy-mm-dd expected
        $endDate    = $request->input('end_date');   // yyyy-mm-dd expected

        // Apply date filtering (matches what Kitchen.jsx requests)
        $range = $this->getDateRangeQuery($dateRange, $startDate, $endDate);

        Log::info('[KitchenOrderController@getOrders] params', [
            'date_range' => $dateRange,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'computed_start' => (string) $range['start'],
            'computed_end' => (string) $range['end'],
        ]);

        $ordersQuery = Sale::with(['saleItems', 'paymentMethod', 'user'])
            ->whereBetween('created_at', [$range['start'], $range['end']])
            ->orderBy('created_at', 'desc');

        $rawOrdersCount = (clone $ordersQuery)->count();
        Log::info('[KitchenOrderController@getOrders] raw orders count', [
            'count' => $rawOrdersCount,
        ]);

        $orders = $ordersQuery->get()
            ->map(function ($order) {
                $kitchenItems = [];
                foreach ($order->saleItems as $item) {
                    $kitchenItems[] = [
                        'id' => $item->id,
                        'name' => $item->item_name,
                        'quantity' => $item->quantity,
                        'kitchen_status' => $item->kitchen_status ?? 'pending',
                        'notes' => $item->special_instructions ?? null,
                        'kitchen_type' => $this->getKitchenType($item),
                    ];
                }

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'txn_number' => $order->txn_number,
                    'order_type' => $order->order_type ?? 'takeout',
                    'customer_name' => $order->customer_name ?? 'Walk-in Customer',
                    'created_at' => $order->created_at?->toIso8601String(),
                    'kitchen_status' => $order->kitchen_status ?? 'pending',
                    'status' => $order->status,
                    'items' => $kitchenItems,
                    'item_count' => count($kitchenItems),
                    'notes' => $order->notes,
                    'room_number' => $order->room_number,
                    'is_hotel' => $order->paymentMethod && $order->paymentMethod->name === 'Hotel',
                ];
            })
            ->filter(function ($order) {
                return $order['item_count'] > 0;
            })
            ->values();

        Log::info('[KitchenOrderController@getOrders] mapped orders count', [
            'count' => $orders->count(),
            'first_order_id' => $orders->first()['id'] ?? null,
        ]);

        if ($orders->count() > 0) {
            $sample = $orders->first();
            Log::info('[KitchenOrderController@getOrders] sample payload', [
                'sample_order_id' => $sample['id'] ?? null,
                'sample_created_at' => $sample['created_at'] ?? null,
                'sample_kitchen_status' => $sample['kitchen_status'] ?? null,
                'sample_first_item_kitchen_status' => $sample['items'][0]['kitchen_status'] ?? null,
                'sample_first_item_kitchen_type' => $sample['items'][0]['kitchen_type'] ?? null,
            ]);
        }


        return response()->json([
            'success' => true,
            'orders' => $orders,
            'timestamp' => now()->timestamp,
        ]);
    }

    public function checkNewOrders(Request $request)
    {
        $since = $request->input('since', 0);
        
        $orders = Sale::with(['saleItems', 'paymentMethod', 'user'])
            ->where('created_at', '>', date('Y-m-d H:i:s', $since))
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($order) {
                $kitchenItems = [];
                foreach ($order->saleItems as $item) {
                    $kitchenItems[] = [
                        'id' => $item->id,
                        'name' => $item->item_name,
                        'quantity' => $item->quantity,
                        'kitchen_status' => $item->kitchen_status ?? 'pending',
                        'notes' => $item->special_instructions ?? null,
                        'kitchen_type' => $this->getKitchenType($item),
                    ];
                }

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'txn_number' => $order->txn_number,
                    'order_type' => $order->order_type ?? 'takeout',
                    'customer_name' => $order->customer_name ?? 'Walk-in Customer',
                    'created_at' => $order->created_at->toIso8601String(),
                    'kitchen_status' => $order->kitchen_status ?? 'pending',
                    'status' => $order->status,
                    'items' => $kitchenItems,
                    'item_count' => count($kitchenItems),
                    'notes' => $order->notes,
                    'room_number' => $order->room_number,
                    'is_hotel' => $order->paymentMethod && $order->paymentMethod->name === 'Hotel',
                ];
            })
            ->filter(function ($order) {
                return $order['item_count'] > 0;
            })
            ->values();

        return response()->json([
            'success' => true,
            'orders' => $orders,
            'timestamp' => now()->timestamp,
        ]);
    }

    private function getDateRangeQuery($dateRange, $startDate = null, $endDate = null, $singleDate = null)
    {
        $now = Carbon::now();
        $start = null;
        $end = null;
        
        switch ($dateRange) {
            case 'today':
                $start = $now->copy()->startOfDay();
                $end = $now->copy()->endOfDay();
                break;
            case 'yesterday':
                $start = $now->copy()->subDay()->startOfDay();
                $end = $now->copy()->subDay()->endOfDay();
                break;
            case 'this_week':
                $start = $now->copy()->startOfWeek(Carbon::MONDAY);
                $end = $now->copy()->endOfWeek(Carbon::SUNDAY);
                break;
            case 'last_week':
                $start = $now->copy()->subWeek()->startOfWeek(Carbon::MONDAY);
                $end = $now->copy()->subWeek()->endOfWeek(Carbon::SUNDAY);
                break;
            case 'this_month':
                $start = $now->copy()->startOfMonth();
                $end = $now->copy()->endOfMonth();
                break;
            case 'last_month':
                $start = $now->copy()->subMonth()->startOfMonth();
                $end = $now->copy()->subMonth()->endOfMonth();
                break;
            case 'custom':
                if ($startDate && $endDate) {
                    $start = Carbon::parse($startDate)->startOfDay();
                    $end = Carbon::parse($endDate)->endOfDay();
                } else {
                    $start = $now->copy()->startOfDay();
                    $end = $now->copy()->endOfDay();
                }
                break;
            default:
                if ($singleDate) {
                    $start = Carbon::parse($singleDate)->startOfDay();
                    $end = Carbon::parse($singleDate)->endOfDay();
                } else {
                    $start = $now->copy()->startOfDay();
                    $end = $now->copy()->endOfDay();
                }
                break;
        }
        
        return ['start' => $start, 'end' => $end];
    }

    public function startPreparing(Request $request, Sale $order)
    {
        DB::beginTransaction();
        try {
            foreach ($order->saleItems as $item) {
                $item->update(['kitchen_status' => 'preparing']);
            }
            $order->update(['kitchen_status' => 'preparing']);

            DB::commit();
            event(new KitchenOrderStatusChanged($order, 'preparing'));

            return response()->json([
                'success' => true,
                'message' => "Order #{$order->id} started preparing",
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function markReady(Request $request, Sale $order)
    {
        DB::beginTransaction();
        try {
            foreach ($order->saleItems as $item) {
                $item->update(['kitchen_status' => 'ready']);
            }
            $order->update(['kitchen_status' => 'ready']);

            DB::commit();
            event(new KitchenOrderStatusChanged($order, 'ready'));

            return response()->json([
                'success' => true,
                'message' => "Order #{$order->id} is ready",
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    private function getKitchenType($item): string
    {
        $menuVisibility = null;

        if ($item->kitchenItem) {
            $menuVisibility = $item->kitchenItem->menu_visibility;
        } elseif ($item->item) {
            $menuVisibility = $item->item->menu_visibility;
        }

        if ($menuVisibility === 'both' || $menuVisibility === 'resto') {
            return 'resto';
        }

        return 'kitchen';
    }

    private function cleanNotes($instructions)
    {
        if (empty($instructions)) {
            return null;
        }

        $cleaned = preg_replace('/\[size:[^\]]+\]/', '', $instructions);
        $cleaned = preg_replace('/\[temp:[^\]]+\]/', '', $cleaned);
        $cleaned = preg_replace('/\[variant:[^\]]+\]/', '', $cleaned);

        return trim($cleaned) ?: null;
    }
}