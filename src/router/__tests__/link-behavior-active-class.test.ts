import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Link } from '../link.behavior';
import { Router } from '../router';
import { Trie } from '../trie';
import { PolicyEvaluator } from '../policy-evaluator';
import { signal } from '../../reactivity/signals/signal';

describe('Link Behavior - Active Class', () => {
  let mockRouter: Router;
  let mockTrie: Trie;
  let linkInstance: Link;
  let anchorElement: HTMLAnchorElement;

  beforeEach(() => {
    // Create a real anchor element
    anchorElement = document.createElement('a');

    // Create mock Trie
    mockTrie = new Trie();

    // Register the route pattern in the trie
    mockTrie.insert(
      'products-page',
      '/store/:storeId/products',
      async () => ({ default: class {} }),
      {},
      [],
      undefined
    );

    // Create mock PolicyEvaluator
    const mockPolicyEvaluator = {} as PolicyEvaluator;

    // Create router instance
    mockRouter = new Router();
    (mockRouter as any).routeTrie = mockTrie;
    (mockRouter as any).policyEvaluator = mockPolicyEvaluator;
    (mockRouter as any).hasInitialized = true;
    (mockRouter as any).routesLoaded = true;

    // Set the current pathname to the actual URL
    mockRouter.pathname = '/store/512e8b88-04be-4c92-9e33-b8bb6a38bcf9/products';
    mockRouter.search = '';

    // Manually initialize $routeCandidates
    const match = mockTrie.find(mockRouter.pathname);
    if (match) {
      const maxDepth = mockTrie.maxDepth;
      mockRouter.$routeCandidates = [];
      for (let i = 0; i < maxDepth; i++) {
        mockRouter.$routeCandidates[i] = match.candidatesByLevel[i] || [];
      }
    }

    // Create Link behavior instance
    linkInstance = new Link();
    linkInstance.el = anchorElement;
    linkInstance.href = 'products';
    linkInstance.activeClass = 'active';
    (linkInstance as any).router = mockRouter;
  });

  it('should have activePatterns from router', () => {
    console.log('Router activePatterns:', mockRouter.activePatterns);
    console.log('Router pathname:', mockRouter.pathname);
    console.log('Router $routeCandidates:', mockRouter.$routeCandidates);

    expect(mockRouter.activePatterns).toBeDefined();
    expect(mockRouter.activePatterns.length).toBeGreaterThan(0);
  });

  it('should resolve relative href correctly', () => {
    const resolvedHref = (linkInstance as any).resolveHref('products');

    console.log('Original href:', 'products');
    console.log('Current pathname:', mockRouter.pathname);
    console.log('Resolved href:', resolvedHref);

    // Should resolve to /store/512e8b88-04be-4c92-9e33-b8bb6a38bcf9/products
    expect(resolvedHref).toBe('/store/512e8b88-04be-4c92-9e33-b8bb6a38bcf9/products');
  });

  it('should match pattern correctly', () => {
    const href = '/store/512e8b88-04be-4c92-9e33-b8bb6a38bcf9/products';
    const pattern = '/store/:storeId/products';

    const matches = (linkInstance as any).matchPattern(href, pattern);

    console.log('Testing matchPattern:');
    console.log('  href:', href);
    console.log('  pattern:', pattern);
    console.log('  matches:', matches);

    expect(matches).toBe(true);
  });

  it('should detect link as active', () => {
    // Initialize the behavior
    linkInstance.onInit();

    console.log('\n=== Testing isActive ===');
    const isActive = linkInstance.isActive;

    console.log('Link isActive:', isActive);
    console.log('Element classes:', anchorElement.className);

    expect(isActive).toBe(true);
  });

  it('should apply active class when link is active', () => {
    // Initialize the behavior (this calls onInit and sets up the Effect)
    linkInstance.onInit();

    console.log('\n=== After onInit ===');
    console.log('Link isActive:', linkInstance.isActive);
    console.log('Element classes:', anchorElement.className);
    console.log('Expected classes:', 'active');

    // The active class should be applied
    expect(anchorElement.classList.contains('active')).toBe(true);
  });

  it('should NOT be active when href does not match', () => {
    // Change to a different page
    linkInstance.href = 'sales';
    linkInstance.onInit();

    console.log('\n=== Testing non-active link ===');
    console.log('Link href:', linkInstance.href);
    console.log('Link isActive:', linkInstance.isActive);
    console.log('Element classes:', anchorElement.className);

    expect(linkInstance.isActive).toBe(false);
    expect(anchorElement.classList.contains('active')).toBe(false);
  });

  it('should update active class when pathname changes', () => {
    // Start on products page
    linkInstance.href = 'products';
    linkInstance.onInit();

    console.log('\n=== Initial state (products page) ===');
    console.log('isActive:', linkInstance.isActive);
    console.log('classes:', anchorElement.className);
    expect(anchorElement.classList.contains('active')).toBe(true);

    // Navigate to sales page
    mockRouter.pathname = '/store/512e8b88-04be-4c92-9e33-b8bb6a38bcf9/sales';

    // Need to manually update routeCandidates for the new path
    mockTrie.insert(
      'sales-page',
      '/store/:storeId/sales',
      async () => ({ default: class {} }),
      {},
      [],
      undefined
    );
    const match = mockTrie.find(mockRouter.pathname);
    if (match) {
      const maxDepth = mockTrie.maxDepth;
      for (let i = 0; i < maxDepth; i++) {
        mockRouter.$routeCandidates[i] = match.candidatesByLevel[i] || [];
      }
    }

    console.log('\n=== After navigation to sales ===');
    console.log('New pathname:', mockRouter.pathname);
    console.log('isActive:', linkInstance.isActive);
    console.log('classes:', anchorElement.className);

    // The Effect should automatically remove the active class
    expect(linkInstance.isActive).toBe(false);
    expect(anchorElement.classList.contains('active')).toBe(false);
  });
});
