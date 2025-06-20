# V2ray Connection Finder - Enhanced Version

A powerful Node.js tool to automatically search for and test V2ray server configurations with improved detection and testing methods.

## 🚀 Features

- 🔍 **Enhanced Search**: Searches 20+ reliable public V2ray configuration sources
- 🧪 **Smart Testing**: Uses multiple connection testing methods (TCP + HTTP)
- ✅ **Better Detection**: Improved parsing for vmess, vless, trojan, and shadowsocks
- 📊 **Batch Processing**: Tests multiple servers simultaneously for faster results
- 🌍 **Iran-Optimized**: Specifically designed to work in restricted network environments
- 📋 **Ready-to-Use**: Provides copy-ready links for immediate use

## 📦 Installation

1. Make sure you have Node.js installed
2. Install dependencies:
   ```bash
   npm install
   ```

## 🎯 Usage

### Standard Mode (Recommended)
Find and test working servers:
```bash
npm start
```

### Show All Configs Mode
Display all found configurations without testing:
```bash
node index.js --all
```

## 🔧 How It Works

1. **Multi-Source Fetching**: Searches 20+ GitHub repositories and subscription services
2. **Smart Parsing**: Handles base64 encoded configs and multiple protocol formats
3. **Dual Testing**: Uses both TCP connection tests and HTTP probes
4. **Batch Processing**: Tests multiple servers simultaneously for speed
5. **Result Filtering**: Only shows verified working configurations

## 📊 Enhanced Sources

The tool now searches these reliable sources:
- **GitHub Repositories**: 15+ active V2ray config repositories
- **Subscription Services**: Public subscription links
- **Community Lists**: Maintained by the V2ray community
- **Aggregated Sources**: Combined feeds from multiple providers

## 🛠️ Troubleshooting

### If No Working Configs Found:
1. **Run Multiple Times**: Server availability changes frequently
2. **Check Network**: Ensure you have internet access
3. **Try Different Times**: Some servers work better at certain hours
4. **Use --all Flag**: See all found configs even if testing fails

### Network Issues:
- The tool is designed to work in restricted environments
- Uses multiple fallback methods for connection testing
- Handles network timeouts gracefully

## 📋 Usage Instructions

1. **Run the tool** and wait for results
2. **Copy working links** from the output
3. **Paste into V2ray client** (v2rayN, v2rayNG, Clash, etc.)
4. **Test multiple configs** as performance varies
5. **Run periodically** for fresh servers

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

## 📞 Support

If you're having issues:
1. Try running multiple times
2. Check that Node.js is properly installed
3. Ensure you have internet connectivity
4. Try the `--all` flag to see raw configurations

## ⚖️ Legal Notice

This tool is provided for educational purposes and legitimate use cases only. Users are responsible for complying with their local laws and regulations regarding internet usage and proxy services.

---

**Stay connected, stay informed! 🌐**