import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { PopupProvider } from "./context/PopupContext";
import PopupNotification from "./components/PopupNotification";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PopupProvider>
          <App />
          <PopupNotification />
        </PopupProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
