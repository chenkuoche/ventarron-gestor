import React from 'react';
import { useAppContext } from '../context/AppContext';
import { CircleCheck } from 'lucide-react';

const Welcome = () => {
    const { setActivePage } = useAppContext();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center' }}>
            <img src="/logo.png" alt="Ventarrón Logo" style={{ width: '250px', maxWidth: '100%', marginBottom: '30px' }} />
            <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>¡Bienvenido!</h1>
            <p style={{ opacity: 0.6, marginBottom: '40px', fontSize: '1.2rem', maxWidth: '400px' }}>
                Gestor de Administración y Asistencias de la Escuela de Tango Ventarrón.
            </p>
            <button 
                onClick={() => setActivePage('Asistencia y Pagos')}
                className="btn btn-primary"
                style={{
                    backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '15px 30px', 
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', 
                    alignItems: 'center', gap: '10px', fontSize: '1.2rem',
                    boxShadow: '0 4px 15px rgba(231, 76, 60, 0.4)', transition: 'all 0.3s, transform 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                <CircleCheck size={24} />
                Asistencias y Pagos
            </button>
        </div>
    );
};

export default Welcome;
