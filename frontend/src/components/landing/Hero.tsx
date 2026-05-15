import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play, Zap, Search, Send } from "lucide-react"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.3 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
}

function FloatingDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const }}
      className="relative mx-auto mt-16 max-w-4xl px-4 sm:mt-20 lg:mt-24"
    >
      {/* Ambient glow behind the card */}
      <div className="absolute inset-0 -top-10 mx-auto h-full w-3/4 rounded-3xl bg-primary/8 blur-3xl" />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="glow-primary relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-1 backdrop-blur-sm"
      >
        {/* Top bar */}
        <div className="flex items-center gap-2 rounded-t-xl border-b border-border/30 bg-background/50 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
          </div>
          <div className="ml-3 flex-1 rounded-md bg-muted/30 px-3 py-1">
            <span className="font-mono text-[10px] text-muted-foreground">
              nexus.app/workflows/live
            </span>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="space-y-3 p-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-xs font-medium text-foreground/80">
                Live Trace — GitHub Issue #284
              </span>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
              Running
            </span>
          </div>

          {/* Agent Steps */}
          {([
            {
              agent: "Planner",
              status: "Completed",
              detail: "Decomposed into 3 research tasks",
              icon: Zap,
              done: true,
              active: false,
            },
            {
              agent: "Researcher",
              status: "Active",
              detail: "Searching Tavily + GitHub API...",
              icon: Search,
              done: false,
              active: true,
            },
            {
              agent: "Action",
              status: "Pending",
              detail: "Will send summary to #eng-alerts",
              icon: Send,
              done: false,
              active: false,
            },
          ] as const).map((step, i) => (
            <motion.div
              key={step.agent}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 + i * 0.3, duration: 0.5 }}
              className={`flex items-center gap-3 rounded-lg border p-3 ${step.active
                  ? "border-primary/30 bg-primary/5"
                  : step.done
                    ? "border-border/20 bg-muted/20"
                    : "border-border/10 bg-muted/10"
                }`}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-md ${step.active
                    ? "bg-primary/15 text-primary"
                    : step.done
                      ? "bg-green-500/10 text-green-400"
                      : "bg-muted/30 text-muted-foreground"
                  }`}
              >
                <step.icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{step.agent} Agent</span>
                  <span
                    className={`text-[9px] font-medium ${step.active
                        ? "text-primary"
                        : step.done
                          ? "text-green-400"
                          : "text-muted-foreground"
                      }`}
                  >
                    {step.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {step.detail}
                </p>
              </div>
              {step.active && (
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden pt-32 pb-20" id="hero">
      {/* Background Effects */}
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute top-0 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
      <div className="pointer-events-none absolute top-40 right-0 h-[300px] w-[400px] rounded-full bg-primary/3 blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-3xl text-center"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-8 flex justify-center">
            <div className="glow-primary-sm inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-sm">
              <Zap className="h-3 w-3" />
              Autonomous Multi-Agent Pipelines
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="font-heading text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Drop a signal,{" "}
            <span className="text-gradient">get a completed action</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Fire a webhook. Watch agents plan, research, and act — autonomously.
            Nexus transforms signals into real-world deliverables in under 60 seconds.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link to="/trigger">
              <Button
                size="lg"
                className="glow-primary group bg-primary px-8 text-primary-foreground transition-all duration-300 hover:scale-[1.02] hover:bg-primary/90"
              >
                Fire a Webhook
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button
                variant="ghost"
                size="lg"
                className="group text-muted-foreground hover:text-foreground"
              >
                <Play className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                Watch Demo
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Floating Dashboard Preview */}
        <FloatingDashboard />
      </div>
    </section>
  )
}
