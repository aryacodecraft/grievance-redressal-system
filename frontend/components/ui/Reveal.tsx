"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveals its children once when they scroll into view.
 *
 * Presentational only — no timers, no data. Children start hidden through
 * `data-reveal="pending"` (globals.css) and transition in when the wrapper
 * enters the viewport. Reduced-motion users, browsers without
 * IntersectionObserver and JavaScript-disabled clients see the content
 * immediately, so it can never be stuck invisible.
 */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Browsers without IntersectionObserver reveal through a callback (never
    // a synchronous setState). Reduced motion is handled entirely in CSS.
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={visible ? "visible" : "pending"}
      className={className}
    >
      {children}
    </div>
  );
}
