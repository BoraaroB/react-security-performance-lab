import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { useInterval } from '@/hooks/useInterval';

// Module scope, so the counts survive when the timers unmount (that is what the demo measures).
let leakyIntervalsStarted = 0;
let leakyTicks = 0;
let fixedTicks = 0;

function LeakyTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    leakyIntervalsStarted += 1;
    // BUG on purpose: no cleanup. After unmount this interval runs until the page reloads, and it keeps its
    // closure (with this component's setSeconds and state) in memory. Every mount adds one more interval.
    setInterval(() => {
      leakyTicks += 1;
      setSeconds((current) => current + 1);
    }, 1000);
  }, []);

  return <p className="text-sm text-gray-700">Leaky timer: {seconds} s</p>;
}

function FixedTimer() {
  const [seconds, setSeconds] = useState(0);

  // useInterval clears the interval on unmount.
  useInterval(() => {
    fixedTicks += 1;
    setSeconds(seconds + 1);
  }, 1000);

  return <p className="text-sm text-gray-700">Fixed timer: {seconds} s</p>;
}

export function IntervalLeakDemo() {
  const [areTimersShown, setAreTimersShown] = useState(true);
  // Starts from the current counters, so coming back to this page does not show 0 for a second.
  const [stats, setStats] = useState(() => ({
    leakyIntervals: leakyIntervalsStarted,
    leakyTicks: leakyTicks,
    fixedTicks: fixedTicks,
  }));

  // Copies the module counters into state, so the numbers keep updating while the timers are hidden.
  useInterval(() => {
    setStats({
      leakyIntervals: leakyIntervalsStarted,
      leakyTicks: leakyTicks,
      fixedTicks: fixedTicks,
    });
  }, 1000);

  return (
    <Card className="space-y-4">
      <h2 className="font-medium text-gray-900">Memory leak: an interval without cleanup</h2>
      <p className="text-sm text-gray-600">
        Hide the timers and watch the counters below. The fixed timer stops ticking. The leaky one keeps ticking
        for a component that is gone, and every new mount adds one more interval, so the total ticks below grow
        faster and faster (also on other pages). In development, StrictMode mounts each component twice to find missing cleanups,
        so each mount leaks two intervals and the leaky timer counts 2 per second. Reload the page to stop them.
      </p>
      <Button variant="secondary" onClick={() => setAreTimersShown(!areTimersShown)}>
        {areTimersShown ? 'Hide timers (unmount)' : 'Show timers (mount)'}
      </Button>
      {areTimersShown && (
        <div className="space-y-1">
          <LeakyTimer />
          <FixedTimer />
        </div>
      )}
      <ul className="space-y-1 text-sm text-gray-700">
        <li>
          Leaky intervals started (none ever cleared): {stats.leakyIntervals}, total ticks: {stats.leakyTicks}
        </li>
        <li>Fixed timer total ticks: {stats.fixedTicks}</li>
      </ul>
    </Card>
  );
}
