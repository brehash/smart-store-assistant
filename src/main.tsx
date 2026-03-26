import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply theme before render to prevent flash
const saved = localStorage.getItem("theme") || "system";
const isDark = saved === "dark" || (saved === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark", isDark);

createRoot(document.getElementById("root")!).render(<App />);
