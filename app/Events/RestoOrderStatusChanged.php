<?php

namespace App\Events;

use App\Models\Sale;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RestoOrderStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Sale $order,
        public string $status
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
            'status' => $this->status,
            'updated_at' => $this->order->updated_at?->toIso8601String(),
            'items' => $this->order->saleItems->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'quantity' => $item->quantity,
                'size' => $item->size,
            ])->toArray(),
        ];
    }
}
