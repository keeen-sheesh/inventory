// resources/js/Pages/Admin/Inventory/Ingredients.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
    Package,
    Plus,
    Edit,
    Trash2,
    Search,
    AlertTriangle,
    CheckCircle,
    Loader2,
    X,
    Save,
    Download,
    Upload,
    Calculator,
    Zap,
    Users,
    DollarSign,
} from 'lucide-react';
import { formatPHDate, formatPHDateTime, todayPH } from '@/utils/phTime';

// Helper to get CSRF token
const getCsrfToken = () => {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
};

// Helper to refresh CSRF token
const refreshCsrfToken = async () => {
    try {
        const response = await fetch('/csrf-token', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
            },
        });
        if (response.ok) {
            const data = await response.json();
            const metaTag = document.querySelector('meta[name="csrf-token"]');
            if (metaTag) {
                metaTag.setAttribute('content', data.token);
            }
            return data.token;
        }
    } catch (error) {
        console.error('Failed to refresh CSRF token:', error);
    }
    return null;
};

const poolLabel = (pool) => (pool === 'kitchen' ? 'Kitchen' : 'Resto');
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function Ingredients({
    ingredients: initialIngredients = [],
    activePool = 'resto',
}) {
    const [ingredients, setIngredients] = useState(initialIngredients);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [usagePeriod, setUsagePeriod] = useState('daily');

    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedIngredient, setSelectedIngredient] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState(null);

    // Form states
    const [showCostCalc, setShowCostCalc] = useState(false);
    const [costCalc, setCostCalc] = useState({ packSize: '', packUnit: 'g', qtyPacks: '', minPacks: '' });

    // ── Combined Update Modal state (replaces both Quick and Bulk) ─────────────
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [updateMode, setUpdateMode] = useState('single'); // 'single' or 'bulk'
    const [updateSearch, setUpdateSearch] = useState('');
    const [updateDropdownOpen, setUpdateDropdownOpen] = useState(false);
    const [updateSelected, setUpdateSelected] = useState(null); // for single mode
    const [updateNewQty, setUpdateNewQty] = useState('');
    const [updateOrNumber, setUpdateOrNumber] = useState('');
    const [updateCountDate, setUpdateCountDate] = useState(todayIso());
    const [updateNotes, setUpdateNotes] = useState('');
    
    // Bulk update state within the combined modal
    const [bulkUpdates, setBulkUpdates] = useState([]);
    const [bulkSearch, setBulkSearch] = useState('');
    const [bulkStatusFilter, setBulkStatusFilter] = useState('all');
    
    const updateSearchRef = useRef(null);
    const updateDropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (
                updateDropdownRef.current &&
                !updateDropdownRef.current.contains(e.target) &&
                updateSearchRef.current &&
                !updateSearchRef.current.contains(e.target)
            ) {
                setUpdateDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const updateFiltered = ingredients.filter(ing =>
        ing.name.toLowerCase().includes(updateSearch.toLowerCase())
    );

    const openUpdateModal = (mode = 'single') => {
        setUpdateMode(mode);
        setUpdateSearch('');
        setUpdateSelected(null);
        setUpdateNewQty('');
        setUpdateOrNumber('');
        setUpdateCountDate(todayIso());
        setUpdateNotes('');
        setUpdateDropdownOpen(false);
        
        // Reset bulk state
        setBulkUpdates([]);
        setBulkSearch('');
        setBulkStatusFilter('all');
        
        setShowUpdateModal(true);
    };

    const handleUpdateSelect = (ing) => {
        setUpdateSelected(ing);
        setUpdateSearch(ing.name);
        setUpdateNewQty(String(ing.quantity));
        setUpdateDropdownOpen(false);
    };

    // Handle single ingredient update
    const handleSingleUpdate = async () => {
        if (!updateSelected) {
            showNotification('Please select an ingredient', 'error');
            return;
        }
        if (updateNewQty === '' || isNaN(parseFloat(updateNewQty))) {
            showNotification('Please enter a valid stock count', 'error');
            return;
        }
        if (!updateOrNumber.trim()) {
            showNotification('OR number is required', 'error');
            return;
        }
        if (!updateCountDate) {
            showNotification('Count date is required', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(withPool('/admin/inventory/update-stock'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    or_number: updateOrNumber.trim(),
                    count_date: updateCountDate,
                    notes: updateNotes || null,
                    ingredients: [{
                        id: updateSelected.id,
                        quantity: parseFloat(updateNewQty),
                        notes: updateNotes || null,
                    }],
                }),
            });

            // Handle CSRF expiration
            if (response.status === 419) {
                const newToken = await refreshCsrfToken();
                if (newToken) {
                    // Retry with new token
                    const retryResponse = await fetch(withPool('/admin/inventory/update-stock'), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': newToken,
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                            or_number: updateOrNumber.trim(),
                            count_date: updateCountDate,
                            notes: updateNotes || null,
                            ingredients: [{
                                id: updateSelected.id,
                                quantity: parseFloat(updateNewQty),
                                notes: updateNotes || null,
                            }],
                        }),
                    });
                    const data = await retryResponse.json();
                    if (data.success) {
                        setIngredients(data.ingredients);
                        setShowUpdateModal(false);
                        showNotification(`Stock updated for ${updateSelected.name}`);
                    } else {
                        showNotification(data.message || 'Failed to update stock', 'error');
                    }
                    setIsLoading(false);
                    return;
                }
            }

            const data = await response.json();

            if (data.success) {
                setIngredients(data.ingredients);
                setShowUpdateModal(false);
                showNotification(`Stock updated for ${updateSelected.name}`);
            } else {
                showNotification(data.message || 'Failed to update stock', 'error');
            }
        } catch {
            showNotification('Error updating stock', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle bulk stock update (within combined modal)
    const buildBulkUpdatesPayload = () => {
        return ingredients.map((ing) => {
            const override = bulkUpdates.find((u) => u.id === ing.id);
            return {
                id: ing.id,
                quantity: Number.isFinite(override?.quantity) ? override.quantity : Number(ing.quantity || 0),
            };
        });
    };

    const handleBulkUpdate = async () => {
        if (!updateOrNumber.trim()) {
            showNotification('OR number is required', 'error');
            return;
        }
        if (!updateCountDate) {
            showNotification('Count date is required', 'error');
            return;
        }

        const updatesPayload = buildBulkUpdatesPayload();
        setIsLoading(true);
        try {
            const response = await fetch(withPool('/admin/inventory/bulk-update-stock'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    or_number: updateOrNumber.trim(),
                    count_date: updateCountDate,
                    notes: updateNotes || null,
                    updates: updatesPayload,
                })
            });
            
            // Handle CSRF expiration
            if (response.status === 419) {
                const newToken = await refreshCsrfToken();
                if (newToken) {
                    // Retry with new token
                    const retryResponse = await fetch(withPool('/admin/inventory/bulk-update-stock'), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': newToken,
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            or_number: updateOrNumber.trim(),
                            count_date: updateCountDate,
                            notes: updateNotes || null,
                            updates: updatesPayload,
                        })
                    });
                    const data = await retryResponse.json();
                    if (data.success) {
                        setIngredients(data.ingredients);
                        setShowUpdateModal(false);
                        setBulkUpdates([]);
                        showNotification('Stock updated successfully');
                    } else {
                        showNotification(data.message || 'Failed to update stock', 'error');
                    }
                    setIsLoading(false);
                    return;
                }
            }
            
            const data = await response.json();
            if (data.success) {
                setIngredients(data.ingredients);
                setShowUpdateModal(false);
                setBulkUpdates([]);
                showNotification('Stock updated successfully');
            } else {
                showNotification(data.message || 'Failed to update stock', 'error');
            }
        } catch {
            showNotification('Error updating stock', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // ───────────────────────────────────────────────────────────────────────

    const withPool = (url) => `${url}${url.includes('?') ? '&' : '?'}pool=${encodeURIComponent(activePool)}`;

    useEffect(() => {
        setIngredients(initialIngredients || []);
    }, [initialIngredients]);

    // Filter ingredients (main table)
    const filteredIngredients = ingredients.filter(ing =>
        ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ing.unit.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Low / out of stock counts
    const lowStockIngredients = ingredients.filter(ing =>
        ing.quantity <= ing.min_stock && ing.quantity > 0
    );
    const outOfStockIngredients = ingredients.filter(ing => ing.quantity <= 0);

    // Bulk modal filtered rows (for bulk mode within combined modal)
    const bulkFilteredIngredients = ingredients.filter(ing => {
        const matchesSearch = ing.name.toLowerCase().includes(bulkSearch.toLowerCase());
        const isLow = ing.quantity <= ing.min_stock && ing.quantity > 0;
        const isOut = ing.quantity <= 0;
        if (bulkStatusFilter === 'low') return matchesSearch && isLow;
        if (bulkStatusFilter === 'out') return matchesSearch && isOut;
        return matchesSearch;
    });

    const formatStock = (ingredient) => {
        if (ingredient.pieces_per_box && (ingredient.unit === 'piece' || ingredient.unit === 'pcs')) {
            const boxes = Math.floor(ingredient.quantity / ingredient.pieces_per_box);
            const loose = ingredient.quantity % ingredient.pieces_per_box;
            if (loose > 0) return `${ingredient.quantity} pcs (${boxes} box, ${loose} loose)`;
            return `${ingredient.quantity} pcs (${boxes} boxes)`;
        }
        return `${ingredient.quantity} ${ingredient.unit}`;
    };

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const formatLastOrTimestamp = (ingredient) => {
        if (ingredient?.last_counted_at) {
            return `${formatPHDateTime(ingredient.last_counted_at)} PH`;
        }

        if (ingredient?.last_count_date) {
            return formatPHDate(ingredient.last_count_date);
        }

        return '';
    };

    const getCsrfToken = () =>
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    // Handle add ingredient
    const [formData, setFormData] = useState({
        name: '',
        unit: 'kg',
        is_dry: true,
        pieces_per_box: null,
        quantity: 0,
        min_stock: 1,
        cost_per_unit: 0
    });

    const dryUnits = [
        { value: 'kg', label: 'kg (kilogram)' },
        { value: 'g', label: 'g (gram)' }
    ];
    const wetUnits = [
        { value: 'L', label: 'L (liter)' },
        { value: 'mL', label: 'mL (milliliter)' }
    ];
    const otherUnits = [
        { value: 'piece', label: 'piece' },
        { value: 'pack', label: 'pack' },
        { value: 'box', label: 'box' }
    ];

    const getUnitOptions = () => {
        if (formData.is_dry) return [...dryUnits, ...otherUnits];
        return [...wetUnits, ...otherUnits];
    };

    const computePurchase = (calc, stockUnit) => {
        const packSize = parseFloat(calc.packSize);
        const convert = (val, from, to) => {
            if (!val || from === to) return val;
            if (from === 'g'  && to === 'kg') return val / 1000;
            if (from === 'kg' && to === 'g')  return val * 1000;
            if (from === 'ml' && to === 'l')  return val / 1000;
            if (from === 'l'  && to === 'ml') return val * 1000;
            return val;
        };
        const packInStockUnit = convert(packSize, calc.packUnit, stockUnit);
        if (!packSize || !packInStockUnit) return null;

        const qtyBought = parseFloat(calc.qtyPacks);
        let stockQty = null;
        if (qtyBought && packInStockUnit) stockQty = qtyBought * packInStockUnit;

        const minPacksVal = parseFloat(calc.minPacks);
        let minStock = null;
        if (minPacksVal && packInStockUnit) minStock = minPacksVal * packInStockUnit;

        return { stockQty, minStock, packInStockUnit };
    };

    const handleAddIngredient = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await fetch(withPool('/admin/inventory/ingredients'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            // Handle CSRF expiration
            if (response.status === 419) {
                const newToken = await refreshCsrfToken();
                if (newToken) {
                    // Retry with new token
                    const retryResponse = await fetch(withPool('/admin/inventory/ingredients'), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': newToken,
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(formData)
                    });
                    const data = await retryResponse.json();
                    if (data.success) {
                        setIngredients([...ingredients, data.ingredient]);
                        setShowAddModal(false);
                        setFormData({ name: '', unit: 'kg', is_dry: true, pieces_per_box: null, quantity: 0, min_stock: 1, cost_per_unit: 0 });
                        showNotification('Ingredient added successfully');
                    } else {
                        showNotification(data.message || 'Failed to add ingredient', 'error');
                    }
                    setIsLoading(false);
                    return;
                }
            }
            
            const data = await response.json();
            if (data.success) {
                setIngredients([...ingredients, data.ingredient]);
                setShowAddModal(false);
                setFormData({ name: '', unit: 'kg', is_dry: true, pieces_per_box: null, quantity: 0, min_stock: 1, cost_per_unit: 0 });
                showNotification('Ingredient added successfully');
            } else {
                showNotification(data.message || 'Failed to add ingredient', 'error');
            }
        } catch {
            showNotification('Error adding ingredient', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateIngredient = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await fetch(withPool(`/admin/inventory/ingredients/${selectedIngredient.id}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            // Handle CSRF expiration
            if (response.status === 419) {
                const newToken = await refreshCsrfToken();
                if (newToken) {
                    // Retry with new token
                    const retryResponse = await fetch(withPool(`/admin/inventory/ingredients/${selectedIngredient.id}`), {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': newToken,
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(formData)
                    });
                    const data = await retryResponse.json();
                    if (data.success) {
                        setIngredients(ingredients.map(ing =>
                            ing.id === selectedIngredient.id ? data.ingredient : ing
                        ));
                        setShowEditModal(false);
                        showNotification('Ingredient updated successfully');
                    } else {
                        showNotification(data.message || 'Failed to update ingredient', 'error');
                    }
                    setIsLoading(false);
                    return;
                }
            }
            
            const data = await response.json();
            if (data.success) {
                setIngredients(ingredients.map(ing =>
                    ing.id === selectedIngredient.id ? data.ingredient : ing
                ));
                setShowEditModal(false);
                showNotification('Ingredient updated successfully');
            } else {
                showNotification(data.message || 'Failed to update ingredient', 'error');
            }
        } catch {
            showNotification('Error updating ingredient', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteIngredient = async () => {
        if (!selectedIngredient?.id) {
            showNotification('Cannot delete: Invalid ingredient ID', 'error');
            setShowDeleteModal(false);
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch(withPool(`/admin/inventory/ingredients/${selectedIngredient.id}`), {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Accept': 'application/json'
                }
            });
            
            // Handle CSRF expiration
            if (response.status === 419) {
                const newToken = await refreshCsrfToken();
                if (newToken) {
                    // Retry with new token
                    const retryResponse = await fetch(withPool(`/admin/inventory/ingredients/${selectedIngredient.id}`), {
                        method: 'DELETE',
                        headers: {
                            'X-CSRF-TOKEN': newToken,
                            'Accept': 'application/json'
                        }
                    });
                    const data = await retryResponse.json();
                    if (data.success) {
                        setIngredients(ingredients.filter(ing => ing.id !== selectedIngredient.id));
                        setShowDeleteModal(false);
                        showNotification('Ingredient deleted successfully');
                    } else {
                        showNotification(data.message || 'Failed to delete ingredient', 'error');
                    }
                    setIsLoading(false);
                    return;
                }
            }
            
            const data = await response.json();
            if (data.success) {
                setIngredients(ingredients.filter(ing => ing.id !== selectedIngredient.id));
                setShowDeleteModal(false);
                showNotification('Ingredient deleted successfully');
            } else {
                showNotification(data.message || 'Failed to delete ingredient', 'error');
            }
        } catch {
            showNotification('Error deleting ingredient', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Exports
    const exportIngredients = () => {
        const csv = [
            ['Name', 'Unit', 'Current Stock', 'Cost per Unit', 'Total Value', 'Min Stock'],
            ...ingredients.map(ing => [
                ing.name, ing.unit,
                Number(ing.quantity).toFixed(3),
                Number(ing.cost_per_unit || 0).toFixed(2),
                Number((ing.quantity || 0) * (ing.cost_per_unit || 0)).toFixed(2),
                Number(ing.min_stock).toFixed(3),
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ingredients-${todayPH()}.csv`;
        a.click();
    };

    const exportUsageReport = () => {
        const period = usagePeriod === 'daily' ? 'daily' : usagePeriod;
        window.location.href = `/admin/inventory/reports/export-usage?period=${period}&pool=${encodeURIComponent(activePool)}`;
    };

    return (
        <div className="space-y-6">
            {/* Notifications */}
            {notification && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in ${
                    notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                } text-white`}>
                    {notification.type === 'success'
                        ? <CheckCircle className="w-5 h-5" />
                        : <AlertTriangle className="w-5 h-5" />}
                    <span>{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="ml-4">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="inline-flex w-fit items-center rounded-lg border border-gray-200 bg-white p-1">
                            {[
                                { value: 'daily', label: 'Daily' },
                                { value: 'week', label: 'Weekly' },
                                { value: 'month', label: 'Monthly' },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setUsagePeriod(option.value)}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                        usagePeriod === option.value
                                            ? 'bg-gray-900 text-white shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={exportUsageReport}
                                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                            >
                                <Download className="h-4 w-4" />
                                Export Usage
                            </button>

                            <button
                                onClick={exportIngredients}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                            >
                                <Download className="h-4 w-4" />
                                Export List
                            </button>

                            <button
                                onClick={() => openUpdateModal('single')}
                                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
                            >
                                <Zap className="h-4 w-4" />
                                Quick Update
                            </button>

                            <button
                                onClick={() => setShowAddModal(true)}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                            >
                                <Plus className="h-4 w-4" />
                                Add Product
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs text-gray-500">Total Ingredients</p>
                        <p className="text-lg font-semibold text-gray-900">{ingredients.length}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs text-amber-700">Low Stock</p>
                        <p className="text-lg font-semibold text-amber-700">{lowStockIngredients.length}</p>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                        <p className="text-xs text-red-700">Out of Stock</p>
                        <p className="text-lg font-semibold text-red-700">{outOfStockIngredients.length}</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search ingredients by name or unit..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                        >
                            <X className="h-4 w-4" />
                            Clear
                        </button>
                    )}
                </div>
                {searchTerm && (
                    <p className="text-sm text-gray-500 mt-2">
                        Showing {filteredIngredients.length} of {ingredients.length} ingredients
                    </p>
                )}
            </div>

            {/* Ingredients Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ingredient</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost per Unit</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Stock</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredIngredients.map((ingredient) => {
                            const isLowStock = ingredient.quantity <= ingredient.min_stock && ingredient.quantity > 0;
                            const isOutOfStock = ingredient.quantity <= 0;
                            const costPerUnit = ingredient.cost_per_unit || 0;
                            const totalValue = ingredient.quantity * costPerUnit;

                            return (
                                <tr key={ingredient.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <div className="font-medium text-gray-900">{ingredient.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {ingredient.last_or_number
                                                    ? `Last OR: ${ingredient.last_or_number}${formatLastOrTimestamp(ingredient) ? ` • ${formatLastOrTimestamp(ingredient)}` : ''}`
                                                    : 'Last OR: —'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{ingredient.unit}</td>
                                    <td className="px-6 py-4">
                                        <span className={`font-medium ${
                                            isOutOfStock ? 'text-red-600' :
                                            isLowStock ? 'text-amber-600' : 'text-gray-900'
                                        }`}>
                                            {formatStock(ingredient)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-medium text-gray-900">₱{Number(costPerUnit).toFixed(2)}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`font-semibold ${
                                            totalValue > 0 ? 'text-green-600' : 'text-gray-400'
                                        }`}>
                                            ₱{Number(totalValue).toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{ingredient.min_stock}</td>
                                    <td className="px-6 py-4">
                                        {isOutOfStock ? (
                                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Out of Stock</span>
                                        ) : isLowStock ? (
                                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Low Stock</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">In Stock</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => {
                                                setSelectedIngredient(ingredient);
                                                setFormData({
                                                    name: ingredient.name,
                                                    unit: ingredient.unit,
                                                    is_dry: ingredient.is_dry ?? true,
                                                    pieces_per_box: ingredient.pieces_per_box ?? null,
                                                    quantity: ingredient.quantity ?? 0,
                                                    min_stock: ingredient.min_stock ?? 1,
                                                    cost_per_unit: ingredient.cost_per_unit ?? 0,
                                                });
                                                setCostCalc({ packSize: '', packUnit: 'g', qtyPacks: '', minPacks: '' });
                                                setShowCostCalc(false);
                                                setShowEditModal(true);
                                            }}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg mr-2"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!ingredient.id) {
                                                    showNotification('Cannot delete: Invalid ingredient ID', 'error');
                                                    return;
                                                }
                                                setSelectedIngredient(ingredient);
                                                setShowDeleteModal(true);
                                            }}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {filteredIngredients.length === 0 && (
                    <div className="text-center py-12">
                        <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No ingredients found</p>
                    </div>
                )}
            </div>

            {/* ── Combined Update Modal (replaces both Quick and Bulk) ─────────────────────────── */}
            {showUpdateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto">
                        {/* Header */}
                        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 rounded-t-2xl z-10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        {updateMode === 'single' ? (
                                            <Zap className="h-5 w-5 text-amber-500" />
                                        ) : (
                                            <Users className="h-5 w-5 text-blue-600" />
                                        )}
                                        {updateMode === 'single' ? 'Quick Stock Update' : 'Bulk Stock Update'} ({poolLabel(activePool)})
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {updateMode === 'single' 
                                            ? 'Update a single ingredient — OR + date required'
                                            : 'Update multiple ingredients at once — OR + date required'
                                        }
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowUpdateModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>
                            
                            {/* Mode switcher */}
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={() => setUpdateMode('single')}
                                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                        updateMode === 'single'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    <Zap className="h-3.5 w-3.5 inline mr-1" />
                                    Single Ingredient
                                </button>
                                <button
                                    onClick={() => {
                                        setUpdateMode('bulk');
                                        setBulkUpdates([]);
                                    }}
                                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                        updateMode === 'bulk'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    <Users className="h-3.5 w-3.5 inline mr-1" />
                                    Multiple Ingredients
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* OR / Date / Notes - Common for both modes */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">OR Number *</label>
                                    <input
                                        type="text"
                                        value={updateOrNumber}
                                        onChange={(e) => setUpdateOrNumber(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400"
                                        placeholder="Official receipt #"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Count Date *</label>
                                    <input
                                        type="date"
                                        value={updateCountDate}
                                        onChange={(e) => setUpdateCountDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                                    <input
                                        type="text"
                                        value={updateNotes}
                                        onChange={(e) => setUpdateNotes(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400"
                                        placeholder="Optional memo"
                                    />
                                </div>
                            </div>

                            {/* Single Mode Content */}
                            {updateMode === 'single' && (
                                <>
                                    {/* Ingredient search dropdown */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Ingredient <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                                <input
                                                    ref={updateSearchRef}
                                                    type="text"
                                                    value={updateSearch}
                                                    onChange={(e) => {
                                                        setUpdateSearch(e.target.value);
                                                        setUpdateSelected(null);
                                                        setUpdateNewQty('');
                                                        setUpdateDropdownOpen(true);
                                                    }}
                                                    onFocus={() => setUpdateDropdownOpen(true)}
                                                    placeholder="Search ingredient..."
                                                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                                />
                                            </div>

                                            {updateDropdownOpen && updateSearch.length > 0 && (
                                                <div
                                                    ref={updateDropdownRef}
                                                    className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto"
                                                >
                                                    {updateFiltered.length === 0 ? (
                                                        <div className="px-4 py-3 text-sm text-gray-500">No ingredients found</div>
                                                    ) : (
                                                        updateFiltered.map(ing => {
                                                            const isOut = ing.quantity <= 0;
                                                            const isLow = ing.quantity <= ing.min_stock && ing.quantity > 0;
                                                            return (
                                                                <button
                                                                    key={ing.id}
                                                                    type="button"
                                                                    onClick={() => handleUpdateSelect(ing)}
                                                                    className="w-full text-left px-4 py-2.5 hover:bg-amber-50 flex items-center justify-between gap-2 border-b border-gray-100 last:border-0"
                                                                >
                                                                    <div>
                                                                        <span className="text-sm font-medium text-gray-900">{ing.name}</span>
                                                                        <span className="text-xs text-gray-500 ml-2">{ing.unit}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <span className="text-xs text-gray-600">{ing.quantity} {ing.unit}</span>
                                                                        {isOut && (
                                                                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">out</span>
                                                                        )}
                                                                        {isLow && !isOut && (
                                                                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">low</span>
                                                                        )}
                                                                    </div>
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Current stock read-only */}
                                    {updateSelected && (
                                        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-gray-500">Current stock</p>
                                                <p className="text-lg font-semibold text-gray-900">
                                                    {updateSelected.quantity} <span className="text-sm font-normal text-gray-500">{updateSelected.unit}</span>
                                                </p>
                                            </div>
                                            {updateSelected.quantity <= 0 && (
                                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">Out of stock</span>
                                            )}
                                            {updateSelected.quantity > 0 && updateSelected.quantity <= updateSelected.min_stock && (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">Low stock</span>
                                            )}
                                        </div>
                                    )}

                                    {/* New count */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            New Stock Count <span className="text-red-500">*</span>
                                            {updateSelected && <span className="text-gray-400 font-normal ml-1">({updateSelected.unit})</span>}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            value={updateNewQty}
                                            onChange={(e) => setUpdateNewQty(e.target.value)}
                                            placeholder="Enter actual counted stock"
                                            disabled={!updateSelected}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Bulk Mode Content */}
                            {updateMode === 'bulk' && (
                                <>
                                    {/* Search + status filter for bulk table */}
                                    <div className="flex gap-2 mb-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input
                                                type="text"
                                                value={bulkSearch}
                                                onChange={(e) => setBulkSearch(e.target.value)}
                                                placeholder="Filter ingredients..."
                                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                        <select
                                            value={bulkStatusFilter}
                                            onChange={(e) => setBulkStatusFilter(e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                        >
                                            <option value="all">All ({ingredients.length})</option>
                                            <option value="low">Low stock ({lowStockIngredients.length})</option>
                                            <option value="out">Out of stock ({outOfStockIngredients.length})</option>
                                        </select>
                                        {(bulkSearch || bulkStatusFilter !== 'all') && (
                                            <button
                                                onClick={() => { setBulkSearch(''); setBulkStatusFilter('all'); }}
                                                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-1"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                                Clear
                                            </button>
                                        )}
                                    </div>

                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product Name</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Current Stock #</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actual Counted Stock</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {bulkFilteredIngredients.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                                                        No ingredients match your filter
                                                    </td>
                                                </tr>
                                            ) : (
                                                bulkFilteredIngredients.map(ing => {
                                                    const isLow = ing.quantity <= ing.min_stock && ing.quantity > 0;
                                                    const isOut = ing.quantity <= 0;
                                                    return (
                                                        <tr key={ing.id} className={isOut ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''}>
                                                            <td className="px-4 py-2">
                                                                <div className="font-medium flex items-center gap-2">
                                                                    {ing.name}
                                                                    {isOut && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">out</span>}
                                                                    {isLow && !isOut && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">low</span>}
                                                                </div>
                                                                <div className="text-xs text-gray-500">{ing.unit}</div>
                                                            </td>
                                                            <td className={`px-4 py-2 font-medium ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-700'}`}>
                                                                {ing.quantity}
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.001"
                                                                    min="0"
                                                                    value={bulkUpdates.find(u => u.id === ing.id)?.quantity ?? ing.quantity}
                                                                    onChange={(e) => {
                                                                        const value = Number.parseFloat(e.target.value);
                                                                        setBulkUpdates(prev => {
                                                                            const existing = prev.findIndex(u => u.id === ing.id);
                                                                            if (existing >= 0) {
                                                                                const newUpdates = [...prev];
                                                                                newUpdates[existing] = { id: ing.id, quantity: Number.isFinite(value) ? value : 0 };
                                                                                return newUpdates;
                                                                            }
                                                                            return [...prev, { id: ing.id, quantity: Number.isFinite(value) ? value : 0 }];
                                                                        });
                                                                    }}
                                                                    className="w-24 px-2 py-1 border border-gray-300 rounded"
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>

                                    {bulkSearch || bulkStatusFilter !== 'all' ? (
                                        <p className="text-xs text-gray-400 mt-2">
                                            Showing {bulkFilteredIngredients.length} of {ingredients.length} ingredients. Saving will update <strong>all</strong> ingredients, not just the filtered view.
                                        </p>
                                    ) : null}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-2xl flex justify-end gap-3">
                            <button
                                onClick={() => setShowUpdateModal(false)}
                                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={updateMode === 'single' ? handleSingleUpdate : handleBulkUpdate}
                                disabled={isLoading || !updateOrNumber.trim() || !updateCountDate || (updateMode === 'single' && (!updateSelected || updateNewQty === ''))}
                                className={`px-5 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium ${
                                    updateMode === 'single' 
                                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Update Stock
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {(showAddModal || showEditModal) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between rounded-t-2xl z-10">
                            <h3 className="text-xl font-bold text-gray-900">
                                {showAddModal ? 'Add New Ingredient' : 'Edit Ingredient'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddModal(false);
                                    setShowEditModal(false);
                                    setFormData({ name: '', unit: 'kg', is_dry: true, pieces_per_box: null, quantity: 0, min_stock: 1, cost_per_unit: 0 });
                                    setCostCalc({ packSize: '', packUnit: 'g', qtyPacks: '', minPacks: '' });
                                    setShowCostCalc(false);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={showAddModal ? handleAddIngredient : handleUpdateIngredient}>
                            <div className="p-6 space-y-5">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                        placeholder="e.g. All-purpose flour"
                                        required
                                    />
                                </div>

                                {/* Ingredient Type */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Ingredient Type <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-3">
                                        <div className="flex bg-gray-100 rounded-xl p-1 flex-1">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({...formData, is_dry: true, unit: 'kg'})}
                                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                                                    formData.is_dry
                                                        ? 'bg-white text-emerald-700 shadow-sm'
                                                        : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                            >
                                                Dry (kg, g)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({...formData, is_dry: false, unit: 'L'})}
                                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                                                    !formData.is_dry
                                                        ? 'bg-white text-blue-700 shadow-sm'
                                                        : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                            >
                                                Wet (L, mL)
                                            </button>
                                        </div>
                                        <select
                                            value={formData.unit}
                                            onChange={(e) => setFormData({...formData, unit: e.target.value})}
                                            className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm font-medium min-w-[120px]"
                                            required
                                        >
                                            {getUnitOptions().map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Purchase Entry Calculator */}
                                <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden">
                                    <button type="button"
                                        onClick={() => setShowCostCalc(v => !v)}
                                        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100/50 transition-colors">
                                        <span className="flex items-center gap-2.5">
                                            <Calculator className="h-5 w-5" />
                                            <span>Purchase Entry Calculator</span>
                                        </span>
                                        <span className="text-xs text-emerald-500">{showCostCalc ? 'Hide' : 'Show'}</span>
                                    </button>
                                    {showCostCalc && (
                                        <div className="px-5 pb-5 space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-semibold text-emerald-700 mb-1.5">Pack size</label>
                                                    <div className="flex gap-1.5">
                                                        <input type="number" step="any" min="0" placeholder="0"
                                                            value={costCalc.packSize}
                                                            onChange={e => setCostCalc(c => ({...c, packSize: e.target.value}))}
                                                            className="flex-1 min-w-0 px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white" />
                                                        <select value={costCalc.packUnit}
                                                            onChange={e => setCostCalc(c => ({...c, packUnit: e.target.value}))}
                                                            className="px-2 py-2 border border-emerald-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-emerald-400">
                                                            {[...dryUnits, ...wetUnits].map(u => (
                                                                <option key={u.value} value={u.value}>{u.value}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-emerald-700 mb-1.5">Qty bought (packs)</label>
                                                    <input type="number" step="any" min="0" placeholder="0"
                                                        value={costCalc.qtyPacks}
                                                        onChange={e => setCostCalc(c => ({...c, qtyPacks: e.target.value}))}
                                                        className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-emerald-700 mb-1.5">Min stock (packs)</label>
                                                <input type="number" step="any" min="0" placeholder="0"
                                                    value={costCalc.minPacks}
                                                    onChange={e => setCostCalc(c => ({...c, minPacks: e.target.value}))}
                                                    className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white" />
                                            </div>
                                            {(() => {
                                                const result = computePurchase(costCalc, formData.unit);
                                                if (!result) return null;
                                                return (
                                                    <div className="bg-white rounded-xl p-4 border border-emerald-200 space-y-2">
                                                        <p className="text-xs font-semibold text-emerald-700 mb-2">Calculated values</p>
                                                        {result.stockQty !== null && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-gray-600">Stock to add</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-bold text-emerald-700">{result.stockQty.toFixed(3)} {formData.unit}</span>
                                                                    <button type="button"
                                                                        onClick={() => setFormData(f => ({...f, quantity: parseFloat((f.quantity + result.stockQty).toFixed(3))}))}
                                                                        className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-md hover:bg-emerald-700">Apply</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {result.minStock !== null && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-gray-600">Min stock</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-bold text-amber-600">{result.minStock.toFixed(3)} {formData.unit}</span>
                                                                    <button type="button"
                                                                        onClick={() => setFormData(f => ({...f, min_stock: parseFloat(result.minStock.toFixed(3))}))}
                                                                        className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-md hover:bg-amber-600">Apply</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {/* Cost Per Unit Input */}
                                <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
                                    <div className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-blue-700">
                                        <span className="flex items-center gap-2.5">
                                            <DollarSign className="h-5 w-5" />
                                            <span>Cost Information</span>
                                        </span>
                                    </div>
                                    <div className="px-5 pb-5 space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-blue-700 mb-1.5">
                                                Cost per {formData.unit} <span className="text-blue-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 font-semibold">₱</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={formData.cost_per_unit || ''}
                                                    onChange={(e) => setFormData({...formData, cost_per_unit: parseFloat(e.target.value) || 0})}
                                                    className="w-full pl-8 pr-3 py-2.5 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white font-semibold text-gray-900"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <p className="text-xs text-blue-600 mt-1.5">
                                                This is used to calculate COGS (Cost of Goods Sold)
                                            </p>
                                        </div>
                                        {formData.cost_per_unit > 0 && (
                                            <div className="bg-white rounded-xl p-4 border border-blue-200">
                                                <p className="text-xs font-semibold text-blue-700 mb-2">Example Calculation</p>
                                                <div className="space-y-1.5 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">1 {formData.unit} costs:</span>
                                                        <span className="font-semibold text-blue-700">₱{Number(formData.cost_per_unit).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">10 {formData.unit} costs:</span>
                                                        <span className="font-semibold text-blue-700">₱{(Number(formData.cost_per_unit) * 10).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">100 {formData.unit} costs:</span>
                                                        <span className="font-semibold text-blue-700">₱{(Number(formData.cost_per_unit) * 100).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Current Values Summary */}
                                {(formData.quantity > 0 || formData.min_stock !== 1) && (
                                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4">
                                        <p className="text-xs font-semibold text-gray-600 mb-3">Current Values</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
                                                <p className="text-xs text-gray-500 mb-1">Stock</p>
                                                <p className="text-lg font-bold text-gray-900">{Number(formData.quantity).toFixed(2)}</p>
                                                <p className="text-xs text-gray-400">{formData.unit}</p>
                                            </div>
                                            <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
                                                <p className="text-xs text-gray-500 mb-1">Min Alert</p>
                                                <p className="text-lg font-bold text-gray-900">{Number(formData.min_stock).toFixed(2)}</p>
                                                <p className="text-xs text-gray-400">{formData.unit}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Manual Override */}
                                <details className="group">
                                    <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 select-none list-none flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors">
                                        <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                                        <span className="font-medium">Enter values manually</span>
                                    </summary>
                                    <div className="mt-3 space-y-4 pl-1">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-2">Current Stock</label>
                                            <input type="number" step="0.001" min="0"
                                                value={formData.quantity}
                                                onChange={(e) => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-2">Min Stock Alert</label>
                                                <input type="number" step="0.001" min="0"
                                                    value={formData.min_stock}
                                                    onChange={(e) => setFormData({...formData, min_stock: parseFloat(e.target.value) || 0})}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
                                            </div>
                                            {(formData.unit === 'box' || formData.unit === 'pack') && (
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-600 mb-2">Pieces per Box</label>
                                                    <input type="number" min="1" step="1" placeholder="e.g. 12"
                                                        value={formData.pieces_per_box ?? ''}
                                                        onChange={(e) => setFormData({...formData, pieces_per_box: e.target.value ? parseInt(e.target.value, 10) : null})}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </details>
                            </div>

                            {/* Footer Buttons */}
                            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3 rounded-b-2xl">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setShowEditModal(false);
                                        setFormData({ name: '', unit: 'kg', is_dry: true, pieces_per_box: null, quantity: 0, min_stock: 1, cost_per_unit: 0 });
                                        setCostCalc({ packSize: '', packUnit: 'g', qtyPacks: '', minPacks: '' });
                                        setShowCostCalc(false);
                                    }}
                                    className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                                >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {showAddModal ? 'Add Ingredient' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-red-100 rounded-full">
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Delete Ingredient</h3>
                                    <p className="text-sm text-gray-500">This action cannot be undone</p>
                                </div>
                            </div>
                            <p className="text-gray-600 mb-6">
                                Are you sure you want to delete <span className="font-semibold">{selectedIngredient?.name}</span>?
                                This will affect all recipes using this ingredient.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteIngredient}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
