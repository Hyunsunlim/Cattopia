import { StyleSheet, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function InviteToast({ toastAnim, toastMessage }) {
  return (
    <Animated.View style={[styles.toast, { top: toastAnim }]}>
      <Ionicons name="checkmark-circle" size={18} color="#fff" />
      <Text style={styles.toastText}>{toastMessage}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20, right: 20,
    zIndex: 100,
    backgroundColor: '#3d665a',
    borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 8,
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
});
