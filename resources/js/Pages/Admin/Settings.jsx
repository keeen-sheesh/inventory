import React, { useEffect, useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import {
    Settings,
    Store,
    Receipt,
    Monitor,
    ChefHat,
    Shield,
    Code2,
    Save,
    Upload,
    AlertTriangle,
    CheckCircle,
    Info,
    Trash2,
    RefreshCw,
    Phone,
    Mail,
    MapPin,
    Percent,
    Clock,
    Volume2,
    Printer,
    User,
    Github,
    Globe,
    Database,
    HardDrive,
    Activity,
    FileDown,
    Filter,
    ChevronRight,
    X,
} from 'lucide-react';
import { nowPH, formatPHDate, formatPHTime, formatPHDateTime } from '@/utils/phTime';

const Section = ({ title, description, children }) => (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
        </div>
        <div className="p-6 space-y-5">{children}</div>
    </div>
);

const Field = ({ label, hint, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {children}
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
);

const Input = ({ ...props }) => (
    <input
        {...props}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
    />
);

const ShadInput = ({ className = '', ...props }) => (
    <input
        {...props}
        className={`flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm outline-none transition placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 ${className}`}
    />
);

const ShadSelect = ({ className = '', children, ...props }) => (
    <select
        {...props}
        className={`flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 ${className}`}
    >
        {children}
    </select>
);

const ShadButton = ({ variant = 'default', className = '', ...props }) => {
    const base = 'inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50';
    const styles = variant === 'outline'
        ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        : 'bg-gray-900 text-white hover:bg-gray-800';

    return <button {...props} className={`${base} ${styles} ${className}`} />;
};

const Toggle = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between">
        <div>
            <p className="text-sm font-medium text-gray-700">{label}</p>
            {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                checked ? 'bg-yellow-500' : 'bg-gray-200'
            }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    checked ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
        </button>
    </div>
);

const NavItem = ({ icon: Icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
            active
                ? 'bg-yellow-50 text-yellow-700 border-l-4 border-yellow-500'
                : 'text-gray-600 hover:bg-gray-100'
        }`}
    >
        <Icon className="h-4 w-4 flex-shrink-0" />
        {label}
    </button>
);

// ── Receipt helpers (mirrors ReceiptPrint.jsx) ──────────────────────────────
const formatReceiptPrice = (price) => {
    const num = Number(price) || 0;
    return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Extract VAT from VAT-inclusive total (PH standard)
const computeReceiptVAT = (total, taxRate = 12) => {
    const rate = Number(taxRate) || 0;
    if (rate <= 0) return { vatExBase: total, vatAmount: 0 };
    const divisor  = 1 + rate / 100;
    const vatExBase = total / divisor;
    const vatAmount = total - vatExBase;
    return { vatExBase, vatAmount };
};

// Sample data for the test receipt
const TEST_ITEMS = [
    { name: 'Sample Item A', quantity: 2, price: 150.00, subtotal: 300.00 },
    { name: 'Sample Item B', quantity: 1, price: 250.00, subtotal: 250.00 },
];
const TEST_SUBTOTAL_INCLUSIVE = 550.00; // full VAT-inclusive amount

const TestReceiptPreview = ({ businessName, businessTagline, address, phone, receiptHeader, receiptFooter, taxRate, serviceCharge, showTax, showServiceCharge }) => {
    const rate           = Number(taxRate) || 12;
    const svcRate        = Number(serviceCharge) || 0;
    const svcAmount      = svcRate > 0 ? parseFloat((TEST_SUBTOTAL_INCLUSIVE * svcRate / 100).toFixed(2)) : 0;
    const totalDue       = TEST_SUBTOTAL_INCLUSIVE + svcAmount;
    const { vatExBase, vatAmount } = computeReceiptVAT(totalDue, rate);

    const Row = ({ label, value, bold, small, muted }) => (
        <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${small || muted ? 'text-gray-400 text-[11px]' : ''}`}
             style={{ marginBottom: 1 }}>
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );

    const Divider = ({ solid }) => (
        <div className={solid ? 'border-t-2 border-gray-800 my-1' : 'border-t border-dashed border-gray-300 my-2'} />
    );

    return (
        <div className="font-mono text-xs text-gray-800 space-y-0.5 p-4 bg-white max-w-[260px] mx-auto">
            {/* Header */}
            <p className="text-center font-bold text-sm">{businessName || 'CJ BREW & DINE'}</p>
            {businessTagline && <p className="text-center text-gray-500 text-[11px]">{businessTagline}</p>}
            {address        && <p className="text-center text-gray-500 text-[11px]">{address}</p>}
            {phone          && <p className="text-center text-gray-500 text-[11px]">{phone}</p>}
            <p className="text-center text-gray-400 text-[11px]">*** TEST RECEIPT ***</p>
            <p className="text-center text-gray-400 text-[11px]">{new Date().toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' })}, {new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</p>

            <Divider />

            <Row label="Order #:"  value="ORD-000001" bold />
            <Row label="Cashier:"  value="Admin User" />
            <Row label="Customer:" value="Walk-in Customer" />
            <Row label="Payment:"  value="Cash" />

            <Divider />

            <p className="font-bold mb-1">ITEMS</p>
            {TEST_ITEMS.map((item, i) => (
                <div key={i} className="mb-1">
                    <p>{item.name}</p>
                    <div className="flex justify-between text-gray-500 text-[11px]">
                        <span>{item.quantity} x ₱{formatReceiptPrice(item.price)}</span>
                        <span>₱{formatReceiptPrice(item.subtotal)}</span>
                    </div>
                </div>
            ))}

            <Divider />

            {/* Subtotal = VAT-exclusive base when showTax is on */}
            <Row label="SUBTOTAL"
                 value={`₱${formatReceiptPrice(showTax ? vatExBase : TEST_SUBTOTAL_INCLUSIVE)}`} />
            {showServiceCharge && svcAmount > 0 && (
                <Row label={`SERVICE CHARGE (${svcRate}%)`}
                     value={`₱${formatReceiptPrice(svcAmount)}`} />
            )}

            {/* VAT breakdown */}
            {showTax && (
                <>
                    <Row label="VATable Sales:"           value={`₱${formatReceiptPrice(vatExBase)}`} />
                    <Row label={`VAT Amount (${rate}%):`} value={`₱${formatReceiptPrice(vatAmount)}`} />
                    <Row label="VAT-Exempt Sales:" value="₱0.00" muted />
                    <Row label="Zero-Rated Sales:" value="₱0.00" muted />
                </>
            )}

            <Divider solid />
            <Row label="TOTAL" value={`₱${formatReceiptPrice(totalDue)}`} bold />
            <Divider solid />

            <Row label="CASH RECEIVED" value={`₱${formatReceiptPrice(totalDue)}`} />
            <Row label="CHANGE DUE"    value="₱0.00" />

            <Divider />

            <p className="text-center font-bold">{receiptHeader || 'Thank you for dining with us!'}</p>
            <p className="text-center text-[11px]">{receiptFooter || 'Please come again.'}</p>
            <p className="text-center text-[11px] mt-1">This serves as your</p>
            <p className="text-center font-bold text-[12px]">OFFICIAL RECEIPT</p>
        </div>
    );
};

