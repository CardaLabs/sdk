/**
 * Price Monitoring Example
 *
 * This example demonstrates real-time price monitoring with caching,
 * multiple assets, and price change alerts.
 */
import { CardalabsSDK } from '../src';

interface PriceAlert {
  asset: string;
  type: 'above' | 'below';
  threshold: number;
  triggered: boolean;
}

class PriceMonitor {
  private sdk: CardalabsSDK;
  private alerts: PriceAlert[] = [];
  private monitoringInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.sdk = new CardalabsSDK({
      providers: {
        coingecko: {
          enabled: true,
          // Add your API key for higher rate limits: apiKey: 'your-key'
        },
      },
      cache: {
        fieldTtl: {
          price: 10, // Cache prices for 10 seconds for real-time feel
        },
      },
    });
  }

  async initialize() {
    await this.sdk.initialize();
    console.log('📡 Price monitor initialized');
  }

  addAlert(asset: string, type: 'above' | 'below', threshold: number) {
    this.alerts.push({ asset, type, threshold, triggered: false });
    console.log(`🚨 Alert set: ${asset} ${type} $${threshold}`);
  }

  async startMonitoring(assets: string[], intervalMs: number = 15000) {
    console.log(`🔄 Starting price monitoring every ${intervalMs / 1000}s\n`);

    this.monitoringInterval = setInterval(async () => {
      await this.checkPrices(assets);
    }, intervalMs);

    // Initial check
    await this.checkPrices(assets);
  }

  private async checkPrices(assets: string[]) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n📊 Price Update - ${timestamp}`);
    console.log('═'.repeat(50));

    for (const asset of assets) {
      try {
        const data = await this.sdk.getTokenData(asset, [
          'price',
          'priceChangePercentage24h',
          'priceChangePercentage1h',
        ]);

        const price = data.data.price || 0;
        const change24h = data.data.priceChangePercentage24h || 0;
        const change1h = data.data.priceChangePercentage1h || 0;

        // Format display
        const arrow24h = change24h >= 0 ? '📈' : '📉';
        const arrow1h = change1h >= 0 ? '🟢' : '🔴';
        const cacheIcon = data.metadata?.cacheStatus === 'hit' ? '⚡' : '🌐';

        console.log(`${cacheIcon} ${asset}:`);
        console.log(`  💰 $${price.toFixed(4)}`);
        console.log(`  ${arrow24h} 24h: ${change24h.toFixed(2)}%`);
        console.log(`  ${arrow1h} 1h: ${change1h.toFixed(2)}%`);

        // Check alerts
        await this.checkAlerts(asset, price);
      } catch (error) {
        console.log(`❌ ${asset}: Error fetching data`);
      }
    }
  }

  private async checkAlerts(asset: string, currentPrice: number) {
    for (const alert of this.alerts.filter((a) => a.asset === asset && !a.triggered)) {
      let triggered = false;

      if (alert.type === 'above' && currentPrice > alert.threshold) {
        triggered = true;
      } else if (alert.type === 'below' && currentPrice < alert.threshold) {
        triggered = true;
      }

      if (triggered) {
        alert.triggered = true;
        console.log(`\n🚨 ALERT TRIGGERED! 🚨`);
        console.log(`${asset} is ${alert.type} $${alert.threshold}`);
        console.log(`Current price: $${currentPrice.toFixed(4)}\n`);
      }
    }
  }

  async getStats() {
    const stats = await this.sdk.getStats();

    console.log('\n📈 Monitoring Statistics:');
    console.log(`  Requests Made: ${stats.requests.total}`);
    console.log(`  Cache Hit Rate: ${(stats.cache.hitRate * 100).toFixed(1)}%`);
    console.log(`  Average Response: ${stats.performance?.avgResponseTime || 'N/A'}ms`);
    console.log(`  Uptime: ${(stats.uptime / 1000).toFixed(1)}s`);
  }

  async stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      console.log('\n⏹️  Monitoring stopped');
    }

    await this.getStats();
    await this.sdk.destroy();
    console.log('🧹 Monitor cleaned up');
  }
}

// Example usage
async function runPriceMonitoring() {
  const monitor = new PriceMonitor();

  try {
    await monitor.initialize();

    // Set up some price alerts
    monitor.addAlert('lovelace', 'above', 1.0); // Alert if ADA goes above $1
    monitor.addAlert('lovelace', 'below', 0.3); // Alert if ADA drops below $0.30

    // Monitor ADA and other tokens
    const assetsToMonitor = ['lovelace']; // Add more asset IDs as needed

    // Start monitoring (check every 15 seconds)
    await monitor.startMonitoring(assetsToMonitor, 15000);

    // Run for 2 minutes then stop
    setTimeout(async () => {
      await monitor.stop();
      process.exit(0);
    }, 120000);
  } catch (error) {
    console.error('❌ Error:', error);
    await monitor.stop();
  }
}

// Run the example
if (require.main === module) {
  console.log('🎯 CardaLabs SDK - Price Monitoring Example');
  console.log('Press Ctrl+C to stop monitoring\n');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down gracefully...');
    process.exit(0);
  });

  runPriceMonitoring().catch(console.error);
}

export { PriceMonitor, runPriceMonitoring };
