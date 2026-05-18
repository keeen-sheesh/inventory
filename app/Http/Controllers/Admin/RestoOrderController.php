<?php

namespace App\Http\Controllers\Admin;

use App\Events\RestoOrderStatusChanged;
use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

/**
 * Controller for Resto (Clean Kitchen) Order Monitor
 * Handles display and management of non-kitchen orders
 */
class RestoOrderController extends Controller
{
    /**
     * Display the Resto Order Monitor screen
     */
    public function index(Request $request)
    {
        $dateFilter = $request->get('date', now()->format('Y-m-d'));
        $lastCheck = $request->session()->get('last_resto_check', now()->subMinutes(5)->timestamp);

        // Get orders with ONLY resto items (non-kitchen items)
        $orders = $this->restoSalesQuery()
            ->with(['saleItems.item.category', 'saleItems.kitchenItem.category', 'customer', 'paymentMethod'])
            ->whereIn('status', ['pending', 'preparing', 'ready', 'completed'])
            ->whereDate('created_at', $dateFilter)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($order) {
                // Get only resto items (non-kitchen)
                $restoItems = [];
                foreach ($order->saleItems as $item) {
                    if (! $this->isKitchenSaleItem($item)) {
                        $restoItems[] = [
                            'id' => $item->id,
                            'name' => $item->item_name,
                            'quantity' => $item->quantity,
                            'status' => $item->status ?? 'pending',
                            'notes' => \App\Models\SaleItem::cleanNotes($item->special_instructions),
                            'size' => \App\Models\SaleItem::extractSize($item->special_instructions),
                            'temperature' => \App\Models\SaleItem::extractTemperature($item->special_instructions),
                            'variant_label' => \App\Models\SaleItem::extractVariantLabel($item->special_instructions),
                        ];
                    }
                }

                $itemsList = collect($restoItems)->map(function ($item) {
                    return $item['quantity'].'x '.$item['name'];
                })->implode(', ');

                $isHotel = $order->paymentMethod && $order->paymentMethod->name === 'Hotel';
                $customerName = $order->customer_name ?? 'Walk-in Customer';

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'txn_number' => $order->txn_number,
                    'order_type' => $order->order_type ?? 'takeout',
                    'customer_name' => $customerName,
                    'is_hotel' => $isHotel,
                    'payment_method_name' => $order->paymentMethod ? $order->paymentMethod->name : null,
                    'room_number' => $order->room_number ?? null,
                    'total_amount' => $order->total_amount,
                    'created_at' => $order->created_at->toIso8601String(),
                    'created_at_raw' => $order->created_at->timestamp,
                    'created_at_full' => $order->created_at->toIso8601String(),
                    'created_date' => $order->created_at->format('Y-m-d'),
                    'updated_at' => $order->updated_at->toIso8601String(),
                    'status' => $order->status,
                    'items' => $restoItems,
                    'items_list' => $itemsList,
                    'item_count' => count($restoItems),
                    'notes' => $order->notes,
                ];
            })
            ->filter(function ($order) {
                return $order['item_count'] > 0;
            })
            ->values();

        // Get new orders count
        $newOrdersCount = $this->restoSalesQuery()
            ->where('status', 'pending')
            ->where('created_at', '>', date('Y-m-d H:i:s', $lastCheck))
            ->count();

        $request->session()->put('last_resto_check', now()->timestamp);

        // Broadcast update
        $this->broadcastMenuUpdate();

        Log::info('Resto orders sent to monitor:', [
            'count' => $orders->count(),
            'pending' => $orders->where('status', 'pending')->count(),
            'preparing' => $orders->where('status', 'preparing')->count(),
            'ready' => $orders->where('status', 'ready')->count(),
        ]);

        // Statistics
        $todayOrders = $this->restoSalesQuery()
            ->whereDate('created_at', now()->format('Y-m-d'))
            ->count();

        return Inertia::render('Admin/RestoOrderMonitor', [
            'orders' => $orders,
            'hasNewOrder' => $newOrdersCount > 0,
            'currentTime' => now()->timestamp,
            'currentDate' => $dateFilter,
            'stats' => [
                'today' => $todayOrders,
            ],
        ]);
    }

    /**
     * Check for new resto orders (polling endpoint)
     */
    public function checkNewOrders(Request $request)
    {
        $since = $request->get('since', now()->subMinutes(5)->timestamp);
        $sinceDateTime = date('Y-m-d H:i:s', $since);
        $dateFilter = $request->get('date', now()->format('Y-m-d'));

        // Get all resto orders for the date
        $allOrders = $this->restoSalesQuery()
            ->with(['saleItems.item.category', 'saleItems.kitchenItem.category', 'customer', 'paymentMethod'])
            ->whereIn('status', ['pending', 'preparing', 'ready', 'completed'])
            ->whereDate('created_at', $dateFilter)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($order) {
                $restoItems = [];
                foreach ($order->saleItems as $item) {
                    if (! $this->isKitchenSaleItem($item)) {
                        $restoItems[] = [
                            'id' => $item->id,
                            'name' => $item->item_name,
                            'quantity' => $item->quantity,
                            'status' => $item->status ?? 'pending',
                            'notes' => \App\Models\SaleItem::cleanNotes($item->special_instructions),
                            'size' => \App\Models\SaleItem::extractSize($item->special_instructions),
                            'temperature' => \App\Models\SaleItem::extractTemperature($item->special_instructions),
                            'variant_label' => \App\Models\SaleItem::extractVariantLabel($item->special_instructions),
                        ];
                    }
                }

                $isHotel = $order->paymentMethod && $order->paymentMethod->name === 'Hotel';
                $customerName = $order->customer_name ?? 'Walk-in Customer';

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'txn_number' => $order->txn_number,
                    'order_type' => $order->order_type ?? 'takeout',
                    'customer_name' => $customerName,
                    'is_hotel' => $isHotel,
                    'payment_method_name' => $order->paymentMethod ? $order->paymentMethod->name : null,
                    'room_number' => $order->room_number ?? null,
                    'created_at' => $order->created_at->toIso8601String(),
                    'created_at_raw' => $order->created_at->timestamp,
                    'status' => $order->status,
                    'items' => $restoItems,
                    'item_count' => count($restoItems),
                ];
            })
            ->filter(function ($order) {
                return $order['item_count'] > 0;
            })
            ->values();

        return response()->json([
            'success' => true,
            'orders' => $allOrders,
            'timestamp' => now()->timestamp,
        ]);
    }

    /**
     * Mark resto order as preparing
     * Only updates resto items, not kitchen items
     */
    public function startPreparing(Request $request, Sale $order)
    {
        DB::beginTransaction();
        try {
            // Update only resto items (non-kitchen items)
            foreach ($order->saleItems as $item) {
                if (! $this->isKitchenSaleItem($item)) {
                    $item->update([
                        'status' => 'preparing',
                    ]);
                }
            }

            DB::commit();

            $order->load(['saleItems', 'paymentMethod']);
            event(new RestoOrderStatusChanged($order, 'preparing'));
            $this->broadcastMenuUpdate();

            Log::info("Resto started preparing order #{$order->id}");

            return response()->json([
                'success' => true,
                'message' => "Order #{$order->id} started preparing",
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Resto start preparing failed: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mark resto order as ready
     * Only updates resto items, not kitchen items
     */
    public function markReady(Request $request, Sale $order)
    {
        DB::beginTransaction();
        try {
            // Update only resto items (non-kitchen items)
            foreach ($order->saleItems as $item) {
                if (! $this->isKitchenSaleItem($item)) {
                    $item->update([
                        'status' => 'ready',
                    ]);
                }
            }

            DB::commit();

            $order->load(['saleItems', 'paymentMethod']);
            event(new RestoOrderStatusChanged($order, 'ready'));
            $this->broadcastMenuUpdate();

            Log::info("Resto marked order #{$order->id} as READY");

            return response()->json([
                'success' => true,
                'message' => "Order #{$order->id} is ready",
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Resto mark ready failed: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Complete a resto order (serve)
     */
    public function complete(Request $request, Sale $order)
    {
        DB::beginTransaction();
        try {
            $order->update([
                'status' => 'completed',
            ]);

            $this->restoSaleItemsQuery($order->id)
                ->update([
                    'status' => 'completed',
                ]);

            DB::commit();

            $order->load(['saleItems', 'paymentMethod']);
            event(new RestoOrderStatusChanged($order, 'completed'));
            $this->broadcastMenuUpdate();

            Log::info("Resto order #{$order->id} completed");

            return response()->json([
                'success' => true,
                'message' => "Order #{$order->id} completed",
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Resto complete failed: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Filter orders by date
     */
    public function filterByDate(Request $request)
    {
        $date = $request->get('date', now()->format('Y-m-d'));

        $orders = $this->restoSalesQuery()
            ->with(['saleItems.item.category', 'saleItems.kitchenItem.category', 'customer', 'paymentMethod'])
            ->whereIn('status', ['pending', 'preparing', 'ready', 'completed'])
            ->whereDate('created_at', $date)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($order) {
                $restoItems = [];
                foreach ($order->saleItems as $item) {
                    if (! $this->isKitchenSaleItem($item)) {
                        $restoItems[] = [
                            'id' => $item->id,
                            'name' => $item->item_name,
                            'quantity' => $item->quantity,
                            'status' => $item->status ?? 'pending',
                            'notes' => \App\Models\SaleItem::cleanNotes($item->special_instructions),
                            'size' => \App\Models\SaleItem::extractSize($item->special_instructions),
                            'temperature' => \App\Models\SaleItem::extractTemperature($item->special_instructions),
                            'variant_label' => \App\Models\SaleItem::extractVariantLabel($item->special_instructions),
                        ];
                    }
                }

                $isHotel = $order->paymentMethod && $order->paymentMethod->name === 'Hotel';
                $customerName = $order->customer_name ?? 'Walk-in Customer';

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'txn_number' => $order->txn_number,
                    'order_type' => $order->order_type ?? 'takeout',
                    'customer_name' => $customerName,
                    'is_hotel' => $isHotel,
                    'payment_method_name' => $order->paymentMethod ? $order->paymentMethod->name : null,
                    'room_number' => $order->room_number ?? null,
                    'created_at' => $order->created_at->toIso8601String(),
                    'status' => $order->status,
                    'items' => $restoItems,
                    'item_count' => count($restoItems),
                ];
            })
            ->filter(function ($order) {
                return $order['item_count'] > 0;
            })
            ->values();

        return response()->json([
            'success' => true,
            'orders' => $orders,
            'date' => $date,
        ]);
    }

    /**
     * Broadcast menu update to trigger refresh
     */
    private function broadcastMenuUpdate()
    {
        try {
            cache()->put('menu_last_updated', now()->timestamp, 60);
            Log::info('Resto menu update broadcasted', ['timestamp' => now()->timestamp]);
        } catch (\Exception $e) {
            Log::error('Failed to broadcast resto menu update: '.$e->getMessage());
        }
    }

    /**
     * Get sales that have only resto items (no kitchen items)
     */
    private function restoSalesQuery()
    {
        return Sale::query()->whereHas('saleItems', function ($query) {
            // Resto items = items where category is NOT kitchen category
            $query->whereHas('item.category', function ($categoryQuery) {
                $categoryQuery->where('is_kitchen_category', 0)->orWhereNull('is_kitchen_category');
            });
        });
    }

    /**
     * Get sale items that are resto items (non-kitchen)
     */
    private function restoSaleItemsQuery(int $saleId)
    {
        return SaleItem::where('sale_id', $saleId)
            ->whereNull('kitchen_status')
            ->whereNull('kitchen_item_id')
            ->whereHas('item.category', function ($query) {
                $query->where('is_kitchen_category', 0)->orWhereNull('is_kitchen_category');
            });
    }

    /**
     * Check if a sale item is a kitchen item
     */
    private function isKitchenSaleItem(SaleItem $saleItem): bool
    {
        if (! is_null($saleItem->kitchen_item_id) || ! is_null($saleItem->kitchen_status)) {
            return true;
        }
        if ((string) optional($saleItem->item)->menu_visibility === 'kitchen') {
            return true;
        }

        return (bool) optional(optional($saleItem->item)->category)->is_kitchen_category;
    }
}
