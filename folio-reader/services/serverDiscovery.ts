/**
 * Server Discovery Service
 * Scans local network for Kavita and Audiobookshelf instances
 * Uses "poor man's discovery" - scanning common local IP ranges
 */

import axios from 'axios';

export interface DiscoveredServer {
  url: string;
  type: 'kavita' | 'abs';
  name?: string;
  version?: string;
}

// Common ports for each service
const KAVITA_PORTS = [5000, 13378, 8080, 3000];
const ABS_PORTS = [13378, 5000, 8080, 3000];

// Common local network ranges
const COMMON_RANGES = [
  '192.168.1',
  '192.168.0',
  '192.168.50',
  '10.0.0',
  '10.0.1',
];

// Tailscale IP ranges (100.64.0.0/10 CGNAT range)
const TAILSCALE_RANGES = [
  '100.64',
  '100.65',
  '100.66',
  '100.67',
  '100.68',
  '100.69',
  '100.70',
  '100.71',
  '100.72',
  '100.73',
  '100.74',
  '100.75',
  '100.76',
  '100.77',
  '100.78',
  '100.79',
  '100.80',
  '100.81',
  '100.82',
  '100.83',
  '100.84',
  '100.85',
  '100.86',
  '100.87',
  '100.88',
  '100.89',
  '100.90',
  '100.91',
  '100.92',
  '100.93',
  '100.94',
  '100.95',
  '100.96',
  '100.97',
  '100.98',
  '100.99',
  '100.100',
  '100.101',
  '100.102',
  '100.103',
  '100.104',
  '100.105',
  '100.106',
  '100.107',
  '100.108',
  '100.109',
  '100.110',
  '100.111',
  '100.112',
  '100.113',
  '100.114',
  '100.115',
  '100.116',
  '100.117',
  '100.118',
  '100.119',
  '100.120',
  '100.121',
  '100.122',
  '100.123',
  '100.124',
  '100.125',
  '100.126',
  '100.127',
];

const TIMEOUT_MS = 2000;

/**
 * Try to detect if a server at URL is Kavita or ABS
 */
async function detectServerType(url: string): Promise<DiscoveredServer | null> {
  const client = axios.create({
    timeout: TIMEOUT_MS,
    validateStatus: () => true, // Accept any status
  });

  try {
    // Try ABS status endpoint first (doesn't require auth)
    const absRes = await client.get(`${url}/api/status`);
    if (absRes.status === 200 && absRes.data?.version) {
      return {
        url,
        type: 'abs',
        name: 'AudioBookShelf',
        version: absRes.data.version,
      };
    }
  } catch {
    // Continue to try Kavita
  }

  try {
    // Try Kavita - check if /api/health or root responds
    const kavitaRes = await client.get(`${url}/api/health`);
    if (kavitaRes.status === 200 || kavitaRes.status === 401) {
      return {
        url,
        type: 'kavita',
        name: 'Kavita',
      };
    }
  } catch {
    // Not Kavita either
  }

  return null;
}

/**
 * Scan a specific IP:port combination
 */
async function scanAddress(ip: string, port: number): Promise<DiscoveredServer | null> {
  const httpUrl = `http://${ip}:${port}`;
  const httpsUrl = `https://${ip}:${port}`;

  // Try HTTP first (most home servers run HTTP)
  const httpResult = await detectServerType(httpUrl);
  if (httpResult) return httpResult;

  // Try HTTPS as fallback
  const httpsResult = await detectServerType(httpsUrl);
  if (httpsResult) return httpsResult;

  return null;
}

/**
 * Scan common local network ranges for servers
 * This is a "poor man's mDNS" - works well for home networks
 */
export async function discoverServers(): Promise<DiscoveredServer[]> {
  const discovered: DiscoveredServer[] = [];
  const foundUrls = new Set<string>();

  // Generate IP addresses to scan
  const addressesToScan: { ip: string; port: number; type: 'kavita' | 'abs' }[] = [];

  // Scan common local ranges
  for (const range of COMMON_RANGES) {
    // Scan .1 - .50 to keep it reasonable (most home routers use low IPs)
    for (let i = 1; i <= 50; i++) {
      const ip = `${range}.${i}`;
      for (const port of KAVITA_PORTS) {
        addressesToScan.push({ ip, port, type: 'kavita' });
      }
      for (const port of ABS_PORTS) {
        addressesToScan.push({ ip, port, type: 'abs' });
      }
    }
  }

  // Scan Tailscale ranges (100.x.x.x) - these have more entropy so scan wider
  // Tailscale IPs are 100.64.0.0/10, commonly 100.x.y.z where x is 64-127
  // We scan a subset since the space is large
  for (const range of TAILSCALE_RANGES) {
    // Scan .1 - .20 for Tailscale (more hosts possible, but limit to keep scan fast)
    for (let i = 1; i <= 20; i++) {
      for (let j = 1; j <= 5; j++) {
        const ip = `${range}.${i}.${j}`;
        for (const port of KAVITA_PORTS) {
          addressesToScan.push({ ip, port, type: 'kavita' });
        }
        for (const port of ABS_PORTS) {
          addressesToScan.push({ ip, port, type: 'abs' });
        }
      }
    }
  }

  // Limit concurrent requests to avoid overwhelming the network
  const BATCH_SIZE = 10;

  for (let i = 0; i < addressesToScan.length; i += BATCH_SIZE) {
    const batch = addressesToScan.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async ({ ip, port }) => {
        const result = await scanAddress(ip, port);
        return result;
      })
    );

    for (const result of results) {
      if (result && !foundUrls.has(result.url)) {
        foundUrls.add(result.url);
        discovered.push(result);
      }
    }

    // Small delay between batches to be network-friendly
    if (i + BATCH_SIZE < addressesToScan.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Early exit if we found a reasonable number of servers
    if (discovered.length >= 5) {
      break;
    }
  }

  return discovered;
}

/**
 * Quick scan - just check localhost and common ports
 * Much faster than full network scan
 */
export async function quickDiscover(): Promise<DiscoveredServer[]> {
  const discovered: DiscoveredServer[] = [];

  // Check localhost first (common for development)
  const localhostChecks = [
    { url: 'http://localhost:5000', type: 'kavita' as const },
    { url: 'http://localhost:13378', type: 'abs' as const },
    { url: 'http://127.0.0.1:5000', type: 'kavita' as const },
    { url: 'http://127.0.0.1:13378', type: 'abs' as const },
  ];

  for (const check of localhostChecks) {
    const result = await detectServerType(check.url);
    if (result) {
      discovered.push(result);
    }
  }

  return discovered;
}

/**
 * Get the device's local IP subnet for smarter scanning
 * This helps focus scanning on the right network
 */
export function getLikelySubnet(): string[] {
  // In a real implementation, we might use react-native-network-info
  // For now, return common home network prefixes
  return COMMON_RANGES;
}
