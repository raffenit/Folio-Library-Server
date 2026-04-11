import { storage } from './storage';

const STATS_KEY = 'folio_reading_stats_v1';
const GOALS_KEY = 'folio_reading_goals_v1';

export type ReadingFormat = 'ebook' | 'audiobook' | 'both';

export interface ReadingSession {
  id: string;
  bookId: string;
  bookTitle: string;
  startTime: number;
  endTime: number;
  durationMinutes: number;
  format: ReadingFormat;
  pagesRead?: number;
  percentageProgress?: number;
}

export interface ReadingGoals {
  yearlyBookGoal: number;
  yearlyHoursGoal: number;
  monthlyHoursGoal: number;
}

export interface ReadingStats {
  sessions: ReadingSession[];
  booksStarted: string[]; // book IDs
  booksFinished: string[]; // book IDs
  totalReadingTimeMinutes: number;
  lastUpdated: number;
}

export type ReaderPersonality =
  | 'butterfly'      // Short sessions, jumps between books
  | 'squirrel'       // Starts many, finishes few
  | 'bookworm'       // Long sessions, high completion
  | 'night-owl'      // Reads mostly at night
  | 'early-bird'     // Reads mostly in morning
  | 'audiobook-fanatic' // Mostly listens
  | 'genre-loyalist' // Sticks to same genres
  | 'explorer'       // Wide variety
  | 'speed-reader'   // High pages per minute
  | 'slow-steady'    // Consistent daily reading
  | 'marathoner';    // Very long sessions

export interface ReaderPersonalityResult {
  type: ReaderPersonality;
  name: string;
  emoji: string;
  description: string;
  secondaryTrait?: ReaderPersonality;
}

export interface AggregatedStats {
  // Time totals
  totalReadingTimeMinutes: number;
  totalReadingTimeThisMonth: number;
  totalReadingTimeThisYear: number;
  
  // Book counts
  totalBooksStarted: number;
  totalBooksFinished: number;
  booksFinishedThisYear: number;
  
  // Format breakdown
  ebookTimeMinutes: number;
  audiobookTimeMinutes: number;
  bothTimeMinutes: number;
  
  // Day of week patterns (0-6, Sunday-Saturday)
  byDayOfWeek: { day: number; totalMinutes: number; sessionCount: number }[];
  
  // Time of day patterns (0-23 hours)
  byHourOfDay: { hour: number; totalMinutes: number; sessionCount: number }[];
  
  // Monthly stats for current year
  byMonthThisYear: { month: number; minutes: number; booksFinished: number }[];
  
  // Current streaks
  currentStreakDays: number;
  longestStreakDays: number;
  
  // Goals progress
  goals: ReadingGoals;
  yearlyBookProgress: number;
  yearlyHoursProgress: number;
  monthlyHoursProgress: number;
  
  // Reader personality
  personality: ReaderPersonalityResult;
}

export async function loadStats(): Promise<ReadingStats> {
  const data = await storage.getItem(STATS_KEY);
  if (!data) {
    return {
      sessions: [],
      booksStarted: [],
      booksFinished: [],
      totalReadingTimeMinutes: 0,
      lastUpdated: Date.now(),
    };
  }
  return JSON.parse(data);
}

export async function saveStats(stats: ReadingStats): Promise<void> {
  stats.lastUpdated = Date.now();
  await storage.setItem(STATS_KEY, JSON.stringify(stats));
}

export async function loadGoals(): Promise<ReadingGoals> {
  const data = await storage.getItem(GOALS_KEY);
  if (!data) {
    return {
      yearlyBookGoal: 50,
      yearlyHoursGoal: 200,
      monthlyHoursGoal: 20,
    };
  }
  return JSON.parse(data);
}

export async function saveGoals(goals: ReadingGoals): Promise<void> {
  await storage.setItem(GOALS_KEY, JSON.stringify(goals));
}

