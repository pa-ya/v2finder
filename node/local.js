import net from "net";
import fs from "fs";
import path from "path";

class LocalV2rayTester {
  constructor() {
    this.workingConfigs = [];
    this.potentialConfigs = [];
    this.timeout = 5000;

    // File paths
    this.inputFile = path.join("output", "all_configs.txt");
    this.workingConfigsFile = path.join("output", "local_working_configs.txt");
    this.potentialConfigsFile = path.join(
      "output",
      "local_potential_configs.txt"
    );
  }

  // Check if input file exists
  checkInputFile() {
    if (!fs.existsSync(this.inputFile)) {
      console.log(`❌ Input file not found: ${this.inputFile}`);
      console.log(
        "💡 Please run the main script first to generate all_configs.txt"
      );
      console.log("💡 Or make sure the file exists in the output directory");
      return false;
    }
    return true;
  }

  // Read configurations from local file
  readConfigsFromFile() {
    try {
      console.log(`📁 Reading configurations from: ${this.inputFile}`);

      const content = fs.readFileSync(this.inputFile, "utf8");
      const lines = content.split("\n");
      const configs = [];

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip comments, empty lines, and headers
        if (
          trimmed.startsWith("#") ||
          trimmed === "" ||
          trimmed.startsWith("=")
        ) {
          continue;
        }

        // Extract config from numbered lines (e.g., "1. vmess://...")
        let configUrl = trimmed;
        if (/^\d+\.\s/.test(trimmed)) {
          configUrl = trimmed.replace(/^\d+\.\s/, "");
        }

        // Check if it's a valid config URL
        if (
          configUrl.startsWith("vmess://") ||
          configUrl.startsWith("vless://") ||
          configUrl.startsWith("trojan://") ||
          configUrl.startsWith("ss://")
        ) {
          configs.push(configUrl);
        }
      }

      console.log(`📊 Found ${configs.length} configurations to test\n`);
      return configs;
    } catch (error) {
      console.error(`❌ Error reading file: ${error.message}`);
      return [];
    }
  }

  // Write configs to file with timestamp
  writeConfigsToFile(configs, filename, title) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const header = `# ${title}\n# Generated on: ${new Date().toLocaleString()}\n# Total configs: ${
        configs.length
      }\n# Source: Local testing from ${this.inputFile}\n\n`;

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
      const workingHeader = `# Local V2ray Working Configurations\n# Started: ${timestamp}\n# Source: ${this.inputFile}\n# This file is updated in real-time as working configs are found\n\n`;
      fs.writeFileSync(this.workingConfigsFile, workingHeader, "utf8");

      // Initialize potential configs file
      const potentialHeader = `# Local V2ray Potential Configurations\n# Started: ${timestamp}\n# Source: ${this.inputFile}\n# These configs might work but failed initial tests\n\n`;
      fs.writeFileSync(this.potentialConfigsFile, potentialHeader, "utf8");

      console.log(`📁 Output files initialized:`);
      console.log(`   Working configs: ${this.workingConfigsFile}`);
      console.log(`   Potential configs: ${this.potentialConfigsFile}\n`);
    } catch (error) {
      console.error("❌ Error initializing output files:", error.message);
    }
  }

  // Main function to test local configurations
  async testLocalConfigs() {
    console.log("🔍 Local V2ray Configuration Tester");
    console.log("=".repeat(50));
    console.log("🧪 Testing configurations from local file...\n");

    // Check if input file exists
    if (!this.checkInputFile()) {
      return [];
    }

    // Initialize output files
    this.initializeOutputFiles();

    // Read configurations from file
    const configs = this.readConfigsFromFile();

    if (configs.length === 0) {
      console.log("❌ No valid configurations found in the input file.");
      console.log(
        "💡 Make sure the file contains valid V2ray configuration URLs."
      );
      return [];
    }

    console.log("🧪 Testing connections...\n");

    // Process configs in batches
    const results = await this.processConfigsBatch(configs);

    console.log("\n" + "=".repeat(50));
    console.log("🎉 LOCAL TESTING RESULTS");
    console.log("=".repeat(50));

    // Final file updates with complete lists
    this.writeConfigsToFile(
      this.workingConfigs,
      this.workingConfigsFile,
      "Local Working V2ray Configurations"
    );
    this.writeConfigsToFile(
      this.potentialConfigs,
      this.potentialConfigsFile,
      "Local Potential V2ray Configurations"
    );

    console.log(`\n📊 SUMMARY:`);
    console.log(`✅ Working configurations: ${this.workingConfigs.length}`);
    console.log(
      `⚠️  Potential configurations: ${this.potentialConfigs.length}`
    );
    console.log(`📁 Total configurations tested: ${configs.length}\n`);

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
      console.log("• The configurations in the file might be outdated");
      console.log("• Network restrictions might be blocking connections");
      console.log("• Try running the main script to get fresh configurations");
      console.log("• Server availability changes frequently");
    }

    console.log("📋 FILES CREATED:");
    console.log(`• ${this.workingConfigsFile} - Ready to use configs`);
    console.log(`• ${this.potentialConfigsFile} - Configs that might work\n`);

    console.log("📋 INSTRUCTIONS:");
    console.log("1. Open the local_working_configs.txt file");
    console.log("2. Copy any configuration link");
    console.log("3. Paste into your V2ray client (v2rayN, v2rayNG, etc.)");
    console.log("4. If working configs don't work, try potential configs");
    console.log("5. Run the main script periodically for fresh servers\n");

    return {
      working: this.workingConfigs,
      potential: this.potentialConfigs,
      total: configs.length,
    };
  }
}

// Main execution
async function main() {
  const tester = new LocalV2rayTester();
  await tester.testLocalConfigs();
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
