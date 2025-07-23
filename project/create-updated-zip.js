const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

// Create a file to stream archive data to
const output = fs.createWriteStream('voicescribe-audio-converter-updated.zip');
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level
});

// Listen for all archive data to be written
output.on('close', function() {
  console.log('✅ Updated ZIP file created successfully!');
  console.log('📦 Total bytes: ' + archive.pointer());
  console.log('📁 File: voicescribe-audio-converter-updated.zip');
});

// Handle warnings
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn('Warning:', err);
  } else {
    throw err;
  }
});

// Handle errors
archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add files to the archive
const filesToInclude = [
  'index.html',
  'vite.config.ts',
  'tailwind.config.js',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'postcss.config.js',
  'eslint.config.js',
  'README.md'
];

// Add root files
filesToInclude.forEach(file => {
  if (fs.existsSync(file)) {
    archive.file(file, { name: file });
    console.log(`📄 Added: ${file}`);
  }
});

// Add src directory
if (fs.existsSync('src')) {
  archive.directory('src/', 'src/');
  console.log('📁 Added: src/ directory');
}

// Create updated package.json with proper project info
const packageJson = {
  "name": "voicescribe-audio-converter",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "AI-powered audio to text converter with real-time speech recognition",
  "keywords": ["audio-to-text", "speech-recognition", "voice-transcription", "react", "typescript"],
  "author": "Yuvraj Singh",
  "license": "MIT",
  "homepage": "https://github.com/Yuvrajsy24/voicescribe-audio-converter#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Yuvrajsy24/voicescribe-audio-converter.git"
  },
  "bugs": {
    "url": "https://github.com/Yuvrajsy24/voicescribe-audio-converter/issues"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^0.344.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.9.1",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.18",
    "eslint": "^9.9.1",
    "eslint-plugin-react-hooks": "^5.1.0-rc.0",
    "eslint-plugin-react-refresh": "^0.4.11",
    "globals": "^15.9.0",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.5.3",
    "typescript-eslint": "^8.3.0",
    "vite": "^5.4.2"
  }
};

archive.append(JSON.stringify(packageJson, null, 2), { name: 'package.json' });
console.log('📄 Added: package.json');

// Add .gitignore
const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Production build
dist/
build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# Temporary folders
tmp/
temp/

# Zip files
*.zip
`;

archive.append(gitignoreContent, { name: '.gitignore' });
console.log('📄 Added: .gitignore');

// Add LICENSE
const licenseContent = `MIT License

Copyright (c) 2025 Yuvraj Singh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

archive.append(licenseContent, { name: 'LICENSE' });
console.log('📄 Added: LICENSE');

// Add installation and setup instructions
const setupInstructions = `# VoiceScribe Setup Instructions

## Quick Start

1. **Install Dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Start Development Server:**
   \`\`\`bash
   npm run dev
   \`\`\`

3. **Build for Production:**
   \`\`\`bash
   npm run build
   \`\`\`

## Browser Requirements

- Chrome (recommended)
- Edge
- Safari
- Firefox (limited support)

## Features

- Real-time speech recognition
- 10+ language support
- Audio file upload
- Export to text file
- Copy to clipboard
- Beautiful responsive UI

## Deployment

The app can be deployed to any static hosting service:
- Netlify
- Vercel
- GitHub Pages
- Firebase Hosting

## Support

For issues or questions, please visit:
https://github.com/Yuvrajsy24/voicescribe-audio-converter/issues
`;

archive.append(setupInstructions, { name: 'SETUP.md' });
console.log('📄 Added: SETUP.md');

// Finalize the archive
archive.finalize();