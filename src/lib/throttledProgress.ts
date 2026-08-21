/** Wraps a progress callback so it only fires when the reported fraction
 * crosses a new step (5% by default) instead of on every raw XHR progress
 * event, which can fire dozens of times per second for a multi-MB upload.
 * Each such call flows into React state and (for wizard photos) a
 * synchronous sessionStorage autosave — throttling keeps that cheap while
 * still animating the bar smoothly enough to look real. */
export function throttledProgress(
  onProgress: (fraction: number) => void,
  step = 0.05
): (fraction: number) => void {
  let last = -1;
  return (fraction: number) => {
    const stepped = Math.round(fraction / step) * step;
    if (stepped === last) return;
    last = stepped;
    onProgress(fraction);
  };
}
