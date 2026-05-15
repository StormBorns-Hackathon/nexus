import { motion } from "framer-motion"
import { TriggerForm } from "@/components/trigger/TriggerForm"

export function TriggerPage() {
  return (
    <div className="min-h-screen px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Trigger Pipeline
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Provide a GitHub PR or Issue URL to analyze it with the agent pipeline.
        </p>
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
