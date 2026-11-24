import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { useEventListener } from '@/hooks/useEventListener';
import { useInterval } from '@/hooks/useInterval';

// Module scope, so the counts survive when the trackers unmount (that is what the demo measures).
let leakyListenersAdded = 0;
let leakyCalls = 0;
let fixedCalls = 0;

function LeakyTracker() {
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    leakyListenersAdded += 1;
    // BUG on purpose: no cleanup. After unmount, window still holds this listener (and its closure with this
    // component's setMoves) until the page reloads. Every mount adds one more listener.
    window.addEventListener('pointermove', () => {
      leakyCalls += 1;
      setMoves((current) => current + 1);
    });
  }, []);

  return <p className="text-sm text-gray-700">Leaky tracker: {moves} moves</p>;
}

function FixedTracker() {
  const [moves, setMoves] = useState(0);

  // useEventListener removes the listener on unmount.
  useEventListener('pointermove', () => {
    fixedCalls += 1;
    // Functional update: several moves can arrive before React re-renders, and each must count.
    setMoves((current) => current + 1);
  });

  return <p className="text-sm text-gray-700">Fixed tracker: {moves} moves</p>;
}

export function ListenerLeakDemo() {
  const [areTrackersShown, setAreTrackersShown] = useState(true);
  // Starts from the current counters, so coming back to this page does not show 0 for a second.
  const [stats, setStats] = useState(() => ({
    leakyListeners: leakyListenersAdded,
    leakyCalls: leakyCalls,
    fixedCalls: fixedCalls,
  }));

  // Copies the module counters into state, so the numbers keep updating while the trackers are hidden.
  useInterval(() => {
    setStats({
      leakyListeners: leakyListenersAdded,
      leakyCalls: leakyCalls,
      fixedCalls: fixedCalls,
    });
  }, 1000);

  return (
    <Card className="space-y-4">
      <h2 className="font-medium text-gray-900">Memory leak: an event listener without cleanup</h2>
      <p className="text-sm text-gray-600">
        Both trackers listen to mouse moves on window. Hide them and move the mouse: the fixed listener stops
        counting. The leaky one keeps running for a component that is gone, and every new mount adds one more
        listener, so each move adds more and more calls below (also on other pages). In development, StrictMode
        mounts each component twice, so each mount leaks two listeners and the leaky tracker counts 2 per move.
        Reload the page to remove them.
      </p>
      <Button variant="secondary" onClick={() => setAreTrackersShown(!areTrackersShown)}>
        {areTrackersShown ? 'Hide trackers (unmount)' : 'Show trackers (mount)'}
      </Button>
      {areTrackersShown && (
        <div className="space-y-1">
          <LeakyTracker />
          <FixedTracker />
        </div>
      )}
      <ul className="space-y-1 text-sm text-gray-700">
        <li>
          Leaky listeners added (none ever removed): {stats.leakyListeners}, total calls: {stats.leakyCalls}
        </li>
        <li>Fixed listener total calls: {stats.fixedCalls}</li>
      </ul>
    </Card>
  );
}
