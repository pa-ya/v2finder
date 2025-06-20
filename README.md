# V2ray Connection Finder - Enhanced Version with File Output

A powerful Node.js tool to automatically search for and test V2ray server configurations with improved detection, testing methods, and file output capabilities.

## 🚀 Features

- 🔍 **Enhanced Search**: Searches 20+ reliable public V2ray configuration sources
- 🧪 **Smart Testing**: Uses multiple connection testing methods (TCP + HTTP)
- ✅ **Better Detection**: Improved parsing for vmess, vless, trojan, and shadowsocks
- 📊 **Batch Processing**: Tests multiple servers simultaneously for faster results
- 🌍 **Iran-Optimized**: Specifically designed to work in restricted network environments
- 📁 **File Output**: Automatically saves results to organized files
- ⚡ **Real-time Updates**: Files are updated as configs are found and tested
- 📋 **Ready-to-Use**: Provides copy-ready links for immediate use

## 📦 Installation

1. Make sure you have Node.js installed
2. Install dependencies:
   ```bash
   npm install
   ```

## 🎯 Usage

### Standard Mode (Recommended)
Find and test working servers with file output:
```bash
npm start
```

### Show All Configs Mode
Display all found configurations without testing:
```bash
node index.js --all
```

## 📁 Output Files

The tool creates an `output` directory with three files:

### 1. `working_configs.txt`
- ✅ **Verified working configurations**
- Ready to copy and paste into V2ray clients
- Updated in real-time as configs are tested
- **Use these first!**

### 2. `potential_configs.txt`
- ⚠️ **Potentially working configurations**
- Failed initial tests but might work in V2ray clients
- Some V2ray servers don't respond to HTTP/TCP tests but work as proxies
- **Try these if working configs don't work**

### 3. `all_configs.txt`
- 📋 **All found configurations (not tested)**
- Raw configurations from all sources
- Useful for manual testing or debugging

## 🔧 How It Works

1. **Multi-Source Fetching**: Searches 20+ GitHub repositories and subscription services
2. **Smart Parsing**: Handles base64 encoded configs and multiple protocol formats
3. **Dual Testing**: Uses both TCP connection tests and HTTP probes
4. **Real-time File Updates**: Saves configs to files as they're found
5. **Batch Processing**: Tests multiple servers simultaneously for speed
6. **Result Categorization**: Separates working, potential, and all configs

## 📊 Enhanced Sources

The tool searches these reliable sources:
- **GitHub Repositories**: 15+ active V2ray config repositories
- **Subscription Services**: Public subscription links
- **Community Lists**: Maintained by the V2ray community
- **Aggregated Sources**: Combined feeds from multiple providers

## 🛠️ Troubleshooting

### If No Working Configs Found:
1. **Check Potential Configs**: Open `potential_configs.txt` - these might work
2. **Run Multiple Times**: Server availability changes frequently
3. **Check Network**: Ensure you have internet access
4. **Try Different Times**: Some servers work better at certain hours
5. **Use --all Flag**: See all found configs in `all_configs.txt`

### Network Issues:
- The tool is designed to work in restricted environments
- Uses multiple fallback methods for connection testing
- Handles network timeouts gracefully
- Files are saved even if testing fails

## 📋 Usage Instructions

1. **Run the tool** and wait for results
2. **Open `working_configs.txt`** for verified working links
3. **Copy working links** and paste into V2ray client (v2rayN, v2rayNG, Clash, etc.)
4. **If no working configs**, try configs from `potential_configs.txt`
5. **Test multiple configs** as performance varies
6. **Run periodically** for fresh servers

## 🔒 Security Notes

- Only uses public, community-maintained sources
- No personal data collection or transmission
- Configs are tested but not modified
- Always verify server trustworthiness before extended use

## 🌍 Network Restrictions

This tool is specifically designed to work in environments with internet restrictions:
- Uses multiple connection methods
- Handles blocked sources gracefully  
- Provides fallback testing mechanisms
- Optimized for challenging network conditions
- Saves results to files for offline access

## 📞 Support

If you're having issues:
1. Check the `output` folder for generated files
2. Try running multiple times
3. Check that Node.js is properly installed
4. Ensure you have internet connectivity
5. Try the `--all` flag to see raw configurations
6. Look at `potential_configs.txt` if `working_configs.txt` is empty

## 💡 Pro Tips

- **Best Results**: Run the tool multiple times throughout the day
- **File Backup**: Keep copies of working config files
- **Multiple Clients**: Test configs in different V2ray clients
- **Performance**: Some configs work better at different times
- **Updates**: Re-run weekly for fresh server lists

## ⚖️ Legal Notice

This tool is provided for educational purposes and legitimate use cases only. Users are responsible for complying with their local laws and regulations regarding internet usage and proxy services.

---

**Stay connected, stay informed! 🌐**

## 📈 File Structure

```
project/
├── index.js                 # Main application
├── package.json            # Dependencies
├── README.md              # This file
└── output/                # Generated files
    ├── working_configs.txt    # ✅ Verified working configs
    ├── potential_configs.txt  # ⚠️ Potential configs
    └── all_configs.txt       # 📋 All found configs
```