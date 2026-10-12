import { Component } from "react";
import ErrorFallback from "@/components/ErrorFallback";
import { captureException } from "@/lib/monitoring";

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    captureException(error, { extra: { componentStack: info?.componentStack } });
  }

  render() {
    return this.state.hasError ? <ErrorFallback /> : this.props.children;
  }
}
