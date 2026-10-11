import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Users,
  Brain,
  Calendar,
  Key,
  BarChart3,
  Settings,
  Menu,
} from 'lucide-react';
import { useAppStore } from '@/stores';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/bots', icon: Bot, labelKey: 'nav.bots' },
  { path: '/groups', icon: Users, labelKey: 'nav.groups' },
  { path: '/memory', icon: Brain, labelKey: 'nav.memory' },
  { path: '/tasks', icon: Calendar, labelKey: 'nav.tasks' },
  { path: '/secrets', icon: Key, labelKey: 'nav.secrets' },
  { path: '/usage', icon: BarChart3, labelKey: 'nav.usage' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`
          ${sidebarOpen ? 'w-64' : 'w-0'}
          transition-all duration-300 ease-in-out
          bg-white dark:bg-gray-800
          border-r border-gray-200 dark:border-gray-700
          overflow-hidden
        `}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('app.title')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('app.subtitle')}
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-colors
                    ${isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <Icon size={20} />
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Menu size={20} />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
