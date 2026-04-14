import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/ThemeProvider";
import { setupWebviewLogging } from "./logging/logger";
import "./index.css";

// Initialize logging before React render (per Research Pitfall 5)
// Catch errors so Electrobun RPC unavailability doesn't block rendering
try {
	await setupWebviewLogging();
} catch {
	// electrobun/view may not be available outside Electrobun runtime
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
