import { BlockList, isIP, isIPv6 } from 'net';

const TRUSTED_PROXY_SUBNETS: [ip: string, prefix: number, type: 'ipv4' | 'ipv6'][] = [
  ['127.0.0.0', 8, 'ipv4'],
  ['10.0.0.0', 8, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'],
  ['::1', 128, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
];

const trustedProxies = new BlockList();
TRUSTED_PROXY_SUBNETS.forEach(([ip, prefix, type]) => trustedProxies.addSubnet(ip, prefix, type));

const IPV4_MAPPED_PREFIX = '::ffff:';

const unmapIpv4 = (ip: string): string =>
  ip.toLowerCase().startsWith(IPV4_MAPPED_PREFIX) ? ip.slice(IPV4_MAPPED_PREFIX.length) : ip;

const isTrustedProxy = (ip: string): boolean => {
  const candidate = unmapIpv4(ip.trim());

  return (
    isIP(candidate) !== 0 && trustedProxies.check(candidate, isIPv6(candidate) ? 'ipv6' : 'ipv4')
  );
};

const resolveClientIp = (socketIp: string, forwardedFor?: string | string[]): string => {
  const header = `${forwardedFor ?? ''}`;
  const hops = header === '' ? [] : header.split(',').map(hop => hop.trim());

  hops.push(socketIp.trim());

  let index = hops.length - 1;

  while (index > 0 && isTrustedProxy(hops[index])) {
    index -= 1;
  }

  return hops[index];
};

export default resolveClientIp;
