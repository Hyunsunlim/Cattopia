import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen({ navigation, onLogout }) {
  const handleDeleteAllData = () => {
    Alert.alert('Delete All Data', 'Are you sure you want to delete all your data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Final Confirmation', 'This cannot be undone! All notes and settings will be permanently deleted.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete Everything',
              style: 'destructive',
              onPress: async () => {
                await AsyncStorage.clear();
                if (onLogout) onLogout();
              },
            },
          ]);
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Account */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <MenuRow
          icon="person-outline"
          label="Profile"
          onPress={() => navigation.navigate('Profile')}
        />

        {/* Notifications */}
        <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
        <MenuRow
          icon="notifications-outline"
          label="Reminders"
          onPress={() => navigation.navigate('Reminders')}
        />
        <MenuRow
          icon="chatbubble-ellipses-outline"
          label="Messages"
          onPress={() => navigation.navigate('Messages')}
        />

        {/* Privacy */}
        <Text style={styles.sectionHeader}>PRIVACY</Text>
        <MenuRow
          icon="lock-closed-outline"
          label="Data & Privacy"
          onPress={() => navigation.navigate('DataPrivacy')}
        />
        <MenuRow
          icon="trash-outline"
          label="Delete All Data"
          onPress={handleDeleteAllData}
          danger
        />
        {onLogout && (
          <MenuRow
            icon="log-out-outline"
            label="Logout"
            onPress={handleLogout}
            danger
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.menuRowLeft}>
        <Ionicons name={icon} size={20} color={danger ? '#ef4444' : '#333'} />
        <Text style={[styles.menuRowLabel, danger && styles.menuRowLabelDanger]}>
          {label}
        </Text>
      </View>
      {!danger && <Ionicons name="chevron-forward" size={20} color="#ccc" />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuRowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  menuRowLabelDanger: {
    color: '#ef4444',
  },
});
