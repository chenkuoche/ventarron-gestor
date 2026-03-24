import React, { useState, useEffect } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { auth, loginWithGoogle, logout } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Users,
  Calendar,
  Wallet,
  PieChart,
  Home,
  CircleCheck,
  Menu,
  LogOut,
  X
} from 'lucide-react';

// Pages
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import Classes from './pages/Classes';
import Reports from './pages/Reports';

const iconMap = {
  'Asistencia y Pagos': CircleCheck,
  Alumnos: Users,
  Clases: Calendar,
  Dashboard: Home,
  Reportes: PieChart,
};

const MainLayout = ({ user }) => {
  const { hasUnsavedChanges, setHasUnsavedChanges, activePage, setActivePage } = useAppContext();
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Evitar cerrar pestaña o navegador si hay cambios sin guardar
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handlePageChange = (page) => {
    if (page === activePage) return;

    if (hasUnsavedChanges) {
        if (!window.confirm('Tienes cambios sin guardar en Asistencias. ¿Quieres salir de todas formas?')) {
            return;
        }
        setHasUnsavedChanges(false);
    }

    setActivePage(page);
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case 'Dashboard': return <Dashboard />;
      case 'Alumnos': return <Students />;
      case 'Asistencia y Pagos': return <Attendance />;
      case 'Clases': return <Classes />;
      case 'Reportes': return <Reports />;
      default: return <Attendance />;
    }
  };

  return (
    <div className="app-container">
      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <nav className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <img src="/logo.png" alt="Ventarrón" style={{ maxWidth: '100%', maxHeight: '70px', height: 'auto' }} />
        </div>

        <div className="sidebar-nav" style={{ flex: 1, padding: '20px 10px' }}>
          {Object.keys(iconMap).map(page => {
            const Icon = iconMap[page];
            return (
              <button
                key={page}
                className={`nav-btn ${activePage === page ? 'active' : ''}`}
                onClick={() => handlePageChange(page)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 15px', color: activePage === page ? 'white' : '#bdc3c7',
                  backgroundColor: activePage === page ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderLeft: activePage === page ? '4px solid #e74c3c' : '4px solid transparent',
                  borderRadius: '4px', cursor: 'pointer', fontSize: '15px', marginBottom: '5px', textAlign: 'left'
                }}
              >
                <Icon size={18} />
                {page}
              </button>
            );
          })}
        </div>
        
        <div style={{ padding: '15px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ marginBottom: '15px', padding: '0 5px' }}>
            <p style={{ fontSize: '11px', color: '#718096', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sesión iniciada como:</p>
            <p style={{ fontSize: '13px', color: '#a0aec0', margin: '4px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.email}>
              {user.email}
            </p>
          </div>
          <button 
            onClick={logout}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px', 
              backgroundColor: 'transparent', border: '1px solid #4a5568', borderRadius: '4px', 
              color: '#bdc3c7', cursor: 'pointer', transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(231, 76, 60, 0.1)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <LogOut size={16} /> Salir
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="main-content">
        {/* Header */}
        <header style={{
          height: '70px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', padding: '0 40px',
          backgroundColor: '#2c3e50', position: 'sticky', top: 0, zIndex: 10
        }}>
          <div className="flex align-center gap-10" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <Menu size={24} />
            </button>
            <h3 style={{ margin: 0 }}>{activePage}</h3>
          </div>
            <span style={{ fontSize: '12px', opacity: 0.2 }}>v1.4.5</span>
        </header>

        <div className="container" style={{ padding: '30px 40px' }}>
          {renderPage()}
        </div>
      </main>
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorVisible, setErrorVisible] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && currentUser.email === 'escueladetangoventarron@gmail.com') {
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setErrorVisible('');
      await loginWithGoogle();
    } catch (error) {
      console.error(error);
      setErrorVisible(error.message || 'Error al iniciar sesión');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a202c', color: 'white' }}>
        <p>Cargando Ventarrón Gestor...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a202c', color: 'white', padding: '20px' }}>
        <div style={{ backgroundColor: '#2d3748', padding: '40px', borderRadius: '12px', textAlign: 'center', maxWidth: '400px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          <img src="/logo.png" alt="Ventarrón Logo" style={{ width: '250px', maxWidth: '100%', marginBottom: '20px' }} />
          <h2 style={{ marginBottom: '10px', fontSize: '1.2rem' }}>Gestor de Asistencias</h2>
          <p style={{ opacity: 0.6, marginBottom: '30px', fontSize: '14px' }}>Acceso exclusivo para administración.</p>
          
          {errorVisible && (
            <div style={{ backgroundColor: '#fed7d7', color: '#822727', padding: '10px', borderRadius: '6px', marginBottom: '20px', fontSize: '13px' }}>
              {errorVisible}
            </div>
          )}

          <button 
            onClick={handleLogin}
            style={{ 
              backgroundColor: '#4285F4', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', 
              cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              gap: '10px', width: '100%', fontSize: '16px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppProvider>
      <MainLayout user={user} />
    </AppProvider>
  );
}

export default App;
