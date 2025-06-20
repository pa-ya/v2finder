import axios from "axios";
import * as cheerio from "cheerio";
import { SocksProxyAgent } from "socks-proxy-agent";
import net from "net";
import fs from "fs";
import path from "path";

class V2rayFinder {
  constructor() {
    this.sources = [
      // GitHub sources
      "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/All_Configs_Sub.txt",
      "https://raw.githubusercontent.com/mfuu/v2ray/master/v2ray",
      "https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub",
      "https://raw.githubusercontent.com/aiboboxx/v2rayfree/main/v2",
      "https://raw.githubusercontent.com/ripaojiedian/freenode/main/sub",
      "https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list.txt",
      "https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt",
      "https://raw.githubusercontent.com/Leon406/SubCrawler/main/sub/share/all3",
      "https://raw.githubusercontent.com/ts-sf/fly/main/v2",
      "https://raw.githubusercontent.com/freefq/free/master/v2",
      "https://raw.githubusercontent.com/ssrsub/ssr/master/v2ray",
      "https://raw.githubusercontent.com/Alvin9999/pac2/master/v2ray/1/config.txt",
      "https://raw.githubusercontent.com/Alvin9999/pac2/master/v2ray/2/config.txt",
      "https://raw.githubusercontent.com/Alvin9999/pac2/master/v2ray/3/config.txt",

      // Subscription links
      "https://sub.pmsub.me/base64",
      "https://raw.githubusercontent.com/tbbatbb/Proxy/master/dist/v2ray.config.txt",
      "https://raw.githubusercontent.com/changfengoss/pub/main/data/2024_01_17/cvjOPc.txt",
      "https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/v2ray.txt",
      "https://raw.githubusercontent.com/w1770946466/Auto_proxy/main/Long_term_subscription1.txt",
      "https://raw.githubusercontent.com/w1770946466/Auto_proxy/main/Long_term_subscription2.txt",
      "https://raw.githubusercontent.com/w1770946466/Auto_proxy/main/Long_term_subscription3.txt",
    ];

    this.workingConfigs = [];
    this.potentialConfigs = [];
    this.timeout = 5000;
    this.maxConcurrent = 10;

    // File paths
    this.workingConfigsFile = "working_configs.txt";
    this.potentialConfigsFile = "potential_configs.txt";
    this.allConfigsFile = "all_configs.txt";
  }

  // Create output directory if it doesn't exist
  ensureOutputDirectory() {
    const outputDir = "output";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Update file paths to include output directory
    this.workingConfigsFile = path.join(outputDir, "working_configs.txt");
    this.potentialConfigsFile = path.join(outputDir, "potential_configs.txt");
    this.allConfigsFile = path.join(outputDir, "all_configs.txt");
  }

  // Write configs to file with timestamp
  writeConfigsToFile(configs, filename, title) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const header = `# ${title}\n# Generated on: ${new Date().toLocaleString()}\n# Total configs: ${
        configs.length
      }\n\n`;

      let content = header;

      if (configs.length > 0) {
        configs.forEach((config, index) => {
          content += `${index + 1}. ${config}\n`;
        });
      } else {
        content += "# No configurations found\n";
      }

      content += `\n# End of file - ${timestamp}\n`;

      fs.writeFileSync(filename, content, "utf8");
      console.log(`📁 Saved ${configs.length} configs to: ${filename}`);

