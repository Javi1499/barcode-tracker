import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { ProductPriceHistoryScreen } from './src/screens/ProductPriceHistoryScreen';
import { AddPriceEntryScreen } from './src/screens/AddPriceEntryScreen';
import { CommunityDealsScreen } from './src/screens/CommunityDealsScreen';
import { LoginModal } from './src/components/LoginModal';
import { UserProfileModal } from './src/components/UserProfileModal';
import { AuthService, UserProfile } from './src/services/authService';

type ScreenState = 'SCANNER' | 'HISTORY' | 'ADD_PRICE' | 'COMMUNITY';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('SCANNER');
  const [activeBarcode, setActiveBarcode] = useState<string>('');
  const [barcodeLookupData, setBarcodeLookupData] = useState<any>(null);

  // Estados de Autenticación Social (Google, Facebook, Apple)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  // Cargar usuario persistido en el dispositivo
  useEffect(() => {
    AuthService.getStoredUser().then(user => {
      if (user) setCurrentUser(user);
    });
  }, []);

  // Cuando se detecta un código desde cámara, galería o manual
  const handleBarcodeDetected = (barcode: string, lookupData?: any) => {
    setActiveBarcode(barcode);
    setBarcodeLookupData(lookupData);
    if (!currentUser) {
      Alert.alert(
        'Cuenta Requerida',
        'Para agregar un producto o compartir una liquidación necesitas iniciar sesión, ya que los aportes y reputación se asignan a tu cuenta.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Iniciar Sesión', onPress: () => setLoginModalVisible(true) }
        ]
      );
      return;
    }
    setCurrentScreen('ADD_PRICE');
  };

  const handleSelectFromCommunity = (barcode: string) => {
    setActiveBarcode(barcode);
    setCurrentScreen('HISTORY');
  };

  return (
    <View style={styles.appContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Barra Superior de Estado y Perfil */}
      <View style={styles.topBar}>
        <View style={styles.appBrandRow}>
          <Text style={styles.appBrandTitle}>⚡ Barcode Tracker</Text>
        </View>

        {currentUser ? (
          <TouchableOpacity
            style={styles.profileBadgeBtn}
            onPress={() => setProfileModalVisible(true)}
          >
            <View style={styles.profileAvatarCircle}>
              <Text style={styles.profileAvatarText}>
                {currentUser.name ? currentUser.name[0].toUpperCase() : 'C'}
              </Text>
            </View>
            <View style={styles.profileInfoCol}>
              <Text style={styles.profileName} numberOfLines={1}>
                @{currentUser.username}
              </Text>
              <Text style={styles.profileRep}>⭐ {currentUser.reputation} pts</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => setLoginModalVisible(true)}
          >
            <Text style={styles.loginBtnText}>👤 Iniciar Sesión</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pantalla Activa */}
      <View style={styles.screenWrapper}>
        {currentScreen === 'SCANNER' && (
          <ScannerScreen
            onBarcodeDetected={handleBarcodeDetected}
            onViewHistory={handleSelectFromCommunity}
          />
        )}

        {currentScreen === 'HISTORY' && (
          <ProductPriceHistoryScreen
            barcode={activeBarcode}
            onAddNewPrice={() => {
              if (!currentUser) {
                Alert.alert(
                  'Cuenta Requerida',
                  'Para registrar un nuevo precio en el historial debes iniciar sesión con tu cuenta.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Iniciar Sesión', onPress: () => setLoginModalVisible(true) }
                  ]
                );
                return;
              }
              setCurrentScreen('ADD_PRICE');
            }}
            onBack={() => setCurrentScreen('SCANNER')}
          />
        )}

        {currentScreen === 'ADD_PRICE' && (
          <AddPriceEntryScreen
            barcode={activeBarcode}
            initialData={barcodeLookupData}
            currentUserId={currentUser?.id}
            onRequestLogin={() => setLoginModalVisible(true)}
            onSuccess={() => setCurrentScreen('HISTORY')}
            onCancel={() => setCurrentScreen('SCANNER')}
          />
        )}

        {currentScreen === 'COMMUNITY' && (
          <CommunityDealsScreen onSelectProduct={handleSelectFromCommunity} />
        )}
      </View>

      {/* Barra de Navegación Inferior */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navTab, currentScreen === 'SCANNER' && styles.activeTab]}
          onPress={() => setCurrentScreen('SCANNER')}
        >
          <Text style={styles.tabIcon}>📷</Text>
          <Text style={[styles.tabLabel, currentScreen === 'SCANNER' && styles.activeLabel]}>
            Escanear
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, currentScreen === 'COMMUNITY' && styles.activeTab]}
          onPress={() => setCurrentScreen('COMMUNITY')}
        >
          <Text style={styles.tabIcon}>🏷️</Text>
          <Text style={[styles.tabLabel, currentScreen === 'COMMUNITY' && styles.activeLabel]}>
            Banco de Ofertas
          </Text>
        </TouchableOpacity>

        {activeBarcode !== '' && (
          <TouchableOpacity
            style={[styles.navTab, currentScreen === 'HISTORY' && styles.activeTab]}
            onPress={() => setCurrentScreen('HISTORY')}
          >
            <Text style={styles.tabIcon}>📈</Text>
            <Text style={[styles.tabLabel, currentScreen === 'HISTORY' && styles.activeLabel]}>
              Historial
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Modal de Inicio de Sesión Social (Google, Facebook, Apple) */}
      <LoginModal
        visible={loginModalVisible}
        onClose={() => setLoginModalVisible(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />

      {/* Modal de Perfil de Cazador */}
      {currentUser && (
        <UserProfileModal
          visible={profileModalVisible}
          user={currentUser}
          onClose={() => setProfileModalVisible(false)}
          onLogout={async () => {
            await AuthService.logout();
            setCurrentUser(null);
            setProfileModalVisible(false);
          }}
          onSwitchAccount={() => {
            setProfileModalVisible(false);
            setLoginModalVisible(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 10,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  appBrandRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  appBrandTitle: {
    color: '#38bdf8',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  profileBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  profileAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  profileAvatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900'
  },
  profileInfoCol: {
    maxWidth: 120
  },
  profileName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700'
  },
  profileRep: {
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: '700'
  },
  loginBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 18,
    shadowColor: '#0284c7',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800'
  },
  screenWrapper: {
    flex: 1
  },
  bottomNav: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 6
  },
  navTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4
  },
  activeTab: {
    borderTopWidth: 2,
    borderTopColor: '#38bdf8'
  },
  tabIcon: {
    fontSize: 20
  },
  tabLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2
  },
  activeLabel: {
    color: '#38bdf8'
  }
});
