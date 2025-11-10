import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useApp } from '../contexts/AppContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { language, setLanguage, t } = useLanguage();
  const { darkMode, toggleDarkMode } = useApp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-96">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold dark:text-white">{t('settings')}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Language Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('language')}
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'ru')}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="en">{t('english')}</option>
            <option value="ru">{t('russian')}</option>
          </select>
        </div>

        {/* Theme Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('theme')}
          </label>
          <button
            onClick={toggleDarkMode}
            className="w-full p-2 border rounded-md flex items-center justify-between dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <span>{darkMode ? t('dark') : t('light')}</span>
            <span>{darkMode ? '🌙' : '☀️'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;