import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LogOut, User, Sun, Moon } from 'lucide-react';
import { LanguageToggle } from '../components/ui/LanguageToggle';
import { NotificationBell } from '../components/common/NotificationBell';

const MainLayout: React.FC = () => {
    const { profile, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0F1117] text-gray-900 dark:text-white font-sans transition-colors duration-300">
            <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex justify-between items-center bg-opacity-80 dark:bg-opacity-50 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
                <div className="flex items-center gap-3">
                    <img src="/triev_logo.png" alt="TriEv" className="w-8 h-8 object-contain" />
                    <span className="font-extrabold text-xl tracking-tight text-gray-900 dark:text-white">
                        <span className="text-orange-500">TriEv</span>
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    {profile && (
                        <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <User size={16} />
                            <span className="font-medium text-gray-700 dark:text-gray-200">{profile.full_name || profile.mobile}</span>
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs uppercase tracking-wider font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                {profile.role}
                            </span>
                        </div>
                    )}

                    {/* Notifications - System Wide */}
                    <div className="mr-2">
                        <NotificationBell />
                    </div>

                    {/* Bilingual Toggle */}
                    <LanguageToggle />

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-yellow-400"
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    <button
                        onClick={handleSignOut}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-white"
                        title={t('common.logout')}
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </nav>

            <main className="p-4 md:p-6 max-w-7xl mx-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
