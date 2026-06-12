#!/usr/bin/env node
/**
 * Advanced JSX Validation Script
 * Detects unbalanced tags, missing closing tags, and JSX structure issues
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function logError(file, line, message) {
  console.log(`${colors.red}ERROR${colors.reset} ${file}:${line} - ${message}`);
  return 1;
}

function logWarning(file, line, message) {
  console.log(`${colors.yellow}WARN${colors.reset} ${file}:${line} - ${message}`);
  return 1;
}

function logInfo(message) {
  console.log(`${colors.blue}INFO${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

/**
 * Check if a tag is self-closing
 */
function isSelfClosingTag(tag) {
  const selfClosingTags = [
    'ActivityIndicator', 'Image', 'TextInput', 'RefreshControl',
    'Ionicons', 'Animated.View', 'Animated.Text', 'Animated.ScrollView'
  ];
  return selfClosingTags.includes(tag);
}

/**
 * Extract tag name from opening tag
 */
function extractTagName(tagStr) {
  const match = tagStr.match(/<(\w+(?:\.\w+)?)/);
  return match ? match[1] : null;
}

/**
 * Validate JSX structure in a file
 */
function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileName = path.basename(filePath);
  
  let errors = 0;
  const tagStack = [];
  const commonTags = ['View', 'Text', 'ScrollView', 'TouchableOpacity', 'FlatList', 
                      'SectionList', 'Image', 'TextInput', 'ActivityIndicator',
                      'Animated.View', 'Animated.Text'];
  
  // Track line-by-line tag positions
  const lineTagPositions = lines.map((line, idx) => ({
    line: idx + 1,
    content: line,
    tags: []
  }));
  
  // Find all opening and closing tags
  const tagPattern = /<(\w+(?:\.\w+)?)[^>]*>/g;
  const closeTagPattern = /<\/(\w+(?:\.\w+)?)>/g;
  const selfClosePattern = /<(\w+(?:\.\w+)?)[^>]*\/>/g;
  
  // Build a map of line numbers to tags
  let match;
  
  // Find opening tags
  while ((match = tagPattern.exec(content)) !== null) {
    const tag = match[1];
    const pos = match.index;
    const lineNum = content.substring(0, pos).split('\n').length;
    
    if (!isSelfClosingTag(tag) && commonTags.includes(tag)) {
      lineTagPositions[lineNum - 1].tags.push({ type: 'open', tag, pos });
    }
  }
  
  // Reset regex
  tagPattern.lastIndex = 0;
  
  // Find self-closing tags
  while ((match = selfClosePattern.exec(content)) !== null) {
    const tag = match[1];
    const pos = match.index;
    const lineNum = content.substring(0, pos).split('\n').length;
    
    if (commonTags.includes(tag)) {
      lineTagPositions[lineNum - 1].tags.push({ type: 'self-close', tag, pos });
    }
  }
  
  // Find closing tags
  while ((match = closeTagPattern.exec(content)) !== null) {
    const tag = match[1];
    const pos = match.index;
    const lineNum = content.substring(0, pos).split('\n').length;
    
    if (commonTags.includes(tag)) {
      lineTagPositions[lineNum - 1].tags.push({ type: 'close', tag, pos });
    }
  }
  
  // Process line by line to track tag stack
  for (const lineInfo of lineTagPositions) {
    // Sort tags by position in line
    lineInfo.tags.sort((a, b) => a.pos - b.pos);
    
    for (const tagInfo of lineInfo.tags) {
      if (tagInfo.type === 'open') {
        tagStack.push({ tag: tagInfo.tag, line: lineInfo.line });
      } else if (tagInfo.type === 'close') {
        if (tagStack.length === 0) {
          errors += logError(fileName, lineInfo.line, `Unexpected closing </${tagInfo.tag}> - no matching opening tag`);
        } else {
          const lastTag = tagStack.pop();
          if (lastTag.tag !== tagInfo.tag) {
            errors += logError(fileName, lineInfo.line, 
              `Mismatched tags: expected </${lastTag.tag}> (opened at line ${lastTag.line}), found </${tagInfo.tag}>`);
          }
        }
      }
      // self-close tags don't affect stack
    }
  }
  
  // Check for unclosed tags at end of file
  if (tagStack.length > 0) {
    for (const unclosed of tagStack) {
      errors += logError(fileName, unclosed.line, `Unclosed <${unclosed.tag}> tag - missing closing </${unclosed.tag}>`);
    }
  }
  
  // Additional checks for common patterns
  
  // Check for JSX fragments with only one child (unnecessary)
  const fragmentPattern = /<>\s*<(\w+)[^>]*>.*?<\/\1>\s*<\/>/gs;
  while ((match = fragmentPattern.exec(content)) !== null) {
    const pos = match.index;
    const lineNum = content.substring(0, pos).split('\n').length;
    // This is just informational, not an error
  }
  
  // Check for potential adjacent JSX elements at root level within expressions
  const expressionPattern = /\(\s*<(View|Text|ScrollView|TouchableOpacity)/g;
  let openCount = 0;
  let closeCount = 0;
  
  // Count all View tags
  const viewOpenPattern = /<View[^>]*>/g;
  const viewClosePattern = /<\/View>/g;
  const viewSelfClosePattern = /<View[^>]*\/>/g;
  
  while (viewOpenPattern.exec(content)) openCount++;
  while (viewClosePattern.exec(content)) closeCount++;
  while (viewSelfClosePattern.exec(content)) openCount--; // Self-closing counts as both
  
  if (openCount !== closeCount) {
    errors += logError(fileName, '?', `View tag mismatch: ${openCount} opening, ${closeCount} closing (diff: ${openCount - closeCount})`);
  }
  
  return errors;
}

// Main execution
console.log('🔍 Running Advanced JSX Validation...\n');

const files = glob.sync('app/**/*.tsx', { cwd: path.join(__dirname, '..') });

if (files.length === 0) {
  console.log(`${colors.yellow}Warning: No TSX files found${colors.reset}`);
  process.exit(0);
}

let totalErrors = 0;

for (const file of files) {
  const fullPath = path.join(__dirname, '..', file);
  const errors = validateFile(fullPath);
  totalErrors += errors;
  
  if (errors > 0) {
    console.log(''); // Empty line between files with errors
  }
}

console.log('');

if (totalErrors === 0) {
  logSuccess(`Validated ${files.length} files - no structural issues detected`);
  console.log(`${colors.green}All JSX tags are properly balanced${colors.reset}`);
  process.exit(0);
} else {
  console.log(`${colors.red}Found ${totalErrors} JSX structural issues${colors.reset}`);
  console.log(`${colors.yellow}Fix these errors before building${colors.reset}`);
  process.exit(1);
}
