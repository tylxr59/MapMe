import ipaddr from 'ipaddr.js';

export function isTrustedProxy(address: string, trustedCidrs: string[]): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }
    return trustedCidrs
      .map((cidr) => ipaddr.parseCIDR(cidr))
      .some(([network, prefix]) => {
        if (network.kind() !== parsed.kind()) return false;
        return parsed.match(network, prefix);
      });
  } catch {
    return false;
  }
}

export function proxyIdentity(
  headers: Headers,
  directAddress: string,
  header: string,
  trustedCidrs: string[]
): string | null {
  if (!isTrustedProxy(directAddress, trustedCidrs)) return null;
  const identity = headers.get(header)?.trim() ?? '';
  if (!identity || identity.length > 500 || /[\r\n\0]/.test(identity)) return null;
  return identity;
}
