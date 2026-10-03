import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
// 1. Importamos los servicios de Firebase que configuraste
import { auth, db } from '../config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

const handleAuthentication = async () => {
    if (email.trim() === '' || password.trim() === '') {
      Alert.alert('Error', 'Por favor, completa todos los campos.');
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        navigation.replace('MyLists'); // En el próximo paso cambiaremos esto a 'MyLists'
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase() + 
                           '-' + Math.floor(1000 + Math.random() * 9000);

        const newListRef = await addDoc(collection(db, 'shopping_lists'), {
          joinCode: randomCode,
          createdAt: new Date(),
          members: [user.uid]
        });

        // CAMBIO CLAVE: Ahora guardamos 'listIds' como un arreglo
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          listIds: [newListRef.id] 
        });

        Alert.alert('¡Éxito!', 'Cuenta creada correctamente.');
        navigation.replace('MyLists'); // En el próximo paso cambiaremos esto a 'MyLists'
      }
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Error', 'Este correo ya está registrado.');
      } else if (error.code === 'auth/weak-password') {
        Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      } else {
        Alert.alert('Error', error.message);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.formContainer}>
        <Text style={styles.title}>{isLogin ? 'Iniciar Sesión' : 'Registrarse'}</Text>

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleAuthentication}>
          <Text style={styles.buttonText}>{isLogin ? 'Entrar' : 'Crear cuenta'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.toggleText}>
            {isLogin
              ? '¿No tienes cuenta? Regístrate'
              : '¿Ya tienes cuenta? Inicia sesión'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  formContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 32, textAlign: 'center', color: '#333' },
  input: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#ddd' },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  toggleText: { color: '#007AFF', textAlign: 'center', marginTop: 24, fontSize: 14 },
});