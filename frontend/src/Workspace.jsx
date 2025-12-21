import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { health, scrape, compareCities, forecastMulti, agentPlan, agentExecute } from "./api";
import { collectChartsForReport } from "./utils/chartCapture";
import { buildComparisonReportPayload, buildForecastReportPayload } from "./utils/payloadBuilders";
import { useAuth } from "./contexts/AuthContext";
import DataCollectionTab from "./components/data-collection/DataCollectionTab";
import ComparisonTab from "./components/comparison/ComparisonTab";
import ForecastTab from "./components/forecast/ForecastTab";
import {
    LineChart, Line, XAxis, YAxis, Tooltip, Legend,
    CartesianGrid, ResponsiveContainer, Area
} from "recharts";
import { gsap } from "gsap";
import { useMotionTemplate, useMotionValue, motion, animate, AnimatePresence } from "framer-motion";

const COLORS_TOP = ["#13FFAA", "#1E67C6", "#CE84CF", "#DD335C"];
const fmtPM = (v) => (v == null || isNaN(v) ? "-" : `${Number(v).toFixed(2)} µg/m³`);

// SVG Icons as React components
const CloudIcon = () => (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4 4 0 003 15z" />
    </svg>
);

const BarChartIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);

const CpuIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
);

const MessageIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
);

const ArrowRightIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
);

function prettyStep(step, idx) {
    const { name, arguments: args = {} } = step || {};
    const parts = [];
    if (args.city) parts.push(`city: ${args.city}`);
    if (Array.isArray(args.cities)) parts.push(`cities: ${args.cities.join(", ")}`);
    if (args.days != null) parts.push(`days: ${args.days}`);
    if (args.horizonDays != null) parts.push(`horizon: ${args.horizonDays}d`);
    if (args.trainDays != null) parts.push(`train: ${args.trainDays}d`);
    return (
        <div key={idx} className="flex items-center gap-2 py-1">
      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200">
        {idx + 1}
      </span>
            <span className="text-amber-100 font-medium">{name}</span>
            {parts.length > 0 && (
                <span className="text-amber-200/80 text-sm">({parts.join(" • ")})</span>
            )}
        </div>
    );
}


// CSS-based particle background
function ParticleBackground() {
    const particlesRef = useRef(null);

    useEffect(() => {
        if (particlesRef.current) {
            const particles = particlesRef.current;
            const count = 150;

            for (let i = 0; i < count; i++) {
                const particle = document.createElement('div');
                particle.className = 'absolute rounded-full bg-white';
                particle.style.width = `${Math.random() * 2 + 1}px`;
                particle.style.height = particle.style.width;
                particle.style.left = `${Math.random() * 100}%`;
                particle.style.top = `${Math.random() * 100}%`;
                particle.style.opacity = `${Math.random() * 0.5 + 0.1}`;
                particle.style.animation = `float ${Math.random() * 20 + 10}s infinite ease-in-out`;
                particle.style.animationDelay = `${Math.random() * 5}s`;
                particles.appendChild(particle);
            }
        }
    }, []);

    return <div ref={particlesRef} className="fixed inset-0 -z-10 overflow-hidden" />;
}

function AuroraBackground() {
    const color = useMotionValue(COLORS_TOP[0]);

    useEffect(() => {
        animate(color, COLORS_TOP, {
            ease: "easeInOut",
            duration: 10,
            repeat: Infinity,
            repeatType: "mirror",
        });
    }, [color]);

    const backgroundImage = useMotionTemplate`radial-gradient(125% 125% at 50% 0%, #020617 50%, ${color})`;

    return (
        <motion.div
            className="fixed inset-0 -z-10"
            style={{ backgroundImage }}
        >
            <ParticleBackground />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-950/80 to-gray-950" />
        </motion.div>
    );
}

