import { AppProvider } from '../src/contexts/AppContext';
import { LanguageProvider } from '../src/contexts/LanguageContext';
import '../src/styles/globals.css';
import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import io from 'socket.io-client';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Check if socket.io is loaded
    if (typeof io === 'undefined') {
      console.error('❌ Socket.io не загружен!');
    } else {
      console.log('✅ Socket.io доступен');
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
    }
  }, []);

  return (
    <AppProvider>
      <LanguageProvider>
        <Component {...pageProps} />
      </LanguageProvider>
    </AppProvider>
  );
}