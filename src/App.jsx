import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  User, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  LayoutDashboard, 
  Search, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  Monitor, 
  Printer, 
  Lock, 
  Home,
  ChevronDown,
  Layers,
  Check,
  Repeat,
  LogOut,
  Key,
  ShieldCheck,
  PlusCircle,
  Wrench,
  MessageSquare,
  Download,
  FileText,
  Briefcase
} from 'lucide-react';

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
  // --- ESTADO DE AUTENTICAÇÃO ---
  const [user, setUser] = useState(null); 
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');

  // --- ESTADO DA AGENDA ---
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [bookings, setBookings] = useState([
    { id: 1, teacher: "COORDENAÇÃO", room: "3A", date: formatDateToISO(getMonday(new Date())), horarioId: "h1", resources: ["lab"] },
  ]);
  
  // --- ESTADO DE MATERIAIS ---
  const [materials, setMaterials] = useState([
    { id: 'lab', name: 'Laboratório', short: 'LAB', category: 'Espaço', color: 'bg-emerald-500', isShareable: false },
    { id: 'p1', name: 'Projetor 01', short: 'P1', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
    { id: 'p2', name: 'Projetor 02', short: 'P2', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
    { id: 'p3', name: 'Projetor 03', short: 'P3', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
    { id: 'p4', name: 'Projetor 04', short: 'P4', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
    { id: 'p5', name: 'Projetor 05', short: 'P5', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
    { id: 'p6', name: 'Projetor 06', short: 'P6', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
    { id: 'p7', name: 'Projetor 07', short: 'P7', category: 'Projetor', color: 'bg-blue-600', isShareable: false },
    { id: 'som', name: 'Caixa de Som', short: 'SOM', category: 'Áudio', color: 'bg-purple-600', isShareable: false },
    { id: 'ext', name: 'Extensão', short: 'EXT', category: 'Acessório', color: 'bg-amber-600', isShareable: true },
  ]);

  const [issues, setIssues] = useState([]);
  const [activeTab, setActiveTab] = useState('agenda'); 
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState(null);
  const [notification, setNotification] = useState(null);
  const [currentDayIndexMobile, setCurrentDayIndexMobile] = useState(0);

  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedResources, setSelectedResources] = useState([]);
  const [isDoubleBooking, setIsDoubleBooking] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newMaterial, setNewMaterial] = useState({ name: '', short: '', category: 'Projetor', color: 'bg-blue-600', isShareable: false });
  const [issueForm, setIssueForm] = useState({ materialId: '', text: '' });

  const [exportRange, setExportRange] = useState({ 
    start: formatDateToISO(new Date()), 
    end: formatDateToISO(new Date()) 
  });

  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = loginForm;
    const cleanUsername = username.trim().toUpperCase();
    if (cleanUsername === '') return setAuthError('Digite seu nome.');

    if (password === 'admin') {
      setUser({ username: cleanUsername, isAdmin: true });
      setActiveTab('agenda');
    } else if (password === 'prof') {
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
  };

  const weekDates = useMemo(() => {
    return DIAS_NOMES.map((nome, index) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + index);
      return { nome, date: formatDateToISO(d), dateObj: d };
    });
  }, [currentMonday]);

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

  const saveBooking = (e) => {
    e.preventDefault();
    if (!selectedRoom || selectedResources.length === 0) return notify("Preencha todos os campos.", "error");

    const slotsToBook = [activeCell.horarioId];
    const nextAula = getNextAula(activeCell.horarioId);
    if (isDoubleBooking && nextAula) slotsToBook.push(nextAula.id);

    const hasConflict = slotsToBook.some(slotId => 
      selectedResources.some(resId => checkResourceBusy(resId, activeCell.date, slotId))
    );

    if (hasConflict) return notify("Item ocupado neste horário.", "error");

    const newEntries = slotsToBook.map((slotId, idx) => ({
      id: Date.now() + idx,
      teacher: user.username,
      room: selectedRoom,
      date: activeCell.date,
      horarioId: slotId,
      resources: [...selectedResources]
    }));

    setBookings(prev => [...prev, ...newEntries]);
    notify("Agendamento realizado!");
    setModalOpen(false);
  };

  const deleteBooking = (id) => {
    setBookings(prev => prev.filter(b => b.id !== id));
    notify("Agendamento removido.", "info");
  };

  const addMaterial = (e) => {
    e.preventDefault();
    if (!newMaterial.name || !newMaterial.short) return;
    const id = `mat-${Date.now()}`;
    setMaterials(prev => [...prev, { ...newMaterial, id }]);
    setNewMaterial({ name: '', short: '', category: 'Projetor', color: 'bg-blue-600', isShareable: false });
    notify("Material cadastrado!");
  };

  const reportIssue = (e) => {
    e.preventDefault();
    if (!issueForm.materialId || !issueForm.text) return;
    const material = materials.find(m => m.id === issueForm.materialId);
    const newIssue = { id: Date.now(), teacher: user.username, materialName: material?.name, text: issueForm.text, status: "pendente", date: new Date().toLocaleDateString() };
    setIssues(prev => [newIssue, ...prev]);
    setIssueForm({ materialId: '', text: '' });
    notify("Ocorrência registrada.");
  };

  // --- EXPORTAÇÃO CONFORME A FOTO ---
  const exportToExcel = () => {
    const filtered = bookings.filter(b => b.date >= exportRange.start && b.date <= exportRange.end);
    if (filtered.length === 0) return notify("Nenhum dado encontrado.", "error");

    let csvContent = "\uFEFF"; 
    csvContent += "data;aula;professor;sala;material 1;material 2;material 3\n";

    filtered.forEach(b => {
      const aula = HORARIOS.find(h => h.id === b.horarioId)?.label || b.horarioId;
      const resourceNames = b.resources.map(id => materials.find(m => m.id === id)?.name || id);
      const mat1 = resourceNames[0] || "";
      const mat2 = resourceNames[1] || "";
      const mat3 = resourceNames[2] || "";
      csvContent += `${b.date};${aula};${b.teacher};${b.room};${mat1};${mat2};${mat3}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_LEI_EEMTI_Anisio.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Planilha baixada!");
  };

  const currentNextAula = activeCell ? getNextAula(activeCell.horarioId) : null;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-500">
          <div className="bg-blue-600 p-12 text-white text-center">
            <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 backdrop-blur-lg border border-white/30 text-white">
              <Monitor size={36} />
            </div>
            <h1 className="text-2xl font-black tracking-tight uppercase leading-none text-white">EEMTI Anísio Teixeira</h1>
            <p className="text-blue-100 text-[10px] font-black uppercase tracking-[0.3em] mt-3">Sistema de Gestão LEI</p>
          </div>
          <form onSubmit={handleLogin} className="p-10 space-y-7">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-slate-400">Nome / Utilizador</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required className="w-full pl-12 pr-4 py-4.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-800 uppercase" placeholder="EX: JOÃO SILVA" value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2 text-slate-400">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1">Senha</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required type="password" name="password" autoComplete="current-password" className="w-full pl-12 pr-4 py-4.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-800" placeholder="••••••••" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} />
              </div>
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
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200"><Monitor className="text-white" size={24} /></div>
          <div><h1 className="font-black text-slate-800 leading-tight text-sm tracking-tighter uppercase">LEI ANÍSIO</h1><p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest">EEMTI ANÍSIO TEIXEIRA</p></div>
        </div>
        <nav className="flex-1 px-4 space-y-1.5 mt-2">
          <SideNavItem icon={<LayoutDashboard size={18}/>} label="Agenda Semanal" active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} />
          {user.isAdmin && (
            <>
              <SideNavItem icon={<Layers size={18}/>} label="Gerir Materiais" active={activeTab === 'materials'} onClick={() => setActiveTab('materials')} />
              <SideNavItem icon={<Download size={18}/>} label="Exportar Excel" active={activeTab === 'export'} onClick={() => setActiveTab('export')} />
            </>
          )}
          <SideNavItem icon={<Wrench size={18}/>} label="Ocorrências" active={activeTab === 'issues'} onClick={() => setActiveTab('issues')} />
        </nav>
        <div className="p-6 border-t border-slate-100 bg-slate-50/30">
          <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${user.isAdmin ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'}`}>
                {user.username.substring(0, 1)}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-800 truncate uppercase">{user.username}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{user.isAdmin ? 'Admin' : 'Docente'}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-slate-300 hover:text-red-500 transition-colors ml-2"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden pb-20 lg:pb-0">
        <header className="h-auto lg:h-20 bg-white border-b border-slate-200 px-4 lg:px-10 py-4 lg:py-0 flex flex-col lg:flex-row lg:items-center justify-between shrink-0 gap-4 z-10 text-slate-900">
          <div className="flex items-center justify-between w-full lg:w-auto">
             <div className="flex items-center gap-3 lg:hidden text-slate-900">
               <div className="bg-blue-600 p-1.5 rounded-lg"><Monitor className="text-white" size={16} /></div>
               <h1 className="font-black text-xs uppercase tracking-tighter">{user.username}</h1>
               <button onClick={handleLogout} className="p-1.5 text-slate-400 ml-auto"><LogOut size={16}/></button>
             </div>
             
             {activeTab === 'agenda' && (
               <div className="relative group flex-1 lg:flex-none mx-4 lg:mx-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500" size={16} />
                  <input type="text" placeholder="Filtrar professor ou sala..." className="pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white outline-none w-full lg:w-80 transition-all font-bold text-slate-800 text-xs shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
               </div>
             )}
          </div>
          
          {activeTab === 'agenda' && (
            <div className="flex items-center justify-center">
              <div className="flex bg-slate-100 border border-slate-200 p-1.5 rounded-[1.2rem] items-center shadow-inner">
                <button onClick={() => setCurrentMonday(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })} className="p-2 bg-white rounded-xl shadow-sm text-slate-600 hover:text-blue-600 transition-all"><ChevronLeft size={18}/></button>
                <span className="px-6 text-[10px] lg:text-xs font-black text-slate-600 uppercase tracking-widest min-w-[160px] text-center">{formatWeekDisplay(currentMonday)}</span>
                <button onClick={() => setCurrentMonday(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })} className="p-2 bg-white rounded-xl shadow-sm text-slate-600 hover:text-blue-600 transition-all"><ChevronRight size={18}/></button>
              </div>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-10 text-slate-900">
          {activeTab === 'agenda' && (
            <div className="space-y-6">
              <div className="lg:hidden flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
                {weekDates.map((item, index) => (
                  <button key={item.date} onClick={() => setCurrentDayIndexMobile(index)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex flex-col items-center min-w-[100px] border shadow-md ${currentDayIndexMobile === index ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <span>{item.nome}</span>
                    <span className="text-[9px] font-bold mt-1 opacity-70">{item.dateObj.getDate()}/{item.dateObj.getMonth() + 1}</span>
                  </button>
                ))}
              </div>

              <div className="lg:min-w-[1100px] bg-white rounded-[2.5rem] lg:rounded-[3.5rem] border border-slate-200 shadow-2xl overflow-hidden">
                <table className="w-full border-collapse table-fixed">
                  <thead className="hidden lg:table-header-group">
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="w-28 p-8 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200">Horário</th>
                      {weekDates.map(item => (
                        <th key={item.date} className="p-8 text-center border-r border-slate-100 last:border-r-0">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{item.nome}</span>
                            <span className="text-[12px] text-blue-600 font-black mt-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">{item.dateObj.getDate()} / {item.dateObj.getMonth() + 1}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {HORARIOS.map((horario) => (
                      <tr key={horario.id} className={horario.type === 'pausa' ? 'bg-slate-50/40' : ''}>
                        <td className="w-16 lg:w-28 p-4 lg:p-8 border-r border-slate-100 text-center align-middle shrink-0">
                          <div className="fle