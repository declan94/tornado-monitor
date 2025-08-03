import { TelegramAlertSender } from "./dist/telegram.js";
import { ConfigLoader } from "./dist/config.js";

async function testAlerts() {
  console.log("Testing Telegram alerts with config file...");
  
  try {
    // Load configuration
    const config = ConfigLoader.loadConfig();
    console.log(`Loaded ${config.networks.length} network configurations`);
    
    // Find first network with Telegram enabled
    const networkWithTelegram = config.networks.find(network => 
      network.telegram && network.telegram.enabled
    );
    
    if (!networkWithTelegram) {
      console.log("❌ No network found with Telegram enabled");
      console.log("💡 Add Telegram config to your config file or set environment variables:");
      console.log("   export TELEGRAM_BOT_TOKEN='your_bot_token'");
      console.log("   export TELEGRAM_CHAT_ID='your_chat_id'");
      return;
    }
    
    console.log(`📱 Testing with network: ${networkWithTelegram.name}`);
    console.log(`🤖 Bot token: ${networkWithTelegram.telegram.botToken.substring(0, 10)}...`);
    console.log(`💬 Chat ID: ${networkWithTelegram.telegram.chatId}`);
    
    const sender = new TelegramAlertSender(networkWithTelegram.telegram);
    
    // Test connection
    console.log("\n1. Testing connection...");
    const connectionOk = await sender.testConnection();
    console.log(`Connection test: ${connectionOk ? "✅ OK" : "❌ Failed"}`);
    
    if (!connectionOk) {
      console.log("❌ Fix connection issues before testing alerts");
      console.log("💡 Check bot token and chat ID are correct");
      return;
    }
    
    // Test different alert types
    console.log("\n2. Testing different alert types...");
    
    await sender.sendAlert(
      "API health checks failing: Connection timeout", 
      networkWithTelegram.name
    );
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await sender.sendAlert(
      "High queue: 15 transactions pending", 
      networkWithTelegram.name
    );
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await sender.sendAlert(
      "Error in health: Invalid response from server", 
      networkWithTelegram.name
    );
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test burst throttling
    console.log("\n3. Testing burst throttling...");
    for (let i = 1; i <= 5; i++) {
      const result = await sender.sendAlert(
        "Test burst throttling message", 
        "TestNetwork"
      );
      console.log(`Burst test ${i}: ${result ? "✅ Sent" : "⏸️  Throttled"}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log("\n✅ Alert testing completed!");
    console.log("📱 Check your Telegram for the test messages");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    console.log("\n💡 Make sure you have:");
    console.log("   - Built the project: npm run build");
    console.log("   - Valid config file with Telegram settings");
    console.log("   - Or environment variables set");
  }
}

testAlerts();