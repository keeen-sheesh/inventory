// resources/js/Pages/Admin/FoodItems/Form.jsx

import React, { useState, useRef, useEffect } from 'react';
import {
    Save, X, Upload, Image as ImageIcon, Package, Plus, Trash2,
    Search, ChefHat, Loader2, ArrowRight, AlertTriangle, Info,
    TrendingUp, TrendingDown
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePortionAndNotes(rawNotes) {
    const text = String(rawNotes || '');
    const match = text.match(/^\[portion:(solo|whole|both)\]\s*/i);
    if (!match) return { portion: 'both', notes: text };
    return {
        portion: match[1].toLowerCase(),
        notes: text.replace(/^\[portion:(solo|whole|both)\]\s*/i, ''),
    };
}

function buildNotesWithPortion(notes, portion) {
    const p = ['solo', 'whole', 'both'].includes(portion) ? portion : 'both';
    const n = String(notes || '').trim();
    const prefix = `[portion:${p}]`;
    return n ? `${prefix} ${n}` : prefix;
}

const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    return `/storage/${imagePath.replace(/^storage\//, '')}`;
};

// ─── Unit conversion ──────────────────────────────────────────────────────────

function normalizeUnit(u) {
    const s = String(u || '').toLowerCase().trim();
    const map = {
        gram: 'g', grams: 'g', gm: 'g', gms: 'g',
        kilogram: 'kg', kilograms: 'kg', kgs: 'kg',
        liter: 'l', litre: 'l', liters: 'l', litres: 'l', ltr: 'l',
        milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml',
        pcs: 'piece', pc: 'piece', pieces: 'piece',
        boxes: 'box', packs: 'pack',
    };
    return map[s] ?? s;
}

function getCompatibleUnits(stockUnit, piecesPerBox) {
    const su = normalizeUnit(stockUnit);
    if (['g',  'kg'].includes(su)) return [{ v: 'g',  label: 'g — gram' }, { v: 'kg', label: 'kg — kilogram' }];
    if (['ml', 'l' ].includes(su)) return [{ v: 'ml', label: 'ml — milliliter' }, { v: 'l', label: 'l — liter' }];
    if (['piece','box','pack'].includes(su)) {
        if (piecesPerBox > 0) {
            return [{ v: 'piece', label: 'piece' }, { v: 'box', label: 'box' }, { v: 'pack', label: 'pack' }];
        }
        return [{ v: su, label: su }];
    }
    return [
        { v: 'g', label: 'g' }, { v: 'kg', label: 'kg' },
        { v: 'ml', label: 'ml' }, { v: 'l', label: 'l' },
        { v: 'piece', label: 'piece' }, { v: 'box', label: 'box' }, { v: 'pack', label: 'pack' },
    ];
}

function calcConversion(qty, recipeUnit, stockUnit, piecesPerBox) {
    const from = normalizeUnit(recipeUnit);
    const to   = normalizeUnit(stockUnit);
    const q    = parseFloat(qty) || 0;

    if (!from || !to || q <= 0) return { ok: false, deducted: null, label: '', type: 'same' };

    let deducted = null;
    if (from === to)                                                          deducted = q;
    else if (from === 'g'  && to === 'kg')                                    deducted = q / 1000;
    else if (from === 'kg' && to === 'g')                                     deducted = q * 1000;
    else if (from === 'ml' && to === 'l')                                     deducted = q / 1000;
    else if (from === 'l'  && to === 'ml')                                    deducted = q * 1000;
    else if (from === 'piece' && (to === 'box' || to === 'pack') && piecesPerBox > 0)
        deducted = q / piecesPerBox;
    else if ((from === 'box' || from === 'pack') && to === 'piece' && piecesPerBox > 0)
        deducted = q * piecesPerBox;

    if (deducted === null) {
        const isCountFamily = ['piece','box','pack'].includes(from) && ['piece','box','pack'].includes(to);
        if (isCountFamily) {
            return { ok: false, deducted: null, label: `Set "pieces per box" on the ingredient to convert ${from} → ${to}`, type: 'error' };
        }
        return { ok: false, deducted: null, label: `Cannot convert ${from} → ${to} (incompatible units)`, type: 'error' };
    }

    const pretty = parseFloat(deducted.toFixed(6)).toString();
    const label  = from === to
        ? `Deducts ${pretty} ${to} per serving`
        : `${q} ${from} → deducts ${pretty} ${to} per serving`;

    return { ok: true, deducted, label, type: from === to ? 'same' : 'convert' };
}

// ─── Size / Temperature constants ────────────────────────────────────────────

// The valid size+temperature matrix for drinks:
//   Tall   → Hot only
//   Grande → Hot + Iced
//   Venti  → Iced only
const DRINK_SIZES = [
    { id: 1, name: 'Tall',   display: 'Tall (12oz)',  temps: ['hot'] },
    { id: 2, name: 'Grande', display: 'Grande (16oz)', temps: ['hot', 'iced'] },
    { id: 3, name: 'Venti',  display: 'Venti (20oz)', temps: ['iced'] },
];

const TEMP_LABELS = { hot: '🔥 Hot', iced: '🧊 Iced' };

// Flat list of all valid combos
const ALL_VARIANTS = DRINK_SIZES.flatMap(s =>
    s.temps.map(t => ({ size_id: s.id, size_name: s.name, display: s.display, temperature: t, label: `${s.name} ${t === 'hot' ? 'Hot' : 'Iced'}` }))
);

