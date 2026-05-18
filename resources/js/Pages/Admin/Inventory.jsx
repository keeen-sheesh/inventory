import AdminLayout from '@/Layouts/AdminLayout';
import { Head, usePage } from '@inertiajs/react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';

// ============================================================================
// CONSTANTS
// ============================================================================

const PREDEFINED_CATEGORIES = [
    'Vegetables', 'Meat', 'Poultry', 'Seafood', 'Dairy', 'Eggs',
    'Rice & Grains', 'Pasta & Noodles', 'Flour & Baking', 'Sugar & Sweeteners',
    'Spices & Seasonings', 'Oils & Vinegars', 'Sauces & Condiments',
    'Canned Goods', 'Frozen Foods', 'Beverages', 'Bread & Bakery', 'Fruits', 'Herbs', 'Others', 'Snacks', 'Test'
];

const UNIT_OPTIONS = [
    'kg', 'g', 'lb', 'oz', 'L', 'mL', 'gal', 'fl oz',
    'pcs', 'dozen', 'box', 'bag', 'bottle', 'can', 'jar',
    'cup', 'tbsp', 'tsp', 'pinch'
];

const MOVEMENT_TYPES = ['return', 'loss', 'transfer', 'wastage', 'stock_take'];
const ITEMS_PER_PAGE = 10;

// ============================================================================
// UI COMPONENTS
// ============================================================================

const Modal = ({ isOpen, onClose, title, subtitle, size = 'md', children }) => {
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClasses = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' };
    
    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                <div className={`inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle ${sizeClasses[size]} w-full`}>
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                                {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors" aria-label="Close modal">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="px-6 py-5 max-h-[calc(90vh-140px)] overflow-y-auto">{children}</div>
                </div>
            </div>
        </div>
    );
};

const Input = ({ id, label, type = "text", value, onChange, placeholder, required = false, error = null, step = null, disabled = false }) => (
    <div className="mb-4">
        <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            id={id}
            name={id}
            type={type}
            value={value ?? ''}
            onChange={onChange}
            placeholder={placeholder}
            step={step}
            disabled={disabled}
            className={`w-full px-3 py-2 text-sm border ${error ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white disabled:bg-gray-100 disabled:cursor-not-allowed`}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
);

const Select = ({ id, label, value, onChange, options, required = false, error = null, disabled = false }) => (
    <div className="mb-4">
        <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <select
            id={id}
            name={id}
            value={value ?? ''}
            onChange={onChange}
            disabled={disabled}
            className={`w-full px-3 py-2 text-sm border ${error ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white disabled:bg-gray-100 disabled:cursor-not-allowed`}
        >
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
);

const Textarea = ({ id, label, value, onChange, placeholder, rows = 3, disabled = false }) => (
    <div className="mb-4">
        <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
        <textarea
            id={id}
            name={id}
            value={value ?? ''}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
    </div>
);

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false, loading = false, type = 'button' }) => {
    const variants = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
        success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
    };
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${variants[variant]} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
            {loading ? (
                <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Processing...</span>
                </div>
            ) : children}
        </button>
    );
};

const Pagination = ({ currentPage, totalPages, onPageChange, totalItems }) => (
    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems} items
        </div>
        <div className="flex gap-2">
            <button
                onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 text-sm rounded-md border ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'}`}
            >
                Previous
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                let pageNum;
                if (totalPages <= 5) {
                    pageNum = idx + 1;
                } else if (currentPage <= 3) {
                    pageNum = idx + 1;
                } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + idx;
                } else {
                    pageNum = currentPage - 2 + idx;
                }
                return (
                    <button
                        key={pageNum}
                        onClick={() => onPageChange(pageNum)}
                        className={`w-8 h-8 text-sm rounded-md transition ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
                    >
                        {pageNum}
                    </button>
                );
            })}
            <button
                onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 text-sm rounded-md border ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'}`}
            >
                Next
            </button>
        </div>
    </div>
);

