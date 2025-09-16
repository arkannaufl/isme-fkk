import React from "react";
import MaintenancePage from "./MaintenancePage";

interface MaintenanceGuardProps {
  children: React.ReactNode;
  isMaintenanceMode?: boolean;
  maintenanceConfig?: {
    title?: string;
    message?: string;
    showIcon?: boolean;
  };
}

export default function MaintenanceGuard({
  children,
  isMaintenanceMode = false,
  maintenanceConfig = {},
}: MaintenanceGuardProps) {
  // Check if maintenance mode is enabled
  // You can also check from localStorage, environment variables, or API
  const checkMaintenanceMode = () => {
    // Option 1: Check from localStorage (can be set by admin)
    const maintenanceFromStorage = localStorage.getItem("maintenance_mode");
    if (maintenanceFromStorage === "true") {
      return true;
    }

    // Option 2: Check from environment variable
    const maintenanceFromEnv = import.meta.env.VITE_MAINTENANCE_MODE;
    if (maintenanceFromEnv === "true") {
      return true;
    }

    // Option 3: Use the prop value
    return isMaintenanceMode;
  };

  const isMaintenance = checkMaintenanceMode();

  if (isMaintenance) {
    return <MaintenancePage {...maintenanceConfig} />;
  }

  return <>{children}</>;
}

// Utility functions for managing maintenance mode
export const setMaintenanceMode = (enabled: boolean) => {
  localStorage.setItem("maintenance_mode", enabled.toString());
  // Optionally reload the page to apply changes immediately
  if (enabled) {
    window.location.reload();
  }
};

export const getMaintenanceMode = (): boolean => {
  return localStorage.getItem("maintenance_mode") === "true";
};

export const clearMaintenanceMode = () => {
  localStorage.removeItem("maintenance_mode");
};
