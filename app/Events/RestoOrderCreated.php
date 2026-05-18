<?php

namespace App\Events;

use App\Models\Sale;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RestoOrderCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Sale $order
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel('resto.orders'),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->order->id,
            'txn_number' => $this->order->txn_number,
            'order_type' => $this->order->order_type,
            'status' => $this->order->status,
            'total_amount' => $this->order->total_amount,
            'room_number' => $this->order->room_number,
            'payment_method_name' => $this->order->paymentMethod?->name,
            'created_at' => $this->order->created_at?->toIso8601String(),
            'items' => $this->order->saleItems->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'quantity' => $item->quantity,
                'size' => $item->size,
                'temperature' => $item->temperature,
                'notes' => $item->notes,
            ])->toArray(),
        ];
    }
}
