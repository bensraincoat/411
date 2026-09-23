import { useEffect, useRef, useState } from 'react'
import './App.css'

type DRGrade = 0 | 1 | 2 | 3 | 4

interface Prediction {
  filename: string
  grade: DRGrade
  label: string
  confidence: number
  message: string
}

interface PredictResponse {
  predictions: Prediction[]
}

interface Assessment {
  id: string | number
  patient_id: string
  filename: string
  date_created: string
  status: string
  label: string | null
  confidence: number | null
}

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GRADE_COLOR = (grade: number) => `var(--grade-${grade})`

const LABEL_TO_GRADE: Record<string, DRGrade> = {
  'No Diabetic Retinopathy': 0,
  'Mild NPDR': 1,
  'Moderate NPDR': 2,
  'Severe NPDR': 3,
  'Proliferative DR': 4,
}

function ApertureIcon() {
  return (
    <svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true" className="dropzone-icon">
      <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 7" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="32" r="5" fill="currentColor" />
    </svg>
  )
}

function WordmarkIcon() {
  return (
    <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true" className="wordmark-icon">
      <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="20" cy="20" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="20" cy="20" r="3" fill="currentColor" />
    </svg>
  )
}

function PhotoRing({
  src,
  alt,
  grade,
  loading,
}: {
  src: string
  alt: string
  grade: DRGrade | undefined
  loading: boolean
}) {
  const frac = grade !== undefined ? (grade + 1) / 5 : 0
  const dashoffset = CIRCUMFERENCE * (1 - frac)
  const stroke = grade !== undefined ? GRADE_COLOR(grade) : 'transparent'

  return (
    <div className={`photo-ring${loading ? ' is-loading' : ''}`}>
      <svg viewBox="0 0 100 100">
        <circle className="ring-track" cx="50" cy="50" r={RADIUS} />
        <circle
          className="ring-progress"
          cx="50"
          cy="50"
          r={RADIUS}
          style={{ stroke, strokeDasharray: CIRCUMFERENCE, strokeDashoffset: dashoffset }}
        />
      </svg>
      <img src={src} alt={alt} />
    </div>
  )
}

type Patient = {
  patient_id: string
  first_name: string
  last_name: string
  date_of_birth: string
}

