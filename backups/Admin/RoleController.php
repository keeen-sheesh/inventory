<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class RoleController extends Controller
{
    /**
     * Display users and role management page.
     */
    public function index(Request $request): Response
    {
        User::deactivateInactiveAccounts();

        $actor = $request->user();
        $manageableRoles = $this->manageableRoles($actor);

        $users = User::query()
            ->orderByDesc('id')
            ->get()
            ->map(function (User $user) use ($actor, $manageableRoles) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'is_active' => (bool) $user->is_active,
                    'last_login_at' => optional($user->last_login_at)->toDateTimeString(),
                    'created_at' => optional($user->created_at)->toDateTimeString(),
                    'can_toggle' => $actor->id !== $user->id && in_array($user->role, $manageableRoles, true),
                ];
            })
            ->values();

        return Inertia::render('Admin/Roles', [
            'users' => $users,
            'roleOptions' => collect($this->roleOptions())
                ->filter(fn (array $option) => in_array($option['value'], $manageableRoles, true))
                ->values()
                ->all(),
            'inactivityDays' => User::INACTIVITY_DAYS,
        ]);
    }

    /**
     * Create a new user account.
     */
    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $manageableRoles = $this->manageableRoles($actor);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'role' => ['required', Rule::in($manageableRoles)],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'role' => $validated['role'],
            'password' => Hash::make($validated['password']),
            'is_active' => true,
            'last_login_at' => null,
        ]);

        return redirect()->route('admin.roles.index');
    }

    /**
     * Toggle a user account active/deactivated state.
     */
    public function toggleActive(Request $request, User $user): RedirectResponse
    {
        $actor = $request->user();
        $manageableRoles = $this->manageableRoles($actor);

        abort_unless(in_array($user->role, $manageableRoles, true), 403);

        if ($actor->id === $user->id) {
            return redirect()->route('admin.roles.index');
        }

        $user->forceFill([
            'is_active' => ! $user->is_active,
        ])->save();

        return redirect()->route('admin.roles.index');
    }

    /**
     * Roles manageable by current user.
     *
     * @return array<int, string>
     */
    private function manageableRoles(User $actor): array
    {
        if ($actor->isAdmin()) {
            return ['admin', 'resto_admin', 'resto', 'kitchen', 'customer'];
        }

        return ['resto', 'kitchen', 'customer'];
    }

    /**
     * Role labels for select fields and UI.
     *
     * @return array<int, array{value: string, label: string}>
     */
    private function roleOptions(): array
    {
        return [
            ['value' => 'admin', 'label' => 'Administrator'],
            ['value' => 'resto_admin', 'label' => 'Manager'],
            ['value' => 'resto', 'label' => 'Cashier'],
            ['value' => 'kitchen', 'label' => 'Kitchen'],
            ['value' => 'customer', 'label' => 'Customer'],
        ];
    }
}
