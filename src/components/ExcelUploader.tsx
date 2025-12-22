"use client"

import { useState, useCallback } from "react"
import { Button } from "./ui/Button"
import { Card } from "./ui/Card"

interface ExcelUploaderProps {
  onUploadSuccess?: () => void
}

export function ExcelUploader({ onUploadSuccess }: ExcelUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true)
    } else if (e.type === "dragleave") {
      setIsDragging(false)
    }
  }, [])

  const uploadFile = async (file: File) => {
    setIsUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Uppladdningen misslyckades")
      }

      setSuccess(data.message)
      onUploadSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ett fel uppstod")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      uploadFile(files[0])
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      uploadFile(files[0])
    }
  }

  return (
    <Card variant="glass" className="relative overflow-hidden">
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-12
          transition-all duration-300 ease-out
          ${isDragging 
            ? "border-emerald-500 bg-emerald-500/10" 
            : "border-slate-700 hover:border-slate-600"
          }
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        
        <div className="text-center">
          <div className={`
            w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center
            ${isDragging ? "bg-emerald-500/20" : "bg-slate-800"}
            transition-colors duration-300
          `}>
            <svg className={`w-8 h-8 ${isDragging ? "text-emerald-400" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <h3 className="text-lg font-semibold text-slate-100 mb-1">
            {isUploading ? "Laddar upp..." : "Släpp din Excel-fil här"}
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            eller klicka för att välja fil
          </p>
          <p className="text-xs text-slate-500">
            Stödjer .xlsx, .xls och .csv
          </p>
        </div>

        {isUploading && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center rounded-xl">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
              <p className="text-slate-300">Bearbetar fil...</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-emerald-400 text-sm">{success}</p>
          </div>
        </div>
      )}
    </Card>
  )
}

