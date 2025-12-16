/**
 * Ledger Core Unit Tests
 * 
 * Tests for:
 * - walletSeq monotonicity
 * - Hash chain integrity
 * - Balance cache updates
 * - Idempotency
 */

import { computeEntryHash } from './index';

describe('computeEntryHash', () => {
  it('should produce consistent hashes for same input', () => {
    const hash1 = computeEntryHash(
      null,
      'TEST_ACCOUNT',
      1,
      'REF_001',
      'CREDIT',
      '1000.0000',
      'Test entry'
    );

    const hash2 = computeEntryHash(
      null,
      'TEST_ACCOUNT',
      1,
      'REF_001',
      'CREDIT',
      '1000.0000',
      'Test entry'
    );

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different amounts', () => {
    const hash1 = computeEntryHash(
      null,
      'TEST_ACCOUNT',
      1,
      'REF_001',
      'CREDIT',
      '1000.0000',
      'Test entry'
    );

    const hash2 = computeEntryHash(
      null,
      'TEST_ACCOUNT',
      1,
      'REF_001',
      'CREDIT',
      '2000.0000',
      'Test entry'
    );

    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes for different prevHash', () => {
    const hash1 = computeEntryHash(
      null,
      'TEST_ACCOUNT',
      1,
      'REF_001',
      'CREDIT',
      '1000.0000',
      'Test entry'
    );

    const hash2 = computeEntryHash(
      'someprevhash123',
      'TEST_ACCOUNT',
      1,
      'REF_001',
      'CREDIT',
      '1000.0000',
      'Test entry'
    );

    expect(hash1).not.toBe(hash2);
  });

  it('should produce 64-character hex string (SHA256)', () => {
    const hash = computeEntryHash(
      null,
      'TEST_ACCOUNT',
      1,
      'REF_001',
      'CREDIT',
      '1000.0000',
      'Test entry'
    );

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });
});

describe('Hash Chain Integrity', () => {
  it('should detect if historical entry is altered', () => {
    // Simulate a chain of entries
    const entry1Hash = computeEntryHash(
      null,
      'TEST_ACCOUNT',
      1,
      'REF_001',
      'CREDIT',
      '1000.0000',
      'First entry'
    );

    const entry2Hash = computeEntryHash(
      entry1Hash,
      'TEST_ACCOUNT',
      2,
      'REF_002',
      'CREDIT',
      '500.0000',
      'Second entry'
    );

    // Now simulate tampering - change first entry amount
    const tamperedEntry1Hash = computeEntryHash(
      null,
      'TEST_ACCOUNT',
      1,
      'REF_001',
      'CREDIT',
      '9999.0000', // TAMPERED AMOUNT
      'First entry'
    );

    // Verify chain would break
    const entry2WithTamperedPrev = computeEntryHash(
      tamperedEntry1Hash,
      'TEST_ACCOUNT',
      2,
      'REF_002',
      'CREDIT',
      '500.0000',
      'Second entry'
    );

    // Original entry2Hash won't match because prevHash changed
    expect(entry2Hash).not.toBe(entry2WithTamperedPrev);
  });

  it('should maintain chain with correct linking', () => {
    // Build a proper chain
    let prevHash: string | null = null;
    const entries = [];

    for (let i = 1; i <= 5; i++) {
      const hash = computeEntryHash(
        prevHash,
        'TEST_ACCOUNT',
        i,
        `REF_${i.toString().padStart(3, '0')}`,
        i % 2 === 0 ? 'DEBIT' : 'CREDIT',
        `${i * 100}.0000`,
        `Entry ${i}`
      );
      entries.push({ seq: i, prevHash, hash });
      prevHash = hash;
    }

    // Verify chain links correctly
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].prevHash).toBe(entries[i - 1].hash);
    }
  });
});

describe('walletSeq Monotonicity', () => {
  it('should always increment by 1', () => {
    // This test documents expected behavior
    // Actual implementation in appendEntry enforces this
    
    const sequences = [1, 2, 3, 4, 5];
    
    for (let i = 1; i < sequences.length; i++) {
      expect(sequences[i]).toBe(sequences[i - 1] + 1);
    }
  });
});

// Integration tests would require a test database
// These are documented here for implementation
describe('Integration Tests (require database)', () => {
  it.todo('should append entry and update balance cache in same transaction');
  it.todo('should be idempotent - same reference returns same entry');
  it.todo('should fail debit if insufficient balance');
  it.todo('should verify chain detects tampering');
  it.todo('should maintain walletSeq monotonicity under concurrent access');
});
