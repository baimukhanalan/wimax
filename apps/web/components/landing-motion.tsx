"use client";

import { useEffect, useRef } from "react";

const revealSelector = [
  ".landing-flow > *",
  ".landing-manifesto > *",
  ".before-after-heading",
  ".before-card",
  ".after-card",
  ".journey-intro > *",
  ".journey-steps > article > *",
  ".story-copy",
  ".dashboard-preview",
  ".meeting-story",
  ".meeting-immersive-copy > *",
  ".meeting-stage",
  ".use-cases-heading",
  ".use-cases > article",
  ".knowledge-story > div",
  ".privacy-lead",
  ".privacy-story > article",
  ".apps-copy",
  ".download-option",
  ".registration-story > div",
  ".landing-final > div",
].join(",");

export function LandingMotion() {
  const progressRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const chapterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = progressRef.current?.closest<HTMLElement>(".landing-root");
    if (!root) return;

    const revealTargets = Array.from(root.querySelectorAll<HTMLElement>(revealSelector));
    revealTargets.forEach((element, index) => {
      element.dataset.motionReveal = "";
      element.style.setProperty("--motion-delay", `${(index % 5) * 70}ms`);
    });
    root.classList.add("motion-ready");
    requestAnimationFrame(() => root.classList.add("landing-loaded"));

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10%", threshold: 0.12 });
    revealTargets.forEach((element) => revealObserver.observe(element));

    const journeyArticles = Array.from(root.querySelectorAll<HTMLElement>(".journey-steps > article"));
    const setActiveJourney = (article: HTMLElement) => {
      const number = article.id.replace("journey-", "");
      journeyArticles.forEach((item) => item.classList.toggle("is-active", item === article));
      root.querySelectorAll<HTMLAnchorElement>(".journey-intro nav a").forEach((link) => {
        const active = link.hash === `#${article.id}`;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "step"); else link.removeAttribute("aria-current");
      });
      if (chapterRef.current) chapterRef.current.textContent = number;
    };
    const journeyObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveJourney(visible.target as HTMLElement);
    }, { rootMargin: "-32% 0px -32%", threshold: [0.05, 0.25, 0.5] });
    journeyArticles.forEach((article) => journeyObserver.observe(article));

    let frame = 0;
    const updateScroll = () => {
      frame = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / max));
      progressRef.current?.style.setProperty("transform", `scaleX(${progress})`);
      railRef.current?.style.setProperty("transform", `scaleY(${progress})`);
      root.style.setProperty("--landing-hero-shift", `${Math.min(window.scrollY * 0.045, 54)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateScroll);
    };
    updateScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      revealObserver.disconnect();
      journeyObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove("motion-ready", "landing-loaded");
    };
  }, []);

  return <>
    <div className="landing-scroll-progress" aria-hidden="true"><i ref={progressRef} /></div>
    <aside className="landing-scroll-rail" aria-hidden="true"><span ref={chapterRef}>01</span><div><i ref={railRef} /></div><small>SCROLL</small></aside>
  </>;
}
