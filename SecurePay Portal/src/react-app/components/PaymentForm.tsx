import { useState } from 'react';
import { CreditCard, User, Building, Globe, DollarSign, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface PaymentFormProps {
  onSubmit: (data: {
    recipient_name: string;
    recipient_account: string;
    recipient_bank: string;
    recipient_country: string;
    swift_code: string;
    amount: number;
    currency: string;
    purpose?: string;
  }) => Promise<void>;
  loading?: boolean;
  error?: string;
}

const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
];

const countries = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 
  'France', 'Japan', 'Switzerland', 'Netherlands', 'Singapore', 
  'Hong Kong', 'Ireland', 'Italy', 'Spain', 'Belgium', 'Austria',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'New Zealand'
];

export default function PaymentForm({ onSubmit, loading, error }: PaymentFormProps) {
  const [formData, setFormData] = useState({
    recipient_name: '',
    recipient_account: '',
    recipient_bank: '',
    recipient_country: '',
    swift_code: '',
    amount: '',
    currency: 'USD',
    purpose: ''
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    // Recipient name validation
    if (!formData.recipient_name) {
      errors.recipient_name = 'Recipient name is required';
    } else if (formData.recipient_name.length < 2) {
      errors.recipient_name = 'Recipient name must be at least 2 characters';
    } else if (!/^[a-zA-Z\s\-\.]+$/.test(formData.recipient_name)) {
      errors.recipient_name = 'Recipient name can only contain letters, spaces, hyphens and dots';
    }
    
    // Account number validation
    if (!formData.recipient_account) {
      errors.recipient_account = 'Account number is required';
    } else if (formData.recipient_account.length < 8) {
      errors.recipient_account = 'Account number must be at least 8 characters';
    } else if (!/^[A-Z0-9\-]+$/.test(formData.recipient_account)) {
      errors.recipient_account = 'Invalid account number format';
    }
    
    // Bank name validation
    if (!formData.recipient_bank) {
      errors.recipient_bank = 'Bank name is required';
    } else if (!/^[a-zA-Z\s\-\.]+$/.test(formData.recipient_bank)) {
      errors.recipient_bank = 'Bank name can only contain letters, spaces, hyphens and dots';
    }
    
    // Country validation
    if (!formData.recipient_country) {
      errors.recipient_country = 'Country is required';
    }
    
    // SWIFT code validation
    if (!formData.swift_code) {
      errors.swift_code = 'SWIFT code is required';
    } else if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(formData.swift_code)) {
      errors.swift_code = 'Invalid SWIFT code format (e.g., BOFAUS3N or DEUTDEFF500)';
    }
    
    // Amount validation
    if (!formData.amount) {
      errors.amount = 'Amount is required';
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        errors.amount = 'Amount must be a positive number';
      } else if (amount < 1) {
        errors.amount = 'Minimum amount is 1';
      } else if (amount > 50000) {
        errors.amount = 'Maximum amount is 50,000';
      }
    }
    
    // Purpose validation (optional)
    if (formData.purpose && formData.purpose.length > 200) {
      errors.purpose = 'Purpose cannot exceed 200 characters';
    } else if (formData.purpose && !/^[a-zA-Z0-9\s\-\.\,]+$/.test(formData.purpose)) {
      errors.purpose = 'Purpose contains invalid characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setShowConfirmation(true);
    }
  };

  const handleConfirm = async () => {
    await onSubmit({
      ...formData,
      swift_code: formData.swift_code,
      amount: parseFloat(formData.amount),
      purpose: formData.purpose || undefined,
    });
    setShowConfirmation(false);
  };

  const calculateFee = () => {
    const amount = parseFloat(formData.amount);
    return isNaN(amount) ? 0 : amount * 0.02; // 2% fee
  };

  const selectedCurrency = currencies.find(c => c.code === formData.currency);

  if (showConfirmation) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Confirm Payment</h2>
            <p className="text-slate-600">Please review your payment details carefully</p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-3">Recipient Details</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-slate-600">Name:</span> <span className="font-medium">{formData.recipient_name}</span></div>
                  <div><span className="text-slate-600">Account:</span> <span className="font-medium">{formData.recipient_account}</span></div>
                  <div><span className="text-slate-600">Bank:</span> <span className="font-medium">{formData.recipient_bank}</span></div>
                  <div><span className="text-slate-600">SWIFT Code:</span> <span className="font-medium">{formData.swift_code}</span></div>
                  <div><span className="text-slate-600">Country:</span> <span className="font-medium">{formData.recipient_country}</span></div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-3">Payment Details</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-slate-600">Amount:</span> <span className="font-medium">{selectedCurrency?.symbol}{formData.amount}</span></div>
                  <div><span className="text-slate-600">Currency:</span> <span className="font-medium">{formData.currency}</span></div>
                  <div><span className="text-slate-600">Transaction Fee:</span> <span className="font-medium">{selectedCurrency?.symbol}{calculateFee().toFixed(2)}</span></div>
                  <div className="border-t pt-2 mt-2">
                    <span className="text-slate-600">Total:</span> <span className="font-bold text-lg">{selectedCurrency?.symbol}{(parseFloat(formData.amount) + calculateFee()).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {formData.purpose && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-2">Purpose</h3>
                <p className="text-sm text-slate-700">{formData.purpose}</p>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={loading}
              >
                Edit Payment
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-6 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Confirm & Send'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">International Payment</h2>
          <p className="text-slate-600">Send money securely worldwide</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Recipient Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <User className="w-5 h-5 mr-2" />
              Recipient Information
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Recipient Name *
              </label>
              <input
                type="text"
                value={formData.recipient_name}
                onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value.toUpperCase() })}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  validationErrors.recipient_name ? 'border-red-300' : 'border-slate-300'
                }`}
                placeholder="JOHN DOE"
                disabled={loading}
              />
              {validationErrors.recipient_name && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.recipient_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Account Number *
              </label>
              <input
                type="text"
                value={formData.recipient_account}
                onChange={(e) => setFormData({ ...formData, recipient_account: e.target.value.toUpperCase() })}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  validationErrors.recipient_account ? 'border-red-300' : 'border-slate-300'
                }`}
                placeholder="GB82WEST12345698765432"
                disabled={loading}
              />
              {validationErrors.recipient_account && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.recipient_account}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Bank Name *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={formData.recipient_bank}
                    onChange={(e) => setFormData({ ...formData, recipient_bank: e.target.value })}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      validationErrors.recipient_bank ? 'border-red-300' : 'border-slate-300'
                    }`}
                    placeholder="HSBC Bank"
                    disabled={loading}
                  />
                </div>
                {validationErrors.recipient_bank && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.recipient_bank}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  SWIFT Code *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={formData.swift_code}
                    onChange={(e) => setFormData({ ...formData, swift_code: e.target.value.toUpperCase() })}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      validationErrors.swift_code ? 'border-red-300' : 'border-slate-300'
                    }`}
                    placeholder="BOFAUS3N"
                    maxLength={11}
                    disabled={loading}
                  />
                </div>
                {validationErrors.swift_code && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.swift_code}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">8 or 11 characters (e.g., BOFAUS3N)</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Country *
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select
                  value={formData.recipient_country}
                  onChange={(e) => setFormData({ ...formData, recipient_country: e.target.value })}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    validationErrors.recipient_country ? 'border-red-300' : 'border-slate-300'
                  }`}
                  disabled={loading}
                >
                  <option value="">Select Country</option>
                  {countries.map((country) => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
              {validationErrors.recipient_country && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.recipient_country}</p>
              )}
            </div>
          </div>

          {/* Payment Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Payment Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max="50000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    validationErrors.amount ? 'border-red-300' : 'border-slate-300'
                  }`}
                  placeholder="1000.00"
                  disabled={loading}
                />
                {validationErrors.amount && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Currency *
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  disabled={loading}
                >
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formData.amount && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700">Transaction Fee (2%):</span>
                  <span className="font-medium text-blue-900">{selectedCurrency?.symbol}{calculateFee().toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold mt-2 pt-2 border-t border-blue-200">
                  <span className="text-blue-900">Total Amount:</span>
                  <span className="text-blue-900">{selectedCurrency?.symbol}{(parseFloat(formData.amount) + calculateFee()).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Purpose (Optional)
            </label>
            <textarea
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${
                validationErrors.purpose ? 'border-red-300' : 'border-slate-300'
              }`}
              placeholder="Payment for services, gift, etc."
              rows={3}
              maxLength={200}
              disabled={loading}
            />
            <div className="flex justify-between items-center mt-1">
              {validationErrors.purpose && (
                <p className="text-sm text-red-600">{validationErrors.purpose}</p>
              )}
              <p className="text-xs text-slate-500 ml-auto">{formData.purpose.length}/200</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-medium text-lg hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Review Payment
          </button>
        </form>
      </div>
    </div>
  );
}
