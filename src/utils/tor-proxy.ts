import { logger } from '@/utils/logger.js';
import { SocksProxyAgent } from 'socks-proxy-agent';

/**
 * Tor proxy configuration
 */
export interface TorConfig {
  enabled: boolean;
  socksHost: string;
  socksPort: number;
  controlHost: string;
  controlPort: number;
  controlPassword?: string;
  changeCircuitInterval?: number; // minutes
}

/**
 * Tor proxy manager for anonymous requests
 */
export class TorProxy {
  private config: TorConfig;
  private agent: SocksProxyAgent | null = null;
  private circuitChangeTimer: NodeJS.Timer | null = null;

  constructor(config: TorConfig) {
    this.config = {
      socksHost: '127.0.0.1',
      socksPort: 9050,
      controlHost: '127.0.0.1',
      controlPort: 9051,
      changeCircuitInterval: 10,
      ...config,
    };

    if (this.config.enabled) {
      this.initialize();
    }
  }

  /**
   * Initialize Tor proxy
   */
  private initialize(): void {
    try {
      const proxyUrl = `socks5://${this.config.socksHost}:${this.config.socksPort}`;
      this.agent = new SocksProxyAgent(proxyUrl);

      logger.info(
        {
          socksHost: this.config.socksHost,
          socksPort: this.config.socksPort,
        },
        'Tor proxy initialized',
      );

      // Set up automatic circuit changes
      if (this.config.changeCircuitInterval && this.config.changeCircuitInterval > 0) {
        this.startCircuitRotation();
      }
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Tor proxy');
      throw error;
    }
  }

  /**
   * Start automatic circuit rotation
   */
  private startCircuitRotation(): void {
    if (this.circuitChangeTimer) {
      clearInterval(this.circuitChangeTimer);
    }

    const intervalMs = (this.config.changeCircuitInterval || 10) * 60 * 1000;

    this.circuitChangeTimer = setInterval(() => {
      this.changeCircuit().catch((error) => logger.warn({ error }, 'Failed to change Tor circuit'));
    }, intervalMs);

    logger.info(
      { intervalMinutes: this.config.changeCircuitInterval },
      'Tor circuit rotation started',
    );
  }

  /**
   * Change Tor circuit to get new IP
   */
  async changeCircuit(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const net = await import('node:net');

      const socket = new net.Socket();

      return new Promise((resolve, reject) => {
        socket.setTimeout(5000);

        socket.connect(this.config.controlPort, this.config.controlHost, () => {
          logger.debug('Connected to Tor control port');

          // Authenticate if password is provided
          if (this.config.controlPassword) {
            socket.write(`AUTHENTICATE "${this.config.controlPassword}"\r\n`);
          } else {
            socket.write('AUTHENTICATE\r\n');
          }
        });

        let authenticated = false;

        socket.on('data', (data) => {
          const response = data.toString();

          if (response.includes('250 OK') && !authenticated) {
            authenticated = true;
            // Send signal to change circuit
            socket.write('SIGNAL NEWNYM\r\n');
          } else if (response.includes('250 OK') && authenticated) {
            logger.debug('Tor circuit changed successfully');
            socket.end();
            resolve();
          } else if (response.includes('515') || response.includes('514')) {
            logger.warn('Tor circuit change rate limited');
            socket.end();
            resolve(); // Don't reject, just log warning
          } else if (response.includes('ERR')) {
            logger.error({ response }, 'Tor control error');
            socket.end();
            reject(new Error(`Tor control error: ${response}`));
          }
        });

        socket.on('error', (error) => {
          logger.error({ error }, 'Tor control socket error');
          reject(error);
        });

        socket.on('timeout', () => {
          logger.warn('Tor control socket timeout');
          socket.end();
          reject(new Error('Tor control timeout'));
        });
      });
    } catch (error) {
      logger.error({ error }, 'Failed to change Tor circuit');
      throw error;
    }
  }

  /**
   * Get current IP address through Tor
   */
  async getCurrentIP(): Promise<string | null> {
    if (!this.config.enabled || !this.agent) return null;

    try {
      const response = await fetch('https://httpbin.org/ip', {
        agent: this.agent,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as { origin: string };
      logger.debug({ ip: data.origin }, 'Current Tor IP');
      return data.origin;
    } catch (error) {
      logger.error({ error }, 'Failed to get current IP through Tor');
      return null;
    }
  }

  /**
   * Test Tor connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.config.enabled || !this.agent) return false;

    try {
      const response = await fetch('https://check.torproject.org/', {
        agent: this.agent,
        timeout: 10000,
      });

      const text = await response.text();
      const isUsingTor = text.includes('Congratulations. This browser is configured to use Tor.');

      logger.info({ isUsingTor }, 'Tor connection test completed');
      return isUsingTor;
    } catch (error) {
      logger.error({ error }, 'Tor connection test failed');
      return false;
    }
  }

  /**
   * Get proxy agent for HTTP requests
   */
  getAgent(): SocksProxyAgent | null {
    return this.config.enabled ? this.agent : null;
  }

  /**
   * Create fetch options with Tor proxy
   */
  getFetchOptions(options: RequestInit = {}): RequestInit {
    if (!this.config.enabled || !this.agent) {
      return options;
    }

    return {
      ...options,
      agent: this.agent,
    };
  }

  /**
   * Check if Tor is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Stop Tor proxy and cleanup
   */
  async stop(): Promise<void> {
    if (this.circuitChangeTimer) {
      clearInterval(this.circuitChangeTimer);
      this.circuitChangeTimer = null;
    }

    this.agent = null;
    logger.info('Tor proxy stopped');
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    enabled: boolean;
    socksEndpoint: string;
    controlEndpoint: string;
    circuitRotationEnabled: boolean;
    circuitRotationInterval?: number;
  } {
    return {
      enabled: this.config.enabled,
      socksEndpoint: `${this.config.socksHost}:${this.config.socksPort}`,
      controlEndpoint: `${this.config.controlHost}:${this.config.controlPort}`,
      circuitRotationEnabled: !!this.circuitChangeTimer,
      circuitRotationInterval: this.config.changeCircuitInterval,
    };
  }
}
