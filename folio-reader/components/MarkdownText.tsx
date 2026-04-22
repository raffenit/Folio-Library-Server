import React from 'react';
import { Text, View, Linking, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Typography, Spacing } from '@/constants/theme';

interface MarkdownTextProps {
  content: string;
  style?: any;
  numberOfLines?: number;
}

/**
 * Simple Markdown renderer for React Native
 * Supports: bold (**text**), italic (*text*), headers (# ## ###), links [text](url), lists (- item)
 */
export function MarkdownText({ content, style, numberOfLines }: MarkdownTextProps) {
  const { colors } = useTheme();

  if (!content) return null;

  // Split content into lines for processing
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      elements.push(<View key={key++} style={{ height: Spacing.sm }} />);
      continue;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <Text key={key++} style={[styles.h3, { color: colors.textPrimary }]}>
          {renderInlineMarkdown(trimmed.slice(4), colors, key++)}
        </Text>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <Text key={key++} style={[styles.h2, { color: colors.textPrimary }]}>
          {renderInlineMarkdown(trimmed.slice(3), colors, key++)}
        </Text>
      );
    } else if (trimmed.startsWith('# ')) {
      elements.push(
        <Text key={key++} style={[styles.h1, { color: colors.textPrimary }]}>
          {renderInlineMarkdown(trimmed.slice(2), colors, key++)}
        </Text>
      );
    }
    // List items
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <View key={key++} style={styles.listItem}>
          <Text style={[styles.bullet, { color: colors.textSecondary }]}>•</Text>
          <Text style={[styles.listText, { color: colors.textPrimary }]}>
            {renderInlineMarkdown(trimmed.slice(2), colors, key++)}
          </Text>
        </View>
      );
    }
    // Numbered list
    else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s/);
      const num = match ? match[1] : '1';
      elements.push(
        <View key={key++} style={styles.listItem}>
          <Text style={[styles.bullet, { color: colors.textSecondary }]}>{num}.</Text>
          <Text style={[styles.listText, { color: colors.textPrimary }]}>
            {renderInlineMarkdown(trimmed.slice((num + '. ').length), colors, key++)}
          </Text>
        </View>
      );
    }
    // Regular paragraph
    else {
      elements.push(
        <Text key={key++} style={[styles.paragraph, { color: colors.textPrimary }, style]} numberOfLines={numberOfLines}>
          {renderInlineMarkdown(trimmed, colors, key++)}
        </Text>
      );
    }
  }

  return <View style={styles.container}>{elements}</View>;
}

/**
 * Render inline markdown elements (bold, italic, links, code)
 */
function renderInlineMarkdown(text: string, colors: any, baseKey: number): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = baseKey;

  // Regex patterns for inline elements
  const patterns = [
    { regex: /\*\*(.+?)\*\*/g, type: 'bold' },
    { regex: /__(.+?)__/g, type: 'bold' },
    { regex: /\*(.+?)\*/g, type: 'italic' },
    { regex: /_(.+?)_/g, type: 'italic' },
    { regex: /`(.+?)`/g, type: 'code' },
    { regex: /\[(.+?)\]\((.+?)\)/g, type: 'link' },
  ];

  while (remaining.length > 0) {
    let earliestMatch: { index: number; length: number; content: string; url?: string; type: string } | null = null;

    for (const pattern of patterns) {
      const match = pattern.regex.exec(remaining);
      if (match && (earliestMatch === null || match.index < earliestMatch.index)) {
        earliestMatch = {
          index: match.index,
          length: match[0].length,
          content: match[1],
          url: match[2],
          type: pattern.type,
        };
      }
      pattern.regex.lastIndex = 0; // Reset regex
    }

    if (earliestMatch === null) {
      // No more matches, add remaining as plain text
      elements.push(
        <Text key={key++} style={{ color: colors.textPrimary }}>
          {remaining}
        </Text>
      );
      break;
    }

    // Add text before the match
    if (earliestMatch.index > 0) {
      elements.push(
        <Text key={key++} style={{ color: colors.textPrimary }}>
          {remaining.slice(0, earliestMatch.index)}
        </Text>
      );
    }

    // Add the matched element
    switch (earliestMatch.type) {
      case 'bold':
        elements.push(
          <Text key={key++} style={[styles.bold, { color: colors.textPrimary }]}>
            {earliestMatch.content}
          </Text>
        );
        break;
      case 'italic':
        elements.push(
          <Text key={key++} style={[styles.italic, { color: colors.textPrimary }]}>
            {earliestMatch.content}
          </Text>
        );
        break;
      case 'code':
        elements.push(
          <Text
            key={key++}
            style={[
              styles.code,
              {
                color: colors.accent,
                backgroundColor: colors.surface,
              },
            ]}
          >
            {earliestMatch.content}
          </Text>
        );
        break;
      case 'link':
        elements.push(
          <Text
            key={key++}
            style={[styles.link, { color: colors.accent }]}
            onPress={() => {
              if (earliestMatch.url) {
                Linking.openURL(earliestMatch.url).catch(() => {
                  // Ignore errors
                });
              }
            }}
          >
            {earliestMatch.content}
          </Text>
        );
        break;
    }

    remaining = remaining.slice(earliestMatch.index + earliestMatch.length);
  }

  return elements;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  paragraph: {
    fontSize: Typography.base,
    lineHeight: 22,
    marginVertical: Spacing.xs,
  },
  h1: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  h2: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  h3: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  bold: {
    fontWeight: Typography.bold,
  },
  italic: {
    fontStyle: 'italic',
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: Typography.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  link: {
    textDecorationLine: 'underline',
  },
  listItem: {
    flexDirection: 'row',
    marginVertical: Spacing.xs,
    paddingLeft: Spacing.sm,
  },
  bullet: {
    width: 20,
    fontSize: Typography.base,
  },
  listText: {
    fontSize: Typography.base,
    flex: 1,
    lineHeight: 22,
  },
});
