import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import {
  calculateAggregatedStats,
  AggregatedStats,
  formatDuration,
  getDayName,
  getMonthName,
  loadGoals,
  saveGoals,
  ReadingGoals,
} from '../services/stats';
import { Typography, Spacing, Radius } from '../constants/theme';

export function StatsDashboard() {
  const { colors } = useTheme();
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalsModalVisible, setGoalsModalVisible] = useState(false);
  const [editingGoals, setEditingGoals] = useState<ReadingGoals>({
    yearlyBookGoal: 50,
    yearlyHoursGoal: 200,
    monthlyHoursGoal: 20,
  });

  const loadStats = useCallback(async () => {
    try {
      const data = await calculateAggregatedStats();
      setStats(data);
    } catch (err) {
      console.error('[StatsDashboard] Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const openGoalsModal = async () => {
    const goals = await loadGoals();
    setEditingGoals(goals);
    setGoalsModalVisible(true);
  };

  const saveEditingGoals = async () => {
    await saveGoals(editingGoals);
    setGoalsModalVisible(false);
    loadStats(); // Refresh to show new progress
  };

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!stats || stats.totalReadingTimeMinutes === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: Spacing.base }}>
        <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary, marginBottom: Spacing.lg }}>
          Reading Stats
        </Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: Radius.md, padding: Spacing.xl, alignItems: 'center' }}>
          <Ionicons name="book-outline" size={48} color={colors.textMuted} />
          <Text style={{ fontSize: Typography.base, color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.md }}>
            No reading data yet.
          </Text>
          <Text style={{ fontSize: Typography.sm, color: colors.textMuted, textAlign: 'center', marginTop: Spacing.sm }}>
            Start reading to see your stats!
          </Text>
        </View>
      </View>
    );
  }

  // Find peak reading day and hour
  const peakDay = stats.byDayOfWeek.reduce((max, day) =>
    day.totalMinutes > max.totalMinutes ? day : max, stats.byDayOfWeek[0]);
  const peakHour = stats.byHourOfDay.reduce((max, hour) =>
    hour.totalMinutes > max.totalMinutes ? hour : max, stats.byHourOfDay[0]);

  // Format hour for display
  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h} ${ampm}`;
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: Spacing.base, paddingBottom: 100 }}>
      <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary, marginBottom: Spacing.lg }}>
        Reading Stats
      </Text>

      {/* Streak Card */}
      <View style={{ backgroundColor: colors.surface, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
          <Ionicons name="flame" size={24} color="#FF6B35" />
          <Text style={{ fontSize: Typography.lg, fontWeight: Typography.semibold, color: colors.textPrimary, marginLeft: Spacing.sm }}>
            Reading Streak
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: Typography.xxl, fontWeight: Typography.bold, color: colors.accent }}>
              {stats.currentStreakDays}
            </Text>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>Current Days</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: Typography.xxl, fontWeight: Typography.bold, color: colors.textPrimary }}>
              {stats.longestStreakDays}
            </Text>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>Longest Streak</Text>
          </View>
        </View>
      </View>

      {/* Reader Personality Card */}
      <View style={{ backgroundColor: colors.surface, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
          <Text style={{ fontSize: 32, marginRight: Spacing.sm }}>{stats.personality.emoji}</Text>
          <View>
            <Text style={{ fontSize: Typography.sm, color: colors.textMuted }}>Reader Personality</Text>
            <Text style={{ fontSize: Typography.lg, fontWeight: Typography.bold, color: colors.textPrimary }}>
              {stats.personality.name}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: Typography.base, color: colors.textSecondary, marginBottom: Spacing.sm }}>
          {stats.personality.description}
        </Text>
        {stats.personality.secondaryTrait && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm }}>
            <Text style={{ fontSize: Typography.sm, color: colors.textMuted }}>Secondary trait: </Text>
            <Text style={{ fontSize: Typography.sm, color: colors.accent, fontWeight: Typography.semibold }}>
              {stats.personality.secondaryTrait.replace('-', ' ')}
            </Text>
          </View>
        )}
      </View>

      {/* Time Stats */}
      <View style={{ backgroundColor: colors.surface, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
          <Ionicons name="time-outline" size={24} color={colors.accent} />
          <Text style={{ fontSize: Typography.lg, fontWeight: Typography.semibold, color: colors.textPrimary, marginLeft: Spacing.sm }}>
            Reading Time
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary }}>
              {formatDuration(stats.totalReadingTimeMinutes)}
            </Text>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>Total</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary }}>
              {formatDuration(stats.totalReadingTimeThisMonth)}
            </Text>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>This Month</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary }}>
              {formatDuration(stats.totalReadingTimeThisYear)}
            </Text>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>This Year</Text>
          </View>
        </View>
        
        {/* Peak reading times */}
        <View style={{ backgroundColor: colors.background, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm }}>
          <Text style={{ fontSize: Typography.sm, color: colors.textMuted, marginBottom: Spacing.sm }}>
            Peak Reading Times
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={16} color={colors.accent} />
              <Text style={{ fontSize: Typography.sm, color: colors.textSecondary, marginLeft: Spacing.xs }}>
                {getDayName(peakDay.day)}s ({formatDuration(peakDay.totalMinutes)})
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="sunny-outline" size={16} color={colors.accent} />
              <Text style={{ fontSize: Typography.sm, color: colors.textSecondary, marginLeft: Spacing.xs }}>
                {formatHour(peakHour.hour)} ({formatDuration(peakHour.totalMinutes)})
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Books Stats */}
      <View style={{ backgroundColor: colors.surface, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
          <Ionicons name="library-outline" size={24} color={colors.accent} />
          <Text style={{ fontSize: Typography.lg, fontWeight: Typography.semibold, color: colors.textPrimary, marginLeft: Spacing.sm }}>
            Books
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary }}>
              {stats.totalBooksFinished}
            </Text>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>Finished</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary }}>
              {stats.booksFinishedThisYear}
            </Text>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>This Year</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary }}>
              {stats.totalBooksStarted}
            </Text>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>In Progress</Text>
          </View>
        </View>
      </View>

      {/* Format Breakdown */}
      <View style={{ backgroundColor: colors.surface, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
          <Ionicons name="headset-outline" size={24} color={colors.accent} />
          <Text style={{ fontSize: Typography.lg, fontWeight: Typography.semibold, color: colors.textPrimary, marginLeft: Spacing.sm }}>
            Format Breakdown
          </Text>
        </View>
        
        {/* Progress bars */}
        <View style={{ marginBottom: Spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>E-books</Text>
            <Text style={{ fontSize: Typography.sm, color: colors.textPrimary }}>{formatDuration(stats.ebookTimeMinutes)}</Text>
          </View>
          <View style={{ height: 8, backgroundColor: colors.background, borderRadius: 4, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${stats.totalReadingTimeMinutes > 0 ? (stats.ebookTimeMinutes / stats.totalReadingTimeMinutes) * 100 : 0}%`,
                backgroundColor: '#4ECDC4',
              }}
            />
          </View>
        </View>
        
        <View style={{ marginBottom: Spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>Audiobooks</Text>
            <Text style={{ fontSize: Typography.sm, color: colors.textPrimary }}>{formatDuration(stats.audiobookTimeMinutes)}</Text>
          </View>
          <View style={{ height: 8, backgroundColor: colors.background, borderRadius: 4, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${stats.totalReadingTimeMinutes > 0 ? (stats.audiobookTimeMinutes / stats.totalReadingTimeMinutes) * 100 : 0}%`,
                backgroundColor: '#9B59B6',
              }}
            />
          </View>
        </View>
        
        {stats.bothTimeMinutes > 0 && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
              <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>Both (listening while reading)</Text>
              <Text style={{ fontSize: Typography.sm, color: colors.textPrimary }}>{formatDuration(stats.bothTimeMinutes)}</Text>
            </View>
            <View style={{ height: 8, backgroundColor: colors.background, borderRadius: 4, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  width: `${stats.totalReadingTimeMinutes > 0 ? (stats.bothTimeMinutes / stats.totalReadingTimeMinutes) * 100 : 0}%`,
                  backgroundColor: '#F39C12',
                }}
              />
            </View>
          </View>
        )}
      </View>

      {/* Goals Section */}
      <View style={{ backgroundColor: colors.surface, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="trophy-outline" size={24} color={colors.accent} />
            <Text style={{ fontSize: Typography.lg, fontWeight: Typography.semibold, color: colors.textPrimary, marginLeft: Spacing.sm }}>
              Goals
            </Text>
          </View>
          <TouchableOpacity onPress={openGoalsModal} style={{ padding: Spacing.sm }}>
            <Ionicons name="create-outline" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Yearly Book Goal */}
        <View style={{ marginBottom: Spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>
              Yearly Books: {stats.booksFinishedThisYear} / {stats.goals.yearlyBookGoal}
            </Text>
            <Text style={{ fontSize: Typography.sm, color: colors.accent, fontWeight: Typography.semibold }}>
              {Math.round(stats.yearlyBookProgress * 100)}%
            </Text>
          </View>
          <View style={{ height: 12, backgroundColor: colors.background, borderRadius: 6, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${stats.yearlyBookProgress * 100}%`,
                backgroundColor: stats.yearlyBookProgress >= 1 ? '#27AE60' : colors.accent,
                borderRadius: 6,
              }}
            />
          </View>
        </View>

        {/* Yearly Hours Goal */}
        <View style={{ marginBottom: Spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>
              Yearly Hours: {Math.round(stats.totalReadingTimeThisYear / 60)} / {stats.goals.yearlyHoursGoal}
            </Text>
            <Text style={{ fontSize: Typography.sm, color: colors.accent, fontWeight: Typography.semibold }}>
              {Math.round(stats.yearlyHoursProgress * 100)}%
            </Text>
          </View>
          <View style={{ height: 12, backgroundColor: colors.background, borderRadius: 6, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${stats.yearlyHoursProgress * 100}%`,
                backgroundColor: stats.yearlyHoursProgress >= 1 ? '#27AE60' : colors.accent,
                borderRadius: 6,
              }}
            />
          </View>
        </View>

        {/* Monthly Hours Goal */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>
              Monthly Hours: {Math.round(stats.totalReadingTimeThisMonth / 60)} / {stats.goals.monthlyHoursGoal}
            </Text>
            <Text style={{ fontSize: Typography.sm, color: colors.accent, fontWeight: Typography.semibold }}>
              {Math.round(stats.monthlyHoursProgress * 100)}%
            </Text>
          </View>
          <View style={{ height: 12, backgroundColor: colors.background, borderRadius: 6, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${stats.monthlyHoursProgress * 100}%`,
                backgroundColor: stats.monthlyHoursProgress >= 1 ? '#27AE60' : colors.accent,
                borderRadius: 6,
              }}
            />
          </View>
        </View>
      </View>

      {/* Monthly Activity */}
      <View style={{ backgroundColor: colors.surface, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
          <Ionicons name="bar-chart-outline" size={24} color={colors.accent} />
          <Text style={{ fontSize: Typography.lg, fontWeight: Typography.semibold, color: colors.textPrimary, marginLeft: Spacing.sm }}>
            This Year
          </Text>
        </View>
        
        {/* Mini bar chart for months */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 }}>
          {stats.byMonthThisYear.map((month) => {
            const maxMinutes = Math.max(...stats.byMonthThisYear.map(m => m.minutes), 1);
            const height = month.minutes > 0 ? (month.minutes / maxMinutes) * 80 : 4;
            const isCurrentMonth = new Date().getMonth() === month.month;
            
            return (
              <View key={month.month} style={{ alignItems: 'center', flex: 1 }}>
                <View
                  style={{
                    width: 8,
                    height,
                    backgroundColor: isCurrentMonth ? colors.accent : colors.textMuted,
                    borderRadius: 4,
                    opacity: month.minutes > 0 ? 1 : 0.3,
                  }}
                />
                <Text
                  style={{
                    fontSize: 10,
                    color: isCurrentMonth ? colors.accent : colors.textMuted,
                    marginTop: Spacing.xs,
                  }}
                >
                  {getMonthName(month.month)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Goals Modal */}
      <Modal
        visible={goalsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalsModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.base }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: Radius.md, padding: Spacing.lg, width: '100%', maxWidth: 400 }}>
            <Text style={{ fontSize: Typography.lg, fontWeight: Typography.bold, color: colors.textPrimary, marginBottom: Spacing.lg }}>
              Edit Reading Goals
            </Text>

            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary, marginBottom: Spacing.xs }}>
              Yearly Book Goal
            </Text>
            <TextInput
              value={String(editingGoals.yearlyBookGoal)}
              onChangeText={(text) => setEditingGoals({ ...editingGoals, yearlyBookGoal: parseInt(text) || 0 })}
              keyboardType="number-pad"
              style={{
                backgroundColor: colors.background,
                borderRadius: Radius.md,
                padding: Spacing.md,
                color: colors.textPrimary,
                fontSize: Typography.base,
                marginBottom: Spacing.md,
              }}
            />

            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary, marginBottom: Spacing.xs }}>
              Yearly Hours Goal
            </Text>
            <TextInput
              value={String(editingGoals.yearlyHoursGoal)}
              onChangeText={(text) => setEditingGoals({ ...editingGoals, yearlyHoursGoal: parseInt(text) || 0 })}
              keyboardType="number-pad"
              style={{
                backgroundColor: colors.background,
                borderRadius: Radius.md,
                padding: Spacing.md,
                color: colors.textPrimary,
                fontSize: Typography.base,
                marginBottom: Spacing.md,
              }}
            />

            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary, marginBottom: Spacing.xs }}>
              Monthly Hours Goal
            </Text>
            <TextInput
              value={String(editingGoals.monthlyHoursGoal)}
              onChangeText={(text) => setEditingGoals({ ...editingGoals, monthlyHoursGoal: parseInt(text) || 0 })}
              keyboardType="number-pad"
              style={{
                backgroundColor: colors.background,
                borderRadius: Radius.md,
                padding: Spacing.md,
                color: colors.textPrimary,
                fontSize: Typography.base,
                marginBottom: Spacing.lg,
              }}
            />

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <TouchableOpacity
                onPress={() => setGoalsModalVisible(false)}
                style={{
                  flex: 1,
                  padding: Spacing.md,
                  borderRadius: Radius.md,
                  backgroundColor: colors.background,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: Typography.semibold }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEditingGoals}
                style={{
                  flex: 1,
                  padding: Spacing.md,
                  borderRadius: Radius.md,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: Typography.semibold }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
