import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../config/firebase';
import { doc, getDoc, collection, addDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// IMPORTACIONES CORREGIDAS
// IMPORTACIÓN CORREGIDA (Sin la palabra inventada "reorderable")
import ReorderableList, { useReorderableDrag } from 'react-native-reorderable-list';
import { runOnJS } from 'react-native-reanimated';

const AVAILABLE_COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5856D6'];
const AVAILABLE_ICONS = ['cart-outline', 'home-outline', 'airplane-outline', 'barbell-outline', 'hammer-outline', 'fast-food-outline', 'gift-outline', 'paw-outline'];

// 1. EL CASCARÓN VISUAL (React.memo para rendimiento)
const ListCardContent = React.memo(({ item, isEditing, drag, onNavigate, onEdit, onDelete }: any) => {
  const listColor = item.color || '#007AFF';
  const listIcon = item.icon || 'cart-outline';

  return (
    <TouchableOpacity 
      style={[styles.listCard, { borderColor: isEditing ? listColor : '#eee', backgroundColor: '#fff' }]}
      onPress={() => !isEditing && onNavigate(item.id)}
      activeOpacity={isEditing ? 1 : 0.7}
    >
      <View style={styles.cardHeader}>
        {isEditing && (
          <TouchableOpacity 
            onLongPress={drag} 
            delayLongPress={150} 
            style={{ padding: 8, marginLeft: -8, marginRight: 4 }}
          >
            <Ionicons name="menu" size={24} color="#ccc" />
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          disabled={!isEditing} 
          onPress={() => onEdit(item)}
          style={[styles.iconContainer, { backgroundColor: isEditing ? `${listColor}15` : 'transparent' }]}
        >
          <Ionicons name={listIcon as any} size={40} color={listColor} />
          {isEditing && (
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={12} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
        
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            Código: {item.joinCode}
          </Text>
        </View>
      </View>
      
      {isEditing ? (
        <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item.id, item.name)}>
          <Ionicons name="trash-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-forward" size={24} color="#ccc" />
      )}
    </TouchableOpacity>
  );
}, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.item.name === next.item.name &&
    prev.item.color === next.item.color &&
    prev.item.icon === next.item.icon &&
    prev.isEditing === next.isEditing
  );
});

// 2. EL ENVOLTORIO DE ARRASTRE (Usando React.memo normal)
const DraggableListCard = React.memo((props: any) => {
  const drag = useReorderableDrag();
  return <ListCardContent {...props} drag={drag} />;
});


export default function MyListsScreen({ navigation }: any) {
  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [tempListName, setTempListName] = useState('');
  const [tempColor, setTempColor] = useState(AVAILABLE_COLORS[0]);
  const [tempIcon, setTempIcon] = useState(AVAILABLE_ICONS[0]);

  const fetchMyLists = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const cachedLists = await AsyncStorage.getItem('@my_lists_cache');
      if (cachedLists) {
        setLists(JSON.parse(cachedLists));
        setLoading(false);
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userListIds = userDoc.data().listIds || [];
        const loadedLists = [];
        for (const id of userListIds) {
          const listDoc = await getDoc(doc(db, 'shopping_lists', id));
          if (listDoc.exists()) {
            loadedLists.push({ id, ...listDoc.data() });
          }
        }
        setLists(loadedLists);
        await AsyncStorage.setItem('@my_lists_cache', JSON.stringify(loadedLists));
      }
    } catch (error) {
      console.log("Error cargando listas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      fetchMyLists();
      setIsEditing(false);
    });
    return unsubscribe;
  }, [navigation]);

  const openCreateModal = () => {
    setEditingListId(null);
    setTempListName('');
    setTempColor(AVAILABLE_COLORS[0]);
    setTempIcon(AVAILABLE_ICONS[0]);
    setIsModalVisible(true);
  };

  const openEditModal = useCallback((list: any) => {
    setEditingListId(list.id);
    setTempListName(list.name || '');
    setTempColor(list.color || AVAILABLE_COLORS[0]);
    setTempIcon(list.icon || AVAILABLE_ICONS[0]);
    setIsModalVisible(true);
  }, []);

  const saveList = async () => {
    if (tempListName.trim() === '') {
      Alert.alert('Error', 'Debes darle un nombre a la lista.');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      if (editingListId) {
        await updateDoc(doc(db, 'shopping_lists', editingListId), {
          name: tempListName.trim(),
          color: tempColor,
          icon: tempIcon
        });
      } else {
        const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase() + 
                           '-' + Math.floor(1000 + Math.random() * 9000);

        const newListRef = await addDoc(collection(db, 'shopping_lists'), {
          name: tempListName.trim(),
          joinCode: randomCode,
          createdAt: new Date(),
          members: [user.uid],
          icon: tempIcon,
          color: tempColor
        });

        await updateDoc(doc(db, 'users', user.uid), {
          listIds: arrayUnion(newListRef.id)
        });
      }

      setIsModalVisible(false);
      await fetchMyLists();
    } catch (error) {
      Alert.alert('Error', editingListId ? 'No se pudo actualizar' : 'No se pudo crear la lista');
      setLoading(false);
    }
  };

  const confirmDeleteList = useCallback((listId: string, listName: string) => {
    Alert.alert(
      'Eliminar Lista',
      `¿Estás seguro de que quieres salir de "${listName || 'Nuestra Lista'}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => removeListFromUser(listId) }
      ]
    );
  }, []);

  const removeListFromUser = async (listId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      const listRef = doc(db, 'shopping_lists', listId);
      const listSnap = await getDoc(listRef);

      if (listSnap.exists()) {
        const members = listSnap.data().members || [];
        if (members.length <= 1 && members.includes(user.uid)) {
          await deleteDoc(listRef);
        } else {
          await updateDoc(listRef, { members: arrayRemove(user.uid) });
        }
      }

      await updateDoc(doc(db, 'users', user.uid), { listIds: arrayRemove(listId) });
      await fetchMyLists();
    } catch (error) {
      Alert.alert('Error', 'No se pudo eliminar la lista');
      setLoading(false);
    }
  };

  const navigateToHome = useCallback((id: string) => {
    navigation.navigate('Home', { listId: id });
  }, [navigation]);

  const handleReorder = async ({ from, to }: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newData = [...lists];
    const [movedItem] = newData.splice(from, 1);
    newData.splice(to, 0, movedItem);
    
    setLists(newData); 
    AsyncStorage.setItem('@my_lists_cache', JSON.stringify(newData));

    const user = auth.currentUser;
    if (!user) return;
    const newListIds = newData.map(list => list.id);
    
    try {
      await updateDoc(doc(db, 'users', user.uid), { listIds: newListIds });
    } catch (error) {
      console.log("Error guardando el nuevo orden:", error);
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mis Listas</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.editButton}>
              <Text style={styles.editButtonText}>{isEditing ? 'Listo' : 'Editar'}</Text>
            </TouchableOpacity>
            {!isEditing && (
              <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={{ marginLeft: 16 }}>
                <Ionicons name="settings-outline" size={24} color="#333" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ReorderableList
          data={lists}
          onDragStart={() => {
            'worklet';
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
          }}
          onReorder={({ from, to }) => {
            'worklet';
            runOnJS(handleReorder)({ from, to });
          }}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <DraggableListCard
              item={item}
              isEditing={isEditing}
              onNavigate={navigateToHome}
              onEdit={openEditModal}
              onDelete={confirmDeleteList}
            />
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No tienes listas. Presiona el botón inferior para crear una o ve a configuración para unirte a una.</Text>}
        />

        {!isEditing && (
          <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
            <Ionicons name="add" size={32} color="#fff" />
          </TouchableOpacity>
        )}

        <Modal visible={isModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingListId ? 'Editar Lista' : 'Nueva Lista'}</Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>Nombre de la Lista</Text>
              <TextInput
                style={styles.modalInput}
                value={tempListName}
                onChangeText={setTempListName}
                placeholder="Ej: Ferretería"
                autoFocus={!editingListId}
              />

              <Text style={styles.modalSubtitle}>Color</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {AVAILABLE_COLORS.map((color) => (
                  <TouchableOpacity key={color} style={[styles.colorCircle, { backgroundColor: color, borderWidth: tempColor === color ? 3 : 0 }]} onPress={() => setTempColor(color)} />
                ))}
              </ScrollView>

              <Text style={styles.modalSubtitle}>Ícono</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {AVAILABLE_ICONS.map((icon) => (
                  <TouchableOpacity key={icon} style={[styles.iconBox, { borderColor: tempIcon === icon ? tempColor : '#eee' }]} onPress={() => setTempIcon(icon)}>
                    <Ionicons name={icon as any} size={28} color={tempIcon === icon ? tempColor : '#888'} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={[styles.saveButton, { backgroundColor: tempColor }]} onPress={saveList}>
                <Text style={styles.saveButtonText}>{editingListId ? 'Guardar Cambios' : 'Crear Lista'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  editButton: { backgroundColor: '#e5e5ea', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  editButtonText: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 },
  listContainer: { paddingHorizontal: 16, paddingBottom: 100 }, 
  listCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, marginBottom: 16, borderRadius: 12, borderWidth: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  iconContainer: { padding: 8, borderRadius: 8, position: 'relative' },
  editBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#007AFF', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  deleteButton: { padding: 8, marginRight: -8 },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 32, fontSize: 16, paddingHorizontal: 24 },
  fab: { position: 'absolute', bottom: 32, right: 24, backgroundColor: '#007AFF', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  modalSubtitle: { fontSize: 16, fontWeight: 'bold', color: '#666', marginBottom: 12 },
  modalInput: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 24 },
  pickerRow: { flexDirection: 'row', marginBottom: 24 },
  colorCircle: { width: 48, height: 48, borderRadius: 24, marginRight: 16, borderColor: '#333' },
  iconBox: { width: 56, height: 56, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  saveButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});