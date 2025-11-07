import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, Eye, Filter, Search, User, Building, Globe, DollarSign } from 'lucide-react';

interface Transaction {
  id: string;
  recipient_name: string;
  recipient_account: string;
  recipient_bank: string;
  recipient_country: string;
  swift_code: string;
  amount: number;
  currency: string;
  reference_number: string;
  status: string;
  transaction_fee: number;
  purpose?: string;
  created_at: string;
  user_email: string;
  user_name?: string;
}

export default function EmployeeApproval() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAdminTransactions = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/transactions', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.status === 403) {
        setFetchError('You must be logged in as staff to view transactions.');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setFetchError('Failed to fetch transactions');
        setLoading(false);
        return;
      }
      const result = await res.json();
      const adapted: Transaction[] = (result.data || []).map((t: any) => ({
        id: t._id?.toString ? t._id.toString() : String(t._id),
        recipient_name: t.recipient_name,
        recipient_account: t.recipient_account,
        recipient_bank: t.recipient_bank,
        recipient_country: t.recipient_country,
        swift_code: t.swift_code,
        amount: t.amount,
        currency: t.currency,
        reference_number: t.reference_number,
        status: t.status,
        transaction_fee: t.transaction_fee,
        purpose: t.purpose,
        created_at: t.created_at,
        user_email: t.user_email || t.email || '',
        user_name: t.user_name || t.full_name || ''
      }));
      setTransactions(adapted);
    } catch (err) {
      console.error('Admin fetch error', err);
      setFetchError('Network error while fetching transactions');
    } finally {
      setLoading(false);
    }
  };

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'rejected':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const handleApprove = async (transactionId: string) => {
    // Call admin verify API to mark as processed/completed
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/admin/transactions/${transactionId}/verify`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const result = await res.json();
        const updated = result.data;
        setTransactions(prev => prev.map(tx => tx.id === transactionId ? { ...tx, status: updated.status } : tx));
      } else {
        // Fallback to local update on failure
        setTransactions(prev => prev.map(tx => tx.id === transactionId ? { ...tx, status: 'approved' } : tx));
      }
    } catch (err) {
      console.error('Approve error', err);
      setTransactions(prev => prev.map(tx => tx.id === transactionId ? { ...tx, status: 'approved' } : tx));
    }
    setShowDetailModal(false);
    setSelectedTransaction(null);
  };

  const handleReject = (transactionId: string) => {
    // No server endpoint for rejection yet; update locally for now.
    setTransactions(prev => prev.map(tx => tx.id === transactionId ? { ...tx, status: 'rejected' } : tx));
    setShowDetailModal(false);
    setSelectedTransaction(null);
  };

  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    const matchesStatus = filterStatus === 'all' || tx.status === filterStatus;
    const matchesSearch = 
      tx.recipient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = transactions.filter(tx => tx.status === 'pending').length;
  const approvedCount = transactions.filter(tx => tx.status === 'approved').length;
  const rejectedCount = transactions.filter(tx => tx.status === 'rejected').length;

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      CAD: 'C$',
      AUD: 'A$',
      CHF: 'CHF',
      CNY: '¥',
    };
    return symbols[currency] || currency;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Transaction Approval Center
        </h1>
        <p className="text-slate-600">Review and approve international payment transactions</p>
      </div>
          {loading && (
            <div className="mb-6 max-w-7xl mx-auto px-4">
              <div className="p-4 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 text-sm">Loading transactions…</div>
            </div>
          )}
          {fetchError && (
            <div className="mb-6 max-w-7xl mx-auto px-4">
              <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">{fetchError}</div>
            </div>
          )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Transactions</p>
              <p className="text-2xl font-bold text-slate-900">{transactions.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Filter by Status:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'pending'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setFilterStatus('approved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'approved'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setFilterStatus('rejected')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'rejected'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Rejected
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, reference, or user..."
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-80"
            />
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">
          Transactions ({filteredTransactions.length})
        </h2>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">No transactions found matching your criteria</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="p-5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(transaction.status)}
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(transaction.status)}`}>
                      {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                    </span>
                    <span className="text-sm text-slate-600">
                      {new Date(transaction.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-slate-900">
                      {getCurrencySymbol(transaction.currency)}{transaction.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-slate-600">{transaction.currency}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <User className="w-4 h-4 text-slate-500" />
                      <p className="text-xs text-slate-600">Submitted by</p>
                    </div>
                    <p className="font-medium text-slate-900">{transaction.user_name || transaction.user_email}</p>
                    <p className="text-sm text-slate-600">{transaction.user_email}</p>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <User className="w-4 h-4 text-slate-500" />
                      <p className="text-xs text-slate-600">Recipient</p>
                    </div>
                    <p className="font-medium text-slate-900">{transaction.recipient_name}</p>
                    <p className="text-sm text-slate-600">{transaction.recipient_account}</p>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Building className="w-4 h-4 text-slate-500" />
                      <p className="text-xs text-slate-600">Bank & SWIFT</p>
                    </div>
                    <p className="font-medium text-slate-900">{transaction.recipient_bank}</p>
                    <p className="text-sm text-slate-600">SWIFT: {transaction.swift_code || 'N/A'}</p>
                    <div className="flex items-center space-x-1">
                      <Globe className="w-3 h-3 text-slate-500" />
                      <p className="text-sm text-slate-600">{transaction.recipient_country}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600 mb-1">Reference</p>
                    <p className="font-medium text-slate-900">{transaction.reference_number}</p>
                    <p className="text-sm text-slate-600">Fee: {getCurrencySymbol(transaction.currency)}{transaction.transaction_fee.toFixed(2)}</p>
                  </div>
                </div>

                {transaction.purpose && (
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Purpose</p>
                    <p className="text-sm text-slate-700">{transaction.purpose}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleViewDetails(transaction)}
                    className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="text-sm font-medium">View Details</span>
                  </button>

                  {transaction.status === 'pending' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleReject(transaction.id)}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Reject</span>
                      </button>
                      <button
                        onClick={() => handleApprove(transaction.id)}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Approve</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">Transaction Details</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(selectedTransaction.status)}
                  <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(selectedTransaction.status)}`}>
                    {selectedTransaction.status.charAt(0).toUpperCase() + selectedTransaction.status.slice(1)}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {getCurrencySymbol(selectedTransaction.currency)}{selectedTransaction.amount.toFixed(2)}
                  </p>
                  <p className="text-sm text-slate-600">{selectedTransaction.currency}</p>
                </div>
              </div>

              {/* User Information */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Submitted By
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Name:</span>
                    <span className="font-medium">{selectedTransaction.user_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Email:</span>
                    <span className="font-medium">{selectedTransaction.user_email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Submitted:</span>
                    <span className="font-medium">{new Date(selectedTransaction.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Recipient Information */}
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Recipient Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Name:</span>
                    <span className="font-medium">{selectedTransaction.recipient_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Account:</span>
                    <span className="font-medium">{selectedTransaction.recipient_account}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Bank:</span>
                    <span className="font-medium">{selectedTransaction.recipient_bank}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">SWIFT Code:</span>
                    <span className="font-medium">{selectedTransaction.swift_code || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Country:</span>
                    <span className="font-medium">{selectedTransaction.recipient_country}</span>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="p-4 bg-purple-50 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Payment Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Amount:</span>
                    <span className="font-medium">{getCurrencySymbol(selectedTransaction.currency)}{selectedTransaction.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Transaction Fee:</span>
                    <span className="font-medium">{getCurrencySymbol(selectedTransaction.currency)}{selectedTransaction.transaction_fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-slate-900 font-semibold">Total:</span>
                    <span className="font-bold text-lg">{getCurrencySymbol(selectedTransaction.currency)}{(selectedTransaction.amount + selectedTransaction.transaction_fee).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Reference:</span>
                    <span className="font-medium">{selectedTransaction.reference_number}</span>
                  </div>
                </div>
              </div>

              {/* Purpose */}
              {selectedTransaction.purpose && (
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h3 className="font-semibold text-slate-900 mb-2">Purpose</h3>
                  <p className="text-sm text-slate-700">{selectedTransaction.purpose}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {selectedTransaction.status === 'pending' && (
              <div className="p-6 border-t border-slate-200 bg-slate-50 flex space-x-3">
                <button
                  onClick={() => handleReject(selectedTransaction.id)}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium"
                >
                  <XCircle className="w-5 h-5" />
                  <span>Reject Transaction</span>
                </button>
                <button
                  onClick={() => handleApprove(selectedTransaction.id)}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-medium"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Approve Transaction</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
