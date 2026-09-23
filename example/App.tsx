import {
  addPass,
  addPassLibraryListener,
  AppleWalletButton,
  canAddPasses,
  getGoogleWalletSaveUrl,
  getPasses,
  isWalletError,
  openPass,
  type Pass,
} from 'expo-wallet';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

/** Replace with your own test pass URL and JWT. */
const SAMPLE_PKPASS_URL = 'https://example.com/pass.pkpass';
const SAMPLE_GOOGLE_JWT = 'eyJhbGciOiJ...'; // Issuer-signed JWT from your backend

export default function App() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pkpassUrl, setPkpassUrl] = useState(SAMPLE_PKPASS_URL);
  const [jwt, setJwt] = useState(SAMPLE_GOOGLE_JWT);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [log, setLog] = useState('');

  const appendLog = useCallback((line: string) => {
    setLog((prev) => `${prev}\n${line}`);
  }, []);

  const refreshPasses = useCallback(async () => {
    if (Platform.OS === 'ios') {
      // Only passes whose type is in the app's pass-type-identifiers entitlement are returned.
      setPasses(await getPasses());
    }
  }, []);

  useEffect(() => {
    canAddPasses().then(setAvailable);
    refreshPasses();
    const subscription = addPassLibraryListener((event) => {
      appendLog(
        `library changed: +${event.added.length} ~${event.replaced.length} -${event.removed.length}`
      );
      refreshPasses();
    });
    return () => subscription.remove();
  }, [appendLog, refreshPasses]);

  const add = async () => {
    try {
      // One call for both platforms; each uses its own entry.
      const result = await addPass({ apple: pkpassUrl, google: jwt });
      appendLog(`addPass → ${result}`);
    } catch (error) {
      if (isWalletError(error, 'ERR_WALLET_UNAVAILABLE') && Platform.OS === 'android') {
        // No Google Wallet app: fall back to the browser save flow.
        await Linking.openURL(getGoogleWalletSaveUrl(jwt));
      } else {
        appendLog(`addPass error: ${String(error)}`);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>expo-wallet example</Text>

        <Group title="Add a pass">
          <Text style={styles.hint}>canAddPasses → {String(available)}</Text>
          <TextInput
            style={styles.input}
            value={pkpassUrl}
            onChangeText={setPkpassUrl}
            placeholder="https://…/pass.pkpass (iOS)"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={jwt}
            onChangeText={setJwt}
            placeholder="Google Wallet JWT (Android)"
            autoCapitalize="none"
            multiline
          />
          {Platform.OS === 'ios' ? (
            <AppleWalletButton onPress={add} disabled={!available} />
          ) : (
            <Button title="Add to Google Wallet" onPress={add} disabled={!available} />
          )}
        </Group>

        {Platform.OS === 'ios' && (
          <Group title={`Passes this app can access (${passes.length})`}>
            {passes.map((pass) => (
              <Button
                key={`${pass.passTypeIdentifier}/${pass.serialNumber}`}
                title={`${pass.localizedName}: ${pass.serialNumber}`}
                onPress={() => openPass(pass).catch((e) => appendLog(`openPass error: ${e}`))}
              />
            ))}
          </Group>
        )}

        <Group title="Log">
          <Text selectable style={styles.log}>
            {log.trim() || '…'}
          </Text>
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group(props: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{props.title}</Text>
      {props.children}
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#eee' },
  scroll: { paddingBottom: 32 },
  header: { fontSize: 22, margin: 16, fontWeight: '600' as const },
  groupHeader: { fontSize: 16, marginBottom: 8, fontWeight: '600' as const },
  group: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
  },
  hint: { fontSize: 13, color: '#555', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    fontSize: 14,
  },
  log: { fontSize: 12, fontFamily: 'monospace' },
};
