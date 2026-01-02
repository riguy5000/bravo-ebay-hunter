
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import { MainLayout } from "@/components/layout/MainLayout";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Matches from "./pages/Matches";
import Purchases from "./pages/Purchases";
import Returns from "./pages/Returns";
import Resales from "./pages/Resales";
import Statistics from "./pages/Statistics";
import Settings from "./pages/Settings";
import HealthCheck from "./pages/HealthCheck";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={
              <AuthGuard>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </AuthGuard>
            } />
            <Route path="/tasks" element={
              <AuthGuard>
                <MainLayout>
                  <Tasks />
                </MainLayout>
              </AuthGuard>
            } />
            <Route path="/matches" element={
              <AuthGuard>
                <MainLayout>
                  <Matches />
                </MainLayout>
              </AuthGuard>
            } />
            <Route path="/purchases" element={
              <AuthGuard>
                <MainLayout>
                  <Purchases />
                </MainLayout>
              </AuthGuard>
            } />
            <Route path="/returns" element={
              <AuthGuard>
                <MainLayout>
                  <Returns />
                </MainLayout>
              </AuthGuard>
            } />
            <Route path="/resales" element={
              <AuthGuard>
                <MainLayout>
                  <Resales />
                </MainLayout>
              </AuthGuard>
            } />
            <Route path="/statistics" element={
              <AuthGuard>
                <MainLayout>
                  <Statistics />
                </MainLayout>
              </AuthGuard>
            } />
            <Route path="/health" element={
              <AuthGuard>
                <MainLayout>
                  <HealthCheck />
                </MainLayout>
              </AuthGuard>
            } />
            <Route path="/settings" element={
              <AuthGuard>
                <MainLayout>
                  <Settings />
                </MainLayout>
              </AuthGuard>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