const IngredientSearchInput = ({ value, ingredients, onSelect, placeholder = "Type ingredient name..." }) => {
    const [searchText, setSearchText] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);

    useEffect(() => {
        if (value && ingredients?.length > 0) {
            const ingredient = ingredients.find(i => i.id == value);
            if (ingredient) setSearchText(ingredient.name);
        } else if (!value) {
            setSearchText('');
        }
    }, [value, ingredients]);

    const handleInputChange = (e) => {
        const text = e.target.value;
        setSearchText(text);
        setSelectedIndex(-1);
        if (text.length > 0 && ingredients) {
            const matches = ingredients.filter(ing => ing.name.toLowerCase().includes(text.toLowerCase())).slice(0, 5);
            setSuggestions(matches);
            setShowSuggestions(matches.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
            onSelect('');
        }
    };

    const handleSelectSuggestion = (ingredient) => {
        setSearchText(ingredient.name);
        onSelect(ingredient.id);
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (!showSuggestions) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === 'Enter' && selectedIndex >= 0 && suggestions[selectedIndex]) {
            e.preventDefault();
            handleSelectSuggestion(suggestions[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
            setSelectedIndex(-1);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (inputRef.current && !inputRef.current.contains(event.target) &&
                suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
                setShowSuggestions(false);
                setSelectedIndex(-1);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative w-full">
            <input
                ref={inputRef}
                type="text"
                value={searchText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
                <div ref={suggestionsRef} className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {suggestions.map((ing, idx) => (
                        <div
                            key={ing.id}
                            onClick={() => handleSelectSuggestion(ing)}
                            className={`px-3 py-2 cursor-pointer transition-all duration-150 ${idx === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'} ${idx !== suggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                            <div className="font-medium text-gray-900 text-sm">{ing.name}</div>
                            <div className="text-xs text-gray-500 mt-1 flex gap-3">
                                <span>Unit: {ing.unit}</span>
                                <span>Stock: {Math.floor(ing.current_stock)}</span>
                                <span>Price: ₱{ing.cost_per_unit?.toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const IngredientNameValidator = ({ value, ingredients, onLoadExisting, onChange }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [existingWarning, setExistingWarning] = useState(null);
    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);

    useEffect(() => {
        if (value.length > 0 && ingredients) {
            const exactMatch = ingredients.find(ing => ing.name?.toLowerCase() === value.toLowerCase());
            if (exactMatch) {
                setExistingWarning(`⚠️ "${value}" already exists! Adding stock to existing ingredient...`);
                onLoadExisting(exactMatch);
                setSuggestions([]);
                setShowSuggestions(false);
            } else {
                setExistingWarning(null);
                onLoadExisting(null);
                const matches = ingredients.filter(ing => ing.name?.toLowerCase().includes(value.toLowerCase())).slice(0, 3);
                setSuggestions(matches);
                setShowSuggestions(matches.length > 0);
            }
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
            setExistingWarning(null);
            onLoadExisting(null);
        }
    }, [value, ingredients, onLoadExisting]);

    const handleSelectSuggestion = (ingredient) => {
        onChange(ingredient.name);
        onLoadExisting(ingredient);
        setExistingWarning(`⚠️ "${ingredient.name}" already exists! Adding stock to existing ingredient...`);
        setSuggestions([]);
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (!showSuggestions) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === 'Enter' && selectedIndex >= 0 && suggestions[selectedIndex]) {
            e.preventDefault();
            handleSelectSuggestion(suggestions[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
            setSelectedIndex(-1);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (inputRef.current && !inputRef.current.contains(event.target) &&
                suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
                setShowSuggestions(false);
                setSelectedIndex(-1);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative w-full">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => { onChange(e.target.value); setExistingWarning(null); }}
                onKeyDown={handleKeyDown}
                placeholder="Type ingredient name..."
                className={`w-full px-3 py-2 text-sm border ${existingWarning ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white`}
                autoComplete="off"
            />
            {existingWarning && (
                <div className="mt-1 text-xs text-yellow-700 flex items-center gap-1">
                    <span className="text-yellow-500">⚠️</span>
                    {existingWarning}
                </div>
            )}
            {showSuggestions && suggestions.length > 0 && !existingWarning && (
                <div ref={suggestionsRef} className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    <div className="px-3 py-1 bg-gray-50 text-xs text-gray-500 border-b">Similar ingredients found:</div>
                    {suggestions.map((ing, idx) => (
                        <div
                            key={ing.id}
                            onClick={() => handleSelectSuggestion(ing)}
                            className={`px-3 py-2 cursor-pointer transition-all duration-150 ${idx === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'} ${idx !== suggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                            <div className="font-medium text-gray-900 text-sm">{ing.name}</div>
                            <div className="text-xs text-gray-500 mt-1 flex gap-3">
                                <span>Unit: {ing.unit}</span>
                                <span>Stock: {Math.floor(ing.current_stock)}</span>
                                <span>Category: {ing.category || 'Uncategorized'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getStatusColor = (status) => {
    const colors = {
        out_of_stock: 'bg-red-100 text-red-800',
        critical: 'bg-orange-100 text-orange-800',
        low: 'bg-yellow-100 text-yellow-800',
        good: 'bg-green-100 text-green-800'
    };
    return colors[status] || colors.good;
};

const getStatusText = (status) => {
    const texts = {
        out_of_stock: 'Out of Stock',
        critical: 'Critical',
        low: 'Low Stock',
        good: 'In Stock'
    };
    return texts[status] || texts.good;
};

const formatPrice = (price) => `₱${(price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPriceRange = (priceRange) => {
    if (!priceRange) return formatPrice(0);
    if (priceRange.single) return formatPrice(priceRange.single);
    if (priceRange.min && priceRange.max) {
        if (priceRange.min === priceRange.max) return formatPrice(priceRange.min);
        return `${formatPrice(priceRange.min)} - ${formatPrice(priceRange.max)}`;
    }
    return formatPrice(0);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Inventory({ auth }) {
    const { props } = usePage();
    
    const [loading, setLoading] = useState(false);
    const [ingredients, setIngredients] = useState(props.ingredients || []);
    const [items, setItems] = useState(props.items || []);
    const [receipts, setReceipts] = useState(props.recentReceipts || []);
    const [auditTrail, setAuditTrail] = useState([]);
    const [stockReturns, setStockReturns] = useState([]);
    const [stockLosses, setStockLosses] = useState([]);
    const [stockTransfers, setStockTransfers] = useState([]);
    const [stockTakes, setStockTakes] = useState([]);
    const [wastage, setWastage] = useState([]);
    const [stats, setStats] = useState(props.stats || {
        total_ingredients: 0,
        low_stock_count: 0,
        out_of_stock_count: 0,
        critical_stock_count: 0,
        total_value: 0
    });

    const [activeTab, setActiveTab] = useState('ingredients');
    const [successMessage, setSuccessMessage] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [formErrors, setFormErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openDropdown, setOpenDropdown] = useState(null);

    const [ingredientsPage, setIngredientsPage] = useState(1);
    const [receiptsPage, setReceiptsPage] = useState(1);
    const [movementsPage, setMovementsPage] = useState(1);
    const [auditPage, setAuditPage] = useState(1);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCategory, setFilterCategory] = useState('All Categories');
    const [filterPool, setFilterPool] = useState('all');
    const [movementFilter, setMovementFilter] = useState('all');

    const [showAddIngredient, setShowAddIngredient] = useState(false);
    const [showEditIngredient, setShowEditIngredient] = useState(false);
    const [showBulkUpdate, setShowBulkUpdate] = useState(false);
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [showStockMovement, setShowStockMovement] = useState(false);
    const [showStockCheck, setShowStockCheck] = useState(false);
    const [showReceiptDetails, setShowReceiptDetails] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [customCategory, setCustomCategory] = useState(false);
    const [selectedMovementType, setSelectedMovementType] = useState('return');
    const [selectedItem, setSelectedItem] = useState(null);
    const [checkingItem, setCheckingItem] = useState(null);
    const [checkQuantity, setCheckQuantity] = useState(1);
    const [checkResult, setCheckResult] = useState(null);
    const [existingIngredientId, setExistingIngredientId] = useState(null);

    const [newIngredient, setNewIngredient] = useState({
        name: '', unit: 'kg', category: '', pool: 'resto', min_stock: 0, initial_stock: 0, cost_per_unit: 0
    });
    
    const [editIngredientData, setEditIngredientData] = useState({
        id: null, name: '', unit: 'kg', category: '', min_stock: 0, current_stock: 0, pool: '', cost_per_unit: 0
    });
    
    const [bulkData, setBulkData] = useState({
        receipt_number: '', supplier_name: '', receipt_date: new Date().toISOString().split('T')[0],
        notes: '', pool: 'resto', items: [{ ingredient_id: '', quantity: '', cost_per_unit: '' }]
    });
    
    const [recipeData, setRecipeData] = useState({ ingredients: [] });
    
    const [stockReturnForm, setStockReturnForm] = useState({
        ingredient_id: '', pool: 'resto', quantity: '', reason: '', notes: ''
    });
    
    const [stockLossForm, setStockLossForm] = useState({
        ingredient_id: '', pool: 'resto', quantity: '', loss_type: 'spoilage', notes: ''
    });
    
    const [stockTransferForm, setStockTransferForm] = useState({
        ingredient_id: '', from_pool: 'resto', to_pool: 'kitchen', quantity: '', notes: ''
    });
    
    const [wastageForm, setWastageForm] = useState({
        ingredient_id: '', pool: 'resto', quantity: '', wastage_reason: '', notes: ''
    });
    
    const [stockTakeItems, setStockTakeItems] = useState([{ ingredient_id: '', pool: 'resto', counted_quantity: '' }]);
    const [stockTakeLabel, setStockTakeLabel] = useState('');

    const refreshIngredients = useCallback(async () => {
        try {
            const response = await axios.get('/admin/inventory/ingredients');
            if (response.data.success && response.data.ingredients) {
                setIngredients(response.data.ingredients);
                const ingredientsData = response.data.ingredients;
                setStats({
                    total_ingredients: ingredientsData.length,
                    low_stock_count: ingredientsData.filter(i => i.status === 'low').length,
                    out_of_stock_count: ingredientsData.filter(i => i.status === 'out_of_stock').length,
                    critical_stock_count: ingredientsData.filter(i => i.status === 'critical').length,
                    total_value: ingredientsData.reduce((sum, i) => sum + ((i.current_stock || 0) * (i.cost_per_unit || 0)), 0)
                });
            }
        } catch (error) {
            console.error('Failed to refresh ingredients:', error);
        }
    }, []);

    const refreshTransactions = useCallback(async () => {
        try {
            const [auditRes, returnsRes, lossesRes, transfersRes, takesRes, wastageRes] = await Promise.all([
                axios.get('/admin/inventory/audit-trail'),
                axios.get('/admin/inventory/stock-returns'),
                axios.get('/admin/inventory/stock-losses'),
                axios.get('/admin/inventory/stock-transfers'),
                axios.get('/admin/inventory/stock-takes'),
                axios.get('/admin/inventory/wastage')
            ]);

            if (auditRes.data?.success) setAuditTrail(auditRes.data.records || []);
            if (returnsRes.data?.success) setStockReturns(returnsRes.data.records || []);
            if (lossesRes.data?.success) setStockLosses(lossesRes.data.records || []);
            if (transfersRes.data?.success) setStockTransfers(transfersRes.data.records || []);
            if (takesRes.data?.success) setStockTakes(takesRes.data.records || []);
            if (wastageRes.data?.success) setWastage(wastageRes.data.records || []);
        } catch (error) {
            console.error('Failed to refresh transactions:', error);
        }
    }, []);

    useEffect(() => {
        refreshTransactions();
    }, [refreshTransactions]);

    const showSuccess = (message) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const showError = (message) => {
        setErrorMessage(message);
        setTimeout(() => setErrorMessage(null), 5000);
    };

    const addOrUpdateIngredient = async () => {
        if (!newIngredient.name) {
            setFormErrors({ name: 'Ingredient name is required' });
            return;
        }
        
        setIsSubmitting(true);
        
        if (existingIngredientId) {
            try {
                const response = await axios.post('/admin/inventory/add-stock', {
                    ingredient_id: existingIngredientId,
                    quantity: parseFloat(newIngredient.initial_stock) || 0,
                    cost_per_unit: parseFloat(newIngredient.cost_per_unit) || 0,
                    pool: newIngredient.pool,
                    notes: `Added ${newIngredient.initial_stock} ${newIngredient.unit} to existing ingredient`
                });
                
                if (response.data.success) {
                    setShowAddIngredient(false);
                    setNewIngredient({ name: '', unit: 'kg', category: '', pool: 'resto', min_stock: 0, initial_stock: 0, cost_per_unit: 0 });
                    setCustomCategory(false);
                    setExistingIngredientId(null);
                    setFormErrors({});
                    await refreshIngredients();
                    showSuccess(response.data.message || 'Stock added successfully');
                } else {
                    showError(response.data.message || 'Failed to add stock');
                }
            } catch (error) {
                console.error('Add stock error:', error);
                showError(error.response?.data?.message || 'Failed to add stock');
            } finally {
                setIsSubmitting(false);
            }
        } else {
            try {
                const payload = {
                    name: newIngredient.name,
                    unit: newIngredient.unit,
                    category: newIngredient.category || null,
                    min_stock: parseInt(newIngredient.min_stock) || 0,
                    initial_stock: parseFloat(newIngredient.initial_stock) || 0,
                    pool: newIngredient.pool,
                    cost_per_unit: parseFloat(newIngredient.cost_per_unit) || 0
                };
                
                console.log('Creating ingredient with payload:', payload);
                
                const response = await axios.post('/admin/inventory/ingredients', payload);
                
                if (response.data.success) {
                    setShowAddIngredient(false);
                    setNewIngredient({ name: '', unit: 'kg', category: '', pool: 'resto', min_stock: 0, initial_stock: 0, cost_per_unit: 0 });
                    setCustomCategory(false);
                    setFormErrors({});
                    await refreshIngredients();
                    showSuccess(`Created new ingredient: ${newIngredient.name}`);
                } else {
                    showError(response.data.message || 'Failed to add ingredient');
                }
            } catch (error) {
                console.error('Create ingredient error:', error);
                showError(error.response?.data?.message || 'Failed to add ingredient');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const updateIngredient = async () => {
        setIsSubmitting(true);
        try {
            const payload = {
                name: editIngredientData.name,
                unit: editIngredientData.unit,
                category: editIngredientData.category || null,
                min_stock: parseInt(editIngredientData.min_stock) || 0,
                current_stock: editIngredientData.current_stock || 0,
                pool: editIngredientData.pool,
                cost_per_unit: parseFloat(editIngredientData.cost_per_unit) || 0
            };
            
            console.log('=== UPDATING INGREDIENT ===');
            console.log('ID:', editIngredientData.id);
            console.log('Category value being sent:', payload.category);
            
            const response = await axios.put(`/admin/inventory/ingredients/${editIngredientData.id}`, payload);
            
            if (response.data.success) {
                setShowEditIngredient(false);
                setFormErrors({});
                await refreshIngredients();
                showSuccess('Ingredient updated successfully.');
            } else {
                showError(response.data.message || 'Failed to update ingredient');
            }
        } catch (error) {
            console.error('Update ingredient error:', error);
            showError(error.response?.data?.message || 'Failed to update ingredient');
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteIngredient = async (ingredient) => {
        if (!confirm(`Are you sure you want to delete "${ingredient.name}"?`)) return;
        
        try {
            const response = await axios.delete(`/admin/inventory/ingredients/${ingredient.id}`);
            if (response.data.success) {
                await refreshIngredients();
                showSuccess('Ingredient deleted successfully.');
            } else {
                showError(response.data.message || 'Failed to delete ingredient');
            }
        } catch (error) {
            showError(error.response?.data?.message || 'Error deleting ingredient');
        }
        setOpenDropdown(null);
    };

    const loadExistingIngredientIntoForm = (existingIngredient) => {
        if (existingIngredient) {
            setExistingIngredientId(existingIngredient.id);
            setNewIngredient({
                name: existingIngredient.name,
                unit: existingIngredient.unit,
                category: existingIngredient.category || '',
                pool: existingIngredient.pool,
                min_stock: existingIngredient.min_stock,
                initial_stock: 0,
                cost_per_unit: existingIngredient.cost_per_unit
            });
            if (existingIngredient.category && !PREDEFINED_CATEGORIES.includes(existingIngredient.category)) {
                setCustomCategory(true);
            } else {
                setCustomCategory(false);
            }
        } else {
            setExistingIngredientId(null);
        }
    };

    const submitBulkUpdate = async () => {
        const validItems = bulkData.items.filter(item => item.ingredient_id && item.quantity && item.cost_per_unit);
        if (validItems.length === 0) {
            setFormErrors({ items: 'Please add at least one item' });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const response = await axios.post('/admin/inventory/bulk-update-stock', {
                receipt_number: bulkData.receipt_number || null,
                supplier_name: bulkData.supplier_name || null,
                receipt_date: bulkData.receipt_date,
                notes: bulkData.notes || null,
                pool: bulkData.pool,
                items: validItems.map(item => ({
                    ingredient_id: parseInt(item.ingredient_id),
                    quantity: parseInt(item.quantity),
                    cost_per_unit: parseFloat(item.cost_per_unit)
                }))
            });

            if (response.data.success) {
                setShowBulkUpdate(false);
                setBulkData({
                    receipt_number: '', supplier_name: '', receipt_date: new Date().toISOString().split('T')[0],
                    notes: '', pool: 'resto', items: [{ ingredient_id: '', quantity: '', cost_per_unit: '' }]
                });
                setFormErrors({});
                await refreshIngredients();
                showSuccess(response.data.message || 'Stock updated successfully.');
            } else {
                showError(response.data.message || 'Failed to update stock');
            }
        } catch (error) {
            showError(error.response?.data?.message || 'Failed to update stock');
        } finally {
            setIsSubmitting(false);
        }
    };

    const addBulkItem = () => {
        setBulkData({ ...bulkData, items: [...bulkData.items, { ingredient_id: '', quantity: '', cost_per_unit: '' }] });
    };

    const updateBulkItem = (index, field, value) => {
        const newItems = [...bulkData.items];
        newItems[index][field] = value;
        setBulkData({ ...bulkData, items: newItems });
    };

    const removeBulkItem = (index) => {
        setBulkData({ ...bulkData, items: bulkData.items.filter((_, i) => i !== index) });
    };

    const openRecipeModal = async (item) => {
        setSelectedItem(item);
        try {
            const response = await axios.get(`/admin/inventory/items/${item.id}/recipe`);
            if (response.data.success && response.data.item) {
                const existingIngredients = response.data.item.ingredients?.map(ing => ({
                    id: ing.id,
                    name: ing.name,
                    quantity_required: ing.pivot?.quantity_required || 0,
                    unit: ing.unit
                })) || [];
                setRecipeData({ ingredients: existingIngredients });
            } else {
                setRecipeData({ ingredients: [] });
            }
        } catch (error) {
            console.error('Failed to load recipe:', error);
            setRecipeData({ ingredients: [] });
        }
        setShowRecipeModal(true);
    };

    const addRecipeIngredient = () => {
        setRecipeData({ ...recipeData, ingredients: [...recipeData.ingredients, { id: '', quantity_required: 0, name: '', unit: '' }] });
    };

    const updateRecipeIngredient = (index, field, value) => {
        const newIngredients = [...recipeData.ingredients];
        if (field === 'id') {
            const selectedIng = ingredients.find(i => i.id == value);
            newIngredients[index] = {
                ...newIngredients[index],
                id: value,
                name: selectedIng?.name || '',
                unit: selectedIng?.unit || ''
            };
        } else {
            newIngredients[index][field] = value;
        }
        setRecipeData({ ...recipeData, ingredients: newIngredients });
    };

    const removeRecipeIngredient = (index) => {
        setRecipeData({ ...recipeData, ingredients: recipeData.ingredients.filter((_, i) => i !== index) });
    };

    const saveRecipe = async () => {
        const validIngredients = recipeData.ingredients.filter(ing => ing.id && ing.quantity_required > 0);
        if (validIngredients.length === 0) {
            setFormErrors({ ingredients: 'Please add at least one ingredient' });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const response = await axios.post(`/admin/inventory/items/${selectedItem.id}/recipe`, { 
                ingredients: validIngredients.map(ing => ({
                    id: parseInt(ing.id),
                    quantity_required: parseFloat(ing.quantity_required),
                    unit: ing.unit
                }))
            });
            
            if (response.data.success) {
                setShowRecipeModal(false);
                setFormErrors({});
                showSuccess('Recipe saved successfully.');
            } else {
                showError(response.data.message || 'Failed to save recipe');
            }
        } catch (error) {
            showError(error.response?.data?.message || 'Failed to save recipe');
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitStockMovement = async (type, formData) => {
        const endpoints = {
            return: '/admin/inventory/stock-returns',
            loss: '/admin/inventory/stock-losses',
            transfer: '/admin/inventory/stock-transfers',
            wastage: '/admin/inventory/wastage'
        };
        
        if (!formData.ingredient_id || !formData.quantity) {
            setFormErrors({ submit: 'Please select ingredient and enter quantity' });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const response = await axios.post(endpoints[type], formData);
            
            if (response.data.success) {
                await refreshIngredients();
                await refreshTransactions();
                setShowStockMovement(false);
                showSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} recorded successfully.`);
                
                if (type === 'return') setStockReturnForm({ ingredient_id: '', pool: 'resto', quantity: '', reason: '', notes: '' });
                if (type === 'loss') setStockLossForm({ ingredient_id: '', pool: 'resto', quantity: '', loss_type: 'spoilage', notes: '' });
                if (type === 'transfer') setStockTransferForm({ ingredient_id: '', from_pool: 'resto', to_pool: 'kitchen', quantity: '', notes: '' });
                if (type === 'wastage') setWastageForm({ ingredient_id: '', pool: 'resto', quantity: '', wastage_reason: '', notes: '' });
            } else {
                showError(response.data.message || 'Failed to record movement');
            }
        } catch (error) {
            showError(error.response?.data?.message || 'Failed to record movement');
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitStockTake = async () => {
        const validItems = stockTakeItems.filter(i => i.ingredient_id && i.counted_quantity !== '');
        if (validItems.length === 0) {
            setFormErrors({ submit: 'Add at least one item.' });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const response = await axios.post('/admin/inventory/stock-takes', {
                batch_label: stockTakeLabel || null,
                notes: null,
                items: validItems.map(i => ({
                    ingredient_id: parseInt(i.ingredient_id),
                    pool: i.pool,
                    counted_quantity: parseInt(i.counted_quantity)
                }))
            });
            
            if (response.data.success) {
                await refreshIngredients();
                await refreshTransactions();
                setShowStockMovement(false);
                setStockTakeItems([{ ingredient_id: '', pool: 'resto', counted_quantity: '' }]);
                setStockTakeLabel('');
                showSuccess('Stock take completed.');
            } else {
                showError(response.data.message || 'Stock take failed');
            }
        } catch (error) {
            showError(error.response?.data?.message || 'Stock take failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const addStockTakeItem = () => {
        setStockTakeItems([...stockTakeItems, { ingredient_id: '', pool: 'resto', counted_quantity: '' }]);
    };
    
    const removeStockTakeItem = (index) => {
        setStockTakeItems(stockTakeItems.filter((_, i) => i !== index));
    };
    
    const updateStockTakeItem = (index, field, value) => {
        const newItems = [...stockTakeItems];
        newItems[index][field] = value;
        setStockTakeItems(newItems);
    };

    const checkAvailability = async () => {
        if (!checkingItem) return;
        try {
            const response = await axios.get(`/admin/inventory/items/${checkingItem.id}/check-availability`, {
                params: { quantity: checkQuantity }
            });
            setCheckResult(response.data);
        } catch (error) {
            showError('Error checking availability: ' + (error.response?.data?.message || 'Unknown error'));
        }
    };

    const getAllMovements = useCallback(() => {
        const movements = [];
        
        stockReturns.forEach(m => movements.push({ 
            ...m, 
            type: 'return', 
            icon: '↩️', 
            color: 'orange', 
            date: m.created_at,
            ingredient: m.ingredient,
            unit: m.unit,
            pool: m.pool,
            quantity: m.quantity,
            user: m.user,
            notes: m.notes
        }));
        
        stockLosses.forEach(m => movements.push({ 
            ...m, 
            type: 'loss', 
            icon: '⚠️', 
            color: 'red', 
            date: m.created_at,
            ingredient: m.ingredient,
            unit: m.unit,
            pool: m.pool,
            quantity: m.quantity,
            user: m.user,
            notes: m.notes
        }));
        
        stockTransfers.forEach(m => movements.push({ 
            ...m, 
            type: 'transfer', 
            icon: '🔄', 
            color: 'blue', 
            date: m.created_at,
            ingredient: m.ingredient,
            unit: m.unit,
            pool: m.pool,
            quantity: m.quantity,
            user: m.user,
            notes: m.notes
        }));
        
        wastage.forEach(m => movements.push({ 
            ...m, 
            type: 'wastage', 
            icon: '🗑️', 
            color: 'gray', 
            date: m.created_at,
            ingredient: m.ingredient,
            unit: m.unit,
            pool: m.pool,
            quantity: m.quantity,
            user: m.user,
            notes: m.notes
        }));
        
        stockTakes.forEach(m => movements.push({ 
            ...m, 
            type: 'stock_take', 
            icon: '📋', 
            color: 'green', 
            date: m.created_at,
            ingredient: m.ingredient,
            unit: m.unit,
            pool: m.pool,
            quantity_delta: m.quantity_delta,
            user: m.user,
            notes: m.notes
        }));
        
        return movements.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [stockReturns, stockLosses, stockTransfers, wastage, stockTakes]);

    const getCategoryOptions = useCallback(() => {
        const ingredientCategories = ingredients.map(ing => ing.category).filter(c => c && c !== '');
        return ['All Categories', 'Uncategorized', ...new Set([...PREDEFINED_CATEGORIES, ...ingredientCategories])];
    }, [ingredients]);

    const allMovements = useMemo(() => getAllMovements(), [getAllMovements]);
    const filteredMovements = useMemo(() => {
        return movementFilter === 'all' ? allMovements : allMovements.filter(m => m.type === movementFilter);
    }, [allMovements, movementFilter]);
    
    const categoryOptions = useMemo(() => getCategoryOptions(), [getCategoryOptions]);
    
    const filteredIngredients = useMemo(() => {
        if (!ingredients || ingredients.length === 0) return [];
        
        return ingredients.filter(ing => {
            let matchesSearch = true;
            if (searchTerm) {
                matchesSearch = (ing.name && ing.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                               (ing.category && ing.category.toLowerCase().includes(searchTerm.toLowerCase()));
            }
            
            let matchesCategory = true;
            if (filterCategory === 'All Categories') {
                matchesCategory = true;
            } else if (filterCategory === 'Uncategorized') {
                matchesCategory = !ing.category || ing.category === '';
            } else {
                matchesCategory = ing.category === filterCategory;
            }
            
            let matchesStatus = true;
            if (filterStatus !== 'all') {
                matchesStatus = ing.status === filterStatus;
            }
            
            let matchesPool = true;
            if (filterPool !== 'all') {
                matchesPool = ing.pool === filterPool;
            }
            
            return matchesSearch && matchesCategory && matchesStatus && matchesPool;
        });
    }, [ingredients, searchTerm, filterCategory, filterStatus, filterPool]);

    return (
        <AdminLayout user={auth.user} header="Inventory Management">
            <Head title="Inventory Management" />
            
            <div className="space-y-6">
                {successMessage && (
                    <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-lg p-3 shadow-lg animate-slide-in">
                        <div className="flex items-center gap-2">
                            <span className="text-green-600 text-sm">✓</span>
                            <p className="text-green-700 text-xs font-medium">{successMessage}</p>
                        </div>
                    </div>
                )}

                {errorMessage && (
                    <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg animate-slide-in">
                        <div className="flex items-center gap-2">
                            <span className="text-red-600 text-sm">✗</span>
                            <p className="text-red-700 text-xs font-medium">{errorMessage}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-white rounded-lg border p-4 shadow-sm">
                        <div className="text-xs text-gray-500">Total Ingredients</div>
                        <div className="text-xl font-bold text-gray-900">{stats.total_ingredients || ingredients.length}</div>
                    </div>
                    <div className="bg-white rounded-lg border p-4 shadow-sm">
                        <div className="text-xs text-yellow-600">Low Stock</div>
                        <div className="text-xl font-bold text-yellow-600">{stats.low_stock_count || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg border p-4 shadow-sm">
                        <div className="text-xs text-orange-600">Critical</div>
                        <div className="text-xl font-bold text-orange-600">{stats.critical_stock_count || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg border p-4 shadow-sm">
                        <div className="text-xs text-red-600">Out of Stock</div>
                        <div className="text-xl font-bold text-red-600">{stats.out_of_stock_count || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg border p-4 shadow-sm">
                        <div className="text-xs text-green-600">Total Value</div>
                        <div className="text-xl font-bold text-green-600">{formatPrice(stats.total_value)}</div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
                    <div className="border-b bg-gray-50">
                        <div className="flex gap-0 px-4 overflow-x-auto">
                            {[
                                { id: 'ingredients', label: `Ingredients (${ingredients?.length || 0})` },
                                { id: 'items', label: `Menu Items (${items?.length || 0})` },
                                { id: 'purchase_history', label: `Purchase History (${receipts?.length || 0})` },
                                { id: 'stock_movements', label: 'Stock Movements' },
                                { id: 'audit_trail', label: 'Audit Trail' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`py-2.5 px-3 text-xs font-medium whitespace-nowrap transition border-b-2 ${activeTab === tab.id ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-600'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeTab === 'ingredients' && (
                        <div className="p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-base font-semibold text-gray-900">Ingredients List</h2>
                                <div className="flex gap-2">
                                    <Button onClick={() => setShowBulkUpdate(true)} variant="success">Bulk Update</Button>
                                    <Button onClick={() => setShowAddIngredient(true)} variant="primary">Add Ingredient</Button>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-3 mb-4">
                                <input
                                    id="search"
                                    name="search"
                                    type="text"
                                    placeholder="Search ingredients..."
                                    className="flex-1 min-w-[180px] px-3 py-1.5 border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setIngredientsPage(1); }}
                                />
                                <select id="categoryFilter" name="categoryFilter" className="px-2 py-1.5 border rounded-md text-xs bg-white" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setIngredientsPage(1); }}>
                                    {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                <select id="statusFilter" name="statusFilter" className="px-2 py-1.5 border rounded-md text-xs bg-white" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setIngredientsPage(1); }}>
                                    <option value="all">All Status</option>
                                    <option value="good">In Stock</option>
                                    <option value="low">Low Stock</option>
                                    <option value="critical">Critical</option>
                                    <option value="out_of_stock">Out of Stock</option>
                                </select>
                                <select id="poolFilter" name="poolFilter" className="px-2 py-1.5 border rounded-md text-xs bg-white" value={filterPool} onChange={(e) => { setFilterPool(e.target.value); setIngredientsPage(1); }}>
                                    <option value="all">All Pools</option>
                                    <option value="resto">Restaurant</option>
                                    <option value="kitchen">Kitchen</option>
                                </select>
                            </div>
                            
                            <div className="overflow-x-auto">
                                {filteredIngredients.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-xs">
                                        No ingredients found. Click "Add Ingredient" to get started.
                                    </div>
                                ) : (
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-3 py-2 text-left">Name</th>
                                                <th className="px-3 py-2 text-left">Category</th>
                                                <th className="px-3 py-2 text-left">Unit</th>
                                                <th className="px-3 py-2 text-center">Pool</th>
                                                <th className="px-3 py-2 text-center">Stock</th>
                                                <th className="px-3 py-2 text-center">Price</th>
                                                <th className="px-3 py-2 text-center">Total</th>
                                                <th className="px-3 py-2 text-center">Min</th>
                                                <th className="px-3 py-2 text-center">Status</th>
                                                <th className="px-3 py-2 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {filteredIngredients.slice((ingredientsPage - 1) * ITEMS_PER_PAGE, ingredientsPage * ITEMS_PER_PAGE).map(ing => (
                                                <tr key={ing.id} className="hover:bg-gray-50 transition">
                                                    <td className="px-3 py-2 font-medium">{ing.name}</td>
                                                    <td className="px-3 py-2 text-gray-500">{ing.category || '—'}</td>
                                                    <td className="px-3 py-2">{ing.unit}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${ing.pool === 'resto' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                            {ing.pool === 'resto' ? 'Restaurant' : 'Kitchen'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-mono">{Math.floor(ing.current_stock)}</td>
                                                    <td className="px-3 py-2 text-center text-green-600">
                                                        {formatPriceRange(ing.price_range)}
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-medium text-blue-600">{formatPrice((ing.current_stock || 0) * (ing.cost_per_unit || 0))}</td>
                                                    <td className="px-3 py-2 text-center">{Math.floor(ing.min_stock)}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(ing.status)}`}>
                                                            {getStatusText(ing.status)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center relative">
                                                        <button onClick={() => setOpenDropdown(openDropdown === ing.id ? null : ing.id)} className="text-gray-400 hover:text-gray-600">•••</button>
                                                        {openDropdown === ing.id && (
                                                            <div className="absolute right-0 mt-1 w-24 bg-white border rounded-md shadow-lg z-10">
                                                                <button onClick={() => { setEditIngredientData(ing); setShowEditIngredient(true); setOpenDropdown(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">Edit</button>
                                                                <button onClick={() => deleteIngredient(ing)} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-gray-50">Delete</button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            
                            {filteredIngredients.length > ITEMS_PER_PAGE && (
                                <Pagination currentPage={ingredientsPage} totalPages={Math.ceil(filteredIngredients.length / ITEMS_PER_PAGE)} onPageChange={setIngredientsPage} totalItems={filteredIngredients.length} />
                            )}
                        </div>
                    )}

                    {activeTab === 'items' && (
                        <div className="p-4">
                            <h2 className="text-base font-semibold mb-4">Menu Items</h2>
                            <div className="overflow-x-auto">
                                {items.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-xs">No menu items found.</div>
                                ) : (
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-3 py-2 text-left">Name</th>
                                                <th className="px-3 py-2 text-left">Category</th>
                                                <th className="px-3 py-2 text-center">Price</th>
                                                <th className="px-3 py-2 text-center">Recipe</th>
                                                <th className="px-3 py-2 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {items.map(item => (
                                                <tr key={item.id} className="hover:bg-gray-50 transition">
                                                    <td className="px-3 py-2 font-medium">{item.name}</td>
                                                    <td className="px-3 py-2 text-gray-500">{item.category?.name || '—'}</td>
                                                    <td className="px-3 py-2 text-center text-green-600">{formatPrice(item.price)}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${item.has_recipe ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {item.has_recipe ? 'Has Recipe' : 'No Recipe'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <button onClick={() => openRecipeModal(item)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                                                            {item.has_recipe ? 'Edit Recipe' : 'Add Recipe'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'purchase_history' && (
                        <div className="p-4">
                            <h2 className="text-base font-semibold mb-1">Purchase History</h2>
                            <p className="text-xs text-gray-500 mb-4">Click on any receipt to view full details</p>
                            
                            <div className="space-y-2">
                                {receipts.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-xs">No purchase receipts yet. Add ingredients or use Bulk Update.</div>
                                ) : (
                                    receipts.slice((receiptsPage - 1) * ITEMS_PER_PAGE, receiptsPage * ITEMS_PER_PAGE).map(receipt => (
                                        <div key={receipt.id} onClick={() => { setSelectedReceipt(receipt); setShowReceiptDetails(true); }} className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium text-sm">{receipt.receipt_number}</span>
                                                        <span className={`text-xs px-1.5 py-0.5 rounded ${receipt.pool?.code === 'resto' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                                                            {receipt.pool?.code === 'resto' ? 'Restaurant' : 'Kitchen'}
                                                        </span>
                                                        <span className="text-xs text-gray-400">Click to view →</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {receipt.supplier_name && <div>Supplier: {receipt.supplier_name}</div>}
                                                        <div>Date: {receipt.receipt_date}</div>
                                                        <div>Items: {receipt.items?.length || 0}</div>
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {receipt.items?.slice(0, 3).map((item, idx) => (
                                                            <span key={idx} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                                                {item.ingredient?.name} ({Math.floor(item.quantity)})
                                                            </span>
                                                        ))}
                                                        {receipt.items?.length > 3 && <span className="text-xs text-gray-400">+{receipt.items.length - 3} more</span>}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-base font-bold text-green-600">{formatPrice(receipt.total_amount)}</div>
                                                    <div className="text-xs text-gray-400">By: {receipt.user?.name || 'Unknown'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            {receipts.length > ITEMS_PER_PAGE && (
                                <Pagination currentPage={receiptsPage} totalPages={Math.ceil(receipts.length / ITEMS_PER_PAGE)} onPageChange={setReceiptsPage} totalItems={receipts.length} />
                            )}
                        </div>
                    )}

                    {activeTab === 'stock_movements' && (
                        <div className="p-4">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h2 className="text-base font-semibold">Stock Movements</h2>
                                    <p className="text-xs text-gray-500">Track all inventory changes</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => { setSelectedMovementType('return'); setShowStockMovement(true); }} variant="primary">Record Movement</Button>
                                    <Button onClick={() => setShowStockCheck(true)} variant="secondary">Stock Check</Button>
                                </div>
                            </div>
                            
                            <select className="px-2 py-1.5 border rounded-md text-xs mb-4 bg-white" value={movementFilter} onChange={(e) => { setMovementFilter(e.target.value); setMovementsPage(1); }}>
                                <option value="all">All Movements</option>
                                <option value="return">Returns</option>
                                <option value="loss">Losses</option>
                                <option value="transfer">Transfers</option>
                                <option value="wastage">Wastage</option>
                                <option value="stock_take">Stock Takes</option>
                            </select>
                            
                            <div className="space-y-2">
                                {filteredMovements.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-xs">No movements recorded yet.</div>
                                ) : (
                                    filteredMovements.slice((movementsPage - 1) * ITEMS_PER_PAGE, movementsPage * ITEMS_PER_PAGE).map((movement, idx) => {
                                        const colorClasses = {
                                            orange: 'bg-orange-50 border-orange-100',
                                            red: 'bg-red-50 border-red-100',
                                            blue: 'bg-blue-50 border-blue-100',
                                            gray: 'bg-gray-50 border-gray-200',
                                            green: 'bg-green-50 border-green-100'
                                        };
                                        return (
                                            <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${colorClasses[movement.color]}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl">{movement.icon}</span>
                                                    <div>
                                                        <span className="font-medium text-sm capitalize">{movement.type.replace('_', ' ')}</span>
                                                        <span className="ml-1 text-sm">- {movement.ingredient}</span>
                                                        <span className="ml-1 text-xs text-gray-500">({movement.pool})</span>
                                                        {movement.notes && <p className="text-xs text-gray-400 mt-0.5">{movement.notes}</p>}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-semibold text-sm">
                                                        {movement.type === 'transfer' ? `${movement.quantity} ${movement.unit || ''}` : 
                                                         movement.type === 'stock_take' ? `${movement.quantity_delta > 0 ? '+' : ''}${movement.quantity_delta} ${movement.unit || ''}` :
                                                         `-${movement.quantity} ${movement.unit || ''}`}
                                                    </div>
                                                    <div className="text-xs text-gray-400">{movement.user} · {new Date(movement.date).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            
                            {filteredMovements.length > ITEMS_PER_PAGE && (
                                <Pagination currentPage={movementsPage} totalPages={Math.ceil(filteredMovements.length / ITEMS_PER_PAGE)} onPageChange={setMovementsPage} totalItems={filteredMovements.length} />
                            )}
                        </div>
                    )}

                    {activeTab === 'audit_trail' && (
                        <div className="p-4">
                            <h2 className="text-base font-semibold mb-4">Audit Trail</h2>
                            <div className="overflow-x-auto">
                                {auditTrail.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-xs">No audit records yet.</div>
                                ) : (
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-3 py-2 text-left">Date/Time</th>
                                                <th className="px-3 py-2 text-left">Ingredient</th>
                                                <th className="px-3 py-2 text-center">Pool</th>
                                                <th className="px-3 py-2 text-center">Change</th>
                                                <th className="px-3 py-2 text-left">Type</th>
                                                <th className="px-3 py-2 text-left">User</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {auditTrail.slice((auditPage - 1) * ITEMS_PER_PAGE, auditPage * ITEMS_PER_PAGE).map(record => (
                                                <tr key={record.id} className="hover:bg-gray-50 transition">
                                                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{new Date(record.created_at).toLocaleString()}</td>
                                                    <td className="px-3 py-2 font-medium">{record.ingredient}</td>
                                                    <td className="px-3 py-2 text-center">{record.pool}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={`font-mono font-semibold ${record.quantity_delta > 0 ? 'text-green-700' : record.quantity_delta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                            {record.quantity_delta > 0 ? '+' : ''}{record.quantity_delta} {record.unit}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2"><span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{record.reason?.replace('_', ' ')}</span></td>
                                                    <td className="px-3 py-2">{record.user}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            {auditTrail.length > ITEMS_PER_PAGE && (
                                <Pagination currentPage={auditPage} totalPages={Math.ceil(auditTrail.length / ITEMS_PER_PAGE)} onPageChange={setAuditPage} totalItems={auditTrail.length} />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Receipt Details Modal */}
            <Modal isOpen={showReceiptDetails} onClose={() => setShowReceiptDetails(false)} title="Receipt Details" subtitle={selectedReceipt?.receipt_number} size="lg">
                {selectedReceipt && (
                    <div className="space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4 border">
                            <div className="grid grid-cols-2 gap-4">
                                <div><p className="text-xs text-gray-500">Receipt #</p><p className="text-sm font-medium">{selectedReceipt.receipt_number}</p></div>
                                <div><p className="text-xs text-gray-500">Date</p><p className="text-sm">{selectedReceipt.receipt_date}</p></div>
                                <div><p className="text-xs text-gray-500">Supplier</p><p className="text-sm">{selectedReceipt.supplier_name || 'N/A'}</p></div>
                                <div><p className="text-xs text-gray-500">Pool</p><span className={`inline-block px-2 py-0.5 rounded text-xs ${selectedReceipt.pool?.code === 'resto' ? 'bg-blue-100' : 'bg-purple-100'}`}>{selectedReceipt.pool?.code === 'resto' ? 'Restaurant' : 'Kitchen'}</span></div>
                                <div><p className="text-xs text-gray-500">Created By</p><p className="text-sm">{selectedReceipt.user?.name || 'Unknown'}</p></div>
                                <div><p className="text-xs text-gray-500">Created At</p><p className="text-sm">{new Date(selectedReceipt.created_at).toLocaleString()}</p></div>
                            </div>
                            {selectedReceipt.notes && (
                                <div className="mt-3 pt-3 border-t">
                                    <p className="text-xs text-gray-500">Notes</p>
                                    <p className="text-sm">{selectedReceipt.notes}</p>
                                </div>
                            )}
                        </div>
                        
                        <div>
                            <h4 className="text-sm font-semibold mb-3">Items Received</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Item</th>
                                            <th className="px-3 py-2 text-center">Qty</th>
                                            <th className="px-3 py-2 text-center">Unit</th>
                                            <th className="px-3 py-2 text-center">Unit Price</th>
                                            <th className="px-3 py-2 text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {selectedReceipt.items?.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 font-medium">{item.ingredient?.name}</td>
                                                <td className="px-3 py-2 text-center">{parseFloat(item.quantity).toLocaleString()}</td>
                                                <td className="px-3 py-2 text-center text-gray-500">{item.ingredient?.unit || 'unit'}</td>
                                                <td className="px-3 py-2 text-center text-green-600">{formatPrice(item.cost_per_unit)}</td>
                                                <td className="px-3 py-2 text-right font-medium text-blue-600">{formatPrice(parseFloat(item.quantity) * parseFloat(item.cost_per_unit))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 border-t">
                                        <tr>
                                            <td colSpan="4" className="px-3 py-2 text-right font-semibold">Total:</td>
                                            <td className="px-3 py-2 text-right font-bold text-green-600">{formatPrice(selectedReceipt.total_amount)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        
                        <div className="flex justify-end pt-4">
                            <Button onClick={() => setShowReceiptDetails(false)} variant="secondary">Close</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Add Ingredient Modal */}
            <Modal isOpen={showAddIngredient} onClose={() => { setShowAddIngredient(false); setFormErrors({}); setCustomCategory(false); setNewIngredient({ name: '', unit: 'kg', category: '', pool: 'resto', min_stock: 0, initial_stock: 0, cost_per_unit: 0 }); setExistingIngredientId(null); }} title="Add Ingredient" subtitle="Create new ingredient or add stock to existing" size="md">
                {formErrors.submit && <div className="mb-4 p-2 bg-red-50 border rounded text-red-700 text-xs">{formErrors.submit}</div>}
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                        <IngredientNameValidator
                            value={newIngredient.name}
                            ingredients={ingredients}
                            onLoadExisting={loadExistingIngredientIntoForm}
                            onChange={(val) => setNewIngredient({...newIngredient, name: val})}
                        />
                        {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
                    </div>
                    <Select id="unit" label="Unit" value={newIngredient.unit} onChange={e => setNewIngredient({...newIngredient, unit: e.target.value})} options={UNIT_OPTIONS.map(u => ({ value: u, label: u }))} required />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                        {!customCategory ? (
                            <div className="flex gap-2">
                                <select id="category" name="category" className="flex-1 px-3 py-2 text-sm border rounded-lg bg-white" value={newIngredient.category} onChange={e => setNewIngredient({...newIngredient, category: e.target.value})}>
                                    <option value="">Select Category</option>
                                    {PREDEFINED_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                <button type="button" onClick={() => setCustomCategory(true)} className="px-3 py-2 bg-gray-100 rounded-lg text-xs hover:bg-gray-200">Custom</button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <input id="customCategory" name="customCategory" type="text" placeholder="Enter custom category" className="flex-1 px-3 py-2 text-sm border rounded-lg" value={newIngredient.category} onChange={e => setNewIngredient({...newIngredient, category: e.target.value})} />
                                <button type="button" onClick={() => { setCustomCategory(false); setNewIngredient({...newIngredient, category: ''}); }} className="px-3 py-2 bg-gray-100 rounded-lg text-xs hover:bg-gray-200">Back</button>
                            </div>
                        )}
                    </div>
                    <Select id="pool" label="Pool" value={newIngredient.pool} onChange={e => setNewIngredient({...newIngredient, pool: e.target.value})} options={[{ value: 'resto', label: 'Restaurant' }, { value: 'kitchen', label: 'Kitchen' }]} required />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                    <Input id="initial_stock" label="Quantity to Add" type="number" step="0.01" value={newIngredient.initial_stock} onChange={e => setNewIngredient({...newIngredient, initial_stock: parseFloat(e.target.value) || 0})} placeholder="Amount to add" />
                    <Input id="min_stock" label="Min Stock Alert" type="number" value={newIngredient.min_stock} onChange={e => setNewIngredient({...newIngredient, min_stock: parseInt(e.target.value) || 0})} placeholder="Minimum stock level" />
                    <Input id="cost_per_unit" label="Cost Per Unit (₱)" type="number" step="0.01" value={newIngredient.cost_per_unit} onChange={e => setNewIngredient({...newIngredient, cost_per_unit: parseFloat(e.target.value) || 0})} placeholder="Current price" />
                </div>
                
                <div className="flex gap-3 mt-6 pt-3 border-t">
                    <Button onClick={addOrUpdateIngredient} variant="primary" className="flex-1" loading={isSubmitting}>
                        {existingIngredientId ? 'Add Stock' : 'Create Ingredient'}
                    </Button>
                    <Button onClick={() => { setShowAddIngredient(false); setFormErrors({}); setCustomCategory(false); setNewIngredient({ name: '', unit: 'kg', category: '', pool: 'resto', min_stock: 0, initial_stock: 0, cost_per_unit: 0 }); setExistingIngredientId(null); }} variant="secondary" className="flex-1">Cancel</Button>
                </div>
            </Modal>

            {/* Edit Ingredient Modal */}
            <Modal isOpen={showEditIngredient} onClose={() => { setShowEditIngredient(false); setFormErrors({}); }} title="Edit Ingredient" subtitle="Update ingredient details" size="md">
                {formErrors.submit && <div className="mb-4 p-2 bg-red-50 border rounded text-red-700 text-xs">{formErrors.submit}</div>}
                
                <div className="bg-yellow-50 rounded-lg p-2 mb-4 text-xs text-yellow-700">
                    Note: Use Bulk Update or Stock Movements to change stock levels.
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <Input id="edit_name" label="Name" value={editIngredientData.name} onChange={e => setEditIngredientData({...editIngredientData, name: e.target.value})} required />
                    <Select id="edit_unit" label="Unit" value={editIngredientData.unit} onChange={e => setEditIngredientData({...editIngredientData, unit: e.target.value})} options={UNIT_OPTIONS.map(u => ({ value: u, label: u }))} required />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <Select 
                        id="edit_category"
                        label="Category" 
                        value={editIngredientData.category || ''} 
                        onChange={(e) => {
                            console.log('Category changed to:', e.target.value);
                            setEditIngredientData({...editIngredientData, category: e.target.value});
                        }} 
                        options={[{ value: '', label: '-- Select Category --' }, ...PREDEFINED_CATEGORIES.map(cat => ({ value: cat, label: cat }))]} 
                    />
                    <Select 
                        id="edit_pool"
                        label="Pool" 
                        value={editIngredientData.pool} 
                        onChange={e => setEditIngredientData({...editIngredientData, pool: e.target.value})} 
                        options={[{ value: 'resto', label: 'Restaurant' }, { value: 'kitchen', label: 'Kitchen' }]} 
                        required 
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <Input id="edit_min_stock" label="Min Stock" type="number" value={editIngredientData.min_stock} onChange={e => setEditIngredientData({...editIngredientData, min_stock: parseInt(e.target.value) || 0})} />
                    <Input id="edit_cost_per_unit" label="Cost Per Unit (₱)" type="number" step="0.01" value={editIngredientData.cost_per_unit} onChange={e => setEditIngredientData({...editIngredientData, cost_per_unit: parseFloat(e.target.value) || 0})} />
                </div>
                
                <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Current Stock (Read Only)</label>
                    <div className="px-3 py-2 bg-gray-100 border rounded-lg text-sm font-mono">
                        {Math.floor(editIngredientData.current_stock)} {editIngredientData.unit}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Use Bulk Update or Record Movement to change stock levels</p>
                </div>
                
                <div className="flex gap-3 mt-6">
                    <Button onClick={updateIngredient} variant="primary" className="flex-1" loading={isSubmitting}>Save Changes</Button>
                    <Button onClick={() => setShowEditIngredient(false)} variant="secondary" className="flex-1">Cancel</Button>
                </div>
            </Modal>

            {/* Bulk Update Modal */}
            <Modal isOpen={showBulkUpdate} onClose={() => { setShowBulkUpdate(false); setFormErrors({}); }} title="Bulk Stock Update" subtitle="Add stock for multiple ingredients (groceries bulk purchase)" size="xl">
                {formErrors.submit && <div className="mb-4 p-2 bg-red-50 border rounded text-red-700 text-xs">{formErrors.submit}</div>}
                
                <div className="bg-blue-50 rounded-lg p-3 mb-4">
                    <h4 className="text-sm font-medium text-blue-800 mb-3">Receipt Information</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <Input id="receipt_number" label="Receipt Number" value={bulkData.receipt_number} onChange={e => setBulkData({...bulkData, receipt_number: e.target.value})} placeholder="Leave empty to auto-generate" />
                        <Input id="supplier_name" label="Supplier Name" value={bulkData.supplier_name} onChange={e => setBulkData({...bulkData, supplier_name: e.target.value})} placeholder="e.g., MegaMart, Puregold" />
                        <Input id="receipt_date" label="Receipt Date" type="date" value={bulkData.receipt_date} onChange={e => setBulkData({...bulkData, receipt_date: e.target.value})} />
                        <Select id="bulk_pool" label="Pool" value={bulkData.pool} onChange={e => setBulkData({...bulkData, pool: e.target.value})} options={[{ value: 'resto', label: 'Restaurant' }, { value: 'kitchen', label: 'Kitchen' }]} />
                    </div>
                    <Textarea id="bulk_notes" label="Notes" value={bulkData.notes} onChange={e => setBulkData({...bulkData, notes: e.target.value})} rows={2} placeholder="e.g., Weekly grocery run" />
                </div>
                
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-medium text-gray-700">Items Purchased</label>
                        <div className="flex gap-2">
                            {bulkData.items.length > 1 && (
                                <button onClick={() => setBulkData({...bulkData, items: [{ ingredient_id: '', quantity: '', cost_per_unit: '' }]})} className="text-red-600 text-xs">Clear All</button>
                            )}
                            <button onClick={addBulkItem} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Add Item</button>
                        </div>
                    </div>
                    
                    {formErrors.items && <p className="mb-2 text-xs text-red-500">{formErrors.items}</p>}
                    
                    <div className="space-y-3 max-h-80 overflow-auto">
                        {bulkData.items.map((item, index) => {
                            const selectedIngredient = ingredients.find(i => i.id == item.ingredient_id);
                            const quantity = parseFloat(item.quantity) || 0;
                            const costPerUnit = parseFloat(item.cost_per_unit) || 0;
                            return (
                                <div key={index} className="bg-white border rounded-lg p-3 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Item #{index + 1}</span>
                                        {bulkData.items.length > 1 && (
                                            <button onClick={() => removeBulkItem(index)} className="text-red-600 text-xs hover:text-red-700">Remove</button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-12 gap-2">
                                        <div className="col-span-5">
                                            <label className="block text-xs font-medium text-gray-600 mb-0.5">Ingredient</label>
                                            <IngredientSearchInput value={item.ingredient_id} ingredients={ingredients} onSelect={(id) => updateBulkItem(index, 'ingredient_id', id)} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-600 mb-0.5">Quantity</label>
                                            <input type="number" step="0.01" placeholder="0" className="w-full px-2 py-1.5 text-sm border rounded-lg" value={item.quantity} onChange={e => updateBulkItem(index, 'quantity', e.target.value)} />
                                            {selectedIngredient && <div className="text-xs text-gray-400 mt-0.5">{selectedIngredient.unit}</div>}
                                        </div>
                                        <div className="col-span-3">
                                            <label className="block text-xs font-medium text-gray-600 mb-0.5">Cost Per Unit (₱)</label>
                                            <input type="number" step="0.01" placeholder="0.00" className="w-full px-2 py-1.5 text-sm border rounded-lg" value={item.cost_per_unit} onChange={e => updateBulkItem(index, 'cost_per_unit', e.target.value)} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-600 mb-0.5">Total</label>
                                            <div className="px-2 py-1.5 bg-green-50 border rounded-lg text-right">
                                                <span className="text-sm font-medium text-green-700">{formatPrice(quantity * costPerUnit)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                <div className="flex gap-3 mt-4 pt-2 border-t">
                    <Button onClick={submitBulkUpdate} variant="success" className="flex-1" loading={isSubmitting}>Confirm Bulk Stock Update</Button>
                    <Button onClick={() => { setShowBulkUpdate(false); setFormErrors({}); setBulkData({ receipt_number: '', supplier_name: '', receipt_date: new Date().toISOString().split('T')[0], notes: '', pool: 'resto', items: [{ ingredient_id: '', quantity: '', cost_per_unit: '' }] }); }} variant="secondary" className="flex-1">Cancel</Button>
                </div>
            </Modal>

            {/* Recipe Modal */}
            <Modal isOpen={showRecipeModal} onClose={() => { setShowRecipeModal(false); setFormErrors({}); }} title={`Recipe: ${selectedItem?.name}`} subtitle="Define ingredients needed for this item" size="lg">
                {formErrors.submit && <div className="mb-4 p-2 bg-red-50 border rounded text-red-700 text-xs">{formErrors.submit}</div>}
                
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-medium text-gray-700">Ingredients</label>
                        <button onClick={addRecipeIngredient} className="text-blue-600 text-xs hover:text-blue-700">Add Ingredient</button>
                    </div>
                    
                    {formErrors.ingredients && <p className="mb-2 text-xs text-red-500">{formErrors.ingredients}</p>}
                    
                    <div className="space-y-3 max-h-96 overflow-auto">
                        {recipeData.ingredients.map((ing, index) => (
                            <div key={index} className="bg-gray-50 rounded-lg p-2 border">
                                <div className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-6">
                                        <Select id={`recipe_ingredient_${index}`} value={ing.id} onChange={e => updateRecipeIngredient(index, 'id', e.target.value)} options={[{ value: '', label: 'Select Ingredient' }, ...ingredients.map(i => ({ value: i.id, label: `${i.name} (${i.unit})` }))]} />
                                    </div>
                                    <div className="col-span-4">
                                        <input type="number" step="0.001" placeholder="Quantity" className="w-full px-2 py-1.5 border rounded text-sm" value={ing.quantity_required} onChange={e => updateRecipeIngredient(index, 'quantity_required', parseFloat(e.target.value) || 0)} />
                                        <div className="text-xs text-gray-400 mt-0.5">{ing.unit || 'unit'}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <button onClick={() => removeRecipeIngredient(index)} className="w-full bg-red-600 text-white px-2 py-1.5 rounded text-xs hover:bg-red-700">Remove</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {recipeData.ingredients.length === 0 && (
                            <div className="text-center py-8 text-gray-400 text-xs">No ingredients added yet.</div>
                        )}
                    </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                    <Button onClick={saveRecipe} variant="primary" className="flex-1" loading={isSubmitting}>Save Recipe</Button>
                    <Button onClick={() => { setShowRecipeModal(false); setFormErrors({}); }} variant="secondary" className="flex-1">Cancel</Button>
                </div>
            </Modal>

            {/* Stock Movement Modal */}
            <Modal isOpen={showStockMovement} onClose={() => { setShowStockMovement(false); setFormErrors({}); }} title="Record Stock Movement" subtitle="Log returns, losses, transfers, wastage, or stock takes" size="lg">
                {formErrors.submit && <div className="mb-3 p-2 bg-red-50 border rounded text-red-700 text-xs">{formErrors.submit}</div>}
                
                <div className="flex flex-wrap gap-2 mb-6 pb-3 border-b">
                    {MOVEMENT_TYPES.map(type => (
                        <button
                            key={type}
                            onClick={() => setSelectedMovementType(type)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${selectedMovementType === type ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            {type.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {selectedMovementType === 'return' && (
                    <>
                        <Select id="return_ingredient" label="Ingredient" value={stockReturnForm.ingredient_id} onChange={e => setStockReturnForm({...stockReturnForm, ingredient_id: e.target.value})} options={[{value:'',label:'Select ingredient'}, ...ingredients.map(i => ({value:i.id, label:`${i.name} (${i.unit}) — stock: ${Math.floor(i.current_stock)}`}))]} required />
                        <Select id="return_pool" label="Pool" value={stockReturnForm.pool} onChange={e => setStockReturnForm({...stockReturnForm, pool: e.target.value})} options={[{value:'resto',label:'Restaurant'},{value:'kitchen',label:'Kitchen'}]} />
                        <Input id="return_quantity" label="Quantity to Return" type="number" step="0.01" value={stockReturnForm.quantity} onChange={e => setStockReturnForm({...stockReturnForm, quantity: e.target.value})} required />
                        <Input id="return_reason" label="Reason" value={stockReturnForm.reason} onChange={e => setStockReturnForm({...stockReturnForm, reason: e.target.value})} placeholder="e.g., Damaged goods, Over-ordered" />
                        <Textarea id="return_notes" label="Notes" value={stockReturnForm.notes} onChange={e => setStockReturnForm({...stockReturnForm, notes: e.target.value})} rows={2} />
                        <div className="flex gap-3 mt-4">
                            <Button onClick={() => submitStockMovement('return', stockReturnForm)} variant="primary" className="flex-1" loading={isSubmitting}>Confirm Return</Button>
                            <Button onClick={() => setShowStockMovement(false)} variant="secondary" className="flex-1">Cancel</Button>
                        </div>
                    </>
                )}

                {selectedMovementType === 'loss' && (
                    <>
                        <Select id="loss_ingredient" label="Ingredient" value={stockLossForm.ingredient_id} onChange={e => setStockLossForm({...stockLossForm, ingredient_id: e.target.value})} options={[{value:'',label:'Select ingredient'}, ...ingredients.map(i => ({value:i.id, label:`${i.name} (${i.unit}) — stock: ${Math.floor(i.current_stock)}`}))]} required />
                        <Select id="loss_pool" label="Pool" value={stockLossForm.pool} onChange={e => setStockLossForm({...stockLossForm, pool: e.target.value})} options={[{value:'resto',label:'Restaurant'},{value:'kitchen',label:'Kitchen'}]} />
                        <Input id="loss_quantity" label="Quantity Lost" type="number" step="0.01" value={stockLossForm.quantity} onChange={e => setStockLossForm({...stockLossForm, quantity: e.target.value})} required />
                        <Select id="loss_type" label="Loss Type" value={stockLossForm.loss_type} onChange={e => setStockLossForm({...stockLossForm, loss_type: e.target.value})} options={[{value:'spoilage',label:'Spoilage'},{value:'breakage',label:'Breakage'},{value:'theft',label:'Theft'},{value:'other',label:'Other'}]} />
                        <Textarea id="loss_notes" label="Notes" value={stockLossForm.notes} onChange={e => setStockLossForm({...stockLossForm, notes: e.target.value})} rows={2} />
                        <div className="flex gap-3 mt-4">
                            <Button onClick={() => submitStockMovement('loss', stockLossForm)} variant="danger" className="flex-1" loading={isSubmitting}>Record Loss</Button>
                            <Button onClick={() => setShowStockMovement(false)} variant="secondary" className="flex-1">Cancel</Button>
                        </div>
                    </>
                )}

                {selectedMovementType === 'transfer' && (
                    <>
                        <Select id="transfer_ingredient" label="Ingredient" value={stockTransferForm.ingredient_id} onChange={e => setStockTransferForm({...stockTransferForm, ingredient_id: e.target.value})} options={[{value:'',label:'Select ingredient'}, ...ingredients.map(i => ({value:i.id, label:`${i.name} (${i.unit}) — ${i.pool}: ${Math.floor(i.current_stock)}`}))]} required />
                        <div className="grid grid-cols-2 gap-3">
                            <Select id="transfer_from_pool" label="From Pool" value={stockTransferForm.from_pool} onChange={e => setStockTransferForm({...stockTransferForm, from_pool: e.target.value})} options={[{value:'resto',label:'Restaurant'},{value:'kitchen',label:'Kitchen'}]} />
                            <Select id="transfer_to_pool" label="To Pool" value={stockTransferForm.to_pool} onChange={e => setStockTransferForm({...stockTransferForm, to_pool: e.target.value})} options={[{value:'resto',label:'Restaurant'},{value:'kitchen',label:'Kitchen'}]} />
                        </div>
                        <Input id="transfer_quantity" label="Quantity to Transfer" type="number" step="0.01" value={stockTransferForm.quantity} onChange={e => setStockTransferForm({...stockTransferForm, quantity: e.target.value})} required />
                        <Textarea id="transfer_notes" label="Notes" value={stockTransferForm.notes} onChange={e => setStockTransferForm({...stockTransferForm, notes: e.target.value})} rows={2} />
                        <div className="flex gap-3 mt-4">
                            <Button onClick={() => submitStockMovement('transfer', stockTransferForm)} variant="primary" className="flex-1" loading={isSubmitting}>Confirm Transfer</Button>
                            <Button onClick={() => setShowStockMovement(false)} variant="secondary" className="flex-1">Cancel</Button>
                        </div>
                    </>
                )}

                {selectedMovementType === 'wastage' && (
                    <>
                        <Select id="wastage_ingredient" label="Ingredient" value={wastageForm.ingredient_id} onChange={e => setWastageForm({...wastageForm, ingredient_id: e.target.value})} options={[{value:'',label:'Select ingredient'}, ...ingredients.map(i => ({value:i.id, label:`${i.name} (${i.unit}) — stock: ${Math.floor(i.current_stock)}`}))]} required />
                        <Select id="wastage_pool" label="Pool" value={wastageForm.pool} onChange={e => setWastageForm({...wastageForm, pool: e.target.value})} options={[{value:'resto',label:'Restaurant'},{value:'kitchen',label:'Kitchen'}]} />
                        <Input id="wastage_quantity" label="Quantity Wasted" type="number" step="0.01" value={wastageForm.quantity} onChange={e => setWastageForm({...wastageForm, quantity: e.target.value})} required />
                        <Input id="wastage_reason" label="Wastage Reason" value={wastageForm.wastage_reason} onChange={e => setWastageForm({...wastageForm, wastage_reason: e.target.value})} placeholder="e.g., Expired, Over-cooked, Dropped" />
                        <Textarea id="wastage_notes" label="Notes" value={wastageForm.notes} onChange={e => setWastageForm({...wastageForm, notes: e.target.value})} rows={2} />
                        <div className="flex gap-3 mt-4">
                            <Button onClick={() => submitStockMovement('wastage', wastageForm)} variant="danger" className="flex-1" loading={isSubmitting}>Record Wastage</Button>
                            <Button onClick={() => setShowStockMovement(false)} variant="secondary" className="flex-1">Cancel</Button>
                        </div>
                    </>
                )}

                {selectedMovementType === 'stock_take' && (
                    <>
                        <Input id="stock_take_label" label="Batch Label (optional)" value={stockTakeLabel} onChange={e => setStockTakeLabel(e.target.value)} placeholder={`Stock Take ${new Date().toLocaleDateString()}`} />
                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-sm font-medium text-gray-700">Items to Count</label>
                                <button onClick={addStockTakeItem} className="text-blue-600 text-xs hover:text-blue-700">Add Row</button>
                            </div>
                            <div className="space-y-2 max-h-80 overflow-auto">
                                {stockTakeItems.map((item, idx) => {
                                    const ing = ingredients.find(i => i.id == item.ingredient_id);
                                    return (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded-lg">
                                            <div className="col-span-5">
                                                <select value={item.ingredient_id} onChange={e => updateStockTakeItem(idx, 'ingredient_id', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm bg-white">
                                                    <option value="">Select ingredient</option>
                                                    {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <select value={item.pool} onChange={e => updateStockTakeItem(idx, 'pool', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm bg-white">
                                                    <option value="resto">Restaurant</option>
                                                    <option value="kitchen">Kitchen</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2 text-center text-xs text-gray-400">
                                                System: <span className="font-semibold">{ing ? Math.floor(ing.current_stock) : '—'}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <input type="number" step="0.01" placeholder="Counted" value={item.counted_quantity} onChange={e => updateStockTakeItem(idx, 'counted_quantity', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm text-center" />
                                            </div>
                                            <div className="col-span-1 text-center">
                                                {stockTakeItems.length > 1 && (
                                                    <button onClick={() => removeStockTakeItem(idx)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <Button onClick={submitStockTake} variant="success" className="flex-1" loading={isSubmitting}>Submit Stock Take</Button>
                            <Button onClick={() => setShowStockMovement(false)} variant="secondary" className="flex-1">Cancel</Button>
                        </div>
                    </>
                )}
            </Modal>

            {/* Stock Check Modal */}
            <Modal isOpen={showStockCheck} onClose={() => { setCheckingItem(null); setShowStockCheck(false); setCheckResult(null); setCheckQuantity(1); }} title="Stock Check" subtitle="Check if you can make a certain quantity" size="md">
                <Select
                    id="stock_check_item"
                    label="Menu Item to Check"
                    value={checkingItem?.id || ''}
                    onChange={(e) => {
                        const item = items.find(i => i.id == e.target.value);
                        setCheckingItem(item);
                        setCheckResult(null);
                    }}
                    options={[{ value: '', label: 'Select menu item' }, ...items.map(i => ({ value: i.id, label: i.name }))]}
                />
                
                {checkingItem && (
                    <>
                        <Input
                            id="stock_check_quantity"
                            label={`Quantity of ${checkingItem.name} to make`}
                            type="number"
                            step="0.01"
                            value={checkQuantity}
                            onChange={(e) => setCheckQuantity(parseFloat(e.target.value) || 1)}
                        />
                        <Button onClick={checkAvailability} variant="primary" className="w-full mb-4">Check Availability</Button>
                        
                        {checkResult && (
                            checkResult.available ? (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-2xl">✓</span>
                                        <span className="font-bold text-green-800">Available</span>
                                    </div>
                                    <div className="space-y-2 text-green-700">
                                        <p className="text-sm">Can make <strong>{checkQuantity}</strong> {checkingItem.name}</p>
                                        <p className="text-sm">Total cost: <strong className="text-lg">{formatPrice(checkResult.total_cost)}</strong></p>
                                        {checkResult.max_possible > 0 && (
                                            <p className="text-sm">Max possible: <strong>{checkResult.max_possible}</strong></p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-2xl">✗</span>
                                        <span className="font-bold text-red-800">Not Available</span>
                                    </div>
                                    <div className="text-red-700">
                                        <p className="mb-2 text-sm font-semibold">Missing ingredients:</p>
                                        <ul className="space-y-1 text-xs">
                                            {checkResult.insufficient_ingredients?.map(ing => (
                                                <li key={ing.id} className="flex justify-between">
                                                    <span>{ing.name}:</span>
                                                    <span className="font-mono">Need {parseFloat(ing.required).toFixed(2)} {ing.unit}, have {parseFloat(ing.available).toFixed(2)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )
                        )}
                    </>
                )}
                
                <div className="flex gap-3 mt-4 pt-3">
                    <Button onClick={() => { setCheckingItem(null); setShowStockCheck(false); setCheckResult(null); }} variant="secondary" className="flex-1">Close</Button>
                </div>
            </Modal>

            <style>{`
                @keyframes slide-in {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-slide-in { animation: slide-in 0.3s ease-out; }
            `}</style>
        </AdminLayout>
    );
}