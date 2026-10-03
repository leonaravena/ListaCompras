import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './src/config/firebase';

import LoginScreen from './src/screens/LoginScreen';
import MyListsScreen from './src/screens/MyListsScreen';
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';

export type RootStackParamList = {
  Login: undefined;
  MyLists: undefined;
  Home: { listId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  // NUEVO: Estado que bloquea la navegación hasta que Firebase lea la memoria
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Escucha en tiempo real si hay una sesión guardada en el dispositivo
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false); // Oculta la pantalla de carga cuando Firebase responde
    });

    return unsubscribe;
  }, []);

  // Pantalla de carga mientras Firebase busca la sesión
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {/* Patrón avanzado de rutas protegidas: 
          Si hay usuario, Firebase solo le permite ver las pantallas de la app.
          Si no lo hay, solo le muestra el Login. */}
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MyLists" component={MyListsScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}