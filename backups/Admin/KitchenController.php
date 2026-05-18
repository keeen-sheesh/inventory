<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class KitchenController extends Controller
{
    public function index(Request $request)
    {
        // Get date filter
        $dateFilter = $request->get('date', now()->format('Y-m-d'));
        
        // Get last check time from session
        $lastCheck = $request->session()->get('last_kitchen_check', now()->subMinutes(5)->timestamp);
        
        // Get orders with kitchen items - INCLUDING COMPLETED ORDERS
        $orders = $this->kitchenSalesQuery()
            ->with(['saleItems.item.category', 'customer', 'paymentMethod'])
            ->whereIn('status', ['pending', 'preparing', 'ready', 'completed']) // ADDED 'completed'
            ->whereDate('created_at', $dateFilter)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function($order) {
                // Get only kitchen items
                $kitchenItems = [];
                foreach ($order->saleItems as $item) {
                    if ($this->isKitchenSaleItem($item)) {
                        $kitchenItems[] = [
                            'id' => $item->id,
                            'name' => $item->item->name,
                            'quantity' => $item->quantity,
                            'kitchen_status' => $item->kitchen_status ?? 'pending',
                            'started_at' => $item->kitchen_started_at,
                            'completed_at' => $item->kitchen_completed_at,
                            'notes' => $item->special_instructions,
                        ];
                    }
                }

                $itemsList = collect($kitchenItems)->map(function($item) {
                    return $item['quantity'] . 'x ' . $item['name'];
                })->implode(', ');

                // Check if order is hotel based on payment method name
                $isHotel = $order->paymentMethod && $order->paymentMethod->name === 'Hotel';
                
                // Clean customer name for display
                $customerName = $order->customer_name ?? 'Walk-in Customer';

                return [
                    'id' => $order->id,
                    'order_number' => 'ORD-' . str_pad($order->id, 5, '0', STR_PAD_LEFT),
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
                    'kitchen_status' => $order->kitchen_status ?? 'pending',
                    'items' => $kitchenItems,
                    'items_list' => $itemsList,
                    'item_count' => count($kitchenItems),
                    'notes' => $order->notes,
                ];
            })
            ->filter(function($order) {
                return $order['item_count'] > 0;
            })
            ->values();

        // Get new orders count (excluding completed for new order sound)
        $newOrdersCount = $this->kitchenSalesQuery()
            ->where('status', 'pending')
            ->where('created_at', '>', date('Y-m-d H:i:s', $lastCheck))
            ->count();
        
        // Also check for orders that might have been updated (status changed) - excluding completed
        $updatedOrdersCount = $this->kitchenSalesQuery()
            ->whereIn('status', ['pending', 'preparing', 'ready'])
            ->where('updated_at', '>', date('Y-m-d H:i:s', $lastCheck))
            ->count();
        
        $hasNewOrder = ($newOrdersCount > 0 || $updatedOrdersCount > 0);
        
        // Update last check time
        $request->session()->put('last_kitchen_check', now()->timestamp);

        // Broadcast menu update to POS
        $this->broadcastMenuUpdate();

        Log::info('Final orders sent to kitchen:', [
            'count' => $orders->count(),
            'has_new' => $hasNewOrder,
            'pending' => $orders->where('kitchen_status', 'pending')->count(),
            'preparing' => $orders->where('kitchen_status', 'preparing')->count(),
            'ready' => $orders->where('kitchen_status', 'ready')->count(),
            'completed' => $orders->where('kitchen_status', 'completed')->count()
        ]);

        // Get statistics for dashboard
        $todayOrders = $this->kitchenSalesQuery()
            ->whereDate('created_at', now()->format('Y-m-d'))
            ->count();

        $weekStart = now()->startOfWeek();
        $thisWeekOrders = $this->kitchenSalesQuery()
            ->whereBetween('created_at', [$weekStart, now()])
            ->count();

        $monthStart = now()->startOfMonth();
        $thisMonthOrders = $this->kitchenSalesQuery()
            ->whereBetween('created_at', [$monthStart, now()])
            ->count();

        return Inertia::render('Admin/Kitchen', [
            'orders' => $orders,
            'hasNewOrder' => $hasNewOrder,
            'currentTime' => now()->timestamp,
            'currentDate' => $dateFilter,
            'stats' => [
                'today' => $todayOrders,
                'thisWeek' => $thisWeekOrders,
                'thisMonth' => $thisMonthOrders,
            ],
        ]);
    }

    public function checkNewOrders(Request $request)
{
    $since = $request->get('since', now()->subMinutes(5)->timestamp);
    $sinceDateTime = date('Y-m-d H:i:s', $since);
    $dateFilter = $request->get('date', now()->format('Y-m-d'));
    
    Log::info('========== KITCHEN POLLING CHECK ==========');
    Log::info('Polling parameters:', [
        'since' => $since,
        'sinceDateTime' => $sinceDateTime,
        'dateFilter' => $dateFilter
    ]);
    
    // Check if there are ANY new or updated orders since last check
    $newOrdersQuery = $this->kitchenSalesQuery()
        ->whereIn('status', ['pending', 'preparing', 'ready', 'completed'])
        ->where(function($query) use ($sinceDateTime) {
            $query->where('created_at', '>', $sinceDateTime)
                  ->orWhere('updated_at', '>', $sinceDateTime);
        })
        ->whereDate('created_at', $dateFilter);
    
    $newOrdersCount = $newOrdersQuery->count();
    $hasNewOrders = $newOrdersCount > 0;
    
    Log::info('New orders found:', ['count' => $newOrdersCount]);
    
    // Get all kitchen orders for the date
    $allOrdersQuery = $this->kitchenSalesQuery()
        ->with(['saleItems.item.category', 'customer', 'paymentMethod'])
        ->whereIn('status', ['pending', 'preparing', 'ready', 'completed'])
        ->whereDate('created_at', $dateFilter)
        ->orderBy('created_at', 'asc');
    
    $allOrdersCount = $allOrdersQuery->count();
    Log::info('Total orders in date range:', ['count' => $allOrdersCount]);
    
    $allOrders = $allOrdersQuery->get()
        ->map(function($order) {
            $kitchenItems = [];
            foreach ($order->saleItems as $item) {
                if ($this->isKitchenSaleItem($item)) {
                    $kitchenItems[] = [
                        'id' => $item->id,
                        'name' => $item->item->name,
                        'quantity' => $item->quantity,
                        'kitchen_status' => $item->kitchen_status ?? 'pending',
                        'notes' => $item->special_instructions,
                    ];
                }
            }

            $isHotel = $order->paymentMethod && $order->paymentMethod->name === 'Hotel';
            $customerName = $order->customer_name ?? 'Walk-in Customer';

            return [
                'id' => $order->id,
                'order_number' => 'ORD-' . str_pad($order->id, 5, '0', STR_PAD_LEFT),
                'order_type' => $order->order_type ?? 'takeout',
                'customer_name' => $customerName,
                'is_hotel' => $isHotel,
                'payment_method_name' => $order->paymentMethod ? $order->paymentMethod->name : null,
                'room_number' => $order->room_number ?? null,
                'created_at' => $order->created_at->toIso8601String(),
                'created_at_raw' => $order->created_at->timestamp,
                'created_at_full' => $order->created_at->toIso8601String(),
                'kitchen_status' => $order->kitchen_status ?? 'pending',
                'items' => $kitchenItems,
                'item_count' => count($kitchenItems),
            ];
        })
        ->filter(function($order) {
            return $order['item_count'] > 0;
        })
        ->values();

    Log::info('Kitchen polling response:', [
        'success' => true,
        'orders_count' => $allOrders->count(),
        'has_new_orders' => $hasNewOrders,
        'timestamp' => now()->timestamp
    ]);

    return response()->json([
        'success' => true,
        'orders' => $allOrders,
        'has_new_orders' => $hasNewOrders,
        'timestamp' => now()->timestamp,
        'count' => $allOrders->count(),
    ]);
}

    public function startPreparing(Request $request, Sale $order)
    {
        DB::beginTransaction();
        try {
            $order->update([
                'status' => 'preparing',
                'kitchen_status' => 'preparing'
            ]);

            $this->kitchenSaleItemsQuery($order->id)
                ->update([
                    'kitchen_status' => 'preparing',
                    'kitchen_started_at' => now(),
                ]);

            DB::commit();

            // Broadcast update to POS
            $this->broadcastMenuUpdate();

            Log::info("Kitchen started preparing order #{$order->id}");

            return response()->json([
                'success' => true,
                'message' => "Order #{$order->id} started preparing"
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Start preparing failed: ' . $e->getMessage());
            return response()->json([
                'success' => false, 
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * MARK AS READY - Kitchen marks order as ready for pickup
     */
    public function markReady(Request $request, Sale $order)
    {
        DB::beginTransaction();
        try {
            $order->update([
                'status' => 'ready',
                'kitchen_status' => 'ready'
            ]);

            $this->kitchenSaleItemsQuery($order->id)
                ->update([
                    'kitchen_status' => 'ready',
                    'kitchen_completed_at' => now(),
                ]);

            DB::commit();

            // Broadcast update to POS
            $this->broadcastMenuUpdate();

            Log::info("Kitchen marked order #{$order->id} as READY FOR PICKUP");

            return response()->json([
                'success' => true,
                'message' => "Order #{$order->id} is ready for pickup"
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Mark ready failed: ' . $e->getMessage());
            return response()->json([
                'success' => false, 
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * This method is now only used when POS completes the order
     * Kitchen will see these orders in the Completed tab
     */
    public function markComplete(Request $request, Sale $order)
    {
        DB::beginTransaction();
        try {
            $order->update([
                'status' => 'completed',
                'kitchen_status' => 'completed'
            ]);

            $this->kitchenSaleItemsQuery($order->id)
                ->update([
                    'kitchen_status' => 'completed',
                    'kitchen_completed_at' => now(),
                ]);

            DB::commit();

            // Broadcast update to POS
            $this->broadcastMenuUpdate();

            Log::info("Order #{$order->id} completed by POS");

            return response()->json([
                'success' => true,
                'message' => "Order #{$order->id} completed"
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Mark complete failed: ' . $e->getMessage());
            return response()->json([
                'success' => false, 
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function updateStatus(Request $request, Sale $sale)
    {
        $request->validate([
            'status' => 'required|in:pending,preparing,ready,completed',
        ]);

        DB::beginTransaction();
        try {
            $sale->update(['kitchen_status' => $request->status]);

            $this->kitchenSaleItemsQuery($sale->id)
                ->update([
                    'kitchen_status' => $request->status,
                    'kitchen_started_at' => $request->status === 'preparing' ? now() : DB::raw('kitchen_started_at'),
                    'kitchen_completed_at' => $request->status === 'ready' || $request->status === 'completed' ? now() : null,
                ]);

            if ($request->status === 'ready') {
                $sale->update(['status' => 'ready']);
            } elseif ($request->status === 'completed') {
                $sale->update(['status' => 'completed']);
            }

            DB::commit();

            // Broadcast update to POS
            $this->broadcastMenuUpdate();

            return response()->json([
                'success' => true,
                'message' => "Order #{$sale->id} marked as {$request->status}"
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false, 
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function updateItemStatus(Request $request, SaleItem $saleItem)
    {
        $request->validate([
            'status' => 'required|in:pending,preparing,ready,completed',
        ]);

        try {
            $saleItem->update([
                'kitchen_status' => $request->status,
                'kitchen_started_at' => $request->status === 'preparing' ? now() : $saleItem->kitchen_started_at,
                'kitchen_completed_at' => $request->status === 'ready' || $request->status === 'completed' ? now() : null,
            ]);

            $this->updateOrderKitchenStatus($saleItem->sale_id);

            // Broadcast update to POS
            $this->broadcastMenuUpdate();

            return response()->json([
                'success' => true,
                'message' => "Item updated to {$request->status}"
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false, 
                'error' => $e->getMessage()
            ], 500);
        }
    }

    private function updateOrderKitchenStatus($saleId)
    {
        $sale = Sale::with(['saleItems' => function($query) {
            $this->applyKitchenSaleItemsConstraint($query);
        }])->find($saleId);
        
        if (!$sale) return;

        $kitchenItems = $sale->saleItems;

        if ($kitchenItems->isEmpty()) return;

        $allCompleted = $kitchenItems->every(fn($item) => $item->kitchen_status === 'completed');
        $allReady = $kitchenItems->every(fn($item) => $item->kitchen_status === 'ready');
        $anyPreparing = $kitchenItems->contains(fn($item) => $item->kitchen_status === 'preparing');

        if ($allCompleted) {
            $status = 'completed';
            $sale->update(['status' => 'completed']);
        } elseif ($allReady) {
            $status = 'ready';
            $sale->update(['status' => 'ready']);
        } elseif ($anyPreparing) {
            $status = 'preparing';
        } else {
            $status = 'pending';
        }

        $sale->update(['kitchen_status' => $status]);
    }

    public function filterByDate(Request $request)
    {
        $date = $request->get('date', now()->format('Y-m-d'));
        
        $orders = $this->kitchenSalesQuery()
            ->with(['saleItems.item.category', 'customer', 'paymentMethod'])
            ->whereIn('status', ['pending', 'preparing', 'ready', 'completed']) // ADDED 'completed'
            ->whereDate('created_at', $date)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function($order) {
                $kitchenItems = [];
                foreach ($order->saleItems as $item) {
                    if ($this->isKitchenSaleItem($item)) {
                        $kitchenItems[] = [
                            'id' => $item->id,
                            'name' => $item->item->name,
                            'quantity' => $item->quantity,
                            'kitchen_status' => $item->kitchen_status ?? 'pending',
                            'notes' => $item->special_instructions,
                        ];
                    }
                }

                $isHotel = $order->paymentMethod && $order->paymentMethod->name === 'Hotel';
                $customerName = $order->customer_name ?? 'Walk-in Customer';

                return [
                    'id' => $order->id,
                    'order_number' => 'ORD-' . str_pad($order->id, 5, '0', STR_PAD_LEFT),
                    'order_type' => $order->order_type ?? 'takeout',
                    'customer_name' => $customerName,
                    'is_hotel' => $isHotel,
                    'payment_method_name' => $order->paymentMethod ? $order->paymentMethod->name : null,
                    'room_number' => $order->room_number ?? null,
                    'created_at' => $order->created_at->toIso8601String(),
                    'kitchen_status' => $order->kitchen_status ?? 'pending',
                    'items' => $kitchenItems,
                    'item_count' => count($kitchenItems),
                ];
            })
            ->filter(function($order) {
                return $order['item_count'] > 0;
            })
            ->values();

        return response()->json([
            'success' => true,
            'orders' => $orders,
            'date' => $date
        ]);
    }

    public function testAlarm()
    {
        return response()->json([
            'success' => true, 
            'message' => 'Test alarm triggered',
            'time' => now()->toDateTimeString()
        ]);
    }

    /**
     * Broadcast menu update to POS
     */
    private function broadcastMenuUpdate()
    {
        try {
            cache()->put('menu_last_updated', now()->timestamp, 60);
            Log::info('Menu update broadcasted', ['timestamp' => now()->timestamp]);
        } catch (\Exception $e) {
            Log::error('Failed to broadcast menu update: ' . $e->getMessage());
        }
    }

    private function kitchenSalesQuery()
    {
        return Sale::query()->whereHas('saleItems', function ($query) {
            $this->applyKitchenSaleItemsConstraint($query);
        });
    }

    private function kitchenSaleItemsQuery(int $saleId)
    {
        return SaleItem::where('sale_id', $saleId)
            ->where(function ($query) {
                $this->applyKitchenSaleItemsConstraint($query);
            });
    }

    private function applyKitchenSaleItemsConstraint($query): void
    {
        $query->where(function ($kitchenQuery) {
            $kitchenQuery->whereNotNull('kitchen_status')
                ->orWhereHas('item.category', function ($categoryQuery) {
                    $categoryQuery->where('is_kitchen_category', 1);
                });
        });
    }

    private function isKitchenSaleItem(SaleItem $saleItem): bool
    {
        if (!is_null($saleItem->kitchen_status)) {
            return true;
        }

        return (bool) optional(optional($saleItem->item)->category)->is_kitchen_category;
    }
}
