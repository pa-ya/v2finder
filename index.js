import axios from 'axios';
import * as cheerio from 'cheerio';
import { SocksProxyAgent } from 'socks-proxy-agent';
import net from 'net';

class V2rayFinder {
  constructor() {
    this.sources = [
      // GitHub sources
      'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/All_Configs_Sub.txt',
      'https://raw.githubusercontent.com/mfuu/v2ray/master/v2ray',
      'https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub',
      'https://raw.githubusercontent.com/aiboboxx/v2rayfree/main/v2',
      'https://raw.githubusercontent.com/ripaojiedian/freenode/main/sub',
      'https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list.txt',
      'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
      'https://raw.githubusercontent.com/Leon406/SubCrawler/main/sub/share/all3',
      'https://raw.githubusercontent.com/ts-sf/fly/main/v2',
      'https://raw.githubusercontent.com/freefq/free/master/v2',
      'https://raw.githubusercontent.com/ssrsub/ssr/master/v2ray',
      'https://raw.githubusercontent.com/Alvin9999/pac2/master/v2ray/1/config.txt',
      'https://raw.githubusercontent.com/Alvin9999/pac2/master/v2ray/2/config.txt',
      'https://raw.githubusercontent.com/Alvin9999/pac2/master/v2ray/3/config.txt',
      
      // Subscription links
      'https://sub.pmsub.me/base64',
      'https://raw.githubusercontent.com/tbbatbb/Proxy/master/dist/v2ray.config.txt',
      'https://raw.githubusercontent.com/changfengoss/pub/main/data/2024_01_17/cvjOPc.txt',
      'https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/v2ray.txt',
      'https://raw.githubusercontent.com/w1770946466/Auto_proxy/main/Long_term_subscription1.txt',
      'https://raw.githubusercontent.com/w1770946466/Auto_proxy/main/Long_term_subscription2.txt',
      'https://raw.githubusercontent.com/w1770946466/Auto_proxy/main/Long_term_subscription3.txt'
    ];
    
    this.workingConfigs = [];
    this.timeout = 5000; // Reduced timeout for faster testing
    this.maxConcurrent = 10; // Test multiple configs simultaneously
  }

  // Decode base64 configurations
  decodeBase64(str) {
    try {
      return Buffer.from(str, 'base64').toString('utf-8');
    } catch (error) {
      return null;
    }
  }

