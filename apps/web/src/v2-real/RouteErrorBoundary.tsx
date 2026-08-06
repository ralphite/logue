import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../components/ui";
import {
  ProjectShell,
  type V2PrimaryRoute,
} from "../v2-mock/web/ProjectShell";

export class RouteErrorBoundary extends Component<
  {
    children: ReactNode;
    resetKey: string;
    route: V2PrimaryRoute;
    onRoute: (route: V2PrimaryRoute) => void;
  },
  { error?: Error }
> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Logue route failed", error, info.componentStack);
  }

  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: undefined });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ProjectShell route={this.props.route} onRouteChange={this.props.onRoute}>
        <div className="v2-editor-scroll">
          <div className="v2-list-axis">
            <div className="v2-page-heading-copy">
              <h1>This view needs attention</h1>
              <p>Your local content is unchanged. Retry this view or continue elsewhere.</p>
            </div>
            <div className="v2-inline-actions">
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
          </div>
        </div>
      </ProjectShell>
    );
  }
}
