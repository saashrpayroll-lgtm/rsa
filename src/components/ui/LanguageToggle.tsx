import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Globe } from 'lucide-react';

export const LanguageToggle: React.FC = () => {
    const { language, setLanguage } = useLanguage();

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'hi' : 'en');
    };

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all text-sm font-medium text-gray-700 dark:text-gray-200"
            title="Switch Language / भाषा बदलें"
        >
            <Globe size={16} className="text-indigo-500 dark:text-indigo-400" />
            <span>{language === 'en' ? 'EN' : 'हिंदी'}</span>
        </button>
    );
};
