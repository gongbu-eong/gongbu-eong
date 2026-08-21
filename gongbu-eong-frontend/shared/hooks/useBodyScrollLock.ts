"use client";

import { useEffect } from "react";

let lockCount = 0;
let savedScrollY = 0;
let previousRootOverflowX = "";
let previousRootOverflowY = "";
let previousBodyOverflow = "";
let previousBodyPosition = "";
let previousBodyTop = "";
let previousBodyWidth = "";

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof window === "undefined") return;

    lockCount += 1;

    if (lockCount === 1) {
      const root = document.documentElement;
      const body = document.body;
      const hasScrollbar = window.innerWidth > root.clientWidth;

      savedScrollY = window.scrollY;
      previousRootOverflowX = root.style.overflowX;
      previousRootOverflowY = root.style.overflowY;
      previousBodyOverflow = body.style.overflow;
      previousBodyPosition = body.style.position;
      previousBodyTop = body.style.top;
      previousBodyWidth = body.style.width;

      root.style.overflowX = "hidden";
      root.style.overflowY = hasScrollbar ? "scroll" : "hidden";
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${savedScrollY}px`;
      body.style.width = "100%";
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);

      if (lockCount !== 0) return;

      const root = document.documentElement;
      const body = document.body;

      root.style.overflowX = previousRootOverflowX;
      root.style.overflowY = previousRootOverflowY;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      window.scrollTo(0, savedScrollY);
    };
  }, [locked]);
}
