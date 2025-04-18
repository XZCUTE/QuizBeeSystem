const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// This script assumes you have Inkscape installed
// If not, you'll need to install it or use another SVG to PNG converter

const sizes = [
  16, 32, 57, 60, 72, 76, 96, 114, 120, 144, 152, 180, 192, 512
];

const sourceSvg = path.join(__dirname, 'src/assets/favicon.svg');
const outputDir = path.join(__dirname, 'public');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Generating favicons from SVG...');

// Generate PNGs for each size
sizes.forEach(size => {
  const outputPath = path.join(outputDir, `favicon-${size}x${size}.png`);
  
  try {
    // Using ImageMagick's convert command (alternative to Inkscape)
    // Make sure you have ImageMagick installed
    execSync(`convert -background none -size ${size}x${size} "${sourceSvg}" "${outputPath}"`);
    console.log(`Generated: favicon-${size}x${size}.png`);
  } catch (error) {
    console.error(`Error generating favicon-${size}x${size}.png:`, error.message);
  }
});

// Generate .ico file
try {
  execSync(`convert -background none "${sourceSvg}" -define icon:auto-resize=16,32,48,64 "${path.join(outputDir, 'favicon.ico')}"`);
  console.log('Generated: favicon.ico');
} catch (error) {
  console.error('Error generating favicon.ico:', error.message);
}

console.log('Favicon generation complete!'); 