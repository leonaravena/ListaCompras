import { initializeApp, getApps, getApp } from 'firebase/app';
// Importamos initializeAuth y la función de persistencia móvil
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDLrsUOg5LZ7ArkuV2c6tJg25uBjp82v00",
  authDomain: "listacomprasapp-e9144.firebaseapp.com",
  projectId: "listacomprasapp-e9144",
  storageBucket: "listacomprasapp-e9144.firebasestorage.app",
  messagingSenderId: "871728736804",
  appId: "1:871728736804:web:a5f2e710fb7bacc78586b1"
};
let app;
let auth: any;

// Inicialización segura para el Fast Refresh de React Native
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // CAMBIO CLAVE: Inicializamos Auth indicándole que use AsyncStorage como memoria
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  app = getApp();
  auth = getAuth(app);
}

const db = getFirestore(app);

export { auth, db };