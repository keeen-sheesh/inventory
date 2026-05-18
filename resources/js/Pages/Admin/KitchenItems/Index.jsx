import React from 'react';
import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

const peso = (value) => `₱${Number(value || 0).toFixed(2)}`;

export default function KitchenItemsIndex({ auth, items = [], categories = [] }) {
    const rows = Array.isArray(items?.data)
        ? items.data
        : Array.isArray(items)
            ? items
            : [];

    return (
        <AdminLayout auth={auth}>
            <Head title="Kitchen Items" />
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">Kitchen Items</h1>
                    <span className="text-sm text-gray-500">Categories: {categories.length}</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left text-gray-600">
                                <tr>
                                    <th className="px-4 py-3">Item</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3">Stock</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                            No kitchen items found.
                                        </td>
                                    </tr>
                                )}
                                {rows.map((item) => (
                                    <tr key={item.id} className="border-t border-gray-100">
                                        <td className="px-4 py-3 font-medium">{item.name}</td>
                                        <td className="px-4 py-3">{item.category?.name || item.category_name || '—'}</td>
                                        <td className="px-4 py-3">{peso(item.price)}</td>
                                        <td className="px-4 py-3">{item.stock_quantity ?? '—'}</td>
                                        <td className="px-4 py-3">{item.is_available ? 'Available' : 'Unavailable'}</td>
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
