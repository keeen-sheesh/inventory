import React, { useRef } from 'react';
import { formatPHDateTime } from '@/utils/phTime';

const formatPeso = (amount) => {
    const num = Number(amount || 0);
    return `P${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function ShiftReceiptPrint({ receipt, onClose }) {
    const printRef = useRef(null);

    if (!receipt) return null;

    // Read CSRF from meta tag, falling back to the XSRF-TOKEN cookie.
    const getCsrf = () => {
        const meta = document.querySelector('meta[name="csrf-token"]')?.content;
        if (meta) return meta;
        const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    const handleLogout = async () => {
        try {
            await fetch('/logout', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrf(),
                    'Accept': 'application/json',
                },
            });
        } catch {
            // no-op: fallback redirect below
        } finally {
            window.location.href = '/';
        }
    };

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        if (!content) return;

        const printWindow = window.open('', '_blank', 'width=420,height=720');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Shift Receipt - ${receipt.shift_id}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 12px;
                        color: #000;
                        width: 300px;
                        margin: 0 auto;
                        padding: 10px;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .divider { border-top: 1px dashed #000; margin: 8px 0; }
                    .row { display: flex; justify-content: space-between; margin: 2px 0; }
                    .total { font-size: 14px; font-weight: bold; }
                </style>
            </head>
            <body>${content}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
        onClose?.();
    };

    const ReceiptBody = ({ forPrint = false }) => {
        const cx = (...classes) => classes.filter(Boolean).join(' ');
        const Row = ({ label, value, total }) => (
            <div className={cx(forPrint ? 'row' : 'flex justify-between', total && 'font-bold text-sm')}>
                <span className={total ? 'font-bold' : ''}>{label}</span>
                <span className={total ? 'font-bold' : ''}>{value}</span>
            </div>
        );

        return (
            <>
                <div className={cx('text-center font-bold', forPrint ? '' : 'text-sm')}>CJ BREW &amp; DINE</div>
                <div className="text-center text-[11px]">SHIFT SUMMARY RECEIPT</div>
                <div className="text-center text-[11px]">
                    Cashier: {receipt.cashier_name || '—'}
                </div>
                <div className={forPrint ? 'divider' : 'border-t border-dashed border-gray-300 my-2'} />

                <Row label="Cashier:" value={`${receipt.cashier_name || '—'} (#${receipt.cashier_id ?? '—'})`} />
                <Row label="Shift ID:" value={receipt.shift_id ?? '—'} />
                <Row label="Start:" value={formatPHDateTime(receipt.shift_start)} />
                <Row label="End:" value={formatPHDateTime(receipt.shift_end)} />

                <div className={forPrint ? 'divider' : 'border-t border-dashed border-gray-300 my-2'} />

                <Row label="Starting Balance" value={formatPeso(receipt.starting_balance)} />
                <Row label="Total Sales" value={formatPeso(receipt.total_sales)} />
                <Row label="Total Expenses" value={formatPeso(receipt.total_expenses)} />

                <div className={forPrint ? 'divider' : 'border-t border-dashed border-gray-300 my-2'} />

                <Row label="Ending Balance" value={formatPeso(receipt.ending_balance)} total />
            </>
        );
    };

    return (
        <>
            <div ref={printRef} style={{ display: 'none' }}>
                <ReceiptBody forPrint />
            </div>

            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:hidden">
                <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-900">Shift Receipt</h2>
                        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">✕</button>
                    </div>

                    <div className="p-5 font-mono text-xs text-gray-800 space-y-0.5 max-h-[70vh] overflow-y-auto">
                        <ReceiptBody />
                    </div>

                    <div className="flex gap-2 px-5 pb-5">
                        <button
                            onClick={handlePrint}
                            className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-xl text-sm transition-colors"
                        >
                            Print
                        </button>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-sm text-gray-600 transition-colors"
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
