import { View, Text, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'

export default function App() {
  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <Text style={s.text}>SplitRace</Text>
      <Text style={s.sub}>Loading...</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  text:      { color: '#fff', fontSize: 32, fontWeight: '800' },
  sub:       { color: 'rgba(255,255,255,0.5)', marginTop: 8 },
})
