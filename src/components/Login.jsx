import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sun, AlertTriangle } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  
  const isConfigured = !!import.meta.env.VITE_SUPABASE_URL;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!isConfigured) return;
    
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      alert(error.error_description || error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl p-8 shadow-sm border border-border text-center">
        
        {!isConfigured && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm text-left border border-red-100 flex gap-3">
             <AlertTriangle className="shrink-0" size={20} />
             <div>
               <p className="font-bold">Configuração Necessária</p>
               <p>Crie o arquivo <code>.env</code> com suas chaves do Supabase para iniciar.</p>
             </div>
          </div>
        )}

        <div className="flex justify-center mb-6">
           <div className="p-3 bg-primary/10 rounded-full">
            <Sun className="text-primary w-8 h-8" />
           </div>
        </div>
        
        <h1 className="text-2xl font-medium text-foreground mb-2">Agenda On-Line</h1>
        <p className="text-muted-foreground mb-8 text-sm">Organize sua rotina com leveza.</p>

        {sent ? (
          <div className="bg-secondary/50 p-4 rounded-lg text-sm text-foreground">
            <p>Link de acesso enviado!</p>
            <p className="mt-2 text-muted-foreground">Verifique seu e-mail ({email}) para entrar.</p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Seu e-mail"
              className="w-full p-3 rounded-lg bg-input border-transparent focus:border-primary outline-none transition-all placeholder:text-muted-foreground/50 text-foreground"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!isConfigured}
            />
            <button
              type="submit"
              disabled={loading || !isConfigured}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando...' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
