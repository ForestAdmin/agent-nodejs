import { ConditionTreeBranch, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import { UnsupportedOperatorError } from '../../src/errors';
import { translateConditionTree } from '../../src/query/condition-tree-translator';

describe('translateConditionTree', () => {
  describe('simple leaves', () => {
    it('translates Equal to "field:value"', () => {
      const tree = new ConditionTreeLeaf('status', 'Equal', 'open');

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe('status:open');
    });

    it('translates NotEqual to "-field:value"', () => {
      const tree = new ConditionTreeLeaf('status', 'NotEqual', 'closed');

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe('-status:closed');
    });

    it('translates GreaterThan to "field>value"', () => {
      const tree = new ConditionTreeLeaf('id', 'GreaterThan', 100);

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe('id>100');
    });

    it('translates LessThan to "field<value"', () => {
      const tree = new ConditionTreeLeaf('id', 'LessThan', 100);

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe('id<100');
    });

    it('translates After to "field>value"', () => {
      const date = new Date('2024-01-15T10:00:00.000Z');
      const tree = new ConditionTreeLeaf('created_at', 'After', date);

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe(
        'created_at>2024-01-15T10:00:00.000Z',
      );
    });

    it('translates Before to "field<value"', () => {
      const date = new Date('2024-01-15T10:00:00.000Z');
      const tree = new ConditionTreeLeaf('created_at', 'Before', date);

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe(
        'created_at<2024-01-15T10:00:00.000Z',
      );
    });

    it('translates Present to "field:*"', () => {
      const tree = new ConditionTreeLeaf('priority', 'Present');

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe('priority:*');
    });

    it('translates Blank to "-field:*"', () => {
      const tree = new ConditionTreeLeaf('priority', 'Blank');

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe('-priority:*');
    });

    it('translates In to space-separated field:value pairs', () => {
      const tree = new ConditionTreeLeaf('status', 'In', ['open', 'pending']);

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe(
        'status:open status:pending',
      );
    });

    it('translates NotIn to space-separated negated pairs', () => {
      const tree = new ConditionTreeLeaf('status', 'NotIn', ['open', 'pending']);

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe(
        '-status:open -status:pending',
      );
    });
  });

  describe('value formatting', () => {
    it('quotes string values containing spaces', () => {
      const tree = new ConditionTreeLeaf('subject', 'Equal', 'hello world');

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe('subject:"hello world"');
    });

    it('quotes string values containing colons', () => {
      const tree = new ConditionTreeLeaf('subject', 'Equal', 'foo:bar');

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe('subject:"foo:bar"');
    });

    it('escapes quotes inside string values', () => {
      const tree = new ConditionTreeLeaf('subject', 'Equal', 'hello "world"');

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe(
        'subject:"hello \\"world\\""',
      );
    });

    it('formats boolean true as "true"', () => {
      const tree = new ConditionTreeLeaf('verified', 'Equal', true);

      expect(translateConditionTree(tree, { resource: 'user' })).toBe('verified:true');
    });

    it('formats Date instances as ISO 8601 UTC', () => {
      const tree = new ConditionTreeLeaf(
        'updated_at',
        'Equal',
        new Date('2024-06-01T12:34:56.789Z'),
      );

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe(
        'updated_at:2024-06-01T12:34:56.789Z',
      );
    });
  });

  describe('special fields', () => {
    it('maps ticket requester_email Equal to requester:value', () => {
      const tree = new ConditionTreeLeaf('requester_email', 'Equal', 'foo@example.com');

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe(
        'requester:foo@example.com',
      );
    });

    it('throws on requester_email with non-Equal operator', () => {
      const tree = new ConditionTreeLeaf('requester_email', 'NotEqual', 'foo@example.com');

      expect(() => translateConditionTree(tree, { resource: 'ticket' })).toThrow(
        UnsupportedOperatorError,
      );
    });

    it('maps custom field column name to Zendesk custom_field_ID', () => {
      const mapping = new Map<string, string>([['custom_123', 'custom_field_123']]);
      const tree = new ConditionTreeLeaf('custom_123', 'Equal', 'foo');

      expect(
        translateConditionTree(tree, { resource: 'ticket', customFieldMapping: mapping }),
      ).toBe('custom_field_123:foo');
    });
  });

  describe('And branches', () => {
    it('joins And conditions with a space', () => {
      const tree = new ConditionTreeBranch('And', [
        new ConditionTreeLeaf('status', 'Equal', 'open'),
        new ConditionTreeLeaf('priority', 'Equal', 'high'),
      ]);

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe(
        'status:open priority:high',
      );
    });

    it('handles nested And branches', () => {
      const tree = new ConditionTreeBranch('And', [
        new ConditionTreeLeaf('status', 'Equal', 'open'),
        new ConditionTreeBranch('And', [
          new ConditionTreeLeaf('priority', 'Equal', 'high'),
          new ConditionTreeLeaf('assignee_id', 'GreaterThan', 10),
        ]),
      ]);

      expect(translateConditionTree(tree, { resource: 'ticket' })).toBe(
        'status:open priority:high assignee_id>10',
      );
    });
  });

  describe('unsupported cases', () => {
    it('throws when an Or branch is encountered', () => {
      const tree = new ConditionTreeBranch('Or', [
        new ConditionTreeLeaf('status', 'Equal', 'open'),
        new ConditionTreeLeaf('status', 'Equal', 'pending'),
      ]);

      expect(() => translateConditionTree(tree, { resource: 'ticket' })).toThrow(
        UnsupportedOperatorError,
      );
    });

    it('throws on an empty In array', () => {
      const tree = new ConditionTreeLeaf('status', 'In', []);

      expect(() => translateConditionTree(tree, { resource: 'ticket' })).toThrow(
        UnsupportedOperatorError,
      );
    });

    it('throws on a null value with Equal', () => {
      const tree = new ConditionTreeLeaf('status', 'Equal', null);

      expect(() => translateConditionTree(tree, { resource: 'ticket' })).toThrow(
        UnsupportedOperatorError,
      );
    });

    it('throws on an unsupported operator (Contains)', () => {
      const tree = new ConditionTreeLeaf('subject', 'Contains', 'foo');

      expect(() => translateConditionTree(tree, { resource: 'ticket' })).toThrow(
        UnsupportedOperatorError,
      );
    });
  });

  describe('empty tree', () => {
    it('returns an empty string when no tree is given', () => {
      expect(translateConditionTree(undefined, { resource: 'ticket' })).toBe('');
    });
  });
});
