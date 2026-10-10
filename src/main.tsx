// src/main.tsx - Version CORRIGÉE
import { supabase } from './lib/supabase';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Désactiver les logs en production
if (import.meta.env.PROD) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

// ⚠️ SUPPRIMEZ CET APPEL - il cause le problème
// const resetAuth = async () => {
//   try {
//     await supabase.auth.signOut();
//     localStorage.removeItem('supabase.auth.token');
//     sessionStorage.removeItem('supabase.auth.token');
//     console.log('🔧 Reset auth effectué');
//   } catch (error) {
//     console.error('❌ Erreur reset auth:', error);
//   }
// };
// resetAuth();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
