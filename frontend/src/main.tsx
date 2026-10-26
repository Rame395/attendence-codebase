import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";

// Geist Sans - self-hosted via @fontsource (variable weights 300-800)
import "@fontsource/geist-sans/300.css";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-sans/700.css";
import "@fontsource/geist-sans/800.css";

import "./assets/global.css";

// Capture PWA install prompt before React mounts — must be first side-effect
import "./lib/pwa/captureInstallPrompt";

import RouterConfig from "./config/Router";
import { Provider, useDispatch } from "react-redux";
import store, { type AppDispatch } from "./config/store";
import { Toaster } from "sonner";
import { fetchCompanySettings } from "./lib/reducers/companySetting-reducer";
import PWAUpdatePrompt from "./components/pwa/PWAUpdatePrompt";

// app load huda company settings fetch garne
function AppInit() {
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    dispatch(fetchCompanySettings());
  }, [dispatch]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <AppInit />
      <PWAUpdatePrompt />
      <Toaster richColors closeButton position="bottom-right" />
      <RouterConfig />
    </Provider>
  </StrictMode>,
);
