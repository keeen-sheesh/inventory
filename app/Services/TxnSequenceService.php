<?php

namespace App\Services;

use App\Models\Sale;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class TxnSequenceService
{
    /**
     * Get the next transaction sequence for a given date with proper locking.
     * Uses cache locking to prevent race conditions.
     *
     * @param string|null $txnDate Date in Y-m-d format
     * @return array{txn_date: string, txn_sequence: int, txn_number: string}
     */
    public function getNextSequence(?string $txnDate = null): array
    {
        $txnDate = $txnDate ?? now('Asia/Manila')->toDateString();
        $lockKey = 'txn_sequence:' . $txnDate;

        // Use cache lock for atomic sequence allocation
        $lock = Cache::lock($lockKey, 10);

        try {
            // Block until we get the lock (max 10 seconds)
            if (!$lock->block(10)) {
                throw new \RuntimeException('Failed to acquire sequence lock');
            }

            // Get the max sequence for today directly from sales table
            // Use a raw query with table lock for SQLite
            if (DB::getDriverName() === 'sqlite') {
                // For SQLite, use a simple max() query inside the cache lock
                $maxSequence = DB::table('sales')
                    ->whereDate('txn_date', $txnDate)
                    ->max('txn_sequence') ?? 0;
            } else {
                // For MySQL/PostgreSQL, use FOR UPDATE lock
                $maxSequence = DB::table('sales')
                    ->where('txn_date', $txnDate)
                    ->lockForUpdate()
                    ->max('txn_sequence') ?? 0;
            }

            $nextSequence = (int) $maxSequence + 1;

            return [
                'txn_date' => $txnDate,
                'txn_sequence' => $nextSequence,
                'txn_number' => $this->formatTxnNumber($txnDate, $nextSequence),
            ];
        } finally {
            // Always release the lock
            if (isset($lock)) {
                $lock->release();
            }
        }
    }

    /**
     * Format transaction number from date and sequence.
     */
    private function formatTxnNumber(string $txnDate, int $sequence): string
    {
        return sprintf(
            'TXN-%s-%03d',
            str_replace('-', '', $txnDate),
            $sequence
        );
    }

    /**
     * Get current sequence for a date (read-only, no lock).
     */
    public function getCurrentSequence(string $txnDate): ?int
    {
        $sequence = Sale::where('txn_date', $txnDate)
            ->max('txn_sequence');

        return $sequence !== null ? (int) $sequence : null;
    }

    /**
     * Reset sequence for a specific date (admin use only).
     */
    public function resetSequence(string $txnDate): void
    {
        Cache::forget('txn_sequence:' . $txnDate);
    }
}