// Start a new reading session
export async function startReadingSession(
  bookId: string,
  bookTitle: string,
  format: ReadingFormat
): Promise<string> {
  const stats = await loadStats();
  
  // Mark book as started if not already
  if (!stats.booksStarted.includes(bookId)) {
    stats.booksStarted.push(bookId);
  }
  
  await saveStats(stats);
  
  // Return session ID that will be used to end the session
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// End a reading session and record stats
export async function endReadingSession(
  sessionId: string,
  bookId: string,
  bookTitle: string,
  startTime: number,
  format: ReadingFormat,
  pagesRead?: number,
  percentageProgress?: number
): Promise<void> {
  const endTime = Date.now();
  const durationMinutes = Math.round((endTime - startTime) / 60000);
  
  // Only record if they read for at least 1 minute
  if (durationMinutes < 1) return;
  
  const stats = await loadStats();
  
  const session: ReadingSession = {
    id: sessionId,
    bookId,
    bookTitle,
    startTime,
    endTime,
    durationMinutes,
    format,
    pagesRead,
    percentageProgress,
  };
  
  stats.sessions.push(session);
  stats.totalReadingTimeMinutes += durationMinutes;
  
  await saveStats(stats);
}

// Mark a book as finished
export async function finishBook(bookId: string): Promise<void> {
  const stats = await loadStats();
  
  if (!stats.booksFinished.includes(bookId)) {
    stats.booksFinished.push(bookId);
  }
  
  await saveStats(stats);
}

// Calculate all aggregated statistics
export async function calculateAggregatedStats(): Promise<AggregatedStats> {
  const stats = await loadStats();
  const goals = await loadGoals();
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Initialize aggregations
  let ebookTimeMinutes = 0;
  let audiobookTimeMinutes = 0;
  let bothTimeMinutes = 0;
  
  const byDayOfWeek = Array(7).fill(0).map((_, i) => ({ day: i, totalMinutes: 0, sessionCount: 0 }));
  const byHourOfDay = Array(24).fill(0).map((_, i) => ({ hour: i, totalMinutes: 0, sessionCount: 0 }));
  const byMonthThisYear = Array(12).fill(0).map((_, i) => ({ month: i, minutes: 0, booksFinished: 0 }));
  
  let totalThisMonth = 0;
  let totalThisYear = 0;
  
  // Books finished this year
  const booksFinishedThisYear = stats.booksFinished.filter(bookId => {
    // Find the session where this book was last read to determine finish time
    const sessions = stats.sessions.filter(s => s.bookId === bookId);
    if (sessions.length === 0) return false;
    const lastSession = sessions[sessions.length - 1];
    const sessionDate = new Date(lastSession.endTime);
    return sessionDate.getFullYear() === currentYear;
  }).length;
  
  // Process all sessions
  for (const session of stats.sessions) {
    const sessionDate = new Date(session.startTime);
    const dayOfWeek = sessionDate.getDay();
    const hour = sessionDate.getHours();
    
    // Format breakdown
    if (session.format === 'ebook') {
      ebookTimeMinutes += session.durationMinutes;
    } else if (session.format === 'audiobook') {
      audiobookTimeMinutes += session.durationMinutes;
    } else {
      bothTimeMinutes += session.durationMinutes;
    }
    
    // Day of week
    byDayOfWeek[dayOfWeek].totalMinutes += session.durationMinutes;
    byDayOfWeek[dayOfWeek].sessionCount++;
    
    // Hour of day
    byHourOfDay[hour].totalMinutes += session.durationMinutes;
    byHourOfDay[hour].sessionCount++;
    
    // Monthly tracking for current year
    if (sessionDate.getFullYear() === currentYear) {
      byMonthThisYear[sessionDate.getMonth()].minutes += session.durationMinutes;
      totalThisYear += session.durationMinutes;
      
      if (sessionDate.getMonth() === currentMonth) {
        totalThisMonth += session.durationMinutes;
      }
    }
  }
  
  // Count books finished per month this year
  for (const bookId of stats.booksFinished) {
    const sessions = stats.sessions.filter(s => s.bookId === bookId);
    if (sessions.length > 0) {
      const lastSession = sessions[sessions.length - 1];
      const finishDate = new Date(lastSession.endTime);
      if (finishDate.getFullYear() === currentYear) {
        byMonthThisYear[finishDate.getMonth()].booksFinished++;
      }
    }
  }
  
  // Calculate streaks
  const readingDays = new Set(
    stats.sessions.map(s => {
      const d = new Date(s.startTime);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  
  const sortedDays = Array.from(readingDays).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let lastDate: Date | null = null;
  
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  
  for (const dayKey of sortedDays) {
    const [year, month, date] = dayKey.split('-').map(Number);
    const currentDate = new Date(year, month, date);
    
    if (lastDate) {
      const diffDays = (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    lastDate = currentDate;
  }
  
  longestStreak = Math.max(longestStreak, tempStreak);
  
  // Check if current streak is active (read today or yesterday)
  if (lastDate) {
    const daysSinceLastRead = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLastRead <= 1) {
      currentStreak = tempStreak;
    } else {
      currentStreak = 0;
    }
  }
  
  // Goal progress (prevent division by zero)
  const yearlyBookProgress = goals.yearlyBookGoal > 0 ? booksFinishedThisYear / goals.yearlyBookGoal : 0;
  const yearlyHoursProgress = goals.yearlyHoursGoal > 0 ? (totalThisYear / 60) / goals.yearlyHoursGoal : 0;
  const monthlyHoursProgress = goals.monthlyHoursGoal > 0 ? (totalThisMonth / 60) / goals.monthlyHoursGoal : 0;
  
  // Calculate reader personality
  const personality = calculatePersonality({
    sessions: stats.sessions,
    totalBooksStarted: stats.booksStarted.length,
    totalBooksFinished: stats.booksFinished.length,
    ebookTimeMinutes,
    audiobookTimeMinutes,
    bothTimeMinutes,
    byHourOfDay,
    totalReadingTimeMinutes: stats.totalReadingTimeMinutes,
    currentStreakDays: currentStreak,
  });
  
  return {
    totalReadingTimeMinutes: stats.totalReadingTimeMinutes,
    totalReadingTimeThisMonth: totalThisMonth,
    totalReadingTimeThisYear: totalThisYear,
    
    totalBooksStarted: stats.booksStarted.length,
    totalBooksFinished: stats.booksFinished.length,
    booksFinishedThisYear,
    
    ebookTimeMinutes,
    audiobookTimeMinutes,
    bothTimeMinutes,
    
    byDayOfWeek,
    byHourOfDay,
    byMonthThisYear,
    
    currentStreakDays: currentStreak,
    longestStreakDays: longestStreak,
    
    goals,
    yearlyBookProgress: Math.min(yearlyBookProgress, 1),
    yearlyHoursProgress: Math.min(yearlyHoursProgress, 1),
    monthlyHoursProgress: Math.min(monthlyHoursProgress, 1),
    
    personality,
  };
}

// Personality calculation inputs
interface PersonalityInputs {
  sessions: ReadingSession[];
  totalBooksStarted: number;
  totalBooksFinished: number;
  ebookTimeMinutes: number;
  audiobookTimeMinutes: number;
  bothTimeMinutes: number;
  byHourOfDay: { hour: number; totalMinutes: number; sessionCount: number }[];
  totalReadingTimeMinutes: number;
  currentStreakDays: number;
}

// Calculate reader personality based on behavior patterns
function calculatePersonality(inputs: PersonalityInputs): ReaderPersonalityResult {
  const {
    sessions,
    totalBooksStarted,
    totalBooksFinished,
    ebookTimeMinutes,
    audiobookTimeMinutes,
    bothTimeMinutes,
    byHourOfDay,
    totalReadingTimeMinutes,
    currentStreakDays,
  } = inputs;

  if (sessions.length === 0) {
    return {
      type: 'bookworm',
      name: 'Curious Reader',
      emoji: '📚',
      description: 'Start reading to discover your personality!',
    };
  }

  // Calculate metrics
  const avgSessionDuration = totalReadingTimeMinutes / sessions.length;
  const completionRate = totalBooksStarted > 0 ? totalBooksFinished / totalBooksStarted : 0;
  const totalFormatTime = ebookTimeMinutes + audiobookTimeMinutes + bothTimeMinutes;
  const audiobookRatio = totalFormatTime > 0 ? (audiobookTimeMinutes + bothTimeMinutes) / totalFormatTime : 0;
  const ebookRatio = totalFormatTime > 0 ? (ebookTimeMinutes + bothTimeMinutes) / totalFormatTime : 0;
  
  // Time of day analysis
  const morningMinutes = byHourOfDay.slice(5, 12).reduce((sum, h) => sum + h.totalMinutes, 0);
  const nightMinutes = byHourOfDay.slice(18, 24).reduce((sum, h) => sum + h.totalMinutes, 0) + 
                      byHourOfDay.slice(0, 5).reduce((sum, h) => sum + h.totalMinutes, 0);
  const totalTrackedMinutes = byHourOfDay.reduce((sum, h) => sum + h.totalMinutes, 0);
  const morningRatio = totalTrackedMinutes > 0 ? morningMinutes / totalTrackedMinutes : 0;
  const nightRatio = totalTrackedMinutes > 0 ? nightMinutes / totalTrackedMinutes : 0;

  // Score different personalities
  const scores: Record<ReaderPersonality, number> = {
    butterfly: 0,
    squirrel: 0,
    bookworm: 0,
    'night-owl': 0,
    'early-bird': 0,
    'audiobook-fanatic': 0,
    'genre-loyalist': 0,
    explorer: 0,
    'speed-reader': 0,
    'slow-steady': 0,
    marathoner: 0,
  };

  // Butterfly: Short sessions (< 15 min avg), many different books
  if (avgSessionDuration < 20) scores.butterfly += 3;
  if (avgSessionDuration < 30) scores.butterfly += 2;
  const uniqueBooks = new Set(sessions.map(s => s.bookId)).size;
  if (uniqueBooks > sessions.length * 0.7) scores.butterfly += 2;

  // Squirrel: Low completion rate, starts many books
  if (completionRate < 0.3 && totalBooksStarted > 5) scores.squirrel += 4;
  if (completionRate < 0.5) scores.squirrel += 2;
  if (totalBooksStarted > totalBooksFinished * 2) scores.squirrel += 2;

  // Bookworm: High completion, longer sessions
  if (completionRate > 0.7) scores.bookworm += 3;
  if (avgSessionDuration > 45) scores.bookworm += 2;
  if (totalReadingTimeMinutes > 1000) scores.bookworm += 2;

  // Night Owl: Reads mostly between 6PM-5AM
  if (nightRatio > 0.6) scores['night-owl'] += 4;
  if (nightRatio > 0.5) scores['night-owl'] += 2;

  // Early Bird: Reads mostly between 5AM-12PM
  if (morningRatio > 0.5) scores['early-bird'] += 4;
  if (morningRatio > 0.4) scores['early-bird'] += 2;

  // Audiobook Fanatic: Mostly audiobooks
  if (audiobookRatio > 0.8) scores['audiobook-fanatic'] += 4;
  if (audiobookRatio > 0.6) scores['audiobook-fanatic'] += 2;

  // Marathoner: Very long sessions (> 90 min avg)
  if (avgSessionDuration > 90) scores.marathoner += 4;
  if (avgSessionDuration > 60) scores.marathoner += 2;

  // Slow & Steady: Consistent daily reading with moderate sessions
  if (currentStreakDays >= 7 && avgSessionDuration < 45) scores['slow-steady'] += 3;
  if (currentStreakDays >= 14) scores['slow-steady'] += 2;
  if (avgSessionDuration >= 20 && avgSessionDuration <= 40) scores['slow-steady'] += 1;

  // Determine primary personality
  let primary: ReaderPersonality = 'bookworm';
  let maxScore = -1;
  
  for (const [type, score] of Object.entries(scores) as [ReaderPersonality, number][]) {
    if (score > maxScore) {
      maxScore = score;
      primary = type;
    }
  }

  // Personality definitions
  const personalities: Record<ReaderPersonality, Omit<ReaderPersonalityResult, 'type' | 'secondaryTrait'>> = {
    butterfly: {
      name: 'Social Butterfly',
      emoji: '🦋',
      description: 'You flutter between books, enjoying variety in short bursts.',
    },
    squirrel: {
      name: 'Curious Squirrel',
      emoji: '🐿️',
      description: 'You gather many books but don\'t always finish them. So many books, so little time!',
    },
    bookworm: {
      name: 'Dedicated Bookworm',
      emoji: '📚',
      description: 'You dive deep into books and see them through to the end.',
    },
    'night-owl': {
      name: 'Night Owl',
      emoji: '🦉',
      description: 'The night is when you truly come alive with a good book.',
    },
    'early-bird': {
      name: 'Early Bird',
      emoji: '🐦',
      description: 'You greet the day with pages and coffee.',
    },
    'audiobook-fanatic': {
      name: 'Audiobook Fanatic',
      emoji: '🎧',
      description: 'You prefer to listen your way through stories.',
    },
    'genre-loyalist': {
      name: 'Genre Loyalist',
      emoji: '🏷️',
      description: 'You know what you like and stick to it.',
    },
    explorer: {
      name: 'Literary Explorer',
      emoji: '🗺️',
      description: 'No genre is safe from your curiosity.',
    },
    'speed-reader': {
      name: 'Speed Reader',
      emoji: '⚡',
      description: 'You devour books at an impressive pace.',
    },
    'slow-steady': {
      name: 'Steady Reader',
      emoji: '🐢',
      description: 'Slow and steady wins the race. You read consistently every day.',
    },
    marathoner: {
      name: 'Reading Marathoner',
      emoji: '🏃',
      description: 'You settle in for long, immersive reading sessions.',
    },
  };

  // Find secondary trait (second highest score, at least half of primary)
  let secondary: ReaderPersonality | undefined;
  let secondMax = -1;
  
  for (const [type, score] of Object.entries(scores) as [ReaderPersonality, number][]) {
    if (type !== primary && score > secondMax && score >= maxScore * 0.5) {
      secondMax = score;
      secondary = type;
    }
  }

  return {
    type: primary,
    ...personalities[primary],
    secondaryTrait: secondary,
  };
}

// Format minutes as "Xh Ym" or "Xm"
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

// Get day name
export function getDayName(day: number): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[day];
}

// Get month name
export function getMonthName(month: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month];
}
