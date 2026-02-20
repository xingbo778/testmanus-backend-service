import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import ProjectDetail from "./pages/ProjectDetail";
import ExperienceManager from "./pages/ExperienceManager";
import ExportManager from "./pages/ExportManager";
import RuleManager from "./pages/RuleManager";
import PromptManager from "./pages/PromptManager";
import LogSession from "./pages/LogSession";
import AnchorLibrary from "./pages/AnchorLibrary";
import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/browse"} component={Browse} />
        <Route path={"/browse/:l1Id"} component={Browse} />
        <Route path={"/browse/:l1Id/:l2Id"} component={Browse} />
        <Route path={"/browse/:l1Id/:l2Id/:l3Id"} component={Browse} />
        <Route path={"/project/:id"} component={ProjectDetail} />
        <Route path={"/experience"} component={ExperienceManager} />
        <Route path={"/export"} component={ExportManager} />
        <Route path={"/rules"} component={RuleManager} />
        <Route path={"/prompts"} component={PromptManager} />
        <Route path={"/anchors"} component={AnchorLibrary} />
        <Route path={"/logs"} component={LogSession} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
