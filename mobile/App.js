import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'http://192.168.200.27:4173';

const injectedViewport = `
  (function () {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  })();
  true;
`;

function MarketplaceWebView() {
  const webviewRef = useRef(null);
  const [hasError, setHasError] = useState(false);

  const retry = () => {
    setHasError(false);
    webviewRef.current?.reload();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <StatusBar translucent={false} backgroundColor="#f3f6f8" barStyle="dark-content" />

      <WebView
        ref={webviewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        containerStyle={styles.webviewContainer}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        startInLoadingState
        scalesPageToFit={false}
        pullToRefreshEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        injectedJavaScriptBeforeContentLoaded={injectedViewport}
        onLoadStart={() => setHasError(false)}
        onError={() => setHasError(true)}
        onHttpError={() => setHasError(true)}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#0f766e" size="large" />
            <Text style={styles.loadingText}>Carregando marketplace...</Text>
          </View>
        )}
      />

      {hasError ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>Nao foi possivel carregar o aplicativo.</Text>
          <Text style={styles.errorText}>
            Verifique se a versao web esta rodando no computador e se o celular esta na mesma rede Wi-Fi.
          </Text>
          <Pressable style={styles.primaryButton} onPress={retry}>
            <Text style={styles.primaryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MarketplaceWebView />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f6f8'
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#f3f6f8'
  },
  webview: {
    flex: 1,
    backgroundColor: '#f3f6f8'
  },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#f3f6f8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  loadingText: {
    color: '#667587',
    fontWeight: '800'
  },
  errorPanel: {
    position: 'absolute',
    zIndex: 2,
    left: 16,
    right: 16,
    top: 18,
    padding: 18,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d9e1e8',
    gap: 10,
    shadowColor: '#162233',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5
  },
  errorTitle: {
    color: '#18212f',
    fontSize: 18,
    fontWeight: '900'
  },
  errorText: {
    color: '#667587',
    lineHeight: 21
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '900'
  }
});

