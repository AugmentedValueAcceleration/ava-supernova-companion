import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fonts } from '../../src/theme';
import { tasksApi } from '../../src/api';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in-progress' | 'done' | 'archived';
  category: string;
  due_date?: string;
  source: 'user' | 'ava';
}

const priorityColors: Record<string, string> = {
  low: colors.green,
  medium: colors.blue,
  high: colors.amber,
  urgent: colors.red,
};

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'today' | 'all'>('today');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const data = await tasksApi.list({ status: 'todo,in-progress' });
      setTasks(data.tasks || []);
    } catch (err) {
      // Offline or not connected
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      await tasksApi.create({
        title: newTaskTitle.trim(),
        due_date: today,
        priority: 'medium',
        category: 'personal',
      });
      setNewTaskTitle('');
      loadTasks();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const toggleTask = async (task: Task) => {
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      await tasksApi.update(task.id, {
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null,
      });
      loadTasks();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const deleteTask = (task: Task) => {
    Alert.alert('Delete Task', `Delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await tasksApi.delete(task.id);
            loadTasks();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const today = new Date().toISOString().split('T')[0];
  const filteredTasks = filter === 'today'
    ? tasks.filter(t => t.due_date === today || t.status === 'in-progress')
    : tasks;

  const renderTask = ({ item }: { item: Task }) => {
    const isOverdue = item.due_date && item.due_date < today && item.status !== 'done';

    return (
      <TouchableOpacity
        style={styles.taskCard}
        onLongPress={() => deleteTask(item)}
        activeOpacity={0.7}
      >
        <TouchableOpacity style={styles.checkbox} onPress={() => toggleTask(item)}>
          <Ionicons
            name={item.status === 'done' ? 'checkbox' : 'square-outline'}
            size={24}
            color={item.status === 'done' ? colors.green : colors.textMuted}
          />
        </TouchableOpacity>

        <View style={styles.taskContent}>
          <View style={styles.taskHeader}>
            <Text style={[styles.taskTitle, item.status === 'done' && styles.taskDone]} numberOfLines={2}>
              {item.title}
            </Text>
            {item.source === 'ava' && (
              <View style={styles.avaBadge}>
                <Text style={styles.avaBadgeText}>Ava</Text>
              </View>
            )}
          </View>

          <View style={styles.taskMeta}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColors[item.priority] }]} />
            <Text style={styles.metaText}>{item.priority}</Text>
            {item.due_date && (
              <Text style={[styles.metaText, isOverdue && styles.overdueText]}>
                {isOverdue ? 'Overdue' : item.due_date === today ? 'Today' : item.due_date}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tasks</Text>
        <Text style={styles.headerCount}>{filteredTasks.length} active</Text>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'today' && styles.filterActive]}
          onPress={() => setFilter('today')}
        >
          <Text style={[styles.filterText, filter === 'today' && styles.filterTextActive]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="Add a task..."
          placeholderTextColor={colors.textMuted}
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          onSubmitEditing={addTask}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addButton, !newTaskTitle.trim() && styles.addDisabled]}
          onPress={addTask}
          disabled={!newTaskTitle.trim()}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredTasks}
        renderItem={renderTask}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTasks(); }} tintColor={colors.purple} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkbox-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {filter === 'today' ? 'Nothing for today' : 'No active tasks'}
            </Text>
            <Text style={styles.emptyHint}>Add a task above or ask Ava in chat</Text>
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
  filterRow: {
    flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: 20, backgroundColor: colors.surface,
  },
  filterActive: { backgroundColor: colors.purple },
  filterText: { fontSize: fonts.sizes.sm, color: colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  addRow: {
    flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  addInput: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: fonts.sizes.md, color: colors.text,
  },
  addButton: {
    backgroundColor: colors.purple, width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  addDisabled: { opacity: 0.4 },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  taskCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  checkbox: { marginTop: 2 },
  taskContent: { flex: 1 },
  taskHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  taskTitle: { flex: 1, fontSize: fonts.sizes.md, color: colors.text, fontWeight: '500' },
  taskDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  avaBadge: {
    backgroundColor: colors.purpleDark, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  avaBadgeText: { fontSize: 10, fontWeight: '700', color: colors.purpleLight },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  metaText: { fontSize: fonts.sizes.xs, color: colors.textSecondary },
  overdueText: { color: colors.red },
  empty: { alignItems: 'center', paddingTop: spacing.xl * 3, gap: spacing.sm },
  emptyText: { fontSize: fonts.sizes.md, color: colors.textMuted },
  emptyHint: { fontSize: fonts.sizes.sm, color: colors.textMuted },
});
