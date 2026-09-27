import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../config/firebase';
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy, getDoc } from 'firebase/firestore';

interface Product {
  id: string;
  name: string;
  isChecked: boolean;
}

export default function HomeScreen({ navigation }: any) {
  const [items, setItems] = useState<Product[]>([]);
  const [inputText, setInputText] = useState('');
  const [listId, setListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Obtener el ID de la lista a la que pertenece el usuario
 useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    
    // Cambiamos getDoc por onSnapshot para que escuche cambios constantemente
    const unsubscribeUser = onSnapshot(userDocRef, (userDoc) => {
      if (userDoc.exists()) {
        setListId(userDoc.data().listId);
      }
    });

    return () => unsubscribeUser();
  }, []);

  // 2. Escuchar los productos en tiempo real una vez que tenemos el listId
  useEffect(() => {
    if (!listId) return;

    // Apuntamos a la subcolección 'items' de la lista específica
    const itemsRef = collection(db, 'shopping_lists', listId, 'items');
    // Ordenamos por fecha de creación descendente (los más nuevos arriba)
    const q = query(itemsRef, orderBy('createdAt', 'desc'));

    // onSnapshot es la magia de Firebase: se ejecuta automáticamente cada vez que la base de datos cambia
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems: Product[] = [];
      snapshot.forEach((doc) => {
        fetchedItems.push({
          id: doc.id,
          name: doc.data().name,
          isChecked: doc.data().isChecked,
        });
      });
      setItems(fetchedItems);
      setLoading(false);
    });

    // Limpiamos el listener de memoria cuando el usuario sale de la pantalla
    return () => unsubscribe();
  }, [listId]);

  const addItem = async () => {
    if (inputText.trim() === '' || !listId) return;

    const itemsRef = collection(db, 'shopping_lists', listId, 'items');
    await addDoc(itemsRef, {
      name: inputText,
      isChecked: false,
      createdAt: new Date(),
      addedBy: auth.currentUser?.uid
    });
    
    setInputText('');
  };

  const toggleItem = async (id: string, currentStatus: boolean) => {
    if (!listId) return;
    const itemRef = doc(db, 'shopping_lists', listId, 'items', id);
    await updateDoc(itemRef, {
      isChecked: !currentStatus
    });
  };

  const deleteItem = async (id: string) => {
    if (!listId) return;
    const itemRef = doc(db, 'shopping_lists', listId, 'items', id);
    await deleteDoc(itemRef);
  };

  // Mostrar un indicador de carga mientras buscamos a qué lista pertenece el usuario
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
        <Text style={styles.headerTitle}>Nuestra Lista</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ej: Huevos, Leche..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={addItem}
        />
        <TouchableOpacity style={styles.addButton} onPress={addItem}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <TouchableOpacity onPress={() => toggleItem(item.id, item.isChecked)} style={styles.checkButton}>
              <Ionicons 
                name={item.isChecked ? "checkbox" : "square-outline"} 
                size={24} 
                color={item.isChecked ? "#007AFF" : "#888"} 
              />
            </TouchableOpacity>
            
            <Text style={[styles.itemText, item.isChecked && styles.itemTextChecked]}>
              {item.name}
            </Text>

            <TouchableOpacity onPress={() => deleteItem(item.id)}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>La lista está vacía. ¡Agrega algo!</Text>}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 24 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  inputContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  input: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginRight: 8 },
  addButton: { backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', width: 48, borderRadius: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 8 },
  checkButton: { marginRight: 12 },
  itemText: { flex: 1, fontSize: 16, color: '#333' },
  itemTextChecked: { color: '#888', textDecorationLine: 'line-through' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 32, fontSize: 16 },
});