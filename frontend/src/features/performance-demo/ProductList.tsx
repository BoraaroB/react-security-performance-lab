import { memo, useEffect, useRef } from 'react';
import { Badge, Button } from '@/components/ui';

export type ProductListProps = {
  title: string;
  products: string[];
  onSelect: (product: string) => void;
};

// Enough to see the list, few enough that three lists stay readable.
const VISIBLE_COUNT = 6;

export function ProductList({ title, products, onSelect }: ProductListProps) {
  const renderCount = useRef(0);
  const renderCountLabel = useRef<HTMLSpanElement>(null);

  // No dependency array: runs after every render that reached the screen, so it counts them.
  // It writes to the DOM, not to state: a setState here would cause one more render, which would count itself forever.
  useEffect(() => {
    renderCount.current += 1;
    if (renderCountLabel.current) {
      renderCountLabel.current.textContent = `Renders: ${renderCount.current}`;
    }
  });

  return (
    <section className="space-y-2 rounded border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <Badge ref={renderCountLabel}>Renders: 0</Badge>
      </div>
      <p className="text-xs text-gray-600">{products.length} matches</p>
      <div className="flex flex-wrap gap-1">
        {products.slice(0, VISIBLE_COUNT).map((product) => (
          <Button key={product} variant="secondary" size="sm" onClick={() => onSelect(product)}>
            {product}
          </Button>
        ))}
      </div>
    </section>
  );
}

// Same component, but React skips its render when every prop is the same (Object.is) as last time.
export const MemoProductList = memo(ProductList);
