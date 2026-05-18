// Reports.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
    Calendar, ChevronDown, RefreshCw, Printer,
    TrendingUp, DollarSign, ShoppingBag, Package,
    BarChart3, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatPeso = (v) => {
    if (v === null || v === undefined) return '₱0.00';
    return `₱${parseFloat(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};
const formatNumber = (n) => {
    if (n === null || n === undefined) return '0';
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
const formatShortDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};
const buildDateLabel = (range, from, to, startDate, endDate) => {
    const fmt  = (d) => new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    const fmts = (d) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    switch (range) {
        case 'today':      return `Today — ${fmt(new Date())}`;
        case 'yesterday':  { const y = new Date(); y.setDate(y.getDate()-1); return `Yesterday — ${fmt(y)}`; }
        case 'this_week':  return 'This Week';
        case 'last_week':  return 'Last Week';
        case 'this_month': return new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
        case 'last_month': { const lm = new Date(); lm.setMonth(lm.getMonth()-1); return lm.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }); }
        case 'custom':     return from && to ? `${fmts(from)} – ${fmts(to)}` : 'Custom Range';
        default:           return startDate && endDate ? `${fmts(startDate)} – ${fmts(endDate)}` : 'All Time';
    }
};

// ─── Icons ───────────────────────────────────────────────────────────────────

const CreditCard = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
    </svg>
);

// ─── Tooltips ─────────────────────────────────────────────────────────────────

const PesoTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs">
            <p className="font-semibold text-gray-700 mb-2">{label}</p>
            {payload.map((e, i) => (
                <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                    <span className="text-gray-500">{e.name}:</span>
                    <span className="font-semibold text-gray-800">{formatPeso(e.value)}</span>
                </div>
            ))}
        </div>
    );
};
const PctTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs">
            <p className="font-semibold text-gray-700 mb-2">{label}</p>
            {payload.map((e, i) => (
                <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                    <span className="text-gray-500">{e.name}:</span>
                    <span className="font-semibold text-gray-800">{e.value}%</span>
                </div>
            ))}
        </div>
    );
};

// ─── Mini Calendar ────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const WDAYS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function MiniCalendar({ value, onChange, minDate, maxDate }) {
    const today = new Date();
    const init  = value ? new Date(value + 'T00:00:00') : today;
    const [view, setView] = useState({ year: init.getFullYear(), month: init.getMonth() });

    const selected = value ? new Date(value + 'T00:00:00') : null;
    const min = minDate ? new Date(minDate + 'T00:00:00') : null;
    const max = maxDate ? new Date(maxDate + 'T00:00:00') : null;

    const firstDay    = new Date(view.year, view.month, 1).getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

    const prevMonth = () => setView(v => v.month === 0 ? { year: v.year-1, month: 11 } : { ...v, month: v.month-1 });
    const nextMonth = () => setView(v => v.month === 11 ? { year: v.year+1, month: 0  } : { ...v, month: v.month+1 });

    const pick = (day) => {
        const d = new Date(view.year, view.month, day);
        if (min && d < min) return;
        if (max && d > max) return;
        const str = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        onChange(str);
    };

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div className="w-64">
            <div className="flex items-center justify-between mb-3">
                <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                    <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
                <span className="text-sm font-semibold text-gray-800">{MONTHS[view.month]} {view.year}</span>
                <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
                {WDAYS.map(d => <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, i) => {
                    if (!day) return <div key={i} />;
                    const d = new Date(view.year, view.month, day);
                    const isSel = selected && d.getFullYear()===selected.getFullYear() && d.getMonth()===selected.getMonth() && d.getDate()===selected.getDate();
                    const isTod = d.toDateString() === today.toDateString();
                    const dis   = (min && d < min) || (max && d > max);
                    return (
                        <button key={i} onClick={() => pick(day)} disabled={dis}
                            className={`text-center text-xs py-1.5 rounded-lg transition-colors font-medium
                                ${isSel ? 'bg-blue-600 text-white' : ''}
                                ${isTod && !isSel ? 'border border-blue-300 text-blue-600' : ''}
                                ${!isSel && !isTod && !dis ? 'hover:bg-gray-100 text-gray-700' : ''}
                                ${dis ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer'}`}>
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Date Range Picker ────────────────────────────────────────────────────────

const PRESETS = [
    { value: 'today',      label: 'Today'      },
    { value: 'yesterday',  label: 'Yesterday'  },
    { value: 'this_week',  label: 'This Week'  },
    { value: 'last_week',  label: 'Last Week'  },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
];

function DateRangePicker({ value, customFrom, customTo, onSelect, onCustomApply }) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState('presets');
    const [from, setFrom] = useState(customFrom || '');
    const [to,   setTo  ] = useState(customTo   || '');
    const ref = useRef(null);
    const todayStr = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setMode('presets'); } };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const fmtD = (s) => s ? new Date(s+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const label = value==='custom' && from && to ? `${fmtD(from)} – ${fmtD(to)}` : PRESETS.find(p=>p.value===value)?.label || 'Select Range';

    const applyCustom = () => { if (from && to) { onCustomApply(from, to); setOpen(false); setMode('presets'); } };

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => { setOpen(!open); setMode('presets'); }}
                className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors text-sm shadow-sm">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="font-medium text-gray-700 max-w-[200px] truncate">{label}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open?'rotate-180':''}`} />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden" style={{minWidth:270}}>
                    {mode === 'presets' && (
                        <div className="p-2">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-2">Quick Select</p>
                            {PRESETS.map(p => (
                                <button key={p.value} onClick={() => { onSelect(p.value); setOpen(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors font-medium ${value===p.value?'bg-blue-50 text-blue-600':'text-gray-700 hover:bg-gray-50'}`}>
                                    {p.label}
                                </button>
                            ))}
                            <div className="border-t border-gray-100 my-2"/>
                            <button onClick={() => setMode('from')}
                                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors font-medium ${value==='custom'?'bg-blue-50 text-blue-600':'text-gray-700 hover:bg-gray-50'}`}>
                                Custom Range
                                {value==='custom' && from && to && <span className="block text-xs text-blue-400 font-normal mt-0.5">{fmtD(from)} – {fmtD(to)}</span>}
                            </button>
                        </div>
                    )}
                    {(mode==='from'||mode==='to') && (
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <button onClick={() => setMode('presets')} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                                    <ChevronLeft className="w-3.5 h-3.5"/>Back
                                </button>
                                <span className="text-sm font-semibold text-gray-800">{mode==='from'?'Start Date':'End Date'}</span>
                                <div className="w-10"/>
                            </div>
                            <div className="flex gap-2 mb-4">
                                <button onClick={() => setMode('from')}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${mode==='from'?'bg-blue-600 text-white border-blue-600':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                    From: {fmtD(from)}
                                </button>
                                <button onClick={() => setMode('to')}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${mode==='to'?'bg-blue-600 text-white border-blue-600':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                    To: {fmtD(to)}
                                </button>
                            </div>
                            {mode==='from' && <MiniCalendar value={from} maxDate={to||todayStr} onChange={(v)=>{setFrom(v);if(!to)setMode('to');}}/>}
                            {mode==='to'   && <MiniCalendar value={to}   minDate={from} maxDate={todayStr} onChange={setTo}/>}
                            <button onClick={applyCustom} disabled={!from||!to}
                                className="mt-4 w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                Apply Range
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Print CSS ────────────────────────────────────────────────────────────────

const PRINT_CSS = `
@media print {
    @page { size: A4 portrait; margin: 18mm 15mm; }
    body > * { display: none !important; }
    #rpr, #rpr * { display: revert !important; }
    body { background:#fff !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    #rpr { display:block !important; font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#111; }
    .pb { page-break-before:always; }
    table { width:100%; border-collapse:collapse; margin-bottom:14px; }
    th,td { padding:6px 10px; border-bottom:1px solid #e5e7eb; text-align:left; font-size:11px; }
    th { font-weight:700; font-size:10px; text-transform:uppercase; color:#6b7280; background:#f9fafb; }
    tr:last-child td { border-bottom:none; }
    .ph { border-bottom:2px solid #1d4ed8; padding-bottom:12px; margin-bottom:20px; }
    .pt { font-size:22px; font-weight:800; color:#1e293b; margin:0; letter-spacing:-0.5px; }
    .pm { font-size:11px; color:#64748b; margin-top:4px; }
    .pd { display:inline-block; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:6px; padding:3px 10px; font-size:11px; font-weight:600; margin-top:6px; }
    .ps { font-size:13px; font-weight:700; color:#1e293b; margin:18px 0 8px; border-left:3px solid #1d4ed8; padding-left:8px; }
    .kg { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:18px; }
    .kc { border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; background:#f9fafb; }
    .kl { font-size:9px; text-transform:uppercase; letter-spacing:.5px; color:#9ca3af; margin-bottom:4px; }
    .kv { font-size:15px; font-weight:800; color:#1e293b; }
    .ks { font-size:9px; color:#6b7280; margin-top:2px; }
    .tc { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .tr { text-align:right !important; }
    .tg { color:#059669; }
    .tb { color:#1d4ed8; }
    .ta { color:#d97706; }
    .pf { margin-top:24px; padding-top:12px; border-top:1px solid #e5e7eb; font-size:10px; color:#9ca3af; display:flex; justify-content:space-between; }
}
`;

// ─── Print Region ─────────────────────────────────────────────────────────────

function PrintRegion({ dateLabel, generatedAt, salesData, topItems, paymentMethods, orderTypes,
    topPerformingItems, stockAlerts, totalRevenue, totalOrders, totalItemsSold,
    averageOrderValue, grossProfit, profitMargin, totalCOGS, costPercentage }) {

    const tl = { dine_in:'Dine In', takeout:'Takeout', delivery:'Delivery' };
    return (
        <div id="rpr" style={{display:'none'}}>
            <div className="ph">
                <p className="pt">Sales &amp; Analytics Report</p>
                <p className="pm">Generated on {generatedAt}</p>
                <span className="pd">📅 {dateLabel}</span>
            </div>

            <p className="ps">Key Performance Indicators</p>
            <div className="kg">
                <div className="kc"><div className="kl">Total Revenue</div><div className="kv tb">{formatPeso(totalRevenue)}</div></div>
                <div className="kc"><div className="kl">Gross Profit</div><div className="kv tg">{formatPeso(grossProfit)}</div><div className="ks">Margin {profitMargin}%</div></div>
                <div className="kc"><div className="kl">Total COGS</div><div className="kv ta">{formatPeso(totalCOGS)}</div><div className="ks">{costPercentage}% of revenue</div></div>
                <div className="kc"><div className="kl">Total Orders</div><div className="kv">{formatNumber(totalOrders)}</div><div className="ks">Avg {formatPeso(averageOrderValue)}</div></div>
                <div className="kc"><div className="kl">Items Sold</div><div className="kv">{formatNumber(totalItemsSold)}</div></div>
            </div>

            {salesData.length > 0 && (
                <>
                    <p className="ps">Daily Sales Breakdown</p>
                    <table>
                        <thead>
                            <tr><th>Date</th><th className="tr">Orders</th><th className="tr">Items Sold</th><th className="tr">Revenue</th></tr>
                        </thead>
                        <tbody>
                            {salesData.map((d,i)=>(
                                <tr key={i}><td>{d.date}</td><td className="tr">{d.orders}</td><td className="tr">{d.items_sold}</td><td className="tr">{formatPeso(d.revenue)}</td></tr>
                            ))}
                            <tr style={{fontWeight:700,background:'#eff6ff'}}>
                                <td>TOTAL</td><td className="tr">{formatNumber(totalOrders)}</td><td className="tr">{formatNumber(totalItemsSold)}</td><td className="tr">{formatPeso(totalRevenue)}</td>
                            </tr>
                        </tbody>
                    </table>
                </>
            )}

            <div className="tc">
                <div>
                    {topItems.length > 0 && (
                        <>
                            <p className="ps">Top Selling Items</p>
                            <table>
                                <thead><tr><th>#</th><th>Item</th><th className="tr">Qty</th><th className="tr">Revenue</th></tr></thead>
                                <tbody>{topItems.slice(0,10).map((item,i)=>(<tr key={i}><td>{i+1}</td><td>{item.item_name}</td><td className="tr">{formatNumber(item.quantity)}</td><td className="tr">{formatPeso(item.revenue)}</td></tr>))}</tbody>
                            </table>
                        </>
                    )}
                </div>
                <div>
                    {paymentMethods.length > 0 && (
                        <>
                            <p className="ps">Payment Methods</p>
                            <table>
                                <thead><tr><th>Method</th><th className="tr">Orders</th><th className="tr">Total</th></tr></thead>
                                <tbody>{paymentMethods.map((m,i)=>(<tr key={i}><td>{m.method}</td><td className="tr">{formatNumber(m.order_count)}</td><td className="tr">{formatPeso(m.total)}</td></tr>))}</tbody>
                            </table>
                        </>
                    )}
                    {orderTypes.length > 0 && (
                        <>
                            <p className="ps">Order Types</p>
                            <table>
                                <thead><tr><th>Type</th><th className="tr">Count</th><th className="tr">Total</th></tr></thead>
                                <tbody>{orderTypes.map((t,i)=>(<tr key={i}><td>{tl[t.order_type]||t.order_type}</td><td className="tr">{formatNumber(t.count)}</td><td className="tr">{formatPeso(t.total)}</td></tr>))}</tbody>
                            </table>
                        </>
                    )}
                </div>
            </div>

            {topPerformingItems.length > 0 && (
                <>
                    <p className="ps pb">Top Items by Profit</p>
                    <table>
                        <thead><tr><th>#</th><th>Item</th><th className="tr">Units</th><th className="tr">Revenue</th><th className="tr">Gross Profit</th><th className="tr">Margin</th></tr></thead>
                        <tbody>{topPerformingItems.map((item,i)=>(<tr key={i}><td>{i+1}</td><td>{item.item_name}</td><td className="tr">{formatNumber(item.units_sold)}</td><td className="tr">{formatPeso(item.total_revenue)}</td><td className="tr tg">{formatPeso(item.gross_profit)}</td><td className="tr">{item.profit_margin}%</td></tr>))}</tbody>
                    </table>
                </>
            )}

            {stockAlerts.length > 0 && (
                <>
                    <p className="ps">Stock Alerts</p>
                    <table>
                        <thead><tr><th>Ingredient</th><th className="tr">Current Qty</th><th className="tr">Min Stock</th><th>Unit</th></tr></thead>
                        <tbody>{stockAlerts.map((item,i)=>(<tr key={i}><td>{item.name}</td><td className="tr ta">{item.quantity}</td><td className="tr">{item.min_stock}</td><td>{item.unit}</td></tr>))}</tbody>
                    </table>
                </>
            )}

            <div className="pf">
                <span>Confidential — Internal Use Only</span>
                <span>Period: {dateLabel}</span>
                <span>Generated: {generatedAt}</span>
            </div>
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, className='' }) {
    return (
        <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden ${className}`}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
                <Icon className="w-4 h-4 text-gray-400"/>
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}
function StatCard({ label, value, sub, icon: Icon, bg, color }) {
    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className={`inline-flex p-2 rounded-xl mb-3 ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`}/>
            </div>
            <p className="text-xs uppercase tracking-wider mb-1 text-gray-400">{label}</p>
            <p className="text-xl font-bold tracking-tight leading-tight text-gray-900">{value}</p>
            <p className="text-xs mt-1 text-gray-400">{sub}</p>
        </div>
    );
}
function EmptyState({ icon: Icon, msg }) {
    return (
        <div className="text-center py-10">
            <Icon className="w-10 h-10 text-gray-200 mx-auto mb-2"/>
            <p className="text-sm text-gray-400">{msg}</p>
        </div>
    );
}
function SummaryRow({ label, value, valueClass='text-gray-900' }) {
    return (
        <div className="flex items-center justify-between text-sm py-1.5">
            <span className="text-gray-500">{label}</span>
            <span className={`font-semibold ${valueClass}`}>{value}</span>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Reports({
    auth,
    stats            = {},
    salesData        = [],
    topItems         = [],
    paymentMethods   = [],
    orderTypes       = [],
    metrics          = {},
    revenueVsCogsData= [],
    profitMarginTrend= [],
    topPerformingItems=[],
    inventoryValuation={},
    recentTransactions=[],
    salesRecords     = [],
    stockAlerts      = [],
    expensesData     = [],
    dashboardMetrics = {},
    filters          = {},
}) {
    const [dateRange,  setDateRange]  = useState(filters?.range || 'today');
    const [customFrom, setCustomFrom] = useState(filters?.from  || '');
    const [customTo,   setCustomTo  ] = useState(filters?.to    || '');
    const [isLoading,  setIsLoading ] = useState(false);
    const [chartMode,  setChartMode ] = useState('revenue');

    useEffect(() => {
        const el = document.createElement('style');
        el.id = 'rpr-css';
        el.textContent = PRINT_CSS;
        if (!document.getElementById('rpr-css')) document.head.appendChild(el);
        return () => { const e = document.getElementById('rpr-css'); if(e) e.remove(); };
    }, []);

    const nav = (params) => router.get('/admin/reports', params, {
        preserveState: true,
        onStart:  () => setIsLoading(true),
        onFinish: () => setIsLoading(false),
    });

    const handlePreset  = (range)       => { setDateRange(range); nav({ range }); };
    const handleCustom  = (from, to)    => { setDateRange('custom'); setCustomFrom(from); setCustomTo(to); nav({ range:'custom', from, to }); };
    const handleRefresh = ()            => router.reload({ only:['stats','salesData','topItems','paymentMethods','orderTypes','metrics','revenueVsCogsData','profitMarginTrend','topPerformingItems','stockAlerts'], onStart:()=>setIsLoading(true), onFinish:()=>setIsLoading(false) });
    const handlePrint   = ()            => window.print();

    // Derived
    const totalRevenue      = stats.totalRevenue    || 0;
    const totalOrders       = stats.totalOrders     || 0;
    const totalItemsSold    = stats.totalItemsSold  || 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const grossProfit       = metrics.gross_profit   || 0;
    const profitMargin      = metrics.profit_margin  || 0;
    const totalCOGS         = metrics.total_cogs     || 0;
    const costPercentage    = metrics.cost_percentage|| 0;

    const dateLabel   = buildDateLabel(dateRange, customFrom, customTo, filters?.start_date, filters?.end_date);
    const generatedAt = new Date().toLocaleDateString('en-PH', { month:'long', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const chartData  = revenueVsCogsData.map(d => ({ ...d, label: formatShortDate(d.date) }));
    const marginData = profitMarginTrend.map(d  => ({ ...d, label: formatShortDate(d.date) }));

    const typeLabels = { dine_in:'🍽️ Dine In', takeout:'🥡 Takeout', delivery:'🚚 Delivery' };

    return (
        <AdminLayout auth={auth}>
            <Head title="Reports"/>

            {/* Hidden print region */}
            <PrintRegion {...{dateLabel,generatedAt,salesData,topItems,paymentMethods,orderTypes,
                topPerformingItems,stockAlerts,totalRevenue,totalOrders,totalItemsSold,
                averageOrderValue,grossProfit,profitMargin,totalCOGS,costPercentage}}/>

            {/* Loading */}
            {isLoading && (
                <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-2xl text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mx-auto"/>
                        <p className="text-sm text-gray-600 mt-3">Loading reports…</p>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Reports &amp; Analytics</h1>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-semibold">
                                <Calendar className="w-3.5 h-3.5"/>{dateLabel}
                            </span>
                            <span className="text-xs text-gray-400">Generated {generatedAt}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <DateRangePicker value={dateRange} customFrom={customFrom} customTo={customTo} onSelect={handlePreset} onCustomApply={handleCustom}/>
                        <button onClick={handleRefresh} className="p-2 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors shadow-sm" title="Refresh">
                            <RefreshCw className="w-4 h-4 text-gray-500"/>
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm font-medium shadow-sm">
                            <Printer className="w-4 h-4"/> Print / Export
                        </button>
                    </div>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
                <StatCard label="Total Revenue"  value={formatPeso(totalRevenue)}        sub={dateLabel}                          icon={DollarSign} bg="bg-blue-50"    color="text-blue-600"/>
                <StatCard label="Gross Profit"   value={formatPeso(grossProfit)}          sub={`Margin ${profitMargin}%`}          icon={TrendingUp} bg="bg-emerald-50" color="text-emerald-600"/>
                <StatCard label="Total COGS"     value={formatPeso(totalCOGS)}            sub={`${costPercentage}% of revenue`}    icon={Package}    bg="bg-amber-50"   color="text-amber-600" />
                <StatCard label="Total Orders"   value={formatNumber(totalOrders)}        sub={`Avg ${formatPeso(averageOrderValue)}`} icon={ShoppingBag} bg="bg-purple-50" color="text-purple-600"/>
                <StatCard label="Items Sold"     value={formatNumber(totalItemsSold)}     sub={dateLabel}                          icon={Package}    bg="bg-rose-50"    color="text-rose-600"  />
            </div>

            {/* ── Charts + Summary ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900">
                                {chartMode==='revenue' ? 'Revenue vs COGS vs Profit' : 'Profit Margin Trend'}
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">{dateLabel}</p>
                        </div>
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                            {[['revenue','Revenue'],['margin','Margin %']].map(([v,l])=>(
                                <button key={v} onClick={()=>setChartMode(v)}
                                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${chartMode===v?'bg-white shadow-sm text-blue-600':'text-gray-500 hover:text-gray-700'}`}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="p-5">
                        {chartMode==='revenue' && chartData.length>0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={chartData} margin={{top:4,right:4,bottom:0,left:0}}>
                                    <defs>
                                        {[['rv','#3b82f6'],['cg','#f59e0b'],['pf','#10b981']].map(([id,c])=>(
                                            <linearGradient key={id} id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={c} stopOpacity={0.12}/>
                                                <stop offset="95%" stopColor={c} stopOpacity={0}/>
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                                    <XAxis dataKey="label" tick={{fontSize:11,fill:'#94a3b8'}} tickLine={false} axisLine={false}/>
                                    <YAxis tick={{fontSize:11,fill:'#94a3b8'}} tickLine={false} axisLine={false} width={58} tickFormatter={v=>`₱${v>=1000?`${(v/1000).toFixed(0)}k`:v}`}/>
                                    <Tooltip content={<PesoTooltip/>}/>
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12,paddingTop:12}}/>
                                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#grv)" dot={false} activeDot={{r:4,strokeWidth:0}}/>
                                    <Area type="monotone" dataKey="cogs"    name="COGS"    stroke="#f59e0b" strokeWidth={2} fill="url(#gcg)" dot={false} activeDot={{r:4,strokeWidth:0}}/>
                                    <Area type="monotone" dataKey="profit"  name="Profit"  stroke="#10b981" strokeWidth={2} fill="url(#gpf)" dot={false} activeDot={{r:4,strokeWidth:0}}/>
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : chartMode==='margin' && marginData.length>0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={marginData} margin={{top:4,right:4,bottom:0,left:0}}>
                                    <defs>
                                        <linearGradient id="gmg" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.12}/>
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                                    <XAxis dataKey="label" tick={{fontSize:11,fill:'#94a3b8'}} tickLine={false} axisLine={false}/>
                                    <YAxis tick={{fontSize:11,fill:'#94a3b8'}} tickLine={false} axisLine={false} width={40} tickFormatter={v=>`${v}%`} domain={[0,100]}/>
                                    <Tooltip content={<PctTooltip/>}/>
                                    <Area type="monotone" dataKey="margin" name="Profit Margin" stroke="#8b5cf6" strokeWidth={2} fill="url(#gmg)" dot={false} activeDot={{r:4,strokeWidth:0}}/>
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState icon={BarChart3} msg="No chart data for this period"/>
                        )}
                    </div>
                </div>

                {/* Period summary */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Period Summary</h3>
                    <p className="text-xs text-gray-400 mb-4">{dateLabel}</p>
                    <div className="divide-y divide-gray-50">
                        <SummaryRow label="Total Revenue"    value={formatPeso(totalRevenue)}       valueClass="text-blue-600"/>
                        <SummaryRow label="Gross Profit"     value={formatPeso(grossProfit)}         valueClass="text-emerald-600"/>
                        <SummaryRow label="Total COGS"       value={formatPeso(totalCOGS)}           valueClass="text-amber-600"/>
                        <SummaryRow label="Profit Margin"    value={`${profitMargin}%`}              />
                        <SummaryRow label="Cost %"           value={`${costPercentage}%`}            />
                        <SummaryRow label="Total Orders"     value={formatNumber(totalOrders)}       />
                        <SummaryRow label="Items Sold"       value={formatNumber(totalItemsSold)}    />
                        <SummaryRow label="Avg Order Value"  value={formatPeso(averageOrderValue)}   />
                    </div>

                    {stockAlerts.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-1.5 mb-3">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500"/>
                                <span className="text-xs font-semibold text-gray-700">Stock Alerts</span>
                                <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{stockAlerts.length}</span>
                            </div>
                            {stockAlerts.slice(0,4).map((item,i)=>(
                                <div key={i} className="flex items-center justify-between py-1.5 text-xs border-b border-gray-50 last:border-0">
                                    <div>
                                        <p className="font-medium text-gray-800">{item.name}</p>
                                        <p className="text-gray-400">{item.quantity} {item.unit} remaining</p>
                                    </div>
                                    <span className="text-amber-600 font-medium">Min {item.min_stock}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── StoreHub-Style Report Dashboard ── */}
            {dashboardMetrics?.rows?.length > 0 && (
                <SectionCard title="Report Dashboard" icon={BarChart3} className="mb-5">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-left font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    <th className="pb-3 pr-3 whitespace-nowrap">Date / Time</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Total Sales</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Transactions</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Discount</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Disc %</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Tax</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Rounding</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Shipping</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Svc Charge</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Gross Profit</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">GP %</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Returned</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Net Sales</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Avg Net Sales</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">New Cust.</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Pax</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {dashboardMetrics.rows.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-2.5 pr-3 text-gray-700 font-medium whitespace-nowrap">
                                            {new Date(row.date + 'T00:00:00').toLocaleDateString('en-PH', { weekday:'short', month:'short', day:'numeric', year:'numeric' })}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-semibold text-blue-700">{formatPeso(row.total_sales)}</td>
                                        <td className="py-2.5 px-2 text-right text-gray-700">{formatNumber(row.total_transactions)}</td>
                                        <td className="py-2.5 px-2 text-right text-gray-600">{formatPeso(row.total_discount)}</td>
                                        <td className="py-2.5 px-2 text-right text-gray-500">{row.discount_pct}%</td>
                                        <td className="py-2.5 px-2 text-right text-gray-600">{formatPeso(row.tax)}</td>
                                        <td className="py-2.5 px-2 text-right text-gray-500">{formatPeso(row.total_rounding)}</td>
                                        <td className="py-2.5 px-2 text-right text-gray-500">{formatPeso(row.shipping_fee)}</td>
                                        <td className="py-2.5 px-2 text-right text-gray-500">{formatPeso(row.service_charge)}</td>
                                        <td className="py-2.5 px-2 text-right font-semibold text-emerald-700">{formatPeso(row.gross_profit)}</td>
                                        <td className="py-2.5 px-2 text-right">
                                            <span className={`font-semibold ${row.gross_profit_pct >= 50 ? 'text-emerald-600' : row.gross_profit_pct >= 25 ? 'text-amber-600' : 'text-red-500'}`}>{row.gross_profit_pct}%</span>
                                        </td>
                                        <td className="py-2.5 px-2 text-right text-red-500">{formatPeso(row.total_sales_returned)}</td>
                                        <td className="py-2.5 px-2 text-right font-semibold text-gray-900">{formatPeso(row.net_sales)}</td>
                                        <td className="py-2.5 px-2 text-right text-gray-600">{formatPeso(row.average_net_sales)}</td>
                                        <td className="py-2.5 px-2 text-right text-purple-600">{formatNumber(row.new_customers)}</td>
                                        <td className="py-2.5 px-2 text-right text-gray-600">{formatNumber(row.pax)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {dashboardMetrics.total && (
                                <tfoot>
                                    <tr className="border-t-2 border-gray-200 bg-blue-50 font-bold text-xs">
                                        <td className="pt-3 pb-2 pr-3 text-gray-900">TOTAL</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-blue-700">{formatPeso(dashboardMetrics.total.total_sales)}</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-gray-800">{formatNumber(dashboardMetrics.total.total_transactions)}</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-gray-700">{formatPeso(dashboardMetrics.total.total_discount)}</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-gray-600">{dashboardMetrics.total.discount_pct}%</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-gray-700">{formatPeso(dashboardMetrics.total.tax)}</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-gray-600">{formatPeso(dashboardMetrics.total.total_rounding)}</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-gray-600">{formatPeso(dashboardMetrics.total.shipping_fee)}</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-gray-600">{formatPeso(dashboardMetrics.total.service_charge)}</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-emerald-700">{formatPeso(dashboardMetrics.total.gross_profit)}</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-emerald-600">{dashboardMetrics.total.gross_profit_pct}%</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-red-500">{formatPeso(dashboardMetrics.total.total_sales_returned)}</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-gray-900">{formatPeso(dashboardMetrics.total.net_sales)}</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-gray-700">{formatPeso(dashboardMetrics.total.average_net_sales)}</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-purple-600">{formatNumber(dashboardMetrics.total.new_customers)}</td>
                                        <td className="pt-3 pb-2 px-2 text-right text-gray-700">{formatNumber(dashboardMetrics.total.pax)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* ── Daily Sales Table ── */}
            <SectionCard title="Daily Sales Breakdown" icon={BarChart3} className="mb-5">
                {salesData.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    <th className="pb-3">Date</th>
                                    <th className="pb-3 text-right">Orders</th>
                                    <th className="pb-3 text-right">Items Sold</th>
                                    <th className="pb-3 text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {salesData.map((d,i)=>(
                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3 text-sm text-gray-700 font-medium">{d.date}</td>
                                        <td className="py-3 text-sm text-gray-600 text-right">{d.orders}</td>
                                        <td className="py-3 text-sm text-gray-600 text-right">{d.items_sold}</td>
                                        <td className="py-3 text-sm font-semibold text-gray-900 text-right">{formatPeso(d.revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-200 bg-gray-50">
                                    <td className="pt-3 pb-1 px-1 text-sm font-bold text-gray-900">Total</td>
                                    <td className="pt-3 pb-1 text-sm font-bold text-gray-900 text-right">{formatNumber(totalOrders)}</td>
                                    <td className="pt-3 pb-1 text-sm font-bold text-gray-900 text-right">{formatNumber(totalItemsSold)}</td>
                                    <td className="pt-3 pb-1 text-sm font-bold text-blue-600 text-right">{formatPeso(totalRevenue)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ) : <EmptyState icon={BarChart3} msg="No sales data for this period"/>}
            </SectionCard>

            {/* ── 3-col row: Items / Payments / Order Types ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
                <SectionCard title="Top Selling Items" icon={Package}>
                    {topItems.length > 0 ? (
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    <th className="pb-3 text-left">#</th>
                                    <th className="pb-3 text-left">Item</th>
                                    <th className="pb-3 text-right">Qty</th>
                                    <th className="pb-3 text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {topItems.slice(0,8).map((item,i)=>(
                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-2.5 text-xs text-gray-400 font-medium">{i+1}</td>
                                        <td className="py-2.5 text-sm font-medium text-gray-800 pr-2">{item.item_name}</td>
                                        <td className="py-2.5 text-sm text-gray-600 text-right">{formatNumber(item.quantity)}</td>
                                        <td className="py-2.5 text-sm font-semibold text-gray-900 text-right">{formatPeso(item.revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <EmptyState icon={Package} msg="No items data"/>}
                </SectionCard>

                <SectionCard title="Payment Methods" icon={CreditCard}>
                    {paymentMethods.length > 0 ? (
                        <div className="space-y-3">
                            {paymentMethods.map((m,i)=>{
                                const pct = totalRevenue>0?((m.total/totalRevenue)*100).toFixed(1):0;
                                return (
                                    <div key={i}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-800">{m.method}</span>
                                            <span className="text-sm font-semibold text-gray-900">{formatPeso(m.total)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{width:`${pct}%`}}/>
                                            </div>
                                            <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">{formatNumber(m.order_count)} orders</p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <EmptyState icon={CreditCard} msg="No payment data"/>}
                </SectionCard>

                <SectionCard title="Order Types" icon={ShoppingBag}>
                    {orderTypes.length > 0 ? (
                        <div className="space-y-3">
                            {orderTypes.map((t,i)=>{
                                const pct = totalOrders>0?((t.count/totalOrders)*100).toFixed(1):0;
                                const colors = ['bg-emerald-500','bg-blue-500','bg-purple-500'];
                                return (
                                    <div key={i}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-800">{typeLabels[t.order_type]||t.order_type}</span>
                                            <span className="text-sm font-semibold text-gray-900">{formatPeso(t.total)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className={`h-full ${colors[i%colors.length]} rounded-full`} style={{width:`${pct}%`}}/>
                                            </div>
                                            <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">{formatNumber(t.count)} orders</p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <EmptyState icon={ShoppingBag} msg="No order type data"/>}
                </SectionCard>
            </div>

            {/* ── Top Items by Profit ── */}
            {topPerformingItems.length > 0 && (
                <SectionCard title="Top Items by Profit" icon={TrendingUp}>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    <th className="pb-3 text-left">#</th>
                                    <th className="pb-3 text-left">Item</th>
                                    <th className="pb-3 text-right">Units Sold</th>
                                    <th className="pb-3 text-right">Revenue</th>
                                    <th className="pb-3 text-right">Gross Profit</th>
                                    <th className="pb-3 text-right">Margin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {topPerformingItems.map((item,i)=>(
                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3 text-xs text-gray-400 font-medium">{i+1}</td>
                                        <td className="py-3 text-sm font-medium text-gray-900">{item.item_name}</td>
                                        <td className="py-3 text-sm text-gray-600 text-right">{formatNumber(item.units_sold)}</td>
                                        <td className="py-3 text-sm text-gray-700 text-right">{formatPeso(item.total_revenue)}</td>
                                        <td className="py-3 text-sm font-semibold text-emerald-600 text-right">{formatPeso(item.gross_profit)}</td>
                                        <td className="py-3 text-right">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${item.profit_margin>=50?'bg-emerald-50 text-emerald-700':item.profit_margin>=25?'bg-amber-50 text-amber-700':'bg-red-50 text-red-600'}`}>
                                                {item.profit_margin}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}
        </AdminLayout>
    );
}