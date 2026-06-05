/**
 * App root — runs migrations once, then mounts the welder module shell.
 */
import { useState } from 'react'
import { runMigrations } from './core/db/migrations'
import AppShell from './app/AppShell'

runMigrations()

export default function App() {
  const [moduleId] = useState('welder')
  return <AppShell moduleId={moduleId} />
}
