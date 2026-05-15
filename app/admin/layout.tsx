'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Upload,
  FolderTree,
  ImageIcon,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Товары', icon: Package },
  { href: '/admin/products/new', label: 'Добавить товар', icon: PlusCircle },
  { href: '/admin/import', label: 'Импорт', icon: Upload },
  { href: '/admin/categories', label: 'Категории', icon: FolderTree },
  { href: '/admin/images', label: 'Фото', icon: ImageIcon },
  { href: '/admin/clients', label: 'Клиенты', icon: Users },
  { href: '/admin/settings', label: 'Настройки', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Don't check auth on login page
    if (pathname === '/admin/login') {
      setAuthed(true); // Let login page render
      return;
    }

    fetch('/api/admin/me')
      .then((res) => {
        if (!res.ok) {
          router.replace('/admin/login');
        } else {
          setAuthed(true);
        }
      })
      .catch(() => {
        router.replace('/admin/login');
      });
  }, [pathname, router]);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
  };

  // Login page renders without layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Loading state
  if (authed === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 font-bold animate-pulse">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-gray-900 text-white flex flex-col transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg leading-tight">Админ-панель</h2>
            <p className="text-gray-400 text-xs mt-0.5">Каталог хозтоваров</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors mb-0.5 no-underline ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium text-gray-400 hover:bg-white/10 hover:text-red-400 transition-colors"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900 p-1"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-900 truncate">
            {navItems.find((i) => i.href === pathname)?.label || 'Админ-панель'}
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
