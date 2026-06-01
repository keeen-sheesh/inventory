import React, { useEffect } from 'react';
import { formatPHDateTime } from '@/utils/phTime';

const formatPrice = (price) => {
    const num = Number(price) || 0;
    return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function ReceiptPrint({ receipt, onClose }) {
    const subtotal = Number(receipt.subtotal ?? 0);
    const discount = Number(receipt.discount_amount ?? receipt.discount ?? 0);
    const taxAmount = Number(receipt.tax_amount ?? 0);
    const totalAmount = Number(receipt.total_amount ?? receipt.total ?? 0);
    const cashReceived = receipt.cash_received ? Number(receipt.cash_received) : null;
    const changeDue = receipt.change_due ? Number(receipt.change_due) : null;
    const receiptDate = receipt.created_at ?? receipt.date ?? receipt.created_at_formatted ?? null;
    
    const items = receipt.items || [];
    const customerName = receipt.customer_name || 'Walk-in Customer';
    const cashierName = receipt.cashier_name || receipt.cashier || 'Admin User';

    useEffect(() => {
        const itemsHtml = items.map(item => `
            <div style="margin-bottom: 6px;">
                <div>${item.name}</div>
                <table style="width: 100%; margin-top: 2px;">
                    <tr>
                        <td style="padding-left: 10px; font-size: 10px;">${item.quantity} x ${formatPrice(item.price)}</td>
                        <td style="text-align: right; font-size: 10px;">${formatPrice(item.subtotal)}</td>
                    </tr>
                </table>
            </div>
        `).join('');

        const printWindow = window.open('', '_blank', 'width=350,height=700');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt - ${receipt.order_number}</title>
                <style>
                    @page {
                        size: 80mm 210mm;
                        margin: 5mm 3mm;
                    }
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        width: 100%;
                        max-width: 80mm;
                        margin: 0 auto;
                        padding: 0;
                        font-size: 11px;
                        background: white;
                    }
                    
                    .receipt-container {
                        width: 100%;
                        padding: 0 2mm;
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    
                    td {
                        padding: 2px 0;
                    }
                    
                    .label {
                        text-align: left;
                    }
                    
                    .value {
                        text-align: right;
                    }
                    
                    .dashed {
                        border-top: 1px dashed #000;
                        margin: 6px 0;
                    }
                    
                    .solid {
                        border-top: 2px solid #000;
                        margin: 6px 0;
                    }
                    
                    .text-center {
                        text-align: center;
                    }
                    
                    .bold {
                        font-weight: bold;
                    }
                    
                    .small {
                        font-size: 9px;
                    }
                    
                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                        }
                        .receipt-container {
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    <!-- Header -->
                    <div class="text-center">
                        <div class="bold" style="font-size: 14px;">CJ BREW & DINE</div>
                        <div class="small">Restobar System</div>
                        <div class="small" style="margin-top: 4px;">${formatPHDateTime(receiptDate)}</div>
                    </div>
                    
                    <div class="dashed"></div>
                    
                    <!-- Order Info -->
                    <table>
                        <tr><td class="label bold">Order #</td><td class="value">${receipt.order_number}</td></tr>
                        <tr><td class="label">Cashier:</td><td class="value">${cashierName}</td></tr>
                        <tr><td class="label">Customer:</td><td class="value">${customerName}</td></tr>
                        <tr><td class="label">Payment:</td><td class="value">${receipt.payment_method || 'Cash'}</td></tr>
                        ${receipt.room_number ? `<tr><td class="label">Room:</td><td class="value">#${receipt.room_number}</td></tr>` : ''}
                    </table>
                    
                    <div class="dashed"></div>
                    
                    <!-- Items Header -->
                    <div class="bold">ITEMS</div>
                    <br/>
                    ${itemsHtml}
                    
                    <div class="dashed"></div>
                    
                    <!-- Totals -->
                    <table>
                        <tr><td class="label bold">SUBTOTAL</td><td class="value">${formatPrice(subtotal)}</td></tr>
                        ${discount > 0 ? `<tr><td class="label">DISCOUNT</td><td class="value">-${formatPrice(discount)}</td></tr>` : ''}
                        <tr><td class="label">VATable Sales:</td><td class="value">${formatPrice(subtotal)}</td></tr>
                        <tr><td class="label">VAT Amount (12%):</td><td class="value">${formatPrice(taxAmount)}</td></tr>
                    </table>
                    
                    <div class="solid"></div>
                    
                    <table>
                        <tr><td class="label bold" style="font-size: 13px;">TOTAL</td><td class="value bold" style="font-size: 13px;">${formatPrice(totalAmount)}</td></tr>
                    </table>
                    
                    <div class="solid"></div>
                    
                    <!-- Cash -->
                    ${cashReceived !== null ? `
                    <table>
                        <tr><td class="label">CASH RECEIVED</td><td class="value">${formatPrice(cashReceived)}</td></tr>
                        <tr><td class="label">CHANGE DUE</td><td class="value">${formatPrice(changeDue ?? 0)}</td></tr>
                    </table>
                    <div class="dashed"></div>
                    ` : ''}
                    
                    <!-- Footer -->
                    <div class="text-center">
                        <div>Thank you for dining with us!</div>
                        <div>Please come again.</div>
                        <div class="small" style="margin-top: 6px;">This serves as your</div>
                        <div class="bold">OFFICIAL RECEIPT</div>
                    </div>
                </div>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
        onClose();
    }, [receipt, onClose]);

    return null;
}