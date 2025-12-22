"use client"

import { useState } from "react"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Card } from "./ui/Card"

interface FactorFormProps {
  supplierId: string
  onSuccess?: () => void
}

export function FactorForm({ supplierId, onSuccess }: FactorFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  
  const [formData, setFormData] = useState({
    factorName: "",
    factorValue: "",
    weight: "1",
    comment: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/factors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplierId,
          factorName: formData.factorName,
          factorValue: parseFloat(formData.factorValue),
          weight: parseFloat(formData.weight),
          comment: formData.comment || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Kunde inte spara faktorn")
      }

      // Reset form
      setFormData({
        factorName: "",
        factorValue: "",
        weight: "1",
        comment: "",
      })
      setIsOpen(false)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ett fel uppstod")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} variant="secondary">
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Lägg till egen faktor
      </Button>
    )
  }

  return (
    <Card variant="glass" className="animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100">Lägg till egen faktor</h3>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {showHelp ? "Dölj hjälp" : "Hur fungerar det?"}
        </button>
      </div>

      {/* Help section */}
      {showHelp && (
        <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-sm">
          <p className="text-slate-300 mb-3">
            Egna faktorer justerar leverantörens totalpoäng (max 10) baserat på information som inte finns i importerad data.
          </p>
          
          <div className="space-y-3">
            <div>
              <p className="font-medium text-emerald-400 mb-1">Poäng (-3 till +3) = VAD du vill säga</p>
              <p className="text-slate-400">
                Positiv (+) = något bra, höjer scoren. Negativ (-) = något dåligt, sänker scoren.
              </p>
            </div>
            
            <div>
              <p className="font-medium text-emerald-400 mb-1">Vikt (0-1) = HUR SÄKER du är</p>
              <p className="text-slate-400">
                1.0 = fakta, 100% säker. 0.5 = ganska säker. 0.2 = osäker/rykten.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-700">
              <p className="font-medium text-slate-300 mb-2">Exempel:</p>
              <div className="grid gap-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Fantastisk partner, bekräftad</span>
                  <span className="text-emerald-400">+3 × 1.0 = <strong>+3.0</strong></span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Bra partner, nya för oss</span>
                  <span className="text-emerald-400">+2 × 0.5 = <strong>+1.0</strong></span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Leveransproblem ibland</span>
                  <span className="text-red-400">-2 × 0.7 = <strong>-1.4</strong></span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Hört rykten om problem</span>
                  <span className="text-orange-400">-1 × 0.3 = <strong>-0.3</strong></span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-500">
                💡 Total score är max 10. En faktor på ±3 kan alltså ändra scoren med upp till 30%.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Faktornamn"
          placeholder="t.ex. Samarbetspartner, Leveransproblem, Lokal leverantör"
          value={formData.factorName}
          onChange={(e) => setFormData({ ...formData, factorName: e.target.value })}
          required
        />
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              label="Poäng (-3 till +3)"
              type="number"
              min="-3"
              max="3"
              step="0.5"
              placeholder="0"
              value={formData.factorValue}
              onChange={(e) => setFormData({ ...formData, factorValue: e.target.value })}
              required
            />
            <p className="text-xs text-slate-500 mt-1">+ bonus / - straff</p>
          </div>
          
          <div>
            <Input
              label="Vikt (0-1)"
              type="number"
              min="0"
              max="1"
              step="0.1"
              placeholder="1"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-1">1 = säker, 0.5 = osäker</p>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Kommentar (valfritt)
          </label>
          <textarea
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-200 resize-none"
            rows={3}
            placeholder="Beskriv varför du lagt till denna faktor..."
            value={formData.comment}
            onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
          />
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
          >
            Spara faktor
          </Button>
        </div>
      </form>
    </Card>
  )
}
