<?php

namespace Tests\Feature;

use App\Models\CashierShift;
use App\Models\CashierShiftTransaction;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashierShiftTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_can_check_in_only_once(): void
    {
        $cashier = User::factory()->create(['role' => 'cashier']);

        $this->actingAs($cashier)
            ->postJson('/cashier/shifts/check-in', ['starting_balance' => 100])
            ->assertOk()
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('cashier_shifts', [
            'user_id' => $cashier->id,
            'status' => 'open',
        ]);

        $this->actingAs($cashier)
            ->postJson('/cashier/shifts/check-in', ['starting_balance' => 50])
            ->assertStatus(409);
    }

    public function test_transactions_are_blocked_without_open_shift(): void
    {
        $cashier = User::factory()->create(['role' => 'cashier']);

        $this->actingAs($cashier)
            ->postJson('/cashier/transactions', [
                'type' => 'expense',
                'amount' => 10,
                'description' => 'test',
            ])
            ->assertStatus(409)
            ->assertJson(['success' => false]);
    }

    public function test_check_out_generates_one_summary_receipt(): void
    {
        $cashier = User::factory()->create(['role' => 'cashier']);

        $this->actingAs($cashier)
            ->postJson('/cashier/shifts/check-in', ['starting_balance' => 100])
            ->assertOk();

        $this->actingAs($cashier)
            ->postJson('/cashier/transactions', ['type' => 'sale', 'amount' => 200])
            ->assertOk();

        $this->actingAs($cashier)
            ->postJson('/cashier/transactions', ['type' => 'expense', 'amount' => 50])
            ->assertOk();

        $response = $this->actingAs($cashier)
            ->postJson('/cashier/shifts/check-out');

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'receipt' => [
                    'cashier_id' => $cashier->id,
                ],
            ]);

        $receipt = $response->json('receipt');
        $this->assertEquals(100.0, $receipt['starting_balance']);
        $this->assertEquals(200.0, $receipt['total_sales']);
        $this->assertEquals(50.0, $receipt['total_expenses']);
        $this->assertEquals(250.0, $receipt['ending_balance']);

        // Second check-out should be blocked (no open shift).
        $this->actingAs($cashier)
            ->postJson('/cashier/shifts/check-out')
            ->assertStatus(409);
    }

    public function test_non_cashier_cannot_access_shift_endpoints_with_json(): void
    {
        $manager = User::factory()->create(['role' => 'manager']);

        $this->actingAs($manager)
            ->getJson('/cashier/shifts/current')
            ->assertStatus(403)
            ->assertJson(['success' => false]);
    }

    public function test_pos_order_creation_is_blocked_without_open_shift_for_cashier(): void
    {
        $cashier = User::factory()->create(['role' => 'cashier']);

        $this->actingAs($cashier)
            ->postJson('/cashier/pos/orders', [])
            ->assertStatus(409)
            ->assertJson(['success' => false]);
    }

    public function test_completing_a_sale_creates_exactly_one_shift_sale_transaction(): void
    {
        $cashier = User::factory()->create(['role' => 'cashier']);

        $shift = CashierShift::create([
            'user_id' => $cashier->id,
            'starting_balance' => 0,
            'check_in_time' => now(),
            'status' => 'open',
        ]);

        $sale = Sale::create([
            'user_id' => $cashier->id,
            'cashier_shift_id' => $shift->id,
            'subtotal' => 100,
            'total_amount' => 100,
            'status' => 'pending',
            'order_type' => 'dine_in',
            'people_count' => 1,
            'cards_presented' => 0,
        ]);

        $this->actingAs($cashier)
            ->postJson("/cashier/orders/{$sale->id}/complete", [])
            ->assertOk()
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('cashier_shift_transactions', [
            'shift_id' => $shift->id,
            'sale_id' => $sale->id,
            'type' => 'sale',
            'source' => 'pos',
        ]);

        $this->assertEquals(1, CashierShiftTransaction::where('sale_id', $sale->id)->count());
    }
}

