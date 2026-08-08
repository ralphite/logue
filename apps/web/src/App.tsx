import { LandingPage } from "./landing/LandingPage";
import { LogueApp } from "./app/LogueApp";

function isPublicLanding() {
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "logue.ai" ||
    hostname === "www.logue.ai" ||
    new URLSearchParams(window.location.search).get("view") === "landing"
  );
}

export function App() {
  return isPublicLanding() ? <LandingPage /> : <LogueApp />;
}
