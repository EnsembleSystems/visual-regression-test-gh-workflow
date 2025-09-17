#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const https = require('https');
const http = require('http');

/**
 * Validates if a URL returns a 200 status code
 * @param {string} url - The URL to validate
 * @returns {Promise<boolean>} - True if URL returns 200, false otherwise
 */
function validateUrl(url) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;

      const options = {
        method: 'HEAD',
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        timeout: 10000, // 10 second timeout
      };

      const req = client.request(options, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    } catch (error) {
      // Invalid URL format
      console.log(`Invalid URL format: ${url}`);
      resolve(false);
    }
  });
}

/**
 * Parses PR body for before/after URL pairs and updates backstop.json
 * Expected format in PR body:
 * - Before: https://example.com/before-url
 * - After: https://example.com/after-url
 */

async function parsePRBody(prBody) {
  if (!prBody) {
    console.log('No PR body provided');
    return [];
  }

  const potentialPairs = [];
  const lines = prBody.split('\n').map((line) => line.trim());

  let currentBefore = null;
  let currentAfter = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for "Before:" patterns with various bullet points and prefixes
    const beforeMatch = line.match(/^[\*\-•\s]*[Bb]efore:\s*(.+)$/);
    if (beforeMatch) {
      currentBefore = beforeMatch[1].trim();
      continue;
    }

    // Look for "After:" patterns with various bullet points and prefixes
    const afterMatch = line.match(/^[\*\-•\s]*[Aa]fter:\s*(.+)$/);
    if (afterMatch) {
      currentAfter = afterMatch[1].trim();

      // If we have both before and after, add to potential pairs for validation
      if (currentBefore && currentAfter) {
        potentialPairs.push({
          before: currentBefore,
          after: currentAfter,
        });

        console.log(`Found potential URL pair: ${currentBefore} -> ${currentAfter}`);

        // Reset for next pair
        currentBefore = null;
        currentAfter = null;
      }
    }
  }

  // Validate all potential pairs
  const urlPairs = [];
  console.log(`Validating ${potentialPairs.length} URL pairs...`);

  for (const pair of potentialPairs) {
    console.log(`Validating: ${pair.before} -> ${pair.after}`);

    const [beforeValid, afterValid] = await Promise.all([validateUrl(pair.before), validateUrl(pair.after)]);

    if (beforeValid && afterValid) {
      urlPairs.push(pair);
      console.log(`✅ Valid URL pair: ${pair.before} -> ${pair.after}`);
    } else {
      console.log(
        `❌ Invalid URL pair (before: ${beforeValid ? '✅' : '❌'}, after: ${afterValid ? '✅' : '❌'}): ${pair.before} -> ${pair.after}`
      );
    }
  }

  // Handle case where After comes before Before (less common but possible)
  if (currentBefore && !currentAfter) {
    console.log(`Warning: Found "Before" URL without matching "After": ${currentBefore}`);
  }
  if (currentAfter && !currentBefore) {
    console.log(`Warning: Found "After" URL without matching "Before": ${currentAfter}`);
  }

  return urlPairs;
}

function updateBackstopConfig(urlPairs, backstopPath = 'backstop.json') {
  if (!fs.existsSync(backstopPath)) {
    console.error(`Backstop config file not found: ${backstopPath}`);
    process.exit(1);
  }

  const backstopConfig = JSON.parse(fs.readFileSync(backstopPath, 'utf8'));

  if (!backstopConfig.scenarios) {
    backstopConfig.scenarios = [];
  }

  // Add new scenarios for each URL pair
  urlPairs.forEach((pair, index) => {
    const scenario = {
      label: `Additional test page (${index + 1})`,
      url: pair.after,
      referenceUrl: pair.before,
      hideSelectors: ['.cookie-banner', '.loading-spinner', '[data-testid="timestamp"]', '.logo-garden'],
      removeSelectors: ['.advertisement', '.chat-widget'],
      misMatchThreshold: 0.1,
    };

    backstopConfig.scenarios.push(scenario);
    console.log(`Added scenario: ${scenario.label}`);
  });

  // Write updated config
  fs.writeFileSync(backstopPath, JSON.stringify(backstopConfig, null, 2));
  console.log(`Updated ${backstopPath} with ${urlPairs.length} additional scenarios`);

  return backstopConfig;
}

async function main() {
  const args = process.argv.slice(2);
  const prBody = process.env.PR_BODY || args[0];
  const backstopPath = process.env.BACKSTOP_PATH || args[1] || 'backstop.json';

  if (!prBody) {
    console.log('No PR body provided. Usage: node parse-pr-urls.js "<pr-body>" [backstop-path]');
    console.log('Or set PR_BODY environment variable');
    process.exit(0);
  }

  console.log('Parsing PR body for URL pairs...');
  const urlPairs = await parsePRBody(prBody);

  if (urlPairs.length === 0) {
    console.log('No valid URL pairs found in PR body');
    process.exit(0);
  }

  console.log(`Found ${urlPairs.length} valid URL pairs`);
  updateBackstopConfig(urlPairs, backstopPath);

  console.log('✅ Successfully updated backstop configuration');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

module.exports = { parsePRBody, updateBackstopConfig };
