import resolveClientIp from '../../../src/routes/security/client-ip';

describe('resolveClientIp', () => {
  describe('when the socket peer is a public address', () => {
    test.each(['9.9.9.9', '', '9.9.9.9, 10.20.15.10', '127.0.0.1'])(
      'resolves to the socket peer with header %s',
      forwardedFor => {
        expect(resolveClientIp('203.0.113.77', forwardedFor)).toBe('203.0.113.77');
      },
    );

    test('resolves to the socket peer when there is no header', () => {
      expect(resolveClientIp('203.0.113.77')).toBe('203.0.113.77');
    });

    test('resolves to an ipv6 socket peer', () => {
      expect(resolveClientIp('2001:db8::1', '9.9.9.9')).toBe('2001:db8::1');
    });

    test('resolves to an ipv4-mapped public socket peer', () => {
      expect(resolveClientIp('::ffff:203.0.113.5', '9.9.9.9')).toBe('::ffff:203.0.113.5');
    });
  });

  describe('when the socket peer is a trusted proxy', () => {
    test('resolves to the single hop behind a private proxy', () => {
      expect(resolveClientIp('10.0.0.2', '9.9.9.9')).toBe('9.9.9.9');
    });

    test('resolves to the rightmost untrusted hop of a multi-hop header', () => {
      expect(resolveClientIp('10.0.0.2', '9.9.9.9, 203.0.113.77')).toBe('203.0.113.77');
    });

    test('walks a chain of trusted proxies from the right', () => {
      expect(resolveClientIp('127.0.0.1', '9.9.9.9, 10.0.0.3')).toBe('9.9.9.9');
    });

    test('returns the leftmost hop when the whole chain is trusted', () => {
      expect(resolveClientIp('127.0.0.1', '10.0.0.3, 192.168.1.1')).toBe('10.0.0.3');
    });

    test.each([
      ['10.0.0.2', '172.16.0.5'],
      ['10.0.0.2', '192.168.1.1'],
      ['10.0.0.2', '127.0.0.99'],
      ['10.0.0.2', '169.254.1.1'],
      ['10.0.0.2', '::1'],
      ['fd00::1', '2001:db8::1'],
      ['fe80::1', '2001:db8::1'],
      ['10.0.0.2', 'fd12::1'],
      ['::ffff:10.0.0.2', '203.0.113.77'],
    ])('resolves to the hop behind trusted proxy socket %s', (socketIp, expected) => {
      expect(resolveClientIp(socketIp, expected)).toBe(expected);
    });

    test.each(['::ffff:10.0.0.3', '::ffff:a00:3', '::FFFF:10.0.0.3'])(
      'skips the ipv4-mapped trusted proxy hop %s while walking',
      mappedProxy => {
        expect(resolveClientIp('10.0.0.2', `203.0.113.77, ${mappedProxy}`)).toBe('203.0.113.77');
      },
    );

    test('trims the hops whatever the spacing', () => {
      expect(resolveClientIp('  10.0.0.2 ', '  203.0.113.77 ,  10.0.0.3  ')).toBe('203.0.113.77');
    });

    test('joins a repeated header and walks it from the right', () => {
      expect(resolveClientIp('10.0.0.2', ['203.0.113.77', '10.0.0.3'])).toBe('203.0.113.77');
    });
  });

  describe('when a hop is not a valid address', () => {
    test('returns a malformed hop met during the walk instead of skipping it', () => {
      expect(resolveClientIp('10.0.0.2', '9.9.9.9, not-an-ip')).toBe('not-an-ip');
    });

    test('returns a hop carrying a port instead of skipping it', () => {
      expect(resolveClientIp('10.0.0.2', '203.0.113.77:1234')).toBe('203.0.113.77:1234');
    });

    test('returns an empty slot met during the walk', () => {
      expect(resolveClientIp('10.0.0.2', ', 10.0.0.3')).toBe('');
    });

    test('returns an empty string when the socket cannot be read and no header exists', () => {
      expect(resolveClientIp('')).toBe('');
      expect(resolveClientIp('', undefined)).toBe('');
    });
  });
});
