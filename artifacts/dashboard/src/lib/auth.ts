import { useState, useEffect } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export function initAuth() {
  setAuthTokenGetter(() => localStorage.getItem("dash_token"));
}

export function setToken(token: string) {
  localStorage.setItem("dash_token", token);
}

export function clearToken() {
  localStorage.removeItem("dash_token");
}

export function getToken() {
  return localStorage.getItem("dash_token");
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getToken());

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!getToken());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return { isAuthenticated };
}
