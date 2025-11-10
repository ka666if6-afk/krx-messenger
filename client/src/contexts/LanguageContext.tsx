import React, { createContext, useContext, useState } from 'react';

type Language = 'en' | 'ru';

type Translations = {
  [key: string]: {
    en: string;
    ru: string;
  };
};

const translations: Translations = {
  newChat: {
    en: 'New Chat',
    ru: 'Новый чат'
  },
  newGroup: {
    en: 'New Group',
    ru: 'Новая группа'
  },
  newChannel: {
    en: 'New Channel',
    ru: 'Новый канал'
  },
  settings: {
    en: 'Settings',
    ru: 'Настройки'
  },
  theme: {
    en: 'Theme',
    ru: 'Тема'
  },
  language: {
    en: 'Language',
    ru: 'Язык'
  },
  english: {
    en: 'English',
    ru: 'Английский'
  },
  russian: {
    en: 'Russian',
    ru: 'Русский'
  },
  light: {
    en: 'Light',
    ru: 'Светлая'
  },
  dark: {
    en: 'Dark',
    ru: 'Тёмная'
  },
  search: {
    en: 'Search',
    ru: 'Поиск'
  },
  online: {
    en: 'online',
    ru: 'в сети'
  },
  offline: {
    en: 'offline',
    ru: 'не в сети'
  },
  lastSeen: {
    en: 'last seen',
    ru: 'был(а)'
  },
  typing: {
    en: 'typing...',
    ru: 'печатает...'
  },
  today: {
    en: 'Today',
    ru: 'Сегодня'
  },
  yesterday: {
    en: 'Yesterday',
    ru: 'Вчера'
  },
  // Add more translations as needed
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};