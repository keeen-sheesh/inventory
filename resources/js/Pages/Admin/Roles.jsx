import InputError from '@/Components/InputError';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';

const roleLabels = {
    admin:         'Administrator',
    manager:       'Manager',
    cashier:       'Cashier',
    resto:         'Cashier (Legacy)',
    kitchen:       'Kitchen',
    kitchen_resto: 'Kitchen Resto',
    customer:      'Customer',
};

const formatDateTime = (value) => {
    if (!value) {
        return 'Never';
    }

    return new Date(value).toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function Roles({
    auth,
    users = [],
    roleOptions = [],
    inactivityDays = 14,
}) {
    const { data, setData, post, processing, errors, reset, recentlySuccessful } = useForm({
        name: '',
        email: '',
        role: roleOptions[0]?.value || 'resto',
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('admin.roles.users.store'), {
            preserveScroll: true,
            onSuccess: () => reset('name', 'email', 'password', 'password_confirmation'),
        });
    };

    const toggleActive = (userId) => {
        router.post(route('admin.roles.users.toggle-active', userId), {}, { preserveScroll: true });
    };

    const deleteUser = (userId, userName) => {
        if (confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
            router.delete(route('admin.roles.users.destroy', userId), {
                preserveScroll: true,
            });
        }
    };

    const isAdmin = auth?.user?.role === 'admin';

    return (
        <AdminLayout auth={auth}>
            <Head title="Roles and Users" />

            <div className="space-y-6">
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Roles</p>
                    <h1 className="mt-1 text-2xl font-bold text-gray-900">User Access Management</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Accounts are automatically deactivated after {inactivityDays} days without login.
                    </p>
                </section>

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm xl:col-span-2">
                        <h2 className="text-lg font-semibold text-gray-900">Add User</h2>
                        <form className="mt-4 space-y-4" onSubmit={submit}>
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                    Name
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                />
                                <InputError message={errors.name} className="mt-2" />
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                />
                                <InputError message={errors.email} className="mt-2" />
                            </div>

                            <div>
                                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                                    Role
                                </label>
                                <select
                                    id="role"
                                    value={data.role}
                                    onChange={(e) => setData('role', e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                >
                                    {roleOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.role} className="mt-2" />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                />
                                <InputError message={errors.password} className="mt-2" />
                            </div>

                            <div>
                                <label htmlFor="password_confirmation" className="block text-sm font-medium text-gray-700">
                                    Confirm Password
                                </label>
                                <input
                                    id="password_confirmation"
                                    type="password"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                            >
                                {processing ? 'Creating...' : 'Create User'}
                            </button>

                            {recentlySuccessful && (
                                <p className="text-sm text-emerald-600">User account created successfully.</p>
                            )}
                        </form>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:col-span-3">
                        <div className="border-b border-gray-100 p-5">
                            <h2 className="text-lg font-semibold text-gray-900">Accounts</h2>
                            <p className="mt-1 text-xs text-gray-500">{users.length} total users</p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">User</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Role</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Last Login</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {users.map((user) => {
                                        const isCurrentUser = Number(auth?.user?.id) === Number(user.id);

                                        return (
                                            <tr key={user.id}>
                                                <td className="px-4 py-3">
                                                    <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                                                    <p className="text-xs text-gray-500">{user.email}</p>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                    {roleLabels[user.role] || user.role}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                                            user.is_active
                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                : 'bg-rose-50 text-rose-700'
                                                        }`}
                                                    >
                                                        {user.is_active ? 'Active' : 'Deactivated'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {formatDateTime(user.last_login_at)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleActive(user.id)}
                                                            disabled={!user.can_toggle}
                                                            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                                                                user.can_toggle
                                                                    ? user.is_active
                                                                        ? 'bg-rose-600 text-white hover:bg-rose-700'
                                                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                                                    : 'cursor-not-allowed bg-gray-200 text-gray-500'
                                                            }`}
                                                        >
                                                            {isCurrentUser ? 'Current User' : user.is_active ? 'Deactivate' : 'Activate'}
                                                        </button>
                                                        
                                                        {isAdmin && !isCurrentUser && (
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteUser(user.id, user.name)}
                                                                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                                                            >
                                                                <Trash2 className="inline h-3 w-3 mr-1" />
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </div>
        </AdminLayout>
    );
}