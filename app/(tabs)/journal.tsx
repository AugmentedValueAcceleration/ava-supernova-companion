import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fonts } from '../../src/theme';
import { journalApi } from '../../src/api';

const moodEmojis = ['😔', '😕', '😐', '🙂', '😊'];
const moodColors = [colors.red, '#FB923C', colors.amber, colors.blue, colors.green];

export default function JournalScreen() {
  const [tab, setTab] = useState<'yours' | 'ava'>('yours');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [userContent, setUserContent] = useState('');
  const [avaContent, setAvaContent] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadEntry = useCallback(async () => {
    try {
      const data = await journalApi.get(selectedDate);
      if (data.entry) {
        setUserContent(data.entry.user_content || '');
        setAvaContent(data.entry.ava_content || '');
        setMood(data.entry.user_mood);
      } else {
        setUserContent('');
        setAvaContent('');
        setMood(null);
      }
    } catch {
      setUserContent('');
      setAvaContent('');
      setMood(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => { setLoading(true); loadEntry(); }, [loadEntry]);

  const saveEntry = async () => {
    try {
      await journalApi.upsert({
        date: selectedDate,
        user_content: userContent,
        user_mood: mood ?? undefined,
      });
      setEditing(false);
      Alert.alert('Saved', 'Journal entry saved.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
    setEditing(false);
  };

  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;
  const dateLabel = isToday ? 'Today' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Journal</Text>
      </View>

      {/* Date navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSelectedDate(today)}>
          <Text style={[styles.dateText, isToday && styles.dateTodayText]}>{dateLabel}</Text>
          <Text style={styles.dateSubtext}>{selectedDate}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => changeDate(1)}
          style={styles.dateArrow}
          disabled={selectedDate >= today}
        >
          <Ionicons name="chevron-forward" size={24} color={selectedDate >= today ? colors.textMuted : colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'yours' && styles.tabActive]}
          onPress={() => setTab('yours')}
        >
          <Text style={[styles.tabText, tab === 'yours' && styles.tabTextActive]}>Your Journal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'ava' && styles.tabActive]}
          onPress={() => setTab('ava')}
        >
          <Text style={[styles.tabText, tab === 'ava' && styles.tabTextActive]}>Ava's Journal</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEntry(); }} tintColor={colors.purple} />
        }
      >
        {tab === 'yours' ? (
          <View style={styles.entryContainer}>
            {/* Mood selector */}
            <View style={styles.moodRow}>
              <Text style={styles.moodLabel}>Mood:</Text>
              {moodEmojis.map((emoji, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.moodButton, mood === i + 1 && { backgroundColor: moodColors[i] + '30', borderColor: moodColors[i] }]}
                  onPress={() => setMood(mood === i + 1 ? null : i + 1)}
                >
                  <Text style={styles.moodEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {editing ? (
              <View>
                <TextInput
                  style={styles.editor}
                  value={userContent}
                  onChangeText={setUserContent}
                  multiline
                  placeholder="How are you feeling? What happened today? Write freely..."
                  placeholderTextColor={colors.textMuted}
                  textAlignVertical="top"
                  autoFocus
                />
                <View style={styles.editorActions}>
                  <TouchableOpacity style={styles.saveButton} onPress={saveEntry}>
                    <Text style={styles.saveButtonText}>Save Entry</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => { setEditing(false); loadEntry(); }}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : userContent ? (
              <TouchableOpacity onPress={() => setEditing(true)} activeOpacity={0.7}>
                <Text style={styles.entryText}>{userContent}</Text>
                <Text style={styles.editHint}>Tap to edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="create-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No entry for this day</Text>
                <TouchableOpacity style={styles.writeButton} onPress={() => setEditing(true)}>
                  <Text style={styles.writeButtonText}>Write Entry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.entryContainer}>
            {avaContent ? (
              <View>
                <View style={styles.avaHeader}>
                  <Text style={styles.avaName}>Ava</Text>
                  <View style={styles.avaBadge}>
                    <Text style={styles.avaBadgeText}>SUPERNOVA</Text>
                  </View>
                </View>
                <Text style={styles.entryText}>{avaContent}</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="sparkles-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>Ava hasn't written anything for this day</Text>
                <Text style={styles.emptyHint}>Ava writes her thoughts at the end of sessions</Text>
              </View>
            )}
          </View>
        )}
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
  dateNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  dateArrow: { padding: spacing.sm },
  dateText: { fontSize: fonts.sizes.lg, fontWeight: '600', color: colors.text, textAlign: 'center' },
  dateTodayText: { color: colors.purple },
  dateSubtext: { fontSize: fonts.sizes.xs, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  tabRow: {
    flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm,
  },
  tab: {
    flex: 1, paddingVertical: spacing.sm + 2, borderRadius: 12,
    backgroundColor: colors.surface, alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.purple },
  tabText: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: '#fff' },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  entryContainer: { paddingVertical: spacing.md },
  moodRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md,
  },
  moodLabel: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginRight: spacing.xs },
  moodButton: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  moodEmoji: { fontSize: 20 },
  editor: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: spacing.md, fontSize: fonts.sizes.md,
    color: colors.text, minHeight: 200, lineHeight: 24,
  },
  editorActions: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md,
  },
  saveButton: {
    backgroundColor: colors.purple, borderRadius: 12, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: fonts.sizes.sm },
  cancelButton: {
    backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2, borderWidth: 1, borderColor: colors.border,
  },
  cancelButtonText: { color: colors.textSecondary, fontWeight: '600', fontSize: fonts.sizes.sm },
  entryText: { fontSize: fonts.sizes.md, color: colors.text, lineHeight: 24 },
  editHint: { fontSize: fonts.sizes.xs, color: colors.textMuted, marginTop: spacing.sm },
  avaHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  avaName: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text },
  avaBadge: {
    backgroundColor: colors.purpleDark, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  avaBadgeText: { fontSize: 9, fontWeight: '700', color: colors.purpleLight, letterSpacing: 1 },
  empty: { alignItems: 'center', paddingTop: spacing.xl * 3, gap: spacing.sm },
  emptyText: { fontSize: fonts.sizes.md, color: colors.textMuted },
  emptyHint: { fontSize: fonts.sizes.sm, color: colors.textMuted },
  writeButton: {
    backgroundColor: colors.purple, borderRadius: 12, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2, marginTop: spacing.sm,
  },
  writeButtonText: { color: '#fff', fontWeight: '600', fontSize: fonts.sizes.sm },
});
