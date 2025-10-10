import { ReactNode } from 'react';
import { Shield, LogOut, User, CreditCard } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  user?: {
    id: number;
    email: string;
    full_name?: string | null;
    is_verified: boolean;
  };
  onLogout?: () => void;
}

export default function Layout({ children, user, onLogout }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">SecurePay Portal</h1>
                <p className="text-sm text-slate-600">International Payments</p>
              </div>
            </div>
            
            {user && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{(user.full_name && user.full_name.trim()) ? user.full_name : user.email}</p>
                    <p className="text-slate-600">{user.email}</p>
                  </div>
                  {user.is_verified && (
                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Verified Account"></div>
                  )}
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white/60 backdrop-blur-md border-t border-slate-200/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              © 2024 SecurePay Portal. All rights reserved. 
              <span className="ml-2 inline-flex items-center">
                <Shield className="w-3 h-3 mr-1" />
                SSL Secured
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-slate-600">
              <span>Powered by secure banking technology</span>
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
