"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { AdminLayout } from "@/components/admin/AdminLayout"
import { CanAccess } from "@/components/admin/ProtectedRoute"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchApi } from "@/lib/api"
import { env as clientEnv } from "@/config/env"
import { endpoints } from "@/config/endpoints"
import {
  Megaphone,
  RefreshCw,
  ExternalLink,
  RotateCcw,
  Loader2,
  Rss
} from "lucide-react"

type JobStatus = "queued" | "processing" | "success" | "retrying" | "failed"

interface SyndicationEntry {
  jobId: string
  propertyId: string
  propertyTitle: string
  channel: string
  status: JobStatus
  attempt: number
  durationMs: number
  error: string
  externalRef: string
  lastAttemptAt: string
}

interface SyndicationStatus {
  enabled: boolean
  channels: string[]
  boardEnabled: boolean
  entries: SyndicationEntry[]
}

const STATUS_STYLES: Record<JobStatus, string> = {
  success: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  retrying: "bg-warning/15 text-warning",
  processing: "bg-primary/15 text-primary",
  queued: "bg-muted text-muted-foreground",
}

const STATUS_LABELS: Record<JobStatus, string> = {
  success: "Publicado",
  failed: "Fallido",
  retrying: "Reintentando",
  processing: "Procesando",
  queued: "En cola",
}

const CHANNEL_LABELS: Record<string, string> = {
  "meta-graph": "Meta (FB/IG)",
  "xml-feed": "Feed XML",
  "json-feed": "Feed JSON",
}

function StatusChip({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export default function SyndicationDashboard() {
  const { data: session } = useSession()
  const [status, setStatus] = useState<SyndicationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryingKey, setRetryingKey] = useState<string | null>(null)

  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    const token = session?.accessToken
    if (!token) return
    let active = true
    const fetchStatus = async () => {
      try {
        const data = await fetchApi<SyndicationStatus>(endpoints.syndication.status, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!active) return
        setStatus(data)
        setError(null)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Error al cargar el estado")
      } finally {
        if (active) setIsLoading(false)
      }
    }
    fetchStatus()
    // ponytail: fixed 15s poll; move to SSE/socket if live updates ever matter
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchStatus()
    }, 15_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [session?.accessToken, tick])

  const handleRetry = async (entry: SyndicationEntry, action: "publish" | "unpublish") => {
    const token = session?.accessToken
    if (!token) return
    const key = `${entry.propertyId}:${entry.channel}`
    setRetryingKey(key)
    try {
      await fetchApi(endpoints.syndication.retry, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ propertyId: entry.propertyId, channel: entry.channel, action }),
      })
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reencolar")
    } finally {
      setRetryingKey(null)
    }
  }

  const formatDuration = (ms: number) => (ms > 0 ? `${ms} ms` : "—")
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "medium" })

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Publicaciones</h1>
            <p className="text-muted-foreground">
              Estado de sincronización de propiedades con canales externos
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <CanAccess resource="syndication" action="read">
              {status?.boardEnabled && (
                <a
                  href={`${clientEnv.API_URL}${endpoints.syndication.board}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Añade ?token=QUEUE_BOARD_TOKEN a la URL para autenticarte"
                >
                  <Button variant="outline">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Panel de jobs
                  </Button>
                </a>
              )}
            </CanAccess>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>
        )}

        {/* Channel + feed summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Megaphone className="mr-2 h-5 w-5" />
              Canales activos
            </CardTitle>
            <CardDescription>
              Los canales se configuran con <code className="text-xs">SYNDICATION_CHANNELS</code> en el backend
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {status && status.channels.length > 0 ? (
              status.channels.map((channel) => (
                <span key={channel} className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                  {CHANNEL_LABELS[channel] ?? channel}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Sindicación deshabilitada — el historial de intentos se conserva y sigue consultable.
              </p>
            )}
            <span className="ml-auto flex items-center gap-3 text-sm">
              <a
                href={`${clientEnv.API_URL}/feeds/properties.xml`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-primary hover:underline"
              >
                <Rss className="mr-1 h-4 w-4" /> Feed XML
              </a>
              <a
                href={`${clientEnv.API_URL}/feeds/properties.json`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-primary hover:underline"
              >
                <Rss className="mr-1 h-4 w-4" /> Feed JSON
              </a>
            </span>
          </CardContent>
        </Card>

        {/* Tabla de intentos */}
        <Card>
          <CardHeader>
            <CardTitle>Último intento por propiedad y canal</CardTitle>
            <CardDescription>
              Cada publicación, reintento y fallo queda registrado (JobLog) con su duración
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : status && status.entries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Propiedad</th>
                      <th className="pb-2 pr-4 font-medium">Canal</th>
                      <th className="pb-2 pr-4 font-medium">Estado</th>
                      <th className="pb-2 pr-4 font-medium">Intento</th>
                      <th className="pb-2 pr-4 font-medium">Duración</th>
                      <th className="pb-2 pr-4 font-medium">Último intento</th>
                      <th className="pb-2 pr-4 font-medium">Ref. externa / Error</th>
                      <th className="pb-2 font-medium text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.entries.map((entry) => {
                      const key = `${entry.propertyId}:${entry.channel}`
                      const isRetrying = retryingKey === key
                      return (
                        <tr key={key} className="border-b last:border-0 align-top">
                          <td className="py-3 pr-4">
                            <p className="font-medium text-foreground">{entry.propertyTitle || "Propiedad eliminada"}</p>
                            <p className="text-xs text-muted-foreground">{entry.propertyId}</p>
                          </td>
                          <td className="py-3 pr-4 text-foreground">{CHANNEL_LABELS[entry.channel] ?? entry.channel}</td>
                          <td className="py-3 pr-4">
                            <StatusChip status={entry.status} />
                          </td>
                          <td className="py-3 pr-4 text-foreground">{entry.attempt}</td>
                          <td className="py-3 pr-4 text-foreground">{formatDuration(entry.durationMs)}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{formatTime(entry.lastAttemptAt)}</td>
                          <td className="py-3 pr-4 max-w-xs">
                            {entry.externalRef ? (
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{entry.externalRef}</code>
                            ) : entry.error ? (
                              <p className="text-xs text-destructive truncate" title={entry.error}>
                                {entry.error}
                              </p>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              size="sm"
                              variant={entry.status === "failed" || entry.status === "retrying" ? "default" : "outline"}
                              onClick={() => handleRetry(entry, entry.jobId.startsWith("unpublish:") ? "unpublish" : "publish")}
                              disabled={isRetrying}
                            >
                              {isRetrying ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="mr-1 h-3 w-3" />
                              )}
                              {entry.status === "failed" || entry.status === "retrying"
                                ? entry.jobId.startsWith("unpublish:") ? "Reintentar baja" : "Reintentar"
                                : "Republicar"}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Todavía no hay intentos de publicación. Edita una propiedad con sindicación activa para verlos aquí.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
