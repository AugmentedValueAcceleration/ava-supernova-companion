import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fonts } from '../../src/theme';
import { memoryApi } from '../../src/api';

interface Memory {
  id: string;
  category: string;
  content: string;
  tags: string[];
  created_at: string;
  recall_count: number;
}

const categoryIcons: Record<string, string> = {
  pattern: 'code-slash',
  preference: 'heart',
  architecture: 'git-branch',
  'bug-fix': 'bug',
  convention: 'document-text',
  'tool-config': 'construct',
  decision: 'checkmark-circle',
  person: 'person',
  general: 'bulb',
};

export default function MemoryScreen() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    try {
      const data = await memoryApi.list();
      setMemories(data.memories || []);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  const renderMemory = ({ item }: { item: Memory }) => {
    const isExpanded = expandedId === item.id;
    const icon = categoryIcons[item.category] || 'bulb';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.categoryBadge}>
            <Ionicons name={icon as any} size={14} color={colors.purple} />
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
          <Text style={styles.recallCount}>{item.recall_count}x recalled</Text>
        </View>

        <Text style={styles.contentText} numberOfLines={isExpanded ? undefined : 3}>
          {item.content}
        </Text>

        {item.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {item.tags.slice(0, 4).map((tag, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {item.tags.length > 4 && (
              <Text style={styles.moreTagsText}>+{item.tags.length - 4}</Text>
            )}
          </View>
        )}

        <Text style={styles.dateText}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Memory</Text>
        <Text style={styles.headerCount}>{memories.length} memories</Text>
      </View>

      <FlatList
        data={memories}
        renderItem={renderMemory}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMemories(); }} tintColor={colors.purple} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="brain-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No memories yet</Text>
            <Text style={styles.emptyHint}>Ava builds memories as you work together</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fonts.sizes.xl, fontWeight: '700', color: colors.text },
  headerCount: { fontSize: fonts.sizes.sm, color: colors.textSecondary },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.purpleDark + '40', borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
  categoryText: { fontSize: fonts.sizes.xs, color: colors.purpleLight, fontWeight: '600' },
  recallCount: { fontSize: fonts.sizes.xs, color: colors.textMuted },
  contentText: { fontSize: fonts.sizes.sm, color: colors.text, lineHeight: 20 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: {
    backgroundColor: colors.border, borderRadius: 6,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  tagText: { fontSize: fonts.sizes.xs, color: colors.textSecondary },
  moreTagsText: { fontSize: fonts.sizes.xs, color: colors.textMuted, alignSelf: 'center' },
  dateText: { fontSize: fonts.sizes.xs, color: colors.textMuted },
  empty: { alignItems: 'center', paddingTop: spacing.xl * 3, gap: spacing.sm },
  emptyText: { fontSize: fonts.sizes.md, color: colors.textMuted },
  emptyHint: { fontSize: fonts.sizes.sm, color: colors.textMuted },
});
