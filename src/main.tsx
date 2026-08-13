import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Note: StrictMode intentionally removed. In dev mode it double-invokes
// effects, which causes the Agora client to join/leave/rejoin a live
// channel rapidly — producing a silent connection error that has nothing
// to do with the actual join logic. Safe to re-add for production if
// desired, since this behavior doesn't occur in a production build.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
