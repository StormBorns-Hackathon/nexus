import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Radio, Send, CheckCircle, Code } from "lucide-react"
import { triggerScenarios } from "@/data/mock"
import { cn } from "@/lib/utils"

export function TriggerForm() {
  const [selected, setSelected] = useState(triggerScenarios[0].id)
  const [customPayload, setCustomPayload] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [showPayload, setShowPayload] = useState(false)

  const activeScenario = triggerScenarios.find((s) => s.id === selected)!

  function handleTrigger() {
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Scenario Selection */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Select Scenario</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {triggerScenarios.map((scenario, i) => (
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
            >
              <Card
                className={cn(
                  "cursor-pointer border transition-all duration-200",
                  selected === scenario.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card hover:border-border hover:bg-accent"
                )}
                onClick={() => setSelected(scenario.id)}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      selected === scenario.id
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30 bg-transparent"
                    )}
                  >
                    {selected === scenario.id && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{scenario.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{scenario.description}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Payload Preview */}
      <div>
        <button
          onClick={() => setShowPayload(!showPayload)}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Code className="h-3.5 w-3.5" />
          {showPayload ? "Hide" : "Preview"} Payload
        </button>

        {showPayload && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.2 }}
            className="mt-3"
          >
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {JSON.stringify(activeScenario.payload, null, 2)}
            </pre>
          </motion.div>
        )}
      </div>

      {/* Custom payload for custom scenario */}
      {selected === "custom_webhook" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <label className="mb-2 block text-sm font-medium text-foreground">
            Custom Payload (JSON)
          </label>
          <textarea
            value={customPayload}
            onChange={(e) => setCustomPayload(e.target.value)}
            placeholder='{"description": "Your custom signal..."}'
            className="h-32 w-full rounded-lg border border-input bg-muted px-4 py-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
          />
        </motion.div>
      )}

      {/* Trigger Button */}
      <div className="flex items-center gap-4">
        <Button
          size="lg"
          onClick={handleTrigger}
          disabled={submitted}
          className={cn(
            "h-11 px-6 text-sm transition-all",
            submitted
              ? "bg-chart-1 text-chart-1"
              : ""
          )}
        >
          {submitted ? (
            <>
              <CheckCircle className="mr-1.5 h-4 w-4" />
              Webhook Fired!
            </>
          ) : (
            <>
              <Send className="mr-1.5 h-4 w-4" />
              Fire Webhook
            </>
          )}
        </Button>
        {submitted && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs text-chart-1"
          >
            Workflow created — redirecting to trace view...
          </motion.span>
        )}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3.5">
        <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          This will simulate a webhook ingestion. In production, external services like GitHub or
          PagerDuty would send these payloads automatically via{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">POST /api/webhooks/ingest</code>.
        </p>
      </div>
    </div>
  )
}
