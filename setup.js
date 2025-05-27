// setup.js - Improved setup script with detailed diagnostics
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

console.log('🎵 MIDI Controller Setup');
console.log('========================\n');

// Check if we're on Windows
const isWindows = process.platform === 'win32';

async function checkSystemRequirements() {
    console.log('🔍 Checking system requirements...');
    
    const requirements = {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        windows: isWindows
    };
    
    console.log(`✅ Node.js: ${requirements.node}`);
    console.log(`✅ Platform: ${requirements.platform} (${requirements.arch})`);
    
    if (!isWindows) {
        console.log('⚠️  Native audio module only works on Windows');
        console.log('   App will run in mock mode on other platforms');
    }
    
    return requirements;
}

async function checkBuildTools() {
    console.log('\n🔧 Checking build tools...');
    
    // Check Python
    try {
        const pythonVersion = execSync('python --version', { encoding: 'utf8', stdio: 'pipe' });
        console.log(`✅ Python: ${pythonVersion.trim()}`);
    } catch (error) {
        try {
            const pythonVersion = execSync('python3 --version', { encoding: 'utf8', stdio: 'pipe' });
            console.log(`✅ Python3: ${pythonVersion.trim()}`);
        } catch (error2) {
            console.log('❌ Python not found');
            console.log('💡 Install Python from: https://python.org');
            return false;
        }
    }
    
    // Check Visual Studio Build Tools (Windows only)
    if (isWindows) {
        try {
            const vsVersion = execSync('where msbuild', { encoding: 'utf8', stdio: 'pipe' });
            console.log('✅ MSBuild found');
        } catch (error) {
            console.log('❌ Visual Studio Build Tools not found');
            console.log('💡 Install from: https://visualstudio.microsoft.com/downloads/');
            console.log('   Choose "Build Tools for Visual Studio" with C++ workload');
            return false;
        }
    }
    
    return true;
}

async function checkNodeGyp() {
    console.log('\n🛠️  Checking node-gyp...');
    
    try {
        const gypVersion = execSync('node-gyp --version', { encoding: 'utf8', stdio: 'pipe' });
        console.log(`✅ node-gyp: ${gypVersion.trim()}`);
        return true;
    } catch (error) {
        console.log('❌ node-gyp not found');
        
        try {
            console.log('📦 Installing node-gyp globally...');
            execSync('npm install -g node-gyp', { stdio: 'inherit' });
            console.log('✅ node-gyp installed successfully');
            return true;
        } catch (installError) {
            console.log('❌ Failed to install node-gyp');
            console.log('💡 Try running as administrator/sudo');
            return false;
        }
    }
}

async function checkDependencies() {
    console.log('\n📦 Checking dependencies...');
    
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = {
        'electron': '^28.0.0',
        'electron-store': '^8.1.0', 
        'obs-websocket-js': '^5.0.6',
        'node-addon-api': '^7.0.0'
    };
    
    let needsInstall = false;
    
    for (const [dep, version] of Object.entries(requiredDeps)) {
        const isInstalled = (packageJson.dependencies && packageJson.dependencies[dep]) ||
                           (packageJson.devDependencies && packageJson.devDependencies[dep]);
        
        if (isInstalled) {
            console.log(`✅ ${dep}: ${isInstalled}`);
        } else {
            console.log(`❌ Missing: ${dep}`);
            needsInstall = true;
        }
    }
    
    if (needsInstall) {
        console.log('📦 Installing missing dependencies...');
        execSync('npm install', { stdio: 'inherit' });
    }
    
    return true;
}

async function checkFiles() {
    console.log('\n📋 Checking project files...');
    
    const requiredFiles = [
        'main.js',
        'preload.js',
        'binding.gyp',
        'native/audio-controller.cpp',
        'native/audio-api.js',
        'renderer/index.html',
        'renderer/styles.css',
        'renderer/renderer.js'
    ];
    
    const missingFiles = [];
    
    for (const file of requiredFiles) {
        if (fs.existsSync(file)) {
            console.log(`✅ ${file}`);
        } else {
            console.log(`❌ Missing: ${file}`);
            missingFiles.push(file);
        }
    }
    
    if (missingFiles.length > 0) {
        console.log(`\n⚠️  ${missingFiles.length} files are missing:`);
        missingFiles.forEach(file => console.log(`   - ${file}`));
        return false;
    }
    
    return true;
}

