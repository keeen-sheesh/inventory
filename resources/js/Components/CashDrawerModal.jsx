import React, { useState } from 'react';
import { DollarSign, LogOut, AlertTriangle, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Read CSRF from meta tag, falling back to the XSRF-TOKEN cookie Laravel always sets
const getCsrf = () => {
    const meta = document.querySelector('meta[name="csrf-token"]')?.content;
    if (meta) return meta;
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
};

// ─── Step 1: Opening float ───────────────────────────────────────────────────
function OpenShiftModal({ onOpen, loading }) {
    const [float, setFloat] = useState('');

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
            <div className="bg-white rounded-2xl shadow-2xl w-96 overflow-hidden">
                <div className="bg-yellow-500 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <DollarSign className="w-7 h-7 text-white" />
                        <div>
                            <h2 className="text-white font-bold text-lg">Start Your Shift</h2>
                            <p className="text-yellow-100 text-sm">Enter the opening cash in the register</p>
                        </div>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Opening Float (₱)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={float}
                            onChange={e => setFloat(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && float && onOpen(float)}
                            placeholder="0.00"
                            autoFocus
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                        <p className="text-xs text-gray-400 mt-1">Enter 0 if the register starts empty.</p>
                    </div>
                    <button
                        onClick={() => onOpen(float || '0')}
                        disabled={loading}
                        className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                    >
                        {loading ? 'Opening…' : 'Open Register & Start Shift'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Step 2: Close shift / count drawer ──────────────────────────────────────
function CloseShiftModal({ session, onClose, onCancel, loading, csrfToken }) {
    const [actual, setActual] = useState('');
    const [result, setResult] = useState(null); // { can_logout, discrepancy, expected, actual, message }
    const [managerEmail, setManagerEmail] = useState('');
    const [managerPw, setManagerPw] = useState('');
    const [reason, setReason] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [overriding, setOverriding] = useState(false);
    const [overrideLoading, setOverrideLoading] = useState(false);
    const [overrideError, setOverrideError] = useState('');

    const handleCount = async () => {
        const res = await onClose(actual);
        setResult(res);
    };

    const handleLogout = async () => {
        try {
            await fetch('/logout', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken || getCsrf(),
                    'Accept': 'application/json',
                },
            });
        } catch {
            // no-op: fallback redirect below
        } finally {
            window.location.href = '/';
        }
    };

    const handleOverride = async () => {
        if (!managerEmail || !managerPw) return;
        setOverrideLoading(true);
        setOverrideError('');
        try {
            const response = await fetch('/cashier/cash-session/override', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || getCsrf(),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    manager_email: managerEmail,
                    manager_password: managerPw,
                    override_reason: reason,
                }),
            });
            const data = await response.json();
            if (data.success) {
                // Proceed to logout
                await handleLogout();
            } else {
                const fallback = data?.errors ? Object.values(data.errors)[0]?.[0] : null;
                setOverrideError(data.error || data.message || fallback || 'Invalid manager credentials.');
            }
        } catch {
            setOverrideError('Network error. Try again.');
        } finally {
            setOverrideLoading(false);
        }
    };

    const discrepancyColor = result
        ? result.discrepancy === 0 ? 'text-green-600'
        : result.discrepancy > 0 ? 'text-blue-600'
        : 'text-red-600'
        : '';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
            <div className="bg-white rounded-2xl shadow-2xl w-[420px] overflow-hidden">
                <div className="bg-gray-800 px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <LogOut className="w-6 h-6 text-white" />
                        <div>
                            <h2 className="text-white font-bold text-lg">End of Shift</h2>
                            <p className="text-gray-300 text-sm">Count the cash in the register</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Session info */}
                    <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Opening Float</span>
                            <span className="font-mono font-medium">₱{fmt(session?.opening_float)}</span>
                        </div>
                    </div>

                    {!result ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Actual Cash in Drawer (₱)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={actual}
                                    onChange={e => setActual(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && actual !== '' && handleCount()}
                                    placeholder="Count and enter total cash"
                                    autoFocus
                                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-gray-400"
                                />
                            </div>
                            <button
                                onClick={handleCount}
                                disabled={loading || actual === ''}
                                className="w-full py-3 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                            >
                                {loading ? 'Checking…' : 'Submit Drawer Count'}
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Result breakdown */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Expected Cash</span>
                                    <span className="font-mono font-medium">₱{fmt(result.expected)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Actual Counted</span>
                                    <span className="font-mono font-medium">₱{fmt(result.actual)}</span>
                                </div>
                                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                                    <span>Discrepancy</span>
                                    <span className={`font-mono ${discrepancyColor}`}>
                                        {result.discrepancy >= 0 ? '+' : ''}₱{fmt(result.discrepancy)}
                                    </span>
                                </div>
                            </div>

                            {result.can_logout ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
                                        <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                                        <p className="text-green-700 text-sm font-medium">{result.message}</p>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Log Out
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                        <p className="text-red-700 text-sm font-medium">{result.message}</p>
                                    </div>

                                    {!overriding ? (
                                        <button
                                            onClick={() => setOverriding(true)}
                                            className="w-full py-2.5 border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Lock className="w-4 h-4" />
                                            Request Manager Override
                                        </button>
                                    ) : (
                                        <div className="border-2 border-orange-200 rounded-xl p-4 space-y-3 bg-orange-50">
                                            <p className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                                                <Lock className="w-4 h-4" /> Manager Password Required
                                            </p>
                                            <input
                                                type="email"
                                                value={managerEmail}
                                                onChange={e => setManagerEmail(e.target.value)}
                                                placeholder="Manager email"
                                                className="w-full border border-orange-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            />
                                            <div className="relative">
                                                <input
                                                    type={showPw ? 'text' : 'password'}
                                                    value={managerPw}
                                                    onChange={e => setManagerPw(e.target.value)}
                                                    placeholder="Enter manager password"
                                                    className="w-full border border-orange-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                                />
                                                <button
                                                    onClick={() => setShowPw(!showPw)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                                                >
                                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={reason}
                                                onChange={e => setReason(e.target.value)}
                                                placeholder="Reason (optional)"
                                                className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            />
                                            {overrideError && (
                                                <p className="text-red-600 text-xs font-medium">{overrideError}</p>
                                            )}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setOverriding(false); setManagerEmail(''); setManagerPw(''); setOverrideError(''); }}
                                                    className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleOverride}
                                                    disabled={!managerEmail || !managerPw || overrideLoading}
                                                    className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-colors"
                                                >
                                                    {overrideLoading ? 'Verifying…' : 'Approve Override'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function CashDrawerModal({ mode, session, onOpen, onClose, onCancel, loading, csrfToken }) {
    if (mode === 'open') {
        return <OpenShiftModal onOpen={onOpen} loading={loading} />;
    }
    if (mode === 'close') {
        return <CloseShiftModal session={session} onClose={onClose} onCancel={onCancel} loading={loading} csrfToken={csrfToken} />;
    }
    return null;
}
