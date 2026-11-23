import { useCallback, useMemo, useState } from 'react';
import { Button, Card, FormField, Input } from '@/components/ui';
import { MemoProductList, ProductList } from './ProductList';

// 5,000 so filtering does real work (what useMemo saves). Built once when the module loads, not on every render.
const PRODUCTS = Array.from({ length: 5000 }, (_, index) => `Product ${index + 1}`);

function filterProducts(query: string): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  return PRODUCTS.filter((product) => product.toLowerCase().includes(normalizedQuery));
}

export function MemoDemo() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [clickCount, setClickCount] = useState(0);

  // Runs on every render of this component and returns a NEW array each time, even for the same query.
  const productsEveryRender = filterProducts(query);
  // Runs again only when `query` changes; otherwise React returns the same array as last time.
  const productsMemoized = useMemo(() => filterProducts(query), [query]);
  // The same function on every render. setSelected never changes, so the dependency list is empty.
  const handleSelectStable = useCallback((product: string) => setSelected(product), []);

  return (
    <Card className="space-y-4">
      <h2 className="font-medium text-gray-900">memo, useMemo and useCallback</h2>
      <p className="text-sm text-gray-600">
        When this card re-renders, every child re-renders too, even if its props look the same. memo() skips a
        child whose props are the same objects as last time. A new array or a new arrow function on every render
        is a different object, so memo() alone does not help: useMemo keeps the array, useCallback keeps the
        function. (In development, StrictMode mounts twice, so each counter starts at 2.)
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setClickCount((count) => count + 1)}>
          Re-render this card ({clickCount})
        </Button>
        <span className="text-sm text-gray-700">Selected: {selected ?? 'none'}</span>
      </div>
      <FormField label="Filter products (changes the props, so all three lists must re-render)">
        {(control) => <Input value={query} onChange={(event) => setQuery(event.target.value)} {...control} />}
      </FormField>

      <ProductList
        title="1. No memo"
        products={productsEveryRender}
        onSelect={(product) => setSelected(product)}
      />
      <MemoProductList
        title="2. memo, but new props on every render"
        products={productsEveryRender}
        onSelect={(product) => setSelected(product)}
      />
      <MemoProductList
        title="3. memo + useMemo + useCallback"
        products={productsMemoized}
        onSelect={handleSelectStable}
      />
    </Card>
  );
}
