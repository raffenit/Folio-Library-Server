#!/usr/bin/env node
/**
 * Simple JSX validation script
 * Checks for common JSX structural issues without full compilation
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

let hasErrors = false;

function logError(file, line, message) {
  hasErrors = true;
  console.log(`${colors.red}ERROR${colors.reset} ${file}:${line} - ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileName = path.basename(filePath);
  
  let errors = 0;
  
  // Check 1: Adjacent JSX elements at root level (common pattern failure)
  // Look for patterns where JSX elements appear after closing tags without proper nesting
  
  // Check 2: Count opening and closing tags for common React Native components
  const tagCounts = {};
  const tagPattern = /<(View|Text|ScrollView|TouchableOpacity|FlatList|SectionList|Image)([^>]*)>/g;
  const closeTagPattern = /<\/(View|Text|ScrollView|TouchableOpacity|FlatList|SectionList|Image)>/g;
  const selfClosePattern = /<(View|Text|ScrollView|TouchableOpacity|FlatList|SectionList|Image)([^>]*?)\/>/g;
  
  let match;
  while ((match = tagPattern.exec(content)) !== null) {
    const tag = match[1];
    const isSelfClosing = match[0].endsWith('/>');
    if (!isSelfClosing) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  
  while ((match = closeTagPattern.exec(content)) !== null) {
    const tag = match[1];
    tagCounts[tag] = (tagCounts[tag] || 0) - 1;
  }
  
  // Check for mismatched tags
  Object.entries(tagCounts).forEach(([tag, count]) => {
    if (count !== 0) {
      logError(fileName, '?', `Mismatched <${tag}> tags (diff: ${count})`);
      errors++;
    }
  });
  
  // Check 3: Look for common JSX antipatterns
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Detect multiple JSX elements on same line without parent (rough heuristic)
    if (line.match(/<\w+[^>]*>.*<\/\w+>.*<\w+/) && !line.includes('<>') && !line.includes('</>')) {
      // This is a rough check - might have false positives
      // logError(fileName, lineNum, `Potential adjacent JSX elements (heuristic)`);
    }
  });
  
  return errors;
}

console.log('🔍 Validating JSX structure...\n');

// Find all TSX files
const files = glob.sync('app/**/*.tsx', { cwd: path.join(__dirname, '..') });

if (files.length === 0) {
  console.log(`${colors.yellow}Warning: No TSX files found${colors.reset}`);
  process.exit(0);
}

let totalErrors = 0;

files.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  const errors = validateFile(fullPath);
  totalErrors += errors;
});

console.log('');

if (totalErrors === 0) {
  logSuccess(`Validated ${files.length} files - no structural issues detected`);
  console.log(`${colors.green}Note: This is a basic check. Run 'npm run validate:types' for full TypeScript validation.${colors.reset}`);
  process.exit(0);
} else {
  console.log(`${colors.red}Found ${totalErrors} potential issues${colors.reset}`);
  console.log(`${colors.yellow}Run 'npm run validate:types' for detailed error messages${colors.reset}`);
  process.exit(1);
}
