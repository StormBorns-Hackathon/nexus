import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { CheckCircle2, ArrowRight } from "lucide-react"

const benefits = [
  "Zero human intervention after webhook fires",
  "Three specialized agents working in concert",
  "Real-time trace dashboard with full observability",
  "Signal to deliverable in under 60 seconds",
  "Extensible to any webhook source or action target",
]

export function WhyUs() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="relative py-28 sm:py-32" id="why-us" ref={ref}>
      <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[500px] rounded-full bg-primary/4 blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
          >
            <span className="text-sm font-medium tracking-wider text-primary uppercase">Why Nexus</span>
            <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Infrastructure that <span className="text-gradient">thinks for itself</span>
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground leading-relaxed">
              Teams waste hours triaging alerts, researching context, and executing actions manually. Nexus eliminates the entire loop.
            </p>
            <ul className="mt-8 space-y-3.5">
              {benefits.map((b, i) => (
                <motion.li key={b} initial={{ opacity: 0, x: -20 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.3 + i * 0.1 }} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-foreground/80">{b}</span>
                </motion.li>
              ))}
            </ul>
            <motion.a href="#" initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} transition={{ delay: 0.8 }} className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80">
              Learn more about the architecture <ArrowRight className="h-3.5 w-3.5" />
            </motion.a>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 40 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.7, delay: 0.2 }} className="relative">
            <div className="glow-primary relative overflow-hidden rounded-2xl border border-border/40 bg-card/50 p-8 backdrop-blur-sm">
              <div className="space-y-6">
                <div className="text-center">
                  <span className="font-heading text-xs font-semibold tracking-wider text-muted-foreground uppercase">Agent Pipeline</span>
                </div>
                {[
                  { label: "Webhook Received", sub: "POST /api/webhooks/ingest", c: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
                  { label: "Planner Agent", sub: "Decompose → Tasks + Plan", c: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
                  { label: "Researcher Agent", sub: "Tavily → APIs → Synthesis", c: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20" },
                  { label: "Action Agent", sub: "Slack → Email → Report", c: "bg-green-500/15 text-green-400 border-green-500/20" },
                ].map((node, i) => (
                  <motion.div key={node.label} initial={{ opacity: 0, scale: 0.9 }} animate={isInView ? { opacity: 1, scale: 1 } : {}} transition={{ delay: 0.5 + i * 0.15 }}>
                    {i > 0 && <div className="mx-auto mb-3 h-4 w-px bg-border/50" />}
                    <div className={`rounded-lg border p-3 ${node.c}`}>
                      <p className="text-xs font-semibold">{node.label}</p>
                      <p className="mt-0.5 text-[10px] opacity-70">{node.sub}</p>
                    </div>
                  </motion.div>
                ))}
                <motion.div initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} transition={{ delay: 1.2 }} className="text-center">
                  <div className="mx-auto mb-2 h-4 w-px bg-border/50" />
                  <div className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-1.5 text-xs font-medium text-green-400">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    Deliverable Sent — 47s
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
