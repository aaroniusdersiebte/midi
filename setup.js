// setup.js - Final setup script without loops
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🎵 MIDI Controller Final Setup');
console.log('===============================\n');

const isWindows = process.platform === 'win32';
const buildPath = path.join(__dirname, 'build', 'Release', 'audio_controller.node');

async function main() {
    try {
        console.log('📋 Step 1: Checking current status...');
        console.log(`Platform: ${process.platform}`);
        console.log(`Node.js: ${process.version}`);
        console.log(`Directory: ${__dirname}`);
        
        // Check if native module already exists
        if (fs.existsSync(buildPath)) {
            console.log('✅ Native module already exists:', buildPath);
            try {
                const testModule = require(buildPath);
                if (testModule.AudioController) {
                    console.log('✅ Native module works correctly!');
                    console.log('\n🎉 Setup already complete!');
                    console.log('Run: npm start');
                    process.exit(0);
                }
            } catch (error) {
                console.log('⚠️  Module exists but not working, rebuilding...');
            }
        }
        
        if (!isWindows) {
            console.log('\n⚠️  Windows-only native audio module');
            console.log('✅ App will run in mock mode on this platform');
            console.log('\n🎉 Setup complete (Mock mode)');
            console.log('Run: npm start');
            process.exit(0);
        }
        
        console.log('\n📋 Step 2: Checking build requirements...');
        
        // Check Python
        try {
            const pythonVersion = execSync('python --version 2>&1', { encoding: 'utf8' });
            console.log(`✅ Python: ${pythonVersion.trim()}`);
        } catch (error) {
            console.log('❌ Python not found');
            console.log('\n💡 Install Python from: https://python.org');
            console.log('   Make sure to check "Add Python to PATH"');
            console.log('   Then restart this terminal and run: npm run setup');
            process.exit(1);
        }
        
        // Check MSBuild
        try {
            execSync('where msbuild 2>nul', { stdio: 'pipe' });
            console.log('✅ MSBuild found');
        } catch (error) {
            console.log('❌ Visual Studio Build Tools not found');
            console.log('\n💡 Install Build Tools for Visual Studio:');
            console.log('   1. Download from: https://visualstudio.microsoft.com/downloads/');
            console.log('   2. Select "Build Tools for Visual Studio"');
            console.log('   3. Choose "Desktop development with C++" workload');
            console.log('   4. Restart terminal and run: npm run setup');
            process.exit(1);
        }
        
        console.log('\n📋 Step 3: Installing dependencies...');
        
        // Check node-gyp
        try {
            execSync('node-gyp --version 2>nul', { stdio: 'pipe' });
            console.log('✅ node-gyp available');
        } catch (error) {
            console.log('📦 Installing node-gyp globally...');
            execSync('npm install -g node-gyp', { stdio: 'inherit' });
        }
        
        // Install/update dependencies
        console.log('📦 Checking dependencies...');
        execSync('npm install', { stdio: 'inherit' });
        
        console.log('\n📋 Step 4: Building native module...');
        
        // Clean previous builds
        if (fs.existsSync('build')) {
            console.log('🧹 Cleaning previous build...');
            fs.rmSync('build', { recursive: true, force: true });
        }
        
        // Configure and build
        console.log('🔧 Configuring native module...');
        execSync('node-gyp configure', { stdio: 'inherit' });
        
        console.log('🏗️  Building native module...');
        execSync('node-gyp build', { stdio: 'inherit' });
        
        // Verify build
        if (fs.existsSync(buildPath)) {
            console.log('✅ Native module built successfully!');
            
            // Test loading
            try {
                const testModule = require(buildPath);
                if (testModule.AudioController) {
                    console.log('✅ Native module loads correctly');
                    console.log('\n🎉 Setup completed successfully!');
                    console.log('\n🚀 Next steps:');
                    console.log('   1. Run: npm start');
                    console.log('   2. Connect your MIDI controller');
                    console.log('   3. Configure audio channels');
                    console.log('   4. Real Windows audio control enabled!');
                } else {
                    throw new Error('AudioController class not exported');
                }
            } catch (loadError) {
                console.log('⚠️  Module built but failed to load:', loadError.message);
                console.log('App will run in mock mode');
            }
        } else {
            console.log('❌ Build failed - output file not found');
            console.log('App will run in mock mode');
        }
        
    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.log('\n💡 Troubleshooting:');
        console.log('   1. Make sure you have admin rights');
        console.log('   2. Install Visual Studio Build Tools with C++ workload');
        console.log('   3. Install Python and add to PATH');
        console.log('   4. Restart terminal and try again');
        console.log('\n⚠️  App will still work in mock mode');
        console.log('Run: npm start');
    }
    
    console.log('\n✅ Setup process completed');
    process.exit(0);
}

// Prevent multiple runs
if (require.main === module) {
    main();
}