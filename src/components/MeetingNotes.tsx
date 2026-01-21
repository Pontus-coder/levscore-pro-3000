"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

interface MeetingNote {
  id: string
  content: string
  meetingDate: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string | null
    image: string | null
  }
}

interface MeetingNotesProps {
  supplierId: string
}

export function MeetingNotes({ supplierId }: MeetingNotesProps) {
  const { data: session } = useSession()
  const [notes, setNotes] = useState<MeetingNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [newContent, setNewContent] = useState("")
  const [newMeetingDate, setNewMeetingDate] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editMeetingDate, setEditMeetingDate] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchNotes = useCallback(async () => {
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/meeting-notes`)
      if (!response.ok) {
        throw new Error("Kunde inte hämta mötesanteckningar")
      }
      const data = await response.json()
      setNotes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ett fel uppstod")
    } finally {
      setIsLoading(false)
    }
  }, [supplierId])

  useEffect(() => {
    if (session) {
      fetchNotes()
    }
  }, [session, fetchNotes])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/meeting-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newContent,
          meetingDate: newMeetingDate || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte skapa anteckning")
      }

      // Reset form and refresh notes
      setNewContent("")
      setNewMeetingDate("")
      fetchNotes()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ett fel uppstod")
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEditing = (note: MeetingNote) => {
    setEditingId(note.id)
    setEditContent(note.content)
    setEditMeetingDate(note.meetingDate ? note.meetingDate.split("T")[0] : "")
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditContent("")
    setEditMeetingDate("")
  }

  const handleUpdate = async (noteId: string) => {
    if (!editContent.trim()) return

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/meeting-notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editContent,
          meetingDate: editMeetingDate || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte uppdatera anteckning")
      }

      cancelEditing()
      fetchNotes()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ett fel uppstod")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/meeting-notes/${noteId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte ta bort anteckning")
      }

      setDeletingId(null)
      fetchNotes()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ett fel uppstod")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatMeetingDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  if (isLoading) {
    return (
      <Card variant="glass">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-slate-400/20 border-t-slate-400 rounded-full animate-spin" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card variant="glass">
        <p className="text-red-400">{error}</p>
      </Card>
    )
  }

  return (
    <Card variant="glass">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-amber-500/20">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Mötesanteckningar</h2>
          <p className="text-xs text-slate-500">Dokumentera möten och samtal med leverantören</p>
        </div>
      </div>

      {/* New note form */}
      <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Ny anteckning
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Skriv din anteckning här..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 resize-none"
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Mötesdatum (valfritt)
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={newMeetingDate}
                  onChange={(e) => setNewMeetingDate(e.target.value)}
                  className="w-full px-3 py-2 pl-10 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 cursor-pointer [color-scheme:dark]"
                />
                <svg 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400 pointer-events-none" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <Button
              type="submit"
              disabled={isSubmitting || !newContent.trim()}
              size="md"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                  Sparar...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Lägg till
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Notes timeline */}
      {notes.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-700" />
          
          <div className="space-y-4">
            {notes.map((note, index) => (
              <div key={note.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                  index === 0 
                    ? "bg-amber-500 border-amber-400" 
                    : "bg-slate-700 border-slate-600"
                }`} style={{ top: "1.25rem" }} />
                
                {/* Note card */}
                <div className={`p-4 rounded-xl border ${
                  editingId === note.id
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                } transition-colors`}>
                  {editingId === note.id ? (
                    // Edit mode
                    <div className="space-y-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 resize-none"
                      />
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <input
                            type="date"
                            value={editMeetingDate}
                            onChange={(e) => setEditMeetingDate(e.target.value)}
                            className="w-full px-3 py-2 pl-10 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 cursor-pointer [color-scheme:dark]"
                          />
                          <svg 
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400 pointer-events-none" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <Button
                          onClick={() => handleUpdate(note.id)}
                          disabled={isUpdating || !editContent.trim()}
                          size="sm"
                        >
                          {isUpdating ? "Sparar..." : "Spara"}
                        </Button>
                        <Button
                          onClick={cancelEditing}
                          variant="ghost"
                          size="sm"
                        >
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  ) : deletingId === note.id ? (
                    // Delete confirmation
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-sm text-slate-300 mb-3">
                        Är du säker på att du vill ta bort denna anteckning?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleDelete(note.id)}
                          variant="danger"
                          size="sm"
                        >
                          Ta bort
                        </Button>
                        <Button
                          onClick={() => setDeletingId(null)}
                          variant="ghost"
                          size="sm"
                        >
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {note.user.image ? (
                            <img
                              src={note.user.image}
                              alt={note.user.name || "User"}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                              <span className="text-xs text-slate-400">
                                {note.user.name?.charAt(0) || "?"}
                              </span>
                            </div>
                          )}
                          <span className="text-sm font-medium text-slate-300">
                            {note.user.name || "Okänd användare"}
                          </span>
                        </div>
                        
                        {/* Actions (only for the author) */}
                        {session?.user?.email && note.user.id === (session.user as { id?: string }).id && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEditing(note)}
                              className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors"
                              title="Redigera"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeletingId(note.id)}
                              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                              title="Ta bort"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Meeting date badge */}
                      {note.meetingDate && (
                        <div className="mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Möte: {formatMeetingDate(note.meetingDate)}
                          </span>
                        </div>
                      )}
                      
                      {/* Content */}
                      <p className="text-slate-200 whitespace-pre-wrap">{note.content}</p>
                      
                      {/* Timestamp */}
                      <p className="mt-3 text-xs text-slate-500">
                        {formatDate(note.createdAt)}
                        {note.updatedAt !== note.createdAt && " (redigerad)"}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <p className="text-slate-500 text-sm">Inga mötesanteckningar ännu</p>
          <p className="text-slate-600 text-xs mt-1">Lägg till din första anteckning ovan</p>
        </div>
      )}
    </Card>
  )
}

