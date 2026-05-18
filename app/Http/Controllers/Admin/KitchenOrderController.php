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

class KitchenOrderController extends Controller
{
    /**
     * Display the Kitchen Order Monitor screen
     */
    public function index(Request $request)
    {
        $dateFilter = $request->get('date', now()->format('Y-m-d'));

        // Get current user's role to determine which kitchen they are in
        $userRole = auth()->user()->role;

        // Get orders with kitchen items
        $orders = $this->kitchenSalesQuery()
            ->with(['saleItems.kitchenItem.category', 'saleItems.item:id,name,menu_visibility', 'customer', 'paymentMethod'])
            ->whereIn('status', ['pending', 'preparing', 'ready', 'completed'])
            ->whereDate('created_at', $dateFilter)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($order) use ($userRole) {
                // Get only kitchen items for THIS specific kitchen
                $kitchenItems = [];
                foreach ($order->saleItems as $item) {
                    if ($this->isKitchenSaleItemForRole($item, $userRole)) {
                        // Load the kitchen item relation if it exists
                        if ($item->kitchen_item_id && ! $item->relationLoaded('kitchenItem')) {
                            $item->load('kitchenItem');
                        }

                        // Load the regular item relation if it exists
                        if ($item->item_id && ! $item->relationLoaded('item')) {
                            $item->load('item');
                        }

                        // Determine kitchen_type from menu_visibility
                        $kitchenType = 'kitchen'; // default to kitchen (food)
                        $menuVisibility = null;

                        if ($item->kitchenItem) {
                            $menuVisibility = $item->kitchenItem->menu_visibility;
                        } elseif ($item->item) {
                            $menuVisibility = $item->item->menu_visibility;
                        }

                        if ($menuVisibility === 'both' || $menuVisibility === 'resto') {
                            $kitchenType = 'resto';
                        }

                        $kitchenItems[] = [
                            'id' => $item->id,
                            'name' => $item->item_name,
                            'quantity' => $item->quantity,
                            'kitchen_status' => $item->kitchen_status ?? 'pending',
                            'notes' => $this->cleanNotes($item->special_instructions),
                            'kitchen_type' => $kitchenType,
                        ];
                    }
                }

                $isHotel = $order->paymentMethod && $order->paymentMethod->name === 'Hotel';

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'txn_number' => $order->txn_number,
                    'order_type' => $order->order_type ?? 'takeout',
                    'customer_name' => $order->customer_name ?? 'Walk-in Customer',
                    'is_hotel' => $isHotel,
                    'payment_method_name' => $order->paymentMethod ? $order->paymentMethod->name : null,
                    'room_number' => $order->room_number ?? null,
                    'created_at' => $order->created_at->toIso8601String(),
                    'status' => $order->status,
                    'kitchen_status' => $this->getKitchenStatus($kitchenItems),
                    'items' => $kitchenItems,
                    'item_count' => count($kitchenItems),
                    'notes' => $order->notes,
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
                'pending' => $orders->where('kitchen_status', 'pending')->count(),
                'preparing' => $orders->where('kitchen_status', 'preparing')->count(),
                'ready' => $orders->where('kitchen_status', 'ready')->count(),
                'completed' => $orders->where('kitchen_status', 'completed')->count(),
            ],
        ]);
    }

    /**
     * Check for new kitchen orders (polling endpoint)
     */
    public function checkNewOrders(Request $request)
    {
        $since = $request->get('since', now()->subMinutes(5)->timestamp);
        $sinceDateTime = date('Y-m-d H:i:s', $since);
        $dateFilter = $request->get('date', now()->format('Y-m-d'));

        $userRole = auth()->user()->role;

        // Get all kitchen orders for the date (not just new ones)
        $orders = $this->kitchenSalesQuery()
            ->with(['saleItems.kitchenItem.category', 'saleItems.item', 'customer', 'paymentMethod'])
            ->whereIn('status', ['pending', 'preparing', 'ready', 'completed'])
            ->whereDate('created_at', $dateFilter)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($order) use ($userRole) {
                $kitchenItems = [];
                $allItemsReady = true;

                foreach ($order->saleItems as $item) {
                    if ($this->isKitchenSaleItemForRole($item, $userRole)) {
                        if ($item->kitchen_item_id && ! $item->relationLoaded('kitchenItem')) {
                            $item->load('kitchenItem');
                        }
                        if ($item->item_id && ! $item->relationLoaded('item')) {
                            $item->load('item');
                        }

                        $kitchenType = 'kitchen';
                        $menuVisibility = null;

                        if ($item->kitchenItem) {
                            $menuVisibility = $item->kitchenItem->menu_visibility;
                        } elseif ($item->item) {
                            $menuVisibility = $item->item->menu_visibility;
                        }

                        if ($menuVisibility === 'both' || $menuVisibility === 'resto') {
                            $kitchenType = 'resto';
                        }

                        $itemStatus = $item->kitchen_status ?? 'pending';
                        if ($itemStatus !== 'ready' && $itemStatus !== 'completed') {
                            $allItemsReady = false;
                        }

                        $kitchenItems[] = [
                            'id' => $item->id,
                            'name' => $item->item_name,
                            'quantity' => $item->quantity,
                            'kitchen_status' => $itemStatus,
                            'notes' => $this->cleanNotes($item->special_instructions),
                            'kitchen_type' => $kitchenType,
                        ];
                    }
                }

                // Determine order-level status based on kitchen items
                $orderStatus = $order->status;
                if ($orderStatus === 'pending' && $allItemsReady) {
                    $orderStatus = 'ready';
                }

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'txn_number' => $order->txn_number,
                    'order_type' => $order->order_type ?? 'takeout',
                    'customer_name' => $order->customer_name ?? 'Walk-in Customer',
                    'is_hotel' => $order->paymentMethod && $order->paymentMethod->name === 'Hotel',
                    'room_number' => $order->room_number ?? null,
                    'created_at' => $order->created_at->toIso8601String(),
                    'status' => $orderStatus, // Updated status based on kitchen items
                    'all_items_ready' => $allItemsReady,
                    'items' => $kitchenItems,
                    'item_count' => count($kitchenItems),
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

    /**
     * Start preparing an order
     * FIXED: Only updates items that belong to the current kitchen
     */
    public function startPreparing(Request $request, Sale $order)
    {
        DB::beginTransaction();
        try {
            $userRole = auth()->user()->role;

            // Update ONLY kitchen items that belong to THIS kitchen
            foreach ($order->saleItems as $item) {
                if ($this->isKitchenSaleItemForRole($item, $userRole)) {
                    $item->update(['kitchen_status' => 'preparing']);
                }
            }

            DB::commit();

            $order->load(['saleItems', 'paymentMethod']);
            event(new KitchenOrderStatusChanged($order, 'preparing'));

            Log::info("Kitchen ({$userRole}) started preparing order #{$order->id}");

            return response()->json([
                'success' => true,
                'message' => "Order #{$order->id} started preparing",
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Kitchen start preparing failed: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mark order as ready
     * FIXED: Only updates items that belong to the current kitchen
     */
    public function markReady(Request $request, Sale $order)
    {
        DB::beginTransaction();
        try {
            $userRole = auth()->user()->role;

            // Update ONLY kitchen items that belong to THIS kitchen
            foreach ($order->saleItems as $item) {
                if ($this->isKitchenSaleItemForRole($item, $userRole)) {
                    $item->update(['kitchen_status' => 'ready']);
                }
            }

            DB::commit();

            $order->load(['saleItems', 'paymentMethod']);
            event(new KitchenOrderStatusChanged($order, 'ready'));

            Log::info("Kitchen ({$userRole}) marked order #{$order->id} as ready");

            return response()->json([
                'success' => true,
                'message' => "Order #{$order->id} is ready",
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Kitchen mark ready failed: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get sales that have kitchen items
     */
    private function kitchenSalesQuery()
    {
        return Sale::query()->whereHas('saleItems', function ($query) {
            $query->whereNotNull('kitchen_item_id')
                ->orWhereNotNull('kitchen_status');
        });
    }

    /**
     * Check if a sale item is a kitchen item
     */
    private function isKitchenSaleItem(SaleItem $item): bool
    {
        return ! is_null($item->kitchen_item_id) || ! is_null($item->kitchen_status);
    }

    /**
     * NEW: Check if a sale item belongs to a specific kitchen role
     *
     * @param  SaleItem  $item  The sale item to check
     * @param  string  $userRole  The current user's role ('kitchen' or 'kitchen_resto')
     * @return bool True if the item belongs to this kitchen
     */
    private function isKitchenSaleItemForRole(SaleItem $item, string $userRole): bool
    {
        // First check if it's a kitchen item at all
        if (! $this->isKitchenSaleItem($item)) {
            Log::info('Kitchen item check FAILED - not a kitchen item', [
                'sale_item_id' => $item->id,
                'kitchen_status' => $item->kitchen_status,
                'kitchen_item_id' => $item->kitchen_item_id,
            ]);

            return false;
        }

        // Load the kitchen item relation if it exists
        if ($item->kitchen_item_id && ! $item->relationLoaded('kitchenItem')) {
            $item->load('kitchenItem');
        }

        // Load the regular item relation if it exists
        if ($item->item_id && ! $item->relationLoaded('item')) {
            $item->load('item');
        }

        // Get menu_visibility from the kitchen_item or regular item
        $menuVisibility = null;

        if ($item->kitchenItem) {
            $menuVisibility = $item->kitchenItem->menu_visibility;
        } elseif ($item->item) {
            $menuVisibility = $item->item->menu_visibility;
        }

        // Debug logging - check admin/manager FIRST before any other checks
        Log::info('Kitchen item role check START', [
            'sale_item_id' => $item->id,
            'item_id' => $item->item_id,
            'kitchen_item_id' => $item->kitchen_item_id,
            'user_role' => $userRole,
            'menu_visibility' => $menuVisibility,
            'has_item' => $item->item ? true : false,
            'has_kitchen_item' => $item->kitchenItem ? true : false,
            'is_admin_or_manager' => in_array($userRole, ['admin', 'manager']),
        ]);

        // Admin and manager can see ALL kitchen items - CHECK THIS FIRST!
        if (in_array($userRole, ['admin', 'manager'])) {
            Log::info('Kitchen item check PASSED - admin/manager role', [
                'sale_item_id' => $item->id,
                'user_role' => $userRole,
            ]);

            return true;
        }

        // If menu_visibility is 'both', it appears in both kitchens
        if ($menuVisibility === 'both') {
            Log::info('Kitchen item check PASSED - menu_visibility both', [
                'sale_item_id' => $item->id,
                'menu_visibility' => $menuVisibility,
            ]);

            return true;
        }

        // Match the menu_visibility to the user's role
        // 'kitchen' role sees items with menu_visibility = 'kitchen'
        // 'kitchen_resto' role sees items with menu_visibility = 'resto'
        if ($userRole === 'kitchen' && $menuVisibility === 'kitchen') {
            Log::info('Kitchen item check PASSED - kitchen role + kitchen visibility', [
                'sale_item_id' => $item->id,
                'user_role' => $userRole,
                'menu_visibility' => $menuVisibility,
            ]);

            return true;
        }

        if ($userRole === 'kitchen_resto' && $menuVisibility === 'resto') {
            Log::info('Kitchen item check PASSED - kitchen_resto role + resto visibility', [
                'sale_item_id' => $item->id,
                'user_role' => $userRole,
                'menu_visibility' => $menuVisibility,
            ]);

            return true;
        }

        Log::info('Kitchen item check FAILED - no match', [
            'sale_item_id' => $item->id,
            'user_role' => $userRole,
            'menu_visibility' => $menuVisibility,
        ]);

        return false;
    }

    /**
     * Get overall kitchen status for an order
     */
    private function getKitchenStatus($items)
    {
        if (empty($items)) {
            return 'pending';
        }

        $statuses = array_column($items, 'kitchen_status');
        if (count(array_unique($statuses)) === 1) {
            return $statuses[0];
        }

        if (in_array('pending', $statuses)) {
            return 'pending';
        }
        if (in_array('preparing', $statuses)) {
            return 'preparing';
        }
        if (in_array('ready', $statuses)) {
            return 'ready';
        }

        return 'completed';
    }

    /**
     * Clean notes from special instructions
     */
    private function cleanNotes($instructions)
    {
        if (empty($instructions)) {
            return null;
        }

        // Remove size and temperature markers
        $cleaned = preg_replace('/\[size:[^\]]+\]/', '', $instructions);
        $cleaned = preg_replace('/\[temp:[^\]]+\]/', '', $cleaned);
        $cleaned = preg_replace('/\[variant:[^\]]+\]/', '', $cleaned);

        return trim($cleaned) ?: null;
    }
}