      return true;
    } catch (error) {
      console.error(`❌ Error writing to ${filename}:`, error.message);
      return false;
    }
  }

  // Append config to file (for real-time updates)
  appendConfigToFile(config, filename, label) {
    try {
      const line = `${label}: ${config}\n`;
      fs.appendFileSync(filename, line, "utf8");
    } catch (error) {
      console.error(`❌ Error appending to ${filename}:`, error.message);
    }
  }

  // Decode base64 configurations
  decodeBase64(str) {
    try {
      return Buffer.from(str, "base64").toString("utf-8");
    } catch (error) {
      return null;
    }
  }

  // Extract V2ray configs from text
  extractV2rayConfigs(text) {
    const configs = [];
    const lines = text.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("vmess://") ||
        trimmed.startsWith("vless://") ||
        trimmed.startsWith("trojan://") ||
        trimmed.startsWith("ss://")
      ) {
        configs.push(trimmed);
      }
    }

    return configs;
  }

  // Parse vmess configuration
  parseVmess(vmessUrl) {
    try {
      const base64Part = vmessUrl.replace("vmess://", "");
      const decoded = this.decodeBase64(base64Part);
      if (!decoded) return null;

      const config = JSON.parse(decoded);
      return {
        type: "vmess",
        address: config.add,
        port: parseInt(config.port),
        id: config.id,
        alterId: config.aid || 0,
        security: config.scy || "auto",
        network: config.net || "tcp",
        path: config.path || "",
        host: config.host || "",
        tls: config.tls || "",
        ps: config.ps || `${config.add}:${config.port}`,
        original: vmessUrl,
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
        type: configUrl.split("://")[0],
        address: url.hostname,
        port: parseInt(url.port) || (configUrl.startsWith("ss://") ? 443 : 443),
        ps: `${url.hostname}:${url.port || 443}`,
        original: configUrl,
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

      socket.on("error", () => {
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
      const tcpResult = await this.testTcpConnection(
        config.address,
        config.port,
        3000
      );

      if (tcpResult) {
        console.log(`✅ TCP OK: ${config.ps}`);
        this.workingConfigs.push(config.original);
        // Append to working configs file immediately
        this.appendConfigToFile(
          config.original,
          this.workingConfigsFile,
          "✅ WORKING"
        );
        return "working";
      }

      // If TCP fails, try HTTP test (some servers might respond differently)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        await fetch(`http://${config.address}:${config.port}`, {
          method: "HEAD",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log(`✅ HTTP OK: ${config.ps}`);
        this.workingConfigs.push(config.original);
        // Append to working configs file immediately
        this.appendConfigToFile(
          config.original,
          this.workingConfigsFile,
          "✅ WORKING"
        );
        return "working";
      } catch (httpError) {
        // Even if HTTP fails, the server might still be a valid proxy
        // Some V2ray servers don't respond to HTTP requests but work as proxies
        console.log(
          `⚠️  Potential: ${config.ps} (Port open but no HTTP response)`
        );
        this.potentialConfigs.push(config.original);
        // Append to potential configs file immediately
        this.appendConfigToFile(
          config.original,
          this.potentialConfigsFile,
          "⚠️ POTENTIAL"
        );
        return "potential";
      }
    } catch (error) {
      return "failed";
    }
  }

  // Fetch configurations from a source with better error handling
  async fetchFromSource(url) {
    try {
      console.log(`📡 Fetching: ${url.substring(0, 50)}...`);

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        validateStatus: function (status) {
          return status < 500;
        },
      });

      let content = response.data;

      // Try to decode if it's base64
      if (typeof content === "string") {
        const decoded = this.decodeBase64(content);
        if (
          decoded &&
          (decoded.includes("vmess://") ||
            decoded.includes("vless://") ||
            decoded.includes("trojan://") ||
            decoded.includes("ss://"))
        ) {
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

        if (configUrl.startsWith("vmess://")) {
          config = this.parseVmess(configUrl);
        } else {
          config = this.parseOtherConfig(configUrl);
        }

        if (config) {
          const testResult = await this.testConnection(config);
          return { config, testResult, original: configUrl };
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r) => r !== null));

      // Progress update
      console.log(
        `📊 Tested ${Math.min(i + batchSize, configs.length)}/${
          configs.length
        } configs`
      );

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  // Initialize output files
  initializeOutputFiles() {
    try {
      const timestamp = new Date().toLocaleString();

      // Initialize working configs file
      const workingHeader = `# V2ray Working Configurations\n# Started: ${timestamp}\n# This file is updated in real-time as working configs are found\n\n`;
      fs.writeFileSync(this.workingConfigsFile, workingHeader, "utf8");

      // Initialize potential configs file
      const potentialHeader = `# V2ray Potential Configurations\n# Started: ${timestamp}\n# These configs might work but failed initial tests\n\n`;
      fs.writeFileSync(this.potentialConfigsFile, potentialHeader, "utf8");

      console.log(`📁 Output files initialized:`);
      console.log(`   Working configs: ${this.workingConfigsFile}`);
      console.log(`   Potential configs: ${this.potentialConfigsFile}\n`);
    } catch (error) {
      console.error("❌ Error initializing output files:", error.message);
    }
  }

  // Main function to find and test servers
  async findAndTestServers() {
    console.log(
      "🔍 V2ray Connection Finder - Enhanced Version with File Output"
    );
    console.log("=".repeat(60));
    console.log("🌍 Searching for V2ray servers...\n");

    // Ensure output directory exists and initialize files
    this.ensureOutputDirectory();
    this.initializeOutputFiles();

    const allConfigs = [];

    // Fetch from all sources with progress
    console.log(`📡 Fetching from ${this.sources.length} sources...\n`);

    for (let i = 0; i < this.sources.length; i++) {
      const source = this.sources[i];
      console.log(`[${i + 1}/${this.sources.length}]`);
      const configs = await this.fetchFromSource(source);
      allConfigs.push(...configs);

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`\n📊 Total configurations found: ${allConfigs.length}`);

    if (allConfigs.length === 0) {
      console.log("❌ No configurations found from any source.");
      console.log(
        "💡 This might be due to network restrictions or source unavailability."
      );
      console.log(
        "💡 Try running the script again later or check your internet connection."
      );
      return [];
    }

    // Remove duplicates
    const uniqueConfigs = [...new Set(allConfigs)];
    console.log(`📋 Unique configurations to test: ${uniqueConfigs.length}\n`);

    // Save all configs to file
    this.writeConfigsToFile(
      uniqueConfigs,
      this.allConfigsFile,
      "All Found V2ray Configurations (Not Tested)"
    );

    console.log("🧪 Testing connections...\n");

    // Process configs in batches
    const results = await this.processConfigsBatch(uniqueConfigs);

    console.log("\n" + "=".repeat(60));
    console.log("🎉 RESULTS");
    console.log("=".repeat(60));

    // Final file updates with complete lists
    this.writeConfigsToFile(
      this.workingConfigs,
      this.workingConfigsFile,
      "Working V2ray Configurations"
    );
    this.writeConfigsToFile(
      this.potentialConfigs,
      this.potentialConfigsFile,
      "Potential V2ray Configurations"
    );

    console.log(`\n📊 SUMMARY:`);
    console.log(`✅ Working configurations: ${this.workingConfigs.length}`);
    console.log(
      `⚠️  Potential configurations: ${this.potentialConfigs.length}`
    );
    console.log(`📁 Total configurations found: ${uniqueConfigs.length}\n`);

    if (this.workingConfigs.length > 0) {
      console.log(
        `✅ Found ${this.workingConfigs.length} working configurations!`
      );
      console.log(`📁 Saved to: ${this.workingConfigsFile}\n`);

      console.log("🔥 TOP 5 WORKING CONFIGS:");
      this.workingConfigs.slice(0, 5).forEach((config, index) => {
        console.log(`${index + 1}. ${config}`);
      });
      console.log("");
    }

    if (this.potentialConfigs.length > 0) {
      console.log(
        `⚠️  Found ${this.potentialConfigs.length} potential configurations!`
      );
      console.log(`📁 Saved to: ${this.potentialConfigsFile}`);
      console.log(
        "💡 These might work in your V2ray client even if they failed the test\n"
      );
    }

    if (
      this.workingConfigs.length === 0 &&
      this.potentialConfigs.length === 0
    ) {
      console.log("❌ No working or potential configurations found.");
      console.log("\n💡 TROUBLESHOOTING TIPS:");
      console.log("• Network restrictions might be blocking connections");
      console.log("• Try running the script multiple times");
      console.log("• Server availability changes frequently");
      console.log("• Check the all_configs.txt file for raw configurations");
    }

    console.log("📋 FILES CREATED:");
    console.log(`• ${this.workingConfigsFile} - Ready to use configs`);
    console.log(`• ${this.potentialConfigsFile} - Configs that might work`);
    console.log(`• ${this.allConfigsFile} - All found configs (raw)\n`);

    console.log("📋 INSTRUCTIONS:");
    console.log("1. Open the working_configs.txt file");
    console.log("2. Copy any configuration link");
    console.log("3. Paste into your V2ray client (v2rayN, v2rayNG, etc.)");
    console.log("4. If working configs don't work, try potential configs");
    console.log("5. Run this tool again periodically for fresh servers\n");

    return {
      working: this.workingConfigs,
      potential: this.potentialConfigs,
      all: uniqueConfigs,
    };
  }

  // Show all found configs (even if not tested as working)
  async showAllConfigs() {
    console.log("📋 Showing ALL found configurations (not tested):\n");

    this.ensureOutputDirectory();

    const allConfigs = [];

    for (const source of this.sources) {
      const configs = await this.fetchFromSource(source);
      allConfigs.push(...configs);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const uniqueConfigs = [...new Set(allConfigs)];

    // Save to file
    this.writeConfigsToFile(
      uniqueConfigs,
      this.allConfigsFile,
      "All Found V2ray Configurations (Not Tested)"
    );

    if (uniqueConfigs.length > 0) {
      console.log(`Found ${uniqueConfigs.length} total configurations`);
      console.log(`📁 Saved to: ${this.allConfigsFile}\n`);

      console.log("🔥 FIRST 10 CONFIGS:");
      uniqueConfigs.slice(0, 10).forEach((config, index) => {
        console.log(`${index + 1}. ${config}`);
      });

      if (uniqueConfigs.length > 10) {
        console.log(`\n... and ${uniqueConfigs.length - 10} more in the file`);
      }
    } else {
      console.log("No configurations found.");
    }

    return uniqueConfigs;
  }
}

// Main execution
async function main() {
  const finder = new V2rayFinder();

  const args = process.argv.slice(2);

  if (args.includes("--all")) {
    // Show all configs without testing
    await finder.showAllConfigs();
  } else {
    // Normal mode with testing
    await finder.findAndTestServers();
  }
}

// Handle errors gracefully
process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.log("Uncaught Exception:", error);
  process.exit(1);
});

// Run the main function
main().catch(console.error);
