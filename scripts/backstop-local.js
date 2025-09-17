#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BACKSTOP_CONFIG_PATH = path.join(__dirname, '..', 'backstop.json');
const BACKUP_CONFIG_PATH = path.join(__dirname, '..', 'backstop.json.backup');
const COOKIES_PATH = path.join(__dirname, '..', 'backstop_data', 'engine_scripts', 'cookies.json');
const BACKUP_COOKIES_PATH = path.join(__dirname, '..', 'backstop_data', 'engine_scripts', 'cookies.json.backup');

function showHelp() {
  console.log(`
Usage: node scripts/backstop-local.js [command] [options]

Commands:
  reference  Generate reference images
  test       Run visual regression tests (default)
  approve    Approve current test results
  report     Open the HTML report

Options:
  --url <pattern>        Replace 'stage--' with this pattern in URLs
  --ref <pattern>        Replace 'main--' with this pattern in referenceUrls
  --help                 Show this help message

Examples:
  # Compare local branch against main
  node scripts/backstop-local.js test --url "my-branch--" --ref "main--"
  
  # Generate references using a specific branch
  node scripts/backstop-local.js reference --url "my-branch--" --ref "production--"
  
  # Use default stage/main comparison
  node scripts/backstop-local.js test
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    command: 'test',
    urlPattern: null,
    refPattern: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help') {
      showHelp();
      process.exit(0);
    }

    if (arg === '--url' && i + 1 < args.length) {
      config.urlPattern = args[i + 1];
      i++;
      continue;
    }

    if (arg === '--ref' && i + 1 < args.length) {
      config.refPattern = args[i + 1];
      i++;
      continue;
    }

    if (!arg.startsWith('--')) {
      if (['reference', 'test', 'approve', 'report'].includes(arg)) {
        config.command = arg;
      }
    }
  }

  return config;
}

function backupConfig() {
  try {
    fs.copyFileSync(BACKSTOP_CONFIG_PATH, BACKUP_CONFIG_PATH);
    console.log('✓ Backed up backstop.json');

    if (fs.existsSync(COOKIES_PATH)) {
      fs.copyFileSync(COOKIES_PATH, BACKUP_COOKIES_PATH);
      console.log('✓ Backed up cookies.json');
    }

    return true;
  } catch (error) {
    console.error('✗ Failed to backup configuration files:', error.message);
    return false;
  }
}

function restoreConfig() {
  try {
    if (fs.existsSync(BACKUP_CONFIG_PATH)) {
      fs.copyFileSync(BACKUP_CONFIG_PATH, BACKSTOP_CONFIG_PATH);
      fs.unlinkSync(BACKUP_CONFIG_PATH);
      console.log('✓ Restored original backstop.json');
    }

    if (fs.existsSync(BACKUP_COOKIES_PATH)) {
      fs.copyFileSync(BACKUP_COOKIES_PATH, COOKIES_PATH);
      fs.unlinkSync(BACKUP_COOKIES_PATH);
      console.log('✓ Restored original cookies.json');
    }
  } catch (error) {
    console.error('✗ Failed to restore configuration files:', error.message);
  }
}

function updateCookies(urlPattern, refPattern) {
  try {
    if (!fs.existsSync(COOKIES_PATH)) {
      console.log('ℹ No cookies.json file found, skipping cookie updates');
      return true;
    }

    const cookiesContent = fs.readFileSync(COOKIES_PATH, 'utf8');
    const cookies = JSON.parse(cookiesContent);

    let modified = false;

    // Update cookie domains
    if (cookies.cookies) {
      cookies.cookies.forEach((cookie) => {
        if (urlPattern && cookie.domain && cookie.domain.includes('stage--')) {
          const newDomain = cookie.domain.replace(/stage--/g, urlPattern);
          if (newDomain !== cookie.domain) {
            console.log(`  Cookie domain: ${cookie.domain} → ${newDomain}`);
            cookie.domain = newDomain;
            modified = true;
          }
        }

        if (refPattern && cookie.domain && cookie.domain.includes('main--')) {
          const newDomain = cookie.domain.replace(/main--/g, refPattern);
          if (newDomain !== cookie.domain) {
            console.log(`  Cookie domain: ${cookie.domain} → ${newDomain}`);
            cookie.domain = newDomain;
            modified = true;
          }
        }
      });
    }

    // Update localStorage origins
    if (cookies.origins) {
      cookies.origins.forEach((origin) => {
        if (urlPattern && origin.origin && origin.origin.includes('stage--')) {
          const newOrigin = origin.origin.replace(/stage--/g, urlPattern);
          if (newOrigin !== origin.origin) {
            console.log(`  localStorage origin: ${origin.origin} → ${newOrigin}`);
            origin.origin = newOrigin;
            modified = true;
          }
        }

        if (refPattern && origin.origin && origin.origin.includes('main--')) {
          const newOrigin = origin.origin.replace(/main--/g, refPattern);
          if (newOrigin !== origin.origin) {
            console.log(`  localStorage origin: ${origin.origin} → ${newOrigin}`);
            origin.origin = newOrigin;
            modified = true;
          }
        }
      });
    }

    if (modified) {
      fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
      console.log('✓ Updated cookies.json with new URLs');
    }

    return true;
  } catch (error) {
    console.error('✗ Failed to update cookies.json:', error.message);
    return false;
  }
}

function updateConfig(urlPattern, refPattern) {
  try {
    const configContent = fs.readFileSync(BACKSTOP_CONFIG_PATH, 'utf8');
    const config = JSON.parse(configContent);

    let modified = false;

    config.scenarios.forEach((scenario) => {
      if (urlPattern && scenario.url) {
        const newUrl = scenario.url.replace(/stage--/g, urlPattern);
        if (newUrl !== scenario.url) {
          console.log(`  URL: ${scenario.url} → ${newUrl}`);
          scenario.url = newUrl;
          modified = true;
        }
      }

      if (refPattern && scenario.referenceUrl) {
        const newRefUrl = scenario.referenceUrl.replace(/main--/g, refPattern);
        if (newRefUrl !== scenario.referenceUrl) {
          console.log(`  Ref: ${scenario.referenceUrl} → ${newRefUrl}`);
          scenario.referenceUrl = newRefUrl;
          modified = true;
        }
      }
    });

    if (modified) {
      fs.writeFileSync(BACKSTOP_CONFIG_PATH, JSON.stringify(config, null, 2));
      console.log('✓ Updated backstop.json with new URLs');
    } else {
      console.log('ℹ No backstop.json URL replacements needed');
    }

    // Also update cookies.json
    if (!updateCookies(urlPattern, refPattern)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('✗ Failed to update backstop.json:', error.message);
    return false;
  }
}

function runBackstop(command) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running backstop ${command}...`);

    const backstopProcess = spawn('npx', ['backstop', command], {
      stdio: 'inherit',
      shell: true,
    });

    backstopProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Backstop ${command} completed successfully`);
        resolve(code);
      } else {
        console.error(`✗ Backstop ${command} failed with exit code ${code}`);
        resolve(code); // Don't reject, just return the exit code
      }
    });

    backstopProcess.on('error', (error) => {
      console.error(`✗ Failed to run backstop ${command}:`, error.message);
      reject(error);
    });
  });
}

async function main() {
  const config = parseArgs();

  console.log('🎭 Backstop Local Runner');
  console.log(`Command: ${config.command}`);

  if (config.urlPattern) {
    console.log(`URL pattern: stage-- → ${config.urlPattern}`);
  }

  if (config.refPattern) {
    console.log(`Reference pattern: main-- → ${config.refPattern}`);
  }

  // Setup cleanup handler
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Interrupted! Cleaning up...');
    restoreConfig();
    process.exit(130);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n🛑 Terminated! Cleaning up...');
    restoreConfig();
    process.exit(143);
  });

  let exitCode = 0;

  try {
    // Only backup and modify if we have patterns to replace
    if (config.urlPattern || config.refPattern) {
      if (!backupConfig()) {
        process.exit(1);
      }

      console.log('\n📝 Updating configuration...');
      if (!updateConfig(config.urlPattern, config.refPattern)) {
        restoreConfig();
        process.exit(1);
      }
    }

    // Run backstop command
    exitCode = await runBackstop(config.command);
  } catch (error) {
    console.error('✗ Unexpected error:', error.message);
    exitCode = 1;
  } finally {
    // Always restore the original config
    if (config.urlPattern || config.refPattern) {
      console.log('\n🔄 Cleaning up...');
      restoreConfig();
    }

    console.log('\n✨ Done!');
    process.exit(exitCode);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  restoreConfig();
  process.exit(1);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  restoreConfig();
  process.exit(1);
});
