"use client";

const MOBILE_VIEWPORT_QUERY = "(max-width: 600px), (pointer: coarse)";

export function focusMobileInput(element?: HTMLElement | null) {
  if (!element || typeof window === "undefined") return;

  const scrollIntoReadableArea = () => {
    const visualViewport = window.visualViewport;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const targetRect = element.getBoundingClientRect();
    const safePadding = 96;
    const targetMiddle = targetRect.top + targetRect.height / 2;
    const desiredMiddle = viewportTop + viewportHeight / 2;
    const belowSafeArea = targetRect.bottom > viewportTop + viewportHeight - safePadding;
    const aboveSafeArea = targetRect.top < viewportTop + 16;

    if (belowSafeArea || aboveSafeArea) {
      window.scrollBy({
        top: targetMiddle - desiredMiddle,
        behavior: "smooth",
      });
      return;
    }

    element.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });
  };

  window.setTimeout(scrollIntoReadableArea, 80);
  window.setTimeout(scrollIntoReadableArea, 320);
}

export function updateMobileKeyboardInset() {
  if (typeof window === "undefined") return;

  const visualViewport = window.visualViewport;
  const keyboardInset = visualViewport
    ? Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)
    : 0;

  document.documentElement.style.setProperty(
    "--mobile-keyboard-inset",
    `${Math.round(keyboardInset)}px`,
  );
}

export function watchMobileKeyboardInset() {
  if (typeof window === "undefined") return () => {};

  const shouldWatch =
    window.matchMedia?.(MOBILE_VIEWPORT_QUERY).matches ?? window.innerWidth <= 600;
  if (!shouldWatch) return () => {};

  const visualViewport = window.visualViewport;
  updateMobileKeyboardInset();

  visualViewport?.addEventListener("resize", updateMobileKeyboardInset);
  visualViewport?.addEventListener("scroll", updateMobileKeyboardInset);
  window.addEventListener("orientationchange", updateMobileKeyboardInset);

  return () => {
    visualViewport?.removeEventListener("resize", updateMobileKeyboardInset);
    visualViewport?.removeEventListener("scroll", updateMobileKeyboardInset);
    window.removeEventListener("orientationchange", updateMobileKeyboardInset);
    document.documentElement.style.removeProperty("--mobile-keyboard-inset");
  };
}
