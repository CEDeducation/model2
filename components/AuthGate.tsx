"use client"

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react"
import {
  createCloudLabProfile,
  createCloudWorkspace,
  getCloudConfig,
  getStoredSession,
  listCloudLabProfiles,
  listCloudWorkspaces,
  signIn,
  signOutLocal,
  signUp,
  verifyCloudLabProfilePin,
  type CloudLabProfile,
} from "@/lib/cloud"
import {
  createLocalMainAccount,
  createLocalProfile,
  getLocalMainAccount,
  hasLocalMainAccount,
  hasLocalMainSession,
  listLocalProfiles,
  localMainSignIn,
  localMainSignOut,
  verifyLocalProfile,
} from "@/lib/local-auth"
import {
  clearActiveLabSession,
  getActiveLabSession,
  setActiveLabSession,
  type LabProfileCard,
  type LabProfileRole,
} from "@/lib/lab-session"

type Screen = "loading" | "main" | "workspace" | "profiles" | "create-profile" | "app"
type WorkspaceCard = { id: string; name: string }

const WORKSPACE_KEY = "openlab.active-workspace.v1"
const PROFILE_COLORS = ["#2d6f63", "#6b63d9", "#b96849", "#4f7ca5"]

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || "OL").toUpperCase()
}

function friendlyRole(role: LabProfileRole) {
  if (role === "owner") return "Lab owner / PI"
  if (role === "researcher") return "Researcher"
  if (role === "student") return "Student"
  return "Viewer"
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>("loading")
  const [cloudMode, setCloudMode] = useState(false)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [labName, setLabName] = useState("My Lab")

  const [workspaces, setWorkspaces] = useState<WorkspaceCard[]>([])
  const [workspace, setWorkspace] = useState<WorkspaceCard | null>(null)
  const [profiles, setProfiles] = useState<LabProfileCard[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState("")
  const [pin, setPin] = useState("")

  const [profileName, setProfileName] = useState("")
  const [profileRole, setProfileRole] = useState<LabProfileRole>("student")
  const [profilePin, setProfilePin] = useState("")

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const configured = Boolean(getCloudConfig())
      setCloudMode(configured)

      if (configured && getStoredSession()) {
        try {
          await enterCloudFlow(cancelled)
          return
        } catch (error) {
          if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not restore the cloud session.")
        }
      }

      if (!configured && hasLocalMainSession()) {
        try {
          enterLocalFlow(cancelled)
          return
        } catch (error) {
          if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not restore the local session.")
        }
      }

      if (!cancelled) setScreen("main")
    }

    void boot()

    const switchProfile = () => {
      clearActiveLabSession()
      setSelectedProfileId("")
      setPin("")
      setScreen("profiles")
    }
    window.addEventListener("openlab:switch-profile", switchProfile)
    return () => {
      cancelled = true
      window.removeEventListener("openlab:switch-profile", switchProfile)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function enterCloudFlow(cancelled = false) {
    const rows = await listCloudWorkspaces()
    if (cancelled) return
    const cards = (rows || []).map(item => ({ id: item.id, name: item.name }))
    setWorkspaces(cards)
    if (!cards.length) {
      setScreen("workspace")
      return
    }

    const rememberedId = window.localStorage.getItem(WORKSPACE_KEY)
    const chosen = cards.find(item => item.id === rememberedId) || cards[0]
    await chooseCloudWorkspace(chosen, cancelled)
  }

  function enterLocalFlow(cancelled = false) {
    if (cancelled) return
    const account = getLocalMainAccount()
    if (!account) {
      setScreen("main")
      return
    }
    const chosen = { id: account.workspaceId, name: account.labName }
    const cards = listLocalProfiles()
    setWorkspace(chosen)
    setProfiles(cards)
    maybeResumeProfile("local", chosen, cards)
  }

  async function chooseCloudWorkspace(chosen: WorkspaceCard, cancelled = false) {
    window.localStorage.setItem(WORKSPACE_KEY, chosen.id)
    const cards = (await listCloudLabProfiles(chosen.id)) as LabProfileCard[]
    if (cancelled) return
    setWorkspace(chosen)
    setProfiles(cards)
    maybeResumeProfile("cloud", chosen, cards)
  }

  function maybeResumeProfile(mode: "cloud" | "local", chosen: WorkspaceCard, cards: LabProfileCard[]) {
    const active = getActiveLabSession()
    if (active && active.mode === mode && active.workspaceId === chosen.id && cards.some(item => item.id === active.profile.id)) {
      setScreen("app")
      return
    }
    if (!cards.length) {
      setProfileRole("owner")
      setScreen("create-profile")
      return
    }
    setScreen("profiles")
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setMessage("")
    try { await action() }
    catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong.") }
    finally { setBusy(false) }
  }

  async function handleMainSubmit(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      if (cloudMode) {
        await signIn(email.trim(), password)
        setPassword("")
        await enterCloudFlow()
        return
      }

      if (!hasLocalMainAccount()) throw new Error("Create the first local account on this device before signing in.")
      await localMainSignIn(email, password)
      setPassword("")
      enterLocalFlow()
    })
  }

  async function createMainAccount() {
    await run(async () => {
      if (cloudMode) {
        await signUp(email.trim(), password)
        setPassword("")
        if (getStoredSession()) {
          await enterCloudFlow()
        } else {
          setMessage("Account created. Confirm the email from Supabase, then sign in.")
        }
        return
      }

      const account = await createLocalMainAccount(email, password, labName)
      setLabName(account.labName)
      setPassword("")
      enterLocalFlow()
    })
  }

  async function createWorkspace() {
    await run(async () => {
      if (!cloudMode) return
      const created = await createCloudWorkspace(labName.trim() || "My Lab")
      if (!created) throw new Error("The lab workspace could not be created.")
      const chosen = { id: created.id, name: created.name }
      setWorkspaces([chosen])
      setWorkspace(chosen)
      window.localStorage.setItem(WORKSPACE_KEY, chosen.id)
      setProfiles([])
      setProfileRole("owner")
      setScreen("create-profile")
    })
  }

  async function addProfile(event: FormEvent) {
    event.preventDefault()
    if (!workspace) return
    await run(async () => {
      if (!profileName.trim()) throw new Error("Enter a profile name.")
      if (!/^\d{4,8}$/.test(profilePin)) throw new Error("Use a 4–8 digit numeric profile PIN.")
      if (profiles.length >= 4) throw new Error("This lab already has 4 profiles.")

      const role: LabProfileRole = profiles.length ? profileRole : "owner"
      if (cloudMode) {
        await createCloudLabProfile(workspace.id, profileName.trim(), role, profilePin)
        const next = (await listCloudLabProfiles(workspace.id)) as LabProfileCard[]
        setProfiles(next)
      } else {
        await createLocalProfile(profileName.trim(), role, profilePin)
        setProfiles(listLocalProfiles())
      }

      setProfileName("")
      setProfilePin("")
      setProfileRole("student")
      setScreen("profiles")
    })
  }

  async function unlockProfile() {
    const selected = profiles.find(item => item.id === selectedProfileId)
    if (!selected || !workspace) return
    await run(async () => {
      const valid = cloudMode
        ? await verifyCloudLabProfilePin(selected.id, pin)
        : await verifyLocalProfile(selected.id, pin)
      if (!valid) throw new Error("That profile PIN is incorrect.")
      setActiveLabSession({
        mode: cloudMode ? "cloud" : "local",
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        profile: selected,
        verifiedAt: Date.now(),
      })
      setPin("")
      setScreen("app")
    })
  }

  function signOutMain() {
    clearActiveLabSession()
    if (cloudMode) signOutLocal()
    else localMainSignOut()
    setWorkspace(null)
    setProfiles([])
    setSelectedProfileId("")
    setPin("")
    setScreen("main")
  }

  const selectedProfile = useMemo(() => profiles.find(item => item.id === selectedProfileId) || null, [profiles, selectedProfileId])

  if (screen === "app") return <>{children}</>

  return (
    <main className="authStage">
      <div className="authBackdropGlow authGlowOne"/>
      <div className="authBackdropGlow authGlowTwo"/>

      <section className="authBrandPanel">
        <div className="authBrandMark">OL</div>
        <div className="authBrandCopy">
          <span>OPENLAB</span>
          <h1>Research belongs to the lab.<br/>Identity belongs to the researcher.</h1>
          <p>One lab account, up to four protected profiles, shared research spaces, personal work, and persistent scientific data.</p>
        </div>
        <div className="authFeatureStrip">
          <div><b>01</b><span>Main lab login</span></div>
          <div><b>02</b><span>Choose your profile</span></div>
          <div><b>03</b><span>Resume exactly where you stopped</span></div>
        </div>
      </section>

      <section className="authCardWrap">
        <div className="authCard">
          {screen === "loading" && (
            <div className="authLoading"><div className="authSpinner"/><strong>Opening OpenLab…</strong><span>Restoring your workspace and profile.</span></div>
          )}

          {screen === "main" && (
            <>
              <div className="authStep"><span>1</span><div><b>Main account</b><small>{cloudMode ? "Supabase-secured lab login" : "Local encrypted device login"}</small></div></div>
              <h2>{hasLocalMainAccount() || cloudMode ? "Sign in to your lab" : "Create your OpenLab lab"}</h2>
              <p className="authLead">Use one main lab account. After sign-in, each researcher chooses their own protected profile.</p>

              {!cloudMode && !hasLocalMainAccount() && (
                <label className="authField"><span>Lab name</span><input value={labName} onChange={event => setLabName(event.target.value)} placeholder="e.g. Sharma Molecular Biology Lab"/></label>
              )}
              <form onSubmit={handleMainSubmit}>
                <label className="authField"><span>Email</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="lab@university.edu" autoComplete="email"/></label>
                <label className="authField"><span>Password</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={hasLocalMainAccount() || cloudMode ? "current-password" : "new-password"}/></label>
                {(hasLocalMainAccount() || cloudMode) && <button className="authPrimary" disabled={busy || !email || password.length < 6} type="submit">{busy ? "Signing in…" : "Continue"}<span>→</span></button>}
              </form>
              {(!hasLocalMainAccount() || cloudMode) && <button className="authSecondary" disabled={busy || !email || password.length < 8 || (!cloudMode && !labName.trim())} onClick={createMainAccount}>{cloudMode ? "Create a new lab account" : "Create local lab account"}</button>}

              <div className={`authModeNotice ${cloudMode ? "cloud" : "local"}`}><span>{cloudMode ? "●" : "○"}</span><div><strong>{cloudMode ? "Cloud persistence enabled" : "Offline-first local mode"}</strong><small>{cloudMode ? "Data can sync through your Supabase workspace." : "This browser stores the account and research locally. Add Supabase environment variables for multi-device sharing."}</small></div></div>
            </>
          )}

          {screen === "workspace" && (
            <>
              <div className="authStep"><span>1</span><div><b>Main account verified</b><small>Create the lab shared by your profiles</small></div></div>
              <h2>Name your lab workspace</h2>
              <p className="authLead">This is the shared research space containing projects, notebook records, registry data, sequences, inventory and protocols.</p>
              <label className="authField"><span>Lab workspace</span><input value={labName} onChange={event => setLabName(event.target.value)} placeholder="e.g. Sharma Molecular Biology Lab"/></label>
              <button className="authPrimary" disabled={busy || !labName.trim()} onClick={createWorkspace}>{busy ? "Creating…" : "Create lab workspace"}<span>→</span></button>
            </>
          )}

          {screen === "profiles" && workspace && (
            <>
              <div className="authStep"><span>2</span><div><b>Choose a researcher</b><small>{workspace.name}</small></div></div>
              <h2>Who is working?</h2>
              <p className="authLead">Each profile has its own identity and PIN. The lab can hold a maximum of four active profiles.</p>

              <div className="profileGrid">
                {profiles.map(profile => (
                  <button key={profile.id} className={`profileCard ${selectedProfileId === profile.id ? "active" : ""}`} onClick={() => { setSelectedProfileId(profile.id); setPin("") }}>
                    <span className="profileAvatar" style={{ background: profile.avatarColor || PROFILE_COLORS[0] }}>{initials(profile.displayName)}</span>
                    <strong>{profile.displayName}</strong>
                    <small>{friendlyRole(profile.role)}</small>
                  </button>
                ))}
                {profiles.length < 4 && <button className="profileCard addProfileCard" onClick={() => { setProfileRole(profiles.length ? "student" : "owner"); setScreen("create-profile") }}><span className="profileAdd">+</span><strong>Add profile</strong><small>{profiles.length}/4 in use</small></button>}
              </div>

              {selectedProfile && (
                <div className="profileUnlock">
                  <div><span className="profileMiniAvatar" style={{ background: selectedProfile.avatarColor }}>{initials(selectedProfile.displayName)}</span><div><strong>{selectedProfile.displayName}</strong><small>Enter this profile's PIN</small></div></div>
                  <div className="pinRow"><input value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))} onKeyDown={event => { if (event.key === "Enter") void unlockProfile() }} inputMode="numeric" type="password" placeholder="••••" autoFocus/><button onClick={unlockProfile} disabled={busy || pin.length < 4}>Open workspace →</button></div>
                </div>
              )}

              <div className="authBottomRow"><button className="authTextButton" onClick={signOutMain}>Sign out main account</button>{workspaces.length > 1 && <span>{workspaces.length} lab workspaces connected</span>}</div>
            </>
          )}

          {screen === "create-profile" && workspace && (
            <form onSubmit={addProfile}>
              <div className="authStep"><span>2</span><div><b>{profiles.length ? "Add researcher" : "Create owner profile"}</b><small>{workspace.name}</small></div></div>
              <h2>{profiles.length ? "Create another profile" : "Create the first lab profile"}</h2>
              <p className="authLead">Profiles separate identity and activity while keeping shared lab data in one workspace.</p>
              <label className="authField"><span>Display name</span><input value={profileName} onChange={event => setProfileName(event.target.value)} placeholder="e.g. Ananya Sharma" autoFocus/></label>
              <label className="authField"><span>Role</span><select value={profiles.length ? profileRole : "owner"} disabled={!profiles.length} onChange={event => setProfileRole(event.target.value as LabProfileRole)}><option value="owner">Lab owner / PI</option><option value="researcher">Researcher</option><option value="student">Student</option><option value="viewer">Viewer</option></select></label>
              <label className="authField"><span>Profile PIN</span><input value={profilePin} onChange={event => setProfilePin(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" type="password" placeholder="4–8 digits"/></label>
              <button className="authPrimary" disabled={busy || !profileName.trim() || profilePin.length < 4} type="submit">{busy ? "Creating profile…" : "Create profile"}<span>→</span></button>
              {profiles.length > 0 && <button type="button" className="authSecondary" onClick={() => setScreen("profiles")}>Back to profiles</button>}
            </form>
          )}

          {message && <div className="authMessage">{message}</div>}
        </div>
      </section>
    </main>
  )
}
