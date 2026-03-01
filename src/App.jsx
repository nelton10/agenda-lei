import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  setDoc,
  query
} from "firebase/firestore";
import { 
  Calendar, 
  User, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  LayoutDashboard, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  Monitor, 
  Printer, 
  Lock, 
  Home, 
  Layers, 
  Check, 
  Repeat, 
  LogOut, 
  Key, 
  ShieldCheck, 
  Wrench, 
  MessageSquare, 
  Download, 
  FileText, 
  Briefcase, 
  Maximize2, 
  Minimize2, 
  Ban, 
  Code 
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE (NELTON COSTA) ---
const firebaseConfig = {
  apiKey: "AIzaSyCb2Cmqwivdgb_YgCUQbcx43S38QYRDapA",
  authDomain: "gestao-anisio.firebaseapp.com",
  projectId: "gestao-anisio",
  storageBucket: "gestao-anisio.firebasestorage.app",
  messagingSenderId: "946435999048",
  appId: "1:946435999048:web:a3cae6ed73c21a30b59f7d",
  measurementId: "G-KHL4B7MR3X"
};

// Inicialização segura do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'gestao-anisio-lei';

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

// --- UTILITÁRIOS ---
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
  // --- ESTADOS DE SESSÃO E AUTH ---
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [user, setUser] = useState(null); 
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');

  // --- ESTADOS DE DADOS (Firestore) ---
  const [bookings, setBookings] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [issues, setIssues] = useState([]);

  // --- ESTADOS DE INTERFACE ---
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [activeTab, setActiveTab] = useState('agenda'); 
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState(null);
  const [notification, setNotification] = useState(null);
  const [currentDayIndexMobile, setCurrentDayIndexMobile] = useState(0);
  const [isWeeklyMobile, setIsWeeklyMobile] = useState(false);

  // --- ESTADOS DE FORMULÁRIO ---
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedResources, setSelectedResources] = useState([]);
  const [isDoubleBooking, setIsDoubleBooking] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newMaterial, setNewMaterial] = useState({ name: '', short: '', category: 'Projetor', color: 'bg-blue-600', isShareable: false });
  const [issueForm, setIssueForm] = useState({ materialId: '', text: '' });
  const [exportRange, setExportRange] = useState({ start: formatDateToISO(new Date()), end: formatDateToISO(new Date()) });

  // --- INICIALIZAÇÃO FIREBASE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Erro na autenticação anônima:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  // --- SINCRONIZAÇÃO FIRESTORE ---
  useEffect(() => {
    if (!firebaseUser) return;

    const publicDataRef = (col) => collection(db, 'artifacts', appId, 'public', 'data', col);

    // Monitorizar Agendamentos
    const unsubBookings = onSnapshot(publicDataRef('bookings'), (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Erro Bookings:", err));

    // Monitorizar Materiais
    const unsubMaterials = onSnapshot(publicDataRef('materials'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (data.length === 0) {
        const defaultMaterials = [
          { id: 'lab', name: 'Laboratório', short: 'LAB', category: 'Espaço', color: 'bg-emerald-500', isShareable: false },
          { id: 'p1', name: 'Projetor 01', short: 'P1', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
          { id: 'p2', name: 'Projetor 02', short: 'P2', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
          { id: 'som', name: 'Caixa de Som', short: 'SOM', category: 'Áudio', color: 'bg-purple-600', isShareable: false },
          { id: 'ext', name: 'Extensão', short: 'EXT', category: 'Acessório', color: 'bg-amber-600', isShareable: true },
        ];
        defaultMaterials.forEach(m => {
          setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', m.id), m);
        });
      }
      setMaterials(data);
    });

    // Monitorizar Ocorrências
    const unsubIssues = onSnapshot(publicDataRef('issues'), (snapshot) => {
      setIssues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubBookings(); unsubMaterials(); unsubIssues(); };
  }, [firebaseUser]);

  // --- HANDLERS (DEFINIÇÕES CORRIGIDAS) ---
  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const cleanUsername = loginForm.username.trim().toUpperCase();
    if (cleanUsername === '') return setAuthError('Introduza o seu nome.');
    
    if (loginForm.password === 'admin') {
      setUser({ username: cleanUsername, isAdmin: true });
      setActiveTab('agenda');
    } else if (loginForm.password === 'prof') {
      setUser({ username: cleanUsername, isAdmin: false });
      setActiveTab('agenda');
    } else {
      setAuthError('Senha incorreta.');
      setTimeout(() => setAuthError(''), 3000);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setLoginForm({ username: '', password: '' });
    setActiveTab('agenda');
  };

  // Esta função agora está corretamente definida dentro do componente App
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
    if (mat?.isShareable) return false;
    return bookings.some(b => b.date === date && b.horarioId === horarioId && b.resources.includes(resId));
  };

  const blockSchedule = async () => {
    if (!user?.isAdmin || !activeCell) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), {
        teacher: "ADMIN",
        room: "---",
        date: activeCell.date,
        horarioId: activeCell.horarioId,
        resources: materials.map(m => m.id),
        isBlocked: true,
        createdAt: Date.now()
      });
      setModalOpen(false);
      notify("Horário bloqueado!", "info");
    } catch (e) { notify("Erro ao bloquear.", "error"); }
  };

  const saveBooking = async (e) => {
    e.preventDefault();
    if (!selectedRoom || selectedResources.length === 0) return notify("Selecione a turma e materiais.", "error");

    const slotsToBook = [activeCell.horarioId];
    const nextAula = getNextAula(activeCell.horarioId);
    if (isDoubleBooking && nextAula) slotsToBook.push(nextAula.id);

    const hasConflict = slotsToBook.some(slotId => 
      selectedResources.some(resId => checkResourceBusy(resId, activeCell.date, slotId))
    );

    if (hasConflict) return notify("Item ocupado neste horário.", "error");

    try {
      for (const slotId of slotsToBook) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), {
          teacher: user.username,
          room: selectedRoom,
          date: activeCell.date,
          horarioId: slotId,
          resources: [...selectedResources],
          isBlocked: false,
          createdAt: Date.now()
        });
      }
      notify("Agendamento efetuado!");
      setModalOpen(false);
    } catch (e) { notify("Erro ao guardar.", "error"); }
  };

  const deleteBooking = async (id) => {
    if (window.confirm("Deseja apagar este agendamento?")) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id));
        notify("Removido.", "info");
      } catch (e) { notify("Erro ao remover.", "error"); }
    }
  };

  const addMaterial = async (e) => {
    e.preventDefault();
    if (!newMaterial.name || !newMaterial.short) return;
    try {
      const id = `mat-${Date.now()}`;
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', id), { ...newMaterial, id });
      setNewMaterial({ name: '', short: '', category: 'Projetor', color: 'bg-blue-600', isShareable: false });
      notify("Material cadastrado!");
    } catch (e) { notify("Erro.", "error"); }
  };

  const reportIssue = async (e) => {
    e.preventDefault();
    if (!issueForm.materialId || !issueForm.text) return;
    const material = materials.find(m => m.id === issueForm.materialId);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'issues'), {
        teacher: user.username,
        materialName: material?.name || "Desconhecido",
        text: issueForm.text,
        status: "pendente",
        date: new Date().toLocaleDateString()
      });
      setIssueForm({ materialId: '', text: '' });
      notify("Ocorrência enviada.");
    } catch (e) { notify("Erro ao enviar.", "error"); }
  };

  const resolveIssue = async (id) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'issues', id), { status: 'resolvido' });
      notify("Resolvida!");
    } catch (e) { notify("Erro.", "error"); }
  };

  const exportToExcel = () => {
    const filtered = bookings.filter(b => b.date >= exportRange.start && b.date <= exportRange.end && !b.isBlocked);
    if (filtered.length === 0) return notify("Sem dados.", "error");

    let csvContent = "\uFEFF"; 
    csvContent += "data;aula;professor;sala;material 1;material 2;material 3\n";

    filtered.forEach(b => {
      const aula = HORARIOS.find(h => h.id === b.horarioId)?.label || b.horarioId;
      const resourceNames = b.resources.map(id => materials.find(m => m.id === id)?.name || id);
      csvContent += `${b.date};${aula};${b.teacher};${b.room};${resourceNames[0]||""};${resourceNames[1]||""};${resourceNames[2]||""}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url); link.setAttribute("download", `Relatorio_Agendamentos.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    notify("Exportação concluída!");
  };

  // --- DADOS DERIVADOS ---
  const currentNextAula = activeCell ? getNextAula(activeCell.horarioId) : null;
  const weekDatesMemo = useMemo(() => {
    return DIAS_NOMES.map((nome, index) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + index);
      return { nome, date: formatDateToISO(d), dateObj: d };
    });
  }, [currentMonday]);

  // --- RENDER LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in border border-slate-200">
          <div className="bg-blue-600 p-12 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <img src={LOGO_URL} alt="Escola Anísio Teixeira" className="w-24 h-24 mx-auto mb-6 rounded-2xl shadow-xl border-4 border-white/20 bg-white p-1" />
            <h1 className="text-2xl font-black tracking-tight uppercase leading-none">EEMTI Anísio Teixeira</h1>
            <p className="text-blue-100 text-[10px] font-black uppercase mt-3 tracking-[0.3em] opacity-80">Gestão de Agendamentos LEI</p>
          </div>
          <form onSubmit={handleLogin} className="p-10 space-y-7 text-slate-900">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Utilizador</label>
              <div className="relative group text-slate-900">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold uppercase text-slate-900" placeholder="DIGITE SEU NOME" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative group text-slate-900">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required type="password" className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-900" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
              </div>
            </div>
            {authError && <div className="bg-red-50 text-red-500 text-xs font-bold p-4 rounded-xl flex items-center gap-2 animate-bounce"><AlertCircle size={14} /> {authError}</div>}
            <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[1.8rem] font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase tracking-widest text-sm border-b-4 border-blue-900 active:border-b-0 active:translate-y-1">Entrar no Sistema</button>
            <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-tighter">Programado por Nelton Costa</p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-900 print:bg-white">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex shrink-0 shadow-sm z-20 print:hidden text-slate-900">
        <div className="p-8 flex flex-col items-center border-b border-slate-50 bg-slate-50/30">
          <img src={LOGO_URL} alt="Logo" className="w-16 h-16 rounded-xl shadow-md mb-4 bg-white p-1" />
          <div className="text-center">
            <h1 className="font-black text-slate-800 text-sm uppercase">Anísio Teixeira</h1>
            <p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest mt-1">Gestão LEI</p>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1.5 mt-6 font-bold">
          <SideNavItem icon={<LayoutDashboard size={18}/>} label="Agenda Semanal" active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} />
          {user.isAdmin && (
            <>
              <SideNavItem icon={<Layers size={18}/>} label="Gerir Materiais" active={activeTab === 'materials'} onClick={() => setActiveTab('materials')} />
              <SideNavItem icon={<Download size={18}/>} label="Relatórios" active={activeTab === 'export'} onClick={() => setActiveTab('export')} />
            </>
          )}
          <SideNavItem icon={<Wrench size={18}/>} label="Ocorrências" active={activeTab === 'issues'} onClick={() => setActiveTab('issues')} />
          <SideNavItem icon={<Printer size={18}/>} label="Imprimir Dia" active={false} onClick={() => window.print()} />
        </nav>
        <div className="p-6 border-t border-slate-100">
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white ${user.isAdmin ? 'bg-amber-500' : 'bg-blue-500'} shadow-lg`}>{user.username.substring(0, 1)}</div>
              <div className="min-w-0"><p className="text-[10px] font-black truncate uppercase text-slate-800">{user.username}</p><p className="text-[8px] font-bold text-slate-400 uppercase">{user.isAdmin ? 'Admin' : 'Docente'}</p></div>
            </div>
            <button onClick={handleLogout} className="text-slate-300 hover:text-red-500 transition-colors ml-2"><LogOut size={16} /></button>
          </div>
          <p className="text-center mt-4 text-[7px] font-black text-slate-300 uppercase tracking-widest">Nelton Costa</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden pb-20 lg:pb-0 print:overflow-visible print:pb-0 text-slate-900">
        <header className="h-auto lg:h-20 bg-white border-b border-slate-200 px-4 lg:px-10 py-4 lg:py-0 flex flex-col lg:flex-row lg:items-center justify-between shrink-0 gap-4 z-10 print:hidden text-slate-900">
          <div className="flex items-center justify-between w-full lg:w-auto">
             <div className="flex items-center gap-3 lg:hidden">
               <img src={LOGO_URL} className="w-8 h-8 rounded-lg bg-white p-0.5 border border-slate-100 shadow-sm" alt="Logo" />
               <h1 className="font-black text-xs text-slate-800 uppercase tracking-tighter truncate max-w-[100px]">{user.username}</h1>
               {activeTab === 'agenda' && (
                 <button onClick={() => setIsWeeklyMobile(!isWeeklyMobile)} className={`ml-2 p-2 rounded-xl border transition-all ${isWeeklyMobile ? 'bg-blue-600 text-white' : 'text-slate-400 border-slate-200'}`}>
                   {isWeeklyMobile ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
                 </button>
               )}
               <button onClick={handleLogout} className="p-1.5 text-slate-400 ml-auto"><LogOut size={16}/></button>
             </div>
             
             {activeTab === 'agenda' && (
               <div className="relative group flex-1 lg:flex-none mx-4 lg:mx-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500" size={16} />
                  <input type="text" placeholder="Filtrar professor..." className="pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 outline-none w-full lg:w-80 font-bold text-xs text-slate-900 shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
               </div>
             )}
          </div>
          
          {activeTab === 'agenda' && (
            <div className="flex items-center justify-center">
              <div className="flex bg-slate-100 border border-slate-200 p-1.5 rounded-2xl items-center shadow-inner">
                <button onClick={() => setCurrentMonday(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })} className="p-2 bg-white rounded-xl shadow-sm text-slate-600 hover:text-blue-600 transition-all"><ChevronLeft size={18}/></button>
                <span className="px-6 text-[10px] lg:text-xs font-black text-slate-600 uppercase tracking-widest min-w-[160px] text-center">{formatWeekDisplay(currentMonday)}</span>
                <button onClick={() => setCurrentMonday(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })} className="p-2 bg-white rounded-xl shadow-sm text-slate-600 hover:text-blue-600 transition-all"><ChevronRight size={18}/></button>
              </div>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-3 lg:p-8 animate-in fade-in print:p-0 print:overflow-visible">
          {activeTab === 'agenda' && (
            <div className="space-y-6 print:space-y-0 text-slate-900">
              <div className="lg:hidden flex overflow-x-auto gap-3 pb-2 scrollbar-hide print:hidden text-slate-900">
                {!isWeeklyMobile && weekDatesMemo.map((item, index) => (
                  <button key={item.date} onClick={() => setCurrentDayIndexMobile(index)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex flex-col items-center min-w-[100px] border shadow-md ${currentDayIndexMobile === index ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border-slate-200'}`}>
                    <span>{item.nome}</span>
                    <span className="text-[9px] opacity-70">{item.dateObj.getDate()}/{item.dateObj.getMonth() + 1}</span>
                  </button>
                ))}
              </div>

              <div className={`bg-white rounded-[2.5rem] lg:rounded-[3.5rem] border border-slate-200 shadow-2xl overflow-hidden print:border-slate-300 print:rounded-none ${isWeeklyMobile ? 'w-[1200px] lg:w-full' : 'w-full'}`}>
                <table className="w-full border-collapse table-fixed print:table-auto text-slate-900">
                  <thead className={`${!isWeeklyMobile ? 'hidden lg:table-header-group' : 'table-header-group'}`}>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="w-28 p-8 text-left text-[10px] font-black uppercase border-r border-slate-200">Horário</th>
                      {weekDatesMemo.map((item, index) => (
                        <th key={item.date} className={`p-8 text-center border-r border-slate-200 last:border-r-0 ${(!isWeeklyMobile && index !== currentDayIndexMobile) ? 'hidden lg:table-cell' : 'table-cell'}`}>
                          <div className="flex flex-col items-center text-slate-900">
                            <span className="text-[10px] font-black uppercase">{item.nome}</span>
                            <span className="text-[12px] text-blue-600 font-black mt-2 bg-blue-50 px-3 py-1 rounded-full">{item.dateObj.getDate()} / {item.dateObj.getMonth() + 1}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {HORARIOS.map((horario) => (
                      <tr key={horario.id} className={horario.type === 'pausa' ? 'bg-slate-50/40 print:bg-slate-100' : ''}>
                        <td className="w-16 lg:w-28 p-4 lg:p-8 border-r border-slate-100 text-center align-middle shrink-0">
                          <div className="flex flex-col items-center text-slate-900">
                            <span className="text-[10px] lg:text-[11px] font-black">{horario.label}</span>
                            {horario.title && <span className="text-[7px] font-black text-blue-500 uppercase mt-2 bg-blue-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">{horario.title}</span>}
                          </div>
                        </td>
                        {weekDatesMemo.map((item, index) => {
                          const isVisible = index === currentDayIndexMobile || isWeeklyMobile;
                          const dayBookings = bookings.filter(b => b.date === item.date && b.horarioId === horario.id && (searchTerm === "" || b.teacher.includes(searchTerm.toUpperCase()) || b.room.includes(searchTerm.toUpperCase())));
                          if (horario.type === 'pausa') return <td key={`${item.date}-${horario.id}`} className={`p-4 border-r border-slate-100 ${!isVisible ? 'hidden lg:table-cell' : ''}`}></td>;
                          return (
                            <td key={`${item.date}-${horario.id}`} className={`p-2 lg:p-3.5 border-r border-slate-50 last:border-r-0 group relative min-h-[140px] align-top transition-colors hover:bg-blue-50/10 ${!isVisible ? 'hidden lg:table-cell' : ''}`}>
                              <div className="space-y-3">
                                {dayBookings.map(b => (
                                  <div key={b.id} className={`p-4 rounded-[1.5rem] relative shadow-lg animate-in fade-in border ${b.isBlocked ? 'bg-slate-900 text-white border-slate-800 shadow-slate-900/10' : 'bg-white text-slate-900 border-slate-200 shadow-slate-100 hover:border-blue-300'}`}>
                                    <div className="flex justify-between items-start mb-3 pr-2 min-w-0">
                                      <div className="min-w-0"><p className="text-[10px] lg:text-[11px] font-black truncate uppercase tracking-tight">{b.isBlocked ? "BLOQUEADO" : b.teacher}</p><p className={`text-[8px] font-black uppercase mt-1 tracking-widest ${b.isBlocked ? 'text-slate-500' : 'text-blue-500'}`}>{b.room}</p></div>
                                      {b.isBlocked && <Ban size={14} className="text-red-500 shrink-0" />}
                                    </div>
                                    {!b.isBlocked && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {b.resources.map(resId => {
                                          const res = materials.find(r => r.id === resId);
                                          return res ? (
                                            <div key={resId} className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-xl shadow-sm">
                                              <div className={`w-1.5 h-1.5 rounded-full ${res.color}`} />
                                              <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">{res.short}</span>
                                            </div>
                                          ) : null;
                                        })}
                                      </div>
                                    )}
                                    {(user.isAdmin || b.teacher === user.username) && (
                                      <button onClick={e => { e.stopPropagation(); deleteBooking(b.id); }} className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 shadow-lg border border-slate-100 p-2 rounded-full z-20 print:hidden active:scale-90 shadow-slate-200"><Trash2 size={14} /></button>
                                    )}
                                  </div>
                                ))}
                                {dayBookings.length === 0 && <div className="h-16 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-[1.5rem] opacity-30 print:hidden text-slate-300 transition-colors hover:border-blue-200" onClick={() => handleOpenModal(item.date, horario.id)}><Plus size={16} /></div>}
                              </div>
                              <button onClick={() => handleOpenModal(item.date, horario.id)} className="absolute inset-0 hidden lg:flex items-center justify-center opacity-0 group-hover:opacity-100 bg-blue-50/5 print:hidden text-blue-600 transition-opacity"><Plus size={24} /></button>
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
            <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-right text-slate-900">
               <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-2xl space-y-10 text-slate-900">
                 <div className="flex flex-col items-center gap-4 text-slate-900">
                    <div className="bg-blue-100 p-5 rounded-3xl text-blue-600"><Download size={32}/></div>
                    <h2 className="text-3xl font-black uppercase text-center text-slate-800 tracking-tight">Exportar Relatórios</h2>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-900">
                   <div className="space-y-1 text-slate-900"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Data Início</label><input type="date" className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-500 transition-all shadow-inner" value={exportRange.start} onChange={e => setExportRange({...exportRange, start: e.target.value})} /></div>
                   <div className="space-y-1 text-slate-900"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Data Fim</label><input type="date" className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-500 transition-all shadow-inner" value={exportRange.end} onChange={e => setExportRange({...exportRange, end: e.target.value})} /></div>
                 </div>
                 <button onClick={exportToExcel} className="w-full py-6 bg-blue-600 text-white font-black rounded-[2.5rem] shadow-2xl uppercase tracking-widest text-sm border-b-4 border-blue-900 active:border-b-0 active:translate-y-1 transition-all">Baixar Relatório .CSV</button>
               </div>
            </div>
          )}

          {activeTab === 'materials' && (
             <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in text-slate-900">
               <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-8 text-slate-900">
                 <h2 className="text-2xl font-black text-slate-800 uppercase flex items-center gap-3"><ShieldCheck className="text-blue-600"/> Gestão de Materiais</h2>
                 <form onSubmit={addMaterial} className="grid grid-cols-1 md:grid-cols-5 gap-5 text-slate-900">
                    <div className="space-y-1 text-slate-900"><span className="text-[10px] font-black text-slate-400 uppercase ml-2">Nome</span><input className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-900 outline-none border-2 focus:border-blue-500" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} /></div>
                    <div className="space-y-1 text-slate-900"><span className="text-[10px] font-black text-slate-400 uppercase ml-2">Sigla</span><input className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold uppercase text-slate-900 outline-none border-2 focus:border-blue-500" value={newMaterial.short} onChange={e => setNewMaterial({...newMaterial, short: e.target.value.toUpperCase()})} /></div>
                    <div className="space-y-1 text-slate-900"><span className="text-[10px] font-black text-slate-400 uppercase ml-2">Tipo</span><select className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold text-slate-900 outline-none border-2 focus:border-blue-500" value={newMaterial.isShareable} onChange={e => setNewMaterial({...newMaterial, isShareable: e.target.value === "true"})}><option value="false">Unitário</option><option value="true">Livre</option></select></div>
                    <div className="space-y-1 text-slate-900"><span className="text-[10px] font-black text-slate-400 uppercase ml-2">Cor</span><select className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold text-slate-900 outline-none border-2 focus:border-blue-500" value={newMaterial.color} onChange={e => setNewMaterial({...newMaterial, color: e.target.value})}><option value="bg-blue-600">Azul</option><option value="bg-emerald-600">Verde</option><option value="bg-purple-600">Roxo</option><option value="bg-red-600">Vermelho</option></select></div>
                    <button type="submit" className="md:mt-5 py-4.5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-lg active:scale-95 transition-all text-xs uppercase tracking-widest">Salvar</button>
                 </form>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-slate-900">{materials.map(m => (<div key={m.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 flex items-center justify-between group shadow-md transition-all hover:shadow-lg"><div className="flex items-center gap-4 text-slate-900"><div className={`w-12 h-12 rounded-2xl ${m.color} flex items-center justify-center text-white font-black uppercase text-xs shadow-lg`}>{m.short}</div><div><p className="font-black text-xs uppercase text-slate-800">{m.name}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{m.isShareable ? "Livre" : "Unitário"}</p></div></div>{m.id !== 'lab' && <button onClick={() => deleteMaterial(m.id)} className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18}/></button>}</div>))}</div>
            </div>
          )}

          {activeTab === 'issues' && (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in text-slate-900">
               <div className="flex items-center gap-4"><div className="bg-amber-100 p-3 rounded-2xl text-amber-600 shadow-inner"><Wrench size={24}/></div><h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Mural de Ocorrências</h2></div>
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-4 text-slate-900">
                 <form onSubmit={reportIssue} className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end text-slate-900">
                    <div className="md:col-span-4 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Material</label><select className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold text-sm text-slate-900 focus:border-blue-500 transition-all shadow-inner" value={issueForm.materialId} onChange={e => setIssueForm({...issueForm, materialId: e.target.value})} required><option value="">Escolha...</option>{materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                    <div className="md:col-span-6 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Problema</label><input className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold text-sm text-slate-900 focus:border-blue-500 transition-all shadow-inner" placeholder="O que aconteceu?" value={issueForm.text} onChange={e => setIssueForm({...issueForm, text: e.target.value})} required /></div>
                    <button type="submit" className="md:col-span-2 py-4.5 bg-slate-800 text-white font-black rounded-2xl hover:bg-black transition-all text-xs uppercase active:scale-95 shadow-md">Enviar</button>
                 </form>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-slate-900">{issues.map(i => (<div key={i.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-md flex gap-5 animate-in slide-in-from-top-2 transition-all"><div className={`p-4 rounded-2xl h-fit ${i.status === 'resolvido' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}><Wrench size={20}/></div><div className="flex-1 min-w-0 text-slate-900"><div className="flex items-center justify-between mb-2"><span className="font-black text-xs uppercase text-slate-900">{i.materialName}</span><span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase ${i.status === 'resolvido' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>{i.status}</span></div><p className="text-slate-600 text-sm italic line-clamp-2">"{i.text}"</p><div className="flex items-center justify-between mt-4"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{i.teacher} • {i.date}</p>{user.isAdmin && <button onClick={() => resolveIssue(i.id)} className="text-[9px] font-black text-blue-600 hover:underline uppercase tracking-widest">Resolver</button>}</div></div></div>))}</div>
            </div>
          )}
        </div>

        {notification && <div className={`fixed bottom-24 lg:bottom-10 right-4 lg:right-10 px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 z-[1000] border-b-4 print:hidden ${notification.type === 'error' ? 'bg-slate-900 border-red-500 text-white' : 'bg-slate-900 border-green-500 text-white'}`}><div className={notification.type === 'error' ? 'text-red-400' : 'text-green-400'}>{notification.type === 'error' ? <AlertCircle size={24}/> : <CheckCircle size={24}/>}</div><span className="text-sm font-black uppercase tracking-widest">{notification.message}</span></div>}
      </main>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-lg border-t border-slate-200 flex items-center justify-around px-4 z-40 print:hidden text-slate-900 shadow-xl">
        <MobileNavItem icon={<LayoutDashboard size={22} />} label="Agenda" active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} />
        {user.isAdmin && <MobileNavItem icon={<Layers size={22} />} label="Gerir" active={activeTab === 'materials'} onClick={() => setActiveTab('materials')} />}
        {user.isAdmin && <MobileNavItem icon={<Download size={22} />} label="Excel" active={activeTab === 'export'} onClick={() => setActiveTab('export')} />}
        <MobileNavItem icon={<Wrench size={22} />} label="Alertas" active={activeTab === 'issues'} onClick={() => setActiveTab('issues')} />
      </div>

      <p className="lg:hidden fixed bottom-1 left-0 right-0 text-center text-[7px] font-black text-slate-300 uppercase tracking-widest z-50 print:hidden pointer-events-none">Programado por Nelton Costa</p>

      {/* Modal Reserva */}
      {modalOpen && activeCell && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[500] flex items-end lg:items-center justify-center p-0 lg:p-4 animate-in fade-in print:hidden">
          <div className="bg-white rounded-t-[3.5rem] lg:rounded-[4rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[95vh] border border-slate-100 overflow-hidden text-slate-900 shadow-blue-200">
            <div className="bg-blue-600 p-10 text-white relative shrink-0">
              <h2 className="text-3xl font-black uppercase text-white leading-none">Agendar LEI</h2>
              <p className="text-blue-100 text-[11px] font-black uppercase mt-5 bg-blue-700/50 w-fit px-4 py-1.5 rounded-xl border border-white/10">{user.username} • {activeCell.date}</p>
              <button onClick={() => setModalOpen(false)} className="absolute top-10 right-10 text-white/50 hover:text-white transition-all bg-white/10 rounded-full p-2.5"><X size={28}/></button>
            </div>
            
            <form onSubmit={saveBooking} className="p-10 space-y-8 overflow-y-auto scrollbar-hide pb-24 bg-white text-slate-900">
              {user.isAdmin && <button type="button" onClick={blockSchedule} className="w-full py-4 bg-slate-100 border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase flex justify-center items-center gap-3 hover:bg-slate-200 transition-all shadow-sm"><Ban size={18} className="text-red-500" /> BLOQUEAR HORÁRIO</button>}
              <div className="space-y-4 text-slate-900"><label className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest">Selecione a Turma</label>
                <div className="grid grid-cols-3 gap-3 text-slate-900">
                  {SALAS.map(sala => (
                    <button key={sala} type="button" onClick={() => setSelectedRoom(sala)} className={`py-4 rounded-[1.2rem] border-2 text-[11px] font-black transition-all ${selectedRoom === sala ? 'border-blue-600 bg-blue-600 text-white shadow-xl scale-105' : 'border-slate-100 text-slate-400 bg-slate-50/50 hover:border-slate-300'}`}>{sala}</button>
                  ))}
                </div>
              </div>
              {currentNextAula && (
                <div className="bg-blue-50 border-2 border-blue-100 p-6 rounded-[2.5rem] flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-5 text-slate-900">
                    <div className="bg-white p-3 rounded-2xl text-blue-600 shadow-md border border-blue-50"><Repeat size={22} /></div>
                    <div><p className="text-xs font-black text-slate-800 uppercase tracking-tight">Aula Geminada?</p><p className="text-[10px] text-blue-600 font-black uppercase mt-1 tracking-widest">Incluir {currentNextAula.label}</p></div>
                  </div>
                  <button type="button" onClick={() => setIsDoubleBooking(!isDoubleBooking)} className={`w-14 h-7 rounded-full transition-all relative shadow-inner ${isDoubleBooking ? 'bg-blue-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${isDoubleBooking ? 'left-8' : 'left-1'}`} /></button>
                </div>
              )}
              <div className="space-y-4 text-slate-900"><label className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest text-slate-400 font-bold uppercase">Materiais Disponíveis</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-900">
                  {materials.map(res => {
                    const isBusy = checkResourceBusy(res.id, activeCell.date, activeCell.horarioId);
                    const isBusyNext = isDoubleBooking && currentNextAula ? checkResourceBusy(res.id, activeCell.date, currentNextAula.id) : false;
                    const isLocked = isBusy || isBusyNext;
                    const isSelected = selectedResources.includes(res.id);
                    return (
                      <button key={res.id} type="button" onClick={() => !isLocked && setSelectedResources(prev => prev.includes(res.id) ? prev.filter(r => r !== res.id) : [...prev, res.id])} className={`p-5 rounded-[1.5rem] border-2 text-left flex items-center justify-between shadow-sm transition-all ${isLocked ? 'bg-slate-50 opacity-40 cursor-not-allowed border-dashed border-slate-200' : isSelected ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-50 font-black text-blue-700 scale-102 shadow-md' : 'bg-white border-slate-100 text-slate-700 hover:border-blue-400'}`}>
                        <div className="flex items-center gap-4 text-slate-700"><div className={`w-3.5 h-3.5 rounded-full ${res.color} border-2 border-white shadow-sm`} /><span className="text-[11px] font-black uppercase tracking-tight">{res.name}</span></div>
                        {isLocked ? <div className="text-[10px] font-black text-red-500"><Lock size={14}/></div> : isSelected && <div className="bg-blue-600 text-white p-1.5 rounded-xl"><Check size={16} strokeWidth={4}/></div>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button type="submit" className="w-full py-6 bg-blue-600 text-white rounded-[2.2rem] font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 uppercase tracking-widest text-sm mt-4 active:scale-95 border-b-4 border-blue-900">Confirmar Agendamento</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTES ---
function SideNavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-[1.2rem] transition-all border-2 ${active ? 'bg-blue-600 border-blue-600 text-white shadow-xl font-bold shadow-blue-100' : 'border-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}>
      {icon} <span className="text-sm tracking-tight">{label}</span>
    </button>
  );
}

function MobileNavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition-all ${active ? 'text-blue-600 scale-110 font-bold' : 'text-slate-400'}`}>
      <div className={`transition-all ${active ? 'bg-blue-50 p-2 rounded-2xl shadow-inner' : ''}`}>{icon}</div>
      <span className={`text-[9px] font-black uppercase tracking-tighter ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    </button>
  );
}
