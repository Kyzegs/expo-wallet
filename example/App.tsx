import {
  addPass,
  canAddPass,
  downloadAndAddPass,
  hasPass,
} from 'expo-wallet';
import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

/** Replace with your own test URLs / JWTs when exercising the example app. */
const SAMPLE_PKPASS_URL = 'https://example.com/pass.pkpass';
const SAMPLE_GOOGLE_JWT = 'eyJhbGciOiJ...'; // Issuer-signed JWT from your backend

export default function App() {
  const [pkpassUrl, setPkpassUrl] = useState(SAMPLE_PKPASS_URL);
  const [jwt, setJwt] = useState(SAMPLE_GOOGLE_JWT);
  const [passTypeId, setPassTypeId] = useState('pass.com.example.type');
  const [serial, setSerial] = useState('SERIAL123');
  const [log, setLog] = useState<string>('');

  const appendLog = useCallback((line: string) => {
    setLog((prev) => `${prev}\n${line}`);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>expo-wallet example</Text>

        <Group title="canAddPass">
          <Button
            title="Check wallet availability"
            onPress={async () => {
              try {
                const ok = await canAddPass();
                appendLog(`canAddPass → ${ok}`);
              } catch (e) {
                appendLog(`canAddPass error: ${String(e)}`);
              }
            }}
          />
        </Group>

        <Group title="iOS: addPass (local / base64)">
          <Text style={styles.hint}>
            Use a real file URI or base64 from your app. This screen only demonstrates the API shape.
          </Text>
        </Group>

        <Group title="Download .pkpass + add (expo-file-system)">
          <TextInput
            style={styles.input}
            value={pkpassUrl}
            onChangeText={setPkpassUrl}
            placeholder="https://.../file.pkpass"
            autoCapitalize="none"
          />
          <Button
            title="downloadAndAddPass (iOS uses pkpass; Android needs JWT below)"
            onPress={async () => {
              try {
                const added = await downloadAndAddPass(pkpassUrl, jwt.length > 20 ? jwt : undefined);
                appendLog(`downloadAndAddPass → ${added}`);
              } catch (e) {
                appendLog(`downloadAndAddPass error: ${String(e)}`);
              }
            }}
          />
        </Group>

        <Group title="Android: addPass (JWT)">
          <TextInput
            style={styles.input}
            value={jwt}
            onChangeText={setJwt}
            placeholder="Google Wallet JWT"
            autoCapitalize="none"
            multiline
          />
          <Button
            title="addPass with JWT"
            onPress={async () => {
              try {
                const added = await addPass({ android: { jwt } });
                appendLog(`addPass (Android JWT) → ${added}`);
              } catch (e) {
                appendLog(`addPass Android error: ${String(e)}`);
              }
            }}
          />
        </Group>

        <Group title="hasPass (iOS only)">
          <TextInput
            style={styles.input}
            value={passTypeId}
            onChangeText={setPassTypeId}
            placeholder="passTypeIdentifier"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={serial}
            onChangeText={setSerial}
            placeholder="serialNumber"
            autoCapitalize="none"
          />
          <Button
            title="hasPass"
            onPress={async () => {
              try {
                const exists = await hasPass({
                  ios: { passTypeIdentifier: passTypeId, serialNumber: serial },
                });
                appendLog(`hasPass → ${exists}`);
              } catch (e) {
                appendLog(`hasPass error: ${String(e)}`);
              }
            }}
          />
          <Button
            title="Show Android hasPass warning"
            onPress={async () => {
              const exists = await hasPass({ android: { objectId: 'unused' } });
              Alert.alert('Result', `hasPass returned ${exists} (see Metro logs on Android)`);
            }}
          />
        </Group>

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
