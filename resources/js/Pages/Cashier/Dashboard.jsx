import React from 'react';
import { Head } from '@inertiajs/react';
import {
    ChartBar,
    CheckCircle2,
    DollarSign,
    ShoppingBasket,
    TriangleAlert,
    UtensilsCrossed,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import AdminLayout from '@/Layouts/AdminLayout';

const formatPeso = (amount = 0) => {
    const safeAmount = Number(amount) || 0;
    return `P${safeAmount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const formatCount = (value = 0) => {
    const safeValue = Number(value) || 0;
    return safeValue.toLocaleString('en-PH');
};

const formatPercent = (value = 0) => {
    const safeValue = Number(value) || 0;
    return `${safeValue.toFixed(0)}%`;
};

const StatCard = ({ icon: Icon, label, value, hint, color }) => (
    <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
        <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
                <CardDescription>{label}</CardDescription>
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-4 w-4" />
                </span>
            </div>
        </CardHeader>
        <CardContent>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="mt-1 text-xs text-gray-500">{hint}</p>
        </CardContent>
    </Card>
);

export default function CashierDashboard({ auth, stats = {} }) {
    const role = (auth?.user?.role || 'resto').toLowerCase();
    const isManager = role === 'manager';
    const dashboardLabel = isManager ? 'Manager Dashboard' : 'Cashier Dashboard';
    const occupiedTables = Number(stats.occupiedTables) || 0;
    const totalTables = Number(stats.totalTables) || 0;
    const availableTables = Math.max(totalTables - occupiedTables, 0);
    const tableUtilization = totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0;

    const statCards = [
        {
            icon: DollarSign,
            label: 'Today Sales',
            value: formatPeso(stats.todaySales),
            hint: 'Completed sales for today',
            color: 'bg-blue-50 text-blue-700',
        },
        {
            icon: ShoppingBasket,
            label: 'Active Orders',
            value: formatCount(stats.activeOrders),
            hint: 'Pending, preparing, and ready',
            color: 'bg-violet-50 text-violet-700',
        },
        {
            icon: CheckCircle2,
            label: 'Ready Orders',
            value: formatCount(stats.readyOrders),
            hint: 'Ready to settle at cashier',
            color: 'bg-emerald-50 text-emerald-700',
        },
        {
            icon: ChartBar,
            label: 'Table Utilization',
            value: `${formatCount(occupiedTables)} / ${formatCount(totalTables)}`,
            hint: `${formatPercent(tableUtilization)} occupied - ${formatCount(availableTables)} available`,
            color: 'bg-sky-50 text-sky-700',
        },
        {
            icon: UtensilsCrossed,
            label: 'Menu Availability',
            value: formatCount(stats.availableMenuItems),
            hint: `${formatCount(stats.activeMenuCategories)} active categories`,
            color: 'bg-fuchsia-50 text-fuchsia-700',
        },
        {
            icon: TriangleAlert,
            label: 'Low Stock',
            value: formatCount(stats.lowStockItems),
            hint: 'Ingredients/items near threshold',
            color: 'bg-amber-50 text-amber-700',
        },
    ];

    return (
        <AdminLayout auth={auth}>
            <Head title={dashboardLabel} />

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardDescription className="text-xs uppercase tracking-wide text-gray-500">{dashboardLabel}</CardDescription>
                        <CardTitle className="text-3xl font-bold text-gray-900">Cashier Performance Stats</CardTitle>
                        <CardDescription>Live numbers for orders, sales, tables, and menu readiness.</CardDescription>
                    </CardHeader>
                </Card>

                <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {statCards.map((card) => (
                        <StatCard key={card.label} {...card} />
                    ))}
                </section>
            </div>
        </AdminLayout>
    );
}
