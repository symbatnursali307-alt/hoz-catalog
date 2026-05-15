'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, LogIn } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Ошибка входа');
        setLoading(false);
        return;
      }

      router.push('/admin');
    } catch {
      setError('Ошибка соединения с сервером');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="text-accent" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Админ-панель</h1>
          <p className="text-gray-400 text-sm">Каталог хозтоваров</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-2xl">
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Логин</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[15px] outline-none focus:border-accent transition-colors bg-gray-50"
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Пароль</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl text-[15px] outline-none focus:border-accent transition-colors bg-gray-50"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[50px] rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <span>Вход...</span>
            ) : (
              <>
                <LogIn size={18} />
                Войти
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
