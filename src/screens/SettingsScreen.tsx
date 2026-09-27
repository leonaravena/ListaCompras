import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { auth, db } from '../config/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function SettingsScreen({ navigation }: any) {
  const [partnerCode, setPartnerCode] = useState('');
  const [myEmail, setMyEmail] = useState('');
  const [myCode, setMyCode] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. Cargar los datos del usuario actual al abrir la pantalla
  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        setMyEmail(user.email || '');
        
        // Buscamos a qué lista pertenece este usuario
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const listId = userDoc.data().listId;
          
          // Buscamos el código de esa lista
          const listDocRef = doc(db, 'shopping_lists', listId);
          const listDoc = await getDoc(listDocRef);
          
          if (listDoc.exists()) {
            setMyCode(listDoc.data().joinCode);
          }
        }
      }
      setLoading(false);
    };

    fetchUserData();
  }, []);

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(myCode);
    Alert.alert('Copiado', 'El código ha sido copiado al portapapeles.');
  };

  // 2. Lógica para buscar el código y cambiar de lista
  const handleJoin = async () => {
    if (partnerCode.trim() === '') return;
    
    try {
      const formattedCode = partnerCode.trim().toUpperCase();
      
      // Hacemos una consulta a Firestore buscando una lista que tenga este código exacto
      const q = query(collection(db, 'shopping_lists'), where('joinCode', '==', formattedCode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        Alert.alert('Error', 'Código no encontrado. Verifica y vuelve a intentar.');
        return;
      }
      
      // Si la encontramos, sacamos su ID interno de Firebase
      const listDoc = querySnapshot.docs[0];
      const newListId = listDoc.id;
      
      // Actualizamos el perfil de nuestro usuario para que ahora apunte a esta nueva lista
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          listId: newListId
        });
        
        Alert.alert('¡Éxito!', 'Te has unido a la lista de tu pareja.');
        setPartnerCode('');
        navigation.goBack(); // Volvemos a la pantalla principal para ver los nuevos productos
      }
    } catch (error: any) {
      Alert.alert('Error', 'Ocurrió un problema al intentar vincular la cuenta.');
    }
  };

  // 3. Cerrar sesión borrando los datos del celular
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Error', 'No se pudo cerrar sesión.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mi Cuenta</Text>
          <Text style={styles.emailText}>{myEmail}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vincular Listas</Text>
          
          <View style={styles.codeContainer}>
            <View>
              <Text style={styles.label}>Tu código de grupo:</Text>
              <Text style={styles.myCode}>{myCode}</Text>
            </View>
            <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
              <Ionicons name="copy-outline" size={20} color="#fff" />
              <Text style={styles.copyText}>Copiar</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Unirse a la lista de tu pareja:</Text>
          <View style={styles.joinContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ej: XYZ-987"
              value={partnerCode}
              onChangeText={setPartnerCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.joinButton} onPress={handleJoin}>
              <Text style={styles.joinButtonText}>Vincular</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 24 },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  content: { paddingHorizontal: 24 },
  section: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#eee' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  emailText: { fontSize: 16, color: '#666' },
  label: { fontSize: 14, color: '#666', marginBottom: 8 },
  codeContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8, marginBottom: 24 },
  myCode: { fontSize: 24, fontWeight: 'bold', color: '#007AFF', letterSpacing: 2 },
  copyButton: { backgroundColor: '#007AFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  copyText: { color: '#fff', marginLeft: 4, fontWeight: 'bold' },
  joinContainer: { flexDirection: 'row' },
  input: { flex: 1, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginRight: 8, fontSize: 16 },
  joinButton: { backgroundColor: '#34C759', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 8 },
  joinButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FF3B30' },
  logoutText: { color: '#FF3B30', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
});