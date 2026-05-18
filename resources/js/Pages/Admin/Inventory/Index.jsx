// resources/js/Pages/Admin/Inventory/Index.jsx
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Package, RefreshCw, X } from 'lucide-react';
import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Ingredients from './Ingredients';

const poolLabel = (pool) => (pool === 'kitchen' ? 'Kitchen' : 'Resto');

export default function InventoryIndex({
    auth,
    ingredients: initialIngredients,
    activePool: initialActivePool = 'resto',
    availablePools: initialAvailablePools = ['resto'],
}) {
    const [ingredients, setIngredients] = useState(initialIngredients || []);
    const [activePool, setActivePool] = useState(initialActivePool || 'resto');
    const [availablePools, setAvailablePools] = useState(
        Array.isArray(initialAvailablePools) && initialAvailablePools.length > 0
            ? initialAvailablePools
            : ['resto']
    );
    const [notification, setNotification] = useState(null);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const fetchIngredients = async (pool = activePool) => {
        try {
            const ingResponse = await fetch(`/admin/inventory/ingredients?pool=${encodeURIComponent(pool)}`);
            const ingData = await ingResponse.json();
            if (ingData.success) {
                setIngredients(ingData.ingredients || []);
                setActivePool(ingData.pool || pool);
                if (Array.isArray(ingData.available_pools) && ingData.available_pools.length > 0) {
                    setAvailablePools(ingData.available_pools);
                }
            }
        } catch (error) {
            showNotification('Failed to refresh ingredients', 'error');
        }
    };

    useEffect(() => {
        setIngredients(initialIngredients || []);
        setActivePool(initialActivePool || 'resto');
        if (Array.isArray(initialAvailablePools) && initialAvailablePools.length > 0) {
            setAvailablePools(initialAvailablePools);
        }
    }, [initialIngredients, initialActivePool, initialAvailablePools]);

    useEffect(() => {
        fetchIngredients(activePool);
    }, [activePool]);

    return (
        <AdminLayout auth={auth}>
            <Head title="Inventory Management" />
            <div className="space-y-6">
                {notification && (
                    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
                        notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                    } text-white`}>
                        {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        <span>{notification.message}</span>
                        <button onClick={() => setNotification(null)} className="ml-4">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <Package className="h-8 w-8 text-emerald-600" />
                        Inventory Management ({poolLabel(activePool)})
                    </h1>
                    <div className="flex items-center gap-2">
                        {availablePools.length > 1 && (
                            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                                {availablePools.map((pool) => (
                                    <button
                                        key={pool}
                                        onClick={() => setActivePool(pool)}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                            activePool === pool
                                                ? 'bg-emerald-600 text-white'
                                                : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        {poolLabel(pool)}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={() => fetchIngredients(activePool)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <Ingredients
                        ingredients={ingredients}
                        activePool={activePool}
                        availablePools={availablePools}
                        onPoolChange={setActivePool}
                    />
                </div>
            </div>
        </AdminLayout>
    );
}