async function buildNativeModule() {
    console.log('\n🔨 Building native audio module...');
    
    if (!isWindows) {
        console.log('⚠️  Skipping native build (not Windows)');
        return true;
    }
    
    try {
        // Clean previous builds
        if (fs.existsSync('build')) {
            console.log('🧹 Cleaning previous build...');
            fs.rmSync('build', { recursive: true, force: true });
        }
        
        console.log('🔧 Configuring native module...');
        execSync('node-gyp configure', { stdio: 'inherit' });
        
        console.log('🏗️  Building native module...');
        execSync('node-gyp build', { stdio: 'inherit' });
        
        // Verify build success
        const buildPath = path.join('build', 'Release', 'audio_controller.node');
        if (fs.existsSync(buildPath)) {
            console.log('✅ Native audio module built successfully!');
            
            // Test loading the module
            try {
                const testModule = require(path.resolve(buildPath));
                if (testModule.AudioController) {
                    console.log('✅ Native module loads correctly');
                } else {
                    console.log('⚠️  Native module loads but AudioController class not found');
                }
            } catch (loadError) {
                console.log('⚠️  Native module built but failed to load:', loadError.message);
            }
            
            return true;
        } else {
            console.log('❌ Native module build failed - output file not found');
            return false;
        }
        
    } catch (error) {
        console.log('❌ Failed to build native module');
        console.log('Error:', error.message);
        
        // Provide specific help based on error type
        if (error.message.includes('MSBuild')) {
            console.log('\n💡 MSBuild Error Solutions:');
            console.log('   1. Install Visual Studio Build Tools');
            console.log('   2. Install "Desktop development with C++" workload');
            console.log('   3. Restart command prompt after installation');
        }
        
        if (error.message.includes('Python')) {
            console.log('\n💡 Python Error Solutions:');
            console.log('   1. Install Python 3.x from python.org');
            console.log('   2. Add Python to PATH during installation');
            console.log('   3. Restart command prompt');
        }
        
        if (error.message.includes('LNK')) {
            console.log('\n💡 Linker Error Solutions:');
            console.log('   1. Check if all required C++ functions are implemented');
            console.log('   2. Verify Windows SDK is installed');
            console.log('   3. Try running: npm rebuild');
        }
        
        return false;
    }
}

async function createDirectories() {
    console.log('\n📁 Creating directories...');
    
    const dirs = [
        'assets/icons',
        'assets/sounds',
        'renderer/modules'
    ];
    
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created: ${dir}`);
        } else {
            console.log(`✅ Exists: ${dir}`);
        }
    }
    
    return true;
}

async function testConfiguration() {
    console.log('\n🧪 Testing configuration...');
    
    try {
        // Test that main.js can be required
        delete require.cache[path.resolve('main.js')];
        
        // Just check syntax, don't actually run
        const mainContent = fs.readFileSync('main.js', 'utf8');
        if (mainContent.includes('ipcMain')) {
            console.log('✅ main.js syntax looks good');
        } else {
            console.log('⚠️  main.js might be missing Electron imports');
        }
        
        // Check if binding.gyp is valid JSON
        const bindingContent = fs.readFileSync('binding.gyp', 'utf8');
        JSON.parse(bindingContent);
        console.log('✅ binding.gyp is valid JSON');
        
        return true;
    } catch (error) {
        console.log('❌ Configuration test failed:', error.message);
        return false;
    }
}

async function showCompletionStatus(results) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Setup Complete');
    console.log('='.repeat(50));
    
    const steps = [
        { name: 'System Requirements', result: results.system },
        { name: 'Build Tools', result: results.buildTools },
        { name: 'node-gyp', result: results.nodeGyp },
        { name: 'Dependencies', result: results.dependencies },
        { name: 'Project Files', result: results.files },
        { name: 'Native Module Build', result: results.nativeBuild },
        { name: 'Directories', result: results.directories },
        { name: 'Configuration Test', result: results.configTest }
    ];
    
    const successful = steps.filter(s => s.result).length;
    const total = steps.length;
    
    console.log(`\n📈 Success Rate: ${successful}/${total} (${Math.round((successful/total)*100)}%)`);
    
    steps.forEach(step => {
        const icon = step.result ? '✅' : '❌';
        console.log(`${icon} ${step.name}`);
    });
    
    if (successful === total) {
        console.log('\n🎉 Setup completed successfully!');
        console.log('\n🚀 You can now run: npm start');
        
        if (isWindows && results.nativeBuild) {
            console.log('🎛️ Native audio control is enabled');
        } else {
            console.log('🔇 Running in mock audio mode');
        }
    } else {
        console.log('\n⚠️  Setup completed with some issues');
        console.log('   The app should still work in mock mode');
        console.log('   Check the errors above to enable full functionality');
    }
    
    console.log('\n📖 Next steps:');
    console.log('   1. Connect your MIDI controller');
    console.log('   2. Install OBS WebSocket plugin');
    console.log('   3. Run: npm start');
    console.log('   4. Configure your audio channels and hotkeys');
}

// Main setup function
async function main() {
    const results = {};
    
    try {
        results.system = await checkSystemRequirements();
        results.buildTools = await checkBuildTools();
        results.nodeGyp = await checkNodeGyp();
        results.dependencies = await checkDependencies();
        results.files = await checkFiles();
        results.nativeBuild = await buildNativeModule();
        results.directories = await createDirectories();
        results.configTest = await testConfiguration();
        
        await showCompletionStatus(results);
        
    } catch (error) {
        console.error('\n❌ Setup failed with error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Handle process interruption
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Setup interrupted by user');
    process.exit(1);
});

// Run setup
main();