function FloatingNav({ activeTab, setActiveTab, userPlan }) {
    const allTabs = [
        { id: 'data', label: 'Data Collection', icon: CloudIcon, plans: ['free', 'pro', 'enterprise'] },
        { id: 'compare', label: 'City Analysis', icon: BarChartIcon, plans: ['pro', 'enterprise'] },
        { id: 'forecast', label: 'AI Forecast', icon: CpuIcon, plans: ['pro', 'enterprise'] },
        { id: 'assistant', label: 'AI Assistant', icon: MessageIcon, plans: ['enterprise'] }
    ];

    // Filter tabs based on user plan
    const tabs = allTabs.filter(tab => tab.plans.includes(userPlan?.toLowerCase() || 'free'));

    return (
        <motion.nav
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ 
                duration: 0.6, 
                ease: [0.25, 0.46, 0.45, 0.94],
                delay: 0.3
            }}
            whileHover={{ scale: 1.02 }}
        >
            <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-2 shadow-2xl">
                <div className="flex gap-1">
                    {tabs.map((tab, index) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <motion.button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-3 rounded-xl font-medium text-sm flex items-center gap-2 relative overflow-hidden ${
                                    isActive
                                        ? 'text-white'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ 
                                    duration: 0.4, 
                                    ease: [0.25, 0.46, 0.45, 0.94],
                                    delay: 0.1 + index * 0.05
                                }}
                                whileHover={{ 
                                    scale: 1.02,
                                    transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }
                                }}
                                whileTap={{ 
                                    scale: 0.98,
                                    transition: { duration: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }
                                }}
                            >
                                {/* Active background with smooth animation */}
                                <AnimatePresence>
                                    {isActive && (
                                        <motion.div
                                            className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 rounded-xl"
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            transition={{ 
                                                duration: 0.3, 
                                                ease: [0.25, 0.46, 0.45, 0.94]
                                            }}
                                            layoutId="activeTab"
                                        />
                                    )}
                                </AnimatePresence>
                                
                                {/* Hover background */}
                                <motion.div
                                    className="absolute inset-0 bg-gray-800/50 rounded-xl"
                                    initial={{ opacity: 0 }}
                                    whileHover={{ opacity: 1 }}
                                    transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                                />
                                
                                {/* Content */}
                                <div className="relative z-10 flex items-center gap-2">
                                    <motion.div
                                        animate={{ 
                                            scale: isActive ? 1.1 : 1,
                                            rotate: isActive ? 5 : 0
                                        }}
                                        transition={{ 
                                            duration: 0.3, 
                                            ease: [0.25, 0.46, 0.45, 0.94]
                                        }}
                                    >
                                        <Icon />
                                    </motion.div>
                                    <motion.span
                                        animate={{ 
                                            fontWeight: isActive ? 600 : 500
                                        }}
                                        transition={{ 
                                            duration: 0.3, 
                                            ease: [0.25, 0.46, 0.45, 0.94]
                                        }}
                                    >
                                        {tab.label}
                                    </motion.span>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        </motion.nav>
    );
}

function GlassPanel({ title, children, right, index }) {
    const panelRef = useRef(null);

    useEffect(() => {
        if (panelRef.current) {
            gsap.fromTo(panelRef.current,
                { y: 60, opacity: 0, scale: 0.95 },
                { y: 0, opacity: 1, scale: 1, duration: 0.8, delay: index * 0.15, ease: "back.out(1.2)" }
            );
        }
    }, [index]);

    return (
        <motion.section
            ref={panelRef}
            className="w-full bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-700/30 shadow-2xl hover:border-gray-600/50 transition-all duration-300"
            whileHover={{ y: -2 }}
        >
            <div className="px-6 py-5 border-b border-gray-700/30 flex items-center justify-between">
                <h2 className="font-semibold text-white flex items-center gap-3">
                    <div className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"></div>
                    {title}
                </h2>
                {right && <div className="flex items-center gap-2">{right}</div>}
            </div>
            <div className="p-6">{children}</div>
        </motion.section>
    );
}

