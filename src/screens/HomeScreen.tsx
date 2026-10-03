import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  LogBox
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { auth, db } from '../config/firebase';
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy, writeBatch } from 'firebase/firestore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';

LogBox.ignoreLogs(['InteractionManager has been deprecated']);

interface Product {
  id: string;
  name: string;
  isChecked: boolean;
  addedBy?: string;
  addedByEmail?: string;
  quantity: number;
  price: number;
  paymentMethod: string;
  isSeparator: boolean;
  order: number;
}

const AVAILABLE_POCKETS = ['TC Compartida', 'Junaeb', 'Débito Nati', 'Efectivo'];

export default function HomeScreen({ route, navigation }: any) {
  const [items, setItems] = useState<Product[]>([]);
  const [inputText, setInputText] = useState('');
  const [listName, setListName] = useState('Cargando...');
  const [joinCode, setJoinCode] = useState('');
  
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [dropdownItemId, setDropdownItemId] = useState<string | null>(null); // Estado para el nuevo Dropdown
  const [isFooterExpanded, setIsFooterExpanded] = useState(false);

  const { listId } = route.params;

  useEffect(() => {
    if (!listId) return;
    const unsubscribeList = onSnapshot(doc(db, 'shopping_lists', listId), (docSnap) => {
      if (docSnap.exists()) {
        setListName(docSnap.data().name || 'Nuestra Lista');
        setJoinCode(docSnap.data().joinCode || '');
      }
    });
    return () => unsubscribeList();
  }, [listId]);

  useEffect(() => {
    if (!listId) return;
    const itemsRef = collection(db, 'shopping_lists', listId, 'items');
    const q = query(itemsRef, orderBy('order', 'asc'));

    const unsubscribeItems = onSnapshot(q, (snapshot) => {
      const fetchedItems: Product[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedItems.push({
          id: doc.id,
          name: data.name,
          isChecked: data.isChecked,
          addedBy: data.addedBy,
          addedByEmail: data.addedByEmail,
          quantity: data.quantity || 1,
          price: data.price || 0,
          paymentMethod: data.paymentMethod || 'TC Compartida',
          isSeparator: data.isSeparator || false,
          order: data.order || 0
        });
      });
      setItems(fetchedItems);
    });
    return () => unsubscribeItems();
  }, [listId]);

  const handleCopyCode = async () => {
    if (!joinCode) return;
    await Clipboard.setStringAsync(joinCode);
    Alert.alert('Código copiado', `El código es:\n\n${joinCode}`);
  };

  const addItem = async (isSeparator = false) => {
    if (inputText.trim() === '' || !listId) return;
    const itemsRef = collection(db, 'shopping_lists', listId, 'items');
    
    await addDoc(itemsRef, {
      name: isSeparator ? inputText.toUpperCase() : inputText,
      isChecked: false,
      createdAt: new Date(),
      addedBy: auth.currentUser?.uid,
      addedByEmail: auth.currentUser?.email,
      quantity: 1,
      price: 0,
      paymentMethod: 'TC Compartida',
      isSeparator: isSeparator,
      order: items.length 
    });
    setInputText('');
  };

  const toggleItem = async (id: string, currentStatus: boolean) => {
    if (!listId) return;
    if (expandedItemId === id) {
      setExpandedItemId(null);
      setDropdownItemId(null);
    }
    await updateDoc(doc(db, 'shopping_lists', listId, 'items', id), { isChecked: !currentStatus });
  };

  const updateItemField = async (id: string, field: string, value: any) => {
    if (!listId) return;
    await updateDoc(doc(db, 'shopping_lists', listId, 'items', id), { [field]: value });
  };

  const deleteItem = async (id: string) => {
    if (!listId) return;
    await deleteDoc(doc(db, 'shopping_lists', listId, 'items', id));
  };

  const handleDragEnd = async (newData: Product[]) => {
    if (!listId) return;
    const batch = writeBatch(db);
    
    newData.forEach((item, index) => {
      const itemRef = doc(db, 'shopping_lists', listId, 'items', item.id);
      batch.update(itemRef, { order: index });
    });
    
    await batch.commit();
  };

  const pendingItems = items.filter(item => !item.isChecked);
  const completedItems = items.filter(item => item.isChecked && !item.isSeparator);

  const totalCarrito = completedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const pocketBreakdown = completedItems.reduce((acc, item) => {
    const totalItem = item.price * item.quantity;
    if (totalItem > 0) {
      acc[item.paymentMethod] = (acc[item.paymentMethod] || 0) + totalItem;
    }
    return acc;
  }, {} as Record<string, number>);

  const renderItem = ({ item, drag, isActive }: any) => {
    const isExpanded = expandedItemId === item.id;
    const isMe = item.addedBy === auth.currentUser?.uid;
    const initial = item.addedByEmail ? item.addedByEmail.charAt(0).toUpperCase() : (isMe ? 'Y' : 'P');
    const activeColor = isMe ? '#007AFF' : '#FF9500';
    const uiColor = item.isChecked ? '#888' : activeColor;
    const isDropdownOpen = dropdownItemId === item.id;

    const CardContent = () => {
      if (item.isSeparator) {
        return (
          <TouchableOpacity 
            onLongPress={drag} 
            delayLongPress={150}
            activeOpacity={0.8}
            style={[styles.separatorCard, { elevation: isActive ? 8 : 0 }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="folder-open" size={24} color="#888" style={{ marginRight: 8 }} />
              <Text style={styles.separatorText}>{item.name}</Text>
            </View>
            <TouchableOpacity onPress={() => deleteItem(item.id)}>
              <Ionicons name="close-circle" size={24} color="#888" />
            </TouchableOpacity>
          </TouchableOpacity>
        );
      }

      return (
        <View style={[styles.itemCard, item.isChecked && styles.itemCardChecked, { elevation: isActive ? 8 : 0 }]}>
          <TouchableOpacity 
            style={styles.itemRowBase} 
            activeOpacity={0.7}
            onPress={() => {
              setExpandedItemId(isExpanded ? null : item.id);
              setDropdownItemId(null); // Cierra el menú al cambiar de ítem
            }}
            onLongPress={!item.isChecked ? drag : undefined} 
            delayLongPress={150}
          >
            <TouchableOpacity onPress={() => toggleItem(item.id, item.isChecked)} style={styles.checkButton}>
              <Ionicons name={item.isChecked ? "checkbox" : "square-outline"} size={28} color={uiColor} />
            </TouchableOpacity>

            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.itemText, item.isChecked && styles.itemTextChecked]}>
                {item.name}
              </Text>
              
              {!isExpanded && (
                <View style={[styles.avatar, { backgroundColor: item.isChecked ? '#ccc' : uiColor }]}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
            </View>

            {!isExpanded && (
              <View style={{ alignItems: 'flex-end' }}>
                <View style={styles.paymentBadge}>
                  <Text style={styles.paymentBadgeText}>{item.paymentMethod}</Text>
                </View>
                {(item.quantity > 1 || item.price > 0) && (
                  <Text style={styles.itemSubtext}>
                    {item.quantity} un • $ {item.price.toLocaleString('es-CL')}
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.expandedContent}>
              {/* Controles de Precio y Cantidad */}
              <View style={styles.editorRow}>
                <View style={styles.quantityControls}>
                  <TouchableOpacity style={styles.qtyButton} onPress={() => updateItemField(item.id, 'quantity', Math.max(1, item.quantity - 1))}>
                    <Ionicons name="remove" size={20} color="#333" />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyButton} onPress={() => updateItemField(item.id, 'quantity', item.quantity + 1)}>
                    <Ionicons name="add" size={20} color="#333" />
                  </TouchableOpacity>
                </View>

                <Text style={{ color: '#888', marginHorizontal: 8 }}>x</Text>

                <View style={styles.priceContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.priceInput}
                    keyboardType="numeric"
                    placeholder="0"
                    defaultValue={item.price > 0 ? item.price.toString() : ''}
                    onEndEditing={(e) => {
                      const num = parseInt(e.nativeEvent.text.replace(/[^0-9]/g, '')) || 0;
                      updateItemField(item.id, 'price', num);
                    }}
                  />
                </View>
              </View>

              {/* Selector de Bolsillos (Dropdown Personalizado) */}
              <View style={styles.pocketRow}>
                <Text style={styles.pocketLabel}>Bolsillo:</Text>
                
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity 
                    style={[styles.dropdownHeader, isDropdownOpen && styles.dropdownHeaderOpen]}
                    onPress={() => setDropdownItemId(isDropdownOpen ? null : item.id)}
                  >
                    <Text style={styles.dropdownHeaderText}>{item.paymentMethod}</Text>
                    <Ionicons name={isDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#888" />
                  </TouchableOpacity>

                  {isDropdownOpen && (
                    <View style={styles.dropdownList}>
                      {AVAILABLE_POCKETS.map(pocket => (
                        <TouchableOpacity 
                          key={pocket} 
                          style={styles.dropdownOption}
                          onPress={() => {
                            updateItemField(item.id, 'paymentMethod', pocket);
                            setDropdownItemId(null);
                          }}
                        >
                          <Text style={[styles.dropdownOptionText, item.paymentMethod === pocket && { color: '#007AFF', fontWeight: 'bold' }]}>
                            {pocket}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                
                <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      );
    };

    if (item.isChecked && !item.isSeparator) {
      return <CardContent />;
    }

    return (
      <ScaleDecorator>
        <CardContent />
      </ScaleDecorator>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{listName}</Text>
          <TouchableOpacity onPress={handleCopyCode} style={styles.shareButton}>
            <Ionicons name="share-social" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ej: Tomates, Lácteos..."
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => addItem(false)}
          />
          <TouchableOpacity style={styles.addSeparatorButton} onPress={() => addItem(true)}>
            <Ionicons name="folder-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => addItem(false)}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* CAMBIO CLAVE: View con flex: 1 obliga a la lista a expandirse, habilitando el scroll y fijando el Footer abajo */}
        <View style={{ flex: 1 }}>
          <DraggableFlatList
            data={pendingItems}
            onDragEnd={({ data }) => handleDragEnd(data)}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            ListFooterComponent={
              completedItems.length > 0 ? (
                <View style={styles.completedSection}>
                  <Text style={styles.completedTitle}>EN EL CARRITO ({completedItems.length})</Text>
                  {completedItems.map((item) => (
                    <View key={`completed-${item.id}`}>
                      {renderItem({ item, drag: () => {}, isActive: false })}
                    </View>
                  ))}
                </View>
              ) : null
            }
          />
        </View>

        <View style={styles.stickyFooter}>
          <TouchableOpacity 
            style={styles.footerHeader} 
            activeOpacity={0.7}
            onPress={() => setIsFooterExpanded(!isFooterExpanded)}
          >
            <View>
              <Text style={styles.totalsLabel}>Total Boleta (En Carrito)</Text>
              <Text style={styles.totalsValue}>$ {totalCarrito.toLocaleString('es-CL')}</Text>
            </View>
            <Ionicons name={isFooterExpanded ? "chevron-down" : "chevron-up"} size={24} color="#888" />
          </TouchableOpacity>

          {isFooterExpanded && (
            <View style={styles.breakdownContainer}>
              <Text style={styles.breakdownTitle}>Desglose por Bolsillo</Text>
              {Object.entries(pocketBreakdown).map(([pocket, amount]) => (
                <View key={pocket} style={styles.breakdownRow}>
                  <Text style={styles.breakdownPocket}>💳 {pocket}</Text>
                  <Text style={styles.breakdownAmount}>$ {amount.toLocaleString('es-CL')}</Text>
                </View>
              ))}
              {Object.keys(pocketBreakdown).length === 0 && (
                <Text style={styles.emptyBreakdown}>Aún no has tachado productos con precio.</Text>
              )}
            </View>
          )}
        </View>

      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16, height: 40 },
  backButton: { padding: 8, marginLeft: -8, width: 40 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  shareButton: { padding: 8, marginRight: -8, width: 40, alignItems: 'flex-end' },
  
  inputContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  input: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginRight: 8, fontSize: 16 },
  addSeparatorButton: { backgroundColor: '#666', justifyContent: 'center', alignItems: 'center', width: 48, borderRadius: 12, marginRight: 8 },
  addButton: { backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', width: 56, borderRadius: 12 },

  listContainer: { paddingHorizontal: 16, paddingBottom: 24 },
  
  separatorCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e0e0e0', padding: 12, borderRadius: 8, marginBottom: 8, marginTop: 16 },
  separatorText: { fontSize: 16, fontWeight: '900', color: '#555', letterSpacing: 1 },

  itemCard: { backgroundColor: '#fff', marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  itemCardChecked: { backgroundColor: '#fafafa', borderColor: '#e0e0e0' },
  itemRowBase: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  checkButton: { marginRight: 12 },
  itemText: { fontSize: 18, fontWeight: '500', color: '#333' },
  itemTextChecked: { color: '#888', textDecorationLine: 'line-through' },
  itemSubtext: { fontSize: 14, color: '#888', marginTop: 4, textAlign: 'right' },
  
  avatar: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  paymentBadge: { backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  paymentBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#666', textTransform: 'uppercase' },

  expandedContent: { backgroundColor: '#f8f9fa', padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  editorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  qtyButton: { padding: 8, paddingHorizontal: 12 },
  qtyText: { fontSize: 16, fontWeight: 'bold', minWidth: 24, textAlign: 'center' },
  priceContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', flex: 1 },
  currencySymbol: { fontSize: 16, color: '#666', fontWeight: 'bold', marginLeft: 12 },
  priceInput: { flex: 1, fontSize: 16, paddingVertical: 10, paddingHorizontal: 8, color: '#333' },
  
  // Estilos del Nuevo Dropdown
  pocketRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  pocketLabel: { fontSize: 14, fontWeight: 'bold', color: '#666', marginRight: 12, marginTop: 12 },
  dropdownContainer: { flex: 1, marginRight: 12 },
  dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  dropdownHeaderOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  dropdownHeaderText: { fontSize: 14, color: '#333', fontWeight: '500' },
  dropdownList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  dropdownOption: { paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  dropdownOptionText: { fontSize: 14, color: '#555' },
  
  deleteButton: { padding: 8, backgroundColor: '#ffe5e5', borderRadius: 8, marginTop: 4 },

  completedSection: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 16 },
  completedTitle: { fontSize: 14, fontWeight: 'bold', color: '#888', marginBottom: 16, marginLeft: 4 },

  stickyFooter: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd', padding: 16, paddingBottom: Platform.OS === 'ios' ? 24 : 16, elevation: 20 },
  footerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalsLabel: { fontSize: 12, color: '#888', fontWeight: 'bold', textTransform: 'uppercase' },
  totalsValue: { fontSize: 24, fontWeight: '900', color: '#34C759', marginTop: 2 },
  breakdownContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  breakdownTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  breakdownPocket: { fontSize: 16, color: '#555' },
  breakdownAmount: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  emptyBreakdown: { fontSize: 14, color: '#888', fontStyle: 'italic' }
});