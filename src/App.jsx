import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, doc, setDoc, addDoc, 
  deleteDoc, updateDoc, onSnapshot, query 
} from "firebase/firestore";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { 
  Calendar, User, CheckCircle, AlertCircle, Trash2, 
  LayoutDashboard, Search, ChevronLeft, ChevronRight, 
  Plus, X, Printer, Lock, Layers, Check, Repeat, 
  LogOut, Key, ShieldCheck, Wrench, Download, 
  Maximize2, Minimize2, Ban, Code 
} from 'lucide-react';

// --- CONFIGURAÇÕES E INICIALIZAÇÃO FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "", // Mantido vazio conforme instrução técnica
      authDomain: "gestao-anisio.firebaseapp.com",
      projectId: "gestao-anisio",
      storageBucket: "gestao-anisio.firebasestorage.app",
      messagingSenderId: "946435999048",
      appId: "1:946435999048:web:a3cae6ed73c21a30b59f7d",
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'gestao-anisio';

// --- CONFIGURAÇÕES ESTÁTICAS ---
const LOGO_URL = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6Ec4LifAFMQyyiNmwrJQzn12IBBfV19LmOg&s";
const HORARIOS = [
  { id: 'h1', label: "07:10", type: "aula" },
  { id: 'h2', label: "08:00", type: "aula" },
  { id: 'h3', label: "08:50", type: "aula" },
  { id: 'int1', label: "09:40", type: "pausa", title: "Intervalo" },
  { id: 'h4', label: "10:00", type: "aula" },
  { id: 'h5', label: "10:50", type: "aula" },
  { id: 'alm', label: "11:40", type: "pausa", title: "Almoço" },
  { id: 'h6', label: "13:10", type: "aula" },
  { id: 'h7', label: "14:00", type: "aula" },
  { id: 'int2', label: "14:50", type: "pausa", title: "Intervalo" },
  { id: 'h8', label: "15:10", type: "aula" },
  { id: 'h9', label: "16:00", type: "aula" },
];
const DIAS_NOMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const SALAS = ["1A", "1ADM", "1PAV", "2A", "2B", "2C", "3A", "3B", "3C"];

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};
const formatDateToISO = (date) => date.toISOString().split('T')[0];
const formatWeekDisplay = (monday) => {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const options = { day: '2-digit', month: 'short' };
  return `${monday.toLocaleDateString('pt-BR', options)} - ${friday.toLocaleDateString('pt-BR', options)}`;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionUser, setSessionUser] = useState(null); 
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [bookings, setBookings] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [issues, setIssues] = useState([]);

  const [activeTab, setActiveTab] = useState('agenda'); 
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState(null);
  const [notification, setNotification] = useState(null);
  const [currentDayIndexMobile, setCurrentDayIndexMobile] = useState(0);
  const [isWeeklyMobile, setIsWeeklyMobile] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedResources, setSelectedResources] = useState([]);
  const [isDoubleBooking, setIsDoubleBooking] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newMaterial, setNewMaterial] = useState({ name: '', short: '', category: 'Projetor', color: 'bg-blue-600', isShareable: false });
  const [issueForm, setIssueForm] = useState({ materialId: '', text: '' });
  const [exportRange, setExportRange] = useState({ start: formatDateToISO(new Date()), end: formatDateToISO(new Date()) });

  // --- 1. AUTENTICAÇÃO FIREBASE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Erro auth:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. SINCRONIZAÇÃO FIRESTORE ---
  useEffect(() => {
    if (!currentUser) return;

    // Caminho público conforme regra 1
    const bookingsCol = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const materialsCol = collection(db, 'artifacts', appId, 'public', 'data', 'materials');
    const issuesCol = collection(db, 'artifacts', appId, 'public', 'data', 'issues');

    const unsubBookings = onSnapshot(bookingsCol, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Erro bookings:", err));

    const unsubMaterials = onSnapshot(materialsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Se estiver vazio, inicializar com padrão
      if (data.length === 0) {
        const defaults = [
          { name: 'Laboratório', short: 'LAB', category: 'Espaço', color: 'bg-emerald-500', isShareable: false },
          { name: 'Projetor 01', short: 'P1', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
          { name: 'Caixa de Som', short: 'SOM', category: 'Áudio', color: 'bg-purple-600', isShareable: false }
        ];
        defaults.forEach(m => addDoc(materialsCol, m));
      }
      setMaterials(data);
    });

    const unsubIssues = onSnapshot(issuesCol, (snapshot) => {
      setIssues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubBookings(); unsubMaterials(); unsubIssues(); };
  }, [currentUser]);

  // --- HANDLERS ---
  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = loginForm;
    const cleanUsername = username.trim().toUpperCase();
    if (cleanUsername === '') return setAuthError('Digite seu nome.');
    
    if (password === 'admin' || password === 'prof') {
      setSessionUser({ username: cleanUsername, isAdmin: password === 'admin' });
      setActiveTab('agenda');
    } else {
      setAuthError('Senha incorreta.');
      setTimeout(() => setAuthError(''), 3000);
    }
  };

  const handleLogout = () => {
    setSessionUser(null);
    setLoginForm({ username: '', password: '' });
  };

  const weekDates = useMemo(() => {
    return DIAS_NOMES.map((nome, index) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + index);
      return { nome, date: formatDateToISO(d), dateObj: d };
    });
  }, [currentMonday]);

  const checkResourceBusy = (resId, date, horarioId) => {
    const mat = materials.find(m => m.id === resId);
    if (mat && mat.isShareable) return false;
    return bookings.some(b => b.date === date && b.horarioId === horarioId && b.resources.includes(resId));
  };

  const saveBooking = async (e) => {
    e.preventDefault();
    if (!sessionUser || !selectedRoom || selectedResources.length === 0) return notify("Preencha todos os campos.", "error");

    const slotsToBook = [activeCell.horarioId];
    const nextAula = getNextAula(activeCell.horarioId);
    if (isDoubleBooking && nextAula) slotsToBook.push(nextAula.id);

    const hasConflict = slotsToBook.some(slotId => 
      selectedResources.some(resId => checkResourceBusy(resId, activeCell.date, slotId))
    );
    if (hasConflict) return notify("Item ocupado neste horário.", "error");

    try {
      const col = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
      for (const slotId of slotsToBook) {
        await addDoc(col, {
          teacher: sessionUser.username,
          room: selectedRoom,
          date: activeCell.date,
          horarioId: slotId,
          resources: selectedResources,
          isBlocked: false,
          createdAt: Date.now()
        });
      }
      notify("Agendamento salvo!");
      setModalOpen(false);
    } catch (err) {
      notify("Erro ao salvar.", "error");
    }
  };

  const deleteBooking = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id));
      notify("Agendamento removido.");
    } catch (err) {
      notify("Erro ao remover.", "error");
    }
  };

  const blockSchedule = async () => {
    if (!sessionUser?.isAdmin || !activeCell) return;
    try {
      const col = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
      await addDoc(col, {
        teacher: "ADMIN",
        room: "---",
        date: activeCell.date,
        horarioId: activeCell.horarioId,
        resources: materials.map(m => m.id),
        isBlocked: true,
        createdAt: Date.now()
      });
      setModalOpen(false);
      notify("Horário bloqueado!");
    } catch (err) {
      notify("Erro ao bloquear.", "error");
    }
  };

  const addMaterial = async (e) => {
    e.preventDefault();
    if (!newMaterial.name || !newMaterial.short) return;
    try {
      const col = collection(db, 'artifacts', appId, 'public', 'data', 'materials');
      await addDoc(col, newMaterial);
      setNewMaterial({ name: '', short: '', category: 'Projetor', color: 'bg-blue-600', isShareable: false });
      notify("Material cadastrado!");
    } catch (err) {
      notify("Erro ao salvar material.", "error");
    }
  };

  const reportIssue = async (e) => {
    e.preventDefault();
    if (!issueForm.materialId || !issueForm.text) return;
    const material = materials.find(m => m.id === issueForm.materialId);
    try {
      const col = collection(db, 'artifacts', appId, 'public', 'data', 'issues');
      await addDoc(col, {
        teacher: sessionUser.username,
        materialName: material?.name,
        text: issueForm.text,
        status: "pendente",
        date: new Date().toLocaleDateString('pt-BR')
      });
      setIssueForm({ materialId: '', text: '' });
      notify("Ocorrência enviada.");
    } catch (err) {
      notify("Erro ao enviar.", "error");
    }
  };

  const solveIssue = async (id) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'issues', id), {
        status: 'resolvido'
      });
      notify("Status atualizado.");
    } catch (err) {
      notify("Erro ao atualizar.", "error");
    }
  };

  const getNextAula = (horarioId) => {
    const onlyAulas = HORARIOS.filter(h => h.type === 'aula');
    const currentIndex = onlyAulas.findIndex(h => h.id === horarioId);
    return onlyAulas[currentIndex + 1] || null;
  };

  // --- RENDER LOGIN ---
  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
          <div className="bg-blue-600 p-10 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <img src={LOGO_URL} alt="Escola" className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-xl border-2 border-white/20 bg-white p-1" />
            <h1 className="text-xl font-black tracking-tight uppercase">EEMTI Anísio Teixeira</h1>
            <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mt-2">Agendamento Cloud</p>
          </div>
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Utilizador</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-800 uppercase" placeholder="SEU NOME" value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required type="password" title="admin para administrador, prof para professor" className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-800" placeholder="••••••••" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} />
              </div>
            </div>
            {authError && <div className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-xl flex items-center gap-2 animate-bounce"><AlertCircle size={14} /> {authError}</div>}
            <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg uppercase tracking-widest text-xs border-b-4 border-blue-800 active:border-b-0 active:translate-y-1">Entrar no Sistema</button>
            <p className="text-center text-[9px] font-bold text-slate-300 uppercase">Gestão LEI v2.0</p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-50 overflow-hidden font-sans text-slate-900 print:bg-white">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex shrink-0 z-20 print:hidden">
        <div className="p-8 flex flex-col items-center border-b border-slate-100">
          <img src={LOGO_URL} alt="Logo" className="w-12 h-12 rounded-xl shadow-md mb-3 bg-white p-1" />
          <div className="text-center">
            <h1 className="font-black text-slate-800 leading-tight text-xs tracking-tighter uppercase">ANÍSIO TEIXEIRA</h1>
            <p className="text-[8px] text-blue-500 font-black uppercase tracking-widest mt-1">LEI Persistence</p>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          <SideNavItem icon={<LayoutDashboard size={18}/>} label="Agenda Cloud" active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} />
          {sessionUser.isAdmin && (
            <>
              <SideNavItem icon={<Layers size={18}/>} label="Materiais" active={activeTab === 'materials'} onClick={() => setActiveTab('materials')} />
              <SideNavItem icon={<Download size={18}/>} label="Relatórios" active={activeTab === 'export'} onClick={() => setActiveTab('export')} />
            </>
          )}
          <SideNavItem icon={<Wrench size={18}/>} label="Ocorrências" active={activeTab === 'issues'} onClick={() => setActiveTab('issues')} />
          <SideNavItem icon={<Printer size={18}/>} label="Imprimir" active={false} onClick={() => window.print()} />
        </nav>
        <div className="p-6 border-t border-slate-100">
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-black text-[10px] text-white ${sessionUser.isAdmin ? 'bg-amber-500' : 'bg-blue-500'}`}>{sessionUser.username.charAt(0)}</div>
              <p className="text-[10px] font-black truncate uppercase text-slate-800">{sessionUser.username}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 ml-2"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden pb-20 lg:pb-0 print:overflow-visible">
        <header className="h-20 bg-white border-b border-slate-200 px-6 lg:px-10 flex items-center justify-between shrink-0 z-10 print:hidden">
          <div className="flex items-center gap-4">
             <div className="lg:hidden flex items-center gap-2">
               <img src={LOGO_URL} className="w-8 h-8 rounded-lg" alt="Logo" />
               <span className="font-black text-[10px] uppercase">{sessionUser.username}</span>
             </div>
             <div className="hidden lg:flex relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" placeholder="Filtrar professor/sala..." className="pl-11 pr-4 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl focus:border-blue-500 outline-none w-64 transition-all font-bold text-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl items-center border border-slate-200">
              <button onClick={() => setCurrentMonday(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })} className="p-1.5 bg-white rounded-lg shadow-sm text-slate-600 hover:text-blue-600"><ChevronLeft size={16}/></button>
              <span className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest min-w-[150px] text-center">{formatWeekDisplay(currentMonday)}</span>
              <button onClick={() => setCurrentMonday(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })} className="p-1.5 bg-white rounded-lg shadow-sm text-slate-600 hover:text-blue-600"><ChevronRight size={16}/></button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 print:p-0">
          {activeTab === 'agenda' && (
            <div className="space-y-6">
              <div className="lg:hidden flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                {weekDates.map((item, index) => (
                  <button key={item.date} onClick={() => setCurrentDayIndexMobile(index)} className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase transition-all flex flex-col items-center min-w-[80px] border ${currentDayIndexMobile === index ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <span>{item.nome}</span>
                    <span className="opacity-70">{item.dateObj.getDate()}/{item.dateObj.getMonth() + 1}</span>
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden print:shadow-none print:border-slate-300">
                <table className="w-full border-collapse">
                  <thead className="hidden lg:table-header-group">
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="w-24 p-6 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100">Horário</th>
                      {weekDates.map((item) => (
                        <th key={item.date} className="p-6 text-center border-r border-slate-100 last:border-r-0">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase">{item.nome}</span>
                            <span className="text-[11px] text-blue-600 font-black mt-1">{item.dateObj.getDate()}/{item.dateObj.getMonth() + 1}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {HORARIOS.map((horario) => (
                      <tr key={horario.id} className={horario.type === 'pausa' ? 'bg-slate-50/50' : ''}>
                        <td className="w-20 p-4 lg:p-6 border-r border-slate-100 text-center align-middle">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-800">{horario.label}</span>
                            {horario.title && <span className="text-[7px] font-black text-blue-500 uppercase mt-1 tracking-tighter">{horario.title}</span>}
                          </div>
                        </td>
                        {weekDates.map((item, index) => {
                          const isVisible = index === currentDayIndexMobile;
                          const dayBookings = bookings.filter(b => b.date === item.date && b.horarioId === horario.id && (searchTerm === "" || b.teacher.includes(searchTerm.toUpperCase()) || b.room.includes(searchTerm.toUpperCase())));
                          
                          if (horario.type === 'pausa') return <td key={`${item.date}-${horario.id}`} className={`p-4 border-r border-slate-50 ${!isVisible ? 'hidden lg:table-cell' : ''}`}></td>;
                          
                          return (
                            <td key={`${item.date}-${horario.id}`} className={`p-2 lg:p-3 border-r border-slate-50 relative min-h-[120px] align-top transition-all hover:bg-slate-50/50 ${!isVisible ? 'hidden lg:table-cell' : ''}`}>
                              <div className="space-y-2">
                                {dayBookings.map(b => (
                                  <div key={b.id} className={`p-3 rounded-2xl relative shadow-md border ${b.isBlocked ? 'bg-slate-800 text-white border-slate-700' : 'bg-white border-slate-200 text-slate-900 group/card'}`}>
                                    <div className="flex justify-between items-start mb-2 pr-4">
                                      <div className="min-w-0">
                                        <p className="text-[9px] font-black leading-none truncate uppercase">{b.isBlocked ? "BLOQUEADO" : b.teacher}</p>
                                        <p className={`text-[8px] font-bold uppercase mt-1 ${b.isBlocked ? 'text-slate-500' : 'text-blue-500'}`}>{b.room}</p>
                                      </div>
                                      {b.isBlocked && <Ban size={12} className="text-red-500" />}
                                    </div>
                                    {!b.isBlocked && (
                                      <div className="flex flex-wrap gap-1">
                                        {b.resources.map(resId => {
                                          const res = materials.find(r => r.id === resId);
                                          return res ? (
                                            <div key={resId} className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-lg">
                                              <div className={`w-1 h-1 rounded-full ${res.color}`} />
                                              <span className="text-[7px] font-black text-slate-500 uppercase">{res.short}</span>
                                            </div>
                                          ) : null;
                                        })}
                                      </div>
                                    )}
                                    {(sessionUser.isAdmin || b.teacher === sessionUser.username) && (
                                      <button onClick={() => deleteBooking(b.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 lg:opacity-0 group-hover/card:opacity-100 transition-all p-1 print:hidden"><Trash2 size={12} /></button>
                                    )}
                                  </div>
                                ))}
                                {dayBookings.length === 0 && (
                                  <button onClick={() => { setActiveCell({date: item.date, horarioId: horario.id}); setModalOpen(true); }} className="w-full h-12 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl opacity-0 hover:opacity-100 hover:bg-blue-50/30 transition-all print:hidden">
                                    <Plus size={16} className="text-blue-400" />
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'materials' && (
             <div className="max-w-4xl mx-auto space-y-6">
               <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-4">
                 <h2 className="text-lg font-black uppercase">Novo Material</h2>
                 <form onSubmit={addMaterial} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <input className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-xs" placeholder="Nome" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} />
                   <input className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-xs uppercase" placeholder="Sigla" value={newMaterial.short} onChange={e => setNewMaterial({...newMaterial, short: e.target.value})} />
                   <select className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-xs" value={newMaterial.color} onChange={e => setNewMaterial({...newMaterial, color: e.target.value})}>
                     <option value="bg-blue-600">Azul</option>
                     <option value="bg-emerald-600">Verde</option>
                     <option value="bg-purple-600">Roxo</option>
                     <option value="bg-amber-600">Laranja</option>
                   </select>
                   <button type="submit" className="bg-blue-600 text-white rounded-xl font-black uppercase text-[10px]">Cadastrar</button>
                 </form>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 {materials.map(m => (
                   <div key={m.id} className="p-4 bg-white rounded-2xl flex items-center justify-between border border-slate-200 shadow-sm">
                     <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl ${m.color} flex items-center justify-center text-white font-black text-xs`}>{m.short}</div>
                       <span className="font-bold text-xs uppercase text-slate-700">{m.name}</span>
                     </div>
                     <button onClick={async () => await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', m.id))} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                   </div>
                 ))}
               </div>
             </div>
          )}

          {activeTab === 'issues' && (
             <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl">
                   <h2 className="text-lg font-black uppercase mb-4">Reportar Problema</h2>
                   <div className="flex gap-3">
                      <select className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-xs flex-1" value={issueForm.materialId} onChange={e => setIssueForm({...issueForm, materialId: e.target.value})}>
                         <option value="">Escolha o item...</option>
                         {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <input className="flex-[2] p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-xs" placeholder="Descreva o defeito..." value={issueForm.text} onChange={e => setIssueForm({...issueForm, text: e.target.value})} />
                      <button onClick={reportIssue} className="p-3 bg-slate-800 text-white rounded-xl"><Plus size={20}/></button>
                   </div>
                </div>
                <div className="grid gap-3">
                   {issues.map(i => (
                     <div key={i.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                        <div>
                           <p className="font-black text-xs uppercase text-slate-800">{i.materialName}</p>
                           <p className="text-xs text-slate-500 italic mt-1">"{i.text}"</p>
                           <p className="text-[8px] text-slate-400 mt-1 uppercase font-bold">{i.teacher} em {i.date}</p>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${i.status === 'resolvido' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{i.status}</span>
                           {sessionUser.isAdmin && i.status === 'pendente' && <button onClick={() => solveIssue(i.id)} className="text-blue-500 hover:underline text-[9px] font-black uppercase">Resolver</button>}
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          )}
        </div>

        {notification && (
          <div className={`fixed bottom-24 lg:bottom-10 right-4 lg:right-10 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-[1000] animate-in slide-in-from-bottom border-l-4 ${notification.type === 'error' ? 'bg-slate-900 border-red-500 text-white' : 'bg-slate-900 border-green-500 text-white'}`}>
             <span className="text-[10px] font-black uppercase tracking-widest">{notification.message}</span>
          </div>
        )}
      </main>

      {/* Navegação Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-200 flex items-center justify-around px-4 z-40 print:hidden">
        <MobileNavItem icon={<LayoutDashboard size={20} />} label="Agenda" active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} />
        <MobileNavItem icon={<Wrench size={20} />} label="Alertas" active={activeTab === 'issues'} onClick={() => setActiveTab('issues')} />
        {sessionUser.isAdmin && <MobileNavItem icon={<Layers size={20} />} label="Gerir" active={activeTab === 'materials'} onClick={() => setActiveTab('materials')} />}
        <button onClick={handleLogout} className="flex-1 flex flex-col items-center justify-center gap-1 text-slate-400">
          <LogOut size={20} /><span className="text-[8px] font-black uppercase">Sair</span>
        </button>
      </div>

      {/* Modal Reserva */}
      {modalOpen && activeCell && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-blue-600 p-8 text-white relative">
              <h2 className="text-xl font-black uppercase">Novo Agendamento</h2>
              <p className="text-blue-100 text-[9px] font-bold uppercase mt-1">
                {new Date(activeCell.date + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'long'})}
              </p>
              <button onClick={() => setModalOpen(false)} className="absolute top-6 right-6 text-white/50 hover:text-white"><X size={20}/></button>
            </div>
            
            <form onSubmit={saveBooking} className="p-8 space-y-6">
              {sessionUser.isAdmin && (
                <button type="button" onClick={blockSchedule} className="w-full py-3 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-black text-[9px] uppercase flex items-center justify-center gap-2 hover:bg-slate-200">
                  <Ban size={14} className="text-red-500" /> Bloquear Horário
                </button>
              )}

              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Turma</label>
                <div className="grid grid-cols-3 gap-2">
                  {SALAS.map(sala => (
                    <button key={sala} type="button" onClick={() => setSelectedRoom(sala)} className={`py-3 rounded-xl border-2 text-[10px] font-black transition-all ${selectedRoom === sala ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>
                      {sala}
                    </button>
                  ))}
                </div>
              </div>
              
              {getNextAula(activeCell.horarioId) && (
                <div className="bg-blue-50 p-4 rounded-2xl flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-blue-900">Aula Geminada?</span>
                  <button type="button" onClick={() => setIsDoubleBooking(!isDoubleBooking)} className={`w-12 h-6 rounded-full transition-all relative ${isDoubleBooking ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isDoubleBooking ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Materiais</label>
                <div className="grid grid-cols-2 gap-2">
                  {materials.map(res => {
                    const isBusy = checkResourceBusy(res.id, activeCell.date, activeCell.horarioId);
                    const itemLocked = isBusy || (isDoubleBooking && getNextAula(activeCell.horarioId) && checkResourceBusy(res.id, activeCell.date, getNextAula(activeCell.horarioId).id));
                    const isSelected = selectedResources.includes(res.id);
                    return (
                      <button key={res.id} type="button" disabled={itemLocked} onClick={() => setSelectedResources(prev => prev.includes(res.id) ? prev.filter(r => r !== res.id) : [...prev, res.id])} className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${itemLocked ? 'bg-slate-50 opacity-30 border-dashed' : isSelected ? 'border-blue-600 bg-blue-50 text-blue-700 font-black' : 'bg-white border-slate-100 text-slate-600'}`}>
                        <span className="text-[9px] font-black uppercase">{res.name}</span>
                        {isSelected && <Check size={12} className="text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-blue-700 active:scale-95 transition-all">Confirmar Agendamento</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SideNavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}>
      {icon} <span className="text-[11px] font-bold uppercase tracking-tight">{label}</span>
    </button>
  );
}

function MobileNavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-blue-600' : 'text-slate-400'}`}>
      {icon}
      <span className="text-[8px] font-black uppercase">{label}</span>
    </button>
  );
}