const tabs = [
    { id: 'business', label: 'Business Info', icon: Store },
    { id: 'receipt', label: 'Receipt & Printing', icon: Receipt },
    { id: 'pos', label: 'POS Behavior', icon: Monitor },
    { id: 'kitchen', label: 'Kitchen Display', icon: ChefHat },
    { id: 'system', label: 'System', icon: Database },
    { id: 'audit', label: 'Inventory Audit', icon: Shield },
    { id: 'developer', label: 'Developer', icon: Code2 },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
];

export default function SettingsPage({ auth, settings = {} }) {
    const [activeTab, setActiveTab] = useState('business');
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [cacheClearing, setCacheClearing] = useState(false);
    const [cacheCleared, setCacheCleared] = useState(false);
    const [cacheError, setCacheError] = useState(null);
    const [confirmReset, setConfirmReset] = useState(false);

    // Danger zone
    const [dangerModal, setDangerModal] = useState(null); // { action, label, desc }
    const [dangerConfirmText, setDangerConfirmText] = useState('');
    const [dangerPassword, setDangerPassword] = useState('');
    const [dangerLoading, setDangerLoading] = useState(false);
    const [dangerResult, setDangerResult] = useState(null); // { success, message }

    // Business
    const [businessName, setBusinessName] = useState(settings.business_name ?? 'CJ Brew & Dine');
    const [businessTagline, setBusinessTagline] = useState(settings.business_tagline ?? 'Restobar System');
    const [businessLogo, setBusinessLogo] = useState(settings.business_logo ?? null);
    const [logoPreview, setLogoPreview] = useState(settings.business_logo ? `/storage/${settings.business_logo}` : null);
    const [address, setAddress] = useState(settings.address ?? '');
    const [phone, setPhone] = useState(settings.phone ?? '');
    const [email, setEmail] = useState(settings.email ?? '');
    const [taxRate, setTaxRate] = useState(settings.tax_rate ?? '12');
    const [serviceCharge, setServiceCharge] = useState(settings.service_charge ?? '0');
    const [currency, setCurrency] = useState(settings.currency ?? 'PHP');

    // Receipt
    const [receiptHeader, setReceiptHeader] = useState(settings.receipt_header ?? 'Thank you for dining with us!');
    const [receiptFooter, setReceiptFooter] = useState(settings.receipt_footer ?? 'Please come again.');
    const [autoPrint, setAutoPrint] = useState(settings.auto_print === '1' || settings.auto_print === true);
    const [showTax, setShowTax] = useState(settings.show_tax !== '0' && settings.show_tax !== false);
    const [showServiceCharge, setShowServiceCharge] = useState(settings.show_service_charge === '1' || settings.show_service_charge === true);

    // POS
    const [defaultOrderType, setDefaultOrderType] = useState(settings.default_order_type ?? 'dine-in');
    const [requireCustomerName, setRequireCustomerName] = useState(settings.require_customer_name === '1' || settings.require_customer_name === true);
    const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(settings.auto_logout_minutes ?? '30');
    const [showItemImages, setShowItemImages] = useState(settings.show_item_images !== '0' && settings.show_item_images !== false);

    // Kitchen
    const [alertSound, setAlertSound] = useState(settings.alert_sound !== '0' && settings.alert_sound !== false);
    const [autoReadyTimer, setAutoReadyTimer] = useState(settings.auto_ready_timer ?? '0');
    const [showOrderTimer, setShowOrderTimer] = useState(settings.show_order_timer !== '0' && settings.show_order_timer !== false);

    const [showTestReceipt, setShowTestReceipt] = useState(false);
    const receiptRef = useRef(null);

    const [saveError, setSaveError] = useState(null);
    const [auditFilters, setAuditFilters] = useState({
        pool: 'all',
        or_number: '',
        ingredient: '',
        from_date: '',
        to_date: '',
        limit: '100',
    });
    const [auditRows, setAuditRows] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState(null);

    const buildAuditParams = (filters) => {
        const params = new URLSearchParams();
        if (filters.pool && filters.pool !== 'all') params.set('pool', filters.pool);
        if (filters.or_number) params.set('or_number', filters.or_number.trim());
        if (filters.ingredient) params.set('ingredient', filters.ingredient.trim());
        if (filters.from_date) params.set('from_date', filters.from_date);
        if (filters.to_date) params.set('to_date', filters.to_date);
        if (filters.limit) params.set('limit', filters.limit);
        return params;
    };

    const fetchInventoryAudit = async (filters = auditFilters) => {
        setAuditLoading(true);
        setAuditError(null);
        try {
            const params = buildAuditParams(filters);
            const response = await fetch(`/admin/settings/inventory-audit?${params.toString()}`, {
                method: 'GET',
                headers: { Accept: 'application/json' },
            });
            const data = await response.json();
            if (data.success) {
                setAuditRows(Array.isArray(data.rows) ? data.rows : []);
            } else {
                setAuditError(data.message || 'Failed to load audit logs.');
            }
        } catch {
            setAuditError('Network error while loading inventory audit logs.');
        } finally {
            setAuditLoading(false);
        }
    };

    const applyAuditFilters = () => {
        fetchInventoryAudit(auditFilters);
    };

    const resetAuditFilters = () => {
        const defaults = {
            pool: 'all',
            or_number: '',
            ingredient: '',
            from_date: '',
            to_date: '',
            limit: '100',
        };
        setAuditFilters(defaults);
        fetchInventoryAudit(defaults);
    };

    const exportInventoryAudit = () => {
        const params = buildAuditParams(auditFilters);
        window.location.href = `/admin/settings/inventory-audit/export?${params.toString()}`;
    };

    useEffect(() => {
        if (activeTab === 'audit') {
            fetchInventoryAudit();
        }
    }, [activeTab]);

    const handleSave = async () => {
        setSaving(true);
        setSaveError(null);
        try {
            const formData = new FormData();
            formData.append('business_name', businessName);
            formData.append('business_tagline', businessTagline);
            formData.append('address', address);
            formData.append('phone', phone);
            formData.append('email', email);
            formData.append('tax_rate', Number(taxRate));
            formData.append('service_charge', Number(serviceCharge));
            formData.append('currency', currency);
            formData.append('receipt_header', receiptHeader);
            formData.append('receipt_footer', receiptFooter);
            formData.append('auto_print', autoPrint ? 1 : 0);
            formData.append('show_tax', showTax ? 1 : 0);
            formData.append('show_service_charge', showServiceCharge ? 1 : 0);
            formData.append('default_order_type', defaultOrderType);
            formData.append('require_customer_name', requireCustomerName ? 1 : 0);
            formData.append('auto_logout_minutes', Number(autoLogoutMinutes));
            formData.append('show_item_images', showItemImages ? 1 : 0);
            formData.append('alert_sound', alertSound ? 1 : 0);
            formData.append('auto_ready_timer', Number(autoReadyTimer));
            formData.append('show_order_timer', showOrderTimer ? 1 : 0);
            
            // Add logo file if selected
            if (businessLogo instanceof File) {
                formData.append('business_logo', businessLogo);
            }

            const response = await fetch('/admin/settings', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
                    'Accept': 'application/json',
                },
                body: formData,
            });
            const data = await response.json();
            if (data.success) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
                // Update logo preview with the saved path
                if (data.logo_path) {
                    setLogoPreview(`/storage/${data.logo_path}`);
                }
            } else {
                setSaveError(data.message || 'Failed to save.');
            }
        } catch (err) {
            console.error('Failed to save settings:', err);
            setSaveError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleClearCache = async () => {
        setCacheClearing(true);
        setCacheError(null);
        try {
            const response = await fetch('/admin/settings/clear-cache', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
                    'Accept': 'application/json',
                },
            });
            const data = await response.json();
            if (data.success) {
                setCacheCleared(true);
                setTimeout(() => setCacheCleared(false), 3000);
            } else {
                setCacheError(data.message || 'Failed to clear cache.');
            }
        } catch (err) {
            setCacheError('Network error. Please try again.');
        } finally {
            setCacheClearing(false);
        }
    };

    const dangerActions = [
        {
            action: 'clear-orders',
            label: 'Clear All Orders',
            desc: 'Permanently deletes all order history and transactions.',
            confirm: 'DELETE ORDERS',
        },
        {
            action: 'reset-txn-count',
            label: 'Reset Transaction Count',
            desc: 'Resets the daily transaction sequence counter. Existing sales will be marked with RESET- prefix.',
            confirm: 'RESET TXN COUNT',
        },
        {
            action: 'reset-demo',
            label: 'Reset to Factory Defaults',
            desc: 'Wipes all settings and restores factory defaults.',
            confirm: 'RESET ALL',
        },
        {
            action: 'delete-ingredients',
            label: 'Delete All Ingredients',
            desc: 'Removes all inventory ingredients and stock data.',
            confirm: 'DELETE INGREDIENTS',
        },
    ];

    const handleDangerAction = async () => {
        if (!dangerModal) return;
        setDangerLoading(true);
        setDangerResult(null);
        try {
            const response = await fetch(`/admin/settings/danger/${dangerModal.action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    password: dangerPassword,
                }),
            });
            const data = await response.json();
            const fallbackMessage = data?.errors
                ? Object.values(data.errors)[0]?.[0]
                : null;
            setDangerResult({
                success: Boolean(data.success),
                message: data.message || data.error || fallbackMessage || 'Action failed.',
            });
            if (data.success) {
                setTimeout(() => {
                    setDangerModal(null);
                    setDangerConfirmText('');
                    setDangerPassword('');
                    setDangerResult(null);
                }, 2000);
            }
        } catch (err) {
            setDangerResult({ success: false, message: 'Network error. Please try again.' });
        } finally {
            setDangerLoading(false);
        }
    };

    const handleTestPrint = () => {
        const content = receiptRef.current?.innerHTML;
        if (!content) return;
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        printWindow.document.write(`<!DOCTYPE html><html><head><title>Test Receipt</title>
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family:'Courier New',monospace; font-size:12px; width:300px; margin:0 auto; padding:10px; }
                .center { text-align:center; } .bold { font-weight:bold; } .large { font-size:16px; }
                .divider { border-top:1px dashed #000; margin:8px 0; }
                .row { display:flex; justify-content:space-between; margin:3px 0; }
                .small { font-size:11px; color:#555; }
                .total-row { font-size:14px; font-weight:bold; margin-top:4px; }
                .footer { text-align:center; margin-top:10px; font-size:11px; }
            </style></head><body>${content}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    return (
        <AdminLayout auth={auth}>
            <Head title="Settings" />

            <div className="space-y-6">
                {/* Header */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h1 className="mt-1 text-3xl font-bold text-gray-900">Settings</h1>
                </div>

                <div className="flex gap-6 items-start">
                    {/* Sidebar Nav */}
                    <div className="w-56 flex-shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm p-3 space-y-1 sticky top-6">
                        {tabs.map((tab) => (
                            <NavItem
                                key={tab.id}
                                icon={tab.icon}
                                label={tab.label}
                                active={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                            />
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-5">

                        {/* ── Business Info ── */}
                        {activeTab === 'business' && (
                            <>
                                <Section title="Restaurant Details" description="Basic information displayed across the system and receipts.">
                                    <Field label="Restaurant Name">
                                        <Input value={businessName} onChange={e => setBusinessName(e.target.value)} />
                                    </Field>
                                    <Field label="Tagline / Sub-label">
                                        <Input value={businessTagline} onChange={e => setBusinessTagline(e.target.value)} placeholder="" />
                                    </Field>
                                    <Field label="Address">
                                        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, City, Province" />
                                    </Field>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="Phone">
                                            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+63 900 000 0000" />
                                        </Field>
                                        <Field label="Email">
                                            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="hello@cjbrewdine.com" />
                                        </Field>
                                    </div>
                                    <Field label="Logo">
                                        <div className="flex items-center gap-3">
                                            <div className="w-14 h-14 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                                                {logoPreview ? (
                                                    <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-gray-400 text-xs text-center p-2">No logo</div>
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                id="logo-upload"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setBusinessLogo(file);
                                                        setLogoPreview(URL.createObjectURL(file));
                                                    }
                                                }}
                                            />
                                            <label htmlFor="logo-upload" className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
                                                <Upload className="h-4 w-4" /> Upload New Logo
                                            </label>
                                            {logoPreview && (
                                                <button
                                                    onClick={() => {
                                                        setBusinessLogo(null);
                                                        setLogoPreview(null);
                                                    }}
                                                    className="px-3 py-2 text-sm text-red-600 hover:text-red-700"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </Field>
                                </Section>

                                <Section title="Tax & Charges" description="Applied to all completed orders.">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="VAT Rate (%)" hint="Standard PH VAT is 12%">
                                            <div className="relative">
                                                <Input value={taxRate} onChange={e => setTaxRate(e.target.value)} type="number" min="0" max="100" />
                                                <Percent className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                                            </div>
                                        </Field>
                                        <Field label="Service Charge (%)" hint="Set 0 to disable">
                                            <div className="relative">
                                                <Input value={serviceCharge} onChange={e => setServiceCharge(e.target.value)} type="number" min="0" max="100" />
                                                <Percent className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                                            </div>
                                        </Field>
                                    </div>
                                    <Field label="Currency">
                                        <select
                                            value={currency}
                                            onChange={e => setCurrency(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                        >
                                            <option value="PHP">PHP — Philippine Peso (₱)</option>
                                            <option value="USD">USD — US Dollar ($)</option>
                                        </select>
                                    </Field>
                                </Section>
                            </>
                        )}

                        {/* ── Receipt & Printing ── */}
                        {activeTab === 'receipt' && (
                            <Section title="Receipt & Printing" description="Customize what appears on customer receipts.">
                                <Field label="Receipt Header Message">
                                    <Input value={receiptHeader} onChange={e => setReceiptHeader(e.target.value)} placeholder="Thank you for dining with us!" />
                                </Field>
                                <Field label="Receipt Footer Message">
                                    <Input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} placeholder="Please come again." />
                                </Field>
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <Toggle label="Auto-print on order completion" description="Automatically sends receipt to printer when order is marked complete." checked={autoPrint} onChange={setAutoPrint} />
                                    <Toggle label="Show VAT breakdown" description="Display itemized tax on receipt." checked={showTax} onChange={setShowTax} />
                                    <Toggle label="Show service charge" checked={showServiceCharge} onChange={setShowServiceCharge} />
                                </div>
                                <div className="pt-2 space-y-4">
                                    <button
                                        onClick={() => setShowTestReceipt(!showTestReceipt)}
                                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                                    >
                                        <Printer className="h-4 w-4" />
                                        {showTestReceipt ? 'Hide Preview' : 'Test Print'}
                                    </button>

                                    {showTestReceipt && (
                                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                                            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Receipt Preview</p>
                                                <button
                                                    onClick={handleTestPrint}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold rounded-lg transition-colors"
                                                >
                                                    <Printer className="h-3 w-3" /> Print
                                                </button>
                                            </div>
                                            <div ref={receiptRef}>
                                                <TestReceiptPreview
                                                    businessName={businessName}
                                                    businessTagline={businessTagline}
                                                    address={address}
                                                    phone={phone}
                                                    receiptHeader={receiptHeader}
                                                    receiptFooter={receiptFooter}
                                                    taxRate={taxRate}
                                                    serviceCharge={serviceCharge}
                                                    showTax={showTax}
                                                    showServiceCharge={showServiceCharge}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Section>
                        )}

                        {/* ── POS Behavior ── */}
                        {activeTab === 'pos' && (
                            <Section title="POS Behavior" description="Control how the point-of-sale screen works for cashiers.">
                                <Field label="Default Order Type">
                                    <select
                                        value={defaultOrderType}
                                        onChange={e => setDefaultOrderType(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                    >
                                        <option value="dine-in">Dine-in</option>
                                        <option value="takeout">Takeout</option>
                                        <option value="delivery">Delivery</option>
                                    </select>
                                </Field>
                                <Field label="Auto-logout Timer (minutes)" hint="Set 0 to disable. Cashier is logged out after inactivity.">
                                    <Input value={autoLogoutMinutes} onChange={e => setAutoLogoutMinutes(e.target.value)} type="number" min="0" />
                                </Field>
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <Toggle label="Require customer name on order" description="Cashier must enter a name before submitting." checked={requireCustomerName} onChange={setRequireCustomerName} />
                                    <Toggle label="Show item images in POS" description="Displays food images on the menu grid." checked={showItemImages} onChange={setShowItemImages} />
                                </div>
                            </Section>
                        )}

                        {/* ── Kitchen Display ── */}
                        {activeTab === 'kitchen' && (
                            <Section title="Kitchen Display" description="Settings for the kitchen order display screen.">
                                <Field label="Auto-ready Timer (minutes)" hint="Set 0 to disable auto-marking. Orders are automatically marked ready after this time.">
                                    <Input value={autoReadyTimer} onChange={e => setAutoReadyTimer(e.target.value)} type="number" min="0" />
                                </Field>
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <Toggle label="New order alert sound" description="Play a sound when a new order arrives in the kitchen." checked={alertSound} onChange={setAlertSound} />
                                    <Toggle label="Show elapsed order timer" description="Display how long each order has been waiting." checked={showOrderTimer} onChange={setShowOrderTimer} />
                                </div>
                            </Section>
                        )}

                        {/* ── System ── */}
                        {activeTab === 'system' && (
                            <>
                                <Section title="System Health" description="Current status of your application environment.">
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Database', status: 'Connected', ok: true },
                                            { label: 'Storage', status: 'Available', ok: true },
                                            { label: 'Cache', status: 'Active', ok: true },
                                            { label: 'Queue', status: 'Running', ok: true },
                                        ].map(item => (
                                            <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                                    <Activity className="h-4 w-4 text-gray-400" />
                                                    {item.label}
                                                </div>
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${item.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                    {item.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </Section>
                                <Section title="Maintenance" description="Manage application cache and data.">
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            onClick={handleClearCache}
                                            disabled={cacheClearing}
                                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                                        >
                                            {cacheCleared ? (
                                                <><CheckCircle className="h-4 w-4 text-emerald-500" /><span className="text-emerald-600">Cache Cleared!</span></>
                                            ) : cacheClearing ? (
                                                <><RefreshCw className="h-4 w-4 animate-spin" /> Clearing...</>
                                            ) : (
                                                <><RefreshCw className="h-4 w-4" /> Clear Cache</>
                                            )}
                                        </button>
                                        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                                            <HardDrive className="h-4 w-4" /> Export Data
                                        </button>
                                    </div>
                                    {cacheError && <p className="text-sm text-red-500 mt-2">{cacheError}</p>}
                                    <p className="text-xs text-gray-400 mt-2">
                                        Clears application cache, config, routes, and compiled views. Forces the POS and menu to reload fresh data from the database.
                                    </p>
                                </Section>
                                <Section title="App Info">
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <div className="flex justify-between"><span className="text-gray-400">Version</span><span className="font-medium">v1.0.0</span></div>
                                        <div className="flex justify-between"><span className="text-gray-400">Framework</span><span className="font-medium">Laravel + Inertia + React</span></div>
                                        <div className="flex justify-between"><span className="text-gray-400">Environment</span><span className="font-medium">Production</span></div>
                                    </div>
                                </Section>
                            </>
                        )}

                        {/* ── Inventory Audit ── */}
                        {activeTab === 'audit' && (
                            <>
                                <Section
                                    title="Inventory Audit Trail"
                                    description="Filter and export all inventory stock count entries (single and bulk updates)."
                                >
                                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-gray-600">Pool</label>
                                                <ShadSelect
                                                    value={auditFilters.pool}
                                                    onChange={(e) => setAuditFilters((prev) => ({ ...prev, pool: e.target.value }))}
                                                >
                                                    <option value="all">All Pools</option>
                                                    <option value="resto">Resto</option>
                                                    <option value="kitchen">Kitchen</option>
                                                </ShadSelect>
                                            </div>

                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-gray-600">OR Number</label>
                                                <ShadInput
                                                    value={auditFilters.or_number}
                                                    onChange={(e) => setAuditFilters((prev) => ({ ...prev, or_number: e.target.value }))}
                                                    placeholder=""
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-gray-600">Ingredient</label>
                                                <ShadInput
                                                    value={auditFilters.ingredient}
                                                    onChange={(e) => setAuditFilters((prev) => ({ ...prev, ingredient: e.target.value }))}
                                                    placeholder="Search ingredient"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-gray-600">From Date</label>
                                                <ShadInput
                                                    type="date"
                                                    value={auditFilters.from_date}
                                                    onChange={(e) => setAuditFilters((prev) => ({ ...prev, from_date: e.target.value }))}
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-gray-600">To Date</label>
                                                <ShadInput
                                                    type="date"
                                                    value={auditFilters.to_date}
                                                    onChange={(e) => setAuditFilters((prev) => ({ ...prev, to_date: e.target.value }))}
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-gray-600">Rows</label>
                                                <ShadSelect
                                                    value={auditFilters.limit}
                                                    onChange={(e) => setAuditFilters((prev) => ({ ...prev, limit: e.target.value }))}
                                                >
                                                    <option value="50">50</option>
                                                    <option value="100">100</option>
                                                    <option value="250">250</option>
                                                    <option value="500">500</option>
                                                </ShadSelect>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <ShadButton onClick={applyAuditFilters}>
                                                <Filter className="mr-2 h-4 w-4" />
                                                Apply Filters
                                            </ShadButton>
                                            <ShadButton variant="outline" onClick={resetAuditFilters}>
                                                Reset
                                            </ShadButton>
                                            <ShadButton variant="outline" onClick={exportInventoryAudit}>
                                                <FileDown className="mr-2 h-4 w-4" />
                                                Download CSV
                                            </ShadButton>
                                        </div>
                                    </div>
                                </Section>

                                <Section title="Audit Entries" description="Each row is one ingredient stock count record.">
                                    {auditError && (
                                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                            {auditError}
                                        </div>
                                    )}

                                    {auditLoading ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            Loading audit logs...
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-gray-50">
                                                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                                        <th className="px-3 py-2">Counted At</th>
                                                        <th className="px-3 py-2">Pool</th>
                                                        <th className="px-3 py-2">OR</th>
                                                        <th className="px-3 py-2">Ingredient</th>
                                                        <th className="px-3 py-2 text-right">Previous</th>
                                                        <th className="px-3 py-2 text-right">Counted</th>
                                                        <th className="px-3 py-2 text-right">Variance</th>
                                                        <th className="px-3 py-2">Mode</th>
                                                        <th className="px-3 py-2">By</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {auditRows.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-500">
                                                                No audit entries found for the selected filters.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        auditRows.map((row, index) => {
                                                            const variance = Number(row.variance || 0);
                                                            const varianceClass = variance > 0
                                                                ? 'text-emerald-700'
                                                                : variance < 0
                                                                    ? 'text-rose-700'
                                                                    : 'text-gray-600';

                                                            return (
                                                                <tr key={`${row.batch_id}-${index}`} className="hover:bg-gray-50/60">
                                                                    <td className="px-3 py-2 text-gray-700">
                                                                        {formatPHDateTime(row.counted_at)}
                                                                    </td>
                                                                    <td className="px-3 py-2">
                                                                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                                                            {String(row.pool_code || '').toUpperCase()}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2 font-medium text-gray-900">{row.or_number}</td>
                                                                    <td className="px-3 py-2 text-gray-700">{row.ingredient_name}</td>
                                                                    <td className="px-3 py-2 text-right text-gray-700">{Number(row.previous_stock).toFixed(3)}</td>
                                                                    <td className="px-3 py-2 text-right text-gray-700">{Number(row.counted_stock).toFixed(3)}</td>
                                                                    <td className={`px-3 py-2 text-right font-semibold ${varianceClass}`}>
                                                                        {variance > 0 ? '+' : ''}{variance.toFixed(3)}
                                                                    </td>
                                                                    <td className="px-3 py-2">
                                                                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                                                            {Number(row.items_in_batch || 1) > 1 ? 'Bulk' : 'Single'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-gray-700">{row.counted_by}</td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Section>
                            </>
                        )}

                        {/* ── Developer ── */}
                        {activeTab === 'developer' && (
                            <Section title="Developer Info" description="Built and maintained by the development team.">
                                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="w-14 h-14 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                                        CJ
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 text-base">CJ Brew & Dine Dev Team</p>
                                        <p className="text-sm text-gray-500">Full-stack Developer</p>
                                    </div>
                                </div>
                                <div className="space-y-3 pt-2">
                                    {[
                                        { icon: Mail, label: 'Email', value: 'dev@cjbrewdine.com' },
                                        { icon: Github, label: 'GitHub', value: 'github.com/cjbrewdine' },
                                        { icon: Globe, label: 'Website', value: 'cjbrewdine.com' },
                                    ].map(item => (
                                        <div key={item.label} className="flex items-center gap-3 text-sm">
                                            <item.icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                            <span className="text-gray-400 w-16">{item.label}</span>
                                            <span className="text-gray-700">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-4 border-t border-gray-100">
                                    <p className="text-xs text-gray-400">
                                        For bug reports, feature requests, or technical support, please reach out via email or GitHub issues.
                                    </p>
                                </div>
                            </Section>
                        )}

                        {/* ── Danger Zone ── */}
                        {activeTab === 'danger' && (
                            <>
                            <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 overflow-hidden">
                                <div className="px-6 py-4 border-b border-rose-200 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                                    <h3 className="text-base font-semibold text-rose-700">Danger Zone</h3>
                                </div>
                                <div className="p-6 space-y-4">
                                    <p className="text-sm text-rose-600">These actions are <strong>irreversible</strong>. You will be asked to confirm before anything is deleted.</p>
                                    <div className="space-y-3">
                                        {dangerActions.map(action => (
                                            <div key={action.action} className="flex items-center justify-between p-4 bg-white rounded-xl border border-rose-200">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                                                </div>
                                                <button
                                                    onClick={() => { setDangerModal(action); setDangerConfirmText(''); setDangerPassword(''); setDangerResult(null); }}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-lg hover:bg-rose-700 transition-colors"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Confirmation Modal */}
                            {dangerModal && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-rose-100 rounded-full">
                                                <AlertTriangle className="h-5 w-5 text-rose-600" />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900">{dangerModal.label}</h3>
                                        </div>
                                        <p className="text-sm text-gray-600">{dangerModal.desc}</p>
                                        <p className="text-sm text-gray-600">
                                            This action <strong>cannot be undone</strong>. Type{' '}
                                            <code className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded font-mono text-xs">{dangerModal.confirm}</code>{' '}
                                            to confirm.
                                        </p>
                                        <input
                                            type="text"
                                            value={dangerConfirmText}
                                            onChange={e => setDangerConfirmText(e.target.value)}
                                            placeholder={dangerModal.confirm}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-400"
                                        />
                                        <input
                                            type="password"
                                            value={dangerPassword}
                                            onChange={e => setDangerPassword(e.target.value)}
                                            placeholder="Enter your password to continue"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                                        />
                                        {dangerResult && (
                                            <p className={`text-sm font-medium ${dangerResult.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {dangerResult.message}
                                            </p>
                                        )}
                                        <div className="flex gap-3 justify-end">
                                            <button
                                                onClick={() => { setDangerModal(null); setDangerConfirmText(''); setDangerPassword(''); setDangerResult(null); }}
                                                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleDangerAction}
                                                disabled={dangerConfirmText !== dangerModal.confirm || !dangerPassword || dangerLoading}
                                                className="flex items-center gap-2 px-4 py-2 text-sm bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {dangerLoading ? (
                                                    <><RefreshCw className="h-4 w-4 animate-spin" /> Processing...</>
                                                ) : (
                                                    <><Trash2 className="h-4 w-4" /> Confirm Delete</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            </>
                        )}

                        {/* Save Button — hidden on danger/developer/system tabs */}
                        {!['danger', 'developer', 'system', 'audit'].includes(activeTab) && (
                            <div className="flex items-center justify-end gap-3">
                                {saveError && (
                                    <p className="text-sm text-red-500">{saveError}</p>
                                )}
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-60 text-white font-semibold rounded-xl shadow-sm transition-colors"
                                >
                                    {saved ? (
                                        <><CheckCircle className="h-4 w-4" /> Saved!</>
                                    ) : saving ? (
                                        <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</>
                                    ) : (
                                        <><Save className="h-4 w-4" /> Save Changes</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
