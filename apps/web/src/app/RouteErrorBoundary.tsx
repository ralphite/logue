import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  AppShell,
  type PrimaryRoute,
} from "./AppShell";
import { PageAxis, PageHeading, PageScroll } from "./layout";
import { Button } from "../ui";

export class RouteErrorBoundary extends Component<
  {
    children: ReactNode;
    resetKey: string;
    route: PrimaryRoute;
    onRoute: (route: PrimaryRoute) => void;
  },
  { error?: Error }
> {
  override state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Logue route failed", error, info.componentStack);
  }

  override componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: undefined });
    }
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <AppShell route={this.props.route} onRouteChange={this.props.onRoute}>
        <PageScroll>
          <PageAxis>
            <PageHeading
              title="This view needs attention"
              lead="Your local content is unchanged. Retry this view or continue elsewhere."
            />
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => this.setState({ error: undefined })}
              >
                Try again
              </Button>
              <Button onClick={() => this.props.onRoute("projects")}>
                Back to Projects
              </Button>
            </div>
          </PageAxis>
        </PageScroll>
      </AppShell>
    );
  }
}
