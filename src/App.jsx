import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Login } from './components/Login';
import { Calendar } from './components/Calendar';
import { DayModal } from './components/DayModal';
import { Timeline } from './components/Timeline';
import { TagManager } from './components/TagManager';
import { migrateLocalData } from './lib/migration';
import { Sun, LogOut, List, Tag } from 'lucide-react';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Data State
  const [events, setEvents] = useState([]);
  const [tags, setTags] = useState([]);
  
  // UI State
  const [selectedDate, setSelectedDate] = useState(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);

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
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 pb-20 sm:pb-0">
      <div className="max-w-xl mx-auto p-6 space-y-6">
        
        {/* Header */}
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm border border-border">
              <Sun className="text-primary" size={24} />
            </div>
            <h1 className="text-xl font-medium tracking-tight text-foreground">
              Agenda On-Line
            </h1>
          </div>
          
          <div className="flex gap-2">
             <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-destructive transition-all"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
            <button
              onClick={() => setIsTagManagerOpen(true)}
              className="p-2 rounded-lg bg-white border border-border hover:bg-secondary transition-all shadow-sm text-foreground"
              title="Gerenciar Tags"
            >
              <Tag size={20} />
            </button>
            <button
              onClick={() => setIsTimelineOpen(true)}
              className="p-2 rounded-lg bg-white border border-border hover:bg-secondary transition-all shadow-sm text-foreground"
              title="Timeline"
            >
              <List size={20} />
            </button>
          </div>
        </header>

        <Calendar 
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          events={events}
          tags={tags}
          onSelectDate={setSelectedDate}
        />

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

        {isTimelineOpen && (
           <Timeline 
             onClose={() => setIsTimelineOpen(false)}
             events={events}
             tags={tags}
           />
        )}
        
        {isTagManagerOpen && (
          <TagManager 
            onClose={() => setIsTagManagerOpen(false)}
            tags={tags}
            setTags={setTags}
          />
        )}

      </div>
    </div>
  );
}

export default App;
