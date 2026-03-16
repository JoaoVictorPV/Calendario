import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Login } from './components/Login';
import { Calendar } from './components/Calendar';
import { DayModal } from './components/DayModal';
import { UpcomingEvents } from './components/UpcomingEvents';
import { TagManager } from './components/TagManager';
import { BatchModal } from './components/BatchModal';
import { migrateLocalData } from './lib/migration';
import { Moon, Sun, LogOut, Tag, CalendarPlus } from 'lucide-react';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Data State
  const [events, setEvents] = useState([]);
  const [tags, setTags] = useState([]);
  
  // UI State
  const [selectedDate, setSelectedDate] = useState(null);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('clepsidra_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem('clepsidra_theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      // Attempt migration first, then fetch data
      migrateLocalData(session.user).then(() => {
        fetchData();
      });
    }
  }, [session]);

  const fetchData = async () => {
    const { data: tagsData } = await supabase.from('tags').select('*');
    if (tagsData) setTags(tagsData);

    const { data: eventsData } = await supabase.from('events').select('*');
    if (eventsData) setEvents(eventsData);
  };

  const handleLogout = () => supabase.auth.signOut();

  if (loading) return <div className="h-screen flex items-center justify-center bg-background"><Sun className="animate-spin text-primary" /></div>;
  if (!session) return <Login />;

  return (
    <div className="min-h-screen font-sans selection:bg-primary/20 pb-20 sm:pb-0 relative bg-background text-foreground">

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-card rounded-xl shadow-sm border border-border">
              <Sun className="text-primary" size={24} />
            </div>
            <h1 className="text-xl font-medium tracking-tight text-foreground uppercase">
              AGENDA
            </h1>
          </div>
          
          <div className="flex gap-2">
            {/* Eventos em massa (mais à esquerda entre os botões de ação) */}
            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="p-2 rounded-lg bg-card border border-border hover:bg-secondary transition-all shadow-sm text-foreground"
              title="Adicionar em Massa"
            >
              <CalendarPlus size={20} />
            </button>

            {/* Tags */}
            <button
              onClick={() => setIsTagManagerOpen(true)}
              className="p-2 rounded-lg bg-card border border-border hover:bg-secondary transition-all shadow-sm text-foreground"
              title="Gerenciar Tags"
            >
              <Tag size={20} />
            </button>

            {/* Tema (fica à esquerda do deslogar) */}
            <button
              onClick={() => setIsDark(v => !v)}
              className="p-2 rounded-lg bg-card border border-border hover:bg-secondary transition-all shadow-sm text-foreground"
              title={isDark ? 'Modo claro' : 'Modo escuro'}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Deslogar (mais à direita) */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-destructive transition-all"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content (Scrollable) */}
      <div className="max-w-xl mx-auto p-6 pt-24 space-y-6 relative z-10">
        <Calendar 
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          events={events}
          tags={tags}
          onSelectDate={setSelectedDate}
        />

        <UpcomingEvents
          events={events}
          tags={tags}
        />
      </div>

      {/* Modals */}
      {selectedDate && (
        <DayModal 
          date={selectedDate} 
          onClose={() => setSelectedDate(null)}
          events={events}
          tags={tags}
          setEvents={setEvents}
          setTags={setTags}
          session={session}
        />
      )}

      {isTagManagerOpen && (
        <TagManager 
          onClose={() => setIsTagManagerOpen(false)}
          tags={tags}
          setTags={setTags}
        />
      )}

      {isBatchModalOpen && (
        <BatchModal 
          onClose={() => setIsBatchModalOpen(false)}
          tags={tags}
          onSuccess={fetchData}
        />
      )}

    </div>
  );
}

export default App;
