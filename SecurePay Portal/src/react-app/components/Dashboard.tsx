import { useState, useEffect } from 'react';
import { Plus, History, Eye, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import PaymentForm from './PaymentForm';

interface User {
  id: number;
  email: string;
  full_name?: string | null;
  is_verified: boolean;
}

interface Transaction {
  id: number;
  recipient_name: string;
  recipient_account: string;
  recipient_bank: string;
  recipient_country: string;
  amount: number;
  currency: string;
  reference_number: string;
  status: string;
  transaction_fee: number;
  purpose?: string;
  created_at: string;
}

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'new-payment' | 'history'>('overview');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'overview') {
      fetchTransactions();
    }
  }, [activeTab]);

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/payments/history', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        setTransactions(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const handleCreatePayment = async (paymentData: any) => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();
      
      if (response.ok) {
        setSuccess(`Payment initiated successfully! Reference: ${result.data.referenceNumber}`);
        setActiveTab('overview');
        fetchTransactions();
      } else {
        setError(result.error || 'Payment failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const recentTransactions = transactions.slice(0, 5);
  const totalSent = transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  if (activeTab === 'new-payment') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className="text-blue-600 hover:text-blue-700 flex items-center text-sm font-medium"
          >
            ← Back to Dashboard
          </button>
        </div>
        <PaymentForm
          onSubmit={handleCreatePayment}
          loading={loading}
          error={error}
        />
        {success && (
          <div className="mt-6 max-w-2xl mx-auto p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            <CheckCircle className="w-5 h-5 inline mr-2" />
            {success}
          </div>
        )}
      </div>
    );
  }

  const displayName = (user.full_name && user.full_name.trim())
    ? user.full_name.split(' ')[0]
    : (user.email || 'User');

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Welcome back, {displayName}
        </h1>
        <p className="text-slate-600">Manage your international payments securely</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <button
          onClick={() => setActiveTab('new-payment')}
          className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg"
        >
          <Plus className="w-8 h-8 mb-3" />
          <h3 className="text-lg font-semibold mb-2">New Payment</h3>
          <p className="text-blue-100">Send money internationally</p>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className="p-6 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl hover:bg-white hover:shadow-lg transition-all"
        >
          <History className="w-8 h-8 mb-3 text-slate-600" />
          <h3 className="text-lg font-semibold mb-2 text-slate-900">Transaction History</h3>
          <p className="text-slate-600">View all your payments</p>
        </button>

        <div className="p-6 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl">
          <Eye className="w-8 h-8 mb-3 text-slate-600" />
          <h3 className="text-lg font-semibold mb-2 text-slate-900">Account Overview</h3>
          <p className="text-slate-600">Current session details</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Sent</p>
              <p className="text-2xl font-bold text-slate-900">${totalSent.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Transactions</p>
              <p className="text-2xl font-bold text-slate-900">{transactions.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <History className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pending Payments</p>
              <p className="text-2xl font-bold text-slate-900">
                {transactions.filter(t => t.status === 'pending').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {activeTab === 'overview' && (
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Recent Transactions</h2>
            <button
              onClick={() => setActiveTab('history')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View All
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">No transactions yet</p>
              <button
                onClick={() => setActiveTab('new-payment')}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Send your first payment
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(transaction.status)}
                    <div>
                      <p className="font-medium text-slate-900">{transaction.recipient_name}</p>
                      <p className="text-sm text-slate-600">{transaction.recipient_bank} • {transaction.recipient_country}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">${transaction.amount.toFixed(2)} {transaction.currency}</p>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(transaction.status)}`}>
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full Transaction History */}
      {activeTab === 'history' && (
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Transaction History</h2>
          
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">No transactions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(transaction.status)}
                      <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(transaction.status)}`}>
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      </span>
                    </div>
                    <span className="text-sm text-slate-600">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">Recipient</p>
                      <p className="font-medium">{transaction.recipient_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Bank</p>
                      <p className="font-medium">{transaction.recipient_bank}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Amount</p>
                      <p className="font-medium">${transaction.amount.toFixed(2)} {transaction.currency}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Reference</p>
                      <p className="font-medium">{transaction.reference_number}</p>
                    </div>
                  </div>
                  
                  {transaction.purpose && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-slate-600 text-sm">Purpose: {transaction.purpose}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
