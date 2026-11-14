import { createContext, useContext, useState, Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Orbit,
  LayoutDashboard,
  ScanLine,
  Activity,
  BrainCircuit,
  Radio,
  TriangleAlert,
  Settings2,
  ArrowUpRight,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { api, useApi, currentRole } from './services/api';
import type { Astronaut, Queue } from './services/types';
import { Loading, ErrorBox } from './components/UI';
const Home = lazy(() => import('./pages/Home'));
const Booth = lazy(() => import('./pages/Booth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Intelligence = lazy(() => import('./pages/Intelligence'));
const Emergency = lazy(() => import('./pages/Emergency'));
const MissionControl = lazy(() => import('./pages/MissionControl'));
const Settings = lazy(() => import('./pages/Settings'));
type CrewContextType = {
  crew: Astronaut[];
  selected: string;
  select: (id: string) => void;
  refresh: () => void;
  role: string;
  setRole: (r: string) => void;
};
const CrewContext = createContext<CrewContextType>(null!);
export const useCrew = () => useContext(CrewContext);
function Shell() {
  const navigate = useNavigate();
  const crew = useApi<Astronaut[]>('/astronauts', 15000);
  const link = useApi<Queue>('/communications', 3000);
  const [selected, selectState] = useState(localStorage.getItem('astra-crew') || 'AST-001');
  const [role, roleState] = useState(currentRole());
  const select = (id: string) => {
    selectState(id);
    localStorage.setItem('astra-crew', id);
  };
  const setRole = (r: string) => {
    roleState(r);
    localStorage.setItem('astra-role', r);
  };
  const location = useLocation();
  const active = crew.data?.some((c) => c.id === selected)
    ? selected
    : crew.data?.[0]?.id || selected;
  const links = [
    ['/', LayoutDashboard, 'Mission overview'],
    ['/booth', ScanLine, 'Assessment booth'],
    [`/astronaut/${active}`, Activity, 'Crew health'],
    [`/intelligence/${active}`, BrainCircuit, 'Health intelligence'],
    ['/mission-control', Radio, 'Mission Control'],
    ['/settings', Settings2, 'Station settings'],
  ] as const;
  return (
    <CrewContext.Provider
      value={{
        crew: crew.data || [],
        selected: active,
        select,
        refresh: crew.refresh,
        role,
        setRole,
      }}
    >
      <div className="app-shell">
        <aside className="sidebar">
          <Link to="/" className="brand">
            <span className="brand-symbol">
              <Orbit size={28} />
            </span>
            <span>
              ASTRA<small>HUMAN HEALTH · BEYOND EARTH</small>
            </span>
          </Link>
          <div className="mission-tag">
            <span className="status-dot" /> ARES PATHFINDER <span className="mono">01</span>
          </div>
          <div className="nav-caption">FLIGHT OPERATIONS</div>
          <nav aria-label="Main navigation">
            {links.map(([path, Icon, name]) => (
              <NavLink key={path} to={path} end={path === '/'}>
                <Icon size={18} />
                <span>{name}</span>
                {location.pathname === path && <span className="nav-active-dot" />}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="local-note">
              <ShieldCheck size={18} />
              <div>
                Onboard intelligence<small>Local processing · SQLite storage</small>
              </div>
            </div>
            <Link className="emergency-nav" to="/emergency">
              <TriangleAlert size={18} /> Emergency assistance
              <ArrowUpRight size={15} />
            </Link>
            <div className="sidebar-footer">
              ASTRA SYSTEMS <span>PROTOTYPE v0.1</span>
            </div>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="topbar-location">
              <span className="status-dot" /> HABITAT 01 <span className="divider">/</span> MEDICAL
              OPERATIONS
            </div>
            <div className="topbar-controls">
              <span className={'link-state ' + (!link.data?.settings.link_online ? 'amber' : '')}>
                <Radio size={14} />
                {link.data
                  ? link.data.settings.link_online
                    ? 'SIMULATED LINK ONLINE'
                    : 'SIMULATED LINK OFFLINE'
                  : 'LOCAL SERVICE'}
              </span>
              <label className="crew-select">
                <span className="sr-only">Active crew member</span>
                <select
                  value={active}
                  onChange={(e) => {
                    select(e.target.value);
                    if (location.pathname.startsWith('/astronaut/'))
                      navigate('/astronaut/' + e.target.value);
                    if (location.pathname.startsWith('/intelligence/'))
                      navigate('/intelligence/' + e.target.value);
                  }}
                >
                  {crew.data?.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </label>
            </div>
          </header>
          <main id="main-content">
            <div className="demo-banner">
              <span>DEMONSTRATION MODE</span> Fictional mission. Simulated medical data. Live camera
              features stay local.
            </div>
            {crew.error && <ErrorBox message={crew.error} retry={crew.refresh} />}
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/booth" element={<Booth />} />
                <Route path="/astronaut/:id" element={<Dashboard />} />
                <Route path="/intelligence/:id" element={<Intelligence />} />
                <Route path="/emergency" element={<Emergency />} />
                <Route path="/mission-control" element={<MissionControl />} />
                <Route path="/settings" element={<Settings />} />
                <Route
                  path="*"
                  element={
                    <div className="empty">
                      <h1>Route not found</h1>
                      <Link to="/">Return to mission overview</Link>
                    </div>
                  }
                />
              </Routes>
            </Suspense>
            <footer className="page-footer">
              <span>ASTRA / AUTONOMOUS SPACE TELEHEALTH & RISK ASSESSMENT</span>
              <span>Technology demonstrator · Not a medical device</span>
            </footer>
          </main>
        </div>
      </div>
    </CrewContext.Provider>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Shell />
    </BrowserRouter>
  );
}
