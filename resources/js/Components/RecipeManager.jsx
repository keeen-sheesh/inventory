// resources/js/Pages/Admin/Inventory/RecipeManager.jsx

import React, { useState, useEffect } from 'react';
import { 
    ChefHat, 
    Package, 
    Save, 
    X, 
    AlertTriangle,
    Plus,
    Trash2,
    Search,
    Loader2,
    DollarSign,
    TrendingUp,
    Scale
} from 'lucide-react';

export default function RecipeManager({ 
    item, 
    ingredients: availableIngredients,
    onSave,
    onClose 
}) {
    const [recipeIngredients, setRecipeIngredients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIngredient, setSelectedIngredient] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [unit, setUnit] = useState('');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [totalCost, setTotalCost] = useState(0);

    // Unit conversion helpers
    const dryUnits = ['kg', 'g'];
    const wetUnits = ['L', 'mL'];
    
    const isDryUnit = (unit) => dryUnits.includes(unit?.toLowerCase());
    const isWetUnit = (unit) => wetUnits.includes(unit?.toLowerCase());
    
    const isCompatibleUnit = (ingredient, unit) => {
        if (!ingredient?.is_dry) return true; // If no type specified, allow any
        const isDry = ingredient.is_dry;
        const unitLower = unit?.toLowerCase();
        
        if (isDry) {
            return isDryUnit(unit) || !isWetUnit(unit); // Dry can use dry units or non-volume units
        } else {
            return isWetUnit(unit) || !isDryUnit(unit); // Wet can use wet units or non-weight units
        }
    };

    const convertToBaseUnit = (quantity, fromUnit, toUnit) => {
        const from = fromUnit?.toLowerCase();
        const to = toUnit?.toLowerCase();
        
        // g to kg
        if (from === 'g' && to === 'kg') return quantity / 1000;
        // kg to g
        if (from === 'kg' && to === 'g') return quantity * 1000;
        // mL to L
        if (from === 'ml' && to === 'l') return quantity / 1000;
        // L to mL
        if (from === 'l' && to === 'ml') return quantity * 1000;
        
        // Same unit or incompatible - no conversion
        return quantity;
    };

    const getCompatibleUnits = (ingredient) => {
        if (!ingredient?.is_dry) {
            // Default to showing all units if type not specified
            return [
                { value: 'kg', label: 'kg (kilogram)' },
                { value: 'g', label: 'g (gram)' },
                { value: 'L', label: 'L (liter)' },
                { value: 'mL', label: 'mL (milliliter)' },
                { value: 'piece', label: 'piece' },
                { value: 'pack', label: 'pack' },
                { value: 'box', label: 'box' }
            ];
        }
        
        if (ingredient.is_dry) {
            return [
                { value: 'kg', label: 'kg (kilogram)' },
                { value: 'g', label: 'g (gram)' },
                { value: 'piece', label: 'piece' },
                { value: 'pack', label: 'pack' },
                { value: 'box', label: 'box' }
            ];
        } else {
            return [
                { value: 'L', label: 'L (liter)' },
                { value: 'mL', label: 'mL (milliliter)' },
                { value: 'piece', label: 'piece' },
                { value: 'pack', label: 'pack' },
                { value: 'box', label: 'box' }
            ];
        }
    };


    // Load existing recipe if editing
    useEffect(() => {
        if (item && item.ingredients) {
            const formatted = item.ingredients.map(ing => ({
                id: ing.id,
                name: ing.name,
                quantity_required: ing.pivot?.quantity_required || ing.pivot?.quantity || 0,
                unit: ing.pivot?.unit || ing.unit,
                notes: ing.pivot?.notes || '',
                cost_per_unit: ing.cost_per_unit || 0,
                current_stock: ing.quantity || 0
            }));
            setRecipeIngredients(formatted);
        }
    }, [item]);

    // Calculate total cost whenever ingredients change
    useEffect(() => {
        const cost = recipeIngredients.reduce((sum, ing) => {
            return sum + ((ing.cost_per_unit || 0) * (ing.quantity_required || 0));
        }, 0);
        setTotalCost(cost);
    }, [recipeIngredients]);

    // Filter available ingredients (exclude already selected ones)
    const filteredIngredients = availableIngredients.filter(ing => 
        !recipeIngredients.some(ri => ri.id === ing.id) &&
        (ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         ing.unit.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Handle ingredient selection from search
    const handleSelectIngredient = (ing) => {
        setSelectedIngredient(ing);
        setUnit(ing.unit); // Auto-fill with ingredient's default unit
        setQuantity('1'); // Set default quantity to 1
        setNotes(''); // Reset notes
        setSearchTerm(''); // Clear search
        setErrors({}); // Clear errors
    };


    const handleAddIngredient = () => {
        if (!selectedIngredient) {
            setErrors({ ingredient: 'Please select an ingredient' });
            return;
        }

        if (!quantity || parseFloat(quantity) <= 0) {
            setErrors({ quantity: 'Valid quantity is required' });
            return;
        }

        // Validate unit compatibility
        const inputUnit = unit || selectedIngredient.unit;
        if (!isCompatibleUnit(selectedIngredient, inputUnit)) {
            const type = selectedIngredient.is_dry ? 'dry' : 'wet';
            const allowedUnits = selectedIngredient.is_dry ? 'kg, g' : 'L, mL';
            setErrors({ unit: `Invalid unit for ${type} ingredient. Use: ${allowedUnits}` });
            return;
        }

        // Convert quantity to base unit if needed
        const baseUnit = selectedIngredient.unit;
        const inputQuantity = parseFloat(quantity);
        const convertedQuantity = convertToBaseUnit(inputQuantity, inputUnit, baseUnit);

        const newIngredient = {
            id: selectedIngredient.id,
            name: selectedIngredient.name,
            quantity_required: convertedQuantity,
            unit: baseUnit, // Store in base unit
            original_unit: inputUnit, // Remember what user entered
            original_quantity: inputQuantity,
            notes: notes,
            cost_per_unit: selectedIngredient.cost_per_unit || 0,
            current_stock: selectedIngredient.quantity || 0,
            is_dry: selectedIngredient.is_dry
        };

        setRecipeIngredients([...recipeIngredients, newIngredient]);
        
        // Reset form
        setSelectedIngredient(null);
        setQuantity('');
        setUnit('');
        setNotes('');
        setSearchTerm('');
        setErrors({});
    };


    const handleRemoveIngredient = (index) => {
        setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
    };

    const handleUpdateQuantity = (index, newQuantity) => {
        const updated = [...recipeIngredients];
        updated[index].quantity_required = parseFloat(newQuantity) || 0;
        setRecipeIngredients(updated);
    };

    const handleSave = async () => {
        if (recipeIngredients.length === 0) {
            if (!window.confirm('No ingredients added. Save empty recipe?')) {
                return;
            }
        }

        // Validate that all ingredients have quantities > 0
        const invalidIngredients = recipeIngredients.filter(ing => ing.quantity_required <= 0);
        if (invalidIngredients.length > 0) {
            alert('Please set valid quantities for all ingredients');
            return;
        }

        setIsLoading(true);
        try {
            await onSave({
                ingredients: recipeIngredients.map(ing => ({
                    id: ing.id,
                    quantity_required: ing.quantity_required,
                    unit: ing.unit,
                    notes: ing.notes
                }))
            });
            onClose(); // Close modal after successful save
        } catch (error) {
            console.error('Error saving recipe:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Check for low stock ingredients
    const getStockStatus = (ingredient) => {
        if (!ingredient.current_stock) return 'unknown';
        if (ingredient.current_stock <= 0) return 'out';
        if (ingredient.current_stock < ingredient.quantity_required) return 'insufficient';
        if (ingredient.current_stock < ingredient.quantity_required * 3) return 'low';
        return 'good';
    };

    const getStockStatusColor = (status) => {
        switch(status) {
            case 'out': return 'bg-red-100 text-red-700';
            case 'insufficient': return 'bg-red-100 text-red-700';
            case 'low': return 'bg-amber-100 text-amber-700';
            case 'good': return 'bg-green-100 text-green-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStockStatusText = (status) => {
        switch(status) {
            case 'out': return 'Out of Stock';
            case 'insufficient': return 'Insufficient Stock';
            case 'low': return 'Low Stock';
            case 'good': return 'Stock OK';
            default: return 'Unknown';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white z-10 flex justify-between items-center px-6 py-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Recipe: {item?.name}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Define ingredients and quantities
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6">
                    {/* Cost Summary - Matches your screenshot */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-600">Recipe Cost:</span>
                            <span className="text-xl font-bold text-gray-900">
                                ₱{totalCost.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Selling Price:</span>
                            <span className="text-xl font-bold text-emerald-600">
                                ₱{Number(item?.price || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Add Ingredient Section - Matches your screenshot */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            Add Ingredient
                        </h3>
                        
                        {/* Search Input */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search ingredients to add..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>

                        {/* Search Results */}
                        {searchTerm && (
                            <div className="mb-4 max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                                {filteredIngredients.length > 0 ? (
                                    filteredIngredients.map(ing => (
                                        <button
                                            key={ing.id}
                                            onClick={() => handleSelectIngredient(ing)}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex justify-between items-center"
                                        >
                                            <div>
                                                <div className="font-medium text-gray-900">{ing.name}</div>
                                                <div className="text-xs text-gray-500">
                                                    Unit: {ing.unit} | Cost: ₱{ing.cost_per_unit}/{ing.unit}
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Stock: {ing.quantity} {ing.unit}
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-gray-500 text-center">
                                        No ingredients found
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Selected Ingredient Form - Matches your screenshot */}
                        {selectedIngredient && (
                            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                                <h4 className="font-medium text-gray-900 mb-3">
                                    Selected: {selectedIngredient.name}
                                </h4>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Quantity Required *
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                step="0.001"
                                                min="0.001"
                                                value={quantity}
                                                onChange={(e) => setQuantity(e.target.value)}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                                placeholder={`0.00`}
                                            />
                                            <span className="text-gray-600 w-20">
                                                {unit || selectedIngredient.unit}
                                            </span>
                                        </div>
                                        {errors.quantity && (
                                            <p className="mt-1 text-xs text-red-600">{errors.quantity}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Unit *
                                        </label>
                                        <select
                                            value={unit}
                                            onChange={(e) => setUnit(e.target.value)}
                                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                                                errors.unit ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                        >
                                            {getCompatibleUnits(selectedIngredient).map(option => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.unit && (
                                            <p className="mt-1 text-xs text-red-600">{errors.unit}</p>
                                        )}
                                        <p className="mt-1 text-xs text-gray-500">
                                            Base unit: {selectedIngredient.unit} 
                                            {selectedIngredient.is_dry !== undefined && (
                                                <span className="ml-1">
                                                    ({selectedIngredient.is_dry ? 'Dry' : 'Wet'} ingredient)
                                                </span>
                                            )}
                                        </p>
                                    </div>


                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Notes (optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                            placeholder="e.g., Use whole eggs, slice thinly..."
                                        />
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleAddIngredient}
                                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add to Recipe
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {errors.ingredient && (
                            <p className="mt-2 text-sm text-red-600">{errors.ingredient}</p>
                        )}
                    </div>

                    {/* Recipe Ingredients List - Matches your screenshot */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            Recipe Ingredients ({recipeIngredients.length})
                        </h3>

                        {recipeIngredients.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                                <p className="text-gray-500">No ingredients added yet</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    Search and add ingredients above to define this item's recipe
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recipeIngredients.map((ing, index) => {
                                    const stockStatus = getStockStatus(ing);
                                    const stockStatusColor = getStockStatusColor(stockStatus);
                                    const stockStatusText = getStockStatusText(stockStatus);
                                    
                                    return (
                                        <div 
                                            key={index}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-medium text-gray-900">{ing.name}</h4>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockStatusColor}`}>
                                                        {stockStatusText}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm">
                                                    <span className="text-gray-600">
                                                        Current Stock: {ing.current_stock} {ing.unit}
                                                    </span>
                                                    <span className="text-gray-600">
                                                        Cost: ₱{ing.cost_per_unit}/{ing.unit}
                                                    </span>
                                                </div>
                                                {ing.notes && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Note: {ing.notes}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            step="0.001"
                                                            min="0"
                                                            value={ing.quantity_required}
                                                            onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                                                            className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500"
                                                        />
                                                        <span className="text-gray-600 w-12 text-sm">{ing.unit}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Subtotal: ₱{(ing.cost_per_unit * ing.quantity_required).toFixed(2)}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveIngredient(index)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer - Matches your screenshot */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || recipeIngredients.length === 0}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                OK
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
