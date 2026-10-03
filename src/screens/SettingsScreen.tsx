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
  ActivityIndicator,
  ScrollView,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../config/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

const AVAILABLE_COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5856D6', '#E91E63', '#00BCD4'];
const AVAILABLE_ICONS = ['wallet-outline', 'card-outline', 'cash-outline', 'gift-outline', 'briefcase-outline', 'star-outline'];

interface Pocket {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export default function SettingsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [myEmail, setMyEmail] = useState('');
  
  const [displayName, setDisplayName] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVAILABLE_COLORS[0]);
  const [isEditingIdentity, setIsEditingIdentity] = useState(false); 
  
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [isEditingPockets, setIsEditingPockets] = useState(false); // NUEVO: Modo Edición de Bolsillos
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingPocketId, setEditingPocketId] = useState<string | null>(null);
  const [tempPocketName, setTempPocketName] = useState('');
  const [tempPocketIcon, setTempPocketIcon] = useState(AVAILABLE_ICONS[0]);
  const [tempPocketColor, setTempPocketColor] = useState(AVAILABLE_COLORS[0]);

  const [partnerCode, setPartnerCode] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        setMyEmail(user.email || '');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setDisplayName(userData.displayName || '');
          setAvatarColor(userData.avatarColor || AVAILABLE_COLORS[0]);
          if (userData.pockets && typeof userData.pockets[0] === 'object') {
            setPockets(userData.pockets);
          } else {
            setPockets([]); 
          }
        }
      }
      setLoading(false);
    };
    fetchUserData();
  }, []);

  const saveIdentity = async () => {
    if (displayName.trim() === '') {
      Alert.alert('Error', 'Por favor ingresa un nombre para identificarte.');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { displayName: displayName.trim(), avatarColor: avatarColor });
      setIsEditingIdentity(false); 
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la identidad.');
    }
  };

  const openPocketModal = (pocket: Pocket | null = null) => {
    if (pocket) {
      setEditingPocketId(pocket.id);
      setTempPocketName(pocket.name);
      setTempPocketIcon(pocket.icon);
      setTempPocketColor(pocket.color);
    } else {
      setEditingPocketId(null);
      setTempPocketName('');
      setTempPocketIcon(AVAILABLE_ICONS[0]);
      setTempPocketColor(AVAILABLE_COLORS[0]);
    }
    setIsModalVisible(true);
  };

  const savePocket = async () => {
    if (tempPocketName.trim() === '') {
      Alert.alert('Error', 'Debes darle un nombre a tu bolsillo.');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;

    let updatedPockets;
    if (editingPocketId) {
      updatedPockets = pockets.map(p => p.id === editingPocketId ? { ...p, name: tempPocketName.trim(), icon: tempPocketIcon, color: tempPocketColor } : p);
    } else {
      const newPocket: Pocket = { id: `pocket_${Date.now()}`, name: tempPocketName.trim(), icon: tempPocketIcon, color: tempPocketColor };
      updatedPockets = [...pockets, newPocket];
    }

    setPockets(updatedPockets);
    setIsModalVisible(false);

    try {
      await updateDoc(doc(db, 'users', user.uid), { pockets: updatedPockets });
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el bolsillo.');
    }
  };

  const deletePocket = async (pocketId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const updatedPockets = pockets.filter(p => p.id !== pocketId);
    setPockets(updatedPockets);
    try {
      await updateDoc(doc(db, 'users', user.uid), { pockets: updatedPockets });
    } catch (error) {
      Alert.alert('Error', 'No se pudo eliminar el bolsillo.');
    }
  };

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
        await updateDoc(doc(db, 'shopping_lists', newListId), { members: arrayUnion(user.uid) });
        await updateDoc(doc(db, 'users', user.uid), { listIds: arrayUnion(newListId) });
        Alert.alert('¡Éxito!', 'Te has unido a una nueva lista.');
        setPartnerCode('');
        navigation.navigate('MyLists');
      }
    } catch (error) {
      Alert.alert('Error', 'Ocurrió un problema al intentar vincular la cuenta.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // ELIMINAMOS navigation.replace('Login');
      // Al hacer signOut, App.tsx detecta que el usuario es null 
      // y automáticamente destruye esta pantalla y muestra el Login.
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mi Perfil</Text>
            <TouchableOpacity onPress={() => setIsEditingIdentity(!isEditingIdentity)}>
              <Ionicons name={isEditingIdentity ? "close" : "pencil"} size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>Correo electrónico</Text>
          <Text style={[styles.emailText, { marginBottom: 16 }]}>{myEmail}</Text>

          {isEditingIdentity ? (
            <View>
              <Text style={styles.label}>Nombre para las listas</Text>
              <TextInput
                style={[styles.input, { marginBottom: 16 }]}
                placeholder="Ej: Esteban"
                value={displayName}
                onChangeText={setDisplayName}
                autoFocus
              />
              <Text style={styles.label}>Color de tu Avatar</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {AVAILABLE_COLORS.map((color) => (
                  <TouchableOpacity key={color} style={[styles.colorCircle, { backgroundColor: color, borderWidth: avatarColor === color ? 3 : 0 }]} onPress={() => setAvatarColor(color)} />
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.saveBtn} onPress={saveIdentity}>
                <Text style={styles.saveBtnText}>Guardar Perfil</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.label}>Nombre para las listas</Text>
              <View style={styles.profileReadRow}>
                <View style={[styles.profileAvatar, { backgroundColor: avatarColor }]}>
                  <Text style={styles.profileAvatarText}>{displayName ? displayName.charAt(0).toUpperCase() : '?'}</Text>
                </View>
                <Text style={styles.profileName}>{displayName || 'Sin configurar'}</Text>
              </View>
            </View>
          )}
        </View>

        {/* MODO EDICIÓN DE BOLSILLOS RESTAURADO */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mis Bolsillos de Pago</Text>
            <TouchableOpacity onPress={() => setIsEditingPockets(!isEditingPockets)}>
              <Ionicons name={isEditingPockets ? "close" : "pencil"} size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Tus métodos de pago personalizados.</Text>
          
          <View style={styles.pocketsList}>
            {pockets.map((pocket) => (
              <TouchableOpacity 
                key={pocket.id} 
                style={[styles.pocketRow, { borderLeftColor: pocket.color, borderLeftWidth: 4, borderColor: isEditingPockets ? pocket.color : '#eee' }]}
                disabled={!isEditingPockets}
                onPress={() => openPocketModal(pocket)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={pocket.icon as any} size={20} color={pocket.color} style={{ marginRight: 12 }} />
                  <Text style={styles.pocketText}>{pocket.name}</Text>
                </View>
                {isEditingPockets && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="pencil" size={16} color="#888" style={{ marginRight: 16 }} />
                    <TouchableOpacity onPress={() => deletePocket(pocket.id)} style={styles.deletePocketBtn}>
                      <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))}
            {pockets.length === 0 && <Text style={{ color: '#888', fontStyle: 'italic', marginBottom: 8 }}>Aún no tienes bolsillos configurados.</Text>}
          </View>

          {!isEditingPockets && (
            <TouchableOpacity style={styles.openModalBtn} onPress={() => openPocketModal()}>
              <Ionicons name="add" size={20} color="#007AFF" style={{ marginRight: 8 }} />
              <Text style={styles.openModalText}>Crear Nuevo Bolsillo</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Unirse a una Lista</Text>
          <Text style={styles.label}>Pídele a tu pareja el código y escríbelo aquí:</Text>
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
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL PARA CREAR / EDITAR BOLSILLO */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingPocketId ? 'Editar Bolsillo' : 'Nuevo Bolsillo'}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Nombre (Ej: TC Compartida)"
              value={tempPocketName}
              onChangeText={setTempPocketName}
              autoFocus
            />

            <Text style={styles.modalSubtitle}>Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {AVAILABLE_COLORS.map((color) => (
                <TouchableOpacity key={color} style={[styles.colorCircle, { backgroundColor: color, borderWidth: tempPocketColor === color ? 3 : 0 }]} onPress={() => setTempPocketColor(color)} />
              ))}
            </ScrollView>

            <Text style={styles.modalSubtitle}>Ícono</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {AVAILABLE_ICONS.map((icon) => (
                <TouchableOpacity key={icon} style={[styles.iconBox, { borderColor: tempPocketIcon === icon ? tempPocketColor : '#eee' }]} onPress={() => setTempPocketIcon(icon)}>
                  <Ionicons name={icon as any} size={28} color={tempPocketIcon === icon ? tempPocketColor : '#888'} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: tempPocketColor }]} onPress={savePocket}>
              <Text style={styles.saveBtnText}>{editingPocketId ? 'Guardar Cambios' : 'Crear Bolsillo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  label: { fontSize: 12, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: 4 },
  emailText: { fontSize: 16, color: '#333', fontWeight: '500' },
  input: { flex: 1, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16 },
  profileReadRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  profileAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  profileAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  profileName: { fontSize: 16, color: '#333', fontWeight: 'bold' },
  pickerRow: { flexDirection: 'row', marginBottom: 24, marginTop: 8 },
  colorCircle: { width: 40, height: 40, borderRadius: 20, marginRight: 16, borderColor: '#333' },
  iconBox: { width: 48, height: 48, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  saveBtn: { backgroundColor: '#333', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  pocketsList: { marginBottom: 16 },
  pocketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 16, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  pocketText: { fontSize: 16, color: '#333', fontWeight: 'bold' },
  deletePocketBtn: { padding: 4 },
  openModalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, backgroundColor: '#f0f8ff', borderWidth: 1, borderColor: '#cce5ff' },
  openModalText: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 },
  joinContainer: { flexDirection: 'row' },
  joinButton: { backgroundColor: '#34C759', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 8, marginLeft: 8 },
  joinButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FF3B30' },
  logoutText: { color: '#FF3B30', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  modalSubtitle: { fontSize: 16, fontWeight: 'bold', color: '#666', marginBottom: 12 },
  modalInput: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 24 }
});