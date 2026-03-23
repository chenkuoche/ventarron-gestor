// Firebase Configuration
// TODO: Replace with your project's config object from the Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyB3HfruwaC2cCBp6Eo4FBtWmaEmjqpUCgE",
    authDomain: "ventarron-web.firebaseapp.com",
    projectId: "ventarron-web",
    storageBucket: "ventarron-web.firebasestorage.app",
    messagingSenderId: "1071115576324",
    appId: "1:1071115576324:web:d8f501f8662ea174954151"
};

// Initialize Firebase
// Check if firebase is defined (it will be loaded via CDN in HTML)
if (typeof firebase !== 'undefined') {
    window.app = firebase.initializeApp(firebaseConfig);
    // 1. Initialize App Check FIRST
    if (firebase.appCheck) {
        if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
        const k = '6LftpzssAAAAAKTseEWaQigx2vpoehl02c5fmwGu';
        window.appCheck = firebase.appCheck();
        window.appCheck.activate(
            new firebase.appCheck.ReCaptchaV3Provider(k),
            true
        );
        console.log("App Check activated (Admin)");
    }

    // 2. Initialize Services AFTER App Check
    window.db = firebase.firestore();
    window.auth = firebase.auth();
    window.storage = firebase.storage();

    console.log("Admin Firebase services initialized with App Check");

    console.log("Firebase initialized globally");
} else {
    console.error("Firebase SDK not loaded");
}
