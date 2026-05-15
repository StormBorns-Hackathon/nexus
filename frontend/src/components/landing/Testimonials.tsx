import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Quote } from "lucide-react"

const testimonials = [
  {
    quote: "We plugged Nexus into our PagerDuty alerts and now get Slack summaries with full context before our on-call engineer even wakes up.",
    name: "Marcus Chen",
    role: "SRE Lead, ScaleOps",
    initials: "MC",
  },
  {
    quote: "The real-time trace dashboard is a game-changer. We can see exactly what each agent is thinking, searching, and doing — total transparency.",
    name: "Priya Sharma",
    role: "Engineering Manager, DevPipeline",
    initials: "PS",
  },
  {
    quote: "We went from 45 minutes of manual triage per alert to fully autonomous resolution in under a minute. Nexus is the future of ops.",
    name: "Alex Rivera",
    role: "Platform Engineer, CloudScale",
    initials: "AR",
  },
]

export function Testimonials() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="relative py-28 sm:py-32" id="testimonials" ref={ref}>
      <div className="mx-auto max-w-7xl px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium tracking-wider text-primary uppercase">Testimonials</span>
          <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Trusted by <span className="text-gradient">engineering teams</span>
          </h2>
        </motion.div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div key={t.name} initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: i * 0.15, duration: 0.6 }}>
              <Card className="group h-full border-border/40 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:shadow-[0_0_30px_oklch(0.65_0.2_275/6%)]">
                <CardContent className="flex h-full flex-col p-6">
                  <Quote className="mb-4 h-5 w-5 text-primary/40" />
                  <p className="flex-1 text-sm leading-relaxed text-foreground/80">{t.quote}</p>
                  <div className="mt-6 flex items-center gap-3 border-t border-border/30 pt-4">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{t.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
