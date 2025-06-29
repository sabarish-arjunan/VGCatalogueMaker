import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Optional: Import service worker register
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker to make it a PWA
serviceWorkerRegistration.register();
