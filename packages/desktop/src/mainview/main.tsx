import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { resolveTheme } from "../../../../shared/themeSchema";
import App from "./App";
import { ThemeProvider } from "./components/ThemeProvider";
import { setupWebviewLogging } from "./logging/logger";
import { applyTheme } from "./theme/applyTheme";
import { DEFAULT_THEME_ID, themeForId } from "./themes";
import "./index.css";

// Themes are data (v0.8.3 Phase 3): the stylesheet carries no token values,
// so paint the default before anything renders. ThemeProvider repaints once
// the saved preference arrives.
applyTheme(resolveTheme(themeForId(DEFAULT_THEME_ID)), DEFAULT_THEME_ID);

// Initialize logging before React render (per Research Pitfall 5)
// Catch errors so Electrobun RPC unavailability doesn't block rendering
try {
	await setupWebviewLogging();
} catch (e) {
	console.warn(
		"[logging] setupWebviewLogging failed — RPC forwarding disabled:",
		e,
	);
}

const rootEl = document.getElementById("root");
if (!rootEl) {
	throw new Error("Root element #root not found in document");
}

createRoot(rootEl).render(
	<StrictMode>
		<ThemeProvider>
			<App />
		</ThemeProvider>
	</StrictMode>,
);
