import { motion } from "framer-motion"
import { Radio } from "lucide-react"
import { TriggerForm } from "@/components/trigger/TriggerForm"

export function TriggerPage() {
  return (
    <div className="min-h-screen px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Radio className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Trigger Pipeline
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Provide a GitHub commit URL to analyze it with the agent pipeline.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mt-8 max-w-3xl"
      >
        <TriggerForm />
      </motion.div>
    </div>
  )
}
