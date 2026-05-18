import React from 'react';
import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

export default function KitchenItemCategories({
    auth,
    categories = [],
    items = [],
    total_categories = 0,
    total_items = 0,
    active_categories = 0,
    available_items = 0,
}) {
    return (
        <AdminLayout auth={auth}>
            <Head title="Kitchen Categories" />
            <div className="space-y-4">
                <h1 className="text-2xl font-bold text-gray-900">Kitchen Categories</h1>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <p className="text-xs text-gray-500">Total Categories</p>
                        <p className="text-xl font-bold text-gray-900">{total_categories || categories.length}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <p className="text-xs text-gray-500">Active Categories</p>
                        <p className="text-xl font-bold text-gray-900">{active_categories}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <p className="text-xs text-gray-500">Total Items</p>
                        <p className="text-xl font-bold text-gray-900">{total_items || items.length}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <p className="text-xs text-gray-500">Available Items</p>
                        <p className="text-xl font-bold text-gray-900">{available_items}</p>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left text-gray-600">
                                <tr>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3">Items</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                            No categories found.
                                        </td>
                                    </tr>
                                )}
                                {categories.map((category) => (
                                    <tr key={category.id} className="border-t border-gray-100">
                                        <td className="px-4 py-3 font-medium">{category.name}</td>
                                        <td className="px-4 py-3">{category.description || '—'}</td>
                                        <td className="px-4 py-3">{category.items_count ?? 0}</td>
                                        <td className="px-4 py-3">{category.is_active ? 'Active' : 'Inactive'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
