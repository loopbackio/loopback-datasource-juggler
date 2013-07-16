exports.safeRequire = safeRequire;

function safeRequire(module) {
    try {
        return require(module);
    } catch (e) {
        console.log('Run "npm install loopback-data ' + module + '" command to use loopback-data using ' + module + ' database engine');
        process.exit(1);
    }
}

