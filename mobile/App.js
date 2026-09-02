import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:4173';

export default function App() {
  const webviewRef = useRef(null);
  const [error, setError] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>ServicosPro Mobile</Text>
          <Text style={styles.url}>{WEB_URL}</Text>
        </View>
        <Pressable style={styles.reloadButton} onPress={() => { setError(false); webviewRef.current?.reload(); }}>
          <Text style={styles.reloadText}>Recarregar</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>Nao foi possivel abrir a versao web.</Text>
          <Text style={styles.errorText}>Confira se o sistema web esta rodando no computador e se o celular esta na mesma rede Wi-Fi.</Text>
          <Text style={styles.errorHint}>URL configurada: {WEB_URL}</Text>
          <Pressable style={styles.primaryButton} onPress={() => { setError(false); webviewRef.current?.reload(); }}>
            <Text style={styles.primaryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : null}

      <WebView
        ref={webviewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        startInLoadingState
        onError={() => setError(true)}
        onHttpError={() => setError(true)}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#0f766e" size="large" />
            <Text style={styles.loadingText}>Carregando marketplace...</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0e1117' },
  header: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#151a23', borderBottomWidth: 1, borderBottomColor: '#2c3747', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kicker: { color: '#2dd4bf', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  url: { color: '#a7b2c1', fontSize: 11, maxWidth: 210 },
  reloadButton: { minHeight: 36, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#202938', alignItems: 'center', justifyContent: 'center' },
  reloadText: { color: '#e8edf3', fontWeight: '800' },
  webview: { flex: 1, backgroundColor: '#f3f6f8' },
  loading: { position: 'absolute', inset: 0, backgroundColor: '#f3f6f8', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#667587', fontWeight: '800' },
  errorPanel: { position: 'absolute', zIndex: 2, left: 16, right: 16, top: 86, padding: 18, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d9e1e8', gap: 10 },
  errorTitle: { color: '#18212f', fontSize: 18, fontWeight: '900' },
  errorText: { color: '#667587', lineHeight: 21 },
  errorHint: { color: '#0f766e', fontWeight: '800' },
  primaryButton: { minHeight: 44, borderRadius: 8, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#ffffff', fontWeight: '900' }
});

