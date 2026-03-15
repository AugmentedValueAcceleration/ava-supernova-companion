import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fonts } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  const SettingRow = ({ icon, label, value, onPress }: {
    icon: string; label: string; value?: string; onPress?: () => void;
  }) => (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Ionicons name={icon as any} size={20} color={colors.textSecondary} />
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <SettingRow icon="information-circle-outline" label="Version" value="0.1.0" />
          <SettingRow
            icon="logo-github"
            label="GitHub"
            onPress={() => Linking.openURL('https://github.com/AugmentedValueAcceleration/ava-supernova')}
          />
          <SettingRow
            icon="globe-outline"
            label="Website"
            onPress={() => Linking.openURL('https://ava-supernova.com')}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy"
            value="Local-first"
          />
        </View>

        {/* Sync */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SYNC</Text>
          <SettingRow icon="cloud-outline" label="Platform Sync" value="Connected" />
          <SettingRow icon="sync-outline" label="Memory" value="Synced" />
          <SettingRow icon="checkbox-outline" label="Tasks" value="Synced" />
          <SettingRow icon="book-outline" label="Journal" value="Synced" />
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.red} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Ava | Supernova Companion{'\n'}
          Your AI partner, everywhere you go.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fonts.sizes.xl, fontWeight: '700', color: colors.text },
  content: { flex: 1 },
  section: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  sectionTitle: {
    fontSize: fonts.sizes.xs, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 1, marginBottom: spacing.sm,
  },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.purple,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: fonts.sizes.lg, fontWeight: '700', color: '#fff' },
  profileName: { fontSize: fonts.sizes.md, fontWeight: '600', color: colors.text },
  profileEmail: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  settingLabel: { flex: 1, fontSize: fonts.sizes.md, color: colors.text },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  settingValue: { fontSize: fonts.sizes.sm, color: colors.textSecondary },
  signOutButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  signOutText: { fontSize: fonts.sizes.md, color: colors.red, fontWeight: '600' },
  footer: {
    textAlign: 'center', color: colors.textMuted, fontSize: fonts.sizes.xs,
    paddingVertical: spacing.xl, lineHeight: 18,
  },
});
