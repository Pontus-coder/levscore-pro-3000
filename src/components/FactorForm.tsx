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
      <h3 className="text-lg font-semibold text-slate-100 mb-4">Lägg till egen faktor</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Faktornamn"
          placeholder="t.ex. Leveranssäkerhet"
          value={formData.factorName}
          onChange={(e) => setFormData({ ...formData, factorName: e.target.value })}
          required
        />
        
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Poäng (-100 till 100)"
            type="number"
            min="-100"
            max="100"
            placeholder="0"
            value={formData.factorValue}
            onChange={(e) => setFormData({ ...formData, factorValue: e.target.value })}
            required
          />
          
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

