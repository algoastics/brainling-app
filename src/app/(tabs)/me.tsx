import { StyleSheet, Text, View } from 'react-native';

export default function MeScreen() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header">Me</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
