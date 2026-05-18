import React, { useRef } from 'react';
import { formatPHDateTime } from '@/utils/phTime';

const formatPrice = (price) => {
    const num = Number(price) || 0;
    return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// PH VAT-inclusive computation with detailed breakdown.
// Prices are VAT-inclusive, so we EXTRACT the VAT rather than add on top.
//   VAT-exclusive base = totalDue / (1 + rate/100)
//   VAT amount         = totalDue - VAT-exclusive base
const computeVAT = (subtotal, discount = 0, serviceCharge = 0, taxRate = 12, vatExemptSales = 0, zeroRatedSales = 0) => {
    const totalDue = subtotal - discount + serviceCharge;
    const rate = Number(taxRate) || 0;

    if (rate <= 0) {
        return {
            totalDue,
            vatExBase: totalDue,
            vatableSales: totalDue,
            vatAmount: 0,
            vatExemptSales: 0,
            zeroRatedSales: 0,
        };
    }

    // VAT-inclusive vatable portion (total minus exempt and zero-rated)
    const vatableInclusive = totalDue - vatExemptSales - zeroRatedSales;
    const divisor   = 1 + rate / 100;                        // e.g. 1.12
    const vatExBase = vatableInclusive / divisor;             // VAT-exclusive base
    const vatAmount = vatableInclusive - vatExBase;           // extracted VAT

    return {
        totalDue,
        vatExBase,          // VAT-exclusive base (shown as "VATable Sales" on BIR receipts)
        vatableSales: vatExBase,
        vatAmount,
        vatExemptSales,
        zeroRatedSales,
    };
};

export default function ReceiptPrint({ receipt, onClose }) {
    const printRef = useRef(null);

    const subtotal = Number(
        receipt.subtotal ?? (receipt.items || []).reduce((sum, item) => sum + item.subtotal, 0)
    );
    const discount = Number(receipt.discount_amount ?? receipt.discount ?? 0);
    const serviceCharge = Number(receipt.service_charge_amount ?? receipt.service_charge ?? 0);
    const rawTaxRate = Number(receipt.tax_rate ?? 12);
    const taxRate = Number.isFinite(rawTaxRate) ? rawTaxRate : 12;
    
    // Get VAT breakdown values from receipt or calculate defaults
    const vatExemptSales = Number(receipt.vat_exempt_sales ?? 0);
    const zeroRatedSales = Number(receipt.zero_rated_sales ?? 0);
    
    const { totalDue, vatExBase, vatableSales, vatAmount } = computeVAT(
        subtotal, 
        discount, 
        serviceCharge, 
        taxRate,
        vatExemptSales,
        zeroRatedSales
    );

    const cashReceived = receipt.cash_received !== null && receipt.cash_received !== undefined
        ? Number(receipt.cash_received)
        : null;
    const changeDue = receipt.change_due !== null && receipt.change_due !== undefined
        ? Number(receipt.change_due)
        : (cashReceived !== null ? Math.max(0, cashReceived - totalDue) : null);

    const showTax = receipt.show_tax === undefined || receipt.show_tax === null
        ? true
        : !(receipt.show_tax === false || receipt.show_tax === 0 || receipt.show_tax === '0');
    
    const showServiceCharge = serviceCharge > 0 && (
        receipt.show_service_charge === undefined || receipt.show_service_charge === null
            ? true
            : !(receipt.show_service_charge === false || receipt.show_service_charge === 0 || receipt.show_service_charge === '0')
    );

    const rawServiceChargeRate = Number(receipt.service_charge_rate ?? 0);
    const serviceChargeRate = Number.isFinite(rawServiceChargeRate) ? rawServiceChargeRate : 0;

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        if (!content) return;

        const printWindow = window.open('', '_blank', 'width=400,height=700');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt - ${receipt.order_number}</title>
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
                    .center  { text-align: center; }
                    .bold    { font-weight: bold; }
                    .large   { font-size: 15px; }
                    .small   { font-size: 11px; color: #333; }
                    .muted   { font-size: 11px; color: #555; }
                    .divider { border-top: 1px dashed #000; margin: 6px 0; }
                    .solid   { border-top: 2px solid #000; margin: 6px 0; }
                    .row     { display: flex; justify-content: space-between; margin: 2px 0; }
                    .total-row { font-size: 14px; font-weight: bold; padding: 3px 0; }
                    .footer  { text-align: center; margin-top: 4px; font-size: 11px; }
                    .indent-1 { padding-left: 12px; }
                    .indent-2 { padding-left: 24px; }
                    @media print { body { width: 100%; } }
                </style>
            </head>
            <body>${content}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
        onClose();
    };

    // Shared receipt body — rendered once for print, once for preview
    const ReceiptBody = ({ forPrint = false }) => {
        const cx = (...classes) => classes.filter(Boolean).join(' ');
        const Row = ({ label, value, bold, small, indent, className = '' }) => (
            <div className={cx('flex justify-between', bold && 'font-bold', small && 'text-gray-500 text-[11px]', forPrint ? 'row' : '', className)}
                 style={forPrint ? undefined : { marginBottom: 1 }}>
                <span className={indent ? `indent-${indent}` : ''}>{label}</span>
                <span>{value}</span>
            </div>
        );
        
        const businessName = receipt.business_name ?? 'CJ BREW & DINE';
        const businessTagline = receipt.business_tagline ?? 'Restobar System';
        const businessAddress = receipt.business_address ?? receipt.address ?? '';
        const receiptHeader = receipt.receipt_header ?? 'THANK YOU FOR DINING!';
        const receiptFooter = receipt.receipt_footer ?? 'Please come again';
        const customerName = (receipt.customer_name || '').trim() || 'Walk-in Customer';
        const cashierName = (receipt.cashier_name || '').trim() || '—';
        const serviceChargeLabel = serviceChargeRate > 0
            ? `SERVICE CHARGE (${serviceChargeRate}%)`
            : 'SERVICE CHARGE';
        const vatLabel = `VAT (${taxRate}%)`;
        const items = receipt.items || [];

        return (
            <>
                {/* Header */}
                <div className={cx('text-center font-bold', forPrint ? 'large' : 'text-sm')}>{businessName}</div>
                {businessTagline && <div className="text-center text-[11px]">{businessTagline}</div>}
                {businessAddress && <div className="text-center text-[11px]">{businessAddress}</div>}
                <div className="text-center text-gray-400 text-[11px]">{formatPHDateTime(receipt.created_at)}</div>

                <div className={cx(forPrint ? 'divider' : 'border-t border-dashed border-gray-300 my-2')} />

                {/* Cancelled banner */}
                {receipt.status === 'cancelled' && (
                    <div style={forPrint ? { textAlign: 'center', fontWeight: 'bold', fontSize: 15, margin: '6px 0', color: '#000', borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '4px 0' } : undefined}
                         className={!forPrint ? 'text-center font-bold text-base my-2 py-1 border-y-2 border-black' : ''}>
                        *** VOID / CANCELLED ***
                    </div>
                )}

                <Row label="Order #:"   value={receipt.order_number} bold />
                {receipt.txn_number && <Row label="TXN #:" value={receipt.txn_number} bold />}
                <Row label="Cashier:"   value={cashierName} />
                <Row label="Customer:"  value={customerName} />
                {receipt.room_number && <Row label="Room:" value={receipt.room_number} />}
                <Row label="Payment:"   value={receipt.payment_method || 'Cash'} />

                <div className={cx(forPrint ? 'divider' : 'border-t border-dashed border-gray-300 my-2')} />

                {/* Items */}
                <div className="font-bold mb-1">ITEMS</div>
                {items.map((item, i) => (
                    <div key={i} className="mb-1">
                        <div>{item.name}</div>
                        <div className={cx('flex justify-between', forPrint ? 'small' : 'text-gray-500 text-[11px]')}>
                            <span>{item.quantity} x ₱{formatPrice(item.price)}</span>
                            <span>₱{formatPrice(item.subtotal)}</span>
                        </div>
                    </div>
                ))}

                <div className={cx(forPrint ? 'divider' : 'border-t border-dashed border-gray-300 my-2')} />

                {/* Subtotals */}
                <Row label="SUBTOTAL" value={`₱${formatPrice(showTax ? vatExBase : subtotal)}`} />
                {discount > 0 && <Row label="DISCOUNT" value={`-₱${formatPrice(discount)}`} />}
                {showServiceCharge && (
                    <Row label={serviceChargeLabel} value={`₱${formatPrice(serviceCharge)}`} />
                )}

                {/* Detailed VAT Breakdown */}
                {showTax && (
                    <>
                        <Row label="VATable Sales:" value={`₱${formatPrice(vatableSales)}`} />
                        <Row label={`VAT Amount (${taxRate}%):`} value={`₱${formatPrice(vatAmount)}`} />
                        <Row
                            label="VAT-Exempt Sales:"
                            value={`₱${formatPrice(vatExemptSales)}`}
                            small
                            indent="1"
                        />
                        <Row
                            label="Zero-Rated Sales:"
                            value={`₱${formatPrice(zeroRatedSales)}`}
                            small
                            indent="1"
                        />
                    </>
                )}

                <div className={cx(forPrint ? 'solid' : 'border-t-2 border-gray-800 my-1')} />
                <Row label="TOTAL" value={`₱${formatPrice(totalDue)}`} bold />
                <div className={cx(forPrint ? 'solid' : 'border-t-2 border-gray-800 my-1')} />

                {/* Cash */}
                {cashReceived !== null && (
                    <>
                        <Row label="CASH RECEIVED" value={`₱${formatPrice(cashReceived)}`} />
                        <Row label="CHANGE DUE" value={`₱${formatPrice(changeDue ?? 0)}`} />
                    </>
                )}

                <div className={cx(forPrint ? 'divider' : 'border-t border-dashed border-gray-300 my-2')} />

                {/* Footer */}
                <div className="text-center font-bold">{receiptHeader}</div>
                <div className="text-center text-[11px]">{receiptFooter}</div>
                <div className="text-center text-[11px] mt-1">This serves as your</div>
                <div className="text-center font-bold text-[12px]"
                     style={forPrint && receipt.status === 'cancelled' ? { textAlign: 'center', fontWeight: 'bold' } : undefined}>
                    {receipt.status === 'cancelled' ? 'CANCELLATION RECEIPT' : 'OFFICIAL RECEIPT'}
                </div>
            </>
        );
    };

    return (
        <>
            {/* Hidden print-ready markup */}
            <div ref={printRef} style={{ display: 'none' }}>
                <ReceiptBody forPrint />
            </div>

            {/* On-screen modal preview */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-900">Receipt Preview</h2>
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
                            🖨 Print Receipt
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-sm text-gray-600 transition-colors"
                        >
                            Skip
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
