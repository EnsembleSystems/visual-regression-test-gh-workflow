/**
 * BackstopJS Playwright Script for Image Loading and Screenshot Preparation
 * 
 * This script ensures all images are loaded before taking screenshots by:
 * 1. Scrolling through the entire page to trigger lazy loading
 * 2. Forcing all images to load immediately
 * 3. Handling special components (roll-cards, threats-card)
 * 4. Scrolling back to top for proper navigation positioning
 */

module.exports = async (page, scenario, vp) => {
  console.log('Starting image loading process...');
  
  // Configuration
  const CONFIG = {
    INITIAL_TIMEOUT: 10000,
    FINAL_TIMEOUT: 30000,
    SCROLL_STEP: 400,
    SCROLL_DELAY: 300,
    IMAGE_TIMEOUT: 3000,
    FINAL_WAIT: 1000
  };
  
  // Wait for initial page load
  await waitForInitialLoad(page, CONFIG.INITIAL_TIMEOUT);
  
  // Execute the main image loading process
  await page.evaluate(async (config) => {
    // All browser context functions defined here
    
    /**
     * Simple sleep utility
     */
    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Force load a single image
     */
    function forceLoadSingleImage(img) {
      // Set loading to eager
      img.loading = 'eager';
      
      // Handle data-src attributes
      if (img.dataset.src && !img.src) {
        img.src = img.dataset.src;
      }
      
      // Force reload existing src to trigger loading
      if (img.src) {
        const currentSrc = img.src;
        img.src = '';
        img.src = currentSrc;
      }
    }

    /**
     * Wait for a single image to load with timeout
     */
    function waitForImageLoad(img, timeout) {
      // Skip if already loaded
      if (img.complete && img.naturalWidth > 0) {
        return Promise.resolve();
      }
      
      return new Promise(resolve => {
        const timeoutId = setTimeout(() => {
          console.warn('Image load timeout:', img.src || 'no src');
          resolve();
        }, timeout);
        
        const cleanup = () => {
          clearTimeout(timeoutId);
          resolve();
        };
        
        img.onload = cleanup;
        img.onerror = cleanup;
      });
    }

    /**
     * Handle roll-cards carousel component
     */
    function handleRollCards() {
      document.querySelectorAll('.roll-card').forEach(card => {
        // Make all cards visible and active
        card.style.visibility = 'visible';
        card.style.opacity = '1';
        card.classList.add('active');
      });
    }

    /**
     * Handle threats-card component
     */
    function handleThreatsCards() {
      document.querySelectorAll('.threat-card-item-image').forEach(container => {
        // Make image containers visible
        container.style.visibility = 'visible';
        container.style.opacity = '1';
      });
    }

    /**
     * Handle special components that need specific treatment
     */
    function handleSpecialComponents() {
      console.log('Handling special components...');
      
      handleRollCards();
      handleThreatsCards();
    }

    /**
     * Scroll through entire page to trigger lazy loading
     */
    async function scrollThroughPage(config) {
      console.log('Scrolling through page...');
      
      let currentScroll = 0;
      const totalHeight = document.body.scrollHeight;
      
      while (currentScroll < totalHeight) {
        window.scrollTo(0, currentScroll);
        await sleep(config.SCROLL_DELAY);
        
        // Force load images in current viewport during scroll
        const images = document.querySelectorAll('img');
        images.forEach(forceLoadSingleImage);
        
        currentScroll += config.SCROLL_STEP;
      }
      
      // Scroll to bottom
      window.scrollTo(0, totalHeight);
      await sleep(config.SCROLL_DELAY);
    }

    /**
     * Force load all images on the page
     */
    async function forceLoadAllImages(imageTimeout) {
      console.log('Force loading all images...');
      
      const allImages = document.querySelectorAll('img');
      allImages.forEach(forceLoadSingleImage);
      
      // Wait for all images to actually load
      console.log('Waiting for images to load...');
      const imagePromises = Array.from(allImages).map(img => 
        waitForImageLoad(img, imageTimeout)
      );
      
      await Promise.all(imagePromises);
      console.log('All images loaded');
    }

    /**
     * Scroll back to the top of the page
     */
    function scrollToTop() {
      console.log('Scrolling to top...');
      window.scrollTo(0, 0);
    }

    /**
     * Main image loading function - runs in browser context
     */
    async function loadAllImages(config) {
      // 1. Scroll through page to trigger lazy loading
      await scrollThroughPage(config);
      
      // 2. Handle special components
      handleSpecialComponents();
      
      // 3. Force load all images
      await forceLoadAllImages(config.IMAGE_TIMEOUT);
      
      // 4. Scroll back to top
      scrollToTop();
    }
    
    // Execute the main function
    await loadAllImages(config);
  }, CONFIG);
  
  // Final cleanup and preparation
  await finalizeForScreenshot(page, CONFIG.FINAL_TIMEOUT, CONFIG.FINAL_WAIT);
  
  console.log('Ready for screenshot');
};

/**
 * Wait for initial page load and network idle
 */
async function waitForInitialLoad(page, timeout) {
  console.log('Waiting for initial page load...');
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Final network idle check and preparation for screenshot
 */
async function finalizeForScreenshot(page, timeout, finalWait) {
  console.log('Final preparation for screenshot...');
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForTimeout(finalWait);
}