function GlowyKpi({ label, value, sub, trend }) {
    const kpiRef = useRef(null);

    useEffect(() => {
        if (kpiRef.current) {
            gsap.fromTo(kpiRef.current,
                { scale: 0.8, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" }
            );
        }
    }, [value]);

    return (
        <motion.div
            ref={kpiRef}
            className="p-5 rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/50 to-gray-900/50 hover:from-gray-700/50 hover:to-gray-800/50 transition-all duration-300 group backdrop-blur-sm"
            whileHover={{ scale: 1.02 }}
        >
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</div>
            <div className="text-2xl font-bold text-white mb-1">{value}</div>
            {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
            {trend && (
                <div className={`text-xs font-medium mt-2 ${
                    trend > 0 ? "text-red-400" : "text-green-400"
                }`}>
                    {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
                </div>
            )}
        </motion.div>
    );
}

function AuroraButton({ children, onClick, disabled, variant = "primary", loading }) {
    const buttonRef = useRef(null);
    const color = useMotionValue(COLORS_TOP[0]);

    useEffect(() => {
        animate(color, COLORS_TOP, {
            ease: "easeInOut",
            duration: 10,
            repeat: Infinity,
            repeatType: "mirror",
        });
    }, [color]);

    const boxShadow = useMotionTemplate`0px 4px 20px ${color}`;
    const border = useMotionTemplate`1px solid ${color}`;

    const variants = {
        primary: "from-cyan-500 to-purple-600",
        secondary: "from-gray-600 to-gray-700",
        success: "from-emerald-500 to-green-600",
        warning: "from-amber-500 to-orange-600"
    };

    return (
        <motion.button
            ref={buttonRef}
            style={{ boxShadow, border }}
            className={`px-6 py-3 rounded-xl text-white font-medium bg-gradient-to-r ${variants[variant]} transition-all duration-200 relative overflow-hidden disabled:opacity-50`}
            onClick={onClick}
            disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.05 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
        >
            {loading ? (
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Loading...
                </div>
            ) : (
                children
            )}
        </motion.button>
    );
}

function DarkInputField({ label, value, onChange, type = "text", placeholder, className }) {
    return (
        <div className={className}>
            <label className="text-xs font-medium text-gray-400 mb-2 block">{label}</label>
            <input
                type={type}
                className="w-full px-4 py-3 border border-gray-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 bg-gray-800/50 text-white placeholder-gray-500"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
            />
        </div>
    );
}

function ModelDropdown({ selectedModel, setSelectedModel }) {
    const [isOpen, setIsOpen] = useState(false);
    
    const models = [
        { value: 'sarimax', label: 'SARIMAX (Fast, Lightweight)' },
        { value: 'prophet', label: 'Prophet (Heavy, Powerful)' }
    ];
    
    const selectedModelData = models.find(model => model.value === selectedModel);
    
    return (
        <div className="relative">
            <label className="text-xs font-medium text-gray-400 mb-2 block">Choose Model</label>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full px-4 py-3 border border-gray-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 bg-gray-800/50 text-white text-left flex items-center justify-between hover:bg-gray-700/50"
                >
                    <span className="text-sm">{selectedModelData?.label}</span>
                    <motion.svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </motion.svg>
                </button>
                
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute top-full left-0 right-0 mt-1 bg-gray-800/90 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                        >
                            {models.map((model) => (
                                <button
                                    key={model.value}
                                    onClick={() => {
                                        setSelectedModel(model.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full px-4 py-3 text-left text-sm transition-all duration-200 hover:bg-gray-700/50 ${
                                        selectedModel === model.value 
                                            ? 'text-cyan-400 bg-cyan-500/10' 
                                            : 'text-gray-300'
                                    }`}
                                >
                                    {model.label}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function ChatInterface({ prompt, setPrompt, plan, agentOut, agentLoading, doAgentPlan, doAgentExecute }) {
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [agentOut, plan]);

    // ——— Helpers to validate planner output ———
    const isNonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0
    const isActionableStep = (s) => !!s && (isNonEmptyStr(s.name) || isNonEmptyStr(s.tool))

    // Derive actionable steps *safely*
    const rawSteps = Array.isArray(plan?.plan) ? plan.plan.filter(Boolean) : []
    const actionableSteps = rawSteps.filter(isActionableStep)

    // Decide what to show
    const shouldShowPlanned = !plan?.irrelevant && actionableSteps.length > 0
    const shouldShowIrrelevant =
        plan && isNonEmptyStr(prompt) && (
            plan.irrelevant ||
            (Array.isArray(plan.plan) && plan.plan.length > 0 && actionableSteps.length === 0) ||
            (!Array.isArray(plan.plan) && !agentLoading)
        )

    return (
        <div className="flex flex-col h-[500px]">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {/* User Message */}
                <div className="flex justify-end">
                    <div className="bg-gradient-to-r from-cyan-500/20 to-purple-600/20 border border-cyan-500/30 rounded-2xl p-4 max-w-[80%]">
                        <div className="text-white">{prompt}</div>
                    </div>
                </div>

                {/* AI Response */}
                {agentOut?.answer && (
                    <div className="flex justify-start">
                        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 max-w-[80%]">
                            <div className="text-gray-200 whitespace-pre-wrap">{agentOut.answer}</div>
                        </div>
                    </div>
                )}

                {agentOut?.final?.byCity && (
                    <div className="flex justify-start">
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 max-w-[80%] text-emerald-200 text-sm">
                            <div className="font-semibold mb-1">Execution Result</div>
                            {agentOut.final.summary && (
                                <div>
                                    {Object.entries(agentOut.final.summary).map(([c, s]) => (
                                        <div key={c} className="flex items-center justify-between">
                                            <span>{c}</span>
                                            <span>{fmtPM(s.mean_yhat)}</span>
                                        </div>
                                    ))}
                                    <div className="mt-2">Best: <b>{agentOut.final.best}</b> • Worst: <b>{agentOut.final.worst}</b></div>
                                </div>
                            )}
                            {!agentOut.final.summary && agentOut.final.days && (
                                <div>Compared cities for last {agentOut.final.days} days. Best: <b>{agentOut.final.best}</b> • Worst: <b>{agentOut.final.worst}</b></div>
                            )}
                        </div>
                    </div>
                )}

                {/* Planned Steps */}
                {shouldShowPlanned && (
                    <div className="flex justify-start">
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 max-w-[80%]">
                            <div className="text-amber-200 text-sm">
                                <div className="font-semibold mb-2">Planned Steps</div>
                                <div className="space-y-1">
                                    {actionableSteps.map((s, i) => prettyStep(s, i))}
                                </div>
                                {plan?.notes && plan.notes.includes("Unsupported:") && (
                                    <div className="mt-3 pt-2 border-t border-amber-500/20">
                                        <div className="text-xs text-amber-300/80">
                                            <div className="font-medium mb-1">Why only partial plan?</div>
                                            <div>{plan.notes}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Irrelevant Input Warning */}
                {shouldShowIrrelevant && (
                    <div className="flex justify-start">
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 max-w-[80%]">
                            <div className="text-orange-200 text-sm">
                                <div className="font-semibold mb-2">⚠️ Irrelevant Input</div>
                                {plan?.reason && <div className="mb-2">{plan.reason}</div>}
                                <div>Try:</div>
                                <ul className="list-disc ml-5 mt-1">
                                    <li>"Compare Colombo, Kandy last 7 days"</li>
                                    <li>"Forecast Panadura next 3 days (window 7)"</li>
                                    <li>"Scrape & aggregate Galle 2 days"</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {(plan?.error || agentOut?.error) && (
                    <div className="flex justify-start">
                        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 max-w-[80%]">
                            <div className="text-red-200">{plan?.error || agentOut?.error}</div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="flex gap-3">
                <DarkInputField
                    label="Ask about air quality data"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    className="flex-1"
                    placeholder="Ask about air quality data (e.g., Compare Colombo and Kandy last 7 days)..."
                />
                <div className="flex gap-2">
                    <AuroraButton onClick={doAgentPlan} loading={agentLoading}>
                        Plan
                    </AuroraButton>

                    {plan?.plan?.length > 0 && !plan?.irrelevant && (
                        <AuroraButton onClick={doAgentExecute} loading={agentLoading} variant="success">
                            Execute
                        </AuroraButton>
                    )}
                </div>
            </div>
        </div>
    );
}

function DataChart({ data, title }) {
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    const chartData = data.map(item => ({
        ts: item.ts,
        pm25: item.pm25,
        ...item
    }));

    return (
        <div className="h-[300px] w-full mt-6 bg-gray-900/50 rounded-2xl p-4 border border-gray-700/30">
            <h4 className="text-white mb-4 font-medium">{title}</h4>
            <ResponsiveContainer width="100%" height="90%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                        dataKey="ts"
                        tick={{ fontSize: 11, fill: "#9CA3AF" }}
                        axisLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: "#9CA3AF" }}
                        axisLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: "#9CA3AF" }}
                        axisLine={false}
                        tickFormatter={(v)=>`${v} µg/m³`}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px', color: '#F9FAFB' }}
                        formatter={(value, name) => [`${value} µg/m³`, name]}
                    />
                    <Line
                        type="monotone"
                        dataKey="pm25"
                        stroke="#10B981"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// Add CSS animations for particles
const styles = `
@keyframes float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(180deg); }
}
`;

export default function Workspace() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('data');
    const [hz, setHz] = useState(null);

    // Define plan-based tab access
    const getAvailableTabs = (plan) => {
        const planTabs = {
            'free': ['data'],
            'pro': ['data', 'compare', 'forecast'],
            'enterprise': ['data', 'compare', 'forecast', 'assistant']
        };
        return planTabs[plan?.toLowerCase()] || planTabs['free'];
    };

    // Ensure active tab is valid for user's plan
    useEffect(() => {
        const availableTabs = getAvailableTabs(user?.plan);
        if (!availableTabs.includes(activeTab)) {
            setActiveTab('data'); // Default to data collection if current tab is not available
        }
    }, [user?.plan, activeTab]);

    // Data Collection
    const [city, setCity] = useState("Colombo");
    const [days, setDays] = useState(7);
    const [scrapeRes, setScrapeRes] = useState(null);
    const [scrapeLoading, setScrapeLoading] = useState(false);
    const [scrapeChartData, setScrapeChartData] = useState([]);

    // Comparison
    const [cmpInput, setCmpInput] = useState("Colombo,Kandy");
    const [cmpDays, setCmpDays] = useState(7);
    const [cmpRes, setCmpRes] = useState(null);
    const [cmpLoading, setCmpLoading] = useState(false);
    const [cmpChartData, setCmpChartData] = useState({});
    const [cmpCombined, setCmpCombined] = useState(false);

    // Forecast
    const [fcInput, setFcInput] = useState("Colombo,Kandy");
    const [horizon, setHorizon] = useState(7);
    const [trainDays, setTrainDays] = useState(30);
    const [fcRes, setFcRes] = useState(null);
    const [fcLoading, setFcLoading] = useState(false);
    const [showCI, setShowCI] = useState(false);
    const [fcCombined, setFcCombined] = useState(true);
    const [selectedModel, setSelectedModel] = useState('sarimax');

    // AI Assistant
    const [prompt, setPrompt] = useState("");
    const [plan, setPlan] = useState(null);
    const [agentOut, setAgentOut] = useState(null);
    const [agentLoading, setAgentLoading] = useState(false);

    useEffect(() => {
        health().then(setHz).catch(() => setHz({ status: "degraded" }));

        // Inject styles
        const styleSheet = document.createElement("style")
        styleSheet.innerText = styles
        document.head.appendChild(styleSheet)

        return () => {
            document.head.removeChild(styleSheet)
        }
    }, []);

    // Enhanced handlers with chart data
    async function doScrape() {
        setScrapeLoading(true);
        try {
            const result = await scrape(city, days);
            setScrapeRes(result);
            if (result.ok) {
                const mockData = Array.from({ length: days }, (_, i) => ({
                    ts: `Day ${i + 1}`,
                    pm25: Math.random() * 100 + 20
                }));
                setScrapeChartData(mockData);
            }
        }
        catch(e){ setScrapeRes({ ok:false, error: e?.response?.data?.detail || String(e) }); }
        finally{ setScrapeLoading(false); }
    }

    async function doCompare() {
        setCmpLoading(true);
        try {
            const cities = cmpInput.split(",").map(s => s.trim()).filter(Boolean);
            const result = await compareCities(cities, cmpDays);
            setCmpRes(result);

            if (result.byCity) {
                const chartData = {};
                Object.keys(result.byCity).forEach(cityName => {
                    const cityStats = result.byCity[cityName];
                    const { mean_pm25, min_pm25, max_pm25, n_points } = cityStats;
                    
                    // Generate realistic chart data based on actual statistics
                    chartData[cityName] = Array.from({ length: cmpDays }, (_, i) => {
                        // Create realistic variation around the mean
                        const dayVariation = (Math.sin(i * 0.5) * 0.3 + Math.cos(i * 0.8) * 0.2) * (max_pm25 - min_pm25) * 0.3;
                        const randomVariation = (Math.random() - 0.5) * (max_pm25 - min_pm25) * 0.4;
                        const pm25Value = Math.max(min_pm25, Math.min(max_pm25, mean_pm25 + dayVariation + randomVariation));
                        
                        return {
                            ts: `Day ${i + 1}`,
                            pm25: Number(pm25Value.toFixed(2))
                        };
                    });
                });
                setCmpChartData(chartData);
            }
        } catch(e){ setCmpRes({ ok:false, error: e?.response?.data?.detail || String(e) }); }
        finally{ setCmpLoading(false); }
    }

    async function doForecast() {
        setFcLoading(true);
        try {
            const cities = fcInput.split(",").map(s => s.trim()).filter(Boolean);
            console.log('📡 Backend forecast API call for cities:', cities);
            const apiResponse = await forecastMulti(cities, horizon, trainDays, true);
            console.log('📡 Backend forecast response structure:');
            console.log('   Response keys:', Object.keys(apiResponse || {}));
            if (apiResponse?.byCity) {
                Object.keys(apiResponse.byCity).forEach(city => {
                    const cityData = apiResponse.byCity[city];
                    console.log(`   ${city} forecast points:`, cityData?.forecast_data?.length);
                    console.log(`   ${city} first few values:`, cityData?.forecast_data?.slice(0, 3));
                    console.log(`   ${city} data structure:`, cityData);
                });
            }
            setFcRes(apiResponse);
        } catch(e){ setFcRes({ ok:false, error: e?.response?.data?.detail || String(e) }); }
        finally{ setFcLoading(false); }
    }

    async function doAgentPlan() {
        setAgentLoading(true);
        try {
            const p = await agentPlan(prompt);
            setPlan(p);

            // --- Autofill inputs from plan ---
            if (Array.isArray(p?.plan)) {
                // compare_cities
                const cmp = p.plan.find(s => s.name === "compare_cities");
                if (cmp?.arguments) {
                    if (Array.isArray(cmp.arguments.cities)) {
                        setCmpInput(cmp.arguments.cities.join(","));
                    }
                    if (typeof cmp.arguments.days === "number") {
                        setCmpDays(cmp.arguments.days);
                    }
                }
                // forecast_multi
                const fcm = p.plan.find(s => s.name === "forecast_multi");
                if (fcm?.arguments) {
                    if (Array.isArray(fcm.arguments.cities)) {
                        setFcInput(fcm.arguments.cities.join(","));
                    }
                    if (typeof fcm.arguments.horizonDays === "number") {
                        setHorizon(fcm.arguments.horizonDays);
                    }
                    if (typeof fcm.arguments.trainDays === "number") {
                        setTrainDays(fcm.arguments.trainDays);
                    }
                }
                // single-city forecast fallback
                const fcs = p.plan.find(s => s.name === "forecast_city");
                if (fcs?.arguments?.city) {
                    setFcInput(fcs.arguments.city);
                    if (typeof fcs.arguments.horizonDays === "number") {
                        setHorizon(fcs.arguments.horizonDays);
                    }
                    if (typeof fcs.arguments.trainDays === "number") {
                        setTrainDays(fcs.arguments.trainDays);
                    }
                }
                // scrape_city: also prefill the Data tab (city + days)
                const sc = p.plan.find(s => s.name === "scrape_city");
                if (sc?.arguments) {
                    if (sc.arguments.city) setCity(sc.arguments.city);
                    if (typeof sc.arguments.days === "number") setDays(sc.arguments.days);
                    // if no compare step, use scrape values to help compare inputs
                    if (!cmp && sc.arguments.city) setCmpInput(sc.arguments.city);
                    if (!cmp && typeof sc.arguments.days === "number") setCmpDays(sc.arguments.days);
                }
            }
        } catch (e) {
            setPlan({ error: e?.response?.data?.detail || String(e) });
        } finally {
            setAgentLoading(false);
        }
    }

    async function doAgentExecute() {
        setAgentLoading(true);
        try {
            const data = plan?.plan ? await agentExecute({ plan: plan.plan })
                : await agentExecute({ prompt });
            setAgentOut(data);

            // Hide Execute button until the next Plan
            setPlan(null);

            const t = Array.isArray(data?.trace) ? data.trace : [];

            // Find the most recent results of each kind
            const rev = [...t].reverse();
            const rForecastMulti = rev.find(x => x?.ok && x?.result?.byCity && x?.result?.summary);
            const rCompare       = rev.find(x => x?.ok && x?.result?.byCity && x?.result?.days !== undefined
                                                   && x?.result?.best !== undefined && x?.result?.worst !== undefined
                                                   && !x?.result?.summary);
            const rForecastCity  = rev.find(x => x?.ok && x?.result?.series && x?.result?.city);
            const rScrape        = rev.find(x => x?.ok && x?.result?.city && (x?.result?.inserted !== undefined));
            
            // Handle multiple individual forecast_city results
            const rForecastCities = rev.filter(x => x?.ok && x?.result?.series && x?.result?.city);

            // Wire into existing panels

            // Compare
            if (rCompare?.result) {
                const final = rCompare.result;
                setCmpRes(final);

                // (Placeholder) build simple per-city lines if you don't have raw series
                try {
                    const daysCount = typeof final.days === 'number' ? final.days : 7;
                    const chartData = {};
                    Object.keys(final.byCity || {}).forEach(c => {
                        chartData[c] = Array.from({ length: daysCount }, (_, i) => ({
                            ts: `Day ${i+1}`,
                            pm25: Math.random() * 80 + 10
                        }));
                    });
                    setCmpChartData(chartData);
                } catch {}
            }

            // Multi-forecast
            if (rForecastMulti?.result) {
                setFcRes(rForecastMulti.result);
                setActiveTab("forecast");
            }
            // Multiple individual forecast_city results (combine them)
            else if (rForecastCities.length > 0) {
                const byCity = {};
                const summary = {};
                
                rForecastCities.forEach(fc => {
                    const fr = fc.result;
                    byCity[fr.city] = fr.series.map(s => ({
                        ts: s.ts, yhat: s.yhat, yhat_lower: s.yhat_lower, yhat_upper: s.yhat_upper
                    }));
                    const mean = fr.series.reduce((a,b)=>a+b.yhat,0)/fr.series.length;
                    summary[fr.city] = { n_points: fr.series.length, mean_yhat: mean };
                });
                
                // Find best/worst
                const valid = Object.entries(summary).filter(([_, s]) => s.mean_yhat !== null);
                const best = valid.length > 0 ? valid.reduce((a, b) => a[1].mean_yhat < b[1].mean_yhat ? a : b)[0] : null;
                const worst = valid.length > 0 ? valid.reduce((a, b) => a[1].mean_yhat > b[1].mean_yhat ? a : b)[0] : null;
                
                setFcRes({ byCity, summary, best, worst });
            }
            // Single-city forecast (wrap to multi shape)
            else if (rForecastCity?.result) {
                const fr = rForecastCity.result;
                const byCity = {
                    [fr.city]: fr.series.map(s => ({
                        ts: s.ts, yhat: s.yhat, yhat_lower: s.yhat_lower, yhat_upper: s.yhat_upper
                    }))
                };
                const mean = fr.series.reduce((a,b)=>a+b.yhat,0)/fr.series.length;
                const summary = { [fr.city]: { n_points: fr.series.length, mean_yhat: mean } };
                setFcRes({ byCity, summary, best: fr.city, worst: fr.city });
                setActiveTab("forecast");
            }

            // Scrape
            if (rScrape?.result && !rForecastMulti?.result && !rForecastCity?.result && rForecastCities.length === 0 && !rCompare?.result) {
                const s = rScrape.result;
                setCity(s.city);
                setDays(s.days ?? 7);
                setScrapeRes({ ok: true, city: s.city, lat: s.lat, lon: s.lon, inserted: s.inserted });
                const mockData = Array.from({ length: s.days ?? 7 }, (_, i) => ({ ts:`Day ${i+1}`, pm25: Math.random()*100+20 }));
                setScrapeChartData(mockData);
                setActiveTab("data");
            }

            // Fallback to server 'final' if nothing matched above
            const final = data?.final;
            if (final && !rForecastMulti && !rForecastCity && rForecastCities.length === 0 && !rCompare) {
                if (final.byCity && final.summary) setFcRes(final);
                if (final.byCity && final.days !== undefined && final.best !== undefined && final.worst !== undefined && !final.summary) {
                    setCmpRes(final);
                }
                if (final.series && final.city) {
                    const byCity = { [final.city]: final.series.map(s => ({ ts: s.ts, yhat:s.yhat, yhat_lower:s.yhat, yhat_upper:s.yhat_upper })) };
                    const mean = final.series.reduce((a,b)=>a+b.yhat,0)/final.series.length;
                    setFcRes({ byCity, summary: { [final.city]: { n_points: final.series.length, mean_yhat: mean } }, best: final.city, worst: final.city });
                }
            }

        } catch (e) {
            setAgentOut({ error: e?.response?.data?.detail || String(e) });
        } finally {
            setAgentLoading(false);
        }
    }

    const forecastChartData = useMemo(() => {
        if (!fcRes?.byCity) return [];
        const rows = {};
        for (const [city, series] of Object.entries(fcRes.byCity)) {
            const arr = Array.isArray(series) ? series : [];
            arr.forEach(p => {
                const key = p.ts;
                rows[key] = rows[key] || { ts: key };

                const y = Number(p.yhat ?? p.y);
                const loRaw = Number(p.yhat_lower ?? p.lower ?? y);
                const hiRaw = Number(p.yhat_upper ?? p.upper ?? y);

                const lo = Math.max(0, loRaw);
                const hi = Math.max(lo, hiRaw);

                rows[key][city] = y;
                rows[key][`${city}_lo`] = lo;
                rows[key][`${city}_hi`] = hi;
            });
        }
        return Object.values(rows).sort((a, b) => a.ts.localeCompare(b.ts));
    }, [fcRes]);

    const forecastCities = useMemo(() => {
        if (fcRes?.byCity && typeof fcRes.byCity === 'object') {
            return Object.keys(fcRes.byCity);
        }
        if (!forecastChartData?.length) return [];
        const sample = forecastChartData[0];
        return Object.keys(sample).filter(
            k => k !== 'ts' && !k.endsWith('_hi') && !k.endsWith('_lo')
        );
    }, [fcRes, forecastChartData]);

    const cmpCombinedData = useMemo(() => {
        const cities = Object.keys(cmpChartData || {});
        if (cities.length === 0) return [];
        const merged = {};
        cities.forEach((cityName) => {
            const series = cmpChartData[cityName] || [];
            series.forEach((p) => {
                const key = p.ts;
                if (!merged[key]) merged[key] = { ts: key };
                merged[key][cityName] = p.pm25;
            });
        });
        return Object.values(merged).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    }, [cmpChartData]);

    const cmpCities = useMemo(() => Object.keys(cmpChartData || {}), [cmpChartData]);

    return (
        <div className="w-screen min-h-screen bg-gray-950 text-white relative overflow-x-hidden">
            <AuroraBackground />

            {/* Header */}
            <motion.header
                className="w-full bg-gray-900/80 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-700/50"
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                <div className="w-full px-6 py-4 flex items-center justify-between">
                    <button 
                        onClick={() => navigate('/home')}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-lg p-1"
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 flex items-center justify-center">
                            <CloudIcon />
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                            AirSense
                        </h1>
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-400">
                            API Status:
                            <span className={`ml-2 px-3 py-1 rounded-full text-xs font-medium ${
                                hz?.status === "ok"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}>
                                {hz?.status || "…"}
                            </span>
                        </div>
                    </div>
                </div>
            </motion.header>

            <main className="w-full px-6 py-8 space-y-8 max-w-7xl mx-auto min-h-screen pb-32">
                {/* Data Collection Tab */}
                {activeTab === 'data' && (
                    <DataCollectionTab
                        city={city}
                        setCity={setCity}
                        days={days}
                        setDays={setDays}
                        doScrape={doScrape}
                        scrapeLoading={scrapeLoading}
                        scrapeRes={scrapeRes}
                        scrapeChartData={scrapeChartData}
                        userPlan={user?.plan}
                    />
                )}

                {/* City Comparison Tab */}
                {activeTab === 'compare' && (user?.plan?.toLowerCase() === 'pro' || user?.plan?.toLowerCase() === 'enterprise') && (
                    <ComparisonTab
                        cmpInput={cmpInput}
                        setCmpInput={setCmpInput}
                        cmpDays={cmpDays}
                        setCmpDays={setCmpDays}
                        doCompare={doCompare}
                        cmpLoading={cmpLoading}
                        cmpRes={cmpRes}
                        cmpChartData={cmpChartData}
                        cmpCombined={cmpCombined}
                        setCmpCombined={setCmpCombined}
                        cmpCombinedData={cmpCombinedData}
                        cmpCities={cmpCities}
                        agentOut={agentOut}
                        userPlan={user?.plan}
                    />
                )}

                {/* Forecast Tab */}
                {activeTab === 'forecast' && (user?.plan?.toLowerCase() === 'pro' || user?.plan?.toLowerCase() === 'enterprise') && (
                    <ForecastTab
                        fcInput={fcInput}
                        setFcInput={setFcInput}
                        horizon={horizon}
                        setHorizon={setHorizon}
                        trainDays={trainDays}
                        setTrainDays={setTrainDays}
                        doForecast={doForecast}
                        fcLoading={fcLoading}
                        fcRes={fcRes}
                        forecastChartData={forecastChartData}
                        forecastCities={forecastCities}
                        showCI={showCI}
                        setShowCI={setShowCI}
                        fcCombined={fcCombined}
                        setFcCombined={setFcCombined}
                        userPlan={user?.plan}
                    />
                )}

                {/* AI Assistant Tab */}
                {activeTab === 'assistant' && user?.plan?.toLowerCase() === 'enterprise' && (
                    <GlassPanel title="AI Assistant" index={3}>
                        <ChatInterface
                            prompt={prompt}
                            setPrompt={setPrompt}
                            plan={plan}
                            agentOut={agentOut}
                            agentLoading={agentLoading}
                            doAgentPlan={doAgentPlan}
                            doAgentExecute={doAgentExecute}
                        />
                    </GlassPanel>
                )}

                {/* Plan Upgrade Prompt */}
                {activeTab === 'compare' && !(user?.plan?.toLowerCase() === 'pro' || user?.plan?.toLowerCase() === 'enterprise') && (
                    <GlassPanel title="City Comparison Analysis" index={1}>
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                <BarChartIcon />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">Upgrade to Pro Plan</h3>
                            <p className="text-gray-400 mb-6 max-w-md mx-auto">
                                City comparison analysis is available with Pro and Enterprise plans. 
                                Compare PM2.5 levels across multiple cities with interactive visualizations.
                            </p>
                            <button className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-300">
                                Upgrade to Pro
                            </button>
                        </div>
                    </GlassPanel>
                )}

                {activeTab === 'forecast' && user?.plan?.toLowerCase() === 'free' && (
                    <GlassPanel title="AI-Powered Forecasting" index={2}>
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-green-500/20 to-cyan-500/20 flex items-center justify-center">
                                <CpuIcon />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">Upgrade to Pro Plan</h3>
                            <p className="text-gray-400 mb-6 max-w-md mx-auto">
                                AI-powered forecasting is available with Pro and Enterprise plans. 
                                Predict future air quality trends using advanced machine learning models.
                            </p>
                            <button className="px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-cyan-600 transition-all duration-300">
                                Upgrade to Pro
                            </button>
                        </div>
                    </GlassPanel>
                )}

                {activeTab === 'assistant' && user?.plan?.toLowerCase() !== 'enterprise' && (
                    <GlassPanel title="AI Assistant" index={3}>
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-orange-500/20 to-red-500/20 flex items-center justify-center">
                                <MessageIcon />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">Upgrade to Enterprise Plan</h3>
                            <p className="text-gray-400 mb-6 max-w-md mx-auto">
                                AI Assistant is available with Enterprise plan. 
                                Get natural language queries for instant air quality insights and analysis.
                            </p>
                            <button className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition-all duration-300">
                                Upgrade to Enterprise
                            </button>
                        </div>
                    </GlassPanel>
                )}
            </main>

            <FloatingNav activeTab={activeTab} setActiveTab={setActiveTab} userPlan={user?.plan} />
        </div>
    );
}


