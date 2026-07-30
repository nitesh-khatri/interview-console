import { render } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Renders with the providers the real app puts around every page.
 *
 * `AppShell` wraps the app in a `TooltipProvider`, so any component containing a
 * Tooltip — `RelativeTime`, for one — throws "`Tooltip` must be used within
 * `TooltipProvider`" when rendered bare in a test. Use this instead of calling
 * `render` directly.
 */
export function renderWithProviders(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}
