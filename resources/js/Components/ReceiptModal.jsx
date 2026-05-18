import React from 'react';
import { X, Printer, Building2, Hash, User, Clock, CreditCard } from 'lucide-react';

const formatPeso = (amount) => {
    return `₱${parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

export default function ReceiptModal({ sale, onClose, businessInfo }) {
    if (!sale) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/50 z-50 print:hidden"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4 print:static print:z-auto">
                <div className="bg-white rounded-lg shadow-2xl max-w-md w-full print:shadow-none print:max-w-none">
                    {/* Header - Hidden on Print */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 print:hidden">
                        <h3 className="text-lg font-semibold text-gray-900">Official Receipt</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrint}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1 text-sm"
                            >
                                <Printer className="w-4 h-4" />
                                Print
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Receipt Content */}
                    <div className="p-6 print:p-0">
                        {/* Business Header */}
                        <div className="text-center mb-4 pb-4 border-b-2 border-gray-800">
                            <h1 className="text-xl font-bold text-gray-900">
                                {businessInfo?.business_name || 'Your Business Name'}
                            </h1>
                            {businessInfo?.business_tagline && (
                                <p className="text-sm text-gray-600 mt-1">{businessInfo.business_tagline}</p>
                            )}
                            <div className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-600">
                                <Building2 className="w-4 h-4" />
                                <span>Official Receipt</span>
                            </div>
                        </div>

                        {/* Receipt Info */}
                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                            <div>
                                <p className="text-gray-500">OR Number</p>
                                <p className="font-mono font-bold text-gray-900">
                                    {sale.or_number || sale.invoice_number || 'N/A'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-500">Date & Time</p>
                                <div className="flex items-center justify-end gap-1">
                                    <Clock className="w-3 h-3 text-gray-400" />
                                    <p className="font-medium text-gray-900">
                                        {new Date(sale.created_at).toLocaleString('en-US', {
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Customer Info */}
                        {(sale.customer_name || sale.room_number) && (
                            <div className="mb-4 pb-4 border-b border-gray-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <User className="w-4 h-4 text-gray-400" />
                                    <p className="text-sm font-medium text-gray-700">Customer</p>
                                </div>
                                <p className="text-gray-900">{sale.customer_name || 'Walk-in Customer'}</p>
                                {sale.room_number && (
                                    <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                                        <Hash className="w-3 h-3" />
                                        <span>Room #{sale.room_number}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Items Table */}
                        <div className="mb-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b-2 border-gray-800">
                                        <th className="text-left py-2 font-bold text-gray-900">Item</th>
                                        <th className="text-center font-bold text-gray-900">Qty</th>
                                        <th className="text-right font-bold text-gray-900">Price</th>
                                        <th className="text-right font-bold text-gray-900">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sale.items?.map((item, idx) => (
                                        <tr key={idx} className="border-b border-gray-200">
                                            <td className="py-2 text-gray-900">{item.name}</td>
                                            <td className="text-center text-gray-900">{item.quantity}</td>
                                            <td className="text-right text-gray-600">{formatPeso(item.unit_price)}</td>
                                            <td className="text-right font-medium text-gray-900">
                                                {formatPeso(item.quantity * item.unit_price)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div className="border-t-2 border-gray-800 pt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-medium text-gray-900">{formatPeso(sale.total_amount + (sale.discount_amount || 0))}</span>
                            </div>
                            {sale.discount_amount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Discount</span>
                                    <span className="font-medium text-red-600">-{formatPeso(sale.discount_amount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                                <span className="text-gray-900">Total</span>
                                <span className="text-gray-900">{formatPeso(sale.total_amount)}</span>
                            </div>
                        </div>

                        {/* Payment Info */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-600">Payment Method</span>
                                </div>
                                <span className="font-medium text-gray-900">{sale.payment_method || 'Cash'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm mt-2">
                                <span className="text-gray-600">Status</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    sale.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    sale.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                    {sale.status}
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-6 pt-4 border-t border-gray-200 text-center text-xs text-gray-500 print:border-t-2 print:border-gray-800">
                            <p>Thank you for your business!</p>
                            {businessInfo?.business_tagline && (
                                <p className="mt-1">{businessInfo.business_tagline}</p>
                            )}
                            <p className="mt-2">This is a computer-generated receipt</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    @page {
                        margin: 0.5in;
                        size: auto;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .fixed.inset-0.flex.items-center.justify-center,
                    .fixed.inset-0.flex.items-center.justify-center * {
                        visibility: visible;
                    }
                    .fixed.inset-0.flex.items-center.justify-center {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                    }
                }
            `}</style>
        </>
    );
}
