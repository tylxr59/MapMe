import ipaddr from 'ipaddr.js';
import { privateConfig } from '$lib/server/config/private';

const trustedRanges = privateConfig.authProxyTrustedCidrs.map((cidr) => {
  try {
    return ipaddr.parseCIDR(cidr);
  } catch {
    throw new Error(`Invalid AUTH_PROXY_TRUSTED_CIDRS entry: ${cidr}`);
  }
});

export function isTrustedProxy(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }
    return trustedRanges.some(([network, prefix]) => {
      if (network.kind() !== parsed.kind()) return false;
      return parsed.match(network, prefix);
    });
  } catch {
    return false;
  }
}

export function proxyIdentity(headers: Headers, directAddress: string): string | null {
  if (!isTrustedProxy(directAddress)) return null;
  const identity = headers.get(privateConfig.authProxyHeader)?.trim() ?? '';
  if (!identity || identity.length > 500 || /[\r\n\0]/.test(identity)) return null;
  return identity;
}