function App() {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patientId, setPatientId] = useState('')
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const [searchPatientId, setSearchPatientId] = useState('')
  const [profileSearchId, setProfileSearchId] = useState('')
  const [patientProfile, setPatientProfile] = useState<Patient | null>(null)
  const [profileError, setProfileError] = useState('')

  const loadPatientProfile = async () => {
    if (profileSearchId.trim() === '') {
      setPatientProfile(null)
      setProfileError('')
      return
    }
    
    setPatientProfile(null) // Clear previous profile while loading
    setProfileError('') // Clear previous error
    const res = await fetch(`/api/patients/${profileSearchId.trim()}`)
    const data = await res.json()
    if (!res.ok) {
      setPatientProfile(null)
      setProfileError('Patient not found')
      return
    }
    setPatientProfile(data.patient)
  }

  const loadAssessments = async () => {
    try {
      const res = await fetch('/api/assessments')
      const data = await res.json()
      setAssessments(data.assessments ?? [])
    } catch {
      // history is supplementary; a failed refresh here shouldn't block the rest of the page
    }
  }

  useEffect(() => {
    loadAssessments()
  }, [])

  const applyFiles = (list: FileList | null) => {
    const selected = Array.from(list ?? [])
    if (selected.length === 0) return
    setFiles(selected)
    setPredictions([])
    setError(null)
    previews.forEach((url) => URL.revokeObjectURL(url))
    setPreviews(selected.map((f) => URL.createObjectURL(f)))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => applyFiles(e.target.files)

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragActive(false)
    applyFiles(e.dataTransfer.files)
  }

  const handleClear = () => {
    previews.forEach((url) => URL.revokeObjectURL(url))
    setFiles([])
    setPreviews([])
    setPredictions([])
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleProcess = async () => {
    if (files.length === 0) return
    if (patientId.trim() === '') {
      setError('Enter a patient ID before processing.')
      return
    }
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('patient_id', patientId)
    files.forEach((f) => formData.append('images', f))

    try {
      const res = await fetch('/api/predict', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`The server returned status ${res.status}.`)
      const data: PredictResponse = await res.json()
      setPredictions(data.predictions)
      await loadAssessments()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't reach the server. Check that the API is running and try again.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="shell-header">
        <div className="wordmark">
          <WordmarkIcon />
          openI
        </div>
        <p className="tagline">Screening support for diabetic retinopathy, read from retinal photographs.</p>
      </header>

      <main className="shell-main">
        <section className="intake">
          <h2>Add retinal photographs</h2>

          <div className="patient-field">
            <label htmlFor="patient-id">Patient ID</label>
            <input
              id="patient-id"
              type="text"
              placeholder="e.g. P-10432"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            />
          </div>

          <div
            className={`dropzone${isDragActive ? ' is-active' : ''}`}
            role="button"
            tabIndex={0}
            aria-label="Add retinal photographs. Drop files here or press enter to browse."
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                inputRef.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragActive(true)
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={handleDrop}
          >
            <ApertureIcon />
            <p className="dropzone-title">Drop photographs here</p>
            <p className="dropzone-sub">or click to browse files</p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="visually-hidden"
          />

          {files.length > 0 && (
            <div className="intake-bar">
              <span className="intake-count" aria-live="polite">
                {files.length} photograph{files.length === 1 ? '' : 's'} ready
              </span>
              <div className="intake-actions">
                <button type="button" className="btn-ghost" onClick={handleClear} disabled={loading}>
                  Clear
                </button>
                <button type="button" className="btn-primary" onClick={handleProcess} disabled={loading}>
                  {loading ? 'Processing…' : 'Process photographs'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>

        {previews.length > 0 && (
          <section className="results">
            <h2>Results</h2>
            <div className="result-grid">
              {previews.map((src, i) => {
                const prediction = predictions[i]
                return (
                  <article className="result-card" key={src}>
                    <PhotoRing
                      src={src}
                      alt={files[i]?.name ?? `Photograph ${i + 1}`}
                      grade={prediction?.grade}
                      loading={loading}
                    />
                    <div className="result-meta">
                      <p className="filename">{files[i]?.name}</p>
                      {prediction ? (
                        <>
                          <p className="grade-label" style={{ color: GRADE_COLOR(prediction.grade) }}>
                            {prediction.label}
                          </p>
                          <p className="confidence">{(prediction.confidence * 100).toFixed(1)}% confidence</p>
                          <p className="message">{prediction.message}</p>
                        </>
                      ) : (
                        <p className="pending">Waiting to process</p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        <section className="patient-profile">
          <h2>Patient Profile</h2>

          <input
            type="text"
            placeholder="Enter Patient ID"
            value={profileSearchId}
            onChange={(e) => setProfileSearchId(e.target.value)}
          />

          <button onClick={loadPatientProfile}>
            Search Patient
          </button>

          {profileError && <p>{profileError}</p>}
          {patientProfile && (
            <p>
              Patient ID: {patientProfile.patient_id}<br />
              Name: {patientProfile.first_name} {patientProfile.last_name}
              Date of Birth: {patientProfile.date_of_birth}
            </p>
          )}
        </section>
        

        <section className="history">
          <h2>Assessment history</h2>
          <input className="history-search"
            type="text"
            placeholder="Search by Patient ID"
            value={searchPatientId}
            onChange={(e) => setSearchPatientId(e.target.value)}
          />
          {searchPatientId.trim() !== '' &&
            assessments.length > 0 &&
            !assessments.some((a) =>
              a.patient_id.toLowerCase().includes(searchPatientId.trim().toLowerCase())
            ) && (
              <p className="history-empty">
                No assessments found for this Patient ID.
              </p>
            )}
          {assessments.length === 0 ? (
            <p className="history-empty">No assessments yet. Process a photograph above to start one.</p>
          ) : (
            <div className="assessment-list">
              {assessments.filter((a) => 
                a.patient_id.toLowerCase().includes(searchPatientId.trim().toLowerCase())
              ).map((a) => {
                const grade = a.label ? LABEL_TO_GRADE[a.label] : undefined
                const dotColor = grade !== undefined ? GRADE_COLOR(grade) : 'var(--line)'
                const isDone = a.status === 'completed'
                return (
                  <div className="assessment-row" key={a.id}>
                    <span className="assessment-dot" style={{ background: dotColor }} aria-hidden="true" />
                    <div className="assessment-main">
                      <p className="assessment-patient">Patient {a.patient_id}</p>
                      <p className="assessment-sub">{a.filename}</p>
                      <p className="assessment-sub">{new Date(a.date_created).toLocaleDateString()}</p>
                    </div>
                    <div className="assessment-result">
                      {isDone ? (
                        <>
                          <span className="assessment-label" style={{ color: dotColor }}>
                            {a.label ?? 'Not available'}
                          </span>
                          <span className="assessment-confidence">
                            {a.confidence !== null ? `${(a.confidence * 100).toFixed(1)}% confidence` : 'Not available'}
                          </span>
                        </>
                      ) : (
                        <span className="assessment-status">{a.status}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App