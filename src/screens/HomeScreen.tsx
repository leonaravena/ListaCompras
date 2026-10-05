import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  LogBox,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../config/firebase';
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy, writeBatch } from 'firebase/firestore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// LIBRERÍAS DE ANIMACIÓN MODERNAS Y EL PUENTE "runOnJS"
import ReorderableList, { useReorderableDrag } from 'react-native-reorderable-list';
import { runOnJS } from 'react-native-reanimated';

LogBox.ignoreLogs(['InteractionManager has been deprecated']);

interface Pocket {
  id: string;
  name: string;
  icon: string;
  color: string;
  ownerName?: string; 
}

interface Product {
  id: string;
  name: string;
  isChecked: boolean;
  addedBy?: string;
  addedByEmail?: string;
  addedByName?: string;
  addedByColor?: string;
  quantity: number;
  price: number;
  paymentMethod?: string;
  pocket?: Pocket;
  isSeparator: boolean;
  order: number;
}

// 1. EL CASCARÓN VISUAL (React.memo)
const ProductCardContent = React.memo(({
  item, drag, isExpanded, isDropdownOpen, currentUserId, myPockets,
  onToggle, onDelete, onUpdateField, onExpand, onDropdown
}: any) => {

  const displayName = item.addedByName || (item.addedByEmail ? item.addedByEmail.charAt(0).toUpperCase() : 'U');
  const initial = displayName.charAt(0).toUpperCase();
  const isMe = item.addedBy === currentUserId;
  const identityColor = item.addedByColor || (isMe ? '#007AFF' : '#FF9500');
  const uiColor = item.isChecked ? '#888' : identityColor;
  
  const defaultLegacyPocket: Pocket = { id: 'legacy', name: item.paymentMethod || 'Efectivo', icon: 'wallet-outline', color: '#888', ownerName: item.addedByName || 'Usuario' };
  const itemPocket: Pocket = item.pocket || defaultLegacyPocket;

  if (item.isSeparator) {
    return (
      <TouchableOpacity 
        onLongPress={drag} 
        delayLongPress={150}
        activeOpacity={0.8}
        style={styles.separatorCard}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="folder-open" size={24} color="#888" style={{ marginRight: 8 }} />
          <Text style={styles.separatorText}>{item.name}</Text>
        </View>
        <TouchableOpacity onPress={() => onDelete(item.id)}>
          <Ionicons name="close-circle" size={24} color="#888" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.itemCard, item.isChecked && styles.itemCardChecked]}>
      <TouchableOpacity 
        style={styles.itemRowBase} 
        activeOpacity={0.7}
        onPress={() => {
          onExpand(isExpanded ? null : item.id);
          onDropdown(null); 
        }}
        onLongPress={!item.isChecked ? drag : undefined} 
        delayLongPress={150}
      >
        <TouchableOpacity onPress={() => onToggle(item.id, item.isChecked)} style={styles.checkButton}>
          <Ionicons name={item.isChecked ? "checkbox" : "square-outline"} size={28} color={uiColor} />
        </TouchableOpacity>

        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.itemText, item.isChecked && styles.itemTextChecked]}>
            {item.name}
          </Text>
          {!isExpanded && (
            <View style={[styles.avatar, { backgroundColor: item.isChecked ? '#ccc' : identityColor }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
        </View>

        {!isExpanded && (
          <View style={{ alignItems: 'flex-end' }}>
            <View style={[styles.paymentBadge, { borderColor: item.isChecked ? '#eee' : itemPocket.color + '40', backgroundColor: item.isChecked ? '#f5f5f5' : itemPocket.color + '10' }]}>
              <Ionicons name={itemPocket.icon as any} size={12} color={item.isChecked ? '#888' : itemPocket.color} style={{ marginRight: 4 }} />
              <Text style={[styles.paymentBadgeText, { color: item.isChecked ? '#888' : itemPocket.color }]}>
                {itemPocket.name}
              </Text>
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
          <View style={styles.editorRow}>
            <View style={styles.quantityControls}>
              <TouchableOpacity style={styles.qtyButton} onPress={() => onUpdateField(item.id, 'quantity', Math.max(1, item.quantity - 1))}>
                <Ionicons name="remove" size={20} color="#333" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyButton} onPress={() => onUpdateField(item.id, 'quantity', item.quantity + 1)}>
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
                  onUpdateField(item.id, 'price', num);
                }}
              />
            </View>
          </View>

          <View style={styles.pocketRow}>
            <Text style={styles.pocketLabel}>Paga:</Text>
            <View style={styles.dropdownContainer}>
              <TouchableOpacity 
                style={[styles.dropdownHeader, isDropdownOpen && styles.dropdownHeaderOpen]}
                onPress={() => onDropdown(isDropdownOpen ? null : item.id)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={itemPocket.icon as any} size={16} color={itemPocket.color} style={{ marginRight: 8 }} />
                  <Text style={styles.dropdownHeaderText}>{itemPocket.name}</Text>
                </View>
                <Ionicons name={isDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#888" />
              </TouchableOpacity>

              {isDropdownOpen && (
                <View style={styles.dropdownList}>
                  {myPockets.length === 0 && (
                    <Text style={{ padding: 12, color: '#888', fontStyle: 'italic', fontSize: 12 }}>No configurado</Text>
                  )}
                  {myPockets.map((pocket: any) => (
                    <TouchableOpacity 
                      key={pocket.id} 
                      style={styles.dropdownOption}
                      onPress={() => { onUpdateField(item.id, 'pocket', pocket); onDropdown(null); }}
                    >
                      <Ionicons name={pocket.icon as any} size={16} color={pocket.color} style={{ marginRight: 8 }} />
                      <Text style={[styles.dropdownOptionText, itemPocket.id === pocket.id && { color: pocket.color, fontWeight: 'bold' }]}>
                        {pocket.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.item.name === next.item.name &&
    prev.item.isChecked === next.item.isChecked &&
    prev.item.quantity === next.item.quantity &&
    prev.item.price === next.item.price &&
    prev.item.pocket?.id === next.item.pocket?.id &&
    prev.item.order === next.item.order && 
    prev.isExpanded === next.isExpanded &&
    prev.isDropdownOpen === next.isDropdownOpen
  );
});

// 2. EL ENVOLTORIO DE ARRASTRE
const DraggableProductItem = React.memo((props: any) => {
  const drag = useReorderableDrag();
  return <ProductCardContent {...props} drag={drag} />;
});

export default function HomeScreen({ route, navigation }: any) {
  const [pendingItems, setPendingItems] = useState<Product[]>([]);
  const [completedItems, setCompletedItems] = useState<Product[]>([]);
  const [inputText, setInputText] = useState('');
  
  const [listName, setListName] = useState('Cargando...');
  const [joinCode, setJoinCode] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [dropdownItemId, setDropdownItemId] = useState<string | null>(null);
  const [isFooterExpanded, setIsFooterExpanded] = useState(false);
  
  const [myIdentity, setMyIdentity] = useState({ name: '', color: '#007AFF' });
  const [myPockets, setMyPockets] = useState<Pocket[]>([]);

  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0.3)).current;
  
  const isReordering = useRef(false);
  const { listId } = route.params;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 0.3, duration: 800, useNativeDriver: true })
        ])
      ).start();
    }
  }, [loading]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMyIdentity({ name: data.displayName || '', color: data.avatarColor || '#007AFF' });
        if (data.pockets && data.pockets.length > 0 && typeof data.pockets[0] === 'object') {
          const pocketsWithOwner = data.pockets.map((p: any) => ({ ...p, ownerName: data.displayName || 'Usuario' }));
          setMyPockets(pocketsWithOwner);
        } else {
          setMyPockets([]);
        }
      }
    });
    return () => unsubscribeUser();
  }, []);

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

    const loadCache = async () => {
      try {
        const cachedItems = await AsyncStorage.getItem(`@items_cache_${listId}`);
        if (cachedItems) {
          const parsed = JSON.parse(cachedItems);
          setPendingItems(parsed.filter((i: Product) => !i.isChecked || i.isSeparator));
          setCompletedItems(parsed.filter((i: Product) => i.isChecked && !i.isSeparator));
          setLoading(false);
        }
      } catch (error) {
        console.log("Error leyendo caché", error);
      }
    };
    loadCache();

    const itemsRef = collection(db, 'shopping_lists', listId, 'items');
    const q = query(itemsRef, orderBy('order', 'asc'));

    const unsubscribeItems = onSnapshot(q, (snapshot) => {
      if (isReordering.current) return;

      const newPending: Product[] = [];
      const newCompleted: Product[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const product: Product = {
          id: docSnap.id, name: data.name, isChecked: data.isChecked,
          addedBy: data.addedBy, addedByEmail: data.addedByEmail, addedByName: data.addedByName, addedByColor: data.addedByColor,
          quantity: data.quantity || 1, price: data.price || 0,
          paymentMethod: data.paymentMethod, pocket: data.pocket,
          isSeparator: data.isSeparator || false, order: data.order || 0
        };
        
        if (product.isChecked && !product.isSeparator) {
          newCompleted.push(product);
        } else {
          newPending.push(product);
        }
      });
      
      setPendingItems(newPending);
      setCompletedItems(newCompleted);
      setLoading(false);
      AsyncStorage.setItem(`@items_cache_${listId}`, JSON.stringify([...newPending, ...newCompleted]));
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const itemsRef = collection(db, 'shopping_lists', listId, 'items');
    
    const defaultPocket: Pocket = myPockets.length > 0 
      ? myPockets[0] 
      : { id: 'default', name: 'Efectivo', icon: 'wallet-outline', color: '#34C759', ownerName: myIdentity.name };
    
    const totalItemsCount = pendingItems.length + completedItems.length;

    await addDoc(itemsRef, {
      name: isSeparator ? inputText.toUpperCase() : inputText,
      isChecked: false, createdAt: new Date(),
      addedBy: auth.currentUser?.uid, addedByEmail: auth.currentUser?.email,
      addedByName: myIdentity.name, addedByColor: myIdentity.color,
      quantity: 1, price: 0, pocket: defaultPocket,
      isSeparator: isSeparator, order: totalItemsCount 
    });
    setInputText('');
  };

  const toggleItem = useCallback(async (id: string, currentStatus: boolean) => {
    if (!listId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (expandedItemId === id) { setExpandedItemId(null); setDropdownItemId(null); }
    await updateDoc(doc(db, 'shopping_lists', listId, 'items', id), { isChecked: !currentStatus });
  }, [listId, expandedItemId]);

  const updateItemField = useCallback(async (id: string, field: string, value: any) => {
    if (!listId) return;
    await updateDoc(doc(db, 'shopping_lists', listId, 'items', id), { [field]: value });
  }, [listId]);

  const deleteItem = useCallback(async (id: string) => {
    if (!listId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await deleteDoc(doc(db, 'shopping_lists', listId, 'items', id));
  }, [listId]);

  const saveListName = async () => {
    setIsEditingName(false);
    if (tempName.trim() === '' || tempName === listName) return;
    await updateDoc(doc(db, 'shopping_lists', listId), { name: tempName.trim() });
  };

  const handleDragEnd = async (newData: Product[]) => {
    setPendingItems(newData); 
    AsyncStorage.setItem(`@items_cache_${listId}`, JSON.stringify([...newData, ...completedItems]));

    try {
      const batch = writeBatch(db);
      newData.forEach((item, index) => {
        const itemRef = doc(db, 'shopping_lists', listId, 'items', item.id);
        batch.update(itemRef, { order: index });
      });
      await batch.commit();
    } catch (error) {
      console.log("Error guardando orden:", error);
    } finally {
      setTimeout(() => { isReordering.current = false; }, 500);
    }
  };

  // FUNCIONES JS PURAS PARA CRUZAR EL PUENTE DE ANIMACIÓN (WORKLETS)
  const handleDragStartJS = () => {
    isReordering.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handleReorderJS = (from: number, to: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newData = [...pendingItems];
    const [movedItem] = newData.splice(from, 1);
    newData.splice(to, 0, movedItem);
    handleDragEnd(newData);
  };

  const totalCarrito = completedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const pocketBreakdown = completedItems.reduce((acc, item) => {
    const totalItem = item.price * item.quantity;
    if (totalItem > 0) {
      const currentPocket = item.pocket || { 
        id: 'legacy', name: item.paymentMethod || 'Efectivo', icon: 'wallet-outline', color: '#888', ownerName: item.addedByName 
      };
      const key = currentPocket.id;
      if (!acc[key]) {
        acc[key] = { pocket: currentPocket, ownerName: currentPocket.ownerName || item.addedByName || 'Usuario', total: 0 };
      }
      acc[key].total += totalItem;
    }
    return acc;
  }, {} as Record<string, { pocket: Pocket, ownerName: string, total: number }>);

  // Renderizado Inteligente que delega a los sub-componentes aislando las tarjetas
  const renderItem = useCallback(({ item }: any) => (
    <DraggableProductItem
      item={item}
      isExpanded={expandedItemId === item.id}
      isDropdownOpen={dropdownItemId === item.id}
      currentUserId={auth.currentUser?.uid}
      myPockets={myPockets}
      onToggle={toggleItem}
      onDelete={deleteItem}
      onUpdateField={updateItemField}
      onExpand={setExpandedItemId}
      onDropdown={setDropdownItemId}
    />
  ), [expandedItemId, dropdownItemId, myPockets, toggleItem, updateItemField, deleteItem]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          {isEditingName ? (
            <TextInput
              style={styles.nameInput}
              value={tempName}
              onChangeText={setTempName}
              autoFocus
              onSubmitEditing={saveListName}
              onBlur={saveListName}
              returnKeyType="done"
            />
          ) : (
            <TouchableOpacity 
              style={styles.nameDisplay} 
              onPress={() => { setTempName(listName); setIsEditingName(true); }}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>{listName}</Text>
              <Ionicons name="pencil" size={16} color="#888" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
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

        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.listContainer}>
              {[1, 2, 3, 4, 5].map((key) => (
                <Animated.View key={key} style={[styles.itemCard, { opacity: fadeAnim, padding: 24, flexDirection: 'row', alignItems: 'center' }]}>
                  <View style={{ width: 28, height: 28, borderRadius: 4, backgroundColor: '#e0e0e0', marginRight: 16 }} />
                  <View style={{ flex: 1 }}>
                    <View style={{ width: '60%', height: 16, backgroundColor: '#e0e0e0', borderRadius: 4, marginBottom: 8 }} />
                    <View style={{ width: '30%', height: 12, backgroundColor: '#e0e0e0', borderRadius: 4 }} />
                  </View>
                </Animated.View>
              ))}
            </View>
          ) : (
            <ReorderableList
              data={pendingItems}
              onDragStart={() => {
                'worklet';
                runOnJS(handleDragStartJS)();
              }}
              onReorder={({ from, to }) => {
                'worklet';
                runOnJS(handleReorderJS)(from, to);
              }}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContainer}
              ListFooterComponent={
                completedItems.length > 0 ? (
                  <View style={styles.completedSection}>
                    <Text style={styles.completedTitle}>EN EL CARRITO ({completedItems.length})</Text>
                    {completedItems.map((item) => (
                      <View key={`completed-${item.id}`}>
                        <ProductCardContent
                          item={item}
                          drag={() => {}} 
                          isExpanded={expandedItemId === item.id}
                          isDropdownOpen={dropdownItemId === item.id}
                          currentUserId={auth.currentUser?.uid}
                          myPockets={myPockets}
                          onToggle={toggleItem}
                          onDelete={deleteItem}
                          onUpdateField={updateItemField}
                          onExpand={setExpandedItemId}
                          onDropdown={setDropdownItemId}
                        />
                      </View>
                    ))}
                  </View>
                ) : null
              }
            />
          )}
        </View>

        <View style={styles.stickyFooter}>
          <TouchableOpacity 
            style={styles.footerHeader} 
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsFooterExpanded(!isFooterExpanded);
            }}
          >
            <View>
              <Text style={styles.totalsLabel}>Total Boleta (En Carrito)</Text>
              <Text style={styles.totalsValue}>$ {totalCarrito.toLocaleString('es-CL')}</Text>
            </View>
            <Ionicons name={isFooterExpanded ? "chevron-down" : "chevron-up"} size={24} color="#888" />
          </TouchableOpacity>

          {isFooterExpanded && (
            <View style={styles.breakdownContainer}>
              <Text style={styles.breakdownTitle}>Desglose exacto</Text>
              {Object.values(pocketBreakdown)
                .sort((a, b) => {
                  if (b.total !== a.total) return b.total - a.total;
                  return a.pocket.name.localeCompare(b.pocket.name);
                })
                .map(({ pocket, ownerName, total }) => (
                <View key={pocket.id} style={styles.breakdownRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Ionicons name={pocket.icon as any} size={20} color={pocket.color} style={{ marginRight: 12 }} />
                    <View>
                      <Text style={styles.breakdownPocket}>{pocket.name}</Text>
                      <Text style={styles.breakdownOwner}>Bolsillo de {ownerName}</Text>
                    </View>
                  </View>
                  <Text style={styles.breakdownAmount}>$ {total.toLocaleString('es-CL')}</Text>
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
  nameDisplay: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  nameInput: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center', backgroundColor: '#fff', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 12, borderWidth: 1, borderColor: '#007AFF', marginHorizontal: 8 },
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
  avatar: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  paymentBadgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  expandedContent: { backgroundColor: '#f8f9fa', padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  editorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  qtyButton: { padding: 8, paddingHorizontal: 12 },
  qtyText: { fontSize: 16, fontWeight: 'bold', minWidth: 24, textAlign: 'center' },
  priceContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', flex: 1 },
  currencySymbol: { fontSize: 16, color: '#666', fontWeight: 'bold', marginLeft: 12 },
  priceInput: { flex: 1, fontSize: 16, paddingVertical: 10, paddingHorizontal: 8, color: '#333' },
  pocketRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  pocketLabel: { fontSize: 14, fontWeight: 'bold', color: '#666', marginRight: 12, marginTop: 12 },
  dropdownContainer: { flex: 1, marginRight: 12 },
  dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  dropdownHeaderOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  dropdownHeaderText: { fontSize: 14, color: '#333', fontWeight: '500' },
  dropdownList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  dropdownOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  dropdownOptionText: { fontSize: 14, color: '#555' },
  deleteButton: { padding: 8, backgroundColor: '#ffe5e5', borderRadius: 8, marginTop: 4 },
  completedSection: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 16 },
  completedTitle: { fontSize: 14, fontWeight: 'bold', color: '#888', marginBottom: 16, marginLeft: 4 },
  stickyFooter: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd', padding: 16, paddingBottom: Platform.OS === 'ios' ? 24 : 16, elevation: 20 },
  footerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalsLabel: { fontSize: 12, color: '#888', fontWeight: 'bold', textTransform: 'uppercase' },
  totalsValue: { fontSize: 24, fontWeight: '900', color: '#34C759', marginTop: 2 },
  breakdownContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  breakdownTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  breakdownPocket: { fontSize: 16, color: '#333', fontWeight: 'bold' },
  breakdownOwner: { fontSize: 12, color: '#888', marginTop: 2 },
  breakdownAmount: { fontSize: 16, fontWeight: '900', color: '#333' },
  emptyBreakdown: { fontSize: 14, color: '#888', fontStyle: 'italic' }
});