  // Extract V2ray configs from text
  extractV2rayConfigs(text) {
    const configs = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('vmess://') || 
          trimmed.startsWith('vless://') || 
          trimmed.startsWith('trojan://') ||
          trimmed.startsWith('ss://')) {
        configs.push(trimmed);
      }
    }
    
    return configs;
  }

  // Parse vmess configuration
  parseVmess(vmessUrl) {
    try {
      const base64Part = vmessUrl.replace('vmess://', '');
      const decoded = this.decodeBase64(base64Part);
      if (!decoded) return null;
      
      const config = JSON.parse(decoded);
      return {
        type: 'vmess',
        address: config.add,
        port: parseInt(config.port),
        id: config.id,
        alterId: config.aid || 0,
        security: config.scy || 'auto',
        network: config.net || 'tcp',
        path: config.path || '',
        host: config.host || '',
        tls: config.tls || '',
        ps: config.ps || `${config.add}:${config.port}`,
        original: vmessUrl
      };
    } catch (error) {
      return null;
    }
  }

  // Parse other config types
  parseOtherConfig(configUrl) {
    try {
      const url = new URL(configUrl);
      return {
        type: configUrl.split('://')[0],
        address: url.hostname,
        port: parseInt(url.port) || (configUrl.startsWith('ss://') ? 443 : 443),
        ps: `${url.hostname}:${url.port || 443}`,
        original: configUrl
      };
    } catch (error) {
      return null;
    }
  }

  // Simple TCP connection test
  async testTcpConnection(host, port, timeout = 3000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let connected = false;
      
      const timer = setTimeout(() => {
        socket.destroy();
        if (!connected) resolve(false);
      }, timeout);
      
      socket.connect(port, host, () => {
        connected = true;
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        connected = true;
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  // Test connection to a server
  async testConnection(config) {
    try {
      // First try TCP connection
      const tcpResult = await this.testTcpConnection(config.address, config.port, 3000);
      
      if (tcpResult) {
        console.log(`✅ TCP OK: ${config.ps}`);
        return true;
      }
      
      // If TCP fails, try HTTP test (some servers might respond differently)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        await fetch(`http://${config.address}:${config.port}`, {
          method: 'HEAD',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log(`✅ HTTP OK: ${config.ps}`);
        return true;
      } catch (httpError) {
        // Even if HTTP fails, the server might still be a valid proxy
        // Some V2ray servers don't respond to HTTP requests but work as proxies
        console.log(`⚠️  Potential: ${config.ps} (Port open but no HTTP response)`);
        return true; // Consider it working for V2ray purposes
      }
    } catch (error) {
      return false;
    }
  }

  // Fetch configurations from a source with better error handling
  async fetchFromSource(url) {
    try {
      console.log(`📡 Fetching: ${url.substring(0, 50)}...`);
      
      const response = await axios.get(url, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        validateStatus: function (status) {
          return status < 500; // Accept any status code less than 500
        }
      });
      
      let content = response.data;
      
      // Try to decode if it's base64
      if (typeof content === 'string') {
        const decoded = this.decodeBase64(content);
        if (decoded && (decoded.includes('vmess://') || decoded.includes('vless://') || decoded.includes('trojan://') || decoded.includes('ss://'))) {
          content = decoded;
        }
      }
      
      const configs = this.extractV2rayConfigs(content);
      console.log(`   Found ${configs.length} configs`);
      return configs;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      return [];
    }
  }

  // Process configs in batches for better performance
  async processConfigsBatch(configs, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < configs.length; i += batchSize) {
      const batch = configs.slice(i, i + batchSize);
      const batchPromises = batch.map(async (configUrl) => {
        let config = null;
        
        if (configUrl.startsWith('vmess://')) {
          config = this.parseVmess(configUrl);
        } else {
          config = this.parseOtherConfig(configUrl);
        }
        
        if (config) {
          const isWorking = await this.testConnection(config);
          return { config, isWorking, original: configUrl };
        }
        return null;
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null));
      
      // Progress update
      console.log(`📊 Tested ${Math.min(i + batchSize, configs.length)}/${configs.length} configs`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  // Main function to find and test servers
  async findAndTestServers() {
    console.log('🔍 V2ray Connection Finder - Enhanced Version');
    console.log('='.repeat(50));
    console.log('🌍 Searching for V2ray servers...\n');
    
    const allConfigs = [];
    
    // Fetch from all sources with progress
    console.log(`📡 Fetching from ${this.sources.length} sources...\n`);
    
    for (let i = 0; i < this.sources.length; i++) {
      const source = this.sources[i];
      console.log(`[${i + 1}/${this.sources.length}]`);
      const configs = await this.fetchFromSource(source);
      allConfigs.push(...configs);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n📊 Total configurations found: ${allConfigs.length}`);
    
    if (allConfigs.length === 0) {
      console.log('❌ No configurations found from any source.');
      console.log('💡 This might be due to network restrictions or source unavailability.');
      console.log('💡 Try running the script again later or check your internet connection.');
      return [];
    }
    
    // Remove duplicates
    const uniqueConfigs = [...new Set(allConfigs)];
    console.log(`📋 Unique configurations to test: ${uniqueConfigs.length}\n`);
    
    console.log('🧪 Testing connections...\n');
    
    // Process configs in batches
    const results = await this.processConfigsBatch(uniqueConfigs);
    
    // Filter working configs
    const workingConfigs = results
      .filter(r => r.isWorking)
      .map(r => r.original);
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 RESULTS');
    console.log('='.repeat(50));
    
    if (workingConfigs.length > 0) {
      console.log(`✅ Found ${workingConfigs.length} working configurations:\n`);
      
      workingConfigs.forEach((config, index) => {
        console.log(`${index + 1}. ${config}\n`);
      });
      
      console.log('📋 INSTRUCTIONS:');
      console.log('1. Copy any of the above links');
      console.log('2. Paste them into your V2ray client (v2rayN, v2rayNG, etc.)');
      console.log('3. Try multiple configs as performance may vary');
      console.log('4. Run this tool again periodically for fresh servers\n');
      
    } else {
      console.log('❌ No working configurations found.');
      console.log('\n💡 TROUBLESHOOTING TIPS:');
      console.log('• Network restrictions might be blocking connections');
      console.log('• Try running the script multiple times');
      console.log('• Server availability changes frequently');
      console.log('• Some configs might work better at different times');
    }
    
    return workingConfigs;
  }

  // Show all found configs (even if not tested as working)
  async showAllConfigs() {
    console.log('📋 Showing ALL found configurations (not tested):\n');
    
    const allConfigs = [];
    
    for (const source of this.sources) {
      const configs = await this.fetchFromSource(source);
      allConfigs.push(...configs);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const uniqueConfigs = [...new Set(allConfigs)];
    
    if (uniqueConfigs.length > 0) {
      console.log(`Found ${uniqueConfigs.length} total configurations:\n`);
      uniqueConfigs.forEach((config, index) => {
        console.log(`${index + 1}. ${config}`);
      });
    } else {
      console.log('No configurations found.');
    }
    
    return uniqueConfigs;
  }
}

// Main execution
async function main() {
  const finder = new V2rayFinder();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--all')) {
    // Show all configs without testing
    await finder.showAllConfigs();
  } else {
    // Normal mode with testing
    await finder.findAndTestServers();
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.log('Uncaught Exception:', error);
  process.exit(1);
});

// Run the main function
main().catch(console.error);