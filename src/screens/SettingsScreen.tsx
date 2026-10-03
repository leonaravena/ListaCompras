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
// 1. Agregamos arrayUnion a la importación
import { doc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function SettingsScreen({ navigation }: any) {
  const [partnerCode, setPartnerCode] = useState('');
  const [myEmail, setMyEmail] = useState('');
  // Dejamos el código temporalmente en blanco ya que ahora cada lista tendrá el suyo
  const [myCode, setMyCode] = useState('Visible en cada lista'); 
  const [loading, setLoading] = useState(true);

  // 2. Limpiamos el useEffect para que no colapse al no encontrar el listId antiguo
  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        setMyEmail(user.email || '');
      }
      setLoading(false);
    };

    fetchUserData();
  }, []);

  const handleCopyCode = async () => {
    if (myCode === 'Visible en cada lista') return;
    await Clipboard.setStringAsync(myCode);
    Alert.alert('Copiado', 'El código ha sido copiado al portapapeles.');
  };

  // 3. Actualizamos handleJoin con arrayUnion y navegación a MyLists
  const handleJoin = async () => {
    if (partnerCode.trim() === '') return;
    
    try {
      const formattedCode = partnerCode.trim().toUpperCase();
      
      const q = query(collection(db, 'shopping_lists'), where('joinCode', '==', formattedCode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        Alert.alert('Error', 'Código no encontrado. Verifica y vuelve a intentar.');
        return;
      }
      
      const listDoc = querySnapshot.docs[0];
      const newListId = listDoc.id;
      
     const user = auth.currentUser;
      if (user) {
        // 1. Inyectamos tu usuario en el documento de la lista compartida
        await updateDoc(doc(db, 'shopping_lists', newListId), {
          members: arrayUnion(user.uid)
        });
        
        // 2. Agregamos la lista a tu historial de usuario
        await updateDoc(doc(db, 'users', user.uid), {
          listIds: arrayUnion(newListId)
        });
        
        Alert.alert('¡Éxito!', 'Te has unido a una nueva lista.');
        setPartnerCode('');
        navigation.navigate('MyLists');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Ocurrió un problema al intentar vincular la cuenta.');
    }
  };

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
              <Text style={[styles.myCode, {fontSize: 16, color: '#888', letterSpacing: 0}]}>{myCode}</Text>
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