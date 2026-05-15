import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Webhook, Brain, Search, Zap } from "lucide-react"

const features = [
  {
    icon: Webhook,
    title: "Webhook Ingestion",
    description:
      "Accept signals from any external system — GitHub, PagerDuty, Slack, or custom sources. One endpoint, infinite triggers.",
  },
  {
    icon: Brain,
    title: "Autonomous Planning",
    description:
      "The Planner agent decomposes incoming signals into research tasks and an actionable execution plan — no human input needed.",
  },
  {
    icon: Search,
    title: "Intelligent Research",
    description:
      "The Researcher agent searches the web, queries APIs, and synthesizes findings into actionable intelligence in seconds.",
  },
  {
    icon: Zap,
    title: "Instant Action Delivery",
    description:
      "The Action agent executes the final step — posting to Slack, sending emails, or generating reports — all automatically.",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
}

export function Features() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="relative py-28 sm:py-32" id="features" ref={ref}>
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-sm font-medium tracking-wider text-primary uppercase">
            Core Capabilities
          </span>
          <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            From signal to action,{" "}
            <span className="text-gradient">fully autonomous</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            A three-agent pipeline that ingests, reasons, researches, and acts — all 
            in real-time with complete observability.
          </p>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={cardVariants}>
              <Card className="group relative h-full overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:glow-primary-sm hover:scale-[1.02]">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary transition-colors group-hover:bg-primary/15">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading text-base font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
