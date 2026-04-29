import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { ChevronLeft, ChevronRight, Cake, Gift } from 'lucide-react';

const Birthdays = () => {
    const { students, birthdayEmailsEnabled, toggleBirthdayEmails } = useAppContext();
    const [currentDate, setCurrentDate] = useState(new Date());


    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => {
        let day = new Date(year, month, 1).getDay();
        // Adjust so Monday is 0 and Sunday is 6
        return day === 0 ? 6 : day - 1;
    };

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

    const prevMonth = () => {
        setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    };

    const today = new Date();
    const isCurrentMonthAndYear = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

    // Filter students with valid birthday data
    const studentsWithBirthdays = students.filter(s => s.birthDay && s.birthMonth);

    // Get birthdays for the current selected month
    const monthBirthdays = studentsWithBirthdays.filter(s => Number(s.birthMonth) === currentMonth + 1)
        .sort((a, b) => Number(a.birthDay) - Number(b.birthDay));

    const getBirthdaysForDay = (day) => {
        return monthBirthdays.filter(s => Number(s.birthDay) === day);
    };

    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    return (
        <div className="birthdays-page" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Calendar Section */}
            <div className="card" style={{ flex: '2 1 500px', padding: '20px' }}>
                <div className="card-header-responsive" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Cake size={24} color="#f1c40f" />
                        Cumpleaños
                    </h3>
                    <div className="month-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ position: 'relative' }}>
                            <select 
                                value={currentMonth} 
                                onChange={(e) => setCurrentDate(new Date(currentYear, parseInt(e.target.value), 1))}
                                style={{ 
                                    background: 'rgba(255,255,255,0.1)', 
                                    border: '1px solid rgba(255,255,255,0.2)', 
                                    color: 'white', 
                                    padding: '10px 20px', 
                                    borderRadius: '20px', 
                                    fontWeight: 'bold',
                                    fontSize: '16px',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    minWidth: '140px'
                                }}
                            >
                                {months.map((m, i) => (
                                    <option key={i} value={i} style={{ background: '#2c3e50', color: 'white' }}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="calendar-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '5px'
                }}>
                    {/* Weekday headers */}
                    {weekDays.map(day => (
                        <div key={day} style={{ textAlign: 'center', padding: '10px', fontWeight: 'bold', opacity: 0.5, fontSize: '12px' }}>
                            {day}
                        </div>
                    ))}

                    {/* Empty cells for start of month */}
                    {Array.from({ length: firstDay }).map((_, index) => (
                        <div key={`empty-${index}`} style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', minHeight: '80px' }} />
                    ))}

                    {/* Days */}
                    {Array.from({ length: daysInMonth }).map((_, index) => {
                        const dayNumber = index + 1;
                        const isToday = isCurrentMonthAndYear && today.getDate() === dayNumber;
                        const dayBirthdays = getBirthdaysForDay(dayNumber);
                        const hasBirthdays = dayBirthdays.length > 0;

                        return (
                            <div key={dayNumber} className="calendar-day" style={{
                                padding: '10px',
                                background: hasBirthdays ? 'rgba(241, 196, 15, 0.1)' : 'rgba(255,255,255,0.05)',
                                border: isToday ? '2px solid #3498db' : (hasBirthdays ? '1px solid rgba(241, 196, 15, 0.3)' : '1px solid transparent'),
                                borderRadius: '8px',
                                minHeight: '80px',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <span style={{
                                    fontSize: '14px',
                                    fontWeight: isToday ? 'bold' : 'normal',
                                    color: isToday ? '#3498db' : (hasBirthdays ? '#f1c40f' : 'white')
                                }}>
                                    {dayNumber}
                                </span>
                                
                                <div style={{ marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, overflowY: 'auto' }}>
                                    {dayBirthdays.map(s => (
                                        <div key={s.id} style={{
                                            fontSize: '11px',
                                            background: '#f1c40f',
                                            color: '#000',
                                            padding: '2px 5px',
                                            borderRadius: '4px',
                                            fontWeight: 'bold',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }} title={s.name}>
                                            {s.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Month Birthdays List */}
            <div className="card" style={{ flex: '1 1 300px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Gift size={20} color="#e74c3c" />
                    Cumpleaños en {months[currentMonth]}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {monthBirthdays.length === 0 ? (
                        <p style={{ opacity: 0.5, textAlign: 'center', padding: '20px 0' }}>No hay cumpleaños registrados este mes.</p>
                    ) : (
                        monthBirthdays.map(s => (
                            <div key={s.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                padding: '12px 15px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '8px',
                                borderLeft: '4px solid #e74c3c'
                            }}>
                                <div style={{
                                    background: 'rgba(231, 76, 60, 0.1)',
                                    color: '#e74c3c',
                                    fontWeight: 'bold',
                                    fontSize: '18px',
                                    width: '40px',
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%'
                                }}>
                                    {s.birthDay}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: 0, fontSize: '15px' }}>{s.name}</h4>
                                    {s.phone && (
                                        <a href={`https://wa.me/${s.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#2ecc71', textDecoration: 'none', display: 'inline-block', marginTop: '4px' }}>
                                            Enviar WhatsApp
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Notifications Settings Card */}
            <div className="card" style={{ flex: '1 1 100%', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '15px', color: 'white' }}>Avisos Automáticos de Cumpleaños</h4>
                    <p style={{ margin: 0, fontSize: '12px', opacity: 0.6 }}>Recibir un email a las 9:00 AM avisando de los cumpleaños del día.</p>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px', margin: 0, flexShrink: 0 }}>
                    <input 
                        type="checkbox" 
                        checked={birthdayEmailsEnabled}
                        onChange={(e) => toggleBirthdayEmails(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: birthdayEmailsEnabled ? '#2ecc71' : 'rgba(255,255,255,0.1)',
                        transition: '.4s',
                        borderRadius: '34px',
                        border: birthdayEmailsEnabled ? '1px solid #2ecc71' : '1px solid rgba(255,255,255,0.2)'
                    }}>
                        <span style={{
                            position: 'absolute',
                            height: '20px',
                            width: '20px',
                            left: '3px',
                            bottom: '3px',
                            backgroundColor: 'white',
                            transition: '.4s',
                            borderRadius: '50%',
                            transform: birthdayEmailsEnabled ? 'translateX(22px)' : 'translateX(0)'
                        }}></span>
                    </span>
                </label>
            </div>
        </div>
    );
};

export default Birthdays;
