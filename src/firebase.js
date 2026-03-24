import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
    apiKey: "AIzaSyB3HfruwaC2cCBp6Eo4FBtWmaEmjqpUCgE",
    authDomain: "ventarron-web.firebaseapp.com",
    projectId: "ventarron-web",
    storageBucket: "ventarron-web.firebasestorage.app",
    messagingSenderId: "1071115576324",
    appId: "1:1071115576324:web:d8f501f8662ea174954151"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export { httpsCallable };

// Forzamos el uso de Long Polling para evitar errores de red (Fetch API / CORS)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache()
});

export const googleProvider = new GoogleAuthProvider();

// Solo sugerir la cuenta de administración
googleProvider.setCustomParameters({
  login_hint: 'escueladetangoventarron@gmail.com'
});

export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user.email !== 'escueladetangoventarron@gmail.com') {
            await signOut(auth);
            throw new Error("No tienes permisos de administrador.");
        }
        return result.user;
    } catch (error) {
        throw error;
    }
};

export const logout = () => signOut(auth);
