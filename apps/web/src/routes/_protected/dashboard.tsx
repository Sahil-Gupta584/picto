import { createFileRoute } from "@tanstack/react-router";
import { Route as RootIndexRoute } from "../index";

export const Route = createFileRoute("/_protected/dashboard")({
  component: DashboardWrapper
});

function DashboardWrapper() {
  const Component = RootIndexRoute.options.component;
  if (!Component) return null;
  return <Component />;
}