function emptyVariantPrices() {
    return ALL_VARIANTS.reduce((acc, v) => {
        acc[`${v.size_name}:${v.temperature}`] = '';
        return acc;
    }, {});
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FoodItemForm({
    item = null,
    categories = [],
    ingredients: availableIngredients = [],
    sizes = [],          // optional: passed from Foods.jsx if available
    onSave,
    onClose,
}) {
    const [formData, setFormData] = useState({
        name:                item?.name || '',
        description:         item?.description || '',
        pricing_type:        item?.pricing_type || 'single',
        has_sizes:           item?.has_sizes ?? false,
        // Flat map of "SizeName:temperature" → price string
        // e.g. { 'Tall:hot': '120', 'Grande:hot': '135', 'Grande:iced': '140', 'Venti:iced': '155' }
        variant_prices: (() => {
            const base = emptyVariantPrices();
            if (item?.size_variants) {
                for (const sg of item.size_variants) {
                    for (const v of sg.variants) {
                        const key = `${sg.size_name}:${v.temperature}`;
                        if (key in base) base[key] = String(v.price);
                    }
                }
            }
            return base;
        })(),
        price:               item?.pricing_type === 'dual' ? (item?.price_solo || item?.price || '') : (item?.price || ''),
        price_solo:          item?.price_solo || '',
        price_whole:         item?.price_whole || '',
        category_id:         item?.category_id || '',
        is_available:        item?.is_available ?? true,
        is_featured:         item?.is_featured || false,
        image:               null,
        image_preview:       item?.image ? getImageUrl(item.image) : null,
        ingredients: (() => {
            const isDual = (item?.pricing_type ?? 'single') === 'dual';
            const rows = [];
            for (const ing of (item?.ingredients ?? [])) {
                const rawNotes   = ing?.pivot?.notes ?? ing?.notes ?? '';
                const dualMatch  = rawNotes.match(/^\[dual:([\d.]+):([\d.]+)\]\s*/);
                const stockUnit  = ing?.unit ?? '';
                const recipeUnit = ing?.pivot?.unit ?? stockUnit;
                const base = {
                    id:                ing.id,
                    name:              ing.name,
                    unit:              recipeUnit,
                    stock_unit:        stockUnit,
                    pieces_per_box:    ing?.pieces_per_box ?? null,
                    cost_per_unit:     ing?.cost_per_unit ?? 0,
                    current_stock:     ing?.current_stock ?? ing?.quantity ?? 0,
                    is_main:           Boolean(ing?.pivot?.is_main ?? ing?.is_main ?? false),
                };
                if (isDual && dualMatch) {
                    const cleanNotes = rawNotes.replace(/^\[dual:[\d.]+:[\d.]+\]\s*/i, '');
                    const soloQty = parseFloat(dualMatch[1]) || 0;
                    const wholeQty = parseFloat(dualMatch[2]) || 0;
                    rows.push({ ...base, quantity_required: soloQty,  notes: cleanNotes, portion: 'solo'  });
                    rows.push({ ...base, quantity_required: wholeQty, notes: cleanNotes, portion: 'whole' });
                    continue;
                }
                // Check for size encoding [sizes:T:G:V]
                const sizesMatch = rawNotes.match(/^\[sizes:([\d.]+):([\d.]+):([\d.]+)\]\s*/);
                if (sizesMatch) {
                    const cleanNotes = rawNotes.replace(/^\[sizes:[\d.]+:[\d.]+:[\d.]+\]\s*/i, '');
                    rows.push({ ...base, quantity_required: parseFloat(sizesMatch[1]) || 0, notes: cleanNotes, portion: 'tall'   });
                    rows.push({ ...base, quantity_required: parseFloat(sizesMatch[2]) || 0, notes: cleanNotes, portion: 'grande' });
                    rows.push({ ...base, quantity_required: parseFloat(sizesMatch[3]) || 0, notes: cleanNotes, portion: 'venti'  });
                    continue;
                }

                const parsed     = parsePortionAndNotes(rawNotes);
                const baseWithQty = {
                    ...base,
                    quantity_required: ing?.pivot?.quantity_required ?? ing?.quantity_required ?? 0,
                    notes:             parsed.notes,
                    portion:           parsed.portion,
                };
                // Auto-expand legacy single entries when editing a dual-price item
                if (isDual && !['solo','whole'].includes(baseWithQty.portion)) {
                    rows.push({ ...baseWithQty, portion: 'solo'  });
                    rows.push({ ...baseWithQty, portion: 'whole' });
                } else {
                    rows.push(baseWithQty);
                }
            }
            return rows;
        })(),
    });

    const [search,      setSearch]      = useState('');
    const [showDrop,    setShowDrop]    = useState(false);
    const [selected,    setSelected]    = useState(null);
    const [addQty,      setAddQty]      = useState('');
    const [addQtySolo,   setAddQtySolo]   = useState('');
    const [addQtyWhole,  setAddQtyWhole]  = useState('');
    const [addQtyTall,   setAddQtyTall]   = useState('');
    const [addQtyGrande, setAddQtyGrande] = useState('');
    const [addQtyVenti,  setAddQtyVenti]  = useState('');
    const [addUnit,     setAddUnit]     = useState('');
    const [addNotes,    setAddNotes]    = useState('');
    const [showAllIngredients, setShowAllIngredients] = useState(false);
    const [errors,      setErrors]      = useState({});
    const [isLoading,   setIsLoading]   = useState(false);

    const dropRef = useRef(null);
    useEffect(() => {
        const close = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const isDualPricing  = formData.pricing_type === 'dual';
    const isSizePricing  = formData.has_sizes === true;

    const filteredIngredients = availableIngredients.filter(ing =>
        !formData.ingredients.some(i => i.id === ing.id) &&
        ing.name.toLowerCase().includes(search.toLowerCase())
    );

    const totalRecipeCost = formData.ingredients.reduce(
        (sum, ing) => sum + (ing.cost_per_unit * ing.quantity_required), 0
    );
    const basePrice    = formData.pricing_type === 'dual' ? Number(formData.price_solo || 0) : Number(formData.price || 0);
    const profitMargin = basePrice > 0 && totalRecipeCost > 0
        ? ((basePrice - totalRecipeCost) / basePrice) * 100 : 0;

    const addPreview = selected
        ? calcConversion(
            isSizePricing  ? (addQtyGrande || addQtyTall || addQtyVenti)
            : isDualPricing ? (addQtySolo || addQtyWhole)
            : addQty,
            addUnit, selected.unit, selected.pieces_per_box ?? null)
        : null;

    const pickIngredient = ing => {
        setSelected(ing);
        setAddUnit(normalizeUnit(ing.unit) || ing.unit);
        setAddQty('');
        setAddQtySolo('');
        setAddQtyWhole('');
        setAddQtyTall('');
        setAddQtyGrande('');
        setAddQtyVenti('');
        setAddNotes('');
        setSearch('');
        setShowDrop(false);
        setErrors({});
    };

    const handleAdd = () => {
        if (!selected) { setErrors({ ingredient: 'Select an ingredient first' }); return; }
        if (isSizePricing) {
            const tq = Number(addQtyTall), gq = Number(addQtyGrande), vq = Number(addQtyVenti);
            if (!addQtyTall   || tq <= 0) { setErrors({ qty_tall:   'Enter Tall qty'   }); return; }
            if (!addQtyGrande || gq <= 0) { setErrors({ qty_grande: 'Enter Grande qty' }); return; }
            if (!addQtyVenti  || vq <= 0) { setErrors({ qty_venti:  'Enter Venti qty'  }); return; }
            const ct = calcConversion(addQtyTall,   addUnit, selected.unit, selected.pieces_per_box ?? null);
            const cg = calcConversion(addQtyGrande, addUnit, selected.unit, selected.pieces_per_box ?? null);
            const cv = calcConversion(addQtyVenti,  addUnit, selected.unit, selected.pieces_per_box ?? null);
            if (!ct.ok) { setErrors({ unit: ct.label }); return; }
            if (!cg.ok) { setErrors({ unit: cg.label }); return; }
            if (!cv.ok) { setErrors({ unit: cv.label }); return; }
            const base = { id: selected.id, name: selected.name, unit: addUnit,
                stock_unit: selected.unit, pieces_per_box: selected.pieces_per_box ?? null,
                notes: addNotes, cost_per_unit: selected.cost_per_unit, current_stock: selected.quantity, is_main: true };
            setFormData(prev => ({ ...prev, ingredients: [...prev.ingredients,
                { ...base, quantity_required: tq, portion: 'tall'   },
                { ...base, quantity_required: gq, portion: 'grande' },
                { ...base, quantity_required: vq, portion: 'venti'  },
            ]}));
            setSelected(null); setAddQty(''); setAddQtySolo(''); setAddQtyWhole('');
            setAddQtyTall(''); setAddQtyGrande(''); setAddQtyVenti('');
            setAddUnit(''); setAddNotes(''); setErrors({});
            return;
        }
        if (isDualPricing) {
            const sq = Number(addQtySolo), wq = Number(addQtyWhole);
            if (!addQtySolo  || sq <= 0) { setErrors({ qty_solo:  'Enter solo qty'  }); return; }
            if (!addQtyWhole || wq <= 0) { setErrors({ qty_whole: 'Enter whole qty' }); return; }
            const cs = calcConversion(addQtySolo,  addUnit, selected.unit, selected.pieces_per_box ?? null);
            const cw = calcConversion(addQtyWhole, addUnit, selected.unit, selected.pieces_per_box ?? null);
            if (!cs.ok) { setErrors({ unit: cs.label }); return; }
            if (!cw.ok) { setErrors({ unit: cw.label }); return; }
            const base = { id: selected.id, name: selected.name, unit: addUnit,
                stock_unit: selected.unit, pieces_per_box: selected.pieces_per_box ?? null,
                notes: addNotes, cost_per_unit: selected.cost_per_unit, current_stock: selected.quantity, is_main: true };
            setFormData(prev => ({ ...prev, ingredients: [...prev.ingredients,
                { ...base, quantity_required: sq, portion: 'solo'  },
                { ...base, quantity_required: wq, portion: 'whole' },
            ]}));
        } else {
            if (!addQty || Number(addQty) <= 0) { setErrors({ qty: 'Enter a valid quantity' }); return; }
            const conv = calcConversion(addQty, addUnit, selected.unit, selected.pieces_per_box ?? null);
            if (!conv.ok) { setErrors({ unit: conv.label }); return; }
            setFormData(prev => ({
                ...prev,
                ingredients: [...prev.ingredients, {
                    id: selected.id, name: selected.name,
                    quantity_required: parseFloat(addQty),
                    unit: addUnit, stock_unit: selected.unit,
                    pieces_per_box: selected.pieces_per_box ?? null,
                    notes: addNotes, cost_per_unit: selected.cost_per_unit, current_stock: selected.quantity,
                    is_main: true,
                }],
            }));
        }
        setSelected(null); setAddQty(''); setAddQtySolo(''); setAddQtyWhole('');
        setAddQtyTall(''); setAddQtyGrande(''); setAddQtyVenti('');
        setAddUnit(''); setAddNotes(''); setErrors({});
    };

    const removeIngredient = i =>
        setFormData(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, idx) => idx !== i) }));

    const updateIngQty  = (i, v) => setFormData(prev => ({ ...prev, ingredients: prev.ingredients.map((ing, idx) => idx === i ? { ...ing, quantity_required: parseFloat(v) || 0 } : ing) }));
    const updateIngUnit = (i, v) => setFormData(prev => ({ ...prev, ingredients: prev.ingredients.map((ing, idx) => idx === i ? { ...ing, unit: v } : ing) }));
    const updateIngMain = (i, value) => setFormData(prev => ({ ...prev, ingredients: prev.ingredients.map((ing, idx) => idx === i ? { ...ing, is_main: value } : ing) }));

    const visibleIngredientRows = formData.ingredients
        .map((ing, idx) => ({ ing, idx }))
        .filter(({ ing }) => showAllIngredients || Boolean(ing.is_main));

    const handleSubmit = async e => {
        e.preventDefault();
        if (!formData.name.trim())                                              { setErrors({ name: 'Item name is required' }); return; }
        if (isSizePricing) {
            // At least one variant must have a price
            const hasAnyPrice = ALL_VARIANTS.some(v => Number(formData.variant_prices[`${v.size_name}:${v.temperature}`]) > 0);
            if (!hasAnyPrice) { setErrors({ price: 'Enter at least one size price' }); return; }
        } else if (formData.pricing_type === 'dual') {
            if (!formData.price_solo  || Number(formData.price_solo)  <= 0)    { setErrors({ price_solo:  'Valid solo price is required'  }); return; }
            if (!formData.price_whole || Number(formData.price_whole) <= 0)    { setErrors({ price_whole: 'Valid whole price is required' }); return; }
        } else {
            if (!formData.price || Number(formData.price) <= 0)                { setErrors({ price: 'Valid price is required' }); return; }
        }
        if (!formData.category_id)                                             { setErrors({ category: 'Please select a category' }); return; }
        setIsLoading(true);
        const data = new FormData();
        data.append('name', formData.name.trim());
        data.append('description', formData.description || '');
        data.append('pricing_type', formData.pricing_type);
        if (formData.pricing_type === 'dual') {
            data.append('price', formData.price_solo);
            data.append('price_solo', formData.price_solo);
            data.append('price_whole', formData.price_whole);
        } else {
            data.append('price', formData.price);
        }
        data.append('category_id', formData.category_id);
        data.append('is_available', formData.is_available ? '1' : '0');
        data.append('is_featured',  formData.is_featured  ? '1' : '0');
        data.append('has_sizes', isSizePricing ? '1' : '0');
        if (isSizePricing) {
            // Send variant prices as JSON: [{ size_name, temperature, price }, ...]
            const variantPayload = ALL_VARIANTS
                .filter(v => Number(formData.variant_prices[`${v.size_name}:${v.temperature}`]) > 0)
                .map(v => ({
                    size_name:   v.size_name,
                    size_id:     v.size_id,
                    temperature: v.temperature,
                    price:       Number(formData.variant_prices[`${v.size_name}:${v.temperature}`]),
                }));
            data.append('size_variants', JSON.stringify(variantPayload));
        }
        if (formData.image) data.append('image', formData.image);
        // For dual-price items, solo+whole share the same ingredient_id.
        // Laravel sync() only keeps one pivot row per id, so we merge them
        // into a single row encoding both qtys: notes = '[dual:SOLO:WHOLE] ...'
        const ingredientsPayload = (() => {
            const hasSizes = formData.ingredients.some(i => ['tall','grande','venti'].includes(i.portion));
            const hasDual  = !hasSizes && formData.ingredients.some(i => i.portion === 'solo' || i.portion === 'whole');

            if (hasSizes) {
                // Encode as [sizes:TALL:GRANDE:VENTI] in notes; use Tall qty as quantity_required
                const merged = {};
                for (const ing of formData.ingredients) {
                    if (!merged[ing.id]) merged[ing.id] = { id: ing.id, unit: ing.unit, notes: ing.notes || '', tall: 0, grande: 0, venti: 0, is_main: false };
                    if (ing.portion === 'tall')   merged[ing.id].tall   = ing.quantity_required;
                    if (ing.portion === 'grande') merged[ing.id].grande = ing.quantity_required;
                    if (ing.portion === 'venti')  merged[ing.id].venti  = ing.quantity_required;
                    merged[ing.id].is_main = merged[ing.id].is_main || Boolean(ing.is_main);
                }
                return Object.values(merged).map(m => ({
                    id: m.id,
                    quantity_required: m.tall,
                    unit: m.unit,
                    notes: `[sizes:${m.tall}:${m.grande}:${m.venti}] ${m.notes}`.trim(),
                    is_main: Boolean(m.is_main),
                }));
            }

            if (!hasDual) {
                return formData.ingredients.map(ing => ({
                    id: ing.id, quantity_required: ing.quantity_required,
                    unit: ing.unit, notes: ing.notes || '',
                    is_main: Boolean(ing.is_main),
                }));
            }
            const merged = {};
            for (const ing of formData.ingredients) {
                if (!merged[ing.id]) merged[ing.id] = { id: ing.id, unit: ing.unit, notes: ing.notes || '', solo_qty: 0, whole_qty: 0, is_main: false };
                if (ing.portion === 'solo')       merged[ing.id].solo_qty  = ing.quantity_required;
                else if (ing.portion === 'whole') merged[ing.id].whole_qty = ing.quantity_required;
                merged[ing.id].is_main = merged[ing.id].is_main || Boolean(ing.is_main);
            }
            return Object.values(merged).map(m => ({
                id: m.id,
                quantity_required: m.solo_qty,
                unit: m.unit,
                notes: `[dual:${m.solo_qty}:${m.whole_qty}] ${m.notes}`.trim(),
                is_main: Boolean(m.is_main),
            }));
        })();
        data.append('ingredients', JSON.stringify(ingredientsPayload));
        await onSave(data);
        setIsLoading(false);
    };

    const isDual = formData.pricing_type === 'dual';

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-2">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                            {item
                                ? <Package className="h-4 w-4 text-emerald-600" />
                                : <Plus className="h-4 w-4 text-emerald-600" />}
                        </div>
                        <h2 className="text-base font-semibold text-gray-900">
                            {item ? 'Edit Menu Item' : 'Add Menu Item'}
                        </h2>
                    </div>
                    <button onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="px-4 py-2 space-y-2.5">

                        {/* Name + Category row */}
                        <div className="grid grid-cols-5 gap-3">
                            <div className="col-span-3">
                                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Item Name *</label>
                                <input type="text" value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className={`w-full px-2.5 py-1.5 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
                                    placeholder="e.g., Grilled Salmon" />
                                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Category *</label>
                                <select value={formData.category_id}
                                    onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                                    className={`w-full px-2.5 py-1.5 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${errors.category ? 'border-red-400' : 'border-gray-200'}`}>
                                    <option value="">Select category</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                                {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category}</p>}
                            </div>
                        </div>

                        {/* Price + toggles row */}
                        <div className="flex items-start gap-3">
                            {/* Price block */}
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Price (₱) *</label>
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                            <div className={`relative w-8 h-4 rounded-full transition-colors ${isDual && !isSizePricing ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${isDual && !isSizePricing ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                                <input type="checkbox" checked={isDual && !isSizePricing} className="sr-only"
                                                    onChange={e => {
                                                        const dual = e.target.checked;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            has_sizes:    false,
                                                            pricing_type: dual ? 'dual' : 'single',
                                                            price:       dual ? (prev.price_solo || prev.price) : (prev.price || prev.price_solo),
                                                            price_solo:  dual ? (prev.price_solo || prev.price) : prev.price_solo,
                                                        }));
                                                    }} />
                                            </div>
                                            <span className="text-xs font-medium text-gray-600">2 Prices</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                            <div className={`relative w-8 h-4 rounded-full transition-colors ${isSizePricing ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${isSizePricing ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                                <input type="checkbox" checked={isSizePricing} className="sr-only"
                                                    onChange={e => {
                                                        const sized = e.target.checked;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            has_sizes:    sized,
                                                            pricing_type: sized ? 'single' : prev.pricing_type,
                                                        }));
                                                    }} />
                                            </div>
                                            <span className="text-xs font-medium text-gray-600">Sizes</span>
                                        </label>
                                    </div>
                                </div>
                                {isSizePricing ? (
                                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                                        {/* Column headers */}
                                        <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-200 px-2 py-1">
                                            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Size</div>
                                            <div className="text-[10px] font-semibold text-red-400 text-center">🔥 Hot</div>
                                            <div className="text-[10px] font-semibold text-blue-400 text-center">🧊 Iced</div>
                                            <div />
                                        </div>
                                        {/* One row per size */}
                                        {DRINK_SIZES.map((size, si) => (
                                            <div key={size.id} className={`grid grid-cols-4 items-center gap-2 px-2 py-1.5 ${si < DRINK_SIZES.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                                <span className="text-[11px] font-medium text-gray-600">{size.display}</span>
                                                {['hot','iced'].map(temp => {
                                                    const key = `${size.name}:${temp}`;
                                                    const allowed = size.temps.includes(temp);
                                                    return (
                                                        <div key={temp} className="relative">
                                                            {allowed ? (
                                                                <>
                                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">₱</span>
                                                                    <input
                                                                        type="number" step="0.01" min="0"
                                                                        value={formData.variant_prices[key] || ''}
                                                                        onChange={e => setFormData(prev => ({
                                                                            ...prev,
                                                                            variant_prices: { ...prev.variant_prices, [key]: e.target.value }
                                                                        }))}
                                                                        className="w-full pl-5 pr-1 py-1 text-xs border border-gray-200 rounded bg-white focus:ring-1 focus:ring-indigo-400 outline-none"
                                                                        placeholder="0.00"
                                                                    />
                                                                </>
                                                            ) : (
                                                                <div className="w-full py-1 text-center text-gray-200 text-xs select-none">—</div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                <div />
                                            </div>
                                        ))}
                                        {errors.price && <p className="px-2 pb-1 text-xs text-red-500">{errors.price}</p>}
                                    </div>
                                ) : isDual ? (
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                                            <input type="number" step="0.01" min="0" value={formData.price_solo}
                                                onChange={e => setFormData({ ...formData, price_solo: e.target.value })}
                                                className={`w-full pl-7 pr-3 py-1.5 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${errors.price_solo ? 'border-red-400' : 'border-gray-200'}`}
                                                placeholder="Solo" />
                                            {errors.price_solo && <p className="mt-1 text-xs text-red-500">{errors.price_solo}</p>}
                                        </div>
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                                            <input type="number" step="0.01" min="0" value={formData.price_whole}
                                                onChange={e => setFormData({ ...formData, price_whole: e.target.value })}
                                                className={`w-full pl-7 pr-3 py-1.5 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${errors.price_whole ? 'border-red-400' : 'border-gray-200'}`}
                                                placeholder="Whole" />
                                            {errors.price_whole && <p className="mt-1 text-xs text-red-500">{errors.price_whole}</p>}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                                        <input type="number" step="0.01" min="0" value={formData.price}
                                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                                            className={`w-full pl-7 pr-3 py-1.5 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${errors.price ? 'border-red-400' : 'border-gray-200'}`}
                                            placeholder="0.00" />
                                        {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price}</p>}
                                    </div>
                                )}
                            </div>

                            {/* Toggles */}
                            <div className="flex items-center gap-3 mt-auto pb-0.5">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <div className={`relative w-8 h-4 rounded-full transition-colors ${formData.is_available ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${formData.is_available ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                        <input type="checkbox" checked={formData.is_available} className="sr-only"
                                            onChange={e => setFormData({ ...formData, is_available: e.target.checked })} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-600">Available</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <div className={`relative w-8 h-4 rounded-full transition-colors ${formData.is_featured ? 'bg-amber-400' : 'bg-gray-200'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${formData.is_featured ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                        <input type="checkbox" checked={formData.is_featured} className="sr-only"
                                            onChange={e => setFormData({ ...formData, is_featured: e.target.checked })} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-600">Featured</span>
                                </label>
                            </div>
                        </div>

                        {/* Description + Photo on one row */}
                        <div className="flex gap-3 items-start">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Description</label>
                                <textarea rows="1" value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-2.5 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition resize-none"
                                    placeholder="Optional description..." />
                            </div>
                            <div className="shrink-0">
                                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Photo</label>
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center relative shrink-0">
                                        {formData.image_preview ? (
                                            <>
                                                <img src={formData.image_preview} alt="Preview" className="w-full h-full object-cover" />
                                                <button type="button"
                                                    onClick={() => setFormData({ ...formData, image: null, image_preview: null })}
                                                    className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                                                    <X className="h-2 w-2" />
                                                </button>
                                            </>
                                        ) : (
                                            <ImageIcon className="h-4 w-4 text-gray-300" />
                                        )}
                                    </div>
                                    <input type="file" id="item-image" accept="image/*" className="hidden"
                                        onChange={e => {
                                            const file = e.target.files[0];
                                            if (!file) return;
                                            if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return; }
                                            setFormData({ ...formData, image: file, image_preview: URL.createObjectURL(file) });
                                        }} />
                                    <label htmlFor="item-image"
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap">
                                        <Upload className="h-3 w-3 text-gray-400" />
                                        {formData.image_preview ? 'Change' : 'Upload'}
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Recipe Ingredients */}
                        <div className="rounded-lg border border-gray-200 overflow-hidden">

                            {/* Section header */}
                            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
                                <div className="flex items-center gap-2">
                                    <ChefHat className="h-4 w-4 text-emerald-600" />
                                    <span className="text-sm font-medium text-gray-700">Recipe Ingredients</span>
                                    {formData.ingredients.length > 0 && (
                                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                            {visibleIngredientRows.length}/{formData.ingredients.length}
                                        </span>
                                    )}
                                </div>
                                {formData.ingredients.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAllIngredients(prev => !prev)}
                                            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                                                showAllIngredients
                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            }`}
                                        >
                                            {showAllIngredients ? 'Show Main Only' : 'Show All'}
                                        </button>
                                        <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                                            Cost: <strong className="text-gray-700">₱{totalRecipeCost.toFixed(2)}</strong>
                                        </span>
                                        <span className={`text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium ${profitMargin >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                            {profitMargin >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                            {profitMargin.toFixed(1)}%
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Add ingredient row */}
                            <div className="px-3 py-2 border-b border-gray-100">

                                {/* Info hint */}
                                <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2 bg-blue-50 rounded-lg text-xs text-blue-600">
                                    <Info className="w-3 h-3 flex-shrink-0 text-blue-400 shrink-0" />
                                    <span>
                                        Pick the unit <strong>you measure in</strong> for the recipe.
                                        The system auto-converts to stock unit when deducting inventory.
                                        Supported: <strong>g↔kg · ml↔l · piece↔box/pack</strong>
                                    </span>
                                </div>

                                {/* Search + fields */}
                                <div className="flex gap-2 items-start">

                                    {/* Ingredient search */}
                                    <div className="flex-1 relative" ref={dropRef}>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                            <input type="text" value={search}
                                                onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
                                                onFocus={() => setShowDrop(true)}
                                                placeholder={selected ? `✓ ${selected.name}` : 'Search ingredients…'}
                                                className={`w-full pl-9 pr-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${errors.ingredient ? 'border-red-400' : selected ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'}`} />
                                        </div>
                                        {selected && !search && (
                                            <p className="text-[11px] text-gray-400 mt-1 pl-1">
                                                Stored as <strong className="text-gray-600">{selected.unit}</strong>
                                                {selected.pieces_per_box ? ` · ${selected.pieces_per_box} pcs/box` : ''}
                                                {' '}· Stock: <strong className="text-gray-600">{selected.quantity ?? '—'}</strong>
                                            </p>
                                        )}
                                        {errors.ingredient && <p className="text-xs text-red-500 mt-1">{errors.ingredient}</p>}
                                        {showDrop && search && filteredIngredients.length > 0 && (
                                            <div className="absolute z-20 top-full mt-1 w-full max-h-44 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
                                                {filteredIngredients.map(ing => (
                                                    <button key={ing.id} type="button" onClick={() => pickIngredient(ing)}
                                                        className="w-full px-3 py-2 text-left hover:bg-emerald-50 flex justify-between items-center gap-2 text-xs border-b border-gray-100 last:border-0 transition-colors">
                                                        <div>
                                                            <span className="font-medium text-gray-800 block">{ing.name}</span>
                                                            <span className="text-gray-400 text-[10px]">
                                                                {ing.unit}{ing.pieces_per_box ? ` · ${ing.pieces_per_box} pcs/box` : ''}
                                                            </span>
                                                        </div>
                                                        <span className="text-gray-400 whitespace-nowrap text-[11px]">₱{ing.cost_per_unit}/{ing.unit}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {showDrop && search && filteredIngredients.length === 0 && (
                                            <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs text-gray-500">
                                                No ingredients found
                                            </div>
                                        )}
                                    </div>

                                    {/* Qty + unit + notes + add — only when selected, non-size mode */}
                                    {selected && !isSizePricing && (
                                        <>
                                            {isDualPricing ? (
                                                <div className="space-y-2">
                                                    {/* Solo & Whole Inputs Row */}
                                                    <div className="flex items-end gap-2 bg-gradient-to-br from-blue-50 to-emerald-50 border-2 border-blue-200 rounded-xl p-3">
                                                        <div className="flex flex-col gap-1 flex-1">
                                                            <label className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">Solo</label>
                                                            <input type="number" step="0.001" min="0.001" value={addQtySolo}
                                                                onChange={e => { setAddQtySolo(e.target.value); setErrors({}); }}
                                                                className={`w-full px-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-center font-semibold ${errors.qty_solo ? 'border-red-400 bg-red-50' : 'border-blue-300 bg-white'}`}
                                                                placeholder="0.25" />
                                                            {errors.qty_solo && <span className="text-[10px] text-red-600">{errors.qty_solo}</span>}
                                                        </div>
                                                        <div className="flex flex-col gap-1 flex-1">
                                                            <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Whole</label>
                                                            <input type="number" step="0.001" min="0.001" value={addQtyWhole}
                                                                onChange={e => { setAddQtyWhole(e.target.value); setErrors({}); }}
                                                                className={`w-full px-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-center font-semibold ${errors.qty_whole ? 'border-red-400 bg-red-50' : 'border-emerald-300 bg-white'}`}
                                                                placeholder="0.50" />
                                                            {errors.qty_whole && <span className="text-[10px] text-red-600">{errors.qty_whole}</span>}
                                                        </div>
                                                        <select value={addUnit}
                                                            onChange={e => { setAddUnit(e.target.value); setErrors({}); }}
                                                            className={`px-3 py-2 text-sm border-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${errors.unit ? 'border-red-400' : 'border-blue-300'}`}>
                                                            {getCompatibleUnits(selected.unit, selected.pieces_per_box).map(o => (
                                                                <option key={o.v} value={o.v}>{o.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    
                                                    {/* Notes & Add Button Row */}
                                                    <div className="flex items-center gap-2">
                                                        <input type="text" value={addNotes}
                                                            onChange={e => setAddNotes(e.target.value)}
                                                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                                                            placeholder="Notes (optional)" />

                                                        <button type="button" onClick={handleAdd}
                                                            className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shadow-md">
                                                            ✓ Add
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <input type="number" step="0.001" min="0.001" value={addQty}
                                                        onChange={e => { setAddQty(e.target.value); setErrors({}); }}
                                                        className={`w-20 px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-center ${errors.qty ? 'border-red-400' : 'border-gray-200'}`}
                                                        placeholder="Qty" />

                                                    <select value={addUnit}
                                                        onChange={e => { setAddUnit(e.target.value); setErrors({}); }}
                                                        className={`px-3 py-2 text-sm border rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${errors.unit ? 'border-red-400' : 'border-gray-200'}`}>
                                                        {getCompatibleUnits(selected.unit, selected.pieces_per_box).map(o => (
                                                            <option key={o.v} value={o.v}>{o.label}</option>
                                                        ))}
                                                    </select>

                                                    <input type="text" value={addNotes}
                                                        onChange={e => setAddNotes(e.target.value)}
                                                        className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                                                        placeholder="Notes" />

                                                    <button type="button" onClick={handleAdd}
                                                        className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap">
                                                        Add
                                                    </button>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Size mode: stacked qty sub-form */}
                                {selected && isSizePricing && (
                                    <div className="mt-2 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-indigo-700">
                                                Sizes for <span className="text-indigo-900">{selected.name}</span>
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <select value={addUnit}
                                                    onChange={e => { setAddUnit(e.target.value); setErrors({}); }}
                                                    className={`px-3 py-1.5 text-sm border-2 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none ${errors.unit ? 'border-red-400' : 'border-indigo-300'}`}>
                                                    {getCompatibleUnits(selected.unit, selected.pieces_per_box).map(o => (
                                                        <option key={o.v} value={o.v}>{o.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: 'Tall',   sub: '12oz', val: addQtyTall,   set: setAddQtyTall,   err: errors.qty_tall,   color: 'blue' },
                                                { label: 'Grande', sub: '16oz', val: addQtyGrande, set: setAddQtyGrande, err: errors.qty_grande, color: 'violet' },
                                                { label: 'Venti',  sub: '20oz', val: addQtyVenti,  set: setAddQtyVenti,  err: errors.qty_venti,  color: 'purple' },
                                            ].map(({ label, sub, val, set, err, color }) => (
                                                <div key={label}>
                                                    <label className={`block text-[10px] font-bold mb-1.5 text-${color}-700 uppercase tracking-wider`}>
                                                        {label} <span className="text-gray-400 font-normal">{sub}</span>
                                                    </label>
                                                    <input type="number" step="0.001" min="0.001" value={val}
                                                        onChange={e => { set(e.target.value); setErrors({}); }}
                                                        className={`w-full px-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-${color}-400 focus:border-transparent outline-none text-center font-semibold ${err ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
                                                        placeholder="0.0" />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2 pt-1">
                                            <input type="text" value={addNotes}
                                                onChange={e => setAddNotes(e.target.value)}
                                                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                                                placeholder="Notes (optional)" />
                                            <button type="button" onClick={handleAdd}
                                                className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md whitespace-nowrap">
                                                ✓ Add
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Error messages */}
                                {(errors.qty || errors.qty_solo || errors.qty_whole || errors.qty_tall || errors.qty_grande || errors.qty_venti || errors.unit) && (
                                    <p className="text-xs text-red-500 mt-1.5">{errors.qty || errors.qty_solo || errors.qty_whole || errors.qty_tall || errors.qty_grande || errors.qty_venti || errors.unit}</p>
                                )}

                                {/* Conversion preview */}
                                {addPreview && addPreview.label && (
                                    <div className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${
                                        addPreview.type === 'error'   ? 'bg-red-50 text-red-600 border border-red-100' :
                                        addPreview.type === 'convert' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                                        'bg-gray-50 text-gray-500 border border-gray-100'
                                    }`}>
                                        {addPreview.type === 'error'
                                            ? <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                            : <ArrowRight className="w-3 h-3 flex-shrink-0" />}
                                        {addPreview.label}
                                    </div>
                                )}
                            </div>

                            {/* Ingredient list */}
                            {visibleIngredientRows.length > 0 ? (
                                <div className="divide-y divide-gray-100 max-h-36 overflow-y-auto">
                                    {visibleIngredientRows.map(({ ing, idx }) => {
                                        const stockUnit = ing.stock_unit ?? ing.unit;
                                        const conv = calcConversion(ing.quantity_required, ing.unit, stockUnit, ing.pieces_per_box);
                                        return (
                                            <div key={idx} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-medium text-gray-800 truncate">{ing.name}</p>
                                                            {ing.portion === 'solo'   && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-100 text-blue-600">SOLO</span>}
                                                            {ing.portion === 'whole'  && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-100 text-purple-600">WHOLE</span>}
                                                            {ing.portion === 'tall'   && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-100 text-indigo-600">TALL</span>}
                                                            {ing.portion === 'grande' && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-violet-100 text-violet-600">GRANDE</span>}
                                                            {ing.portion === 'venti'  && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-100 text-purple-700">VENTI</span>}
                                                            {Boolean(ing.is_main) && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-700">MAIN</span>}
                                                        </div>
                                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                                            stored as <strong className="text-gray-500">{stockUnit}</strong>
                                                            {' · '}stock: {ing.current_stock ?? '—'}
                                                            {ing.pieces_per_box ? ` · ${ing.pieces_per_box} pcs/box` : ''}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <input type="number" step="0.001" min="0.001" value={ing.quantity_required}
                                                            onChange={e => updateIngQty(idx, e.target.value)}
                                                            className="w-16 px-2 py-1 text-sm text-center border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                        <select value={ing.unit}
                                                            onChange={e => updateIngUnit(idx, e.target.value)}
                                                            className="px-2 py-1 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                                                            {getCompatibleUnits(stockUnit, ing.pieces_per_box).map(o => (
                                                                <option key={o.v} value={o.v}>{o.v}</option>
                                                            ))}
                                                        </select>
                                                        <label className="flex items-center gap-1 text-[11px] text-gray-600 border border-gray-200 rounded-lg px-2 py-1 bg-white">
                                                            <input
                                                                type="checkbox"
                                                                checked={Boolean(ing.is_main)}
                                                                onChange={(e) => updateIngMain(idx, e.target.checked)}
                                                            />
                                                            Main
                                                        </label>
                                                        <button type="button" onClick={() => removeIngredient(idx)}
                                                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {conv.label && (
                                                    <div className={`mt-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] ${
                                                        conv.type === 'error'   ? 'bg-red-50 text-red-500' :
                                                        conv.type === 'convert' ? 'bg-blue-50 text-blue-600' :
                                                                                  'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {conv.type === 'error'
                                                            ? <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                            : <ArrowRight className="w-3 h-3 flex-shrink-0" />}
                                                        {conv.label}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="px-4 py-5 text-center">
                                    {formData.ingredients.length > 0 && !showAllIngredients ? (
                                        <>
                                            <p className="text-sm text-gray-400">No main ingredients selected.</p>
                                            <p className="text-xs text-gray-300 mt-0.5">Use "Show All" and toggle ingredients as Main.</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm text-gray-400">No ingredients added yet.</p>
                                            <p className="text-xs text-gray-300 mt-0.5">Search above to add one.</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Footer actions */}
                    <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-gray-100">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading}
                            className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isLoading
                                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                                : <><Save className="h-3.5 w-3.5" /> {item ? 'Update' : 'Create'}</>}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}