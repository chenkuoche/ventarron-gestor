import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, functions, httpsCallable } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activePage, setActivePage] = useState('Asistencia y Pagos');
  const [selectedClassId, setSelectedClassId] = useState('');

  // 1. Sincronizar Alumnos en tiempo real
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sincronizar Clases en tiempo real
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'classes'), (snapshot) => {
      const classData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Solo inicializar si realmente no hay nada
      if (classData.length === 0) {
        const initialClasses = [
          { name: 'Martes 19:30', day: 'Martes', time: '19:30', endTime: '21:00', profitSplit: 1, rent: 1000, classPrice: 800, monthlyPrice: 3000, monthly2xsPrice: 4500 },
          { name: 'Martes 21:00', day: 'Martes', time: '21:00', endTime: '22:30', profitSplit: 1, rent: 1000, classPrice: 800, monthlyPrice: 3000, monthly2xsPrice: 4500 },
          { name: 'Jueves 19:30', day: 'Jueves', time: '19:30', endTime: '21:00', profitSplit: 0.5, rent: 1000, classPrice: 800, monthlyPrice: 3000, monthly2xsPrice: 4500 }
        ];
        initialClasses.forEach(async (c) => {
          await addDoc(collection(db, 'classes'), c);
        });
      } else {
        setClasses(classData);
      }
    });
    return () => unsubscribe();
  }, []);

  // 3. Sincronizar Asistencias (Últimos 3 meses para no saturar memoria)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'attendance_records'), (snapshot) => {
      const recordData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(recordData);
    });
    return () => unsubscribe();
  }, []);

  const addStudent = async (student) => {
    await addDoc(collection(db, 'students'), {
      ...student,
      enrolledClasses: student.enrolledClasses || [],
      guestClasses: student.guestClasses || [],
      createdAt: new Date().toISOString()
    });
  };

  const updateStudent = async (id, updated) => {
    await updateDoc(doc(db, 'students', id), updated);
  };

  const deleteStudent = async (id) => {
    await deleteDoc(doc(db, 'students', id));
  };

  const addClass = async (cls) => {
    await addDoc(collection(db, 'classes'), {
      ...cls,
      classPrice: cls.classPrice || 0,
      monthlyPrice: cls.monthlyPrice || 0,
      monthly2xsPrice: cls.monthly2xsPrice || 0
    });
  };

  const updateClass = async (id, updated) => {
    await updateDoc(doc(db, 'classes', id), updated);
  };

  const deleteClass = async (id) => {
    await deleteDoc(doc(db, 'classes', id));
  };

  const saveAttendanceAndPayment = async (date, classId, studentRecords, idsToDelete = []) => {
    // 1. Guardar/Actualizar registros
    const batchPromises = Object.entries(studentRecords).map(async ([studentId, data]) => {
      const recordId = `${date}_${classId}_${studentId}`;
      await setDoc(doc(db, 'attendance_records', recordId), {
        date,
        classId,
        studentId,
        ...data,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });

    // 2. Eliminar registros que el usuario quitó explícitamente
    const deletePromises = idsToDelete.map(async (studentId) => {
      const recordId = `${date}_${classId}_${studentId}`;
      await deleteDoc(doc(db, 'attendance_records', recordId));
    });

    await Promise.all([...batchPromises, ...deletePromises]);
  };

  const clearAllRecords = async () => {
    const batch = writeBatch(db);
    const snapshot = await getDocs(collection(db, 'attendance_records'));
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  };

  return (
    <AppContext.Provider value={{
      students, addStudent, updateStudent, deleteStudent,
      classes, addClass, updateClass, deleteClass,
      records, saveAttendanceAndPayment, clearAllRecords,
      hasUnsavedChanges, setHasUnsavedChanges,
      activePage, setActivePage,
      selectedClassId, setSelectedClassId,
      loading,
      sendEmail: async (data) => {
        const mailer = httpsCallable(functions, 'sendEmail');
        return await mailer(data);
      },
      triggerTestReminder: async (data) => {
        const mailer = httpsCallable(functions, 'triggerTestReminder');
        return await mailer(data);
      },
      getPendingReminders: async (data) => {
        const mailer = httpsCallable(functions, 'getPendingReminders');
        return await mailer(data);
      },
      triggerManualReminders: async (data) => {
        const mailer = httpsCallable(functions, 'triggerManualReminders');
        return await mailer(data);
      },
      markReceiptSent: async (date, classId, studentId) => {
        const q = query(
          collection(db, 'attendance_records'),
          where('date', '==', date),
          where('classId', '==', classId),
          where('studentId', '==', studentId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docRef = snap.docs[0].ref;
          await updateDoc(docRef, { receiptSent: true });
        }
      }
    }}>
      {children}
    </AppContext.Provider>
  );
};
