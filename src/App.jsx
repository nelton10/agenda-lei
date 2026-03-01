import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, updateDoc, deleteDoc, getDoc, query } from 'firebase/firestore';
import { 
  Calendar, User, CheckCircle, AlertCircle, Trash2, LayoutDashboard, Search, 
  ChevronLeft, ChevronRight, Plus, X, Monitor, Lock, Home, ChevronDown, 
  Layers, Check, Repeat, LogOut, Key, ShieldCheck, PlusCircle, Wrench, 
  MessageSquare, Download, FileText, Briefcase
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'lab-anisio-teixeira';

// --- CONFIGURAÇÕES ESTÁTICAS ---
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

// --- FUNÇÕES UTILITÁRIAS ---
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
  // --- ESTADOS DE AUTENTICAÇÃO ---
  const [currentUser, setCurrentUser] = useState(null); 
  const [loginForm, setLoginForm] = useState({ username: '', password: '', remember: true });
  const [authError, setAuthError] = useState('');
  const [loadingSession, setLoadingSession] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState(null);

  // --- ESTADOS DE DADOS ---
  const [bookings, setBookings] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [issues, setIssues] = useState([]);

  // --- INTERFACE ---
  const [activeTab, setActiveTab] = useState('agenda'); 
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState(null);
  const [notification, setNotification] = useState(null);
  const [currentDayIndexMobile, setCurrentDayIndexMobile] = useState(0);
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  
  // FORMULÁRIOS
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedResources, setSelectedResources] = useState([]);
  const [isDoubleBooking, setIsDoubleBooking] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newMaterial, setNewMaterial] = useState({ name: '', short: '', category: 'Projetor', color: 'bg-blue-600', isShareable: false });
  const [issueForm, setIssueForm] = useState({ materialId: '', text: '' });
  const [exportRange, setExportRange] = useState({ start: formatDateToISO(new Date()), end: formatDateToISO(new Date()) });

  // --- 1. FIREBASE AUTH ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth init failure", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. RESTAURAR SESSÃO PERSISTENTE ---
  useEffect(() => {
    if (!firebaseUser) return;

    const recoverSession = async () => {
      try {
        const sessionRef = doc(db, 'artifacts', appId, 'users', firebaseUser.uid, 'settings', 'session');
        const snap = await getDoc(sessionRef);
        if (snap.exists()) {
          setCurrentUser(snap.data());
        }
      } catch (err) {
        console.error("Erro ao recuperar sessão:", err);
      } finally {
        setLoadingSession(false);
      }
    };
    recoverSession();
  }, [firebaseUser]);

  // --- 3. FIRESTORE SYNC ---
  useEffect(() => {
    if (!firebaseUser) return;

    const pathBase = ['artifacts', appId, 'public', 'data'];
    const bookingsCol = collection(db, ...pathBase, 'bookings');
    const materialsCol = collection(db, ...pathBase, 'materials');
    const issuesCol = collection(db, ...pathBase, 'issues');

    const unsubB = onSnapshot(bookingsCol, (s) => {
      setBookings(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => console.error(e));
    
    const unsubM = onSnapshot(materialsCol, (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length === 0) {
        const defaults = [
          { id: 'lab', name: 'Laboratório', short: 'LAB', category: 'Espaço', color: 'bg-emerald-500', isShareable: false },
          { id: 'p1', name: 'Projetor 01', short: 'P1', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
          { id: 'p2', name: 'Projetor 02', short: 'P2', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
          { id: 'p3', name: 'Projetor 03', short: 'P3', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
          { id: 'som', name: 'Caixa de Som', short: 'SOM', category: 'Áudio', color: 'bg-purple-600', isShareable: false },
          { id: 'ext', name: 'Extensão', short: 'EXT', category: 'Acessório', color: 'bg-amber-600', isShareable: true },
        ];
        defaults.forEach(m => setDoc(doc(materialsCol, m.id), m));
      } else {
        setMaterials(data);
      }
    });

    const unsubI = onSnapshot(issuesCol, (s) => {
      setIssues(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubB(); unsubM(); unsubI(); };
  }, [firebaseUser]);

  // --- LÓGICA ---
  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { username, password, remember } = loginForm;
    const cleanName = username.trim().toUpperCase();
    if (!cleanName) return setAuthError('Nome obrigatório.');

    let userObj = null;
    if (password === 'admin') {
      userObj = { username: cleanName, isAdmin: true };
    } else if (password === 'prof') {
      userObj = { username: cleanName, isAdmin: false };
    } else {
      setAuthError('Senha inválida.');
      setTimeout(() => setAuthError(''), 3000);
      return;
    }

    if (remember && firebaseUser) {
      try {
        const sessionRef = doc(db, 'artifacts', appId, 'users', firebaseUser.uid, 'settings', 'session');
        await setDoc(sessionRef, userObj);
      } catch (err) {
        console.error("Erro ao salvar sessão:", err);
      }
    }

    setCurrentUser(userObj);
    setActiveTab('agenda');
  };

  const handleLogout = async () => {
    if (firebaseUser) {
      try {
        const sessionRef = doc(db, 'artifacts', appId, 'users', firebaseUser.uid, 'settings', 'session');
        await deleteDoc(sessionRef);
      } catch (err) {
        console.error("Erro ao remover sessão:", err);
      }
    }
    setCurrentUser(null);
    setLoginForm({ username: '', password: '', remember: false });
  };

  const handleOpenModal = (date, horarioId) => {
    setActiveCell({ date, horarioId });
    setModalOpen(true);
    setIsDoubleBooking(false);
    setSelectedResources([]);
    setSelectedRoom("");
  };

  const getNextAula = (horarioId) => {
    const onlyAulas = HORARIOS.filter(h => h.type === 'aula');
    const currentIndex = onlyAulas.findIndex(h => h.id === horarioId);
    return onlyAulas[currentIndex + 1] || null;
  };

  const checkResourceBusy = (resId, date, horarioId) => {
    const mat = materials.find(m => m.id === resId);
    if (!mat || mat.isShareable) return false;
    return bookings.some(b => b.date === date && b.horarioId === horarioId && b.resources.includes(resId));
  };

  const saveBooking = async (e) => {
    e.preventDefault();
    if (!selectedRoom || selectedResources.length === 0) return notify("Campos incompletos.", "error");

    const slots = [activeCell.horarioId];
    const nextAula = getNextAula(activeCell.horarioId);

    if (isDoubleBooking && nextAula) slots.push(nextAula.id);

    const conflict = slots.some(s => selectedResources.some(r => checkResourceBusy(r, activeCell.date, s)));
    if (conflict) return notify("Item ocupado!", "error");

    try {
      const col = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
      for (const s of slots) {
        await addDoc(col, {
          teacher: currentUser.username,
          room: selectedRoom,
          date: activeCell.date,
          horarioId: s,
          resources: selectedResources,
          createdAt: Date.now()
        });
      }
      notify("Agendado com sucesso!");
      setModalOpen(false);
    } catch (err) {
      notify("Erro na gravação.", "error");
    }
  };

  const deleteBooking = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id));
      notify("Reserva removida.");
    } catch (err) {
      notify("Erro ao remover.", "error");
    }
  };

  const addMaterial = async (e) => {
    e.preventDefault();
    if (!newMaterial.name || !newMaterial.short) return;
    try {
      const col = collection(db, 'artifacts', appId, 'public', 'data', 'materials');
      await addDoc(col, { ...newMaterial, createdAt: Date.now() });
      setNewMaterial({ name: '', short: '', category: 'Projetor', color: 'bg-blue-600', isShareable: false });
      notify("Material cadastrado!");
    } catch (err) {
      notify("Erro no cadastro.", "error");
    }
  };

  const reportIssue = async (e) => {
    e.preventDefault();
    if (!issueForm.materialId || !issueForm.text) return;
    const mat = materials.find(m => m.id === issueForm.materialId);
    try {
      const col = collection(db, 'artifacts', appId, 'public', 'data', 'issues');
      await addDoc(col, {
        teacher: currentUser.username,
        materialName: mat?.name || 'Item',
        text: issueForm.text,
        status: "pendente",
        date: new Date().toLocaleDateString('pt-BR')
      });
      setIssueForm({ materialId: '', text: '' });
      notify("Alerta enviado.");
    } catch (err) {
      notify("Erro ao alertar.", "error");
    }
  };

  const exportToExcel = () => {
    const filtered = bookings.filter(b => b.date >= exportRange.start && b.date <= exportRange.end);
    if (filtered.length === 0) return notify("Sem dados.", "error");

    let csv = "\uFEFF"; 
    csv += "data;aula;professor;sala;material 1;material 2;material 3\n";
    filtered.forEach(b => {
      const aula = HORARIOS.find(h => h.id === b.horarioId)?.label || b.horarioId;
      const resNames = b.resources.map(id => materials.find(m => m.id === id)?.name || id);
      csv += `${b.date};${aula};${b.teacher};${b.room};${resNames[0]||""};${resNames[1]||""};${resNames[2]||""}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `EEMTI_Agendamentos.csv`;
    link.click();
    notify("Planilha exportada.");
  };

  const weekDates = useMemo(() => {
    return DIAS_NOMES.map((nome, index) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + index);
      return { nome, date: formatDateToISO(d), dateObj: d };
    });
  }, [currentMonday]);

  // Variavel calculada para evitar ReferenceError no modal
  const modalNextAula = activeCell ? getNextAula(activeCell.horarioId) : null;

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-5">
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-800 font-black uppercase tracking-widest text-sm">EEMTI Anísio Teixeira</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-500">
          <div className="bg-blue-600 p-12 text-white text-center shadow-lg">
            <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 backdrop-blur-lg border border-white/30 text-white shadow-lg">
              <Monitor size={36} />
            </div>
            <h1 className="text-2xl font-black tracking-tight uppercase leading-none text-white">EEMTI Anísio Teixeira</h1>
            <p className="text-blue-100 text-[10px] font-black uppercase tracking-[0.3em] mt-3">Portal de Agendamento LEI</p>
          </div>
          <form onSubmit={handleLogin} className="p-10 space-y-7">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Utilizador / Nome</label>
              <div className="relative text-slate-900">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold uppercase shadow-inner text-slate-900" placeholder="SEU NOME" value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative text-slate-900">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required type="password" name="password" className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold shadow-inner text-slate-900" placeholder="••••••••" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} />
              </div>
            </div>
            <div className="flex items-center gap-3 ml-1 group cursor-pointer" onClick={() => setLoginForm({...loginForm, remember: !loginForm.remember})}>
              <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${loginForm.remember ? 'bg-blue-600 border-blue-600 shadow-md scale-110' : 'border-slate-200 bg-slate-50'}`}>
                {loginForm.remember && <Check size={16} className="text-white" strokeWidth={4} />}
              </div>
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Permanecer conectado</span>
            </div>
            {authError && <div className="bg-red-50 text-red-500 text-xs font-bold p-4 rounded-xl flex items-center gap-2 animate-bounce"><AlertCircle size={14} /> {authError}</div>}
            <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[1.8rem] font-black hover:bg-blue-700 transition-all shadow-xl flex items-center justify-center gap-2 uppercase text-sm border-b-4 border-blue-900 active:border-b-0 active:translate-y-1">Entrar no Sistema</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
        <div className="p-8 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200 text-white"><Monitor size={24} /></div>
          <div><h1 className="font-black text-slate-800 leading-tight text-sm tracking-tighter uppercase">LEI ANÍSIO</h1><p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest leading-none mt-1">EEMTI A. Teixeira</p></div>
        </div>
        <nav className="flex-1 px-4 space-y-1.5 mt-2">
          <SideNavItem icon={<LayoutDashboard size={18}/>} label="Agenda Semanal" active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} />
          {currentUser.isAdmin && (
            <>
              <SideNavItem icon={<Layers size={18}/>} label="Gerir Materiais" active={activeTab === 'materials'} onClick={() => setActiveTab('materials')} />
              <SideNavItem icon={<Download size={18}/>} label="Exportar Excel" active={activeTab === 'export'} onClick={() => setActiveTab('export')} />
            </>
          )}
          <SideNavItem icon={<Wrench size={18}/>} label="Ocorrências" active={activeTab === 'issues'} onClick={() => setActiveTab('issues')} />
        </nav>
        <div className="p-6 border-t border-slate-100 bg-slate-50/30 text-slate-900">
          <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white ${currentUser.isAdmin ? 'bg-amber-500 shadow-amber-200' : 'bg-blue-500 shadow-blue-200'} shadow-md`}>
                {currentUser.username.substring(0, 1)}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-800 truncate uppercase">{currentUser.username}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{currentUser.isAdmin ? 'Admin' : 'Docente'}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-slate-300 hover:text-red-500 transition-colors ml-2"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden pb-20 lg:pb-0">
        <header className="h-auto lg:h-20 bg-white border-b border-slate-200 px-4 lg:px-10 py-4 lg:py-0 flex flex-col lg:flex-row lg:items-center justify-between shrink-0 gap-4 z-10 text-slate-900 shadow-sm">
          <div className="flex items-center justify-between w-full lg:w-auto text-slate-900">
             <div className="flex items-center gap-3 lg:hidden text-slate-900 font-black">
               <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-md shadow-blue-200"><Monitor size={16} /></div>
               <h1 className="text-xs uppercase tracking-tighter">{currentUser.username}</h1>
               <button onClick={handleLogout} className="p-2 text-slate-400 ml-auto bg-slate-50 rounded-xl"><LogOut size={16}/></button>
             </div>
             {activeTab === 'agenda' && (
               <div className="relative group flex-1 lg:flex-none mx-4 lg:mx-0 text-slate-900">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500" size={16} />
                  <input type="text" placeholder="Filtrar docente ou sala..." className="pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white outline-none w-full lg:w-80 transition-all font-bold text-slate-800 text-xs shadow-inner text-slate-900 font-black" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
               </div>
             )}
          </div>
          {activeTab === 'agenda' && (
            <div className="flex bg-slate-100 border border-slate-200 p-1.5 rounded-[1.2rem] items-center shadow-inner">
              <button onClick={() => setCurrentMonday(p => { const d = new Date(p); d.setDate(d.getDate() - 7); return d; })} className="p-2 bg-white rounded-xl shadow-sm text-slate-600 hover:text-blue-600 transition-all border border-slate-100"><ChevronLeft size={18}/></button>
              <span className="px-6 text-[10px] lg:text-xs font-black text-slate-600 uppercase tracking-widest min-w-[160px] text-center">{formatWeekDisplay(currentMonday)}</span>
              <button onClick={() => setCurrentMonday(p => { const d = new Date(p); d.setDate(d.getDate() + 7); return d; })} className="p-2 bg-white rounded-xl shadow-sm text-slate-600 hover:text-blue-600 transition-all border border-slate-100"><ChevronRight size={18}/></button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-10 text-slate-900 bg-[#FBFDFF]">
          {activeTab === 'agenda' && (
            <div className="space-y-6">
              <div className="lg:hidden flex overflow-x-auto gap-3 pb-2 scrollbar-hide text-slate-900 font-black">
                {weekDates.map((item, index) => (
                  <button key={item.date} onClick={() => setCurrentDayIndexMobile(index)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex flex-col items-center min-w-[100px] border shadow-md ${currentDayIndexMobile === index ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-105' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <span>{item.nome}</span>
                    <span className="text-[9px] font-bold mt-1 opacity-70">{item.dateObj.getDate()}/{item.dateObj.getMonth() + 1}</span>
                  </button>
                ))}
              </div>

              <div className="lg:min-w-[1100px] bg-white rounded-[2.5rem] lg:rounded-[3.5rem] border border-slate-200 shadow-2xl overflow-hidden">
                <table className="w-full border-collapse table-fixed">
                  <thead className="hidden lg:table-header-group text-slate-900 font-black">
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="w-28 p-8 text-left text-[10px] uppercase border-r border-slate-200 tracking-widest font-black">Horário</th>
                      {weekDates.map(item => (
                        <th key={item.date} className="p-8 text-center border-r border-slate-100 last:border-r-0 tracking-widest uppercase text-slate-900 font-black">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-400 leading-none uppercase">{item.nome}</span>
                            <span className="text-[12px] text-blue-600 font-black mt-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 shadow-sm">{item.dateObj.getDate()} / {item.dateObj.getMonth() + 1}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-900">
                    {HORARIOS.map((horario) => (
                      <tr key={horario.id} className={horario.type === 'pausa' ? 'bg-slate-50/40' : ''}>
                        <td className="w-16 lg:w-28 p-4 lg:p-8 border-r border-slate-100 text-center align-middle shrink-0 font-black">
                          <div className="flex flex-col items-center text-slate-900">
                            <span className="text-[11px] lg:text-xs font-black leading-none">{horario.label}</span>
                            {horario.title && <span className="text-[7px] lg:text-[8px] font-black text-blue-500 uppercase mt-2 tracking-widest whitespace-nowrap bg-blue-50 px-2 py-1 rounded-md shadow-sm border border-blue-100">{horario.title}</span>}
                          </div>
                        </td>
                        {weekDates.map((item, index) => {
                          const isVisible = index === currentDayIndexMobile;
                          const dayBookings = bookings.filter(b => b.date === item.date && b.horarioId === horario.id && (searchTerm === "" || b.teacher.includes(searchTerm.toUpperCase()) || b.room.includes(searchTerm.toUpperCase())));
                          if (horario.type === 'pausa') return <td key={`${item.date}-${horario.id}`} className={`p-4 border-r border-slate-100 last:border-r-0 ${!isVisible ? 'hidden lg:table-cell' : ''}`}></td>;
                          return (
                            <td key={`${item.date}-${horario.id}`} className={`p-2 lg:p-3.5 border-r border-slate-50 last:border-r-0 group relative min-h-[130px] lg:min-h-[160px] align-top transition-colors hover:bg-blue-50/10 ${!isVisible ? 'hidden lg:table-cell' : ''}`}>
                              <div className="space-y-3">
                                {dayBookings.map(b => (
                                  <div key={b.id} className="bg-white border border-slate-200 p-4 rounded-[1.8rem] group/card relative shadow-lg shadow-slate-200/50 hover:shadow-xl hover:border-blue-300 transition-all animate-in fade-in">
                                    <div className="flex justify-between items-start mb-3 pr-2 min-w-0">
                                      <div className="min-w-0">
                                        <p className="text-[10px] lg:text-[11px] font-black leading-none truncate uppercase tracking-tight text-slate-900">{b.teacher}</p>
                                        <p className="text-[9px] font-bold text-blue-600 uppercase mt-1 tracking-widest bg-blue-50 w-fit px-1.5 rounded-md">{b.room}</p>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {b.resources.map(resId => {
                                        const res = materials.find(r => r.id === resId);
                                        return res ? (
                                          <div key={resId} className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 py-1 rounded-xl shadow-sm">
                                            <div className={`w-1.5 h-1.5 rounded-full ${res.color}`} />
                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">{res.short}</span>
                                          </div>
                                        ) : null;
                                      })}
                                    </div>
                                    {(currentUser.isAdmin || b.teacher === currentUser.username) && (
                                      <button onClick={(e) => { e.stopPropagation(); deleteBooking(b.id); }} className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 shadow-xl border border-slate-100 opacity-0 group-hover/card:opacity-100 transition-all p-2 rounded-full z-20 hover:scale-110 active:scale-90 shadow-red-100 text-slate-400">
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <div className="h-12 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-[1.8rem] opacity-30 hover:opacity-100 cursor-pointer transition-all hover:bg-white hover:border-blue-200 hover:shadow-md" onClick={() => handleOpenModal(item.date, horario.id)}>
                                    <Plus size={20} className="text-slate-300 group-hover:text-blue-500" />
                                </div>
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

          {activeTab === 'export' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-right duration-500 text-slate-900">
               <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-2xl space-y-10">
                 <h2 className="text-2xl font-black uppercase tracking-tight text-center leading-tight text-slate-900">Exportar Relatório Excel</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-3 text-slate-900 font-bold">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Data Início</label>
                     <input type="date" className="w-full px-6 py-4.5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 font-black outline-none shadow-inner text-slate-900" value={exportRange.start} onChange={e => setExportRange({...exportRange, start: e.target.value})} />
                   </div>
                   <div className="space-y-3 text-slate-900 font-bold">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Data Fim</label>
                     <input type="date" className="w-full px-6 py-4.5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 font-black outline-none shadow-inner text-slate-900" value={exportRange.end} onChange={e => setExportRange({...exportRange, end: e.target.value})} />
                   </div>
                 </div>
                 <button onClick={exportToExcel} className="w-full py-6 bg-blue-600 text-white font-black rounded-[2.5rem] hover:bg-blue-700 transition-all shadow-xl flex items-center justify-center gap-4 uppercase text-sm border-b-4 border-blue-900 active:border-b-0 active:translate-y-1 tracking-[0.1em]">Gerar Planilha .CSV <Download size={24}/></button>
               </div>
            </div>
          )}

          {activeTab === 'materials' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in text-slate-900 font-black font-black font-black font-black">
               <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-8 text-slate-900 font-black">
                 <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 text-slate-900"><ShieldCheck className="text-blue-600" size={32}/> Gerir Materiais</h2>
                 <form onSubmit={addMaterial} className="grid grid-cols-1 md:grid-cols-5 gap-5 font-bold">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome</label><input className="w-full px-5 py-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-900 font-black" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} placeholder="Projetor 08" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Sigla</label><input className="w-full px-5 py-4 bg-slate-50 rounded-2xl border border-slate-100 uppercase text-slate-900 font-black" value={newMaterial.short} onChange={e => setNewMaterial({...newMaterial, short: e.target.value.toUpperCase()})} placeholder="P8" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Tipo</label><select className="w-full px-5 py-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-900 font-black font-bold" value={newMaterial.isShareable} onChange={e => setNewMaterial({...newMaterial, isShareable: e.target.value === "true"})}><option value="false">Unitário</option><option value="true">Livre</option></select></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Cor</label><select className="w-full px-5 py-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-900 font-black font-bold" value={newMaterial.color} onChange={e => setNewMaterial({...newMaterial, color: e.target.value})}><option value="bg-blue-600">Azul</option><option value="bg-emerald-600">Verde</option><option value="bg-purple-600">Roxo</option><option value="bg-red-600">Vermelho</option></select></div>
                    <button type="submit" className="md:mt-6 py-4.5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-lg text-xs uppercase active:scale-95 transition-transform border-b-4 border-blue-900">Salvar</button>
                 </form>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-slate-900 font-black">{materials.map(m => (<div key={m.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 flex items-center justify-between group shadow-md hover:shadow-lg transition-all"><div className="flex items-center gap-4 text-slate-900"><div className={`w-12 h-12 rounded-2xl ${m.color} flex items-center justify-center text-white font-black shadow-lg shadow-blue-100`}>{m.short}</div><div><p className="font-black text-xs uppercase leading-tight text-slate-900">{m.name}</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{m.isShareable ? "Livre" : "Unitário"}</p></div></div>{m.id !== 'lab' && <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', m.id))} className="text-slate-300 hover:text-red-500 p-2 transition-colors hover:scale-125"><Trash2 size={18}/></button>}</div>))}</div>
            </div>
          )}

          {activeTab === 'issues' && (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in">
              <div className="flex items-center justify-between gap-4 px-2 text-slate-900 font-black">
                <div><h2 className="text-xl font-black uppercase tracking-tight">Ocorrências</h2><p className="text-slate-500 text-xs mt-1 font-bold">Reporte problemas nos materiais.</p></div>
                <div className="bg-white border border-slate-200 px-5 py-3 rounded-[1.5rem] flex gap-8 text-center shadow-sm">
                  <div><p className="text-[9px] font-black text-slate-400 uppercase">Pendentes</p><p className="text-xl font-black text-amber-500 leading-none mt-1">{issues.filter(i => i.status === 'pendente').length}</p></div>
                  <div className="w-px h-8 bg-slate-100"></div>
                  <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Resolvidas</p><p className="text-xl font-black text-emerald-500 leading-none mt-1">{issues.filter(i => i.status === 'resolvido').length}</p></div>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-4 shadow-slate-100">
                <form onSubmit={reportIssue} className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end text-slate-900 font-black">
                   <div className="md:col-span-4 space-y-2 text-slate-900 font-bold"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Material</label><select className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm text-slate-900 shadow-inner" value={issueForm.materialId} onChange={e => setIssueForm({...issueForm, materialId: e.target.value})} required><option value="">Escolha...</option>{materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                   <div className="md:col-span-6 space-y-2 text-slate-900 font-bold"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Problema</label><input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm text-slate-900 shadow-inner" placeholder="Ex: Cabo HDMI rompido" value={issueForm.text} onChange={e => setIssueForm({...issueForm, text: e.target.value})} required /></div>
                   <button type="submit" className="md:col-span-2 py-4.5 bg-slate-800 text-white font-black rounded-2xl hover:bg-black transition-all text-[10px] uppercase shadow-lg tracking-[0.1em] border-b-4 border-black">Enviar</button>
                </form>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-slate-900 font-black">{issues.map(i => (<div key={i.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-md flex gap-5 animate-in slide-in-from-top-2 text-slate-900 font-black font-black font-black"><div className={`p-4 rounded-2xl h-fit ${i.status === 'resolvido' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'} shadow-sm`}><Wrench size={20}/></div><div className="flex-1 min-w-0"><div className="flex items-center justify-between mb-2 font-black text-slate-900"><span className="font-black text-xs uppercase text-slate-900">{i.materialName}</span><span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase ${i.status === 'resolvido' ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-amber-500 text-white shadow-amber-200'} shadow-md`}>{i.status}</span></div><p className="text-slate-600 text-sm italic line-clamp-2">"{i.text}"</p><div className="flex items-center justify-between mt-4 text-slate-900"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter font-black">{i.teacher} • {i.date}</p>{currentUser.isAdmin && i.status === 'pendente' && <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'issues', i.id), {status:'resolvido'})} className="text-[9px] font-black text-blue-600 hover:underline uppercase tracking-widest font-black">Resolver</button>}</div></div></div>))}</div>
            </div>
          )}
        </div>

        {notification && <div className={`fixed bottom-24 lg:bottom-10 right-4 lg:right-10 px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-4 z-[1000] animate-in slide-in-from-bottom duration-300 border-b-4 ${notification.type === 'error' ? 'bg-slate-900 border-red-500 text-white' : 'bg-slate-900 border-green-500 text-white'}`}><div className={notification.type === 'error' ? 'text-red-400' : 'text-green-400'}>{notification.type === 'error' ? <AlertCircle size={24}/> : <CheckCircle size={24}/>}</div><span className="text-sm font-black uppercase tracking-widest tracking-tighter text-white font-black">{notification.message}</span></div>}
      </main>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/90 backdrop-blur-xl border-t border-slate-200 flex items-center justify-around px-4 z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] text-slate-900 font-black">
        <MobileNavItem icon={<LayoutDashboard size={22} />} label="Agenda" active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} />
        {currentUser.isAdmin && <MobileNavItem icon={<Layers size={22} />} label="Gerir" active={activeTab === 'materials'} onClick={() => setActiveTab('materials')} />}
        {currentUser.isAdmin && <MobileNavItem icon={<Download size={22} />} label="Export" active={activeTab === 'export'} onClick={() => setActiveTab('export')} />}
        <MobileNavItem icon={<Wrench size={22} />} label="Alertas" active={activeTab === 'issues'} onClick={() => setActiveTab('issues')} />
      </div>

      {/* Modal Reserva */}
      {modalOpen && activeCell && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[500] flex items-end lg:items-center justify-center p-0 lg:p-4 overflow-hidden animate-in fade-in">
          <div className="bg-white rounded-t-[3.5rem] lg:rounded-[4rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom lg:zoom-in duration-300 flex flex-col max-h-[95vh] border border-slate-100 shadow-blue-900/20 text-slate-900 font-black">
            <div className="bg-blue-600 p-10 text-white relative shadow-lg">
              <h2 className="text-3xl font-black uppercase tracking-tight leading-none text-white font-black">Agendar Recurso</h2>
              <div className="flex items-center gap-3 mt-5">
                <p className="text-blue-100 text-[10px] font-black uppercase bg-blue-700/50 w-fit px-4 py-1.5 rounded-xl border border-white/10 shadow-sm">{currentUser.username}</p>
                <p className="text-blue-100 text-[10px] font-black uppercase bg-blue-700/50 w-fit px-4 py-1.5 rounded-xl border border-white/10 shadow-sm">{new Date(activeCell.date + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'long'})}</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="absolute top-10 right-10 text-white/50 hover:text-white transition-all bg-white/10 rounded-full p-2.5 hover:bg-white/20"><X size={28}/></button>
            </div>
            <form onSubmit={saveBooking} className="p-10 space-y-8 overflow-y-auto scrollbar-hide pb-24 text-slate-900 font-bold">
              <div className="space-y-4 text-slate-900 font-bold">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Turma</label>
                <div className="grid grid-cols-3 gap-3 text-slate-900 font-bold">
                  {SALAS.map(sala => (
                    <button key={sala} type="button" onClick={() => setSelectedRoom(sala)} className={`py-4 rounded-[1.2rem] border-2 text-[11px] font-black transition-all ${selectedRoom === sala ? 'border-blue-600 bg-blue-600 text-white shadow-xl scale-105 shadow-blue-200' : 'border-slate-100 text-slate-400 bg-slate-50/50 hover:border-slate-300'}`}>
                      {sala}
                    </button>
                  ))}
                </div>
              </div>
              {modalNextAula && (
                <div className="bg-blue-50 border-2 border-blue-100 p-6 rounded-[2.5rem] flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-5 text-slate-900 font-black">
                    <div className="bg-white p-3 rounded-2xl text-blue-600 shadow-md border border-blue-50"><Repeat size={20} /></div>
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight text-slate-900 leading-none">Aula Geminada?</p>
                      <p className="text-[10px] text-blue-600 font-black uppercase mt-1 tracking-widest">Incluir {modalNextAula.label}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setIsDoubleBooking(!isDoubleBooking)} className={`w-14 h-7 rounded-full transition-all relative shadow-inner ${isDoubleBooking ? 'bg-blue-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${isDoubleBooking ? 'left-8' : 'left-1'}`} /></button>
                </div>
              )}
              <div className="space-y-4 text-slate-900 font-bold text-slate-900 font-black">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2 text-slate-400 tracking-[0.2em]">Materiais</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {materials.map(res => {
                    const isBusy = checkResourceBusy(res.id, activeCell.date, activeCell.horarioId);
                    const isBusyNext = isDoubleBooking && modalNextAula ? checkResourceBusy(res.id, activeCell.date, modalNextAula.id) : false;
                    const itemLocked = isBusy || isBusyNext;
                    const isSelected = selectedResources.includes(res.id);
                    return (
                      <button key={res.id} type="button" onClick={() => !itemLocked && setSelectedResources(p => p.includes(res.id) ? p.filter(r => r !== res.id) : [...p, res.id])} className={`p-5 rounded-[1.8rem] border-2 text-left transition-all flex items-center justify-between shadow-sm ${itemLocked ? 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed border-dashed' : isSelected ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-50 scale-102 font-black shadow-blue-100 shadow-lg' : 'bg-white border-slate-100 hover:border-blue-400 shadow-inner'}`}>
                        <div className="flex items-center gap-4 text-slate-900 font-black font-black">
                          <div className={`w-3.5 h-3.5 rounded-full ${res.color} border-2 border-white shadow-sm`} />
                          <span className="text-[11px] uppercase tracking-tight">{res.name}</span>
                        </div>
                        {itemLocked ? <div className="flex items-center gap-1.5 text-[10px] font-black text-red-500 uppercase tracking-tighter leading-none"><Lock size={12}/> Ocupado</div> : isSelected && <div className="bg-blue-600 text-white p-1 rounded-lg shadow-md"><Check size={14} strokeWidth={4}/></div>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button type="submit" className="w-full py-6 bg-blue-600 text-white rounded-[2.2rem] font-black hover:bg-blue-700 transition-all shadow-xl uppercase tracking-widest text-sm mt-4 border-b-4 border-blue-900 active:border-b-0 active:translate-y-1">Confirmar Reserva</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SideNavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-[1.2rem] transition-all border-2 ${active ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200 font-black' : 'border-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-700 font-bold'}`}>
      {icon} <span className="text-sm tracking-tight tracking-widest">{label}</span>
    </button>
  );
}

function MobileNavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition-all ${active ? 'text-blue-600 scale-110 font-black' : 'text-slate-400 font-bold'}`}>
      <div className={`transition-all ${active ? 'bg-blue-50 p-2.5 rounded-2xl shadow-inner' : ''}`}>{icon}</div>
      <span className={`text-[9px] uppercase tracking-tighter ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    </button>
  );
}
