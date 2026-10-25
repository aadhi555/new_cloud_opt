"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { ImpactBanner } from "@/components/dashboard/ImpactBanner";
import { RolePerspectiveCards } from "@/components/dashboard/RolePerspectiveCards";
import { BillingHistoryAndForecastChart } from "@/components/dashboard/BillingHistoryAndForecastChart";
import { FleetUtilizationChart } from "@/components/dashboard/FleetUtilizationChart";
import { ResourceTable } from "@/components/resources/ResourceTable";
import { ResourceDrawer } from "@/components/resources/ResourceDrawer";
import { RecommendationsHub } from "@/components/recommendations/RecommendationsHub";
import { WhatIfSimulator } from "@/components/simulator/WhatIfSimulator";
import { AlertsAndForecastView } from "@/components/alerts/AlertsAndForecastView";
import { AssumptionsSheet } from "@/components/assumptions/AssumptionsSheet";
import { ChatbotWidget } from "@/components/chat/ChatbotWidget";
import { fetchOverview, fetchResources, fetchRecommendations, getApiBase } from "@/lib/api";
import { Filter, RefreshCw } from "lucide-react";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [currentRole, setCurrentRole] = useState<"engineer" | "finops" | "executive">("finops");

  // Global filters
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterEnvironment, setFilterEnvironment] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");

  // State payloads
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [resources, setResources] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedResource, setSelectedResource] = useState<any | null>(null);
  const [simulatedTime, setSimulatedTime] = useState(new Date().toISOString());
  const [liveTicksMap, setLiveTicksMap] = useState<Record<string, any>>({});
  const [liveFleetTelemetry, setLiveFleetTelemetry] = useState<{
    avg_cpu: number;
    avg_net_mbps: number;
    tick_count: number;
  }>({
    avg_cpu: 24.5,
    avg_net_mbps: 18.2,
    tick_count: 0,
  });
  const [isLivePulsing, setIsLivePulsing] = useState(false);
  const [liveAlertBanner, setLiveAlertBanner] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Load overview, resources, and recommendations
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [ov, res, recs] = await Promise.all([
        fetchOverview({ region: filterRegion, environment: filterEnvironment, team: filterTeam }),
        fetchResources({ region: filterRegion, environment: filterEnvironment, team: filterTeam }),
        fetchRecommendations({ environment: filterEnvironment }),
      ]);
      setOverviewData(ov);
      setResources(res.resources || []);
      setRecommendations(recs.recommendations || []);
      if (ov.last_simulated_time) {
        setSimulatedTime(ov.last_simulated_time);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [filterRegion, filterEnvironment, filterTeam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Connect to SSE stream from Server 2
  useEffect(() => {
    const sseUrl = `${getApiBase()}/api/stream`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "tick") {
          if (data.simulated_time) {
            setSimulatedTime(data.simulated_time);
          }
          if (data.live_ticks) {
            setLiveTicksMap(data.live_ticks);
          }
          if (data.avg_cpu !== undefined) {
            setLiveFleetTelemetry({
              avg_cpu: data.avg_cpu,
              avg_net_mbps: data.avg_net_mbps || 0,
              tick_count: data.tick_count || 0,
            });
          }
          setIsLivePulsing(true);
          setTimeout(() => setIsLivePulsing(false), 1200);
        } else if (data.type === "anomaly") {
          setLiveAlertBanner(data);
          setTimeout(() => setLiveAlertBanner(null), 8000);
        } else if (data.type === "status_change") {
          loadData();
        }
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [loadData]);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Left Navigation Sidebar (Non-collapsible) */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        pendingRecCount={overviewData?.pending_count || 0}
        criticalAlertCount={2}
      />

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar with quick actions */}
        <Navbar
          onAnomalyTriggered={(info) => {
            setLiveAlertBanner({
              title: `Live Spike Injected on ${info.target_name || info.target_resource_id}`,
              message: `Surge to ${info.anomaly_tick?.cpu_pct}% CPU & ${info.anomaly_tick?.net_out_mbps} Mbps egress. Real-time alert dispatched!`,
            });
            setTimeout(() => setLiveAlertBanner(null), 8000);
          }}
        />

        {/* Global Live Anomaly Notification Banner */}
        {liveAlertBanner && (
          <div className="bg-gradient-to-r from-rose-600 to-red-700 text-white px-4 py-3 shadow-lg flex items-center justify-between text-xs animate-slideDown">
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
                <span className="font-bold uppercase tracking-wider bg-rose-900/60 px-2 py-0.5 rounded">
                  Live SSE Anomaly Alert
                </span>
                <span className="font-semibold">{liveAlertBanner.title}</span>
                <span className="hidden sm:inline text-rose-100">• {liveAlertBanner.message}</span>
              </div>
              <button
                onClick={() => {
                  setActiveTab("alerts");
                  setLiveAlertBanner(null);
                }}
                className="bg-white text-rose-700 font-bold px-3 py-1 rounded-lg hover:bg-rose-50 transition-all text-xs"
              >
                Investigate in Alerts
              </button>
            </div>
          </div>
        )}

        {/* Global Filter Bar */}
        <div className="bg-white border-b border-slate-200">
          <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5 text-slate-500 font-semibold">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>Scope:</span>
              </div>

              {/* Region */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-400">Region:</span>
                <select
                  value={filterRegion}
                  onChange={(e) => setFilterRegion(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-700 font-medium"
                >
                  <option value="all">All Regions</option>
                  <option value="Noida">Noida (Delhi NCR)</option>
                  <option value="Bangalore">Bangalore</option>
                  <option value="Mumbai">Mumbai</option>
                </select>
              </div>

              {/* Environment */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-400">Environment:</span>
                <select
                  value={filterEnvironment}
                  onChange={(e) => setFilterEnvironment(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-700 font-medium"
                >
                  <option value="all">All Environments</option>
                  <option value="prod">Production</option>
                  <option value="staging">Staging</option>
                  <option value="dev">Development</option>
                </select>
              </div>

              {/* Team */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-400">Team:</span>
                <select
                  value={filterTeam}
                  onChange={(e) => setFilterTeam(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-700 font-medium"
                >
                  <option value="all">All Teams</option>
                  <option value="Payments">Payments</option>
                  <option value="Core-API">Core-API</option>
                  <option value="Data-Platform">Data-Platform</option>
                  <option value="Growth-Frontend">Growth-Frontend</option>
                  <option value="QA-Automation">QA-Automation</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-slate-500">
              <span className="font-mono text-[11px]">
                105 Total Resources Monitored
              </span>
              <button
                onClick={loadData}
                className="p-1 hover:bg-slate-100 rounded-md text-slate-600 transition-all"
                title="Refresh scope"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Live Telemetry Stream Bubble (Clean End-to-End Pill) */}
        <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-1">
          <div className="w-full bg-slate-900 text-slate-200 rounded-full px-6 py-2.5 flex items-center justify-between text-xs border border-slate-800 shadow-xs">
            <span className="font-semibold text-slate-100">
              Live Utho Telemetry Stream
            </span>

            <div className="flex items-center space-x-6 text-xs">
              <div className="flex items-center space-x-1.5 font-mono">
                <span className="text-slate-400 font-sans">Fleet Avg CPU:</span>
                <span className="font-bold text-emerald-400">
                  {liveFleetTelemetry.avg_cpu}%
                </span>
              </div>
              <div className="flex items-center space-x-1.5 font-mono">
                <span className="text-slate-400 font-sans">Egress:</span>
                <span className="font-bold text-sky-400">
                  {liveFleetTelemetry.avg_net_mbps} Mbps
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Body */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
          {/* Sticky Impact Banner */}
          <ImpactBanner
            currentMonthlySpend={overviewData?.current_monthly_spend_inr || 487200}
            projectedMonthlySpend={overviewData?.projected_monthly_spend_inr || 292550}
            potentialTotalSavings={overviewData?.potential_total_savings_inr || 194650}
            acceptedSavings={overviewData?.accepted_savings_inr || 0}
            acceptedCount={overviewData?.accepted_count || 0}
            pendingCount={overviewData?.pending_count || 0}
            acceptedByEnv={overviewData?.accepted_by_env || { prod: 0, staging: 0, dev: 0 }}
            onRefresh={loadData}
          />

          {/* View 1: Executive Command */}
          {activeTab === "overview" && (
            <div className="space-y-6">
            {/* Role Perspective Switcher – lives above the 4 KPI cards */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">View perspective</p>
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                    {(["engineer", "finops", "executive"] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => setCurrentRole(role)}
                        className={`px-4 py-1.5 rounded-md font-medium capitalize transition-all ${
                          currentRole === role
                            ? "bg-white text-blue-700 shadow font-semibold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {role === "engineer" ? "Engineer" : role === "finops" ? "FinOps" : "Executive"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <RolePerspectiveCards
                currentRole={currentRole}
                fleetSummary={overviewData?.fleet_summary}
                sustainability={overviewData?.sustainability}
                currentSpend={overviewData?.current_monthly_spend_inr || 487200}
                acceptedSavings={overviewData?.accepted_savings_inr || 0}
                potentialSavings={overviewData?.potential_total_savings_inr || 194650}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BillingHistoryAndForecastChart
                  billingHistory={overviewData?.billing_history_6m || []}
                  forecastSpend={[
                    {
                      period: "+30 Days",
                      unoptimized_spend_inr: 512000,
                      optimized_spend_inr: Math.max(0, 512000 - (overviewData?.accepted_savings_inr || 0)),
                    },
                    {
                      period: "+60 Days",
                      unoptimized_spend_inr: 538000,
                      optimized_spend_inr: Math.max(0, 538000 - Math.round((overviewData?.accepted_savings_inr || 0) * 1.02)),
                    },
                    {
                      period: "+90 Days",
                      unoptimized_spend_inr: 565000,
                      optimized_spend_inr: Math.max(0, 565000 - Math.round((overviewData?.accepted_savings_inr || 0) * 1.05)),
                    },
                  ]}
                />

                <FleetUtilizationChart
                  aggregatedTimeseries={overviewData?.aggregated_timeseries || []}
                  acceptedCount={overviewData?.accepted_count || 0}
                />
              </div>
            </div>
          )}

          {/* View 2: Resource Inventory */}
          {activeTab === "resources" && (
            <ResourceTable
              resources={resources}
              onSelectResource={(res) => setSelectedResource(res)}
              selectedResourceId={selectedResource?.resource_id}
              liveTicksMap={liveTicksMap}
            />
          )}

          {/* View 3: Recommendations Hub */}
          {activeTab === "recommendations" && (
            <RecommendationsHub
              recommendations={recommendations}
              onRecommendationUpdated={loadData}
            />
          )}

          {/* View 4: What-If Simulator */}
          {activeTab === "simulator" && <WhatIfSimulator />}

          {/* View 5: Alerts & Forecast */}
          {activeTab === "alerts" && <AlertsAndForecastView />}

          {/* View 6: Assumptions & Formulas */}
          {activeTab === "assumptions" && <AssumptionsSheet />}
        </main>

        {/* Drill-Down Drawer */}
        {selectedResource && (
          <ResourceDrawer
            resource={selectedResource}
            liveTick={liveTicksMap ? liveTicksMap[selectedResource.resource_id] : null}
            onClose={() => setSelectedResource(null)}
            onRecommendationUpdated={loadData}
          />
        )}

        {/* Floating Gemini AI FinOps Copilot */}
        <ChatbotWidget />

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 mt-auto text-center text-xs text-slate-500">
          <div className="px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-700">SmartCloud Optimizer</span>
              <span>•</span>
              <span>Engineered for Utho Cloud (India)</span>
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              PUE 1.38 • CEA Grid Factor 0.71 kg CO2e/kWh • P99 &le; 72% Peak Safety Ceiling
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
