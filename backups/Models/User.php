<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    public const INACTIVITY_DAYS = 14;

    const ROLE_ADMIN = 'admin';
    const ROLE_RESTO_ADMIN = 'resto_admin';
    const ROLE_RESTO = 'resto';
    const ROLE_KITCHEN = 'kitchen';
    const ROLE_CUSTOMER = 'customer';

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_active',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function hasRole(string $role): bool
    {
        return $this->role === $role;
    }

    public function scopeRole($query, $role)
    {
        return $query->where('role', $role);
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isRestoAdmin(): bool
    {
        return $this->role === self::ROLE_RESTO_ADMIN;
    }

    public function isResto(): bool
    {
        return $this->role === self::ROLE_RESTO;
    }

    public function isKitchen(): bool
    {
        return $this->role === self::ROLE_KITCHEN;
    }

    public function isCustomer(): bool
    {
        return $this->role === self::ROLE_CUSTOMER;
    }

    public function isInactiveBeyondThreshold(?Carbon $now = null): bool
    {
        if (! $this->is_active) {
            return true;
        }

        if (! $this->last_login_at) {
            return false;
        }

        $now = $now ?: now();

        return $this->last_login_at->lte($now->copy()->subDays(self::INACTIVITY_DAYS));
    }

    public static function deactivateInactiveAccounts(?Carbon $now = null): int
    {
        $now = $now ?: now();
        $threshold = $now->copy()->subDays(self::INACTIVITY_DAYS);

        return static::query()
            ->where('is_active', true)
            ->whereNotNull('last_login_at')
            ->where('last_login_at', '<=', $threshold)
            ->update([
                'is_active' => false,
                'updated_at' => $now,
            ]);
    }
}
