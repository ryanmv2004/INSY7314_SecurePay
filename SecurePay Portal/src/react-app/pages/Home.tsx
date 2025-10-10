import { useState } from 'react';
import Layout from '@/react-app/components/Layout';
import LoginForm from '@/react-app/components/LoginForm';
import RegisterForm from '@/react-app/components/RegisterForm';
import Dashboard from '@/react-app/components/Dashboard';

interface AppUser {
  id: number;
  email: string;
  full_name?: string | null;
  is_verified: boolean;
}

export default function Home() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Do not auto-login on startup. Always start on the login screen.
  const [isInitializing] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      
      if (response.ok) {
        localStorage.setItem('authToken', result.data.token);
        setUser(result.data.user);
        setError('');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (data: {
    email: string;
    password: string;
  }) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (response.ok) {
        // Registration successful — prompt user to login
        setSuccess('Registration successful. Please sign in.');
        setAuthMode('login');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
      setUser(null);
    }
  };

  if (isInitializing) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        {success && (
          <div className="max-w-md mx-auto mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}
        {authMode === 'login' ? (
          <LoginForm
            onLogin={handleLogin}
            onSwitchToRegister={() => {
              setAuthMode('register');
              setError('');
            }}
            error={error}
            loading={loading}
          />
        ) : (
          <RegisterForm
            onRegister={handleRegister}
            onSwitchToLogin={() => {
              setAuthMode('login');
              setError('');
            }}
            error={error}
            loading={loading}
          />
        )}
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Dashboard user={user} />
    </Layout>
  );
}
